import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query, queryOne, queryRows, withTransaction, now, audit } from '../db.js';
import { requireUser, requirePasswordChanged } from '../auth.js';
import { emitReplyCreated } from '../community-events.js';
import {
  TAGS,
  canModerate,
  fail,
  postSchema,
  commentSchema,
  pageSchema,
  decodeCursor,
  encodeCursor,
  postSelect,
  commentSelect,
  postDtos,
  commentDto,
  visiblePost,
  writablePost,
  writableComment,
  setAttachments,
  unpinForChange,
  changeVote,
} from '../community.js';
import { mediaRouter } from '../community-media.js';

const router = Router();
router.use(requireUser, requirePasswordChanged);
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

export const actorLimit = (limit, windowMs = 60000) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator: (req) => req.user.id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Please slow down and try again shortly.', code: 'RATE_LIMITED' },
  });

const writeLimit = actorLimit(30);
const voteLimit = actorLimit(100);
const reportLimit = actorLimit(8, 10 * 60000);

router.use(mediaRouter);

router.get('/posts', async (req, res, next) => {
  try {
    const { limit, cursor } = pageSchema.parse(req.query);
    const { sort, tag, q } = z
      .object({
        sort: z.enum(['new', 'top', 'popular']).default('new'),
        tag: z.enum(TAGS).optional(),
        q: z.string().trim().max(100).default(''),
      })
      .parse(req.query);

    const current = decodeCursor(cursor);
    const cursorSchema = z.object({
      sort: z.enum(['new', 'top', 'popular']),
      tag: z.string(),
      q: z.string(),
      asOf: z.string().datetime(),
      id: z.string().uuid(),
      createdAt: z.string().datetime(),
      score: z.number().int(),
    });
    const parsed = current ? cursorSchema.safeParse(current) : null;
    if (current && (!parsed.success || current.sort !== sort || current.tag !== (tag || '') || current.q !== q)) {
      fail(400, 'Cursor does not match the current filters.');
    }
    const asOf = current?.asOf || now();
    const values = [req.user.id, asOf];
    const filters = ["x.status = 'visible'", 'x.created_at <= $2'];
    if (tag) {
      values.push(tag);
      filters.push(`x.tag = $${values.length}`);
    }
    if (q) {
      values.push(`%${q}%`);
      const idx = values.length;
      filters.push(`(x.title ILIKE $${idx} OR x.body ILIKE $${idx} OR x.tag ILIKE $${idx})`);
    }
    if (sort === 'popular') {
      values.push(new Date(Date.parse(asOf) - 7 * 86400000).toISOString());
      filters.push(`x.created_at >= $${values.length}`);
    }
    const where = filters.join(' AND ').replaceAll('x.', 'p.');
    const pinned = await queryRows(
      `SELECT * FROM (${postSelect}) p WHERE ${where} AND p.is_pinned = TRUE ORDER BY p.pinned_at DESC, p.id DESC LIMIT 3`,
      values
    );
    const normalFilters = [...filters, 'x.is_pinned = FALSE'];
    const normalValues = [...values];
    if (current) {
      if (sort === 'new') {
        normalValues.push(current.createdAt, current.id);
        const c1 = normalValues.length - 1;
        const c2 = normalValues.length;
        normalFilters.push(`(p.created_at < $${c1} OR (p.created_at = $${c1} AND p.id < $${c2}))`);
      } else {
        normalValues.push(current.score, current.createdAt, current.id);
        const sIdx = normalValues.length - 2;
        const c1 = normalValues.length - 1;
        const c2 = normalValues.length;
        normalFilters.push(`(p.score < $${sIdx} OR (p.score = $${sIdx} AND (p.created_at < $${c1} OR (p.created_at = $${c1} AND p.id < $${c2}))))`);
      }
    }
    normalValues.push(limit + 1);
    const limitIdx = normalValues.length;
    const order = sort === 'new' ? 'p.created_at DESC, p.id DESC' : 'p.score DESC, p.created_at DESC, p.id DESC';
    const whereClause = normalFilters.join(' AND ').replaceAll('x.', 'p.');
    const rows = await queryRows(
      `SELECT * FROM (${postSelect}) p WHERE ${whereClause} ORDER BY ${order} LIMIT $${limitIdx}`,
      normalValues
    );
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    res.json({
      items: await postDtos(items, req.user),
      pinned: await postDtos(pinned, req.user),
      tags: TAGS,
      canModerate: canModerate(req.user),
      nextCursor:
        rows.length > limit
          ? encodeCursor({
              sort,
              tag: tag || '',
              q,
              asOf,
              id: last.id,
              createdAt: last.created_at,
              score: Number(last.score) || 0,
            })
          : null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/posts', writeLimit, async (req, res, next) => {
  try {
    const input = postSchema.parse(req.body);
    const id = crypto.randomUUID();
    const time = now();
    await withTransaction(async (tx) => {
      await tx.query(
        'INSERT INTO community_posts (id, author_id, title, body, tag, link_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)',
        [id, req.user.id, input.title, input.body, input.tag, input.linkUrl || null, time]
      );
      await setAttachments(id, req.user.id, input.attachments, tx);
      await audit(req.user.id, 'community.post_created', 'community-post', id, {}, tx);
    });
    const post = await visiblePost(id, req.user.id);
    const dtos = await postDtos([post], req.user);
    res.status(201).json({ post: dtos[0] });
  } catch (error) {
    next(error);
  }
});

router.get('/posts/:id', async (req, res, next) => {
  try {
    const post = await visiblePost(req.params.id, req.user.id);
    const dtos = await postDtos([post], req.user);
    res.json({ post: dtos[0], canModerate: canModerate(req.user) });
  } catch (error) {
    next(error);
  }
});

router.patch('/posts/:id', writeLimit, async (req, res, next) => {
  try {
    const input = postSchema.parse(req.body);
    await withTransaction(async (tx) => {
      const post = await writablePost(req.params.id, req.user.id, tx.queryOne);
      if (post.author_id !== req.user.id) fail(403, 'Only the author may edit this post.');
      await unpinForChange(post, req.user, 'edit', tx);
      await tx.query(
        'UPDATE community_posts SET title = $1, body = $2, tag = $3, link_url = $4, edited_at = $5, updated_at = $5 WHERE id = $6',
        [input.title, input.body, input.tag, input.linkUrl || null, now(), post.id]
      );
      await setAttachments(post.id, req.user.id, input.attachments, tx);
      await audit(req.user.id, 'community.post_edited', 'community-post', post.id, {}, tx);
    });
    const post = await visiblePost(req.params.id, req.user.id);
    const dtos = await postDtos([post], req.user);
    res.json({ post: dtos[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/posts/:id', writeLimit, async (req, res, next) => {
  try {
    await withTransaction(async (tx) => {
      const post = await writablePost(req.params.id, req.user.id, tx.queryOne);
      if (post.author_id !== req.user.id) fail(403, 'Only the author may delete this post.');
      await unpinForChange(post, req.user, 'delete', tx);
      await tx.query(
        "UPDATE community_posts SET status = 'deleted', title = 'Deleted post', body = '', link_url = NULL, deleted_at = $1, updated_at = $1 WHERE id = $2",
        [now(), post.id]
      );
      await audit(req.user.id, 'community.post_deleted', 'community-post', post.id, {}, tx);
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// Hidden/deleted ancestors survive only as empty placeholders when visible replies need them.
const visibleBranch = `(x.status = 'visible' OR EXISTS(SELECT 1 FROM community_comments c
  LEFT JOIN community_comments g ON g.parent_id = c.id WHERE c.parent_id = x.id AND (c.status = 'visible' OR g.status = 'visible')))`;

router.get('/posts/:id/comments', async (req, res, next) => {
  try {
    await visiblePost(req.params.id, req.user.id);
    const { limit, cursor } = pageSchema.parse(req.query);
    const parentId = z.string().uuid().optional().parse(req.query.parentId);
    if (
      parentId &&
      !(await queryOne('SELECT 1 FROM community_comments WHERE id = $1 AND post_id = $2', [parentId, req.params.id]))
    ) {
      fail(404, 'Reply thread is unavailable.');
    }
    const current = decodeCursor(cursor);
    if (
      current &&
      !z
        .object({
          createdAt: z.string().datetime(),
          id: z.string().uuid(),
          postId: z.literal(req.params.id),
          parentId: z.literal(parentId || ''),
        })
        .safeParse(current).success
    ) {
      fail(400, 'Invalid comment cursor.');
    }
    const values = [req.user.id, req.params.id];
    const filters = ['x.post_id = $2', visibleBranch];
    if (parentId) {
      values.push(parentId);
      filters.push(`x.parent_id = $${values.length}`);
    } else {
      filters.push('x.parent_id IS NULL');
    }
    if (current) {
      values.push(current.createdAt, current.id);
      const c1 = values.length - 1;
      const c2 = values.length;
      filters.push(`(x.created_at > $${c1} OR (x.created_at = $${c1} AND x.id > $${c2}))`);
    }
    values.push(limit + 1);
    const limitIdx = values.length;
    const sql = commentSelect.replace(
      ' FROM community_comments x ',
      `, (SELECT count(*)::int FROM community_comments child WHERE child.parent_id = x.id
         AND (child.status = 'visible' OR EXISTS (SELECT 1 FROM community_comments grand WHERE grand.parent_id = child.id AND grand.status = 'visible'))) AS reply_count FROM community_comments x `
    );
    const rows = await queryRows(sql + ' WHERE ' + filters.join(' AND ') + ' ORDER BY x.created_at, x.id LIMIT $' + limitIdx, values);
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    res.json({
      items: items.map((row) => commentDto(row, req.user)),
      nextCursor:
        rows.length > limit
          ? encodeCursor({
              createdAt: last.created_at,
              id: last.id,
              postId: req.params.id,
              parentId: parentId || '',
            })
          : null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/posts/:id/comments', writeLimit, async (req, res, next) => {
  try {
    const input = commentSchema.parse(req.body);
    const id = crypto.randomUUID();
    const event = await withTransaction(async (tx) => {
      const post = await writablePost(req.params.id, req.user.id, tx.queryOne);
      let parent = null;
      if (input.parentId) {
        parent = await writableComment(input.parentId, req.user.id, tx.queryOne);
        if (parent.post_id !== post.id) fail(400, 'Reply must belong to this post.');
        if (parent.depth >= 2) fail(400, 'Replies support a maximum of three levels.');
      }
      await tx.query(
        'INSERT INTO community_comments (id, post_id, parent_id, author_id, body, depth, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)',
        [id, post.id, parent?.id || null, req.user.id, input.body, parent ? parent.depth + 1 : 0, now()]
      );
      return { id, postId: post.id, commentId: id, actorId: req.user.id, recipientId: parent ? parent.author_id : post.author_id };
    });
    if (event.recipientId && event.recipientId !== req.user.id) emitReplyCreated(event);
    const comment = await queryOne(commentSelect + ' WHERE x.id = $2', [req.user.id, id]);
    res.status(201).json({ comment: commentDto(comment, req.user) });
  } catch (error) {
    next(error);
  }
});

router.patch('/comments/:id', writeLimit, async (req, res, next) => {
  try {
    const input = z.object({ body: z.string().trim().min(1).max(5000) }).strict().parse(req.body);
    await withTransaction(async (tx) => {
      const comment = await writableComment(req.params.id, req.user.id, tx.queryOne);
      if (comment.author_id !== req.user.id) fail(403, 'Only the author may edit this comment.');
      await tx.query('UPDATE community_comments SET body = $1, edited_at = $2, updated_at = $2 WHERE id = $3', [input.body, now(), comment.id]);
      await audit(req.user.id, 'community.comment_edited', 'community-comment', comment.id, {}, tx);
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/comments/:id', writeLimit, async (req, res, next) => {
  try {
    await withTransaction(async (tx) => {
      const comment = await writableComment(req.params.id, req.user.id, tx.queryOne);
      if (comment.author_id !== req.user.id) fail(403, 'Only the author may delete this comment.');
      await tx.query("UPDATE community_comments SET status = 'deleted', body = '', deleted_at = $1, updated_at = $1 WHERE id = $2", [now(), comment.id]);
      await audit(req.user.id, 'community.comment_deleted', 'community-comment', comment.id, {}, tx);
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

for (const [type, path] of [
  ['post', 'posts'],
  ['comment', 'comments'],
]) {
  router.put('/' + path + '/:id/vote', voteLimit, async (req, res, next) => {
    try {
      const { value } = z.object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) }).strict().parse(req.body);
      const result = await changeVote(type, req.params.id, req.user, value);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}

router.post('/reports', reportLimit, async (req, res, next) => {
  try {
    const input = z
      .object({
        targetType: z.enum(['post', 'comment']),
        targetId: z.string().uuid(),
        reason: z.string().trim().min(3).max(500),
      })
      .strict()
      .parse(req.body);
    if (input.targetType === 'post') {
      await visiblePost(input.targetId, req.user.id);
    } else {
      const target = await queryOne('SELECT post_id, status FROM community_comments WHERE id = $1', [input.targetId]);
      if (!target || target.status !== 'visible') fail(404, 'Comment is unavailable.');
      await visiblePost(target.post_id, req.user.id);
    }
    const column = input.targetType === 'post' ? 'post_id' : 'comment_id';
    const already = await queryOne(`SELECT 1 FROM community_reports WHERE reporter_id = $1 AND ${column} = $2`, [req.user.id, input.targetId]);
    if (already) fail(409, 'You already reported this content.');
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO community_reports (id, reporter_id, ${column}, reason, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [id, req.user.id, input.targetId, input.reason, now()]
    );
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

export default router;
