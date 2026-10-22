import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { parseFeed,normalizeArticle,normalizeDate,plainText } from '../server/news/normalize.js';
import { sourceCatalog,createNewsService } from '../server/news/service.js';
import { fetchSource,isPublicAddress } from '../server/news/fetch.js';
import { safeNewsUrl,newsCategory,opportunityState } from '../shared/news.js';

const source=sourceCatalog.find(item=>item.id==='arxiv-research');
const atom=(id='2610.12345',title='Learning safely')=>`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><id>http://arxiv.org/abs/${id}v1</id><title>${title}</title><published>2026-10-20T10:00:00Z</published><link href="http://arxiv.org/abs/${id}v1" rel="alternate" type="text/html"/><category term="cs.AI"/><summary>DO NOT STORE FULL ABSTRACT OR ARTICLE</summary></entry></feed>`;

test('RSS and namespaced Atom parsing extracts metadata without copying body, images or author personal information',()=>{
  const entry=parseFeed(atom())[0];
  assert.equal(entry.title,'Learning safely');assert.deepEqual(entry.categories,['cs.AI']);
  assert.equal(entry.summary,undefined);
  const rss=parseFeed('<rss version="2.0"><channel><item><title><![CDATA[A & B]]></title><link>https://arxiv.org/abs/2610.12345</link><guid>one</guid><pubDate>Tue, 20 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>')[0];
  assert.equal(rss.title,'A & B');assert.equal(rss.externalId,'one');
});
test('XML rejects malformed feeds, DTDs, entity expansion and oversized responses',()=>{
  for (const xml of ['<feed><entry></feed>','<!DOCTYPE feed><feed/>','<!ENTITY x "hello"><feed/>','<html>no feed</html>','x'.repeat(1048577)]) assert.throws(()=>parseFeed(xml));
});
test('canonical URLs reject dangerous protocols, credentials, private literals and normalize tracking parameters',()=>{
  for (const url of ['javascript:alert(1)','http://arxiv.org/abs/x','https://localhost/x','https://127.0.0.1/x','https://[::1]/x','https://user:pass@arxiv.org/x','https://arxiv.org:444/x']) assert.equal(safeNewsUrl(url),null);
  assert.equal(safeNewsUrl('https://arxiv.org/abs/2610.12345?utm_source=feed&b=2&a=1#x'),'https://arxiv.org/abs/2610.12345?a=1&b=2');
  for (const address of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','198.18.0.1','224.0.0.1','::1','::ffff:127.0.0.1']) assert.equal(isPublicAddress(address),false);
  assert.equal(isPublicAddress('8.8.8.8'),true);
});
test('fetching is allowlisted and refuses private or mixed DNS responses before opening a socket',async()=>{
  await assert.rejects(fetchSource({...source,url:'https://evil.example/feed'}),/not approved/);
  await assert.rejects(fetchSource(source,{lookup:async()=>[{address:'127.0.0.1',family:4}]}),/not public/);
  await assert.rejects(fetchSource(source,{lookup:async()=>[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}]}),/not public/);
  for (const candidate of sourceCatalog.filter(item=>!item.verified)) await assert.rejects(fetchSource(candidate),/not approved/);
});
test('normalization validates dates, publisher and category; summaries contain only verifiable metadata',()=>{
  const result=normalizeArticle(parseFeed(atom())[0],source);
  assert.equal(result.category,'AI News');assert.equal(result.canonicalUrl,'https://arxiv.org/abs/2610.12345');
  assert.equal(result.summary.includes('FULL ABSTRACT'),false);assert.equal(result.contentType,'research');
  assert.equal(normalizeDate('bad'),null);assert.equal(normalizeDate('2026-10-20T12:00:00+02:00'),'2026-10-20T10:00:00.000Z');
  assert.equal(newsCategory('cs.SE software'),'Technology News');assert.equal(newsCategory('student hackathon'),'Hackathons');assert.equal(newsCategory('webinar opportunity'),'Events and Opportunities');
  for (const change of [{title:''},{url:'https://evil.example/item'},{url:'https://arxiv.org/pdf/2610.12345'},{publishedAt:'2099-01-01T00:00:00Z'},{publishedAt:'bad'}]) assert.throws(()=>normalizeArticle({...parseFeed(atom())[0],...change},source));
  assert.equal(plainText('<script>alert(1)</script> Research\n update'),'alert(1) Research update');
});
test('opportunity expiration and unknown dates never fabricate a deadline or verification',()=>{
  assert.deepEqual(opportunityState({opportunity:{}},Date.parse('2026-10-22')),{expired:false,completed:false,verified:false});
  assert.deepEqual(opportunityState({opportunity:{registrationDeadline:'2026-10-01',endDate:'2026-10-20',verificationStatus:'verified'}},Date.parse('2026-10-22')),{expired:true,completed:true,verified:true});
});
test('additive migration preserves manual news and ingestion is idempotent, moderated, locked, bounded and observable',async()=>{
  const pg=await PGlite.create();
  const adapter={query:(sql,params)=>pg.query(sql,params),queryOne:async(sql,params)=>(await pg.query(sql,params)).rows[0] || null,queryRows:async(sql,params)=>(await pg.query(sql,params)).rows};
  adapter.withTransaction=callback=>pg.transaction(tx=>callback({query:(sql,params)=>tx.query(sql,params),queryOne:async(sql,params)=>(await tx.query(sql,params)).rows[0] || null}));
  try {
    await pg.exec(fs.readFileSync(new URL('../server/migrations/pg/001_initial_schema.sql',import.meta.url),'utf8'));
    await pg.query("INSERT INTO content_entries (id,type,page_key,section_key,title,status) VALUES ('legacy-manual','news','news','legacy','Existing manual post','published')");
    const before=(await pg.query("SELECT * FROM content_entries WHERE id='legacy-manual'")).rows;
    await pg.exec(fs.readFileSync(new URL('../server/migrations/pg/002_news_aggregation.sql',import.meta.url),'utf8'));
    assert.deepEqual((await pg.query("SELECT * FROM content_entries WHERE id='legacy-manual'")).rows,before);
    let calls=0;
    const service=createNewsService(adapter,{fetcher:async()=>{calls++;return atom();},sleep:async()=>{}});
    assert.equal((await service.collect()).status,'skipped');assert.equal(calls,0);
    await pg.query("UPDATE news_sources SET enabled=TRUE WHERE id='arxiv-research'");
    const run=await service.collect();assert.equal(run.status,'success');assert.equal(run.results[0].inserted,1);
    assert.equal((await adapter.queryOne("SELECT approval FROM news_details WHERE source_id='arxiv-research'")).approval,'approved');
    assert.equal((await service.collect()).status,'skipped');assert.equal(calls,1,'manual runs cannot bypass polling limits');
    await pg.query("DELETE FROM news_ingestion_leases WHERE id LIKE 'source:%'");
    assert.equal((await service.collect()).results[0].duplicate,1);
    assert.equal((await adapter.queryOne('SELECT COUNT(*)::int AS total FROM content_entries')).total,2);
    await service.reserve('collection','held',300);assert.equal((await service.collect()).status,'skipped');
    await pg.query('DELETE FROM news_ingestion_leases');
    await pg.query("UPDATE news_category_policies SET auto_publish=FALSE WHERE category='AI News'");
    const pending=normalizeArticle(parseFeed(atom('2610.22222'))[0],source);
    await service.storeArticle(pending,source);
    assert.equal((await adapter.queryOne('SELECT approval FROM news_details WHERE canonical_url=$1',[pending.canonicalUrl])).approval,'pending');
    const opportunity={...pending,canonicalUrl:'https://arxiv.org/abs/2610.33333',externalId:'competition',category:'Hackathons'};
    await pg.query("UPDATE news_category_policies SET auto_publish=TRUE WHERE category='Hackathons'");
    await service.storeArticle(opportunity,source);
    assert.equal((await adapter.queryOne('SELECT approval FROM news_details WHERE canonical_url=$1',[opportunity.canonicalUrl])).approval,'pending','opportunities cannot auto-publish even after direct policy tampering');
    await pg.query("UPDATE news_details SET expires_at='2026-01-01' WHERE external_id='competition'");await service.archiveExpired();
    assert.equal((await adapter.queryOne("SELECT archived FROM news_details WHERE external_id='competition'")).archived,true);
    let failures=0;
    const broken=createNewsService(adapter,{fetcher:async()=>{failures++;throw new Error('Mock network failure.');},sleep:async()=>{}});
    const failed=await broken.collect();assert.equal(failed.status,'failed');assert.equal(failures,2);assert.match(failed.results[0].error,/Mock/);
    assert.ok(await adapter.queryOne("SELECT id FROM content_entries WHERE id='legacy-manual'"));
  } finally {await pg.close();}
});
