// Explicit, tightly scoped initializer for the disposable Render LOGIN PREVIEW.
// Never use this on a production or previously populated database.
import { pool } from '../pg.js';
import { runPostgresMigrations } from '../migrations/pg-runner.js';
import { seedDatabase } from '../seed.js';

const EXPECTED_DB = 'ai_club_preview_db';

function ensure(test, message) {
  if (!test) throw new Error('Preview database initialization blocked: ' + message);
}

export async function initializeFreshPreviewIfApproved() {
  if (process.env.AI_CLUB_PREVIEW_BOOTSTRAP !== 'fresh-preview-only') return false;
  ensure(process.env.NODE_ENV === 'production', 'NODE_ENV must be production');
  ensure(process.env.AI_CLUB_PREVIEW_MODE === '1', 'AI_CLUB_PREVIEW_MODE must be enabled');
  ensure(process.env.AI_CLUB_DEMO_MODE !== '1', 'demo mode may not be enabled');
  ensure(!process.env.DATABASE_PATH, 'SQLite path is not allowed');
  const value = process.env.DATABASE_URL || '';
  let dbUrl;
  try { dbUrl = new URL(value); } catch { throw new Error('Preview database initialization blocked: missing/invalid DATABASE_URL'); }
  ensure(['postgres:','postgresql:'].includes(dbUrl.protocol), 'PostgreSQL is required');
  ensure(dbUrl.hostname === process.env.RENDER_EXPECTED_DB_HOST, 'database hostname does not match approved destination');
  ensure(dbUrl.hostname === 'dpg-dbcu193ncjis73dl38mg-a', 'only the authorized Render preview instance may be initialized');
  ensure(decodeURIComponent(dbUrl.pathname.slice(1)) === EXPECTED_DB, 'only the authorized preview database may be initialized');
  ensure(process.env.BOOTSTRAP_ADMIN_ID === 'PREVIEW-ADMIN-01', 'unexpected admin ID');
  ensure(process.env.BOOTSTRAP_STUDENT_ID === 'PREVIEW-STUDENT-01', 'unexpected student ID');
  ensure(process.env.BOOTSTRAP_ADMIN_EMAIL === 'preview-admin@example.invalid', 'unexpected admin email');
  ensure(process.env.BOOTSTRAP_STUDENT_EMAIL === 'preview-student@example.invalid', 'unexpected student email');
  for (const key of ['BOOTSTRAP_ADMIN_PASSWORD','BOOTSTRAP_STUDENT_PASSWORD']) {
    ensure((process.env[key] || '').length >= 20, key + ' requires a strong unique secret');
  }
  ensure(process.env.BOOTSTRAP_ADMIN_PASSWORD !== process.env.BOOTSTRAP_STUDENT_PASSWORD, 'passwords must differ');

  const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  const tables = res.rows.map(x => x.table_name);
  if (tables.length) {
    ensure(tables.includes('schema_migrations') && tables.includes('users') && tables.includes('content_entries'),
      'database already has an unrecognized or partial schema; refusing to overwrite');
    const migrations = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
    ensure([1,2,3].every((v,i) => Number(migrations.rows[i]?.version) === v),
      'database has a partial/incompatible migration state');
    const accounts = await pool.query(
      "SELECT member_id,role FROM users WHERE member_id IN ('PREVIEW-ADMIN-01','PREVIEW-STUDENT-01')");
    ensure(accounts.rows.some(x => x.member_id === 'PREVIEW-ADMIN-01' && x.role === 'admin'),
      'preview administrator not found; manual review required');
    ensure(accounts.rows.some(x => x.member_id === 'PREVIEW-STUDENT-01' && x.role === 'student'),
      'preview student not found; manual review required');
    console.log('Preview database already initialized; no schema or user changes made.');
    return true;
  }
  const migrated = await runPostgresMigrations(pool);
  ensure(migrated.currentVersion >= 3, 'expected migrations 001 through 003');
  await seedDatabase();
  console.log('Fresh disposable preview initialized with two dedicated accounts. No credentials logged.');
  return true;
}
