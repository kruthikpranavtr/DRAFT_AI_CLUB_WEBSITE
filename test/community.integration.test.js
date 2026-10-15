import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-club-community-'));
Object.assign(process.env,{NODE_ENV:'test',DATABASE_PATH:path.join(root,'qa.db'),DATA_DIR:root,
  UPLOAD_DIR:path.join(root,'.private-uploads'),MIGRATION_BACKUP_DIR:path.join(root,'backups'),ALLOWED_ORIGINS:'http://localhost:5182'});
const {db,now}=await import('../server/db.js');
const {createApp}=await import('../server/app.js');
const {hashPassword}=await import('../server/passwords.js');
const {communityEvents}=await import('../server/community-events.js');
const {cleanupStagedMedia,prepareCommunityImage}=await import('../server/community-media.js');
const password='Community-QA-42!secure';
const users=[
  ['member','student',[]],['other','student',[]],['moderator','admin',['community:moderate']],
  ['ordinary','admin',[]],['super','admin',['platform:super-admin']],['temporary','student',[]],
];
for(const [id,role,permissions] of users){
  db.prepare('INSERT INTO users (id,member_id,email,name,password_hash,role,status,permissions,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id,'QA-'+id,id+'@qa.invalid','QA '+id,await hashPassword(password),role,'active',JSON.stringify(permissions),id==='temporary'?1:0,now(),now());
}
class Client {
  cookies=new Map();token='';
  async request(url,{method='GET',body,file,headers={}}={}){
    const h={origin:'http://localhost:5182',cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...headers};
    if(this.token)h['x-csrf-token']=this.token;
    let data;
    if(file){data=new FormData();data.set('image',new Blob([file.buffer],{type:file.type||'image/png'}),file.name||'test.png');}
    else if(body!==undefined){h['content-type']='application/json';data=JSON.stringify(body);}
    const response=await fetch(this.base+url,{method,headers:h,body:data});
    for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0],i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1));}
    const result=response.headers.get('content-type')?.includes('json')?await response.json():Buffer.from(await response.arrayBuffer());
    return {status:response.status,data:result,headers:response.headers};
  }
  async login(base,id){this.base=base;this.token=(await this.request('/api/auth/csrf')).data.csrfToken;
    assert.equal((await this.request('/api/auth/login',{method:'POST',body:{identifier:'QA-'+id,password}})).status,200);}
}
test('Community, private images, moderation and announcements enforce persisted authorization',async t=>{
 const server=createApp().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 const clients=Object.fromEntries(users.map(([id])=>[id,new Client()]));
 const member=clients.member,other=clients.other,moderator=clients.moderator,ordinary=clients.ordinary;
 const anon=new Client();anon.base=base;
 let postId,commentId,replyId,mediaId;
 const post=(title='QA first post',extra={})=>({title,body:'Synthetic community body about ML.',tag:'Projects',linkUrl:'https://example.org/project',attachments:[],...extra});
 const create=async(client,title,extra={})=>{const result=await client.request('/api/community/posts',{method:'POST',body:post(title,extra)});assert.equal(result.status,201,JSON.stringify(result.data));return result.data.post;};
 try{
  for(const [id,client] of Object.entries(clients))await client.login(base,id);
  await t.test('guests, temporary credentials, CSRF and ordinary administrator boundaries',async()=>{
    assert.equal((await anon.request('/api/community/posts')).status,401);
    assert.equal((await clients.temporary.request('/api/community/posts')).status,403);
    assert.equal((await ordinary.request('/api/admin/community/reports')).status,403);
    assert.equal((await member.request('/api/admin/community/reports')).status,403);
    const token=member.token;member.token='';assert.equal((await member.request('/api/community/posts',{method:'POST',body:post()})).status,403);member.token=token;
    assert.equal((await member.request('/api/community/posts',{method:'POST',body:post('bad',{linkUrl:'javascript:alert(1)'})})).status,400);
    assert.equal((await member.request('/api/community/posts',{method:'POST',body:{...post(),authorId:'other'}})).status,400);
  });
  await t.test('images fully decode, strip metadata, stage privately and bind only to their owner',async()=>{
    const image=await sharp({create:{width:80,height:40,channels:3,background:'#5049e7'}}).jpeg().withMetadata({orientation:6,exif:{IFD0:{Artist:'PRIVATE LOCATION METADATA'}}}).toBuffer();
    let result=await member.request('/api/community/uploads',{method:'POST',file:{buffer:image,type:'image/jpeg',name:'unsafe-name.jpg'}});
    assert.equal(result.status,201,JSON.stringify(result.data));mediaId=result.data.image.id;
    result=await member.request('/api/community/media/'+mediaId);assert.equal(result.status,200);
    const metadata=await sharp(result.data).metadata();assert.equal(metadata.format,'webp');assert.equal(metadata.exif,undefined);assert.equal(metadata.orientation,undefined);
    assert.equal(result.headers.get('cache-control'),'private, no-store');
    assert.equal((await other.request('/api/community/media/'+mediaId)).status,404);
    assert.equal((await anon.request('/api/community/media/'+mediaId)).status,401);
    assert.equal((await other.request('/api/community/posts',{method:'POST',body:post('theft',{attachments:[{id:mediaId,description:'Theft'}]})})).status,400);
    assert.equal(db.prepare("SELECT count(*) n FROM community_posts WHERE title='theft'").get().n,0);
    const created=await create(member,'QA image project',{attachments:[{id:mediaId,description:'Synthetic purple test image'}]});postId=created.id;
    assert.equal((await other.request('/api/community/media/'+mediaId+'/thumbnail')).status,200);
    assert.equal((await member.request('/api/public/files/'+mediaId)).status,404);
    assert.equal((await member.request('/api/community/uploads/'+mediaId,{method:'DELETE'})).status,404);
    result=await member.request('/api/community/uploads',{method:'POST',file:{buffer:Buffer.from('not-an-image'),type:'image/png'}});
    assert.equal(result.status,400);
    result=await member.request('/api/community/uploads',{method:'POST',file:{buffer:Buffer.alloc(5*1024*1024+1),type:'image/png'}});
    assert.equal(result.status,400);
    const wide=await sharp({create:{width:8193,height:1,channels:3,background:'#111833'}}).png().toBuffer();
    await assert.rejects(()=>prepareCommunityImage({buffer:wide,mimetype:'image/png'}));
    const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
    await assert.rejects(()=>prepareCommunityImage({buffer:gif,mimetype:'image/png'}));
    const second=await create(member,'QA second post');
    assert.equal((await member.request('/api/community/posts/'+second.id,{method:'PATCH',body:post('duplicate binding',{attachments:[{id:mediaId,description:''}]})})).status,400);
  });
  await t.test('safe current attribution, ownership, search, sorting and bounded pagination',async()=>{
    const detailResponse=await member.request('/api/community/posts/'+postId);
    assert.equal(detailResponse.headers.get('cache-control'),'private, no-store');
    const detail=detailResponse.data.post;
    assert.deepEqual(Object.keys(detail.author).sort(),['avatarUrl','id','name']);
    assert.equal(detail.author.name,'QA member');
    assert.equal((await other.request('/api/community/posts/'+postId,{method:'PATCH',body:post()})).status,403);
    assert.equal((await other.request('/api/community/posts/'+postId,{method:'DELETE'})).status,403);
    db.prepare("UPDATE users SET name='QA current name' WHERE id='member'").run();
    assert.equal((await member.request('/api/community/posts/'+postId)).data.post.author.name,'QA current name');
    const first=await member.request('/api/community/posts?limit=1&sort=new');assert.equal(first.data.items.length,1);assert.ok(first.data.nextCursor);
    const next=await member.request('/api/community/posts?limit=1&sort=new&cursor='+encodeURIComponent(first.data.nextCursor));
    assert.notEqual(first.data.items[0].id,next.data.items[0].id);
    assert.equal((await member.request('/api/community/posts?limit=51')).status,400);
    assert.equal((await member.request('/api/community/posts?cursor=bad')).status,400);
    assert.equal((await member.request('/api/community/posts?sort=top&cursor='+first.data.nextCursor)).status,400);
    const found=await member.request('/api/community/posts?q=image&tag=Projects');assert.equal(found.data.items.length,1);
    assert.equal((await member.request('/api/community/posts?q=no-match')).data.items.length,0);
  });
  await t.test('nested replies validate ancestry/depth and emit only a Phase 3 event',async()=>{
    const events=[];const listener=e=>events.push(e);communityEvents.on('community.reply_created',listener);
    let result=await other.request('/api/community/posts/'+postId+'/comments',{method:'POST',body:{body:'QA root comment'}});
    assert.equal(result.status,201,JSON.stringify(result.data));commentId=result.data.comment.id;assert.equal(events.length,1);
    assert.equal(events[0].recipientId,'member');
    result=await member.request('/api/community/posts/'+postId+'/comments',{method:'POST',body:{body:'QA nested reply',parentId:commentId}});
    assert.equal(result.status,201);replyId=result.data.comment.id;
    result=await other.request('/api/community/posts/'+postId+'/comments',{method:'POST',body:{body:'QA third level',parentId:replyId}});
    assert.equal(result.status,201);const deepest=result.data.comment.id;
    assert.equal((await member.request('/api/community/posts/'+postId+'/comments',{method:'POST',body:{body:'too deep',parentId:deepest}})).status,400);
    const different=await create(other,'QA another discussion');
    assert.equal((await other.request('/api/community/posts/'+different.id+'/comments',{method:'POST',body:{body:'wrong parent',parentId:commentId}})).status,400);
    assert.throws(()=>db.prepare('UPDATE community_comments SET parent_id=? WHERE id=?').run(deepest,commentId));
    const children=await member.request('/api/community/posts/'+postId+'/comments?parentId='+commentId);
    assert.equal(children.data.items[0].author.name,'QA current name');
    assert.equal((await member.request('/api/community/comments/'+commentId,{method:'PATCH',body:{body:'theft'}})).status,403);
    assert.equal((await other.request('/api/community/comments/'+commentId,{method:'PATCH',body:{body:'QA edited root'}})).status,200);
    communityEvents.off('community.reply_created',listener);
  });
  await t.test('vote retries, switching and concurrent requests preserve one vote and exact aggregates',async()=>{
    for(const value of [1,1,-1,0,1]){
      const r=await member.request('/api/community/posts/'+postId+'/vote',{method:'PUT',body:{value}});
      assert.equal(r.status,200);assert.equal(r.data.score,value);
    }
    const retries=await Promise.all(Array.from({length:12},()=>member.request('/api/community/posts/'+postId+'/vote',{method:'PUT',body:{value:1}})));
    assert.ok(retries.every(r=>r.status===200));assert.equal(db.prepare('SELECT count(*) n FROM community_post_votes WHERE post_id=?').get(postId).n,1);
    await other.request('/api/community/posts/'+postId+'/vote',{method:'PUT',body:{value:1}});
    assert.equal((await member.request('/api/community/posts?sort=top')).data.items[0].score,2);
    assert.equal((await member.request('/api/community/posts?sort=popular')).data.items[0].id,postId);
    assert.equal((await member.request('/api/community/comments/'+commentId+'/vote',{method:'PUT',body:{value:-1}})).data.score,-1);
    assert.equal((await member.request('/api/community/posts/'+postId+'/vote',{method:'PUT',body:{value:7}})).status,400);
  });
  await t.test('announcements enforce capability, limits, ordering, filters and edit review',async()=>{
    assert.equal((await ordinary.request('/api/admin/community/posts/'+postId+'/pin',{method:'PUT',body:{reason:'Unauthorized'}})).status,403);
    assert.equal((await moderator.request('/api/admin/community/posts/'+postId+'/pin',{method:'PUT',body:{reason:'QA reviewed announcement'}})).status,200);
    const pins=[];
    for(let i=0;i<2;i++){const p=await create(moderator,'QA announcement '+i);pins.push(p.id);assert.equal((await moderator.request('/api/admin/community/posts/'+p.id+'/pin',{method:'PUT',body:{reason:'QA announcement'}})).status,200);}
    const fourth=await create(moderator,'QA fourth pin');
    assert.equal((await moderator.request('/api/admin/community/posts/'+fourth.id+'/pin',{method:'PUT',body:{reason:'QA over limit'}})).status,409);
    const feed=(await member.request('/api/community/posts')).data;assert.equal(feed.pinned.length,3);assert.ok(!feed.items.some(p=>p.id===postId));
    assert.equal((await member.request('/api/community/posts?q=no-match')).data.pinned.length,0);
    assert.equal((await member.request('/api/community/posts/'+postId,{method:'PATCH',body:post('QA image project',{attachments:[{id:mediaId,description:'Synthetic test image'}]})})).status,200);
    assert.equal(db.prepare('SELECT is_pinned FROM community_posts WHERE id=?').get(postId).is_pinned,0);
    assert.ok(db.prepare("SELECT count(*) n FROM activity_logs WHERE action='community.unpinned'").get().n>0);
    for(const id of pins)await moderator.request('/api/admin/community/posts/'+id+'/pin',{method:'DELETE',body:{reason:'QA cleanup pin'}});
  });
  await t.test('report queue, content/media moderation, locks and audited resolution',async()=>{
    const report=await other.request('/api/community/reports',{method:'POST',body:{targetType:'post',targetId:postId,reason:'QA code of conduct review'}});
    assert.equal(report.status,201);
    assert.equal((await other.request('/api/community/reports',{method:'POST',body:{targetType:'post',targetId:postId,reason:'Duplicate'}})).status,409);
    assert.equal((await moderator.request('/api/admin/community/reports')).data.items[0].id,report.data.id);
    const action=async(action)=>moderator.request('/api/admin/community/posts/'+postId+'/moderate',{method:'POST',body:{action,reason:'QA '+action}});
    assert.equal((await action('lock')).status,200);
    assert.equal((await member.request('/api/community/posts/'+postId+'/vote',{method:'PUT',body:{value:0}})).status,409);
    assert.equal((await member.request('/api/community/posts/'+postId+'/comments',{method:'POST',body:{body:'locked reply'}})).status,409);
    assert.equal((await action('unlock')).status,200);
    await moderator.request('/api/admin/community/posts/'+postId+'/pin',{method:'PUT',body:{reason:'QA pin before hide'}});
    assert.equal((await action('hide')).status,200);
    assert.equal((await member.request('/api/community/posts/'+postId)).status,404);
    assert.equal((await member.request('/api/community/media/'+mediaId)).status,404);
    assert.equal((await moderator.request('/api/admin/community/media/'+mediaId+'/thumbnail')).status,200);
    assert.equal((await ordinary.request('/api/admin/community/media/'+mediaId)).status,403);
    assert.equal((await member.request('/api/community/posts?q=image')).data.items.length,0);
    assert.equal((await moderator.request('/api/admin/community/posts?status=hidden')).data.items[0].id,postId);
    assert.equal((await action('restore')).status,200);
    assert.equal((await member.request('/api/community/media/'+mediaId)).status,200);
    assert.equal(db.prepare('SELECT is_pinned FROM community_posts WHERE id=?').get(postId).is_pinned,0);
    assert.equal((await moderator.request('/api/admin/community/reports/'+report.data.id+'/resolve',{method:'POST',body:{status:'resolved',reason:'QA reviewed and restored'}})).status,200);
    assert.equal((await moderator.request('/api/admin/users/member',{method:'DELETE'})).status,403,'moderators cannot suspend/delete accounts');
    assert.ok(db.prepare("SELECT count(*) n FROM activity_logs WHERE entity_id=? AND action='community.hide'").get(postId).n);
  });
  await t.test('comment moderation preserves descendants and excludes removed text',async()=>{
    for(const action of ['hide','restore','remove']){
      assert.equal((await moderator.request('/api/admin/community/comments/'+replyId+'/moderate',{method:'POST',body:{action,reason:'QA comment '+action}})).status,200);
      const children=(await member.request('/api/community/posts/'+postId+'/comments?parentId='+commentId)).data.items;
      assert.equal(children[0].body,action==='restore'?'QA nested reply':'');
      assert.equal(children[0].replyCount,1);
    }
    assert.equal((await moderator.request('/api/admin/community/comments?status=removed')).data.items[0].id,replyId);
    await moderator.request('/api/admin/community/comments/'+replyId+'/moderate',{method:'POST',body:{action:'restore',reason:'QA finish restoration'}});
  });
  await t.test('report floods are throttled per user',async()=>{
    const responses=[];
    for(let i=0;i<9;i++)responses.push(await clients.super.request('/api/community/reports',{method:'POST',body:{targetType:'post',targetId:postId,reason:'QA repeated report'}}));
    assert.equal(responses[0].status,201);
    assert.equal(responses.at(-1).status,429);
    assert.equal(responses.at(-1).data.code,'RATE_LIMITED');
  });
  await t.test('large lists remain bounded, deterministic and indexed with 6000 posts',async()=>{
    const ids=[],time=now();
    db.transaction(()=>{const insert=db.prepare('INSERT INTO community_posts (id,author_id,title,body,tag,created_at,updated_at) VALUES (?,?,?,?,?,?,?)');
      for(let i=0;i<6000;i++){const id=crypto.randomUUID();ids.push(id);insert.run(id,'other','QA large list '+i,'Synthetic performance fixture','AI',time,time);}
    })();
    try{
      for(const sort of ['new','top','popular']){
        const started=performance.now();
        const first=await member.request('/api/community/posts?limit=20&sort='+sort+'&q=large%20list');
        const elapsed=performance.now()-started;
        assert.equal(first.status,200);assert.equal(first.data.items.length,20);assert.ok(first.data.nextCursor);
        const second=await member.request('/api/community/posts?limit=20&sort='+sort+'&q=large%20list&cursor='+encodeURIComponent(first.data.nextCursor));
        assert.equal(second.data.items.length,20);assert.ok(!second.data.items.some(p=>first.data.items.some(a=>a.id===p.id)));
        assert.ok(elapsed<3000,sort+' must remain below the generous local 3s ceiling: '+elapsed);
        t.diagnostic('6000 posts, '+sort+' first page: '+elapsed.toFixed(1)+' ms; 20 rows returned');
      }
      const plan=db.prepare("EXPLAIN QUERY PLAN SELECT * FROM community_posts WHERE status='visible' AND is_pinned=0 ORDER BY created_at DESC,id DESC LIMIT 20").all();
      assert.ok(plan.some(row=>row.detail.includes('INDEX')));
    }finally{db.transaction(()=>{for(const id of ids)db.prepare('DELETE FROM community_posts WHERE id=?').run(id);})();}
  });
  await t.test('deletion tombstones, revocation, current disabled byline and staged cleanup',async()=>{
    assert.equal((await other.request('/api/community/comments/'+commentId,{method:'DELETE'})).status,204);
    const rootComments=(await member.request('/api/community/posts/'+postId+'/comments')).data.items;
    assert.equal(rootComments[0].body,'');assert.equal(rootComments[0].replyCount,1);
    assert.equal(rootComments[0].author.id,null);
    const buffer=await sharp({create:{width:10,height:10,channels:3,background:'white'}}).png().toBuffer();
    const staged=(await member.request('/api/community/uploads',{method:'POST',file:{buffer}})).data.image;
    const stored=db.prepare('SELECT storage_key FROM community_media_variants WHERE media_id=?').all(staged.id);
    db.prepare("UPDATE community_media SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(staged.id);
    await cleanupStagedMedia();assert.equal(db.prepare('SELECT 1 FROM community_media WHERE id=?').get(staged.id),undefined);
    assert.ok(stored.every(s=>!fs.existsSync(path.join(process.env.UPLOAD_DIR,s.storage_key))));
    db.prepare("UPDATE users SET status='suspended' WHERE id='member'").run();
    assert.equal((await member.request('/api/community/posts')).status,401);
    const byline=(await other.request('/api/community/posts/'+postId)).data.post.author;
    assert.deepEqual(byline,{id:null,name:'Former member',avatarUrl:null});
    db.prepare("UPDATE users SET status='active' WHERE id='member'").run();
    assert.equal((await member.request('/api/community/posts/'+postId,{method:'DELETE'})).status,204);
    assert.equal((await other.request('/api/community/media/'+mediaId)).status,404);
    assert.equal((await moderator.request('/api/admin/community/posts/'+postId+'/moderate',{method:'POST',body:{action:'restore',reason:'cannot restore author deletion'}})).status,404);
    assert.equal(db.prepare('SELECT body FROM community_posts WHERE id=?').get(postId).body,'');
    assert.equal(db.pragma('integrity_check')[0].integrity_check,'ok');
    assert.deepEqual(db.pragma('foreign_key_check'),[]);
  });
 }finally{await new Promise(r=>server.close(r));db.close();fs.rmSync(root,{recursive:true,force:true});}
});
