import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pg');
const migrationPattern = /^(\d{3})_([a-z0-9_]+)\.sql$/;

export function loadPostgresMigrations() {
  if (!fs.existsSync(migrationDir)) return [];
  return fs.readdirSync(migrationDir)
    .map(file => ({ file, match: file.match(migrationPattern) }))
    .filter(item => item.match)
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
    .map(({ file, match }) => {
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
      return {
        version: Number(match[1]),
        name: match[2],
        file,
        sql,
        checksum: crypto.createHash('sha256').update(sql).digest('hex'),
      };
    });
}

export async function runPostgresMigrations(pool) {
  const client = await pool.connect();
  const migrations = loadPostgresMigrations();

  try {
    await client.query('BEGIN');
    // Acquire a transactional advisory lock to prevent concurrent migrations
    await client.query('SELECT pg_advisory_xact_lock(742918471)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const appliedRes = await client.query(
      'SELECT version, name, checksum FROM schema_migrations ORDER BY version'
    );
    const appliedMap = new Map(appliedRes.rows.map(r => [r.version, r]));

    for (const m of migrations) {
      const record = appliedMap.get(m.version);
      if (record && (record.name !== m.name || record.checksum !== m.checksum)) {
        throw new Error(`PostgreSQL migration ${m.version} checksum or name does not match applied record.`);
      }
    }

    const pending = migrations.filter(m => !appliedMap.has(m.version));
    const completed = [];

    for (const m of pending) {
      console.log(`Applying PostgreSQL migration ${m.file}...`);
      await client.query(m.sql);
      await client.query(
        'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES ($1, $2, $3, NOW())',
        [m.version, m.name, m.checksum]
      );
      completed.push({ version: m.version, name: m.name });
    }

    await client.query('COMMIT');
    return { applied: completed, currentVersion: migrations.at(-1)?.version || 0 };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw new Error(`PostgreSQL migration failed: ${error.message}`, { cause: error });
  } finally {
    client.release();
  }
}
