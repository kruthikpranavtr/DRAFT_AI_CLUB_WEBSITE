import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = fs.mkdtempSync(path.join(os.tmpdir(),'ai-club-seed-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(root,'test.db');
process.env.MIGRATION_BACKUP_DIR = path.join(root,'backups');
delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
delete process.env.BOOTSTRAP_STUDENT_PASSWORD;

const { db } = await import('../server/db.js');
const { seedDatabase } = await import('../server/seed.js');

test('bootstrap users require explicit passwords and the first admin is Super Admin',async () => {
  try {
    await assert.rejects(seedDatabase(),/bootstrap password is required/i);
    assert.equal(db.prepare('SELECT count(*) count FROM users').get().count,0);

    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'Explicit-bootstrap-password-42!';
    await seedDatabase();
    const admin = db.prepare(`SELECT member_id,role,permissions FROM users
      WHERE member_id='ADMIN-01' COLLATE NOCASE`).get();
    assert.equal(admin.role,'admin');
    assert.ok(JSON.parse(admin.permissions).includes('platform:super-admin'));
    assert.equal(db.prepare(`SELECT count(*) count FROM users WHERE role='student'`).get().count,0);
  } finally {
    db.close();
    fs.rmSync(root,{ recursive:true,force:true });
  }
});
