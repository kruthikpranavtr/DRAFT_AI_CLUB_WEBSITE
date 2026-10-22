import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { sourceCatalog,createNewsService } from '../server/news/service.js';
import { normalizeArticle,parseFeed } from '../server/news/normalize.js';
import { fetchSource,isPublicAddress } from '../server/news/fetch.js';

const byId = id => sourceCatalog.find(source => source.id === id);

const sampleRss = (title,url) => `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><title>Reviewed official publisher feed</title><item>
<title><![CDATA[${title}]]></title><link>${url}</link>
<guid>${url}</guid><pubDate>Wed, 21 Oct 2026 13:00:00 +0000</pubDate>
<description>Full body and feed images must not be persisted</description>
</item></channel></rss>`;

test('NASA and NIST official reviewed RSS feeds are allowlisted with disabled source switches',async()=>{
  for (const id of ['nasa-technology','nist-information-technology','nist-events']) {
    const source = byId(id);
    assert.equal(source?.verified,true);
    assert.equal(source?.categoryPolicy,'fixed');
    assert.equal(source?.access,'rss');
    assert.equal(source?.summaryMode,'metadata');
    assert.ok(source.url.startsWith('https://'));
    assert.ok(source.termsUrl.startsWith('https://'));
    assert.ok(source.attribution.length>20);
    assert.equal(source.intervalHours,6);
    assert.ok(source.articleHosts.length>0);
  }
  assert.equal(byId('nist-events').contentType,'event');
  for (const id of ['google-news','django','devpost','mlh','unstop']) {
    assert.equal(byId(id).verified,false);
    await assert.rejects(fetchSource(byId(id)),/not approved/);
  }
  const pg=await PGlite.create();
  try {
    for (const filename of ['001_initial_schema.sql','002_news_aggregation.sql','003_reviewed_news_sources.sql'])
      await pg.exec(fs.readFileSync(new URL('../server/migrations/pg/'+filename,import.meta.url),'utf8'));
    const rows=(await pg.query('SELECT id,enabled FROM news_sources ORDER BY id')).rows;
    assert.equal(rows.length,sourceCatalog.length);
    assert.ok(rows.every(item => item.enabled===false));
    await pg.exec(fs.readFileSync(new URL('../server/migrations/pg/003_reviewed_news_sources.sql',import.meta.url),'utf8'));
    assert.equal((await pg.query('SELECT COUNT(*)::int AS n FROM news_sources')).rows[0].n,sourceCatalog.length);
  } finally {await pg.close();}
});

test('technology feeds retain reviewed category and ignore feed descriptions and images',()=>{
  const fixtures=[
    [byId('nasa-technology'),'New AI robotics initiative','https://science.nasa.gov/science-research/robotics/','Technology News'],
    [byId('nist-information-technology'),'AI workshop on network security','https://www.nist.gov/news-events/news/2026/10/new-report','Technology News'],
  ];
  for (const [source,title,url,category] of fixtures) {
    const parsed=parseFeed(sampleRss(title,url))[0];
    const normalized=normalizeArticle(parsed,source);
    assert.equal(normalized.category,category);
    assert.equal(normalized.contentType,'article');
    assert.equal(normalized.canonicalUrl,url);
    assert.equal(normalized.summary.includes('Full body'),false);
    assert.equal(JSON.stringify(normalized).includes('feed images'),false);
  }
});

test('official event listings remain pending even when titles look like AI news',async()=>{
  const source=byId('nist-events');
  const article=normalizeArticle(parseFeed(sampleRss('Artificial Intelligence AI News technology webinar','https://www.nist.gov/news-events/events/2026/10/ai-webinar'))[0],source);
  assert.equal(article.category,'Events and Opportunities');
  assert.equal(article.contentType,'event');
  assert.match(article.summary,/need administrator verification/);
  const pg=await PGlite.create();
  const adapter={
    query:(sql,params)=>pg.query(sql,params),
    queryOne:async(sql,params)=>(await pg.query(sql,params)).rows[0]||null,
    withTransaction:fn=>pg.transaction(tx=>fn({
      query:(sql,params)=>tx.query(sql,params),
      queryOne:async(sql,params)=>(await tx.query(sql,params)).rows[0]||null,
    })),
  };
  try {
    for (const filename of ['001_initial_schema.sql','002_news_aggregation.sql','003_reviewed_news_sources.sql'])
      await pg.exec(fs.readFileSync(new URL('../server/migrations/pg/'+filename,import.meta.url),'utf8'));
    await pg.query("UPDATE news_sources SET enabled=TRUE WHERE id='nist-events'");
    await pg.query("UPDATE news_category_policies SET auto_publish=TRUE WHERE category='AI News'");
    assert.equal(await createNewsService(adapter).storeArticle(article,source),'inserted');
    const item=(await pg.query('SELECT c.status,n.category,n.approval FROM content_entries c JOIN news_details n ON n.content_id=c.id')).rows[0];
    assert.equal(item.status,'draft');
    assert.equal(item.approval,'pending');
    assert.equal(item.category,'Events and Opportunities');
  } finally {await pg.close();}
});

test('future dates in NIST event RSS are real start dates, not fictitious publication dates',()=>{
  const source=byId('nist-events');
  const entry=parseFeed(sampleRss('Future developer webinar','https://www.nist.gov/news-events/events/2026/10/developer-webinar'))[0];
  const upcoming=normalizeArticle({...entry,publishedAt:'Wed, 28 Oct 2026 13:00:00 +0000'},source,Date.parse('2026-10-22T08:00:00Z'));
  assert.equal(upcoming.opportunity.startDate,'2026-10-28T13:00:00.000Z');
  assert.equal(upcoming.opportunity.verificationStatus,'unverified');
  assert.equal(upcoming.publishedAt,'2026-10-22T08:00:00.000Z');
  assert.equal(upcoming.category,'Events and Opportunities');
});

test('DNS protection blocks reserved networks while accepting the public NASA feed CDN',()=>{
  for(const ip of ['192.0.2.10','198.51.100.10','203.0.113.10','192.168.1.1'])
    assert.equal(isPublicAddress(ip),false);
  assert.equal(isPublicAddress('192.0.66.108'),true);
});
