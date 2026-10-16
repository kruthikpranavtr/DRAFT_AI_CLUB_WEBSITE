import {
  pool,
  query,
  queryOne,
  queryRows,
  withTransaction,
  getClient,
  audit,
  cleanExpiredSessions,
  now,
  json,
  closePool,
} from './pg.js';

let legacyDb = null;
if (process.env.DATABASE_PATH && !process.env.DATABASE_URL) {
  try {
    const { default: Database } = await import('better-sqlite3');
    legacyDb = new Database(process.env.DATABASE_PATH);
    legacyDb.pragma('foreign_keys = ON');
    legacyDb.pragma('journal_mode = WAL');
  } catch {
    legacyDb = null;
  }
}

export const db = legacyDb;

export {
  pool,
  query,
  queryOne,
  queryRows,
  withTransaction,
  getClient,
  audit,
  cleanExpiredSessions,
  now,
  json,
  closePool,
};
