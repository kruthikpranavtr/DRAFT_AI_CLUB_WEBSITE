import { z } from 'zod';
import { query, queryOne, queryRows, withTransaction, now, audit } from './db.js';
import { hasPermission, PERMISSIONS } from './permissions.js';

export const TAGS = ['AI', 'ML', 'Projects', 'Help', 'Events', 'Announcements'];
export const canModerate = (user) => hasPermission(user, PERMISSIONS.MODERATE_COMMUNITY);
export function fail(status, message, code = 'COMMUNITY_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

const httpsUrl = z.union([z.literal(''), z.string().url().max(1500)]).default('').superRefine((value, ctx) => {
  if (!value) return;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    ctx.addIssue({ code: 'custom', message: 'Use an HTTPS link without credentials.' });
  }
});

export const postSchema = z.object({
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(15000),
  tag: z.enum(TAGS).default('AI'),
  linkUrl: httpsUrl,
  attachments: z.array(z.object({
    id: z.string().uuid(),
    description: z.string().trim().max(300).default('')
  })).max(4).default([]),
}).strict().refine((value) => new Set(value.attachments.map((a) => a.id)).size === value.attachments.length, {
  message: 'Duplicate attachments.',
});

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  parentId: z.string().uuid().nullable().default(null)
}).strict();

export const reasonSchema = z.object({
  reason: z.string().trim().min(3).max(500)
}).strict();

export const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(1200).optional()
});

export function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor(value) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString());
  } catch {
    fail(400, 'Invalid pagination cursor.');
  }
}

const joins = ' LEFT JOIN users u ON u.id = x.author_id LEFT JOIN student_profiles p ON p.user_id = u.id ';
const authorColumns = 'u.name AS author_name, u.status AS author_status, p.avatar_file_id AS author_avatar';

export const postSelect = `SELECT x.*, ${authorColumns},
  (SELECT coalesce(sum(value), 0)::int FROM community_post_votes WHERE post_id = x.id) AS score,
  coalesce((SELECT value FROM community_post_votes WHERE post_id = x.id AND user_id = $1), 0) AS my_vote,
  (SELECT count(*)::int FROM community_comments WHERE post_id = x.id AND status = 'visible') AS comment_count
  FROM community_posts x ${joins}`;

export const commentSelect = `SELECT x.*, ${authorColumns},
  (SELECT coalesce(sum(value), 0)::int FROM community_comment_votes WHERE comment_id = x.id) AS score,
  coalesce((SELECT value FROM community_comment_votes WHERE comment_id = x.id AND user_id = $1), 0) AS my_vote
  FROM community_comments x ${joins}`;

export function author(row) {
  const active = row.author_id && row.author_status === 'active';
  return {
    id: active ? row.author_id : null,
    name: active ? row.author_name : 'Former member',
    avatarUrl: active && row.author_avatar ? `/api/members/media/${row.author_avatar}` : null,
  };
}

export async function rawPost(id, userId, runner = queryOne) {
  return await runner(postSelect + ' WHERE x.id = $2', [userId, id]);
}

export async function visiblePost(id, userId, runner = queryOne) {
  const row = await rawPost(id, userId, runner);
  if (!row || row.status !== 'visible') fail(404, 'Post is unavailable.');
  return row;
}

export async function writablePost(id, userId, runner = queryOne) {
  const row = await visiblePost(id, userId, runner);
  if (row.is_locked) fail(409, 'This discussion is locked.', 'DISCUSSION_LOCKED');
  return row;
}

export async function rawComment(id, userId, runner = queryOne) {
  return await runner(commentSelect + ' WHERE x.id = $2', [userId, id]);
}

export async function writableComment(id, userId, runner = queryOne) {
  const row = await rawComment(id, userId, runner);
  if (!row || row.status !== 'visible') fail(404, 'Comment is unavailable.');
  await writablePost(row.post_id, userId, runner);
  return row;
}

export async function postDtos(rows, user, { moderation = false } = {}) {
  if (!rows || !rows.length) return [];
  const ids = rows.map((r) => r.id);
  const images = await queryRows(
    `SELECT a.*, m.width, m.height 
     FROM community_post_attachments a
     JOIN community_media m ON m.id = a.media_id 
     WHERE m.state = 'attached' AND a.post_id = ANY($1::text[]) 
     ORDER BY a.sort_order`,
    [ids]
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    tag: row.tag,
    linkUrl: row.link_url,
    author: author(row),
    createdAt: row.created_at,
    editedAt: row.edited_at,
    status: row.status,
    isLocked: Boolean(row.is_locked),
    isPinned: Boolean(row.is_pinned),
    pinnedAt: row.pinned_at,
    score: Number(row.score) || 0,
    myVote: Number(row.my_vote) || 0,
    commentCount: Number(row.comment_count) || 0,
    canEdit: row.author_id === user.id && row.status === 'visible' && !row.is_locked,
    attachments: images.filter((a) => a.post_id === row.id).map((a) => ({
      id: a.media_id,
      description: a.description,
      width: a.width,
      height: a.height,
      url: `${moderation ? '/api/admin/community' : '/api/community'}/media/${a.media_id}`,
      thumbnailUrl: `${moderation ? '/api/admin/community' : '/api/community'}/media/${a.media_id}/thumbnail`,
    })),
  }));
}

export function commentDto(row, user) {
  const visible = row.status === 'visible';
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    depth: row.depth,
    status: row.status,
    body: visible ? row.body : '',
    author: visible ? author(row) : { id: null, name: 'Unavailable member', avatarUrl: null },
    score: visible ? (Number(row.score) || 0) : 0,
    myVote: visible ? (Number(row.my_vote) || 0) : 0,
    createdAt: row.created_at,
    editedAt: visible ? row.edited_at : null,
    canEdit: visible && row.author_id === user.id,
    replyCount: Number(row.reply_count) || 0,
  };
}

export async function setAttachments(postId, userId, items, tx) {
  const runner = tx ? tx.query.bind(tx) : query;
  const runnerRows = tx ? tx.queryRows.bind(tx) : queryRows;
  const runnerOne = tx ? tx.queryOne.bind(tx) : queryOne;

  const existing = await runnerRows('SELECT media_id FROM community_post_attachments WHERE post_id = $1', [postId]);
  for (const item of items) {
    const media = await runnerOne(
      `SELECT m.*, a.post_id FROM community_media m 
       LEFT JOIN community_post_attachments a ON a.media_id = m.id 
       WHERE m.id = $1`,
      [item.id]
    );
    if (!media || media.owner_id !== userId || media.state === 'detached' || (media.post_id && media.post_id !== postId)
      || (media.state === 'staged' && new Date(media.expires_at) <= new Date(now()))) {
      fail(400, 'An attachment is unavailable or does not belong to you.');
    }
  }
  await runner('DELETE FROM community_post_attachments WHERE post_id = $1', [postId]);
  for (const a of existing.filter((a) => !items.some((item) => item.id === a.media_id))) {
    await runner("UPDATE community_media SET state = 'detached' WHERE id = $1", [a.media_id]);
  }
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    await runner(
      'INSERT INTO community_post_attachments (post_id, media_id, sort_order, description) VALUES ($1, $2, $3, $4)',
      [postId, item.id, index, item.description]
    );
    await runner("UPDATE community_media SET state = 'attached' WHERE id = $1", [item.id]);
  }
}

export async function unpinForChange(post, user, action, tx) {
  const runner = tx ? tx.query.bind(tx) : query;
  if (post.is_pinned && (action === 'delete' || !canModerate(user))) {
    await runner('UPDATE community_posts SET is_pinned = FALSE, pinned_by = NULL, pinned_at = NULL WHERE id = $1', [post.id]);
    await audit(user.id, 'community.unpinned', 'community-post', post.id, { reason: `Author ${action}` }, tx);
  }
}

export async function changeVote(type, id, user, value) {
  return await withTransaction(async (tx) => {
    if (type === 'post') await writablePost(id, user.id, tx.queryOne);
    else await writableComment(id, user.id, tx.queryOne);
    const table = type === 'post' ? 'community_post_votes' : 'community_comment_votes';
    const column = type === 'post' ? 'post_id' : 'comment_id';
    if (value === 0) {
      await tx.query(`DELETE FROM ${table} WHERE user_id = $1 AND ${column} = $2`, [user.id, id]);
    } else {
      await tx.query(
        `INSERT INTO ${table} (user_id, ${column}, value) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, ${column}) DO UPDATE SET value = EXCLUDED.value`,
        [user.id, id, value]
      );
    }
    const scoreRow = await tx.queryOne(
      `SELECT coalesce(sum(value), 0)::int AS score FROM ${table} WHERE ${column} = $1`,
      [id]
    );
    return { score: Number(scoreRow?.score) || 0, myVote: value };
  });
}
