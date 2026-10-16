import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-club-demo-safety-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/aiclub_test';
process.env.MIGRATION_BACKUP_DIR = path.join(temp, 'backups');
process.env.ALLOWED_ORIGINS = 'http://localhost:5174';

const { query, now } = await import('../server/pg.js');
const { hashPassword } = await import('../server/passwords.js');
const { createSession, sessionUser } = await import('../server/auth.js');
const { createApp } = await import('../server/app.js');

test('fixed public demo identities are refused in production even with correct passwords or existing sessions', async () => {
  await query('TRUNCATE users, sessions, student_profiles, profile_skills, activity_logs CASCADE;');
  const password = 'DemoAdmin@2026!';
  const hash = await hashPassword(password);
  const time = now();
  for (const [id, memberId, role, email] of [
    ['demo', 'DEMO-ADMIN', 'admin', 'demo.admin@aiclub.test'],
    ['ordinary', 'ADMIN-PROD', 'admin', 'admin@production.test'],
  ]) {
    await query(
      `INSERT INTO users (id, member_id, email, name, password_hash, role, status, permissions,
       must_change_password, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, memberId, email, memberId, hash, role, 'active', '[]', false, time, time]
    );
  }
  const demoCookies = {}, ordinaryCookies = {};
  await createSession({ cookie: (name, token) => { demoCookies[name] = token; } }, 'demo', false);
  await createSession({ cookie: (name, token) => { ordinaryCookies[name] = token; } }, 'ordinary', false);
  const demoUser = await sessionUser({ cookies: demoCookies });
  assert.equal(demoUser?.member_id, 'DEMO-ADMIN');
  process.env.NODE_ENV = 'production';
  assert.equal(await sessionUser({ cookies: demoCookies }), null);
  const ordinaryUser = await sessionUser({ cookies: ordinaryCookies });
  assert.equal(ordinaryUser?.member_id, 'ADMIN-PROD');

  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const session = {};
    const csrf = await fetch(base + '/api/auth/csrf');
    for (const value of csrf.headers.getSetCookie()) {
      const [pair] = value.split(';');
      const index = pair.indexOf('=');
      session[pair.slice(0, index)] = pair.slice(index + 1);
    }
    const token = (await csrf.json()).csrfToken;
    async function login(identifier) {
      return fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: {
          cookie: Object.entries(session).map(([key, value]) => key + '=' + value).join('; '),
          origin: 'http://localhost:5174',
          'x-csrf-token': token,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
      });
    }
    assert.equal((await login('DEMO-ADMIN')).status, 401);
    assert.equal((await login('demo.admin@aiclub.test')).status, 401);
    assert.equal((await login('ADMIN-PROD')).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
    process.env.NODE_ENV = 'test';
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
