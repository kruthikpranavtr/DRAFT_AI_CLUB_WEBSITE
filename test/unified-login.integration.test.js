import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(),'ai-club-unified-login-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(root,'test.db');
process.env.MIGRATION_BACKUP_DIR = path.join(root,'backups');
process.env.UPLOAD_DIR = path.join(root,'uploads');
process.env.ALLOWED_ORIGINS = 'http://localhost:5174';
const { db,now } = await import('../server/db.js');
const { hashPassword } = await import('../server/passwords.js');
const { createApp } = await import('../server/app.js');
const password = 'Unified-integration-password-42!';
const passwordHash = await hashPassword(password);
const time = now();
for (const [id,memberId,email,role,status,forced] of [
  ['student','25am087','student@example.edu','student','active',0],
  ['admin','ADMIN-01','admin@example.edu','admin','active',0],
  ['temporary-student','25am088',null,'student','active',1],
  ['temporary-admin','ADMIN-TEMP','temporary-admin@example.edu','admin','active',1],
  ['suspended','25am099',null,'student','suspended',0],
  ['collision-student','collision@example.edu',null,'student','active',0],
  ['collision-admin','ADMIN-COLLISION','collision@example.edu','admin','active',0],
]) db.prepare(`INSERT INTO users(id,member_id,email,name,password_hash,role,status,permissions,must_change_password,created_at,updated_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(id,memberId,email,`Test ${id}`,passwordHash,role,status,JSON.stringify(role==='admin'?['users:manage-students']:[]),forced,time,time);

class Client {
  cookies = new Map();
  token = null;
  async request(base,route,body,options = {}) {
    const method = options.method || (body ? 'POST' : 'GET');
    const headers = {cookie:[...this.cookies].map(([key,value])=>`${key}=${value}`).join('; '),origin:options.origin || 'http://localhost:5174'};
    if (body) headers['content-type'] = 'application/json';
    if (this.token && options.csrf !== false) headers['x-csrf-token'] = this.token;
    const response = await fetch(base+route,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      if (pair.slice(index+1)) this.cookies.set(pair.slice(0,index),pair.slice(index+1));
      else this.cookies.delete(pair.slice(0,index));
    }
    const data = response.status===204?null:await response.json();
    return {response,data};
  }
  async csrf(base) { this.token = (await this.request(base,'/api/auth/csrf')).data.csrfToken; }
}

test('unified login derives roles securely and preserves sessions, forced changes, and shared rate limits',async () => {
  const server = createApp().listen(0,'127.0.0.1');
  await new Promise((resolve,reject) => { server.once('listening',resolve); server.once('error',reject); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = (client,identifier,extra={}) => client.request(base,'/api/auth/login',{identifier,password,...extra});
  try {
    const anonymous = new Client();
    assert.equal((await anonymous.request(base,'/api/admin/overview')).response.status,401);
    assert.equal((await login(anonymous,'25am087')).response.status,403,'CSRF remains mandatory');
    await anonymous.csrf(base);
    assert.equal((await anonymous.request(base,'/api/auth/login',{identifier:'25am087',password},{origin:'https://unapproved.example'})).response.status,403);

    const student = new Client(); await student.csrf(base);
    let result = await login(student,' 25AM087 ',{role:'admin',permissions:['platform:super-admin'],remember:false}); // 1
    assert.equal(result.response.status,200);
    assert.equal(result.data.user.role,'student');
    assert.deepEqual(result.data.user.permissions,[]);
    assert.equal(JSON.stringify(result.data).includes(password),false);
    assert.equal('password_hash' in result.data.user,false);
    const sessionCookie = result.response.headers.getSetCookie().find(cookie=>cookie.startsWith('aiclub_session='));
    assert.match(sessionCookie,/HttpOnly/i); assert.match(sessionCookie,/SameSite=Strict/i); assert.doesNotMatch(sessionCookie,/Max-Age|Expires=/i);
    assert.equal((await student.request(base,'/api/admin/overview')).response.status,403);
    const stale = new Client(); stale.cookies = new Map(student.cookies);
    assert.equal((await student.request(base,'/api/auth/logout',undefined,{method:'POST'})).response.status,204);
    assert.equal((await stale.request(base,'/api/auth/me')).response.status,401);

    const admin = new Client(); await admin.csrf(base);
    result = await login(admin,'admin-01',{role:'student'}); // 2
    assert.equal(result.response.status,200); assert.equal(result.data.user.role,'admin');
    assert.equal((await admin.request(base,'/api/admin/overview')).response.status,200);
    assert.match(result.response.headers.getSetCookie().find(cookie=>cookie.startsWith('aiclub_session=')),/Max-Age=604800/i);
    result = await login(admin,'ADMIN@EXAMPLE.EDU'); // 3
    assert.equal(result.response.status,200); assert.equal(result.data.user.member_id,'ADMIN-01');
    const invalidEmail = await login(anonymous,'student@example.edu'); // 4
    assert.equal(invalidEmail.response.status,401,'student email must remain ineligible');
    result = await login(anonymous,'ADMIN-01',{password:'Incorrect-password-42!'}); // 5
    assert.equal(result.response.status,401); assert.deepEqual(result.data,invalidEmail.data);
    assert.equal((await login(anonymous,'25am099')).response.status,403); // 6

    for (const [identifier,role,endpoint] of [['25am088','student','/api/students/me/profile'],['ADMIN-TEMP','admin','/api/admin/overview']]) {
      const temporary = new Client(); await temporary.csrf(base);
      result = await login(temporary,identifier); // 7, 8
      assert.equal(result.response.status,200); assert.equal(result.data.user.role,role); assert.equal(result.data.user.must_change_password,true);
      result = await temporary.request(base,endpoint);
      assert.equal(result.response.status,403); assert.equal(result.data.code,'PASSWORD_CHANGE_REQUIRED');
      const previousSession = new Client(); previousSession.cookies = new Map(temporary.cookies);
      result = await temporary.request(base,'/api/auth/change-password',{currentPassword:password,newPassword:'Unified-new-password-84!'});
      assert.equal(result.response.status,200);
      assert.equal((await previousSession.request(base,'/api/auth/me')).response.status,401);
      assert.equal((await temporary.request(base,'/api/auth/me')).data.user.must_change_password,false);
    }
    result = await login(anonymous,'collision@example.edu'); // 9
    assert.equal(result.response.status,401,'ambiguous cross-account identifiers must fail closed');
    assert.deepEqual(result.data,invalidEmail.data);
    result = await anonymous.request(base,'/api/auth/admin/login',{identifier:'25am087',password,role:'admin'}); // 10
    assert.equal(result.response.status,401,'legacy API must not grant administrator access to students');
    result = await login(anonymous,'25am087');
    assert.equal(result.response.status,429);
    result = await anonymous.request(base,'/api/auth/admin/login',{identifier:'ADMIN-01',password});
    assert.equal(result.response.status,429,'compatibility endpoint must share the same attempt budget');
  } finally {
    await new Promise(resolve=>server.close(resolve));
    db.close(); fs.rmSync(root,{recursive:true,force:true});
  }
});
