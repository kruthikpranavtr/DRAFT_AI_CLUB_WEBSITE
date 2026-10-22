import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
if (!process.env.TEST_DATABASE_URL?.includes('/aiclub_ephemeral')) throw new Error('Run npm test: a disposable database is required.');
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
process.env.NODE_ENV='test';
process.env.NEWS_CRON_SECRET=crypto.randomBytes(32).toString('hex');
const db=await import('../server/db.js');
const {createApp}=await import('../server/app.js');
const {hashPassword}=await import('../server/passwords.js');
const {createNewsService,sourceCatalog}=await import('../server/news/service.js');
const {normalizeArticle}=await import('../server/news/normalize.js');

test('news API authorization, CSRF, manual compatibility, moderation, source hiding and scheduler authentication',async()=>{
  const prefix=crypto.randomUUID();
  const password='Isolated-news-QA-42!';
  for (const [role,permissions] of [['student',[]],['admin',[]],['editor',['content:news']]]) {
    await db.query(`INSERT INTO users (id,member_id,email,name,password_hash,role,permissions) VALUES ($1,$2,$3,$4,$5,$6,$7)`,[prefix+role,prefix+role,role==='student'?null:prefix+role+'@example.test','News test '+role,await hashPassword(password),role==='student'?'student':'admin',JSON.stringify(permissions)]);
  }
  const server=createApp().listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  async function client(role) {
    const cookies=new Map();
    let csrf;
    async function request(path,{method='GET',body,noCsrf=false,headers={}}={}) {
      const response=await fetch(base+path,{method,headers:{cookie:[...cookies].map(([key,value])=>key+'='+value).join('; '),...(body?{'content-type':'application/json'}:{}),...(!noCsrf && csrf?{'x-csrf-token':csrf}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
      for (const cookie of response.headers.getSetCookie()) {const pair=cookie.split(';')[0];const index=pair.indexOf('=');cookies.set(pair.slice(0,index),pair.slice(index+1));}
      return {status:response.status,data:response.status===204?null:await response.json()};
    }
    csrf=(await request('/api/auth/csrf')).data.csrfToken;
    if (role) assert.equal((await request('/api/auth/login',{method:'POST',body:{identifier:prefix+role,password}})).status,200);
    return request;
  }
  try {
    const guest=await client();const student=await client('student');const admin=await client('admin');const editor=await client('editor');
    assert.equal((await guest('/api/admin/news')).status,401);assert.equal((await student('/api/admin/news')).status,403);assert.equal((await admin('/api/admin/news/sources')).status,403);
    assert.equal((await editor('/api/admin/news/sources/google-news',{method:'PUT',body:{enabled:true}})).status,400);
    assert.equal((await editor('/api/admin/news/sources/arxiv-research',{method:'PUT',body:{enabled:true},noCsrf:true})).status,403);
    const form={title:'Manual QA <img src=x onerror=alert(1)>',summary:'A club update',body:'Existing manual article text',category:'Announcements',status:'published',approval:'approved'};
    let response=await editor('/api/admin/news',{method:'POST',body:form});assert.equal(response.status,201,JSON.stringify(response.data));
    const manual=response.data.id;
    let publicData=(await guest('/api/public/news?search=Manual%20QA')).data;
    assert.ok(publicData.items.some(item=>item.id===manual));assert.equal(publicData.items.find(item=>item.id===manual).title.includes('<img'),false);
    assert.ok((await guest('/api/public/content?page=news')).data.items.some(item=>item.id===manual));
    response=await editor('/api/admin/news/'+manual,{method:'PUT',body:{...form,sourceUrl:'javascript:alert(1)'}});assert.equal(response.status,400);
    const event={...form,title:'QA hackathon',category:'Hackathons',status:'draft',approval:'pending',opportunity:{registrationDeadline:'2026-01-01T00:00:00Z',verificationStatus:'unverified'}};
    response=await editor('/api/admin/news',{method:'POST',body:event});assert.equal(response.status,201);const eventId=response.data.id;
    assert.equal((await editor('/api/admin/news/'+eventId,{method:'PUT',body:{...event,status:'published'}})).status,400);
    assert.equal((await editor('/api/admin/news/'+eventId,{method:'PUT',body:{...event,status:'published',approval:'approved'}})).status,200);
    publicData=(await guest('/api/public/news?category=Hackathons')).data;
    assert.ok(publicData.items.find(item=>item.id===eventId).news.expired);
    assert.equal((await editor('/api/admin/news/'+eventId,{method:'PUT',body:{...event,status:'published',approval:'approved',opportunity:{verificationStatus:'verified'}}})).status,400);
    assert.equal((await editor('/api/admin/news/policies',{method:'PUT',body:{category:'Hackathons',autoPublish:true}})).status,400);
    await editor('/api/admin/news/sources/arxiv-research',{method:'PUT',body:{enabled:true}});
    const source=sourceCatalog.find(item=>item.id==='arxiv-research');
    const article=normalizeArticle({title:'QA research',url:'https://arxiv.org/abs/2610.98765',externalId:prefix,publishedAt:'2026-10-20T00:00:00Z',categories:['cs.AI']},source);
    await createNewsService(db).storeArticle(article,source);
    const collected=await db.queryOne('SELECT content_id FROM news_details WHERE external_id=$1',[prefix]);
    response=await editor('/api/admin/content/'+collected.content_id,{method:'PUT',body:{type:'news',pageKey:'news',sectionKey:collected.content_id,title:'Bypass',status:'published'}});assert.equal(response.status,409);
    assert.ok((await guest('/api/public/news?search=QA%20research')).data.items.length);
    await editor('/api/admin/news/sources/arxiv-research',{method:'PUT',body:{enabled:false}});
    assert.equal((await guest('/api/public/news?search=QA%20research')).data.items.length,0);
    assert.equal((await guest('/api/public/content?page=news')).data.items.some(item=>item.id===collected.content_id),false);
    assert.equal((await guest('/api/internal/news/collect',{method:'POST'})).status,401);
    response=await guest('/api/internal/news/collect',{method:'POST',headers:{authorization:'Bearer '+process.env.NEWS_CRON_SECRET}});assert.equal(response.status,200);assert.equal(response.data.status,'skipped');
    assert.ok((await editor('/api/admin/news/runs')).data.items.length);
    assert.equal((await editor('/api/admin/news/'+manual,{method:'DELETE'})).status,204);
    assert.equal((await db.queryOne('SELECT count(*)::int AS count FROM news_details WHERE content_id=$1',[manual])).count,0);
  } finally { await new Promise(resolve=>server.close(resolve));await db.closePool(); }
});
