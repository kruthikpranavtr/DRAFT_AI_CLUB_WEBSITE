import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrations/runner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(here, 'data');
if (process.env.NODE_ENV === 'test' && !process.env.DATABASE_PATH) {
  throw new Error('Tests must set an explicit temporary DATABASE_PATH.');
}
fs.mkdirSync(dataDir, { recursive:true });
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'ai-club-member-platform.db');

export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
export const migrationReport = runMigrations(db,{
  databasePath:dbPath,
  backupDir:process.env.MIGRATION_BACKUP_DIR || path.join(dataDir,'backups'),
});

export const now = () => new Date().toISOString();
export const json = (value, fallback = {}) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

export function audit(actorId, action, entityType, entityId = null, details = {}) {
  db.prepare(`INSERT INTO activity_logs
    (id,actor_id,action,entity_type,entity_id,details,created_at)
    VALUES (?,?,?,?,?,?,?)`)
    .run(crypto.randomUUID(), actorId || null, action, entityType, entityId, JSON.stringify(details), now());
}

export function cleanExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
}
