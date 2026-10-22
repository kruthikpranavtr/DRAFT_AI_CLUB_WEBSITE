import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

if (!process.env.TEST_DATABASE_URL?.includes('/aiclub_ephemeral')) {
  throw new Error('Run npm test using the disposable database harness.');
}
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
process.env.NODE_ENV='test';

const db=await import('../server/db.js');
const {createApp}=await import('../server/app.js');
const {createNewsService,sourceCatalog}=await import('../server/news/service.js');
const {normalizeArticle}=await import('../server/news/normalize.js');

test('approved official technology news appears publicly; pending events stay hidden',async()=>{
  const marker='official-source-qa-'+crypto.randomUUID();
  const nasa=sourceCatalog.find(source=>source.id==='nasa-technology');
  const nist=sourceCatalog.find(source=>source.id==='nist-information-technology');
  const events=sourceCatalog.find(source=>source.id==='nist-events');
  const service=createNewsService(db);
  const sources=[nasa,nist,events];
  let server;
  try {
    for (const source of sources) {
      await db.query('INSERT INTO news_sources (id,enabled) VALUES ($1,TRUE) ON CONFLICT (id) DO UPDATE SET enabled=TRUE',[source.id]);
      assert.equal((await db.queryOne('SELECT enabled FROM news_sources WHERE id=$1',[source.id])).enabled,true);
    }
    const inputs=[
      [nasa,{title:marker+' technology AI robotics',url:'https://science.nasa.gov/science-research/robots/',externalId:marker+'-nasa',publishedAt:'2026-10-20T00:00:00Z',categories:[]}],
      [nist,{title:marker+' information technology AI',url:'https://www.nist.gov/news-events/news/2026/10/technology',externalId:marker+'-nist',publishedAt:'2026-10-20T00:00:00Z',categories:[]}],
      [events,{title:marker+' AI training webinar',url:'https://www.nist.gov/news-events/events/2026/10/webinar',externalId:marker+'-event',publishedAt:'Wed, 28 Oct 2026 13:00:00 +0000',categories:[]}],
    ];
    for (const [source,entry] of inputs) {
      assert.equal(await service.storeArticle(normalizeArticle(entry,source,Date.parse('2026-10-22T08:00:00Z')),source),'inserted');
    }
    server=createApp().listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const publicNews=async()=> {
      const response=await fetch(base+'/api/public/news?search='+encodeURIComponent(marker));
      assert.equal(response.status,200);
      return (await response.json()).items;
    };
    let items=await publicNews();
    assert.equal(items.length,2);
    assert.ok(items.every(item=>item.news.category==='Technology News' && item.status==='published'));
    assert.deepEqual(new Set(items.map(item=>item.news.sourceId)),new Set([nasa.id,nist.id]));
    const pending=await db.queryOne(
      'SELECT c.status,n.approval,n.category,n.opportunity FROM content_entries c JOIN news_details n ON n.content_id=c.id WHERE n.external_id=$1',
      [marker+'-event'],
    );
    assert.equal(pending.status,'draft');
    assert.equal(pending.approval,'pending');
    assert.equal(pending.category,'Events and Opportunities');
    assert.equal(pending.opportunity.startDate,'2026-10-28T13:00:00.000Z');
    assert.equal(pending.opportunity.verificationStatus,'unverified');

    await db.query('UPDATE news_sources SET enabled=FALSE WHERE id=$1',[nist.id]);
    items=await publicNews();
    assert.equal(items.length,1,'disabling an official source must hide its aggregated public entries');
    assert.equal(items[0].news.sourceId,nasa.id);
  } finally {
    if (server) await new Promise(resolve=>server.close(resolve));
    // Clear only this integration test's source switches and fixture entries.
    try {
      for (const source of sources) await db.query('UPDATE news_sources SET enabled=FALSE WHERE id=$1',[source.id]);
      await db.query('DELETE FROM content_entries WHERE id IN (SELECT content_id FROM news_details WHERE external_id LIKE $1)',[marker+'-%']);
    } finally { await db.closePool(); }
  }
});
