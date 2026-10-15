import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ai-club-demo-safety-'));
process.env.NODE_ENV='test';
process.env.DATABASE_PATH=path.join(temp,'qa.db');
process.env.MIGRATION_BACKUP_DIR=path.join(temp,'backups');
process.env.ALLOWED_ORIGINS='http://localhost:5174';
const {db,now}=await import('../server/db.js');
const {hashPassword}=await import('../server/passwords.js');
const {createSession,sessionUser}=await import('../server/auth.js');
const {createApp}=await import('../server/app.js');

test('fixed public demo identities are refused in production even with correct passwords or existing sessions',async()=>{
  const password='DemoAdmin@2026!';
  const hash=await hashPassword(password);
  const time=now();
  for(const [id,memberId,role,email] of [
    ['demo','DEMO-ADMIN','admin','demo.admin@aiclub.test'],
    ['ordinary','ADMIN-PROD','admin','admin@production.test'],
  ]) {
    db.prepare([
      'INSERT INTO users (id,member_id,email,name,password_hash,role,status,permissions,',
      'must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ].join(' ')).run(id,memberId,email,memberId,hash,role,'active','[]',0,time,time);
  }
  const demoCookies={},ordinaryCookies={};
  createSession({cookie:(name,token)=>{demoCookies[name]=token;}},'demo',false);
  createSession({cookie:(name,token)=>{ordinaryCookies[name]=token;}},'ordinary',false);
  assert.equal(sessionUser({cookies:demoCookies}).member_id,'DEMO-ADMIN');
  process.env.NODE_ENV='production';
  assert.equal(sessionUser({cookies:demoCookies}),null);
  assert.equal(sessionUser({cookies:ordinaryCookies}).member_id,'ADMIN-PROD');

  const server=createApp().listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    const session={};
    const csrf=await fetch(base+'/api/auth/csrf');
    for(const value of csrf.headers.getSetCookie()){
      const [pair]=value.split(';');
      const index=pair.indexOf('=');
      session[pair.slice(0,index)]=pair.slice(index+1);
    }
    const token=(await csrf.json()).csrfToken;
    async function login(identifier) {
      return fetch(base+'/api/auth/login',{method:'POST',headers:{
        cookie:Object.entries(session).map(([key,value])=>key+'='+value).join('; '),
        origin:'http://localhost:5174',
        'x-csrf-token':token,
        'content-type':'application/json',
      },body:JSON.stringify({identifier,password})});
    }
    assert.equal((await login('DEMO-ADMIN')).status,401);
    assert.equal((await login('demo.admin@aiclub.test')).status,401);
    assert.equal((await login('ADMIN-PROD')).status,200);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    process.env.NODE_ENV='test';
    db.close();
    fs.rmSync(temp,{recursive:true,force:true});
  }
});
