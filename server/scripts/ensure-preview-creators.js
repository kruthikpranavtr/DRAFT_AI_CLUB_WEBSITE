// Creates creator accounts once in the disposable Render preview database.
// Idempotent: an existing account's password, sessions and content are never modified.
// Production Railway and other databases cannot invoke this bootstrap.
import crypto from 'node:crypto';
import { pool } from '../pg.js';
import { hashPassword } from '../passwords.js';
import { PERMISSIONS } from '../permissions.js';

const creatorAccounts = [
  {
    memberId:'KRUTHIK-CREATOR',
    email:'kruthik-creator-preview@example.invalid',
    name:'Kruthik Pranav',
    envKey:'PREVIEW_KRUTHIK_CREATOR_PASSWORD',
  },
  {
    memberId:'RAGUL-CREATOR',
    email:'ragul-creator-preview@example.invalid',
    name:'Ragul',
    envKey:'PREVIEW_RAGUL_CREATOR_PASSWORD',
  },
];

export async function ensurePreviewCreators() {
  if (process.env.AI_CLUB_PREVIEW_MODE !== '1') return;
  if (process.env.NODE_ENV !== 'production' ||
      process.env.AI_CLUB_PREVIEW_BOOTSTRAP !== 'fresh-preview-only') {
    throw new Error('Creator bootstrap is restricted to the disposable preview');
  }
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['postgres:','postgresql:'].includes(url.protocol) ||
      url.hostname !== 'dpg-dbcu193ncjis73dl38mg-a' ||
      url.hostname !== process.env.RENDER_EXPECTED_DB_HOST ||
      decodeURIComponent(url.pathname.slice(1)) !== 'ai_club_preview_db' ||
      decodeURIComponent(url.username) !== 'ai_club_preview_db_user') {
    throw new Error('Creator bootstrap blocked: wrong database destination');
  }
  const passwords = creatorAccounts.map(account => process.env[account.envKey] || '');
  if (passwords.some(p => p.length < 24) || passwords[0] === passwords[1]) {
    throw new Error('Creator bootstrap requires two different strong passwords');
  }
  // A transaction prevents a half-created pair of accounts.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const account of creatorAccounts) {
      const existing = await client.query(
        'SELECT member_id,email,role,status,permissions FROM users WHERE member_id=$1 OR email=$2',
        [account.memberId, account.email],
      );
      if (existing.rows.length) {
        const user = existing.rows[0];
        if (existing.rows.length !== 1 || user.member_id !== account.memberId ||
            user.email !== account.email || user.role !== 'admin' ||
            user.status !== 'active') {
          throw new Error('Creator bootstrap refused: account collision or inactive account');
        }
        continue;
      }
      const passwordHash = await hashPassword(process.env[account.envKey]);
      const timestamp = new Date().toISOString();
      await client.query(
        `INSERT INTO users (id, member_id, email, name, password_hash, role, status,
          permissions, must_change_password, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'admin','active',$6,FALSE,$7,$7)`,
        [crypto.randomUUID(), account.memberId, account.email, account.name,
          passwordHash, JSON.stringify([PERMISSIONS.SUPER_ADMIN]), timestamp],
      );
    }
    await client.query('COMMIT');
    console.log('Both preview creator administrators are present (passwords never logged).');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
