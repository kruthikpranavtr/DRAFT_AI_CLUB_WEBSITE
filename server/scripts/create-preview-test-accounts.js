// Dedicated extra accounts ONLY for the disposable Render preview database.
import crypto from 'node:crypto';
import { pool } from '../pg.js';
import { hashPassword } from '../passwords.js';
import { PERMISSIONS } from '../permissions.js';

export async function createPreviewTestAccounts() {
  if (process.env.AI_CLUB_PREVIEW_MODE !== '1') return;
  if (process.env.AI_CLUB_PREVIEW_BOOTSTRAP !== 'fresh-preview-only') throw new Error('Preview account creation blocked: wrong mode');
  const url = new URL(process.env.DATABASE_URL || '');
  if (url.hostname !== 'dpg-dbcu193ncjis73dl38mg-a' ||
      url.hostname !== process.env.RENDER_EXPECTED_DB_HOST ||
      decodeURIComponent(url.pathname.slice(1)) !== 'ai_club_preview_db' ||
      decodeURIComponent(url.username) !== 'ai_club_preview_db_user') {
    throw new Error('Preview account creation blocked: unexpected database identity');
  }
  const identities = [
    { role:'admin', id:'KRUTHIK-ADMIN-TEST', email:'kruthik-preview-admin@example.invalid',
      name:'Kruthik Preview Admin', key:'PREVIEW_EXTRA_ADMIN_PASSWORD' },
    { role:'student', id:'KRUTHIK-STUDENT-TEST', email:'kruthik-preview-student@example.invalid',
      name:'Kruthik Preview Student', key:'PREVIEW_EXTRA_STUDENT_PASSWORD' },
  ];
  const passwords=identities.map(x=>process.env[x.key] || '');
  if (passwords.some(x=>x.length < 24) || passwords[0]===passwords[1]) throw new Error('Preview account creation blocked: strong distinct passwords required');
  for (const account of identities) {
    const existing=await pool.query('SELECT member_id, email, role FROM users WHERE member_id=$1 OR email=$2 LIMIT 2',[account.id,account.email]);
    if (existing.rowCount) {
      if (existing.rowCount!==1 || existing.rows[0].member_id!==account.id || existing.rows[0].email!==account.email || existing.rows[0].role!==account.role) {
        throw new Error('Preview account creation blocked: conflicting account');
      }
      continue;
    }
    const now=new Date().toISOString();
    await pool.query(`INSERT INTO users (id,member_id,email,name,password_hash,role,status,permissions,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$8)`,
      [crypto.randomUUID(),account.id,account.email,account.name,await hashPassword(process.env[account.key]),account.role,
        JSON.stringify(account.role==='admin'?[PERMISSIONS.SUPER_ADMIN]:[]),now]);
  }
  console.log('Dedicated Kruthik preview test identities verified; secrets not logged.');
}
