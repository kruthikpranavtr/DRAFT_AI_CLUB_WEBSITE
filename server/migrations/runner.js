import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const migrationDir = path.dirname(fileURLToPath(import.meta.url));
const migrationPattern = /^(\d{3})_([a-z0-9_]+)\.sql$/;

function migrationFiles() {
  return fs.readdirSync(migrationDir)
    .map(file => ({ file, match:file.match(migrationPattern) }))
    .filter(item => item.match)
    .sort((a,b) => Number(a.match[1]) - Number(b.match[1]))
    .map(({ file,match }) => {
      const sql = fs.readFileSync(path.join(migrationDir,file),'utf8');
      return {
        version:Number(match[1]),
        name:match[2],
        file,
        sql,
        checksum:crypto.createHash('sha256').update(sql).digest('hex'),
        foreignKeysOff:/^-- migration: foreign_keys_off$/m.test(sql),
      };
    });
}

function tableNames(database) {
  return database.prepare(`SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all().map(row => row.name);
}

function rowCounts(database, tables = tableNames(database)) {
  return Object.fromEntries(tables.map(table => {
    const safe = table.replaceAll('"','""');
    return [table,database.prepare(`SELECT count(*) AS count FROM "${safe}"`).get().count];
  }));
}

function verifyDatabase(database) {
  const integrity = database.pragma('integrity_check');
  const foreignKeyViolations = database.pragma('foreign_key_check');
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
    throw new Error('SQLite integrity verification failed.');
  }
  if (foreignKeyViolations.length) {
    throw new Error(`SQLite foreign-key verification found ${foreignKeyViolations.length} violation(s).`);
  }
  return { integrity:'ok',foreignKeyViolations:0,tables:tableNames(database),counts:rowCounts(database) };
}

export function createVerifiedBackup(database, databasePath, backupDir) {
  const sourceTables = tableNames(database);
  const sourceCounts = rowCounts(database,sourceTables);
  fs.mkdirSync(backupDir,{ recursive:true });
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const suffix = crypto.randomBytes(4).toString('hex');
  const backupPath = path.join(backupDir,`pre-migration-${stamp}-${suffix}.db`);
  const restorePath = path.join(backupDir,`restore-check-${stamp}-${suffix}.db`);
  const escaped = backupPath.replaceAll("'","''");

  database.exec(`VACUUM INTO '${escaped}'`);
  fs.copyFileSync(backupPath,restorePath);
  const restored = new Database(restorePath,{ readonly:true,fileMustExist:true });
  try {
    const verification = verifyDatabase(restored);
    if (JSON.stringify(verification.tables) !== JSON.stringify(sourceTables)
      || JSON.stringify(verification.counts) !== JSON.stringify(sourceCounts)) {
      throw new Error('Restored backup does not match source tables and row counts.');
    }
  } finally {
    restored.close();
    fs.unlinkSync(restorePath);
  }
  return { backupPath,databasePath,tables:sourceTables,counts:sourceCounts,verified:true };
}

function migrationTableExists(database) {
  return Boolean(database.prepare(`SELECT 1 FROM sqlite_master
    WHERE type='table' AND name='schema_migrations'`).get());
}

function ensureMigrationTable(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
}

export function runMigrations(database, {
  databasePath = '',
  backupDir = path.join(path.dirname(databasePath || process.cwd()),'backups'),
  backup = true,
} = {}) {
  const migrations = migrationFiles();
  const appliedRows = migrationTableExists(database)
    ? database.prepare('SELECT version,name,checksum FROM schema_migrations ORDER BY version').all()
    : [];
  const applied = new Map(appliedRows.map(row => [row.version,row]));

  for (const migration of migrations) {
    const recorded = applied.get(migration.version);
    if (recorded && (recorded.name !== migration.name || recorded.checksum !== migration.checksum)) {
      throw new Error(`Migration ${migration.version} checksum or name does not match its applied record.`);
    }
  }

  const pending = migrations.filter(migration => !applied.has(migration.version));
  let backupReport = null;
  const applicationTables = tableNames(database).filter(name => name !== 'schema_migrations');
  if (pending.length && backup && applicationTables.length) {
    backupReport = createVerifiedBackup(database,databasePath,backupDir);
  }

  ensureMigrationTable(database);
  const completed = [];
  for (const migration of pending) {
    const foreignKeysWereEnabled = database.pragma('foreign_keys',{ simple:true }) === 1;
    let transactionalSql = migration.sql;
    if (/^PRAGMA journal_mode = WAL;\s*/.test(transactionalSql)) {
      database.pragma('journal_mode = WAL');
      transactionalSql = transactionalSql.replace(/^PRAGMA journal_mode = WAL;\s*/, '');
    }
    if (migration.foreignKeysOff) database.pragma('foreign_keys = OFF');
    try {
      database.exec('BEGIN IMMEDIATE');
      database.exec(transactionalSql);
      database.prepare(`INSERT INTO schema_migrations
        (version,name,checksum,applied_at) VALUES (?,?,?,?)`)
        .run(migration.version,migration.name,migration.checksum,new Date().toISOString());
      database.exec('COMMIT');
      completed.push({ version:migration.version,name:migration.name });
    } catch (error) {
      if (database.inTransaction) database.exec('ROLLBACK');
      throw new Error(`Migration ${migration.file} failed: ${error.message}`,{ cause:error });
    } finally {
      if (migration.foreignKeysOff && foreignKeysWereEnabled) database.pragma('foreign_keys = ON');
    }
    verifyDatabase(database);
  }

  return { applied:completed,backup:backupReport,currentVersion:migrations.at(-1)?.version || 0 };
}

export { verifyDatabase };
