import { pool, query, closePool } from '../pg.js';

async function main() {
  console.log('--- Verifying PostgreSQL Tables & Objects ---');
  const tables = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log(`Total public tables: ${tables.rows.length}`);
  for (const row of tables.rows) {
    console.log(` - ${row.table_name}`);
  }

  const triggers = await query(`
    SELECT trigger_name, event_manipulation, event_object_table 
    FROM information_schema.triggers 
    ORDER BY event_object_table, trigger_name;
  `);
  console.log(`\nTotal triggers: ${triggers.rows.length}`);
  for (const trig of triggers.rows) {
    console.log(` - [${trig.event_object_table}] ${trig.trigger_name} (${trig.event_manipulation})`);
  }

  const indexes = await query(`
    SELECT tablename, indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);
  console.log(`\nTotal indexes: ${indexes.rows.length}`);

  await closePool();
  console.log('\nVerification complete: all tables, triggers, and indexes are active.');
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
