// Enable reviewed sources once on the explicitly isolated Render preview.
// This never runs against production or the original Railway database.
// Subsequent admin choices remain authoritative: the one-time marker prevents overrides.
import { sourceCatalog } from '../news/catalog.js';

const eligible=['arxiv-research','nasa-technology','nist-information-technology','nist-events'];
export async function initializePreviewNewsOnce(pool) {
  if(process.env.AI_CLUB_PREVIEW_MODE!=='1' || process.env.PREVIEW_NEWS_ENABLE_APPROVED!=='1') return {status:'disabled'};
  if(process.env.RENDER_EXPECTED_DB_HOST!=='dpg-dbcu193ncjis73dl38mg-a'
    || process.env.AI_CLUB_PREVIEW_BOOTSTRAP!=='fresh-preview-only'){
    throw new Error('Preview-only news activation refused: target is not the reviewed disposable database.');
  }
  const approved=eligible.filter(id=>sourceCatalog.some(s=>s.id===id&&s.verified&&s.url));
  if(approved.length!==eligible.length) throw new Error('A news source is not independently approved.');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const marker=await client.query("INSERT INTO settings(key,value,is_public,updated_at) VALUES('preview.news.sources-bootstrapped','true',FALSE,NOW()) ON CONFLICT(key) DO NOTHING RETURNING key");
    if(!marker.rowCount){await client.query('COMMIT');return {status:'already-initialized'}}
    await client.query('UPDATE news_sources SET enabled=TRUE,updated_at=NOW() WHERE id=ANY($1::text[])',[approved]);
    await client.query("UPDATE news_category_policies SET auto_publish=TRUE WHERE category=ANY($1::text[])",[['AI News','Technology News']]);
    await client.query('COMMIT');
    return {status:'enabled-once',sourceCount:approved.length};
  } catch(error) {await client.query('ROLLBACK');throw error}
  finally {client.release()}
}
