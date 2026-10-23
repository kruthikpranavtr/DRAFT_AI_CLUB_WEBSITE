import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { runMigrations,verifyDatabase } from '../server/migrations/runner.js';
import { backupCommunityInstance,verifyCommunityBackup,privateFilePath } from '../server/community-backup.js';

test('version 6 upgrade preserves accounts, sessions, profiles, CMS and complete assessment records',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-club-community-migration-'));
 const databasePath=path.join(root,'version6.db'),database=new Database(databasePath);
 try{
  database.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT,checksum TEXT,applied_at TEXT)');
  for(const file of fs.readdirSync('server/migrations').filter(f=>/^00[1-6]_.*\.sql$/.test(f)).sort()){
   const sql=fs.readFileSync(path.join('server/migrations',file),'utf8');
   database.pragma('foreign_keys = OFF');database.exec(sql);
   database.prepare('INSERT INTO schema_migrations VALUES(?,?,?,?)').run(Number(file.slice(0,3)),file.slice(4,-4),crypto.createHash('sha256').update(sql).digest('hex'),new Date().toISOString());
  }
  database.pragma('foreign_keys = ON');
  const time=new Date().toISOString();
  database.prepare("INSERT INTO users(id,member_id,email,name,password_hash,role,created_at,updated_at) VALUES('member','QA-LEGACY',NULL,'QA Legacy','hash','student',?,?)").run(time,time);
  database.prepare("INSERT INTO sessions(id,token_hash,user_id,expires_at,created_at) VALUES('session','qa-token-hash','member',?,?)").run(time,time);
  database.prepare("INSERT INTO student_profiles(user_id,department,academic_year,created_at,updated_at) VALUES('member','QA Department',2,?,?)").run(time,time);
  database.prepare("INSERT INTO profile_skills(user_id,skill_name,created_at) VALUES('member','QA Skill',?)").run(time);
  database.prepare("INSERT INTO content_entries(id,type,page_key,section_key,title,created_at,updated_at) VALUES('news','news','news','qa','QA retained article',?,?)").run(time,time);
  database.prepare("INSERT INTO files(id,original_name,stored_name,mime_type,size,storage_key,public_url,kind,created_at,updated_at) VALUES('file','qa.webp','qa.webp','image/webp',1,'qa.webp','','image',?,?)").run(time,time);
  database.prepare("INSERT INTO gallery_categories(id,name,slug,created_at) VALUES('category','QA','qa',?)").run(time);
  database.prepare("INSERT INTO gallery_items(id,title,alt_text,file_id,status,created_at,updated_at) VALUES('gallery','QA gallery','QA alt','file','draft',?,?)").run(time,time);
  database.prepare("INSERT INTO settings(key,value,updated_at) VALUES('qa','true',?)").run(time);
  database.prepare("INSERT INTO assessment_banks(id,title,created_at,updated_at) VALUES('bank','QA bank',?,?)").run(time,time);
  database.prepare("INSERT INTO assessment_bank_questions(id,bank_id,prompt,created_at,updated_at) VALUES('source','bank','QA question',?,?)").run(time,time);
  database.prepare("INSERT INTO assessments(id,title,kind,bank_id,question_count,points_mode,total_points,duration_minutes,status,selected_question_ids,created_at,updated_at) VALUES('exam','QA exam','mcq','bank',1,'equal',1,20,'published',?,?,?)").run(JSON.stringify(['source']),time,time);
  database.exec("INSERT INTO assessment_questions(id,assessment_id,source_question_id,position,kind,prompt,points) VALUES('question','exam','source',0,'mcq','QA snapshot',1)");
  database.prepare("INSERT INTO assessment_attempts(id,assessment_id,student_id,attempt_number,started_at,expires_at,status,score) VALUES('attempt','exam','member',1,?,?,'submitted',1)").run(time,time);
  database.prepare("INSERT INTO assessment_answers(attempt_id,question_id,selected_option,awarded_points,updated_at) VALUES('attempt','question',0,1,?)").run(time);
  database.prepare("INSERT INTO activity_logs(id,actor_id,action,entity_type,created_at) VALUES('log','member','qa','qa',?)").run(time);
  const names=database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'schema_migrations' ORDER BY name").all().map(r=>r.name);
  const before=Object.fromEntries(names.map(name=>[name,database.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all()]));
  const report=runMigrations(database,{databasePath,backupDir:path.join(root,'backups')});
  assert.deepEqual(report.applied.map(item=>item.version),[7,8,9]);
  assert.equal(report.backup.verified,true);
  for(const name of names)assert.deepEqual(database.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all(),before[name],name+' unchanged');
  assert.equal(verifyDatabase(database).integrity,'ok');
  assert.deepEqual(runMigrations(database,{databasePath,backupDir:path.join(root,'backups')}).applied,[]);
  database.close();
  const uploadDir=path.join(root,'uploads');fs.mkdirSync(uploadDir);
  fs.writeFileSync(path.join(uploadDir,'qa.webp'),Buffer.from([0]));
  const mediaDatabase=new Database(databasePath);
  const image=await sharp({create:{width:20,height:20,channels:3,background:'#5049e7'}}).webp().toBuffer();
  fs.writeFileSync(path.join(uploadDir,'fixture.webp'),image);
  mediaDatabase.prepare("INSERT INTO community_media(id,owner_id,size,width,height,created_at,expires_at) VALUES('media','member',?,20,20,?,?)").run(image.length,time,time);
  mediaDatabase.prepare("INSERT INTO community_media_variants(media_id,variant,storage_key,mime_type,size) VALUES('media','image','fixture.webp','image/webp',?)").run(image.length);
  mediaDatabase.close();
  const full=backupCommunityInstance({databasePath,uploadDir,backupDir:path.join(root,'full-backup')});
  assert.equal(verifyCommunityBackup(full.manifestPath).mediaCount,2);
  // A restore drill uses a separate destination; the original is never replaced.
  const restoredPath=path.join(root,'restored.db');fs.copyFileSync(full.backupPath,restoredPath);
  const restored=new Database(restoredPath,{readonly:true});
  assert.equal(restored.prepare('SELECT count(*) count FROM assessment_answers').get().count,1);restored.close();
  const restoredUploads=path.join(root,'restored-uploads');fs.cpSync(full.mediaDir,restoredUploads,{recursive:true});
  assert.deepEqual(fs.readFileSync(path.join(restoredUploads,'fixture.webp')),image);
  fs.writeFileSync(path.join(full.mediaDir,'fixture.webp'),'corrupt');
  assert.throws(()=>verifyCommunityBackup(full.manifestPath),/checksum/);
  assert.throws(()=>privateFilePath(uploadDir,'../outside.webp'),/Unsafe/);
 }finally{if(database.open)database.close();fs.rmSync(root,{recursive:true,force:true});}
});
