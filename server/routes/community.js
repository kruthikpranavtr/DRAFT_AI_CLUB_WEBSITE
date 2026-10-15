import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { db,now,audit } from '../db.js';
import { requireUser,requirePasswordChanged } from '../auth.js';
import { emitReplyCreated } from '../community-events.js';
import { TAGS,canModerate,fail,postSchema,commentSchema,pageSchema,decodeCursor,encodeCursor,postSelect,
  commentSelect,postDtos,commentDto,visiblePost,writablePost,writableComment,setAttachments,unpinForChange,changeVote } from '../community.js';
import { mediaRouter } from '../community-media.js';

const router=Router();
router.use(requireUser,requirePasswordChanged);
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
export const actorLimit=(limit,windowMs=60000)=>rateLimit({windowMs,limit,keyGenerator:req=>req.user.id,
  standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Please slow down and try again shortly.',code:'RATE_LIMITED'}});
const writeLimit=actorLimit(30),voteLimit=actorLimit(100),reportLimit=actorLimit(8,10*60000);
router.use(mediaRouter);
router.get('/posts',(req,res)=>{
  const {limit,cursor}=pageSchema.parse(req.query);
  const {sort,tag,q}=z.object({sort:z.enum(['new','top','popular']).default('new'),tag:z.enum(TAGS).optional(),q:z.string().trim().max(100).default('')}).parse(req.query);
  const current=decodeCursor(cursor);
  const cursorSchema=z.object({sort:z.enum(['new','top','popular']),tag:z.string(),q:z.string(),asOf:z.string().datetime(),id:z.string().uuid(),createdAt:z.string().datetime(),score:z.number().int()});
  const parsed=current?cursorSchema.safeParse(current):null;
  if(current&&(!parsed.success||current.sort!==sort||current.tag!==(tag||'')||current.q!==q))fail(400,'Cursor does not match the current filters.');
  const asOf=current?.asOf||now();
  const filters=["x.status='visible'",'x.created_at<=?'],values=[asOf];
  if(tag){filters.push('x.tag=?');values.push(tag);}
  if(q){filters.push("instr(lower(x.title||' '||x.body||' '||x.tag),lower(?))>0");values.push(q);}
  if(sort==='popular'){filters.push('x.created_at>=?');values.push(new Date(Date.parse(asOf)-7*86400000).toISOString());}
  const where=filters.join(' AND ');
  const pinned=db.prepare(postSelect+' WHERE '+where+' AND x.is_pinned=1 ORDER BY x.pinned_at DESC,x.id DESC LIMIT 3').all(req.user.id,...values);
  const normalFilters=[...filters,'x.is_pinned=0'],normalValues=[...values];
  if(current){
    if(sort==='new'){normalFilters.push('(x.created_at<? OR (x.created_at=? AND x.id<?))');normalValues.push(current.createdAt,current.createdAt,current.id);}
    else {normalFilters.push('(score<? OR (score=? AND (x.created_at<? OR (x.created_at=? AND x.id<?))))');normalValues.push(current.score,current.score,current.createdAt,current.createdAt,current.id);}
  }
  const order=sort==='new'?'x.created_at DESC,x.id DESC':'score DESC,x.created_at DESC,x.id DESC';
  const rows=db.prepare(postSelect+' WHERE '+normalFilters.join(' AND ')+' ORDER BY '+order+' LIMIT ?').all(req.user.id,...normalValues,limit+1);
  const items=rows.slice(0,limit),last=items.at(-1);
  res.json({items:postDtos(items,req.user),pinned:postDtos(pinned,req.user),tags:TAGS,canModerate:canModerate(req.user),
    nextCursor:rows.length>limit?encodeCursor({sort,tag:tag||'',q,asOf,id:last.id,createdAt:last.created_at,score:last.score}):null});
});
router.post('/posts',writeLimit,(req,res)=>{
  const input=postSchema.parse(req.body),id=crypto.randomUUID(),time=now();
  db.transaction(()=>{
    db.prepare('INSERT INTO community_posts (id,author_id,title,body,tag,link_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(id,req.user.id,input.title,input.body,input.tag,input.linkUrl||null,time,time);
    setAttachments(id,req.user.id,input.attachments);
    audit(req.user.id,'community.post_created','community-post',id);
  }).immediate();
  res.status(201).json({post:postDtos([visiblePost(id,req.user.id)],req.user)[0]});
});
router.get('/posts/:id',(req,res)=>res.json({post:postDtos([visiblePost(req.params.id,req.user.id)],req.user)[0],canModerate:canModerate(req.user)}));
router.patch('/posts/:id',writeLimit,(req,res)=>{
  const input=postSchema.parse(req.body);
  db.transaction(()=>{
    const post=writablePost(req.params.id,req.user.id);
    if(post.author_id!==req.user.id)fail(403,'Only the author may edit this post.');
    unpinForChange(post,req.user,'edit');
    db.prepare('UPDATE community_posts SET title=?,body=?,tag=?,link_url=?,edited_at=?,updated_at=? WHERE id=?')
      .run(input.title,input.body,input.tag,input.linkUrl||null,now(),now(),post.id);
    setAttachments(post.id,req.user.id,input.attachments);
    audit(req.user.id,'community.post_edited','community-post',post.id);
  }).immediate();
  res.json({post:postDtos([visiblePost(req.params.id,req.user.id)],req.user)[0]});
});
router.delete('/posts/:id',writeLimit,(req,res)=>{
  db.transaction(()=>{
    const post=writablePost(req.params.id,req.user.id);
    if(post.author_id!==req.user.id)fail(403,'Only the author may delete this post.');
    unpinForChange(post,req.user,'delete');
    db.prepare("UPDATE community_posts SET status='deleted',title='Deleted post',body='',link_url=NULL,deleted_at=?,updated_at=? WHERE id=?").run(now(),now(),post.id);
    audit(req.user.id,'community.post_deleted','community-post',post.id);
  }).immediate();
  res.status(204).end();
});

// Hidden/deleted ancestors survive only as empty placeholders when visible replies need them.
const visibleBranch=`(x.status='visible' OR EXISTS(SELECT 1 FROM community_comments c
  LEFT JOIN community_comments g ON g.parent_id=c.id WHERE c.parent_id=x.id AND (c.status='visible' OR g.status='visible')))`;
router.get('/posts/:id/comments',(req,res)=>{
  visiblePost(req.params.id,req.user.id);
  const {limit,cursor}=pageSchema.parse(req.query);
  const parentId=z.string().uuid().optional().parse(req.query.parentId);
  if(parentId&&!db.prepare('SELECT 1 FROM community_comments WHERE id=? AND post_id=?').get(parentId,req.params.id))fail(404,'Reply thread is unavailable.');
  const current=decodeCursor(cursor);
  if(current&&!z.object({createdAt:z.string().datetime(),id:z.string().uuid(),postId:z.literal(req.params.id),parentId:z.literal(parentId||'')}).safeParse(current).success)fail(400,'Invalid comment cursor.');
  const values=[req.user.id,req.params.id],filters=['x.post_id=?',visibleBranch];
  if(parentId){filters.push('x.parent_id=?');values.push(parentId);}else filters.push('x.parent_id IS NULL');
  if(current){filters.push('(x.created_at>? OR (x.created_at=? AND x.id>?))');values.push(current.createdAt,current.createdAt,current.id);}
  const sql=commentSelect.replace(' FROM community_comments x ',`,(SELECT count(*) FROM community_comments child WHERE child.parent_id=x.id
    AND (child.status='visible' OR EXISTS (SELECT 1 FROM community_comments grand WHERE grand.parent_id=child.id AND grand.status='visible'))) reply_count FROM community_comments x `);
  const rows=db.prepare(sql+' WHERE '+filters.join(' AND ')+' ORDER BY x.created_at,x.id LIMIT ?').all(...values,limit+1);
  const items=rows.slice(0,limit),last=items.at(-1);
  res.json({items:items.map(row=>commentDto(row,req.user)),nextCursor:rows.length>limit?encodeCursor({createdAt:last.created_at,id:last.id,postId:req.params.id,parentId:parentId||''}):null});
});
router.post('/posts/:id/comments',writeLimit,(req,res)=>{
  const input=commentSchema.parse(req.body),id=crypto.randomUUID();
  const event=db.transaction(()=>{
    const post=writablePost(req.params.id,req.user.id);
    let parent=null;
    if(input.parentId){
      parent=writableComment(input.parentId,req.user.id);
      if(parent.post_id!==post.id)fail(400,'Reply must belong to this post.');
      if(parent.depth>=2)fail(400,'Replies support a maximum of three levels.');
    }
    db.prepare('INSERT INTO community_comments (id,post_id,parent_id,author_id,body,depth,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(id,post.id,parent?.id||null,req.user.id,input.body,parent?parent.depth+1:0,now(),now());
    return {id,postId:post.id,commentId:id,actorId:req.user.id,recipientId:parent?parent.author_id:post.author_id};
  }).immediate();
  if(event.recipientId&&event.recipientId!==req.user.id)emitReplyCreated(event);
  res.status(201).json({comment:commentDto(db.prepare(commentSelect+' WHERE x.id=?').get(req.user.id,id),req.user)});
});
router.patch('/comments/:id',writeLimit,(req,res)=>{
  const input=z.object({body:z.string().trim().min(1).max(5000)}).strict().parse(req.body);
  db.transaction(()=>{
    const comment=writableComment(req.params.id,req.user.id);
    if(comment.author_id!==req.user.id)fail(403,'Only the author may edit this comment.');
    db.prepare('UPDATE community_comments SET body=?,edited_at=?,updated_at=? WHERE id=?').run(input.body,now(),now(),comment.id);
    audit(req.user.id,'community.comment_edited','community-comment',comment.id);
  }).immediate();
  res.json({ok:true});
});
router.delete('/comments/:id',writeLimit,(req,res)=>{
  db.transaction(()=>{
    const comment=writableComment(req.params.id,req.user.id);
    if(comment.author_id!==req.user.id)fail(403,'Only the author may delete this comment.');
    db.prepare("UPDATE community_comments SET status='deleted',body='',deleted_at=?,updated_at=? WHERE id=?").run(now(),now(),comment.id);
    audit(req.user.id,'community.comment_deleted','community-comment',comment.id);
  }).immediate();
  res.status(204).end();
});
for(const [type,path] of [['post','posts'],['comment','comments']]){
  router.put('/'+path+'/:id/vote',voteLimit,(req,res)=>{
    const {value}=z.object({value:z.union([z.literal(-1),z.literal(0),z.literal(1)])}).strict().parse(req.body);
    res.json(changeVote(type,req.params.id,req.user,value));
  });
}
router.post('/reports',reportLimit,(req,res)=>{
  const input=z.object({targetType:z.enum(['post','comment']),targetId:z.string().uuid(),reason:z.string().trim().min(3).max(500)}).strict().parse(req.body);
  if(input.targetType==='post')visiblePost(input.targetId,req.user.id);
  else{
    const target=db.prepare('SELECT post_id,status FROM community_comments WHERE id=?').get(input.targetId);
    if(!target||target.status!=='visible')fail(404,'Comment is unavailable.');
    visiblePost(target.post_id,req.user.id);
  }
  const column=input.targetType==='post'?'post_id':'comment_id';
  if(db.prepare(`SELECT 1 FROM community_reports WHERE reporter_id=? AND ${column}=?`).get(req.user.id,input.targetId))fail(409,'You already reported this content.');
  const id=crypto.randomUUID();
  db.prepare(`INSERT INTO community_reports (id,reporter_id,${column},reason,created_at) VALUES (?,?,?,?,?)`).run(id,req.user.id,input.targetId,input.reason,now());
  res.status(201).json({id});
});
export default router;
