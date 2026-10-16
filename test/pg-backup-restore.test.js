import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/aiclub_test';

const { query, queryOne, now, withTransaction } = await import('../server/pg.js');
const { backupDatabase, restoreDatabase, backupMedia, restoreMedia, ORDERED_TABLES } = await import('../server/scripts/backup-restore-pg.js');

test('PostgreSQL backup, restore, integrity checksum, and transactional rollback', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-backup-test-'));

  try {
    // 1. Seed known data in test db
    await query('TRUNCATE users, sessions, student_profiles, profile_skills, activity_logs CASCADE;');
    const time = now();
    await query(
      `INSERT INTO users (id, member_id, email, name, password_hash, role, status, permissions, must_change_password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['backup-user-1', '25AM999', 'backup@test.edu', 'Backup Test User', 'scrypt-hash', 'student', 'active', '[]', false, time, time]
    );
    await query(
      `INSERT INTO student_profiles (user_id, department, academic_year, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      ['backup-user-1', 'AI & DS', 3, time, time]
    );

    // 2. Perform backup
    const backupResult = await backupDatabase(tempDir);
    assert.ok(fs.existsSync(backupResult.filePath));
    assert.ok(backupResult.checksum.length === 64);
    assert.equal(backupResult.tableCounts.users, 1);
    assert.equal(backupResult.tableCounts.student_profiles, 1);

    // 3. Clear database
    await query('TRUNCATE users, sessions, student_profiles, profile_skills, activity_logs CASCADE;');
    const countEmpty = await queryOne('SELECT count(*)::int as count FROM users');
    assert.equal(countEmpty.count, 0);

    // 4. Verify production safeguard blocks destructive restore without ALLOW_PRODUCTION_RESTORE
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_PRODUCTION_RESTORE;
    await assert.rejects(
      async () => restoreDatabase(backupResult.filePath),
      /Destructive restore blocked: Refusing to restore database in production/i
    );
    process.env.NODE_ENV = 'test';

    // 5. Restore database
    const restoreResult = await restoreDatabase(backupResult.filePath);
    assert.equal(restoreResult.ok, true);

    // 6. Verify restored data
    const userRow = await queryOne('SELECT * FROM users WHERE id = $1', ['backup-user-1']);
    assert.ok(userRow);
    assert.equal(userRow.member_id, '25AM999');
    assert.equal(userRow.name, 'Backup Test User');
    const profileRow = await queryOne('SELECT * FROM student_profiles WHERE user_id = $1', ['backup-user-1']);
    assert.ok(profileRow);
    assert.equal(profileRow.department, 'AI & DS');

    // 7. Test rollback behavior on error during transactional restore
    let rollbackThrown = false;
    try {
      await withTransaction(async (tx) => {
        await tx.query('INSERT INTO users (id, member_id, email, name, password_hash, role, status, permissions, must_change_password, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          ['fail-user', 'FAIL-01', 'fail@test.com', 'Fail', 'hash', 'student', 'active', '[]', false, time, time]);
        // Trigger constraint violation
        await tx.query('INSERT INTO users (id, member_id, email, name, password_hash, role, status, permissions, must_change_password, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          ['fail-user', 'FAIL-01', 'fail@test.com', 'Fail', 'hash', 'student', 'active', '[]', false, time, time]);
      });
    } catch {
      rollbackThrown = true;
    }
    assert.equal(rollbackThrown, true, 'transaction should fail on duplicate key');
    const failUser = await queryOne('SELECT * FROM users WHERE id = $1', ['fail-user']);
    assert.equal(failUser, null, 'transactional rollback must ensure no partially written rows remain');

    // 8. Test separate media backup and restore strategy
    const fakeUploadDir = path.join(tempDir, 'fake-uploads');
    fs.mkdirSync(fakeUploadDir, { recursive: true });
    fs.writeFileSync(path.join(fakeUploadDir, 'avatar-test.webp'), 'fake-webp-image-data-binary', 'utf8');
    fs.writeFileSync(path.join(fakeUploadDir, 'post-attach.webp'), 'fake-attachment-image-binary', 'utf8');

    const mediaBackup = backupMedia(fakeUploadDir, path.join(tempDir, 'media-backups'));
    assert.equal(mediaBackup.count, 2);
    assert.ok(fs.existsSync(path.join(mediaBackup.mediaBackupDir, 'manifest.json')));

    // Clear uploads
    fs.rmSync(fakeUploadDir, { recursive: true, force: true });
    assert.ok(!fs.existsSync(fakeUploadDir));

    // Restore media
    const mediaRestore = restoreMedia(mediaBackup.mediaBackupDir, fakeUploadDir);
    assert.equal(mediaRestore.ok, true);
    assert.equal(mediaRestore.restoredCount, 2);
    assert.ok(fs.existsSync(path.join(fakeUploadDir, 'avatar-test.webp')));
    assert.ok(fs.existsSync(path.join(fakeUploadDir, 'post-attach.webp')));

  } finally {
    process.env.NODE_ENV = 'test';
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
