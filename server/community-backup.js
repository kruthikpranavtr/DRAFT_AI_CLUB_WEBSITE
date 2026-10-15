// Operator utility for a stopped, isolated local instance. No application/db.js import.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { createVerifiedBackup,verifyDatabase } from './migrations/runner.js';
const digest=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
export function privateFilePath(root,key){
  const target=path.resolve(root,key),relative=path.relative(path.resolve(root),target);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Unsafe private media path.');
  return target;
}
export function backupCommunityInstance({databasePath,uploadDir,backupDir}){
  const database=new Database(databasePath,{readonly:true,fileMustExist:true});
  let report;
  try{report=createVerifiedBackup(database,databasePath,backupDir);}finally{database.close();}
  const snapshot=new Database(report.backupPath,{readonly:true,fileMustExist:true});
  try{
    const keys=snapshot.prepare(`SELECT storage_key,size FROM files
      UNION SELECT storage_key,size FROM community_media_variants ORDER BY storage_key`).all();
    const mediaDir=report.backupPath+'.media';fs.mkdirSync(mediaDir,{recursive:true});
    const media=keys.map(row=>{
      const source=privateFilePath(uploadDir,row.storage_key);
      const bytes=fs.readFileSync(source);
      if(bytes.length!==row.size)throw new Error('A private image differs from its database record.');
      const destination=privateFilePath(mediaDir,row.storage_key);
      fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes,{flag:'wx'});
      return {key:row.storage_key,size:bytes.length,sha256:digest(bytes)};
    });
    const manifest={database:path.basename(report.backupPath),databaseSha256:digest(fs.readFileSync(report.backupPath)),media,
      schemaVersion:snapshot.prepare('SELECT max(version) version FROM schema_migrations').get().version};
    const manifestPath=report.backupPath+'.manifest.json';
    fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2),{flag:'wx'});
    return {...report,manifestPath,mediaDir,mediaCount:media.length};
  }finally{snapshot.close();}
}
export function verifyCommunityBackup(manifestPath){
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const databasePath=privateFilePath(path.dirname(manifestPath),manifest.database);
  if(digest(fs.readFileSync(databasePath))!==manifest.databaseSha256)throw new Error('Database backup checksum mismatch.');
  const mediaDir=databasePath+'.media';
  for(const file of manifest.media){
    const bytes=fs.readFileSync(privateFilePath(mediaDir,file.key));
    if(bytes.length!==file.size||digest(bytes)!==file.sha256)throw new Error('Image backup checksum mismatch.');
  }
  const database=new Database(databasePath,{readonly:true,fileMustExist:true});
  try{return {...verifyDatabase(database),mediaCount:manifest.media.length};}finally{database.close();}
}
