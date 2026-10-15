import { z } from 'zod';
import { db,now,audit } from './db.js';
import { hasPermission,PERMISSIONS } from './permissions.js';

export const TAGS = ['AI','ML','Projects','Help','Events','Announcements'];
export const canModerate = user => hasPermission(user,PERMISSIONS.MODERATE_COMMUNITY);
export function fail(status,message,code='COMMUNITY_ERROR') {
  const error = new Error(message); error.status=status; error.code=code; throw error;
}
const httpsUrl = z.union([z.literal(''),z.string().url().max(1500)]).default('').superRefine((value,ctx) => {
  if (!value) return;
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password) ctx.addIssue({code:'custom',message:'Use an HTTPS link without credentials.'});
});
export const postSchema=z.object({
  title:z.string().trim().min(1).max(180),body:z.string().trim().min(1).max(15000),
  tag:z.enum(TAGS).default('AI'),linkUrl:httpsUrl,
  attachments:z.array(z.object({id:z.string().uuid(),description:z.string().trim().max(300).default('')})).max(4).default([]),
}).strict().refine(value=>new Set(value.attachments.map(a=>a.id)).size===value.attachments.length,{message:'Duplicate attachments.'});
export const commentSchema=z.object({body:z.string().trim().min(1).max(5000),parentId:z.string().uuid().nullable().default(null)}).strict();
export const reasonSchema=z.object({reason:z.string().trim().min(3).max(500)}).strict();
export const pageSchema=z.object({limit:z.coerce.number().int().min(1).max(50).default(20),cursor:z.string().max(1200).optional()});
export function encodeCursor(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
export function decodeCursor(value) {
  if(!value)return null;
  try { return JSON.parse(Buffer.from(value,'base64url').toString()); } catch { fail(400,'Invalid pagination cursor.'); }
}
const joins=' LEFT JOIN users u ON u.id=x.author_id LEFT JOIN student_profiles p ON p.user_id=u.id ';
const authorColumns='u.name author_name,u.status author_status,p.avatar_file_id author_avatar';
export const postSelect=`SELECT x.*,${authorColumns},
 (SELECT coalesce(sum(value),0) FROM community_post_votes WHERE post_id=x.id) score,
 coalesce((SELECT value FROM community_post_votes WHERE post_id=x.id AND user_id=?),0) my_vote,
 (SELECT count(*) FROM community_comments WHERE post_id=x.id AND status='visible') comment_count
 FROM community_posts x ${joins}`;
export const commentSelect=`SELECT x.*,${authorColumns},
 (SELECT coalesce(sum(value),0) FROM community_comment_votes WHERE comment_id=x.id) score,
 coalesce((SELECT value FROM community_comment_votes WHERE comment_id=x.id AND user_id=?),0) my_vote
 FROM community_comments x ${joins}`;
export function author(row) {
  const active=row.author_id&&row.author_status==='active';
  return {id:active?row.author_id:null,name:active?row.author_name:'Former member',
    avatarUrl:active&&row.author_avatar?`/api/members/media/${row.author_avatar}`:null};
}
export function rawPost(id,userId) { return db.prepare(postSelect+' WHERE x.id=?').get(userId,id); }
export function visiblePost(id,userId) {
  const row=rawPost(id,userId); if(!row||row.status!=='visible')fail(404,'Post is unavailable.'); return row;
}
export function writablePost(id,userId) {
  const row=visiblePost(id,userId); if(row.is_locked)fail(409,'This discussion is locked.','DISCUSSION_LOCKED'); return row;
}
export function rawComment(id,userId) { return db.prepare(commentSelect+' WHERE x.id=?').get(userId,id); }
export function writableComment(id,userId) {
  const row=rawComment(id,userId);
  if(!row||row.status!=='visible')fail(404,'Comment is unavailable.');
  writablePost(row.post_id,userId); return row;
}
export function postDtos(rows,user,{moderation=false}={}) {
  const images=rows.length?db.prepare(`SELECT a.*,m.width,m.height FROM community_post_attachments a
    JOIN community_media m ON m.id=a.media_id WHERE m.state='attached'
    AND a.post_id IN (${rows.map(()=>'?').join(',')}) ORDER BY a.sort_order`).all(...rows.map(r=>r.id)):[];
  return rows.map(row=>({
    id:row.id,title:row.title,body:row.body,tag:row.tag,linkUrl:row.link_url,
    author:author(row),createdAt:row.created_at,editedAt:row.edited_at,
    status:row.status,isLocked:Boolean(row.is_locked),isPinned:Boolean(row.is_pinned),pinnedAt:row.pinned_at,
    score:row.score,myVote:row.my_vote,commentCount:row.comment_count,
    canEdit:row.author_id===user.id&&row.status==='visible'&&!row.is_locked,
    attachments:images.filter(a=>a.post_id===row.id).map(a=>({
      id:a.media_id,description:a.description,width:a.width,height:a.height,
      url:`${moderation?'/api/admin/community':'/api/community'}/media/${a.media_id}`,
      thumbnailUrl:`${moderation?'/api/admin/community':'/api/community'}/media/${a.media_id}/thumbnail`,
    })),
  }));
}
export function commentDto(row,user) {
  const visible=row.status==='visible';
  return {id:row.id,postId:row.post_id,parentId:row.parent_id,depth:row.depth,status:row.status,
    body:visible?row.body:'',author:visible?author(row):{id:null,name:'Unavailable member',avatarUrl:null},
    score:visible?row.score:0,myVote:visible?row.my_vote:0,
    createdAt:row.created_at,editedAt:visible?row.edited_at:null,
    canEdit:visible&&row.author_id===user.id,replyCount:row.reply_count||0};
}
export function setAttachments(postId,userId,items) {
  const existing=db.prepare('SELECT media_id FROM community_post_attachments WHERE post_id=?').all(postId);
  for(const item of items) {
    const media=db.prepare(`SELECT m.*,a.post_id FROM community_media m LEFT JOIN community_post_attachments a ON a.media_id=m.id WHERE m.id=?`).get(item.id);
    if(!media||media.owner_id!==userId||media.state==='detached'||(media.post_id&&media.post_id!==postId)
      ||(media.state==='staged'&&media.expires_at<=now()))fail(400,'An attachment is unavailable or does not belong to you.');
  }
  db.prepare('DELETE FROM community_post_attachments WHERE post_id=?').run(postId);
  existing.filter(a=>!items.some(item=>item.id===a.media_id)).forEach(a=>{
    db.prepare("UPDATE community_media SET state='detached' WHERE id=?").run(a.media_id);
  });
  items.forEach((item,index)=>{
    db.prepare('INSERT INTO community_post_attachments (post_id,media_id,sort_order,description) VALUES (?,?,?,?)').run(postId,item.id,index,item.description);
    db.prepare("UPDATE community_media SET state='attached' WHERE id=?").run(item.id);
  });
}
export function unpinForChange(post,user,action) {
  if(post.is_pinned&&(action==='delete'||!canModerate(user))){
    db.prepare('UPDATE community_posts SET is_pinned=0,pinned_by=NULL,pinned_at=NULL WHERE id=?').run(post.id);
    audit(user.id,'community.unpinned','community-post',post.id,{reason:`Author ${action}`});
  }
}
export function changeVote(type,id,user,value) {
  return db.transaction(()=>{
    if(type==='post')writablePost(id,user.id); else writableComment(id,user.id);
    const table=type==='post'?'community_post_votes':'community_comment_votes';
    const column=type==='post'?'post_id':'comment_id';
    if(value===0)db.prepare(`DELETE FROM ${table} WHERE user_id=? AND ${column}=?`).run(user.id,id);
    else db.prepare(`INSERT INTO ${table} (user_id,${column},value) VALUES (?,?,?)
      ON CONFLICT(user_id,${column}) DO UPDATE SET value=excluded.value`).run(user.id,id,value);
    return {score:db.prepare(`SELECT coalesce(sum(value),0) score FROM ${table} WHERE ${column}=?`).get(id).score,myVote:value};
  }).immediate();
}
