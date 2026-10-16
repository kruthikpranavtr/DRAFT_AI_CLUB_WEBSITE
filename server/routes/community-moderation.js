import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { queryOne, queryRows, withTransaction, now, audit } from '../db.js';
import { requireAdmin, requirePermission } from '../auth.js';
import { PERMISSIONS } from '../permissions.js';
import {
  fail,
  reasonSchema,
  pageSchema,
  decodeCursor,
  encodeCursor,
  postSelect,
  postDtos,
  commentSelect,
  author,
  rawPost,
  rawComment,
} from '../community.js';
import { serveCommunityMedia } from '../community-media.js';

const router = Router();
router.use(requireAdmin, requirePermission(PERMISSIONS.MODERATE_COMMUNITY));
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});
router.use(
  rateLimit({
    windowMs: 60000,
    limit: 100,
    keyGenerator: (req) => req.user.id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  })
);

router.get(['/media/:id', '/media/:id/thumbnail'], (req, res, next) =>
  serveCommunityMedia(req, res, next, { moderation: true })
);

router.get('/reports', async (req, res, next) => {
  try {
    const { limit, cursor } = pageSchema.parse(req.query);
    const status = z.enum(['open', 'resolved', 'dismissed', 'all']).default('open').parse(req.query.status);
    const current = decodeCursor(cursor);
    if (
      current &&
      !z.object({ createdAt: z.string().datetime(), id: z.string().uuid(), status: z.literal(status) }).safeParse(current).success
    ) {
      fail(400, 'Invalid report cursor.');
    }
    const filters = [];
    const values = [];
    if (status !== 'all') {
      values.push(status);
      filters.push(`r.status = $${values.length}`);
    }
    if (current) {
      values.push(current.createdAt, current.id);
      const c1 = values.length - 1;
      const c2 = values.length;
      filters.push(`(r.created_at < $${c1} OR (r.created_at = $${c1} AND r.id < $${c2}))`);
    }
    values.push(limit + 1);
    const limitIdx = values.length;
    const rows = await queryRows(
      `SELECT r.*, u.name AS reporter_name, u.status AS reporter_status, c.post_id AS comment_post_id
       FROM community_reports r 
       LEFT JOIN users u ON u.id = r.reporter_id 
       LEFT JOIN community_comments c ON c.id = r.comment_id
       ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''} 
       ORDER BY r.created_at DESC, r.id DESC LIMIT $${limitIdx}`,
      values
    );
    const items = await Promise.all(
      rows.slice(0, limit).map(async (row) => {
        const target = row.post_id ? await rawPost(row.post_id, req.user.id) : await rawComment(row.comment_id, req.user.id);
        return {
          id: row.id,
          reason: row.reason,
          status: row.status,
          resolution: row.resolution,
          createdAt: row.created_at,
          reporterName: row.reporter_status === 'active' ? row.reporter_name : 'Former member',
          targetType: row.post_id ? 'post' : 'comment',
          targetId: row.post_id || row.comment_id,
          postId: row.post_id || row.comment_post_id,
          target: target
            ? {
                title: target.title || null,
                body: target.body,
                status: target.status,
                isLocked: Boolean(target.is_locked),
              }
            : null,
        };
      })
    );
    const last = rows[Math.min(limit, rows.length) - 1];
    res.json({
      items,
      nextCursor: rows.length > limit ? encodeCursor({ createdAt: last.created_at, id: last.id, status }) : null,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/posts', async (req, res, next) => {
  try {
    const { limit, cursor } = pageSchema.parse(req.query);
    const status = z.enum(['hidden', 'removed']).default('hidden').parse(req.query.status);
    const current = decodeCursor(cursor);
    if (
      current &&
      !z.object({ createdAt: z.string().datetime(), id: z.string().uuid(), status: z.literal(status) }).safeParse(current).success
    ) {
      fail(400, 'Invalid content cursor.');
    }
    const values = [req.user.id, status];
    const where = ['x.status = $2'];
    if (current) {
      values.push(current.createdAt, current.id);
      const c1 = values.length - 1;
      const c2 = values.length;
      where.push(`(x.created_at < $${c1} OR (x.created_at = $${c1} AND x.id < $${c2}))`);
    }
    values.push(limit + 1);
    const limitIdx = values.length;
    const rows = await queryRows(
      postSelect + ' WHERE ' + where.join(' AND ') + ' ORDER BY x.created_at DESC, x.id DESC LIMIT $' + limitIdx,
      values
    );
    const last = rows[Math.min(limit, rows.length) - 1];
    res.json({
      items: await postDtos(rows.slice(0, limit), req.user, { moderation: true }),
      nextCursor: rows.length > limit ? encodeCursor({ createdAt: last.created_at, id: last.id, status }) : null,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/posts/:id', async (req, res, next) => {
  try {
    const row = await rawPost(req.params.id, req.user.id);
    if (!row || row.status === 'deleted') fail(404, 'Post is unavailable.');
    const dtos = await postDtos([row], req.user, { moderation: true });
    res.json({ post: dtos[0] });
  } catch (error) {
    next(error);
  }
});

router.get('/comments', async (req, res, next) => {
  try {
    const { limit, cursor } = pageSchema.parse(req.query);
    const status = z.enum(['hidden', 'removed']).default('hidden').parse(req.query.status);
    const current = decodeCursor(cursor);
    if (
      current &&
      !z.object({ createdAt: z.string().datetime(), id: z.string().uuid(), status: z.literal(status) }).safeParse(current).success
    ) {
      fail(400, 'Invalid comment cursor.');
    }
    const values = [req.user.id, status];
    const where = ['x.status = $2'];
    if (current) {
      values.push(current.createdAt, current.id);
      const c1 = values.length - 1;
      const c2 = values.length;
      where.push(`(x.created_at < $${c1} OR (x.created_at = $${c1} AND x.id < $${c2}))`);
    }
    values.push(limit + 1);
    const limitIdx = values.length;
    const rows = await queryRows(
      commentSelect + ' WHERE ' + where.join(' AND ') + ' ORDER BY x.created_at DESC, x.id DESC LIMIT $' + limitIdx,
      values
    );
    const last = rows[Math.min(limit, rows.length) - 1];
    res.json({
      items: rows.slice(0, limit).map((row) => ({
        id: row.id,
        postId: row.post_id,
        body: row.body,
        status: row.status,
        createdAt: row.created_at,
        editedAt: row.edited_at,
        author: author(row),
      })),
      nextCursor: rows.length > limit ? encodeCursor({ createdAt: last.created_at, id: last.id, status }) : null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/reports/:id/resolve', async (req, res, next) => {
  try {
    const input = z
      .object({ reason: z.string().trim().min(3).max(500), status: z.enum(['resolved', 'dismissed']) })
      .strict()
      .parse(req.body);
    await withTransaction(async (tx) => {
      const report = await tx.queryOne('SELECT * FROM community_reports WHERE id = $1', [req.params.id]);
      if (!report) fail(404, 'Report is unavailable.');
      if (report.status !== 'open') fail(409, 'This report is already closed.');
      await tx.query(
        'UPDATE community_reports SET status = $1, resolution = $2, moderator_id = $3, resolved_at = $4 WHERE id = $5',
        [input.status, input.reason, req.user.id, now(), report.id]
      );
      await audit(req.user.id, 'community.report_' + input.status, 'community-report', report.id, {
        reason: input.reason,
        from: report.status,
        to: input.status,
      }, tx);
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

for (const [type, path] of [
  ['post', 'posts'],
  ['comment', 'comments'],
]) {
  router.post('/' + path + '/:id/moderate', async (req, res, next) => {
    try {
      const input = z
        .object({
          action: z.enum(type === 'post' ? ['hide', 'remove', 'restore', 'lock', 'unlock'] : ['hide', 'remove', 'restore']),
          reason: z.string().trim().min(3).max(500),
        })
        .strict()
        .parse(req.body);
      await withTransaction(async (tx) => {
        const target =
          type === 'post' ? await rawPost(req.params.id, req.user.id, tx.queryOne) : await rawComment(req.params.id, req.user.id, tx.queryOne);
        if (!target || target.status === 'deleted') fail(404, 'Content is unavailable.');
        const table = type === 'post' ? 'community_posts' : 'community_comments';
        let to = target.status;
        if (['lock', 'unlock'].includes(input.action)) {
          if (target.status !== 'visible') fail(409, 'Restore the post before changing its lock.');
          await tx.query('UPDATE community_posts SET is_locked = $1, updated_at = $2 WHERE id = $3', [
            input.action === 'lock',
            now(),
            target.id,
          ]);
        } else {
          to = { hide: 'hidden', remove: 'removed', restore: 'visible' }[input.action];
          if (type === 'comment' && to === 'visible') {
            const post = await rawPost(target.post_id, req.user.id, tx.queryOne);
            if (post?.status !== 'visible') fail(409, 'Restore the discussion first.');
          }
          await tx.query(`UPDATE ${table} SET status = $1, updated_at = $2 WHERE id = $3`, [to, now(), target.id]);
          if (type === 'post' && to !== 'visible') {
            await tx.query('UPDATE community_posts SET is_pinned = FALSE, pinned_by = NULL, pinned_at = NULL WHERE id = $1', [target.id]);
          }
        }
        await audit(req.user.id, 'community.' + input.action, 'community-' + type, target.id, {
          reason: input.reason,
          from: target.status,
          to,
          wasLocked: Boolean(target.is_locked),
          wasPinned: Boolean(target.is_pinned),
        }, tx);
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
}

router.put('/posts/:id/pin', async (req, res, next) => {
  try {
    const input = reasonSchema.parse(req.body);
    await withTransaction(async (tx) => {
      const post = await rawPost(req.params.id, req.user.id, tx.queryOne);
      if (!post || post.status !== 'visible') fail(404, 'Post is unavailable.');
      if (post.is_pinned) return;
      const countRow = await tx.queryOne("SELECT count(*)::int AS count FROM community_posts WHERE status = 'visible' AND is_pinned = TRUE");
      if ((Number(countRow?.count) || 0) >= 3) fail(409, 'Three announcements are already pinned. Unpin one first.');
      await tx.query('UPDATE community_posts SET is_pinned = TRUE, pinned_by = $1, pinned_at = $2, updated_at = $2 WHERE id = $3', [
        req.user.id,
        now(),
        post.id,
      ]);
      await audit(req.user.id, 'community.pinned', 'community-post', post.id, { reason: input.reason }, tx);
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/posts/:id/pin', async (req, res, next) => {
  try {
    const input = reasonSchema.parse(req.body);
    await withTransaction(async (tx) => {
      const post = await rawPost(req.params.id, req.user.id, tx.queryOne);
      if (!post) fail(404, 'Post is unavailable.');
      if (!post.is_pinned) return;
      await tx.query('UPDATE community_posts SET is_pinned = FALSE, pinned_by = NULL, pinned_at = NULL, updated_at = $1 WHERE id = $2', [
        now(),
        post.id,
      ]);
      await audit(req.user.id, 'community.unpinned', 'community-post', post.id, { reason: input.reason }, tx);
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
