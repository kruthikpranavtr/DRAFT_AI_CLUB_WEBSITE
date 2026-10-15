import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { db,now,audit } from '../db.js';
import { requireAdmin,requirePermission } from '../auth.js';
import { PERMISSIONS } from '../permissions.js';
import { fail,reasonSchema,pageSchema,decodeCursor,encodeCursor,postSelect,postDtos,commentSelect,author,rawPost,rawComment } from '../community.js';
import { serveCommunityMedia } from '../community-media.js';
const router=Router();
router.use(requireAdmin,requirePermission(PERMISSIONS.MODERATE_COMMUNITY));
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
router.use(rateLimit({windowMs:60000,limit:100,keyGenerator:req=>req.user.id,standardHeaders:'draft-8',legacyHeaders:false}));
router.get(['/media/:id','/media/:id/thumbnail'],(req,res,next)=>serveCommunityMedia(req,res,next,{moderation:true}));
router.get('/reports',(req,res)=>{
  const {limit,cursor}=pageSchema.parse(req.query);
  const status=z.enum(['open','resolved','dismissed','all']).default('open').parse(req.query.status);
  const current=decodeCursor(cursor);
  if(current&&!z.object({createdAt:z.string().datetime(),id:z.string().uuid(),status:z.literal(status)}).safeParse(current).success)fail(400,'Invalid report cursor.');
  const filters=[],values=[];
  if(status!=='all'){filters.push('r.status=?');values.push(status);}
  if(current){filters.push('(r.created_at<? OR (r.created_at=? AND r.id<?))');values.push(current.createdAt,current.createdAt,current.id);}
  const rows=db.prepare(`SELECT r.*,u.name reporter_name,u.status reporter_status,c.post_id comment_post_id
    FROM community_reports r LEFT JOIN users u ON u.id=r.reporter_id LEFT JOIN community_comments c ON c.id=r.comment_id
    ${filters.length?'WHERE '+filters.join(' AND '):''} ORDER BY r.created_at DESC,r.id DESC LIMIT ?`).all(...values,limit+1);
  const items=rows.slice(0,limit).map(row=>{
    const target=row.post_id?rawPost(row.post_id,req.user.id):rawComment(row.comment_id,req.user.id);
    return {id:row.id,reason:row.reason,status:row.status,resolution:row.resolution,createdAt:row.created_at,
      reporterName:row.reporter_status==='active'?row.reporter_name:'Former member',
      targetType:row.post_id?'post':'comment',targetId:row.post_id||row.comment_id,
      postId:row.post_id||row.comment_post_id,
      target:target?{title:target.title||null,body:target.body,status:target.status,isLocked:Boolean(target.is_locked)}:null};
  });
  const last=rows[Math.min(limit,rows.length)-1];
  res.json({items,nextCursor:rows.length>limit?encodeCursor({createdAt:last.created_at,id:last.id,status}):null});
});
router.get('/posts',(req,res)=>{
  const {limit,cursor}=pageSchema.parse(req.query);
  const status=z.enum(['hidden','removed']).default('hidden').parse(req.query.status);
  const current=decodeCursor(cursor);
  if(current&&!z.object({createdAt:z.string().datetime(),id:z.string().uuid(),status:z.literal(status)}).safeParse(current).success)fail(400,'Invalid content cursor.');
  const values=[req.user.id,status],where=["x.status=?"];
  if(current){where.push('(x.created_at<? OR (x.created_at=? AND x.id<?))');values.push(current.createdAt,current.createdAt,current.id);}
  const rows=db.prepare(postSelect+' WHERE '+where.join(' AND ')+' ORDER BY x.created_at DESC,x.id DESC LIMIT ?').all(...values,limit+1);
  const last=rows[Math.min(limit,rows.length)-1];
  res.json({items:postDtos(rows.slice(0,limit),req.user,{moderation:true}),nextCursor:rows.length>limit?encodeCursor({createdAt:last.created_at,id:last.id,status}):null});
});
router.get('/posts/:id',(req,res)=>{
  const row=rawPost(req.params.id,req.user.id);
  if(!row||row.status==='deleted')fail(404,'Post is unavailable.');
  res.json({post:postDtos([row],req.user,{moderation:true})[0]});
});
router.get('/comments',(req,res)=>{
  const {limit,cursor}=pageSchema.parse(req.query);
  const status=z.enum(['hidden','removed']).default('hidden').parse(req.query.status);
  const current=decodeCursor(cursor);
  if(current&&!z.object({createdAt:z.string().datetime(),id:z.string().uuid(),status:z.literal(status)}).safeParse(current).success)fail(400,'Invalid comment cursor.');
  const values=[req.user.id,status],where=['x.status=?'];
  if(current){where.push('(x.created_at<? OR (x.created_at=? AND x.id<?))');values.push(current.createdAt,current.createdAt,current.id);}
  const rows=db.prepare(commentSelect+' WHERE '+where.join(' AND ')+' ORDER BY x.created_at DESC,x.id DESC LIMIT ?').all(...values,limit+1);
  const last=rows[Math.min(limit,rows.length)-1];
  res.json({items:rows.slice(0,limit).map(row=>({id:row.id,postId:row.post_id,body:row.body,status:row.status,createdAt:row.created_at,editedAt:row.edited_at,author:author(row)})),
    nextCursor:rows.length>limit?encodeCursor({createdAt:last.created_at,id:last.id,status}):null});
});
router.post('/reports/:id/resolve',(req,res)=>{
  const input=z.object({reason:z.string().trim().min(3).max(500),status:z.enum(['resolved','dismissed'])}).strict().parse(req.body);
  db.transaction(()=>{
    const report=db.prepare('SELECT * FROM community_reports WHERE id=?').get(req.params.id);
    if(!report)fail(404,'Report is unavailable.');
    if(report.status!=='open')fail(409,'This report is already closed.');
    db.prepare('UPDATE community_reports SET status=?,resolution=?,moderator_id=?,resolved_at=? WHERE id=?').run(input.status,input.reason,req.user.id,now(),report.id);
    audit(req.user.id,'community.report_'+input.status,'community-report',report.id,{reason:input.reason,from:report.status,to:input.status});
  }).immediate();
  res.json({ok:true});
});
for(const [type,path] of [['post','posts'],['comment','comments']]){
  router.post('/'+path+'/:id/moderate',(req,res)=>{
    const input=z.object({action:z.enum(type==='post'?['hide','remove','restore','lock','unlock']:['hide','remove','restore']),reason:z.string().trim().min(3).max(500)}).strict().parse(req.body);
    db.transaction(()=>{
      const target=type==='post'?rawPost(req.params.id,req.user.id):rawComment(req.params.id,req.user.id);
      if(!target||target.status==='deleted')fail(404,'Content is unavailable.');
      const table=type==='post'?'community_posts':'community_comments';
      let to=target.status;
      if(['lock','unlock'].includes(input.action)){
        if(target.status!=='visible')fail(409,'Restore the post before changing its lock.');
        db.prepare('UPDATE community_posts SET is_locked=?,updated_at=? WHERE id=?').run(input.action==='lock'?1:0,now(),target.id);
      }else{
        to={hide:'hidden',remove:'removed',restore:'visible'}[input.action];
        if(type==='comment'&&to==='visible'){
          const post=rawPost(target.post_id,req.user.id);
          if(post?.status!=='visible')fail(409,'Restore the discussion first.');
        }
        db.prepare(`UPDATE ${table} SET status=?,updated_at=? WHERE id=?`).run(to,now(),target.id);
        if(type==='post'&&to!=='visible')db.prepare('UPDATE community_posts SET is_pinned=0,pinned_by=NULL,pinned_at=NULL WHERE id=?').run(target.id);
      }
      audit(req.user.id,'community.'+input.action,'community-'+type,target.id,{
        reason:input.reason,from:target.status,to,wasLocked:Boolean(target.is_locked),wasPinned:Boolean(target.is_pinned)});
    }).immediate();
    res.json({ok:true});
  });
}
router.put('/posts/:id/pin',(req,res)=>{
  const input=reasonSchema.parse(req.body);
  db.transaction(()=>{
    const post=rawPost(req.params.id,req.user.id);
    if(!post||post.status!=='visible')fail(404,'Post is unavailable.');
    if(post.is_pinned)return;
    if(db.prepare("SELECT count(*) count FROM community_posts WHERE status='visible' AND is_pinned=1").get().count>=3)fail(409,'Three announcements are already pinned. Unpin one first.');
    db.prepare('UPDATE community_posts SET is_pinned=1,pinned_by=?,pinned_at=?,updated_at=? WHERE id=?').run(req.user.id,now(),now(),post.id);
    audit(req.user.id,'community.pinned','community-post',post.id,{reason:input.reason});
  }).immediate();
  res.json({ok:true});
});
router.delete('/posts/:id/pin',(req,res)=>{
  const input=reasonSchema.parse(req.body);
  db.transaction(()=>{
    const post=rawPost(req.params.id,req.user.id);if(!post)fail(404,'Post is unavailable.');
    if(!post.is_pinned)return;
    db.prepare('UPDATE community_posts SET is_pinned=0,pinned_by=NULL,pinned_at=NULL,updated_at=? WHERE id=?').run(now(),post.id);
    audit(req.user.id,'community.unpinned','community-post',post.id,{reason:input.reason});
  }).immediate();
  res.json({ok:true});
});
export default router;
