import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { runMigrations,verifyDatabase } from '../server/migrations/runner.js';

const migrationDir = path.resolve('server','migrations');

test('media scope migration preserves rows and quarantines a legacy avatar gallery link',() => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'ai-club-media-migration-'));
  const databasePath = path.join(root,'legacy.db');
  const database = new Database(databasePath);
  try {
    database.pragma('foreign_keys = ON');
    database.exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY,name TEXT,checksum TEXT,applied_at TEXT)');
    for (const file of fs.readdirSync(migrationDir).filter(file => /^00[1-4]_.*\.sql$/.test(file)).sort()) {
      const sql = fs.readFileSync(path.join(migrationDir,file),'utf8');
      database.exec(sql);
      database.prepare('INSERT INTO schema_migrations VALUES (?,?,?,?)').run(
        Number(file.slice(0,3)),file.slice(4,-4),crypto.createHash('sha256').update(sql).digest('hex'),new Date().toISOString()
      );
    }
    const time = new Date().toISOString();
    database.prepare(`INSERT INTO users (id,member_id,name,password_hash,role,created_at,updated_at)
      VALUES ('student','DEMO-LEGACY','Legacy Student','hash','student',?,?)`).run(time,time);
    database.prepare(`INSERT INTO files (id,original_name,stored_name,mime_type,size,storage_key,public_url,kind,is_public,created_at,updated_at)
      VALUES ('avatar','avatar.png','avatar.png','image/png',100,'avatar.png','/api/members/media/avatar','image',1,?,?)`).run(time,time);
    database.prepare('INSERT INTO student_profiles (user_id,avatar_file_id,created_at,updated_at) VALUES (?,?,?,?)').run('student','avatar',time,time);
    database.prepare(`INSERT INTO gallery_items (id,title,alt_text,file_id,status,created_at,updated_at)
      VALUES ('gallery','Legacy link','Description','avatar','published',?,?)`).run(time,time);
    const report = runMigrations(database,{ databasePath,backupDir:path.join(root,'backups') });
    assert.deepEqual(report.applied.map(item => item.version),[5,6]);
    assert.equal(report.backup.verified,true);
    assert.deepEqual(database.prepare('SELECT purpose,is_public FROM files WHERE id=?').get('avatar'),{ purpose:'profile-avatar',is_public:0 });
    assert.deepEqual(database.prepare('SELECT file_id,status FROM gallery_items WHERE id=?').get('gallery'),{ file_id:null,status:'hidden' });
    assert.equal(database.prepare('SELECT avatar_file_id FROM student_profiles').get().avatar_file_id,'avatar');
    assert.equal(verifyDatabase(database).integrity,'ok');
  } finally { database.close(); fs.rmSync(root,{ recursive:true,force:true }); }
});

test('legacy data is backed up, restored, and migrated without row loss',() => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'ai-club-migration-'));
  const databasePath = path.join(root,'legacy.db');
  const backupDir = path.join(root,'backups');
  const database = new Database(databasePath);
  try {
    database.pragma('foreign_keys = ON');
    database.exec(fs.readFileSync(path.join(migrationDir,'001_initial_schema.sql'),'utf8'));
    const now = new Date().toISOString();
    const insertUser = database.prepare(`INSERT INTO users
      (id,member_id,email,name,password_hash,role,status,permissions,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    insertUser.run('admin-id','ADMIN-01','admin@srishakthi.ac.in','Club Administrator','hash','admin','active','["cms:*"]',now,now);
    insertUser.run('student-id','25AM087','student@example.edu','Student','hash','student','active','[]',now,now);
    database.prepare(`INSERT INTO content_entries
      (id,type,page_key,section_key,title,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)`).run('content-id','news','news','one','Existing content',now,now);

    const report = runMigrations(database,{ databasePath,backupDir });
    assert.deepEqual(report.applied.map(item => item.version),[1,2,3,4,5,6]);
    assert.equal(report.backup?.verified,true);
    assert.equal(fs.existsSync(report.backup.backupPath),true);
    assert.equal(database.prepare('SELECT count(*) count FROM users').get().count,2);
    assert.equal(database.prepare('SELECT count(*) count FROM content_entries').get().count,1);
    assert.equal(database.prepare('SELECT count(*) count FROM schema_migrations').get().count,6);
    assert.equal(database.prepare('SELECT count(*) count FROM student_profiles').get().count,1);
    assert.ok(JSON.parse(database.prepare(`SELECT permissions FROM users WHERE member_id='ADMIN-01'`).get().permissions)
      .includes('platform:super-admin'));

    database.prepare(`INSERT INTO users
      (id,member_id,email,name,password_hash,role,status,permissions,must_change_password,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run('no-email-student','25AM088',null,'No Email Student','hash','student','active','[]',1,now,now);
    assert.throws(() => database.prepare(`INSERT INTO users
      (id,member_id,email,name,password_hash,role,status,permissions,must_change_password,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run('no-email-admin','ADMIN-02',null,'No Email Admin','hash','admin','active','[]',1,now,now));

    assert.deepEqual(verifyDatabase(database).integrity,'ok');
    const second = runMigrations(database,{ databasePath,backupDir });
    assert.deepEqual(second.applied,[]);
    assert.equal(second.backup,null);
    database.prepare(`UPDATE schema_migrations SET checksum='tampered' WHERE version=1`).run();
    assert.throws(() => runMigrations(database,{ databasePath,backupDir }),/checksum or name/);
  } finally {
    database.close();
    fs.rmSync(root,{ recursive:true,force:true });
  }
});

test('a blank database migrates to the current schema without requiring a backup',() => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'ai-club-blank-migration-'));
  const databasePath = path.join(root,'blank.db');
  const database = new Database(databasePath);
  try {
    database.pragma('foreign_keys = ON');
    const report = runMigrations(database,{ databasePath,backupDir:path.join(root,'backups') });
    assert.deepEqual(report.applied.map(item => item.version),[1,2,3,4,5,6]);
    assert.equal(report.backup,null);
    assert.equal(database.prepare('SELECT count(*) count FROM schema_migrations').get().count,6);
    assert.equal(verifyDatabase(database).integrity,'ok');
  } finally {
    database.close();
    fs.rmSync(root,{ recursive:true,force:true });
  }
});
