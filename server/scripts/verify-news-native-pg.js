// Native PostgreSQL acceptance test. Run ONLY against a disposable local
// schema-only clone named aiclub_news_qa_*. Never run against aiclub_db.
import assert from 'node:assert/strict';
import pg from 'pg';
import { runPostgresMigrations, loadPostgresMigrations } from '../migrations/pg-runner.js';
import { createNewsService, sourceCatalog } from '../news/service.js';
import { normalizeArticle } from '../news/normalize.js';

const uri = new URL(process.env.DATABASE_URL || 'postgresql://invalid/');
const databaseName = decodeURIComponent(uri.pathname.slice(1));
if (uri.hostname !== '127.0.0.1' || uri.port !== '5434' ||
    !/^aiclub_news_qa_[a-z0-9_]+$/.test(databaseName)) {
  throw new Error('Refusing native News QA: DATABASE_URL must target a disposable aiclub_news_qa_* database on 127.0.0.1:5434.');
}

const a = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 6, ssl: false });
const b = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 6, ssl: false });

function adapter(pool) {
  const query = (sql, params = []) => pool.query(sql, params);
  const queryOne = async (sql, params = []) => (await query(sql, params)).rows[0] || null;
  const queryRows = async (sql, params = []) => (await query(sql, params)).rows;
  const withTransaction = async fn => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = {
        query: (sql, params = []) => client.query(sql, params),
        queryOne: async (sql, params = []) => (await client.query(sql, params)).rows[0] || null,
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  return { query, queryOne, queryRows, withTransaction };
}

const fixture = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><id>http://arxiv.org/abs/2610.76543v1</id>
  <title>Disposable native PostgreSQL QA source</title>
  <published>2026-10-20T10:00:00Z</published>
  <link href="http://arxiv.org/abs/2610.76543v1" rel="alternate" type="text/html"/>
  <category term="cs.AI"/>
  <summary>Never persist the external abstract.</summary></entry>
</feed>`;

try {
  const actual = await a.query('SELECT current_database() AS name');
  assert.equal(actual.rows[0].name, databaseName);
  const migrations = loadPostgresMigrations();
  const initial = migrations.find(item => item.version === 1);
  assert.ok(initial, 'initial migration must exist');
  assert.equal((await a.query('SELECT COUNT(*)::int AS n FROM schema_migrations')).rows[0].n, 0,
    'schema-only clone should contain no migration history');
  await a.query('INSERT INTO schema_migrations (version,name,checksum) VALUES ($1,$2,$3)',
    [initial.version, initial.name, initial.checksum]);

  // Synthetic legacy manual news verifies additive schema changes preserve it.
  await a.query(`INSERT INTO content_entries (id,type,page_key,section_key,title,excerpt,status)
    VALUES ('native-qa-manual','news','news','native-qa-manual','Existing manual news','Preserve this fixture','published')`);
  const before = (await a.query("SELECT * FROM content_entries WHERE id='native-qa-manual'")).rows[0];

  const migrationRuns = await Promise.all([runPostgresMigrations(a), runPostgresMigrations(b)]);
  const appliedVersions = migrationRuns.flatMap(item => item.applied.map(value => value.version));
  assert.deepEqual(appliedVersions.sort(), [2,3], 'concurrent migrations should apply 002 and 003 exactly once');
  assert.deepEqual((await a.query("SELECT * FROM content_entries WHERE id='native-qa-manual'")).rows[0], before);
  assert.equal((await a.query('SELECT COUNT(*)::int AS n FROM schema_migrations')).rows[0].n, 3);
  assert.deepEqual((await runPostgresMigrations(b)).applied, [], 'rerun must be idempotent');

  const expectedTables = ['news_sources', 'news_category_policies', 'news_details',
    'news_ingestion_runs', 'news_ingestion_leases'];
  const tableRows = (await a.query(`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name LIKE 'news_%'`)).rows.map(item => item.table_name);
  assert.deepEqual([...tableRows].sort(), [...expectedTables].sort());
  const switches = await a.query('SELECT id,enabled FROM news_sources');
  assert.equal(switches.rows.length, 9);
  assert.ok(switches.rows.every(row => row.enabled === false), 'all sources must start disabled');
  assert.equal((await a.query("SELECT auto_publish FROM news_category_policies WHERE category='Hackathons'")).rows[0].auto_publish, false);

  await assert.rejects(a.query(`INSERT INTO news_details (content_id,category)
    VALUES ('no-such-content','AI News')`), error => error.code === '23503');
  console.log('PASS: concurrent native migrations, idempotence, FK constraints, manual preservation, sources disabled');

  // Enable only inside disposable DB. No network calls or normal database changes.
  await a.query("UPDATE news_sources SET enabled=TRUE WHERE id='arxiv-research'");
  const source = sourceCatalog.find(item => item.id === 'arxiv-research');
  assert.equal(source.verified, true);
  const article = normalizeArticle({
    title: 'Native PostgreSQL duplicate QA',
    url: 'https://arxiv.org/abs/2610.54321',
    externalId: 'native-qa-2610-54321',
    publishedAt: '2026-10-20T10:00:00Z',
    categories: ['cs.AI'],
  }, source);
  const first = createNewsService(adapter(a), { fetcher: async () => fixture });
  const second = createNewsService(adapter(b), { fetcher: async () => fixture });
  const inserts = await Promise.all(Array.from({ length: 16 }, (_, index) =>
    (index % 2 === 0 ? first : second).storeArticle(article, source)));
  assert.equal(inserts.filter(x => x === 'inserted').length, 1);
  assert.equal(inserts.filter(x => x === 'duplicate').length, 15);
  assert.equal((await a.query("SELECT COUNT(*)::int AS n FROM news_details WHERE external_id='native-qa-2610-54321'")).rows[0].n, 1);
  console.log('PASS: 16 concurrent native inserts yielded one article and 15 duplicates');

  let fetchCalls = 0;
  const fetcher = async () => {
    fetchCalls++;
    await new Promise(resolve => setTimeout(resolve, 160));
    return fixture;
  };
  const collectingA = createNewsService(adapter(a), { fetcher });
  const collectingB = createNewsService(adapter(b), { fetcher });
  const results = await Promise.all([collectingA.collect(), collectingB.collect()]);
  assert.deepEqual(results.map(result => result.status).sort(), ['skipped', 'success']);
  assert.equal(fetchCalls, 1);
  assert.equal((await a.query("SELECT COUNT(*)::int AS n FROM news_details WHERE source_id='arxiv-research'")).rows[0].n, 2);
  assert.equal((await a.query("SELECT COUNT(*)::int AS n FROM news_ingestion_runs")).rows[0].n, 2);
  assert.equal((await collectingA.collect()).status, 'skipped', 'minimum source interval must be enforced');
  assert.equal(fetchCalls, 1);
  assert.equal((await a.query("SELECT COUNT(*)::int AS n FROM news_ingestion_leases WHERE id='collection'")).rows[0].n, 0);
  console.log('PASS: concurrent native collectors, single-flight lease, polling limit, persisted collection history');
  console.log('NATIVE_NEWS_ACCEPTANCE_PASSED (disposable database only)');
} finally {
  await Promise.allSettled([a.end(), b.end()]);
}
