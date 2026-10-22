import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
if (!process.env.TEST_DATABASE_URL?.includes('/aiclub_ephemeral')) throw new Error('Run npm test with the isolated database harness.');
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
const db=await import('../server/pg.js');
const {backupDatabase,restoreDatabase}=await import('../server/scripts/backup-restore-pg.js');
test('backup and restore preserve news source policy, moderation, metadata, deduplication and run logs',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ai-club-news-backup-'));
  try {
    await db.query("INSERT INTO content_entries (id,type,page_key,section_key,title) VALUES ('backup-news','news','news','backup-news','Backup QA fixture')");
    await db.query("INSERT INTO news_details (content_id,canonical_url,category,approval,opportunity) VALUES ('backup-news','https://arxiv.org/abs/2610.99999','Hackathons','pending','{\"verificationStatus\":\"unknown\"}')");
    await db.query("INSERT INTO news_ingestion_runs (id,trigger_type,status,results) VALUES ('backup-run','scheduler','failed','[{\"error\":\"Mock source failure\"}]')");
    const before=await db.queryOne("SELECT * FROM news_details WHERE content_id='backup-news'");
    const backup=await backupDatabase(folder);
    assert.ok(backup.tableCounts.news_details>=1);assert.ok(backup.tableCounts.news_ingestion_runs>=1);
    await db.query("DELETE FROM content_entries WHERE id='backup-news'");
    assert.equal(await db.queryOne("SELECT * FROM news_details WHERE content_id='backup-news'"),null);
    await restoreDatabase(backup.filePath);
    assert.deepEqual(await db.queryOne("SELECT * FROM news_details WHERE content_id='backup-news'"),before);
    assert.equal((await db.queryOne("SELECT status FROM news_ingestion_runs WHERE id='backup-run'")).status,'failed');
    await assert.rejects(db.query("INSERT INTO news_details (content_id,canonical_url,category) VALUES ('backup-news','https://arxiv.org/abs/2610.99999','Hackathons')"),/duplicate key/);
  } finally {await db.closePool();fs.rmSync(folder,{recursive:true,force:true});}
});
