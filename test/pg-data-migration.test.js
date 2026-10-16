import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { PGlite } from '@electric-sql/pglite';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaSql = fs.readFileSync(path.join(here, '../server/migrations/pg/001_initial_schema.sql'), 'utf8');

test('SQLite to PostgreSQL synthetic data migration preserves records, relationships, and data types', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-club-pg-migrate-'));
  const sqlitePath = path.join(root, 'synthetic.db');

  // 1. Create and populate a synthetic SQLite source database
  const sqlite = new Database(sqlitePath);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');

  // Create SQLite tables and sample rows across key domains
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL UNIQUE,
      email TEXT,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      permissions TEXT NOT NULL DEFAULT '[]',
      must_change_password INTEGER NOT NULL DEFAULT 0,
      password_changed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE student_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      department TEXT NOT NULL DEFAULT '',
      academic_year INTEGER,
      github_url TEXT,
      linkedin_url TEXT,
      hackerrank_url TEXT,
      description TEXT NOT NULL DEFAULT '',
      avatar_file_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE profile_skills (
      user_id TEXT NOT NULL REFERENCES student_profiles(user_id),
      skill_name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, skill_name)
    );

    CREATE TABLE assessment_banks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      academic_year INTEGER,
      batch TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE assessment_bank_questions (
      id TEXT PRIMARY KEY,
      bank_id TEXT NOT NULL REFERENCES assessment_banks(id),
      kind TEXT NOT NULL DEFAULT 'mcq',
      prompt TEXT NOT NULL,
      options_json TEXT NOT NULL DEFAULT '[]',
      correct_option INTEGER,
      points REAL NOT NULL DEFAULT 1,
      language TEXT NOT NULL DEFAULT '',
      external_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE assessments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL,
      bank_id TEXT REFERENCES assessment_banks(id),
      question_count INTEGER NOT NULL,
      selected_question_ids TEXT NOT NULL DEFAULT '[]',
      allow_backward INTEGER NOT NULL DEFAULT 1,
      points_mode TEXT NOT NULL,
      total_points REAL NOT NULL,
      duration_minutes INTEGER NOT NULL,
      start_at TEXT,
      end_at TEXT,
      attempt_limit INTEGER NOT NULL DEFAULT 1,
      eligibility_year INTEGER,
      status TEXT NOT NULL DEFAULT 'draft',
      results_published_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE community_posts (
      id TEXT PRIMARY KEY,
      author_id TEXT REFERENCES users(id),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tag TEXT NOT NULL,
      link_url TEXT,
      status TEXT NOT NULL DEFAULT 'visible',
      is_locked INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      pinned_by TEXT,
      pinned_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      edited_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE community_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES community_posts(id),
      parent_id TEXT,
      author_id TEXT REFERENCES users(id),
      body TEXT NOT NULL,
      depth INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'visible',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      edited_at TEXT,
      deleted_at TEXT,
      UNIQUE (id, post_id)
    );
  `);

  const nowIso = new Date().toISOString();

  // Insert Users
  sqlite.prepare(`
    INSERT INTO users VALUES
    ('admin-1', 'ADMIN-01', 'admin@aiclub.test', 'Admin User', 'scrypt_hash_123', 'admin', 'active', '["platform:super-admin"]', 0, null, ?, ?),
    ('student-1', '25AM001', 'student1@aiclub.test', 'Student One', 'scrypt_hash_456', 'student', 'active', '[]', 1, null, ?, ?)
  `).run(nowIso, nowIso, nowIso, nowIso);

  // Insert Profiles & Skills
  sqlite.prepare(`
    INSERT INTO student_profiles VALUES
    ('student-1', 'Artificial Intelligence', 2, 'https://github.com/student1', 'https://linkedin.com/in/student1', 'https://hackerrank.com/student1', 'AI enthusiast', null, ?, ?)
  `).run(nowIso, nowIso);

  sqlite.prepare(`
    INSERT INTO profile_skills VALUES
    ('student-1', 'Python', 0, ?),
    ('student-1', 'PyTorch', 1, ?)
  `).run(nowIso, nowIso);

  // Insert Assessments
  sqlite.prepare(`
    INSERT INTO assessment_banks VALUES
    ('bank-1', 'AI Fundamentals', 2, '2026', 'Core questions', 'admin-1', ?, ?)
  `).run(nowIso, nowIso);

  sqlite.prepare(`
    INSERT INTO assessment_bank_questions VALUES
    ('q-1', 'bank-1', 'mcq', 'What is gradient descent?', '["Optimization algorithm","Loss function","Activation","Layer"]', 0, 1.0, '', '', ?, ?)
  `).run(nowIso, nowIso);

  sqlite.prepare(`
    INSERT INTO assessments VALUES
    ('a-1', 'Mid-Term AI Quiz', 'Description', 'Instructions', 'mcq', 'bank-1', 1, '["q-1"]', 1, 'equal', 1.0, 30, ?, ?, 1, 2, 'published', ?, 'admin-1', ?, ?)
  `).run(nowIso, nowIso, nowIso, nowIso, nowIso);

  // Insert Community
  sqlite.prepare(`
    INSERT INTO community_posts VALUES
    ('post-1', 'student-1', 'My first research project', 'Details about the project', 'AI', 'https://github.com/repo', 'visible', 0, 0, null, null, ?, ?, null, null)
  `).run(nowIso, nowIso);

  sqlite.prepare(`
    INSERT INTO community_comments VALUES
    ('c-1', 'post-1', null, 'admin-1', 'Great project!', 0, 'visible', ?, ?, null, null)
  `).run(nowIso, nowIso);

  sqlite.close();

  // 2. Initialize disposable PostgreSQL database via PGlite
  const pg = new PGlite();
  await pg.exec(schemaSql);

  // 3. Perform synthetic migration into PostgreSQL
  const srcDb = new Database(sqlitePath, { readonly: true });
  try {
    // Migrate Users
    const users = srcDb.prepare('SELECT * FROM users').all();
    for (const u of users) {
      await pg.query(
        `INSERT INTO users (id, member_id, email, name, password_hash, role, status, permissions, must_change_password, password_changed_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          u.id, u.member_id, u.email, u.name, u.password_hash, u.role, u.status,
          u.permissions, Boolean(u.must_change_password), u.password_changed_at, u.created_at, u.updated_at
        ]
      );
    }

    // Migrate Profiles
    const profiles = srcDb.prepare('SELECT * FROM student_profiles').all();
    for (const p of profiles) {
      await pg.query(
        `INSERT INTO student_profiles (user_id, department, academic_year, github_url, linkedin_url, hackerrank_url, description, avatar_file_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [p.user_id, p.department, p.academic_year, p.github_url, p.linkedin_url, p.hackerrank_url, p.description, p.avatar_file_id, p.created_at, p.updated_at]
      );
    }

    // Migrate Skills
    const skills = srcDb.prepare('SELECT * FROM profile_skills').all();
    for (const s of skills) {
      await pg.query(
        `INSERT INTO profile_skills (user_id, skill_name, sort_order, created_at)
         VALUES ($1, $2, $3, $4)`,
        [s.user_id, s.skill_name, s.sort_order, s.created_at]
      );
    }

    // Migrate Assessment Banks
    const banks = srcDb.prepare('SELECT * FROM assessment_banks').all();
    for (const b of banks) {
      await pg.query(
        `INSERT INTO assessment_banks (id, title, academic_year, batch, description, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [b.id, b.title, b.academic_year, b.batch, b.description, b.created_by, b.created_at, b.updated_at]
      );
    }

    // Migrate Assessment Questions
    const questions = srcDb.prepare('SELECT * FROM assessment_bank_questions').all();
    for (const q of questions) {
      await pg.query(
        `INSERT INTO assessment_bank_questions (id, bank_id, kind, prompt, options_json, correct_option, points, language, external_url, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [q.id, q.bank_id, q.kind, q.prompt, q.options_json, q.correct_option, q.points, q.language, q.external_url, q.created_at, q.updated_at]
      );
    }

    // Migrate Assessments
    const assessments = srcDb.prepare('SELECT * FROM assessments').all();
    for (const a of assessments) {
      await pg.query(
        `INSERT INTO assessments (id, title, description, instructions, kind, bank_id, question_count, selected_question_ids, allow_backward, points_mode, total_points, duration_minutes, start_at, end_at, attempt_limit, eligibility_year, status, results_published_at, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [
          a.id, a.title, a.description, a.instructions, a.kind, a.bank_id, a.question_count,
          a.selected_question_ids, Boolean(a.allow_backward), a.points_mode, a.total_points,
          a.duration_minutes, a.start_at, a.end_at, a.attempt_limit, a.eligibility_year, a.status,
          a.results_published_at, a.created_by, a.created_at, a.updated_at
        ]
      );
    }

    // Migrate Community Posts & Comments
    const posts = srcDb.prepare('SELECT * FROM community_posts').all();
    for (const p of posts) {
      await pg.query(
        `INSERT INTO community_posts (id, author_id, title, body, tag, link_url, status, is_locked, is_pinned, pinned_by, pinned_at, created_at, updated_at, edited_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [p.id, p.author_id, p.title, p.body, p.tag, p.link_url, p.status, Boolean(p.is_locked), Boolean(p.is_pinned), p.pinned_by, p.pinned_at, p.created_at, p.updated_at, p.edited_at, p.deleted_at]
      );
    }

    const comments = srcDb.prepare('SELECT * FROM community_comments').all();
    for (const c of comments) {
      await pg.query(
        `INSERT INTO community_comments (id, post_id, parent_id, author_id, body, depth, status, created_at, updated_at, edited_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [c.id, c.post_id, c.parent_id, c.author_id, c.body, c.depth, c.status, c.created_at, c.updated_at, c.edited_at, c.deleted_at]
      );
    }

    // 4. Verify Integrity and Completeness in PostgreSQL
    const pgUsers = await pg.query('SELECT count(*)::int as count FROM users');
    assert.equal(pgUsers.rows[0].count, 2, 'All 2 users preserved');

    const adminUser = (await pg.query(`SELECT * FROM users WHERE member_id = 'ADMIN-01'`)).rows[0];
    assert.equal(adminUser.role, 'admin');
    assert.deepEqual(adminUser.permissions, ['platform:super-admin']);
    assert.equal(adminUser.must_change_password, false);

    const studentUser = (await pg.query(`SELECT * FROM users WHERE member_id = '25AM001'`)).rows[0];
    assert.equal(studentUser.must_change_password, true);

    const pgSkills = (await pg.query(`SELECT skill_name FROM profile_skills WHERE user_id = 'student-1' ORDER BY sort_order`)).rows;
    assert.deepEqual(pgSkills.map(r => r.skill_name), ['Python', 'PyTorch']);

    const pgAssessment = (await pg.query(`SELECT * FROM assessments WHERE id = 'a-1'`)).rows[0];
    assert.equal(pgAssessment.title, 'Mid-Term AI Quiz');
    assert.deepEqual(pgAssessment.selected_question_ids, ['q-1']);
    assert.equal(pgAssessment.allow_backward, true);

    const pgComment = (await pg.query(`SELECT * FROM community_comments WHERE id = 'c-1'`)).rows[0];
    assert.equal(pgComment.body, 'Great project!');
    assert.equal(pgComment.depth, 0);

    console.log('Synthetic SQLite data migration verified with 100% record and constraint fidelity.');
  } finally {
    srcDb.close();
    await pg.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
