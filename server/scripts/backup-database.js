import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { createVerifiedBackup } from '../migrations/runner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here,'..');
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(serverDir,'data','ai-club-member-platform.db'));
const backupDir = path.resolve(process.env.MIGRATION_BACKUP_DIR || path.join(path.dirname(databasePath),'backups'));

if (!fs.existsSync(databasePath)) throw new Error(`Database does not exist: ${databasePath}`);
const database = new Database(databasePath,{ fileMustExist:true });
database.pragma('foreign_keys = ON');
try {
  const report = createVerifiedBackup(database,databasePath,backupDir);
  console.log(JSON.stringify(report,null,2));
} finally {
  database.close();
}
