import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-club-seed-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/aiclub_test';
process.env.MIGRATION_BACKUP_DIR = path.join(root, 'backups');
delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
delete process.env.BOOTSTRAP_STUDENT_PASSWORD;

const { query, queryOne } = await import('../server/pg.js');
const { seedDatabase } = await import('../server/seed.js');

test('bootstrap users require explicit passwords and the first admin is Super Admin', async () => {
  try {
    await query('TRUNCATE users, sessions, student_profiles, profile_skills, activity_logs CASCADE;');
    await assert.rejects(seedDatabase(), /bootstrap password is required/i);
    const countRes = await queryOne('SELECT count(*)::int as count FROM users');
    assert.equal(countRes.count, 0);

    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'Explicit-bootstrap-password-42!';
    await seedDatabase();
    const admin = await queryOne(`SELECT member_id, role, permissions FROM users WHERE member_id ILIKE 'ADMIN-01'`);
    assert.equal(admin.role, 'admin');
    const perms = typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : admin.permissions;
    assert.ok(perms.includes('platform:super-admin'));
    const studentCount = await queryOne(`SELECT count(*)::int as count FROM users WHERE role='student'`);
    assert.equal(studentCount.count, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
