import crypto from 'node:crypto';

// Write notifications inside the content transaction so readers never see
// alerts for posts or site changes that failed to save.
const kinds = new Set(['community_post','community_reply','site_update','news_update','assessment_update','direct_message']);
const safeLink = link => typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') && !link.includes('\\') && link.length <= 512;

export async function addNotification(tx, { type, title, body = '', link = '/notifications', actorId = null, recipientId = null }) {
  if (!kinds.has(type)) throw new Error('Invalid notification type');
  if (!safeLink(link)) throw new Error('Invalid notification destination');
  if (!title?.trim() || title.trim().length > 180 || String(body).length > 800) throw new Error('Invalid notification content');
  if (recipientId && recipientId === actorId) return null;
  const id = crypto.randomUUID();
  await tx.query(
    `INSERT INTO notification_events (id,type,title,body,link,actor_id,recipient_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id,type,title.trim(),String(body),link,actorId,recipientId],
  );
  return id;
}

export async function notifyCommunityReply(tx, { actorId, authorId, parentAuthorId, postId, actorName }) {
  const recipients = new Set([authorId,parentAuthorId].filter(Boolean));
  for (const recipientId of recipients) {
    await addNotification(tx, {
      type:'community_reply',
      title:'New reply in your discussion',
      body:`${actorName || 'A member'} replied to a conversation you are part of.`,
      link:`/community/posts/${postId}`,
      actorId,recipientId,
    });
  }
}
