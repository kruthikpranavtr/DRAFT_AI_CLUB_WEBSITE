import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {loadPostgresMigrations} from '../server/migrations/pg-runner.js';
import {addNotification,notifyCommunityReply} from '../server/notifications.js';

// Self-contained, disposable database: never touches configured external DBs.
test('notification migration delivers broadcast and targeted messages with independent read state',async()=>{
  const db=new PGlite();
  try{
    for(const migration of loadPostgresMigrations())await db.exec(migration.sql);
    const users=['admin','student','other'];
    for(const id of users)await db.query(
      `INSERT INTO users(id,member_id,email,name,password_hash,role)
        VALUES ($1,$2,$3,$4,'sample-hash',$5)`,
      [id,'NOTIF-'+id,id+'@example.invalid',id,id==='admin'?'admin':'student']);
    const broadcast=await addNotification(db,{
      type:'direct_message',title:'Important club update',body:'Meeting tomorrow',actorId:'admin',
    });
    assert.ok(broadcast);
    const unread=async user=>{
      const result=await db.query(`SELECT n.id FROM notification_events n WHERE
        (n.recipient_id IS NULL OR n.recipient_id=$1) AND n.actor_id IS DISTINCT FROM $1
        AND NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.user_id=$1 AND r.event_id=n.id)`,[user]);
      return result.rows.map(row=>row.id);
    };
    assert.deepEqual(await unread('admin'),[],'sender does not receive their own broadcast');
    assert.deepEqual(await unread('student'),[broadcast]);
    assert.deepEqual(await unread('other'),[broadcast]);
    await db.query('INSERT INTO notification_reads(user_id,event_id) VALUES ($1,$2)',['student',broadcast]);
    assert.deepEqual(await unread('student'),[],'read status is personal');
    assert.deepEqual(await unread('other'),[broadcast],'other members remain unread');
    await notifyCommunityReply(db,{
      actorId:'other',authorId:'student',parentAuthorId:'admin',
      actorName:'Other',postId:crypto.randomUUID(),
    });
    const studentNotifications=await db.query("SELECT type FROM notification_events WHERE recipient_id='student'");
    assert.deepEqual(studentNotifications.rows.map(x=>x.type),['community_reply']);
    const adminNotifications=await db.query("SELECT type FROM notification_events WHERE recipient_id='admin'");
    assert.deepEqual(adminNotifications.rows.map(x=>x.type),['community_reply']);
    await assert.rejects(addNotification(db,{type:'direct_message',title:'Unsafe',link:'//evil.example'}),/Invalid notification destination/);
    assert.equal(await addNotification(db,{
      type:'community_reply',title:'Own reply',recipientId:'other',actorId:'other',
    }),null,'no self notification');
    const permissionSource=fs.readFileSync(new URL('../server/routes/notifications.js',import.meta.url),'utf8');
    assert.match(permissionSource,/requireSuperAdmin/);
    assert.match(permissionSource,/WHERE n\.id=\$2 AND/);
    assert.match(permissionSource,/req\.user\.id/);
    const frontend=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
    assert.match(frontend,/path="\/notifications" element=\{<ProtectedRoute>/);
  }finally{await db.close();}
});
