// Isolated browser acceptance environment: no normal database, seeds or feeds.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { runPostgresMigrations } from '../migrations/pg-runner.js';
if (process.env.NEWS_QA!=='1') throw new Error('Explicit NEWS_QA=1 is required.');
const database=await PGlite.create();
const bridge=new PGLiteSocketServer({db:database,host:'127.0.0.1',port:0,maxConnections:12});
await bridge.start();
process.env.DATABASE_URL='postgresql://postgres:postgres@'+bridge.getServerConn()+'/aiclub_ephemeral';
process.env.DATABASE_SSL='false';process.env.PG_POOL_MAX='1';process.env.NODE_ENV='test';
process.env.ALLOWED_ORIGINS='http://127.0.0.1:5318,http://localhost:5318';
const migrationPool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
try { await runPostgresMigrations(migrationPool); } finally {await migrationPool.end();}
const db=await import('../db.js');
const {hashPassword}=await import('../passwords.js');
await db.query(`INSERT INTO users (id,member_id,email,name,password_hash,role,permissions) VALUES ('news-qa-admin','NEWS-QA-ADMIN','news-qa@example.test','QA News Editor',$1,'admin','["content:news"]')`,[await hashPassword('News-QA-only-password-42!')]);
for (let i=0;i<26;i++) {
  await db.query(`INSERT INTO content_entries (id,type,page_key,section_key,title,excerpt,status,payload,published_at)
    VALUES ($1,'news','news',$1,$2,$3,'published',$4,NOW()-$5*INTERVAL '1 hour')`,['qa-manual-'+i,`QA ONLY — Club ${i===0?'featured update':'news fixture '+i}`,'Isolated browser verification content. Not a real announcement.',JSON.stringify({category:i%2?'Events':'Announcements',featured:i===0}),i]);
}
const {createApp}=await import('../app.js');
const api=createApp().listen(3318,'127.0.0.1');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5318','--strictPort'],{
  env:{...process.env,VITE_API_PORT:'3318',VITE_API_ORIGIN:'http://127.0.0.1:3318'},stdio:'inherit',windowsHide:true,
});
console.log('News QA only: http://127.0.0.1:5318 — disposable NEWS-QA-ADMIN fixture. No normal accounts or credentials are used.');
let closing=false;
async function close() {
  if (closing) return;closing=true;
  vite.kill();await new Promise(resolve=>api.close(resolve));await db.closePool();await bridge.stop();await database.close();process.exit(0);
}
process.once('SIGINT',close);process.once('SIGTERM',close);
process.stdin.setEncoding('utf8');process.stdin.on('data',text=>{if(text.trim()==='stop') close();});
