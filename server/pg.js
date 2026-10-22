import pg from 'pg';
import crypto from 'node:crypto';

const { Pool } = pg;

function createPoolConfig() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/aiclub_db';
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocal = connectionString.includes('127.0.0.1') || connectionString.includes('localhost');
  
  // Render internal Postgres uses a self-signed TLS certificate. The only
  // exception to CA verification is the isolated, disposable preview DB.
  const skipCertificateVerification = process.env.PG_REJECT_UNAUTHORIZED === 'false';
  if (skipCertificateVerification) {
    let dbHost = '';
    try { dbHost = new URL(connectionString).hostname; } catch {}
    const allowedPreviewHost = 'dpg-dbcu193ncjis73dl38mg-a';
    if (process.env.AI_CLUB_PREVIEW_MODE !== '1' ||
        dbHost !== allowedPreviewHost ||
        process.env.RENDER_EXPECTED_DB_HOST !== allowedPreviewHost) {
      throw new Error('Unverified Postgres TLS is restricted to the isolated Render preview database.');
    }
  }

  let ssl = false;
  if (process.env.DATABASE_SSL === 'true' || (isProduction && !isLocal)) {
    ssl = { rejectUnauthorized: !skipCertificateVerification };
  }

  return {
    connectionString,
    ssl,
    max: Number(process.env.PG_POOL_MAX || 50),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT || 20000),
  };
}

export const pool = new Pool(createPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected idle client error in PostgreSQL pool:', err.message);
});

export const now = () => new Date().toISOString();

export const json = (value, fallback = {}) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export function sqlToPg(text) {
  if (!text || typeof text !== 'string') return text;
  if (!text.includes('?')) return text;
  let index = 1;
  let inString = false;
  let quoteChar = '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      result += char;
      if (char === quoteChar) {
        if (i + 1 < text.length && text[i + 1] === quoteChar) {
          result += quoteChar;
          i++;
        } else {
          inString = false;
        }
      }
    } else if (char === "'" || char === '"') {
      inString = true;
      quoteChar = char;
      result += char;
    } else if (char === '?') {
      result += '$' + index++;
    } else {
      result += char;
    }
  }
  return result;
}

import { AsyncLocalStorage } from 'node:async_hooks';

const lockStorage = new AsyncLocalStorage();
let globalLock = Promise.resolve();

export async function withLock(fn) {
  if (lockStorage.getStore()) {
    return await fn();
  }
  const prevLock = globalLock;
  let release;
  globalLock = new Promise((resolve) => { release = resolve; });
  await prevLock;
  return await lockStorage.run({}, async () => {
    try {
      return await fn();
    } finally {
      release();
    }
  });
}

export async function query(text, params = []) {
  const store = lockStorage.getStore();
  if (store?.tx) {
    const pgSql = sqlToPg(text);
    return await store.tx.client.query(pgSql, params);
  }
  return await withLock(async () => {
    const innerStore = lockStorage.getStore();
    if (innerStore?.tx) {
      const pgSql = sqlToPg(text);
      return await innerStore.tx.client.query(pgSql, params);
    }
    const pgSql = sqlToPg(text);
    try {
      const res = await pool.query(pgSql, params);
      return res;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production' && process.env.LOG_SQL_ERRORS === 'true') {
        console.error('Database query error:', error.message, '\nQuery:', pgSql, '\nParams:', params);
      }
      throw error;
    }
  });
}

export async function queryOne(text, params = []) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

export async function queryRows(text, params = []) {
  const res = await query(text, params);
  return res.rows;
}

export async function getClient() {
  return await pool.connect();
}

export async function withTransaction(callback) {
  return await withLock(async () => {
    const client = await pool.connect();
    const tx = {
      client,
      query: async (text, params = []) => client.query(sqlToPg(text), params),
      queryOne: async (text, params = []) => (await client.query(sqlToPg(text), params)).rows[0] || null,
      queryRows: async (text, params = []) => (await client.query(sqlToPg(text), params)).rows,
    };
    return await lockStorage.run({ tx }, async () => {
      try {
        await client.query('BEGIN');
        const result = await callback(tx);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Transaction rollback failed:', rollbackError.message);
        }
        throw error;
      } finally {
        client.release();
      }
    });
  });
}

export async function audit(actorId, action, entityType, entityId = null, details = {}, tx = null) {
  try {
    const q = tx ? tx.query.bind(tx) : query;
    await q(
      `INSERT INTO activity_logs (id, actor_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        crypto.randomUUID(),
        actorId || null,
        action,
        entityType,
        entityId || null,
        typeof details === 'string' ? details : JSON.stringify(details),
        now(),
      ]
    );
  } catch (error) {
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      console.error('Activity audit log failed:', error.message);
    }
  }
}

export async function cleanExpiredSessions() {
  try {
    await query('DELETE FROM sessions WHERE expires_at <= $1', [now()]);
  } catch (error) {
    console.error('Session expiration cleanup failed:', error.message);
  }
}

export async function closePool() {
  await pool.end();
}
