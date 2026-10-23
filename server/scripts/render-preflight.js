// Render startup gate. Normal production checks are read-only.
// An explicit, tightly scoped disposable preview flag may initialize only the authorized fresh preview database.
import { pool, closePool } from '../pg.js';
import { runPostgresMigrations } from '../migrations/pg-runner.js';
import { initializeFreshPreviewIfApproved } from './initialize-render-preview.js';
import { createPreviewTestAccounts } from './create-preview-test-accounts.js';
import { ensurePreviewCreators } from './ensure-preview-creators.js';

class PreflightError extends Error {}
function requireValue(name) {
  const value=String(process.env[name] || '').trim();
  if (!value) throw new PreflightError(`Missing required Render setting: ${name}`);
  return value;
}
function assert(condition,message) {
  if (!condition) throw new PreflightError(message);
}

async function main() {
  assert(process.env.NODE_ENV === 'production','NODE_ENV must be production.');
  assert(process.env.AI_CLUB_DEMO_MODE !== '1','Demo mode is forbidden.');
  assert(!process.env.DATABASE_PATH,'Legacy SQLite DATABASE_PATH must not be configured.');
  const rawUrl=requireValue('DATABASE_URL');
  const expectedHost=requireValue('RENDER_EXPECTED_DB_HOST');
  let dbUrl;
  try { dbUrl=new URL(rawUrl); }
  catch { throw new PreflightError('DATABASE_URL is not a valid PostgreSQL URL.'); }
  assert(['postgres:','postgresql:'].includes(dbUrl.protocol),'DATABASE_URL must use PostgreSQL.');
  assert(dbUrl.hostname === expectedHost,'DATABASE_URL host does not match the reviewed Render destination.');
  assert(!['localhost','127.0.0.1','::1'].includes(dbUrl.hostname),'A production database cannot be local.');
  const previewMode=process.env.AI_CLUB_PREVIEW_MODE === '1';
  if (previewMode) {
    assert(process.env.AI_CLUB_PREVIEW_BOOTSTRAP === 'fresh-preview-only',
      'Preview setup requires explicit one-time isolated-database approval.');
    await initializeFreshPreviewIfApproved();
    await createPreviewTestAccounts();
    await ensurePreviewCreators();
    await runPostgresMigrations(pool); // Apply additive migrations only on the verified disposable preview.
    console.warn('DISPOSABLE PREVIEW: external object storage is not configured; do not upload real files.');
  } else {
    const s3Endpoint=requireValue('S3_ENDPOINT');
    let objectUrl;
    try { objectUrl=new URL(s3Endpoint); }
    catch { throw new PreflightError('S3_ENDPOINT is not a valid URL.'); }
    assert(objectUrl.protocol === 'https:','Object storage endpoint must use HTTPS.');
    for (const name of ['S3_BUCKET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','S3_REGION'])
      requireValue(name);
  }

  // Normal production requires a restored database. The explicit disposable preview may initialize only the named empty instance.
  const result=await pool.query('SELECT version FROM schema_migrations WHERE version IN (1,2,3) ORDER BY version');
  assert(result.rows.length===3 && result.rows.every((r,i)=>Number(r.version)===i+1),
    'Destination schema migrations 001, 002 and 003 must be verified before startup.');
  const memberId=requireValue('BOOTSTRAP_ADMIN_ID');
  const email=requireValue('BOOTSTRAP_ADMIN_EMAIL');
  const admin=await pool.query(
    "SELECT id FROM users WHERE role='admin' AND (member_id=$1 OR email=$2) LIMIT 1",
    [memberId,email],
  );
  assert(admin.rowCount===1,'Reviewed administrator identity was not found in the restored database.');
  const content=await pool.query('SELECT COUNT(*)::int AS n FROM content_entries');
  assert(content.rows[0].n>0,'Destination content is empty; review and restore the source backup.');
  console.log(previewMode
    ? 'Render preflight passed for disposable preview database and dedicated test administrator.'
    : 'Render preflight passed: reviewed database host, restored schema, administrator, content and durable storage settings.');
}

try { await main(); }
catch (error) {
  const message=error instanceof PreflightError
    ? error.message
    : 'Database readiness could not be verified. Check the Render connection and backup restore.';
  console.error('Render preflight blocked startup:',message);
  // Diagnostic metadata only; never print DATABASE_URL or secrets in deploy logs.
  const reason=String(error?.code || error?.cause?.code || 'NO_ERROR_CODE').slice(0,64);
  const type=String(error?.name || 'Error').slice(0,64);
  console.error('Render safe connection diagnostic:',JSON.stringify({ reason,type,
    approvedPreview:process.env.AI_CLUB_PREVIEW_MODE === '1',
    previewBootstrapRequested:process.env.AI_CLUB_PREVIEW_BOOTSTRAP === 'fresh-preview-only' }));
  if (typeof error?.message === 'string' && error.message.startsWith('Preview database initialization blocked:')) {
    console.error('Render preview guard:',error.message.slice(0,180));
  }
  process.exitCode=1;
} finally { await closePool(); }
