import crypto from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fetchSource } from './fetch.js';
import { parseFeed,normalizeArticle } from './normalize.js';
import { sourceCatalog } from './catalog.js';
export { sourceCatalog,approvedSourceIds } from './catalog.js';

export const publicNewsCondition = `c.status='published' AND (n.content_id IS NULL OR
  (n.approval='approved' AND (n.source_id IS NULL OR (s.enabled=TRUE AND n.source_id=ANY($1::text[])))))`;

export function createNewsService(db,{ fetcher=fetchSource,sleep=delay }={}) {
  async function reserve(id,owner,seconds) {
    const row=await db.queryOne(`INSERT INTO news_ingestion_leases (id,owner,expires_at) VALUES ($1,$2,NOW()+$3*INTERVAL '1 second')
      ON CONFLICT (id) DO UPDATE SET owner=EXCLUDED.owner,expires_at=EXCLUDED.expires_at
      WHERE news_ingestion_leases.expires_at<=NOW() RETURNING id`,[id,owner,seconds]);
    return Boolean(row);
  }
  async function storeArticle(article,source) {
    const id='news-'+crypto.createHash('sha256').update(article.canonicalUrl).digest('hex');
    try {
      return await db.withTransaction(async tx => {
        // Recheck source state within the insertion transaction. The row lock
        // serializes disabling against publication; subsequent public reads also
        // check enabled and the server's reviewed source allowlist.
        const state=await tx.queryOne('SELECT enabled FROM news_sources WHERE id=$1 FOR SHARE',[source.id]);
        if (!source.verified || !state?.enabled) return 'disabled';
        const policy=await tx.queryOne('SELECT auto_publish FROM news_category_policies WHERE category=$1',[article.category]);
        const auto=policy?.auto_publish && ['AI News','Technology News'].includes(article.category);
        const duplicate=await tx.queryOne('SELECT content_id FROM news_details WHERE canonical_url=$1 OR (source_id=$2 AND external_id=$3)',[article.canonicalUrl,source.id,article.externalId]);
        if (duplicate) return 'duplicate';
        const created=await tx.queryOne(`INSERT INTO content_entries (id,type,page_key,section_key,title,excerpt,body,payload,status,published_at)
          VALUES ($1,'news','news',$1,$2,$3,'',$4,$5,$6) ON CONFLICT (id) DO NOTHING RETURNING id`,
        [id,article.title,article.summary,JSON.stringify({category:article.category}),auto?'published':'draft',article.publishedAt]);
        if (!created) return 'duplicate';
        await tx.query(`INSERT INTO news_details (content_id,source_id,external_id,canonical_url,category,content_type,approval,published_at,opportunity)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,source.id,article.externalId,article.canonicalUrl,article.category,article.contentType,auto?'approved':'pending',article.publishedAt,JSON.stringify(article.opportunity||{})]);
        return 'inserted';
      });
    } catch (error) { if (error.code==='23505') return 'duplicate'; throw error; }
  }
  async function archiveExpired() {
    await db.query(`UPDATE news_details SET archived=TRUE,updated_at=NOW() WHERE auto_archive=TRUE AND archived=FALSE
      AND COALESCE(NULLIF(opportunity->>'endDate','')::timestamptz,expires_at)<=NOW()`);
  }
  async function collect({trigger='scheduler',actorId=null}={}) {
    const id=crypto.randomUUID();
    if (!await reserve('collection',id,300)) {
      await db.query(`INSERT INTO news_ingestion_runs (id,trigger_type,actor_id,status,finished_at) VALUES ($1,$2,$3,'skipped',NOW())`,[id,trigger,actorId]);
      return {id,status:'skipped',reason:'Another collection is running.'};
    }
    const results=[];
    await db.query(`INSERT INTO news_ingestion_runs (id,trigger_type,actor_id,status) VALUES ($1,$2,$3,'running')`,[id,trigger,actorId]);
    try {
      await db.query(`UPDATE news_ingestion_runs SET status='failed',finished_at=NOW(),results='[{"error":"Worker lease expired before completion."}]'
        WHERE status='running' AND id<>$1 AND started_at<NOW()-INTERVAL '5 minutes'`,[id]);
      await archiveExpired();
      const enabled=await db.queryRows('SELECT id FROM news_sources WHERE enabled=TRUE');
      const deadline=Date.now()+60000;
      for (const {id:sourceId} of enabled) {
        if (Date.now()>deadline) { results.push({sourceId,status:'skipped',reason:'Collection time budget reached.'}); continue; }
        const source=sourceCatalog.find(item => item.id===sourceId && item.verified);
        if (!source) { results.push({sourceId,status:'skipped',error:'Source permissions unverified.'}); continue; }
        if (!await reserve('source:'+sourceId,id,source.intervalHours*3600)) { results.push({sourceId,status:'skipped',reason:'Polling interval not elapsed.'}); continue; }
        const result={sourceId,status:'success',inserted:0,duplicate:0,rejected:0};
        try {
          let xml;
          for (let attempt=0;attempt<2;attempt++) {
            try { xml=await fetcher(source); break; }
            catch (error) {
              // Do not immediately retry 429s or denied redirects. Next six-hour
              // run respects Retry-After more conservatively than a short retry.
              if (attempt || /HTTP (?:[34]\d\d)/.test(error.message)) throw error;
              await sleep(source.requestGapMs+500);
            }
          }
          for (const entry of parseFeed(xml)) {
            let article;
            try { article=normalizeArticle(entry,source); }
            catch { result.rejected++; continue; }
            const state=await storeArticle(article,source);
            if (state==='inserted') result.inserted++;
            if (state==='duplicate') result.duplicate++;
          }
        } catch (error) {
          result.status='failed'; result.error=error.code==='ENOTFOUND'?'Source DNS lookup failed.':String(error.message).slice(0,200);
          if (error.retryAfterSeconds) await db.query("UPDATE news_ingestion_leases SET expires_at=GREATEST(expires_at,NOW()+$2*INTERVAL '1 second') WHERE id=$1",['source:'+sourceId,error.retryAfterSeconds]);
        }
        results.push(result);
      }
      const failed=results.filter(item => item.status==='failed').length;
      const status=failed ? (failed===results.length?'failed':'partial') : results.every(item => item.status==='skipped')?'skipped':'success';
      await db.query('UPDATE news_ingestion_runs SET status=$2,finished_at=NOW(),results=$3 WHERE id=$1',[id,status,JSON.stringify(results)]);
      return {id,status,results};
    } catch (error) {
      await db.query(`UPDATE news_ingestion_runs SET status='failed',finished_at=NOW(),results=$2 WHERE id=$1`,[id,JSON.stringify([{error:'Collection failed; inspect server diagnostics.'}])]);
      throw error;
    } finally { await db.query('DELETE FROM news_ingestion_leases WHERE id=$1 AND owner=$2',['collection',id]); }
  }
  return {collect,storeArticle,archiveExpired,reserve};
}
