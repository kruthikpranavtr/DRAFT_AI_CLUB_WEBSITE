import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = fs.mkdtempSync(path.join(os.tmpdir(),'ai-club-members-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(root,'test.db');
process.env.MIGRATION_BACKUP_DIR = path.join(root,'backups');
process.env.UPLOAD_DIR = path.join(root,'uploads');
process.env.ALLOWED_ORIGINS = 'http://localhost:5174';

const { db,now } = await import('../server/db.js');
const { hashPassword } = await import('../server/passwords.js');
const { PERMISSIONS } = await import('../server/permissions.js');
const { createApp } = await import('../server/app.js');

const adminPassword = 'Admin-integration-password-42!';
const temporaryPassword = 'Student-temporary-password-42!';
const permanentPassword = 'Student-permanent-password-84!';

const time = now();
db.prepare(`INSERT INTO users
  (id,member_id,email,name,password_hash,role,status,permissions,must_change_password,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
  'admin-id','ADMIN-01','admin@example.edu','Integration Administrator',
  await hashPassword(adminPassword),'admin','active',JSON.stringify([PERMISSIONS.SUPER_ADMIN]),0,time,time
);

class Client {
  cookies = new Map();
  csrfToken = null;

  cookieHeader() { return [...this.cookies].map(([key,value]) => `${key}=${value}`).join('; '); }

  receiveCookies(response) {
    for (const value of response.headers.getSetCookie()) {
      const [pair] = value.split(';');
      const index = pair.indexOf('=');
      const key = pair.slice(0,index);
      const cookieValue = pair.slice(index + 1);
      if (cookieValue) this.cookies.set(key,cookieValue);
      else this.cookies.delete(key);
    }
  }

  async csrf(base) {
    const response = await fetch(`${base}/api/auth/csrf`,{ headers:{ cookie:this.cookieHeader() } });
    this.receiveCookies(response);
    this.csrfToken = (await response.json()).csrfToken;
  }

  async request(base,route,{ method='GET',body,form,csrf=true } = {}) {
    const headers = { cookie:this.cookieHeader(),origin:'http://localhost:5174' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (csrf && ['POST','PUT','PATCH','DELETE'].includes(method) && this.csrfToken) headers['x-csrf-token'] = this.csrfToken;
    const response = await fetch(base + route,{
      method,headers,
      ...(form ? { body:form } : body === undefined ? {} : { body:JSON.stringify(body) }),
    });
    this.receiveCookies(response);
    const contentType = response.headers.get('content-type') || '';
    const data = response.status === 204 ? null : contentType.includes('application/json') ? await response.json() : await response.arrayBuffer();
    return { response,data };
  }
}

test('student provisioning, first login, profiles, directory, and private media are protected',async () => {
  const server = createApp().listen(0,'127.0.0.1');
  await new Promise((resolve,reject) => {
    server.once('listening',resolve);
    server.once('error',reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const anonymous = new Client();
    let result = await anonymous.request(base,'/api/members');
    assert.equal(result.response.status,401);

    const admin = new Client();
    await admin.csrf(base);
    result = await admin.request(base,'/api/auth/login',{
      method:'POST',body:{ identifier:'admin@example.edu',password:adminPassword },
    });
    assert.equal(result.response.status,200);

    result = await admin.request(base,'/api/admin/users',{
      method:'POST',
      body:{
        memberId:'25AI101',email:null,name:'Demo Student',password:temporaryPassword,
        role:'student',status:'active',permissions:[],
        profile:{ department:'Artificial Intelligence',academicYear:2,skills:['Python','Machine Learning'] },
      },
    });
    assert.equal(result.response.status,201);
    assert.equal('password' in result.data,false);
    const studentId = result.data.id;

    const student = new Client();
    await student.csrf(base);
    result = await student.request(base,'/api/auth/login',{
      method:'POST',body:{ identifier:'25ai101',password:temporaryPassword },
    });
    assert.equal(result.response.status,200);
    assert.equal(result.data.user.must_change_password,true);
    result = await student.request(base,'/api/students/me/profile');
    assert.equal(result.response.status,403);
    assert.equal(result.data.code,'PASSWORD_CHANGE_REQUIRED');

    result = await student.request(base,'/api/auth/change-password',{
      method:'POST',body:{ currentPassword:temporaryPassword,newPassword:permanentPassword },
    });
    assert.equal(result.response.status,200);
    result = await student.request(base,'/api/students/me/profile');
    assert.equal(result.response.status,200);
    assert.equal(result.data.profile.name,'Demo Student');
    assert.deepEqual(result.data.profile.skills,['Python','Machine Learning']);

    result = await student.request(base,'/api/students/me/profile',{
      method:'PATCH',
      body:{
        name:'Attempted Name Change',department:'AI & Data Science',academicYear:3,
        githubUrl:'https://github.com/demo-student',linkedinUrl:'https://www.linkedin.com/in/demo-student',
        hackerrankUrl:'',description:'Clearly labeled integration-test profile.',skills:['Node.js','SQLite','node.js'],
      },
    });
    assert.equal(result.response.status,200);
    assert.equal(result.data.profile.name,'Demo Student','students cannot change their official name');
    assert.equal(result.data.profile.department,'AI & Data Science');
    assert.deepEqual(result.data.profile.skills,['Node.js','SQLite']);

    result = await student.request(base,'/api/students/me/profile',{
      method:'PATCH',body:{ githubUrl:'https://example.com/not-github' },
    });
    assert.equal(result.response.status,400,'profile links must use the approved provider host');

    result = await admin.request(base,`/api/admin/users/${studentId}`,{
      method:'PUT',body:{
        memberId:'25AI101',email:null,name:'Demo Student — Verified Name',
        role:'student',status:'active',permissions:[],
      },
    });
    assert.equal(result.response.status,200);
    result = await student.request(base,'/api/students/me/profile');
    assert.equal(result.data.profile.name,'Demo Student — Verified Name','administrators control the official name');
    assert.equal(result.data.profile.department,'AI & Data Science','identity edits must preserve student-managed profile fields');

    result = await student.request(base,'/api/members?search=SQLite');
    assert.equal(result.response.status,200);
    assert.equal(result.data.total,1);
    assert.equal(result.data.items[0].id,studentId);
    assert.equal('email' in result.data.items[0],false);

    const invalidPhoto = new FormData();
    invalidPhoto.set('photo',new Blob([Buffer.from('not-an-image')],{ type:'image/png' }),'invalid.png');
    result = await student.request(base,'/api/students/me/profile-photo',{ method:'POST',form:invalidPhoto });
    assert.equal(result.response.status,400);

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
    const photo = new FormData();
    photo.set('photo',new Blob([png],{ type:'image/png' }),'avatar.png');
    result = await student.request(base,'/api/students/me/profile-photo',{ method:'POST',form:photo });
    assert.equal(result.response.status,201);
    const avatarUrl = result.data.avatarUrl;

    result = await anonymous.request(base,avatarUrl);
    assert.equal(result.response.status,401,'private profile media must reject anonymous access');
    result = await student.request(base,avatarUrl);
    assert.equal(result.response.status,200);
    assert.equal(result.response.headers.get('cache-control'),'private, no-store');
    const fileId = avatarUrl.split('/').at(-1);
    result = await anonymous.request(base,`/api/public/files/${fileId}`);
    assert.equal(result.response.status,404,'private media must not be available through the public file route');

    result = await student.request(base,'/api/admin/users');
    assert.equal(result.response.status,403);
    assert.equal(db.prepare('SELECT name FROM users WHERE id=?').get(studentId).name,'Demo Student — Verified Name');
    assert.equal(db.prepare('SELECT is_public FROM files WHERE id=?').get(fileId).is_public,0);

    // Even a Super Admin must not use CMS routes to expose or mutate private avatars.
    result = await admin.request(base,'/api/admin/files');
    assert.equal(result.data.items.some(item => item.id === fileId),false);
    result = await admin.request(base,`/api/admin/files/${fileId}/download`);
    assert.equal(result.response.status,404);
    const replacement = new FormData();
    replacement.set('file',new Blob([png],{ type:'image/png' }),'replacement.png');
    result = await admin.request(base,`/api/admin/files/${fileId}`,{ method:'PUT',form:replacement });
    assert.equal(result.response.status,404);
    result = await admin.request(base,`/api/admin/files/${fileId}`,{ method:'DELETE' });
    assert.equal(result.response.status,404);
    const galleryInput = { title:'Test gallery',altText:'Test image description',fileId,status:'published' };
    result = await admin.request(base,'/api/admin/gallery',{ method:'POST',body:galleryInput });
    assert.equal(result.response.status,400);

    const cmsUpload = new FormData();
    cmsUpload.set('file',new Blob([png],{ type:'image/png' }),'cms.png');
    result = await admin.request(base,'/api/admin/files',{ method:'POST',form:cmsUpload });
    assert.equal(result.response.status,201);
    const cmsId = result.data.id;
    result = await admin.request(base,'/api/admin/gallery',{
      method:'POST',body:{ ...galleryInput,fileId:cmsId },
    });
    assert.equal(result.response.status,201,'eligible CMS images still publish');
    const galleryId = result.data.id;
    result = await anonymous.request(base,`/api/public/files/${cmsId}`);
    assert.equal(result.response.status,200);
    result = await anonymous.request(base,'/api/public/gallery');
    assert.equal(result.data.items.some(item => item.file_id === cmsId),true);
    result = await admin.request(base,`/api/admin/gallery/${galleryId}`,{ method:'PUT',body:galleryInput });
    assert.equal(result.response.status,400,'gallery replacement cannot promote a private avatar');
    assert.equal(db.prepare('SELECT file_id FROM gallery_items WHERE id=?').get(galleryId).file_id,cmsId);

    const document = new FormData();
    document.set('file',new Blob(['CMS document'],{ type:'text/plain' }),'notes.txt');
    result = await admin.request(base,'/api/admin/files',{ method:'POST',form:document });
    const documentId = result.data.id;
    result = await admin.request(base,'/api/admin/gallery',{ method:'POST',body:{ ...galleryInput,fileId:documentId } });
    assert.equal(result.response.status,400);
    result = await admin.request(base,`/api/admin/gallery/${galleryId}`,{ method:'PUT',body:{ ...galleryInput,fileId:documentId } });
    assert.equal(result.response.status,400);
    assert.throws(() => db.prepare('UPDATE files SET is_public=1 WHERE id=?').run(fileId),/private media cannot be public/i);
    assert.throws(() => db.prepare("UPDATE files SET purpose='cms' WHERE id=?").run(fileId),/purpose is immutable/i);
    assert.throws(() => db.prepare('UPDATE gallery_items SET file_id=? WHERE id=?').run(fileId,galleryId),/CMS image/);
    result = await student.request(base,avatarUrl);
    assert.equal(result.response.status,200,'CMS attack attempts preserve the original private photo');

    // A reset revokes both existing student sessions and requires a new password.
    const otherSession = new Client();
    await otherSession.csrf(base);
    result = await otherSession.request(base,'/api/auth/login',{
      method:'POST',body:{ identifier:'25AI101',password:permanentPassword },
    });
    assert.equal(result.response.status,200);
    result = await admin.request(base,`/api/admin/users/${studentId}/reset-password`,{
      method:'POST',body:{ temporaryPassword:'Reset-test-temporary-password-99!' },
    });
    assert.equal(result.response.status,200);
    assert.deepEqual(result.data,{ ok:true });
    for (const client of [student,otherSession]) {
      assert.equal((await client.request(base,'/api/auth/me')).response.status,401);
      assert.equal((await client.request(base,avatarUrl)).response.status,401);
    }
    result = await student.request(base,'/api/auth/login',{
      method:'POST',body:{ identifier:'25AI101',password:'Reset-test-temporary-password-99!' },
    });
    assert.equal(result.data.user.must_change_password,true);
    assert.equal((await student.request(base,'/api/members')).response.status,403);
    result = await student.request(base,'/api/auth/change-password',{
      method:'POST',body:{ currentPassword:'Reset-test-temporary-password-99!',newPassword:'New-permanent-test-password-101!' },
    });
    assert.equal(result.response.status,200);

    // Status changes preserve profiles, revoke sessions, and remove directory visibility.
    result = await admin.request(base,`/api/admin/users/${studentId}`,{
      method:'PUT',body:{ memberId:'25AI101',email:null,name:'Demo Student — Verified Name',role:'student',status:'suspended',permissions:[] },
    });
    assert.equal(result.response.status,200);
    assert.equal((await student.request(base,'/api/auth/me')).response.status,401);
    assert.equal((await admin.request(base,`/api/members/${studentId}`)).response.status,404);
    result = await admin.request(base,`/api/admin/users/${studentId}`,{
      method:'PUT',body:{ memberId:'25AI101',email:null,name:'Demo Student — Verified Name',role:'student',status:'active',permissions:[] },
    });
    assert.equal(result.response.status,200);
    assert.equal((await student.request(base,'/api/auth/me')).response.status,401,'reactivation must not revive old sessions');

    // Pagination works beyond 50 entries, with deterministic tie-breaking and search.
    const insert = db.prepare(`INSERT INTO users
      (id,member_id,name,password_hash,role,status,permissions,created_at,updated_at)
      VALUES (?,?,?,'unused','student','active','[]',?,?)`);
    db.transaction(() => {
      for (let index=0;index<55;index++) insert.run(`page-${index}`,`PAGE-${index}`,'Pagination Demo Member',time,time);
    })();
    const first = (await admin.request(base,'/api/members?search=Pagination&limit=24&offset=0')).data;
    const second = (await admin.request(base,'/api/members?search=Pagination&limit=24&offset=24')).data;
    const third = (await admin.request(base,'/api/members?search=Pagination&limit=24&offset=48')).data;
    assert.equal(first.total,55);
    assert.equal(third.items.length,7);
    assert.equal(new Set([...first.items,...second.items,...third.items].map(item => item.id)).size,55);
    assert.equal('memberId' in first.items[0],false,'other members roll numbers stay private');
    assert.equal((await admin.request(base,'/api/members?search=No-match')).data.total,0);
    assert.equal((await admin.request(base,'/api/members?offset=1.5')).response.status,400);
    assert.equal((await admin.request(base,'/api/members?limit=Infinity')).response.status,400);
    assert.equal(db.prepare("SELECT details FROM activity_logs WHERE action='user.password_reset'").get().details.includes('Reset-test-temporary'),false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
    fs.rmSync(root,{ recursive:true,force:true });
  }
});
