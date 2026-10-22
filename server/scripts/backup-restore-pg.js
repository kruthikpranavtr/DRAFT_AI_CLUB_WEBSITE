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
  'news_sources',
  'news_category_policies',
  'news_details',
  'news_ingestion_runs',
  'news_ingestion_leases',
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
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_RESTORE !== 'true') {
    throw new Error('Destructive restore blocked: Refusing to restore database in production environment without explicit ALLOW_PRODUCTION_RESTORE=true.');
  }

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

export function backupMedia(uploadDir = path.resolve(serverDir, 'member-platform-uploads'), targetDir = defaultBackupDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  if (!fs.existsSync(uploadDir)) {
    return { count: 0, targetDir, message: 'Upload directory does not exist yet. Nothing to backup.' };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mediaBackupDir = path.join(targetDir, `media-backup-${timestamp}`);
  fs.mkdirSync(mediaBackupDir, { recursive: true });

  const files = fs.readdirSync(uploadDir, { withFileTypes: true });
  let count = 0;
  const manifest = {};

  for (const entry of files) {
    if (entry.isFile()) {
      const srcPath = path.join(uploadDir, entry.name);
      const destPath = path.join(mediaBackupDir, entry.name);
      fs.copyFileSync(srcPath, destPath);
      const content = fs.readFileSync(srcPath);
      manifest[entry.name] = crypto.createHash('sha256').update(content).digest('hex');
      count++;
    }
  }

  fs.writeFileSync(path.join(mediaBackupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return { count, mediaBackupDir, manifest };
}

export function restoreMedia(sourceMediaBackupDir, uploadDir = path.resolve(serverDir, 'member-platform-uploads')) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_RESTORE !== 'true') {
    throw new Error('Destructive media restore blocked: Refusing to restore media in production without explicit ALLOW_PRODUCTION_RESTORE=true.');
  }

  if (!fs.existsSync(sourceMediaBackupDir)) {
    throw new Error(`Media backup directory not found: ${sourceMediaBackupDir}`);
  }

  const manifestPath = path.join(sourceMediaBackupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Invalid media backup: manifest.json missing.');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  fs.mkdirSync(uploadDir, { recursive: true });
  let restored = 0;

  for (const [filename, expectedHash] of Object.entries(manifest)) {
    const srcFile = path.join(sourceMediaBackupDir, filename);
    if (!fs.existsSync(srcFile)) throw new Error(`Media backup corrupt: missing ${filename}`);
    const content = fs.readFileSync(srcFile);
    const actualHash = crypto.createHash('sha256').update(content).digest('hex');
    if (actualHash !== expectedHash) {
      throw new Error(`Media checksum mismatch for ${filename}`);
    }
    fs.copyFileSync(srcFile, path.join(uploadDir, filename));
    restored++;
  }

  return { ok: true, restoredCount: restored };
}
