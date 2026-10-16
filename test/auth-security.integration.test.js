import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-club-auth-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/aiclub_test';
process.env.MIGRATION_BACKUP_DIR = path.join(root, 'backups');
process.env.ALLOWED_ORIGINS = 'http://127.0.0.1:5174,http://localhost:5174';

const { query, queryOne, now } = await import('../server/pg.js');
const { hashPassword } = await import('../server/passwords.js');
const { PERMISSIONS } = await import('../server/permissions.js');
const { createApp } = await import('../server/app.js');

await query('TRUNCATE users, sessions, student_profiles, profile_skills, activity_logs CASCADE;');

const passwords = {
  student: 'Student-temporary-42!',
  regular: 'Regular-admin-password-42!',
  super: 'Super-admin-password-42!',
  reset: 'Reset-student-password-84!',
};

async function insertUser({ id, memberId, email, name, role, permissions, password, mustChange = false }) {
  const time = now();
  await query(
    `INSERT INTO users
     (id, member_id, email, name, password_hash, role, status, permissions, must_change_password, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, memberId, email, name, await hashPassword(password), role, 'active', JSON.stringify(permissions), Boolean(mustChange), time, time]
  );
}

await insertUser({ id: 'student-1', memberId: '25AM087', email: 'student@example.edu', name: 'Student', role: 'student', permissions: [], password: passwords.student });
await insertUser({ id: 'admin-regular', memberId: 'ADMIN-02', email: 'regular@example.edu', name: 'Regular Admin', role: 'admin', permissions: [PERMISSIONS.MANAGE_STUDENTS], password: passwords.regular });
await insertUser({ id: 'admin-super', memberId: 'ADMIN-01', email: 'admin@srishakthi.ac.in', name: 'Super Admin', role: 'admin', permissions: [PERMISSIONS.SUPER_ADMIN], password: passwords.super });

class Client {
  cookies = new Map();
  csrfToken = null;

  cookieHeader() {
    return [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  }

  receiveCookies(response) {
    for (const value of response.headers.getSetCookie()) {
      const [pair] = value.split(';');
      const index = pair.indexOf('=');
      const key = pair.slice(0, index);
      const cookieValue = pair.slice(index + 1);
      if (cookieValue) this.cookies.set(key, cookieValue);
      else this.cookies.delete(key);
    }
  }

  async csrf(base) {
    const response = await fetch(`${base}/api/auth/csrf`, { headers: { cookie: this.cookieHeader() } });
    this.receiveCookies(response);
    const body = await response.json();
    this.csrfToken = body.csrfToken;
    return body.csrfToken;
  }

  async request(base, route, { method = 'GET', body, origin = 'http://localhost:5174', csrf = true } = {}) {
    const headers = { cookie: this.cookieHeader() };
    if (origin) headers.origin = origin;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (csrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }
    const response = await fetch(base + route, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    this.receiveCookies(response);
    const data = response.status === 204 ? null : await response.json();
    return { response, data };
  }
}

test('authentication, CSRF, role boundaries, and reset revocation are enforced', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const missingCsrf = new Client();
    let result = await missingCsrf.request(base, '/api/auth/login', {
      method: 'POST',
      csrf: false,
      body: { identifier: '25AM087', password: passwords.student },
    });
    assert.equal(result.response.status, 403);
    assert.equal(result.data.code, 'CSRF_INVALID');

    const student = new Client();
    await student.csrf(base);
    result = await student.request(base, '/api/auth/login', {
      method: 'POST',
      body: { identifier: 'student@example.edu', password: passwords.student },
    });
    assert.equal(result.response.status, 401, 'student email must not be accepted for sign-in');
    result = await student.request(base, '/api/auth/login', {
      method: 'POST',
      body: { identifier: '25am087', password: passwords.student },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.user.role, 'student');
    assert.equal('password' in result.data, false);
    result = await student.request(base, '/api/admin/users');
    assert.equal(result.response.status, 403);

    const regular = new Client();
    await regular.csrf(base);
    result = await regular.request(base, '/api/auth/admin/login', {
      method: 'POST',
      body: { identifier: 'regular@example.edu', password: passwords.regular },
    });
    assert.equal(result.response.status, 200);
    result = await regular.request(base, '/api/admin/users');
    assert.equal(result.response.status, 200);
    assert.ok(result.data.items.every(user => user.role === 'student'));
    result = await regular.request(base, '/api/admin/content');
    assert.equal(result.response.status, 403);
    assert.equal(result.data.code, 'PERMISSION_DENIED');
    result = await regular.request(base, '/api/admin/users/admin-super', {
      method: 'PUT',
      body: { memberId: 'ADMIN-01', email: 'admin@srishakthi.ac.in', name: 'Super Admin', role: 'admin', status: 'active', permissions: [] },
    });
    assert.equal(result.response.status, 403);
    assert.equal(result.data.code, 'SUPER_ADMIN_REQUIRED');
    result = await regular.request(base, '/api/admin/users', {
      method: 'POST',
      body: { memberId: 'ADMIN-03', email: 'blocked@example.edu', name: 'Blocked Admin', password: 'Blocked-admin-password-42!', role: 'admin', status: 'active', permissions: [] },
    });
    assert.equal(result.response.status, 403);
    assert.equal(result.data.code, 'SUPER_ADMIN_REQUIRED');

    result = await regular.request(base, '/api/admin/users', {
      method: 'POST',
      body: { memberId: '25AM088', email: null, name: 'Student Without Email', password: 'Student-two-password-42!', role: 'student', status: 'active', permissions: [] },
    });
    assert.equal(result.response.status, 201);
    assert.equal(Object.keys(result.data).includes('password'), false);

    const superAdmin = new Client();
    await superAdmin.csrf(base);
    result = await superAdmin.request(base, '/api/auth/login', {
      method: 'POST',
      body: { identifier: 'ADMIN-01', password: passwords.super },
    });
    assert.equal(result.response.status, 200);

    result = await superAdmin.request(base, '/api/admin/users', {
      method: 'POST',
      body: { memberId: 'ADMIN-03', email: null, name: 'Missing Email Admin', password: 'Admin-three-password-42!', role: 'admin', status: 'active', permissions: [] },
    });
    assert.equal(result.response.status, 400);
    result = await superAdmin.request(base, '/api/admin/users', {
      method: 'POST',
      body: { memberId: 'ADMIN-03', email: 'admin3@example.edu', name: 'Content Admin', password: 'Admin-three-password-42!', role: 'admin', status: 'active', permissions: [PERMISSIONS.CONTENT_NEWS] },
    });
    assert.equal(result.response.status, 201);
    const createdAdminId = result.data.id;
    result = await superAdmin.request(base, '/api/admin/users/admin-super', {
      method: 'PUT',
      body: { memberId: 'ADMIN-01', email: 'admin@srishakthi.ac.in', name: 'Super Admin', role: 'admin', status: 'active', permissions: [] },
    });
    assert.equal(result.response.status, 409, 'the final active Super Admin cannot remove its own authority');

    const temporaryAdmin = new Client();
    await temporaryAdmin.csrf(base);
    result = await temporaryAdmin.request(base, '/api/auth/login', {
      method: 'POST',
      body: { identifier: 'ADMIN-03', password: 'Admin-three-password-42!' },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.user.must_change_password, true);
    result = await temporaryAdmin.request(base, '/api/admin/overview');
    assert.equal(result.response.status, 403);
    assert.equal(result.data.code, 'PASSWORD_CHANGE_REQUIRED');
    result = await temporaryAdmin.request(base, '/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: 'Admin-three-password-42!', newPassword: 'Admin-three-new-password-84!' },
    });
    assert.equal(result.response.status, 200);
    result = await temporaryAdmin.request(base, '/api/admin/overview');
    assert.equal(result.response.status, 200);
    const changedAdmin = await queryOne('SELECT must_change_password FROM users WHERE id=$1', [createdAdminId]);
    assert.equal(Boolean(changedAdmin.must_change_password), false);

    result = await temporaryAdmin.request(base, '/api/admin/users/student-1/reset-password', {
      method: 'POST',
      body: { temporaryPassword: 'Denied-content-admin-reset-42!' },
    });
    assert.equal(result.response.status, 403);
    assert.equal(result.data.code, 'PERMISSION_DENIED');

    result = await temporaryAdmin.request(base, '/api/auth/logout', { method: 'POST' });
    assert.equal(result.response.status, 204);
    assert.equal(result.data, null);
    result = await temporaryAdmin.request(base, '/api/auth/me');
    assert.equal(result.response.status, 401, 'logout must revoke the active session');

    result = await superAdmin.request(base, '/api/admin/users/student-1/reset-password', {
      method: 'POST',
      body: { temporaryPassword: passwords.reset },
    });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.data, { ok: true });
    const sCount = await queryOne(`SELECT count(*)::int as count FROM sessions WHERE user_id='student-1'`);
    assert.equal(sCount.count, 0);

    result = await student.request(base, '/api/auth/me');
    assert.equal(result.response.status, 401, 'reset must revoke existing sessions');

    const resetStudent = new Client();
    await resetStudent.csrf(base);
    result = await resetStudent.request(base, '/api/auth/login', {
      method: 'POST',
      body: { identifier: '25AM087', password: passwords.reset },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.user.must_change_password, true);

    result = await superAdmin.request(base, '/api/admin/users/student-1/reset-password', {
      method: 'POST',
      origin: 'https://evil.example',
      body: { temporaryPassword: 'Another-reset-password-42!' },
    });
    assert.equal(result.response.status, 403);
    assert.equal(result.data.code, 'ORIGIN_DENIED');

    result = await superAdmin.request(base, '/api/admin/users/student-1/reset-password', {
      method: 'POST',
      origin: 'http://localhost:5173',
      body: { temporaryPassword: 'Legacy-origin-password-42!' },
    });
    assert.equal(result.response.status, 403);
    assert.equal(result.data.code, 'ORIGIN_DENIED');

    const auditDetails = await queryOne(`SELECT details FROM activity_logs WHERE action='user.password_reset'`);
    assert.ok(auditDetails);
    const detailsStr = typeof auditDetails.details === 'string' ? auditDetails.details : JSON.stringify(auditDetails.details);
    assert.equal(detailsStr.includes(passwords.reset), false);
    const adminCount = await queryOne(`SELECT count(*)::int as count FROM users WHERE role='admin'`);
    assert.equal(adminCount.count, 3);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
