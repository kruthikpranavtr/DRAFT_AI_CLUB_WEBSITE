// Isolated manual browser verification. Never touches the normal experimental database.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ai-club-assessment-ui-'));
process.env.NODE_ENV='test';
process.env.DATABASE_PATH=path.join(temporary,'qa.db');
process.env.MIGRATION_BACKUP_DIR=path.join(temporary,'backups');
process.env.ALLOWED_ORIGINS='http://127.0.0.1:5176,http://localhost:5176';
const { db,now }=await import('../db.js');
const { hashPassword }=await import('../passwords.js');
const { createApp }=await import('../app.js');
const { PERMISSIONS }=await import('../permissions.js');
const password='Assessment-UI-QA-42!';
const time=now();
for (const [id,member,email,role,permissions] of [
  ['qa-admin','ADMIN-QA','admin@qa.test','admin',[PERMISSIONS.SUPER_ADMIN]],
  ['qa-student','25AIQA001','student@qa.test','student',[]],
]) {
  db.prepare('INSERT INTO users (id,member_id,email,name,password_hash,role,status,permissions,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id,member,email,role==='admin'?'QA Administrator':'QA Student',await hashPassword(password),role,'active',JSON.stringify(permissions),0,time,time);
}
db.prepare('INSERT INTO student_profiles (user_id,academic_year,created_at,updated_at) VALUES (?,?,?,?)')
  .run('qa-student',2,time,time);
db.prepare('INSERT INTO assessment_banks (id,title,academic_year,batch,description,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
  .run('qa-bank','AI Fundamentals Bank',2,'2025-2029','Browser QA bank','qa-admin',time,time);
db.prepare('INSERT INTO assessments (id,title,description,instructions,kind,bank_id,question_count,allow_backward,points_mode,total_points,duration_minutes,attempt_limit,eligibility_year,status,created_at,updated_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  .run('qa-assessment','AI Fundamentals — Practice','Test your understanding of foundational concepts.','Choose one answer for every question.','mcq','qa-bank',2,0,'equal',4,30,1,2,'published',time,time,'qa-admin');
for (const [id,prompt,opts,answer,position] of [
  ['qa-question-1','What does AI stand for?',['Artificial Intelligence','Advanced Internet','Applied Input','Automatic Interface'],0,0],
  ['qa-question-2','Which language is commonly used in machine learning?',['HTML','CSS','Python','SQL'],2,1],
]) {
  db.prepare('INSERT INTO assessment_bank_questions (id,bank_id,kind,prompt,options_json,correct_option,points,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id,'qa-bank','mcq',prompt,JSON.stringify(opts),answer,2,time,time);
  db.prepare('INSERT INTO assessment_questions (id,assessment_id,source_question_id,position,kind,prompt,options_json,correct_option,points) VALUES (?,?,?,?,?,?,?,?,?)')
    .run('snap-'+id,'qa-assessment',id,position,'mcq',prompt,JSON.stringify(opts),answer,2);
}
const output=path.resolve('docs','phase4-assessment-evidence');
fs.mkdirSync(output,{recursive:true});
let apiServer,vite,browser;
const issues=[];
try {
  apiServer=createApp().listen(0,'127.0.0.1');
  await new Promise(resolve=>apiServer.once('listening',resolve));
  const apiUrl='http://127.0.0.1:'+apiServer.address().port;
  vite=await createServer({ configFile:'vite.config.js',mode:'development',server:{
    host:'127.0.0.1',port:5176,strictPort:true,
    proxy:{'/api':{target:apiUrl,changeOrigin:false}}
  }});
  await vite.listen();
  browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  let expectedSessionChecks=0;
  page.on('pageerror',e=>issues.push('PAGE: '+e.message));
  page.on('response',response=>{
    if(response.status()===401 && new URL(response.url()).pathname==='/api/auth/me') expectedSessionChecks++;
    else if(response.status()>=400) issues.push('HTTP '+response.status()+': '+response.url());
  });
  page.on('console',msg=>{if(msg.type()==='error'&&!msg.text().includes('status of 401 (Unauthorized)'))issues.push('CONSOLE: '+msg.text());});
  const base='http://127.0.0.1:5176';
  async function login(identifier) {
    await page.goto(base+'/login');
    await page.getByLabel('Roll number, admin ID, or email').fill(identifier);
    await page.getByLabel('Password',{exact:true}).fill(password);
    await page.getByRole('button',{name:/Sign in/i}).click();
  }
  async function shot(name,width) {
    await page.setViewportSize({width,height:900});
    await page.waitForTimeout(250);
    const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
    if (overflow.scroll>overflow.viewport+1) issues.push('OVERFLOW '+name+': '+JSON.stringify(overflow));
    await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
    console.log(name+': '+JSON.stringify(overflow));
  }
  await login('ADMIN-QA');
  await page.waitForURL('**/admin/dashboard');
  await page.goto(base+'/admin/assessments');
  await page.getByRole('heading',{name:'Assessments.'}).waitFor();
  await page.getByText('AI Fundamentals — Practice').waitFor();
  await shot('admin-assessments-1440',1440);
  await shot('admin-assessments-390',390);
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('tab',{name:'Question banks'}).click();
  await page.getByText('AI Fundamentals Bank').first().click();
  await page.getByText('What does AI stand for?').first().waitFor();
  await shot('admin-question-bank-1440',1440);
  await page.getByRole('tab',{name:'Create assessment'}).click();
  await page.getByText('Core assessment settings').waitFor();
  await shot('admin-create-assessment-1440',1440);
  await shot('admin-create-assessment-390',390);
  await page.setViewportSize({width:1440,height:900});
  await page.goto(base+'/admin/dashboard');
  await page.getByRole('heading',{name:'Club operations.'}).waitFor();
  await page.getByRole('button',{name:'Sign out'}).click();
  await page.waitForURL('**/login');
  await login('25AIQA001');
  await page.waitForURL('**/student/dashboard');
  await page.goto(base+'/student/assessments');
  await page.getByText('AI Fundamentals — Practice').waitFor();
  await shot('student-assessments-1440',1440);
  await shot('student-assessments-390',390);
  await page.getByRole('button',{name:'Start assessment'}).click();
  await page.waitForURL('**/student/assessments/attempt/**');
  await page.getByText('What does AI stand for?').waitFor();
  await shot('student-attempt-390',390);
  await page.getByText('Artificial Intelligence').click();
  await page.getByRole('button',{name:/Next/}).click();
  await page.getByText('Which language is commonly used in machine learning?').waitFor();
  await shot('student-attempt-question2-390',390);
  await page.getByText('Python').click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Submit assessment'}).click();
  await page.getByRole('heading',{name:'Assessment submitted.'}).waitFor();
  await shot('student-submitted-390',390);
  await context.close();
  console.log('BROWSER QA COMPLETE. Unexpected errors: '+issues.length+'; expected logged-out session checks: '+expectedSessionChecks);
  if (issues.length) throw new Error(issues.join('\n'));
} finally {
  await browser?.close();
  await vite?.close();
  if (apiServer) await new Promise(resolve=>apiServer.close(resolve));
  db.close();
  fs.rmSync(temporary,{recursive:true,force:true});
}
