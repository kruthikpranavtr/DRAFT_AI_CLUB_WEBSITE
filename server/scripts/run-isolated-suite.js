// Existing integration tests truncate tables. Always provision an ephemeral
// database rather than trusting a shell's DATABASE_URL / TEST_DATABASE_URL.
import { spawn } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pg from 'pg';
import { runPostgresMigrations } from '../migrations/pg-runner.js';

const database=await PGlite.create();
const bridge=new PGLiteSocketServer({db:database,host:'127.0.0.1',port:0,maxConnections:12});
try {
  await bridge.start();
  const connection='postgresql://postgres:postgres@'+bridge.getServerConn()+'/aiclub_ephemeral';
  const pool=new pg.Pool({connectionString:connection,max:1});
  try { await runPostgresMigrations(pool); } finally { await pool.end(); }
  console.log('Tests use a disposable in-memory PostgreSQL-compatible database; configured databases are not accessed.');
  const child=spawn(process.execPath,['--test','--test-concurrency=1',...process.argv.slice(2)],{
    stdio:'inherit',env:{...process.env,NODE_ENV:'test',DATABASE_URL:connection,TEST_DATABASE_URL:connection,DATABASE_SSL:'false',PG_POOL_MAX:'1',PG_IDLE_TIMEOUT:'100'},
  });
  process.exitCode=await new Promise((resolve,reject)=>{child.once('exit',code=>resolve(code??1));child.once('error',reject);});
} finally { await bridge.stop();await database.close(); }
