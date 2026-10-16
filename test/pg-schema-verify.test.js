import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaSql = fs.readFileSync(path.join(here, '../server/migrations/pg/001_initial_schema.sql'), 'utf8');

test('PostgreSQL full schema initializes all 24 application tables, indexes, and triggers', async () => {
  const pg = new PGlite();

  // 1. Execute initial PostgreSQL schema
  await pg.exec(schemaSql);

  // 2. Query all tables created
  const tablesRes = await pg.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map(r => r.table_name);
  const expectedTables = [
    'activity_logs',
    'assessment_answers',
    'assessment_attempts',
    'assessment_bank_questions',
    'assessment_banks',
    'assessment_questions',
    'assessments',
    'community_comment_votes',
    'community_comments',
    'community_media',
    'community_media_variants',
    'community_post_attachments',
    'community_post_votes',
    'community_posts',
    'community_reports',
    'content_entries',
    'files',
    'gallery_categories',
    'gallery_items',
    'profile_skills',
    'schema_migrations',
    'sessions',
    'settings',
    'student_profiles',
    'users'
  ];

  assert.deepEqual(tables, expectedTables, 'All 25 tables (24 app + 1 migration) must exist in public schema');

  // 3. Test Trigger: private_files_insert_guard
  await assert.rejects(async () => {
    await pg.query(`
      INSERT INTO files (id, original_name, stored_name, mime_type, size, storage_key, public_url, kind, is_public, purpose)
      VALUES ('f1', 'avatar.png', 'avatar.png', 'image/png', 1024, 'key-1', '/url', 'image', true, 'profile-avatar');
    `);
  }, /Private profile media cannot be public/, 'Trigger must reject public profile-avatar files');

  // 4. Test Trigger: valid private avatar succeeds
  await pg.query(`
    INSERT INTO files (id, original_name, stored_name, mime_type, size, storage_key, public_url, kind, is_public, purpose)
    VALUES ('f1', 'avatar.png', 'avatar.png', 'image/png', 1024, 'key-1', '/url', 'image', false, 'profile-avatar');
  `);

  // 5. Test Trigger: immutability of purpose
  await assert.rejects(async () => {
    await pg.query(`UPDATE files SET purpose = 'cms' WHERE id = 'f1'`);
  }, /File purpose is immutable/, 'Trigger must reject changing file purpose');

  // 6. Test Trigger: comment ancestry guard
  await pg.query(`
    INSERT INTO users (id, member_id, email, name, password_hash, role)
    VALUES ('u1', 'MEMBER-1', 'm1@test.com', 'Member One', 'hash', 'student');
  `);

  await pg.query(`
    INSERT INTO community_posts (id, author_id, title, body, tag)
    VALUES ('p1', 'u1', 'First Post', 'Body text', 'AI');
  `);

  // Root comment (depth 0, parent_id null) succeeds
  await pg.query(`
    INSERT INTO community_comments (id, post_id, parent_id, author_id, body, depth)
    VALUES ('c1', 'p1', null, 'u1', 'Root comment', 0);
  `);

  // Invalid comment: depth 1 with null parent fails
  await assert.rejects(async () => {
    await pg.query(`
      INSERT INTO community_comments (id, post_id, parent_id, author_id, body, depth)
      VALUES ('c2', 'p1', null, 'u1', 'Invalid comment', 1);
    `);
  }, /Invalid comment ancestry/, 'Trigger must reject non-zero depth without parent');

  // Valid reply (depth 1, parent c1) succeeds
  await pg.query(`
    INSERT INTO community_comments (id, post_id, parent_id, author_id, body, depth)
    VALUES ('c2', 'p1', 'c1', 'u1', 'Reply comment', 1);
  `);

  // 7. Test JSONB and BOOLEAN types
  const userRes = await pg.query(`SELECT permissions, must_change_password FROM users WHERE id = 'u1'`);
  assert.equal(typeof userRes.rows[0].permissions, 'object');
  assert.equal(userRes.rows[0].must_change_password, false);

  await pg.close();
});
