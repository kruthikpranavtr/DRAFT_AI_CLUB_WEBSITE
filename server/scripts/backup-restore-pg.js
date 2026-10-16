import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pool, query, queryRows, withTransaction, closePool } from '../pg.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, '..');
const defaultBackupDir = path.resolve(process.env.PG_BACKUP_DIR || path.join(serverDir, 'data', 'backups', 'pg'));

export const ORDERED_TABLES = [
  'users',
  'sessions',
  'files',
  'student_profiles',
  'profile_skills',
  'content_entries',
  'gallery_categories',
  'gallery_items',
  'settings',
  'activity_logs',
  'assessment_banks',
  'assessment_bank_questions',
  'assessments',
  'assessment_questions',
  'assessment_attempts',
  'assessment_answers',
  'community_media',
  'community_media_variants',
  'community_posts',
  'community_comments',
  'community_post_votes',
  'community_comment_votes',
  'community_reports',
  'community_post_attachments',
];

export async function backupDatabase(targetDir = defaultBackupDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `pg-backup-${timestamp}.json`;
  const filePath = path.join(targetDir, filename);

  const backupData = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    tables: {},
    tableCounts: {},
  };

  for (const table of ORDERED_TABLES) {
    const rows = await queryRows(`SELECT * FROM ${table}`);
    backupData.tables[table] = rows;
    backupData.tableCounts[table] = rows.length;
  }

  const rawJson = JSON.stringify(backupData, null, 2);
  const checksum = crypto.createHash('sha256').update(rawJson).digest('hex');

  const envelope = {
    checksum,
    ...backupData,
  };

  fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf8');
  return { filePath, checksum, tableCounts: backupData.tableCounts };
}

export async function restoreDatabase(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found: ${filePath}`);
  }

  const rawContent = fs.readFileSync(filePath, 'utf8');
  const envelope = JSON.parse(rawContent);

  const { checksum, tables } = envelope;
  // Verify data integrity
  const dataToHash = {
    version: envelope.version,
    createdAt: envelope.createdAt,
    tables: envelope.tables,
    tableCounts: envelope.tableCounts,
  };
  const computedChecksum = crypto.createHash('sha256').update(JSON.stringify(dataToHash, null, 2)).digest('hex');
  if (checksum !== computedChecksum) {
    throw new Error(`Backup checksum mismatch! Expected ${checksum}, computed ${computedChecksum}`);
  }

  // Restore within transaction with rollback guarantee
  const reversedTables = [...ORDERED_TABLES].reverse();
  const restoreReport = {};

  await withTransaction(async (tx) => {
    // Disable triggers temporarily or truncate cascade
    const truncateList = ORDERED_TABLES.join(', ');
    await tx.query(`TRUNCATE ${truncateList} CASCADE;`);

    for (const table of ORDERED_TABLES) {
      const rows = tables[table] || [];
      restoreReport[table] = rows.length;
      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const colNames = columns.join(', ');

      for (const row of rows) {
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map(col => {
          const val = row[col];
          if (val && typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });
        await tx.query(
          `INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`,
          values
        );
      }
    }
  });

  return { ok: true, restoredCounts: restoreReport };
}
