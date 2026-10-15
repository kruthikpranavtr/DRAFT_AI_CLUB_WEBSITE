// Standalone, localhost-only synthetic preview. Never imports server/index.js or a user's .env.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createServer } from 'vite';
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
process.chdir(projectRoot);
if(process.env.NODE_ENV==='production')throw new Error('QA preview is forbidden in production.');
const dataRoot=path.join(projectRoot,'.phase2-data','preview');
Object.assign(process.env,{NODE_ENV:'test',DATABASE_PATH:path.join(dataRoot,'preview.db'),DATA_DIR:dataRoot,
 UPLOAD_DIR:path.join(dataRoot,'uploads'),MIGRATION_BACKUP_DIR:path.join(dataRoot,'backups'),
 ALLOWED_ORIGINS:'http://127.0.0.1:5182,http://localhost:5182'});
for(const key of ['S3_ENDPOINT','S3_BUCKET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY'])delete process.env[key];
const [{db,now},{hashPassword},{createApp},{setAttachments},{storeUpload},{cleanupStagedMedia}]=await Promise.all([
 import('../db.js'),import('../passwords.js'),import('../app.js'),import('../community.js'),import('../storage.js'),import('../community-media.js')
]);
const marker=db.prepare("SELECT value FROM settings WHERE key='phase2.qa.preview'").get();
const count=db.prepare('SELECT count(*) count FROM users').get().count;
if(!marker&&count)throw new Error('Refusing to seed an unrecognized database.');
if(!marker){
 const password='Community-QA-2026!';
 for(const [id,member,name,role,permissions] of [
  ['qa-admin','QA-ADMIN','QA Administrator','admin',['platform:super-admin']],
  ['qa-moderator','QA-MODERATOR','QA Moderator','admin',['community:moderate']],
  ['qa-admin-limited','QA-ADMIN-LIMITED','QA Limited Admin','admin',[]],
  ['qa-student','QA-STUDENT','QA Student','student',[]],['qa-peer','QA-PEER','QA Peer','student',[]],
 ]){
  db.prepare('INSERT INTO users(id,member_id,email,name,password_hash,role,status,permissions,must_change_password,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
   .run(id,member,id+'@preview.invalid',name,await hashPassword(password),role,'active',JSON.stringify(permissions),0,now(),now());
  if(role==='student')db.prepare("INSERT INTO student_profiles(user_id,department,academic_year,description,created_at,updated_at) VALUES(?,'QA Department',2,'Synthetic profile for isolated testing.',?,?)").run(id,now(),now());
 }
 const addPost=(author,title,body,tag,pinned=false,minutes=0)=>{
  const id=crypto.randomUUID(),time=new Date(Date.now()-minutes*60000).toISOString();
  db.prepare('INSERT INTO community_posts(id,author_id,title,body,tag,is_pinned,pinned_by,pinned_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
   .run(id,author,title,body,tag,pinned?1:0,pinned?'qa-admin':null,pinned?time:null,time,time);return id;
 };
 addPost('qa-admin','QA DEMO · Welcome to the member workspace','This is an isolated demonstration using synthetic accounts and content. Try a post, add an image, or explore the discussion. Real club accounts and data are separate.','Announcements',true,90);
 const project=addPost('qa-student','QA DEMO · A small vision experiment, from notebook to prototype','I put together a small image-classification prototype to explore how model choices affect results.\n\nWhat would you measure first: accuracy, latency, or how the model behaves on unfamiliar examples? These images are generated QA fixtures.','Projects',false,65);
 for(const [index,color] of [[0,'#5550aa'],[1,'#24697b']]){
  const svg=Buffer.from(`<svg width="1200" height="680" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="680" fill="${color}"/><circle cx="1000" cy="140" r="270" fill="#ffffff" opacity=".07"/><circle cx="940" cy="290" r="170" fill="none" stroke="#ffffff" opacity=".22" stroke-width="2"/><path d="M740 530L890 200L1070 420L740 530" fill="none" stroke="#ffffff" stroke-width="3" opacity=".35"/><text x="78" y="130" font-family="sans-serif" font-size="20" letter-spacing="5" fill="#ffffff">ISOLATED QA DEMO / ${index+1}</text><text x="78" y="320" font-family="sans-serif" font-size="72" font-weight="bold" fill="#ffffff">${index===0?'From idea':'Test. Learn.'}</text><text x="78" y="410" font-family="sans-serif" font-size="72" font-weight="bold" fill="#ffffff">${index===0?'to experiment.':'Build again.'}</text><text x="78" y="570" font-family="sans-serif" font-size="24" fill="#ffffff" opacity=".75">Synthetic image · no real student data</text></svg>`);
  const image=await sharp(svg).webp().toBuffer(),thumbnail=await sharp(image).resize(640).webp().toBuffer(),id=crypto.randomUUID();
  db.prepare("INSERT INTO community_media(id,owner_id,size,width,height,created_at,expires_at) VALUES(?,'qa-student',?,1200,680,?,?)").run(id,image.length+thumbnail.length,now(),new Date(Date.now()+86400000).toISOString());
  for(const [variant,buffer] of [['image',image],['thumbnail',thumbnail]]){
   const stored=await storeUpload({buffer,mimetype:'image/webp',originalname:'qa-synthetic.webp'},{prefix:'community-private',extension:'.webp'});
   db.prepare("INSERT INTO community_media_variants(media_id,variant,storage_key,mime_type,size) VALUES(?,?,?,'image/webp',?)").run(id,variant,stored.storageKey,buffer.length);
  }
  const attached=db.prepare('SELECT media_id FROM community_post_attachments WHERE post_id=? ORDER BY sort_order').all(project).map(a=>({id:a.media_id,description:'Synthetic QA project illustration'}));
  db.transaction(()=>setAttachments(project,'qa-student',[...attached,{id,description:'Synthetic QA project illustration'}])).immediate();
 }
 const rootComment=crypto.randomUUID(),reply=crypto.randomUUID();
 for(const [id,parent,depth,author,body] of [
  [rootComment,null,0,'qa-peer','QA DEMO · I would start with a small validation set that includes unusual inputs.'],
  [reply,rootComment,1,'qa-student','QA DEMO · Good point. I am adding a few edge cases next.'],
  [crypto.randomUUID(),reply,2,'qa-admin','QA DEMO · Keep the evaluation reproducible and document the assumptions.'],
 ]){
  db.prepare('INSERT INTO community_comments(id,post_id,parent_id,depth,author_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id,project,parent,depth,author,body,now(),now());
 }
 db.prepare("INSERT INTO community_post_votes(user_id,post_id,value) VALUES('qa-peer',?,1)").run(project);
 addPost('qa-peer','QA DEMO · How do you evaluate a retrieval pipeline?','I am comparing a few retrieval approaches for a small documentation assistant. How do you separate retrieval quality from answer quality? Looking for practical evaluation ideas.','Help',false,110);
 addPost('qa-admin','QA DEMO · Share one useful paper or tool','What changed the way you think about a project this week? Share a link with a short explanation of why it helped.','AI',false,180);
 // Assessment fixtures only: enough data to verify Select All Questions and the 200-question guard.
 for(const [bank,count] of [['qa-bank',3],['qa-large-bank',201]]){
  db.prepare('INSERT INTO assessment_banks(id,title,academic_year,batch,description,created_by,created_at,updated_at) VALUES(?,?,2,?,?,?,?,?)')
   .run(bank,bank==='qa-bank'?'QA Fundamentals Bank':'QA Large Bank (201 questions)','QA 2026','Synthetic regression fixture','qa-admin',now(),now());
  const insert=db.prepare("INSERT INTO assessment_bank_questions(id,bank_id,kind,prompt,options_json,correct_option,points,created_at,updated_at) VALUES(?,?,'mcq',?,?,0,1,?,?)");
  db.transaction(()=>{for(let i=0;i<count;i++)insert.run(crypto.randomUUID(),bank,'QA question '+(i+1),JSON.stringify(['Correct choice','Choice B','Choice C','Choice D']),now(),now());})();
 }
 db.prepare("INSERT INTO settings(key,value,is_public,updated_at) VALUES('phase2.qa.preview','true',0,?)").run(now());
}
const app=createApp(),apiServer=app.listen(3012,'127.0.0.1');
await new Promise((resolve,reject)=>{apiServer.once('listening',resolve);apiServer.once('error',reject);});
const vite=await createServer({configFile:'vite.config.js',mode:'development',
 define:{'import.meta.env.VITE_PHASE2_PREVIEW':'true'},
 server:{host:'127.0.0.1',port:5182,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:3012',changeOrigin:false}}}});
await vite.listen();
const cleanup=setInterval(()=>cleanupStagedMedia().catch(error=>console.error(error.message)),15*60000);cleanup.unref();
console.log('Isolated Phase 2 QA preview: http://127.0.0.1:5182/login');
console.log('Synthetic logins: QA-ADMIN / QA-MODERATOR / QA-ADMIN-LIMITED / QA-STUDENT / QA-PEER');
console.log('Local QA password: Community-QA-2026! (never deploy this preview).');
async function stop(){clearInterval(cleanup);await vite.close();await new Promise(resolve=>apiServer.close(resolve));db.close();process.exit(0);}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
