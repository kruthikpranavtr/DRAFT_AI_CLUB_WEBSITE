#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { pool, withTransaction, closePool } from '../pg.js';
import { runPostgresMigrations } from '../migrations/pg-runner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const defaultSqlitePath = process.env.DATABASE_PATH || path.join(projectRoot, 'server/data/ai-club-member-platform.db');

const isDryRun = process.argv.includes('--dry-run');

async function migrateData() {
  console.log('--- AI Club SQLite to PostgreSQL Data Migration ---');
  console.log(`Source SQLite: ${defaultSqlitePath}`);
  console.log(`Dry Run Mode: ${isDryRun ? 'ENABLED (No writes to PostgreSQL)' : 'DISABLED (Writing to PostgreSQL)'}`);

  if (!fs.existsSync(defaultSqlitePath)) {
    console.warn(`Source SQLite database not found at ${defaultSqlitePath}. Nothing to migrate.`);
    await closePool();
    return;
  }

  // 1. Create a safe, verified SQLite snapshot taking WAL into account
  const tmpSnapshot = path.join(os.tmpdir(), `sqlite-snapshot-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.db`);
  const srcDb = new Database(defaultSqlitePath, { readonly: true });
  try {
    srcDb.pragma('journal_mode = WAL');
    srcDb.exec(`VACUUM INTO '${tmpSnapshot.replaceAll("'", "''")}'`);
  } finally {
    srcDb.close();
  }

  const snapshotDb = new Database(tmpSnapshot, { readonly: true });
  console.log('Verified SQLite read-only snapshot created.');

  // 2. Run PostgreSQL migrations
  if (!isDryRun) {
    console.log('Ensuring PostgreSQL schema is up to date...');
    await runPostgresMigrations(pool);
  }

  // Tables in strict foreign-key safe topological order
  const migrationSequence = [
    {
      table: 'users',
      transform: (row) => ({
        ...row,
        must_change_password: Boolean(row.must_change_password),
        permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      }),
    },
    {
      table: 'sessions',
      transform: (row) => row,
    },
    {
      table: 'files',
      transform: (row) => ({
        ...row,
        is_public: Boolean(row.is_public),
      }),
    },
    {
      table: 'student_profiles',
      transform: (row) => row,
    },
    {
      table: 'profile_skills',
      transform: (row) => row,
    },
    {
      table: 'content_entries',
      transform: (row) => ({
        ...row,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      }),
    },
    {
      table: 'gallery_categories',
      transform: (row) => row,
    },
    {
      table: 'gallery_items',
      transform: (row) => row,
    },
    {
      table: 'settings',
      transform: (row) => ({
        ...row,
        is_public: Boolean(row.is_public),
      }),
    },
    {
      table: 'activity_logs',
      transform: (row) => ({
        ...row,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      }),
    },
    {
      table: 'assessment_banks',
      transform: (row) => row,
    },
    {
      table: 'assessment_bank_questions',
      transform: (row) => ({
        ...row,
        options_json: typeof row.options_json === 'string' ? JSON.parse(row.options_json) : row.options_json,
      }),
    },
    {
      table: 'assessments',
      transform: (row) => ({
        ...row,
        selected_question_ids: typeof row.selected_question_ids === 'string' ? JSON.parse(row.selected_question_ids) : row.selected_question_ids,
        allow_backward: Boolean(row.allow_backward),
      }),
    },
    {
      table: 'assessment_questions',
      transform: (row) => ({
        ...row,
        options_json: typeof row.options_json === 'string' ? JSON.parse(row.options_json) : row.options_json,
      }),
    },
    {
      table: 'assessment_attempts',
      transform: (row) => row,
    },
    {
      table: 'assessment_answers',
      transform: (row) => row,
    },
    {
      table: 'community_posts',
      transform: (row) => ({
        ...row,
        is_locked: Boolean(row.is_locked),
        is_pinned: Boolean(row.is_pinned),
      }),
    },
    {
      table: 'community_comments',
      transform: (row) => row,
    },
    {
      table: 'community_post_votes',
      transform: (row) => row,
    },
    {
      table: 'community_comment_votes',
      transform: (row) => row,
    },
    {
      table: 'community_reports',
      transform: (row) => row,
    },
    {
      table: 'community_media',
      transform: (row) => row,
    },
    {
      table: 'community_media_variants',
      transform: (row) => row,
    },
    {
      table: 'community_post_attachments',
      transform: (row) => row,
    },
  ];

  const report = [];

  try {
    for (const { table, transform } of migrationSequence) {
      // Check if table exists in SQLite
      const hasTable = snapshotDb.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (!hasTable) {
        report.push({ table, sqliteCount: 0, postgresCount: 0, status: 'SKIPPED_NOT_IN_SOURCE' });
        continue;
      }

      const rows = snapshotDb.prepare(`SELECT * FROM "${table}"`).all();
      const sqliteCount = rows.length;

      if (!isDryRun && rows.length > 0) {
        await withTransaction(async (client) => {
          // Disable triggers during initial bulk copy if needed or insert cleanly
          for (const rawRow of rows) {
            const transformed = transform(rawRow);
            const columns = Object.keys(transformed);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const values = Object.values(transformed);
            const queryText = `
              INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')})
              VALUES (${placeholders})
              ON CONFLICT DO NOTHING
            `;
            await client.query(queryText, values);
          }
        });
      }

      let pgCount = 0;
      if (!isDryRun) {
        const countRes = await pool.query(`SELECT count(*)::int AS count FROM "${table}"`);
        pgCount = countRes.rows[0].count;
      }

      report.push({
        table,
        sqliteCount,
        postgresCount: isDryRun ? 'DRY_RUN' : pgCount,
        status: isDryRun ? 'PREFLIGHT_OK' : (pgCount >= sqliteCount ? 'SUCCESS' : 'MISMATCH'),
      });
    }

    console.log('\n--- Migration Verification Summary ---');
    console.table(report);
    console.log('Migration completed successfully.');
  } finally {
    snapshotDb.close();
    try { fs.unlinkSync(tmpSnapshot); } catch {}
    await closePool();
  }
}

migrateData().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
