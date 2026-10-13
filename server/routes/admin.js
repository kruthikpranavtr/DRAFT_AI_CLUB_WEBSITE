import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { db, now, json, audit } from '../db.js';
import { requireAdmin, hashPassword } from '../auth.js';
import { categorySchema, contentSchema, gallerySchema, settingSchema, userSchema } from '../validation.js';
import { classifyMime, deleteStoredFile, sendStoredFile, storeUpload, storageMode } from '../storage.js';

const router = Router();
router.use(requireAdmin);

const allowedMime = new Set([
  'image/jpeg','image/png','image/webp','image/gif','image/avif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain','text/csv',
  'video/mp4','video/webm',
]);
const upload = multer({
  storage:multer.memoryStorage(),
  limits:{ fileSize:Number(process.env.MAX_UPLOAD_BYTES || 100 * 1024 * 1024), files:1 },
  fileFilter(req, file, callback) {
    callback(allowedMime.has(file.mimetype) ? null : new Error('Unsupported file type.'), allowedMime.has(file.mimetype));
  },
});

router.get('/overview', (req, res) => {
  const scalar = sql => db.prepare(sql).pluck().get();
  const recent = db.prepare(`SELECT a.*,u.name actor_name FROM activity_logs a
    LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 12`).all();
  res.json({
    stats:{
      students:scalar(`SELECT count(*) FROM users WHERE role='student'`),
      files:scalar('SELECT count(*) FROM files'),
      gallery:scalar('SELECT count(*) FROM gallery_items'),
      published:scalar(`SELECT count(*) FROM content_entries WHERE status='published'`),
      drafts:scalar(`SELECT count(*) FROM content_entries WHERE status='draft'`),
    },
    recent:recent.map(row => ({ ...row, details:json(row.details,{}) })),
    storageMode,
  });
});

router.get('/activities', (req, res) => {
  const items = db.prepare(`SELECT a.*,u.name actor_name FROM activity_logs a
    LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100`).all();
  res.json({ items:items.map(row => ({ ...row, details:json(row.details,{}) })) });
});

router.get('/content', (req, res) => {
  const items = db.prepare(`SELECT c.*,u.name updated_by_name FROM content_entries c
    LEFT JOIN users u ON u.id=c.updated_by ORDER BY c.page_key,c.sort_order,c.updated_at DESC`).all();
  res.json({ items:items.map(row => ({ ...row, payload:json(row.payload,{}) })) });
});

router.post('/content', (req, res, next) => {
  try {
    const input = contentSchema.parse(req.body);
    const id = crypto.randomUUID();
    const time = now();
    const publishedAt = input.status === 'published' ? time : null;
    db.prepare(`INSERT INTO content_entries
      (id,type,page_key,section_key,title,excerpt,body,payload,status,sort_order,published_at,created_at,updated_at,updated_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id,input.type,input.pageKey,input.sectionKey,input.title,input.excerpt,input.body,
      JSON.stringify(input.payload),input.status,input.sortOrder,publishedAt,time,time,req.user.id
    );
    audit(req.user.id,'content.created','content',id,{ title:input.title,status:input.status });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});

router.put('/content/:id', (req, res, next) => {
  try {
    const input = contentSchema.parse(req.body);
    const existing = db.prepare('SELECT * FROM content_entries WHERE id=?').get(req.params.id);
    if (!existing) return res.status(404).json({ error:'Content entry not found.' });
    const publishedAt = input.status === 'published' ? (existing.published_at || now()) : existing.published_at;
    db.prepare(`UPDATE content_entries SET type=?,page_key=?,section_key=?,title=?,excerpt=?,body=?,
      payload=?,status=?,sort_order=?,published_at=?,updated_at=?,updated_by=? WHERE id=?`).run(
      input.type,input.pageKey,input.sectionKey,input.title,input.excerpt,input.body,
      JSON.stringify(input.payload),input.status,input.sortOrder,publishedAt,now(),req.user.id,req.params.id
    );
    audit(req.user.id,'content.updated','content',req.params.id,{ title:input.title,status:input.status });
    res.json({ ok:true });
  } catch (error) { next(error); }
});

router.delete('/content/:id', (req, res) => {
  const existing = db.prepare('SELECT title FROM content_entries WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error:'Content entry not found.' });
  db.prepare('DELETE FROM content_entries WHERE id=?').run(req.params.id);
  audit(req.user.id,'content.deleted','content',req.params.id,{ title:existing.title });
  res.status(204).end();
});

router.get('/categories', (req, res) => {
  res.json({ items:db.prepare(`SELECT c.*,count(g.id) item_count FROM gallery_categories c
    LEFT JOIN gallery_items g ON g.category_id=c.id GROUP BY c.id ORDER BY c.name`).all() });
});

router.post('/categories', (req, res, next) => {
  try {
    const input = categorySchema.parse(req.body);
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO gallery_categories (id,name,slug,description,created_at) VALUES (?,?,?,?,?)')
      .run(id,input.name,input.slug,input.description,now());
    audit(req.user.id,'category.created','gallery-category',id,{ name:input.name });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});

router.put('/categories/:id', (req, res, next) => {
  try {
    const input = categorySchema.parse(req.body);
    const result = db.prepare('UPDATE gallery_categories SET name=?,slug=?,description=? WHERE id=?')
      .run(input.name,input.slug,input.description,req.params.id);
    if (!result.changes) return res.status(404).json({ error:'Category not found.' });
    audit(req.user.id,'category.updated','gallery-category',req.params.id,{ name:input.name });
    res.json({ ok:true });
  } catch (error) { next(error); }
});

router.delete('/categories/:id', (req, res) => {
  const result = db.prepare('DELETE FROM gallery_categories WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error:'Category not found.' });
  audit(req.user.id,'category.deleted','gallery-category',req.params.id);
  res.status(204).end();
});

router.get('/gallery', (req, res) => {
  const items = db.prepare(`SELECT g.*,c.name category_name,f.public_url,f.original_name,f.mime_type
    FROM gallery_items g LEFT JOIN gallery_categories c ON c.id=g.category_id
    LEFT JOIN files f ON f.id=g.file_id ORDER BY g.sort_order,g.updated_at DESC`).all();
  res.json({ items });
});

router.post('/gallery', (req, res, next) => {
  try {
    const input = gallerySchema.parse(req.body);
    const file = db.prepare('SELECT id,kind FROM files WHERE id=?').get(input.fileId);
    if (!file || file.kind !== 'image') return res.status(400).json({ error:'Select a valid uploaded image.' });
    const id = crypto.randomUUID();
    const time = now();
    db.prepare(`INSERT INTO gallery_items
      (id,category_id,title,caption,alt_text,file_id,status,sort_order,created_at,updated_at,updated_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id,input.categoryId || null,input.title,input.caption,input.altText,input.fileId,input.status,input.sortOrder,time,time,req.user.id
    );
    if (input.status === 'published') db.prepare('UPDATE files SET is_public=1 WHERE id=?').run(input.fileId);
    audit(req.user.id,'gallery.created','gallery',id,{ title:input.title,status:input.status });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});

router.put('/gallery/:id', (req, res, next) => {
  try {
    const input = gallerySchema.parse(req.body);
    const result = db.prepare(`UPDATE gallery_items SET category_id=?,title=?,caption=?,alt_text=?,
      file_id=?,status=?,sort_order=?,updated_at=?,updated_by=? WHERE id=?`).run(
      input.categoryId || null,input.title,input.caption,input.altText,input.fileId,input.status,input.sortOrder,now(),req.user.id,req.params.id
    );
    if (!result.changes) return res.status(404).json({ error:'Gallery item not found.' });
    if (input.status === 'published') db.prepare('UPDATE files SET is_public=1 WHERE id=?').run(input.fileId);
    audit(req.user.id,'gallery.updated','gallery',req.params.id,{ title:input.title,status:input.status });
    res.json({ ok:true });
  } catch (error) { next(error); }
});

router.delete('/gallery/:id', (req, res) => {
  const result = db.prepare('DELETE FROM gallery_items WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error:'Gallery item not found.' });
  audit(req.user.id,'gallery.deleted','gallery',req.params.id);
  res.status(204).end();
});

router.get('/files', (req, res) => {
  const items = db.prepare(`SELECT f.*,u.name uploaded_by_name FROM files f
    LEFT JOIN users u ON u.id=f.uploaded_by ORDER BY f.created_at DESC`).all();
  res.json({ items });
});

router.post('/files', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error:'Choose a file to upload.' });
    const saved = await storeUpload(req.file);
    const id = crypto.randomUUID();
    const time = now();
    const publicUrl = `/api/public/files/${id}`;
    db.prepare(`INSERT INTO files
      (id,original_name,stored_name,mime_type,size,storage_key,public_url,kind,is_public,created_at,updated_at,uploaded_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id,req.file.originalname,saved.storedName,req.file.mimetype,req.file.size,saved.storageKey,
      publicUrl,classifyMime(req.file.mimetype),0,time,time,req.user.id
    );
    audit(req.user.id,'file.uploaded','file',id,{ name:req.file.originalname,size:req.file.size });
    res.status(201).json({ id,publicUrl });
  } catch (error) { next(error); }
});

router.get('/files/:id/download', async (req, res, next) => {
  try {
    const record = db.prepare('SELECT * FROM files WHERE id=?').get(req.params.id);
    if (!record) return res.status(404).json({ error:'File not found.' });
    await sendStoredFile(record,res,'attachment');
  } catch (error) { next(error); }
});

router.put('/files/:id', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error:'Choose a replacement file.' });
    const existing = db.prepare('SELECT * FROM files WHERE id=?').get(req.params.id);
    if (!existing) return res.status(404).json({ error:'File not found.' });
    const saved = await storeUpload(req.file);
    await deleteStoredFile(existing);
    db.prepare(`UPDATE files SET original_name=?,stored_name=?,mime_type=?,size=?,storage_key=?,
      kind=?,updated_at=? WHERE id=?`).run(
      req.file.originalname,saved.storedName,req.file.mimetype,req.file.size,saved.storageKey,
      classifyMime(req.file.mimetype),now(),req.params.id
    );
    audit(req.user.id,'file.replaced','file',req.params.id,{ name:req.file.originalname });
    res.json({ ok:true });
  } catch (error) { next(error); }
});

router.delete('/files/:id', async (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM files WHERE id=?').get(req.params.id);
    if (!existing) return res.status(404).json({ error:'File not found.' });
    const inUse = db.prepare('SELECT count(*) count FROM gallery_items WHERE file_id=?').get(req.params.id).count;
    if (inUse) return res.status(409).json({ error:'This file is used by the gallery. Remove the gallery item first.' });
    await deleteStoredFile(existing);
    db.prepare('DELETE FROM files WHERE id=?').run(req.params.id);
    audit(req.user.id,'file.deleted','file',req.params.id,{ name:existing.original_name });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get('/users', (req, res) => {
  const items = db.prepare(`SELECT id,member_id,email,name,role,status,permissions,created_at,updated_at
    FROM users ORDER BY role,name`).all().map(row => ({ ...row,permissions:json(row.permissions,[]) }));
  res.json({ items });
});

router.post('/users', async (req, res, next) => {
  try {
    const input = userSchema.extend({ password:userSchema.shape.password.unwrap() }).parse(req.body);
    const id = crypto.randomUUID();
    const time = now();
    db.prepare(`INSERT INTO users (id,member_id,email,name,password_hash,role,status,permissions,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      id,input.memberId,input.email,input.name,await hashPassword(input.password),
      input.role,input.status,JSON.stringify(input.permissions),time,time
    );
    audit(req.user.id,'user.created','user',id,{ memberId:input.memberId,role:input.role });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const input = userSchema.parse(req.body);
    const existing = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!existing) return res.status(404).json({ error:'User not found.' });
    if (req.params.id === req.user.id && (input.role !== 'admin' || input.status !== 'active')) {
      return res.status(400).json({ error:'You cannot remove your own active administrator access.' });
    }
    const passwordHash = input.password ? await hashPassword(input.password) : existing.password_hash;
    db.prepare(`UPDATE users SET member_id=?,email=?,name=?,password_hash=?,role=?,status=?,permissions=?,updated_at=?
      WHERE id=?`).run(
      input.memberId,input.email,input.name,passwordHash,input.role,input.status,
      JSON.stringify(input.permissions),now(),req.params.id
    );
    if (input.status !== 'active') db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.params.id);
    audit(req.user.id,'user.updated','user',req.params.id,{ memberId:input.memberId,role:input.role,status:input.status });
    res.json({ ok:true });
  } catch (error) { next(error); }
});

router.delete('/users/:id', (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error:'You cannot delete your own account.' });
  const existing = db.prepare('SELECT role,member_id FROM users WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error:'User not found.' });
  if (existing.role === 'admin') {
    const admins = db.prepare(`SELECT count(*) count FROM users WHERE role='admin' AND status='active'`).get().count;
    if (admins <= 1) return res.status(400).json({ error:'The final active administrator cannot be deleted.' });
  }
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  audit(req.user.id,'user.deleted','user',req.params.id,{ memberId:existing.member_id });
  res.status(204).end();
});

router.get('/settings', (req, res) => {
  const items = db.prepare('SELECT * FROM settings ORDER BY key').all()
    .map(row => ({ ...row,value:json(row.value,row.value),is_public:Boolean(row.is_public) }));
  res.json({ items });
});

router.put('/settings/:key', (req, res, next) => {
  try {
    const input = settingSchema.parse(req.body);
    const time = now();
    db.prepare(`INSERT INTO settings (key,value,is_public,updated_at,updated_by)
      VALUES (?,?,?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,is_public=excluded.is_public,
      updated_at=excluded.updated_at,updated_by=excluded.updated_by`).run(
      req.params.key,JSON.stringify(input.value),input.isPublic ? 1 : 0,time,req.user.id
    );
    audit(req.user.id,'setting.updated','setting',req.params.key);
    res.json({ ok:true });
  } catch (error) { next(error); }
});

router.use((error, req, res, next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ error:'Please correct the highlighted fields.',issues:error.issues });
  }
  if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error:'A record with the same ID, email, name, or slug already exists.' });
  }
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error:error.code === 'LIMIT_FILE_SIZE' ? 'The selected file is too large.' : error.message });
  }
  next(error);
});

export default router;
