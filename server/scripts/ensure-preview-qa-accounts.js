// Dedicated QA accounts for the isolated Render preview only.
// Never provision or reset these accounts on production or another database.
import crypto from 'node:crypto';
import { pool } from '../pg.js';
import { hashPassword } from '../passwords.js';
import { PERMISSIONS } from '../permissions.js';

const accounts = [
  { id:'AI-CLUB-QA-ADMIN', email:'qa-admin@aiclub.invalid', name:'AI Club QA Admin',
    role:'admin', key:'PREVIEW_QA_ADMIN_PASSWORD' },
  { id:'AI-CLUB-QA-STUDENT', email:'qa-student@aiclub.invalid', name:'AI Club QA Student',
    role:'student', key:'PREVIEW_QA_STUDENT_PASSWORD' },
];

export async function ensurePreviewQaAccounts() {
  if (process.env.AI_CLUB_PREVIEW_MODE !== '1') return;
  if (process.env.NODE_ENV !== 'production' ||
      process.env.AI_CLUB_PREVIEW_BOOTSTRAP !== 'fresh-preview-only') {
    throw new Error('QA bootstrap is allowed only for the isolated Render preview');
  }
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['postgres:','postgresql:'].includes(url.protocol) ||
      url.hostname !== 'dpg-dbcu193ncjis73dl38mg-a' ||
      url.hostname !== process.env.RENDER_EXPECTED_DB_HOST ||
      decodeURIComponent(url.pathname.slice(1)) !== 'ai_club_preview_db' ||
      decodeURIComponent(url.username) !== 'ai_club_preview_db_user') {
    throw new Error('QA account provisioning blocked: wrong database');
  }
  const passwords = accounts.map(account => process.env[account.key] || '');
  if (passwords.some(password => password.length < 24) ||
      passwords[0] === passwords[1]) {
    throw new Error('QA account passwords must be strong, distinct and present');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const account of accounts) {
      const found = await client.query(
        'SELECT id, member_id, email, role, status FROM users WHERE member_id=$1 OR email=$2',
        [account.id, account.email]
      );
      if (found.rows.length) {
        const match = found.rows[0];
        if (found.rows.length !== 1 || match.member_id !== account.id ||
            match.email !== account.email || match.role !== account.role ||
            match.status !== 'active') {
          throw new Error('QA account collision or inactive identity: ' + account.id);
        }
        continue; // Existing account passwords are never overwritten.
      }
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();
      await client.query(
        `INSERT INTO users(id,member_id,email,name,password_hash,role,status,permissions,
          must_change_password,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,'active',$7,FALSE,$8,$8)`,
        [userId,account.id,account.email,account.name,
          await hashPassword(process.env[account.key]),account.role,
          JSON.stringify(account.role === 'admin' ? [PERMISSIONS.SUPER_ADMIN] : []),now]
      );
      if (account.role === 'student') {
        await client.query(
          `INSERT INTO student_profiles(user_id,department,academic_year,description)
           VALUES($1,'Artificial Intelligence',2,'QA test account')
           ON CONFLICT(user_id) DO NOTHING`,
          [userId]
        );
      }
    }
    await client.query('COMMIT');
    console.log('Two dedicated shared-preview QA accounts verified; no passwords logged.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
