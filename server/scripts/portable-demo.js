// Portable, loopback-only demo of the current PostgreSQL-backed app.
// Never use this with a real database or real student credentials.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { runPostgresMigrations } from '../migrations/pg-runner.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const setupOnly=process.argv.includes('--setup-only');
if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL || process.env.TEST_DATABASE_URL) {
  throw new Error('Portable demo requires a local, isolated database and refuses production/external database settings.');
}
process.chdir(root);
const dataDir=path.join(root,'server','data','portable-demo-postgres');
fs.mkdirSync(dataDir,{recursive:true});

const database=await PGlite.create({dataDir});
const bridge=new PGLiteSocketServer({db:database,host:'127.0.0.1',port:0,maxConnections:15});
let httpServer=null, vite=null, closing=false;
let appPool=null;

async function shutdown(exitCode=0) {
  if(closing)return;
  closing=true;
  if(vite&&!vite.killed)vite.kill();
  if(httpServer)await new Promise(resolve=>httpServer.close(()=>resolve()));
  try{if(appPool)await appPool();}catch(error){console.error('Demo pool shutdown:',error.message)}
  await bridge.stop();
  await database.close();
  process.exitCode=exitCode;
}

try {
  await bridge.start();
  const connection='postgresql://postgres:postgres@'+bridge.getServerConn()+'/aiclub_portable_demo';
  Object.assign(process.env,{
    NODE_ENV:'development',
    AI_CLUB_DEMO_MODE:'1',
    DATABASE_URL:connection,
    DATABASE_SSL:'false',
    PG_POOL_MAX:'3',
    PG_IDLE_TIMEOUT:'1000',
    PORT:'3003',
    ALLOWED_ORIGINS:'http://127.0.0.1:5175,http://localhost:5175',
    VITE_WEB_HOST:'127.0.0.1',
    VITE_WEB_PORT:'5175',
    VITE_API_PORT:'3003',
    VITE_DEMO_MODE:'true',
    BOOTSTRAP_ADMIN_ID:'DEMO-ADMIN',
    BOOTSTRAP_ADMIN_EMAIL:'demo.admin@aiclub.test',
    BOOTSTRAP_ADMIN_NAME:'Demo Administrator',
    BOOTSTRAP_ADMIN_PASSWORD:'DemoAdmin@2026!',
    BOOTSTRAP_STUDENT_ID:'DEMO-STUDENT',
    BOOTSTRAP_STUDENT_EMAIL:'demo.student@aiclub.test',
    BOOTSTRAP_STUDENT_NAME:'Demo Student',
    BOOTSTRAP_STUDENT_PASSWORD:'DemoStudent@2026!',
  });
  const pool=new pg.Pool({connectionString:connection,max:1});
  try {
    await runPostgresMigrations(pool);
    // Load DB modules only after DATABASE_URL points to this isolated embedded server.
    const {seedDatabase}=await import('../seed.js');
    await seedDatabase();

    const admin=(await pool.query("SELECT id FROM users WHERE member_id='DEMO-ADMIN' AND role='admin'")).rows[0];
    const student=(await pool.query("SELECT id FROM users WHERE member_id='DEMO-STUDENT' AND role='student'")).rows[0];
    if(!admin||!student)throw Error('Demo accounts could not be provisioned.');

    await pool.query(
      "INSERT INTO student_profiles(user_id,department,academic_year,description) VALUES($1,'Artificial Intelligence',2,'Portable demo member') ON CONFLICT(user_id) DO NOTHING",
      [student.id]
    );
    const bankId='20000000-0000-4000-8000-000000000010';
    const assessmentId='20000000-0000-4000-8000-000000000020';
    const sample=[
      ['20000000-0000-4000-8000-000000000011','What does AI stand for?',['Artificial Intelligence','Automatic Internet','Advanced Integration','Applied Interface'],0],
      ['20000000-0000-4000-8000-000000000012','Which language is commonly used for machine learning?',['HTML','Python','CSS','XML'],1],
      ['20000000-0000-4000-8000-000000000013','Which example is supervised learning?',['Grouping unlabeled data','Random exploration','Training on labeled examples','Encrypting a password'],2],
    ];
    await pool.query(
      "INSERT INTO assessment_banks(id,title,academic_year,batch,description,created_by) VALUES($1,'Demo AI Fundamentals',2,'Demo 2026','Example question bank', $2) ON CONFLICT(id) DO NOTHING",
      [bankId,admin.id]
    );
    for(const [id,prompt,options,correct] of sample){
      await pool.query(
        "INSERT INTO assessment_bank_questions(id,bank_id,kind,prompt,options_json,correct_option,points) VALUES($1,$2,'mcq',$3,$4::jsonb,$5,2) ON CONFLICT(id) DO NOTHING",
        [id,bankId,prompt,JSON.stringify(options),correct]
      );
    }
    await pool.query(
      "INSERT INTO assessments(id,title,description,instructions,kind,bank_id,question_count,selected_question_ids,points_mode,total_points,duration_minutes,attempt_limit,eligibility_year,status,created_by) VALUES($1,'Demo AI Fundamentals Quiz','Three demo MCQs','Choose one answer per question','mcq',$2,3,$3::jsonb,'equal',6,15,3,2,'published',$4) ON CONFLICT(id) DO NOTHING",
      [assessmentId,bankId,JSON.stringify(sample.map(x=>x[0])),admin.id]
    );
    for(let position=0;position<sample.length;position++){
      const [id,prompt,options,correct]=sample[position];
      const snapshotId='20000000-0000-4000-8000-'+String(30+position).padStart(12,'0');
      await pool.query(
        "INSERT INTO assessment_questions(id,assessment_id,source_question_id,position,kind,prompt,options_json,correct_option,points) VALUES($1,$2,$3,$4,'mcq',$5,$6::jsonb,$7,2) ON CONFLICT(id) DO NOTHING",
        [snapshotId,assessmentId,id,position,prompt,JSON.stringify(options),correct]
      );
    }
  }finally{await pool.end()}

  console.log('Portable AI Club demo initialized in server/data/portable-demo-postgres.');
  console.log('Admin:   DEMO-ADMIN   / DemoAdmin@2026!');
  console.log('Student: DEMO-STUDENT / DemoStudent@2026!');
  console.log('Website: http://localhost:5175/login');

  const {closePool}=await import('../pg.js');
  appPool=closePool;
  if(!setupOnly) {
    const {createApp}=await import('../app.js');
    const app=createApp();
    httpServer=await new Promise((resolve,reject)=>{
      const server=app.listen(3003,'127.0.0.1',()=>resolve(server));
      server.once('error',reject);
    });
    console.log('Local demo API: http://127.0.0.1:3003');
    vite=spawn(process.execPath,[path.join(root,'node_modules','vite','bin','vite.js'),'--mode','demo'],{
      cwd:root,env:process.env,stdio:'inherit',
    });
    vite.once('error',error=>{console.error('Demo web server failed:',error.message);shutdown(1).catch(console.error)});
    vite.once('exit',code=>{if(!closing)shutdown(code||0).catch(console.error)});
    process.once('SIGINT',()=>shutdown(0).catch(console.error));
    process.once('SIGTERM',()=>shutdown(0).catch(console.error));
    await new Promise(resolve=>vite.once('exit',resolve));
  }
} catch(error) {
  console.error('Portable demo failed:',error.message);
  await shutdown(1);
}
if(setupOnly)await shutdown(process.exitCode||0);
