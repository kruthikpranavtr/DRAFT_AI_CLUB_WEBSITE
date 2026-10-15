import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { db, now, json, audit } from '../db.js';
import { requireAdmin, requirePermission, revokeUserSessions } from '../auth.js';
import { hashPassword } from '../passwords.js';
import { hasPermission, isSuperAdmin, PERMISSIONS } from '../permissions.js';
import { categorySchema, contentSchema, gallerySchema, settingSchema, temporaryPasswordSchema, userCreateSchema, userSchema } from '../validation.js';
import { classifyMime, deleteStoredFile, sendStoredFile, storeUpload, storageMode } from '../storage.js';
import { ensureStudentProfile,updateStudentProfile } from '../profiles.js';

const router = Router();
router.use(requireAdmin);

const contentPermissions = [PERMISSIONS.CONTENT_NEWS,PERMISSIONS.CONTENT_GALLERY,PERMISSIONS.CONTENT_ABOUT,PERMISSIONS.CONTENT_SITE];
const requireAnyContentPermission = (req,res,next) => contentPermissions.some(permission => hasPermission(req.user,permission))
  ? next()
  : res.status(403).json({ error:'You do not have permission to manage content.',code:'PERMISSION_DENIED' });
const permissionForContent = content => content?.page_key === 'news' || content?.pageKey === 'news' || content?.type === 'news'
  ? PERMISSIONS.CONTENT_NEWS
  : content?.page_key === 'about' || content?.pageKey === 'about'
    ? PERMISSIONS.CONTENT_ABOUT
    : content?.type === 'gallery'
      ? PERMISSIONS.CONTENT_GALLERY
      : PERMISSIONS.CONTENT_SITE;

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
  const recent = hasPermission(req.user,PERMISSIONS.READ_AUDIT)
    ? db.prepare(`SELECT a.*,u.name actor_name FROM activity_logs a
        LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 12`).all()
    : [];
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

router.get('/activities',requirePermission(PERMISSIONS.READ_AUDIT),(req, res) => {
  const items = db.prepare(`SELECT a.*,u.name actor_name FROM activity_logs a
    LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100`).all();
  res.json({ items:items.map(row => ({ ...row, details:json(row.details,{}) })) });
});

router.get('/content',requireAnyContentPermission,(req, res) => {
  const items = db.prepare(`SELECT c.*,u.name updated_by_name FROM content_entries c
    LEFT JOIN users u ON u.id=c.updated_by ORDER BY c.page_key,c.sort_order,c.updated_at DESC`).all()
    .filter(item => hasPermission(req.user,permissionForContent(item)));
  res.json({ items:items.map(row => ({ ...row, payload:json(row.payload,{}) })) });
});

router.post('/content', (req, res, next) => {
  try {
    const input = contentSchema.parse(req.body);
    if (!hasPermission(req.user,permissionForContent(input))) {
      return res.status(403).json({ error:'You do not have permission to manage this content area.',code:'PERMISSION_DENIED' });
    }
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
    if (!hasPermission(req.user,permissionForContent(existing)) || !hasPermission(req.user,permissionForContent(input))) {
      return res.status(403).json({ error:'You do not have permission to manage this content area.',code:'PERMISSION_DENIED' });
    }
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
  const existing = db.prepare('SELECT title,type,page_key FROM content_entries WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error:'Content entry not found.' });
  if (!hasPermission(req.user,permissionForContent(existing))) {
    return res.status(403).json({ error:'You do not have permission to manage this content area.',code:'PERMISSION_DENIED' });
  }
  db.prepare('DELETE FROM content_entries WHERE id=?').run(req.params.id);
  audit(req.user.id,'content.deleted','content',req.params.id,{ title:existing.title });
  res.status(204).end();
});

router.get('/categories',requirePermission(PERMISSIONS.CONTENT_GALLERY),(req, res) => {
  res.json({ items:db.prepare(`SELECT c.*,count(g.id) item_count FROM gallery_categories c
    LEFT JOIN gallery_items g ON g.category_id=c.id GROUP BY c.id ORDER BY c.name`).all() });
});

router.post('/categories',requirePermission(PERMISSIONS.CONTENT_GALLERY),(req, res, next) => {
  try {
    const input = categorySchema.parse(req.body);
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO gallery_categories (id,name,slug,description,created_at) VALUES (?,?,?,?,?)')
      .run(id,input.name,input.slug,input.description,now());
    audit(req.user.id,'category.created','gallery-category',id,{ name:input.name });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});

router.put('/categories/:id',requirePermission(PERMISSIONS.CONTENT_GALLERY),(req, res, next) => {
  try {
    const input = categorySchema.parse(req.body);
    const result = db.prepare('UPDATE gallery_categories SET name=?,slug=?,description=? WHERE id=?')
      .run(input.name,input.slug,input.description,req.params.id);
    if (!result.changes) return res.status(404).json({ error:'Category not found.' });
    audit(req.user.id,'category.updated','gallery-category',req.params.id,{ name:input.name });
    res.json({ ok:true });
  } catch (error) { next(error); }
});

router.delete('/categories/:id',requirePermission(PERMISSIONS.CONTENT_GALLERY),(req, res) => {
  const result = db.prepare('DELETE FROM gallery_categories WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error:'Category not found.' });
  audit(req.user.id,'category.deleted','gallery-category',req.params.id);
  res.status(204).end();
});

router.get('/gallery',requirePermission(PERMISSIONS.CONTENT_GALLERY),(req, res) => {
  const items = db.prepare(`SELECT g.*,c.name category_name,f.public_url,f.original_name,f.mime_type
    FROM gallery_items g LEFT JOIN gallery_categories c ON c.id=g.category_id
    LEFT JOIN files f ON f.id=g.file_id AND f.purpose='cms'
    WHERE g.file_id IS NULL OR f.id IS NOT NULL ORDER BY g.sort_order,g.updated_at DESC`).all();
  res.json({ items });
});

router.post('/gallery',requirePermission(PERMISSIONS.CONTENT_GALLERY),(req, res, next) => {
  try {
    const input = gallerySchema.parse(req.body);
    const file = db.prepare("SELECT id,kind FROM files WHERE id=? AND purpose='cms'").get(input.fileId);
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

router.put('/gallery/:id',requirePermission(PERMISSIONS.CONTENT_GALLERY),(req, res, next) => {
  try {
    const input = gallerySchema.parse(req.body);
    const file = db.prepare("SELECT id,kind FROM files WHERE id=? AND purpose='cms'").get(input.fileId);
    if (!file || file.kind !== 'image') return res.status(400).json({ error:'Select a valid uploaded CMS image.' });
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

router.delete('/gallery/:id',requirePermission(PERMISSIONS.CONTENT_GALLERY),(req, res) => {
  const result = db.prepare('DELETE FROM gallery_items WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error:'Gallery item not found.' });
  audit(req.user.id,'gallery.deleted','gallery',req.params.id);
  res.status(204).end();
});

router.get('/files',requireAnyContentPermission,(req, res) => {
  const items = db.prepare(`SELECT f.*,u.name uploaded_by_name FROM files f
    LEFT JOIN users u ON u.id=f.uploaded_by WHERE f.purpose='cms' ORDER BY f.created_at DESC`).all();
  res.json({ items });
});

router.post('/files',requireAnyContentPermission,upload.single('file'),async (req, res, next) => {
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

router.get('/files/:id/download',requireAnyContentPermission,async (req, res, next) => {
  try {
    const record = db.prepare("SELECT * FROM files WHERE id=? AND purpose='cms'").get(req.params.id);
    if (!record) return res.status(404).json({ error:'File not found.' });
    await sendStoredFile(record,res,'attachment');
  } catch (error) { next(error); }
});

router.put('/files/:id',requireAnyContentPermission,upload.single('file'),async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error:'Choose a replacement file.' });
    const existing = db.prepare("SELECT * FROM files WHERE id=? AND purpose='cms'").get(req.params.id);
    if (!existing) return res.status(404).json({ error:'File not found.' });
    const inGallery = db.prepare('SELECT 1 FROM gallery_items WHERE file_id=?').get(existing.id);
    if (inGallery && classifyMime(req.file.mimetype) !== 'image') {
      return res.status(400).json({ error:'Gallery files must remain images.' });
    }
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

router.delete('/files/:id',requireAnyContentPermission,async (req, res,next) => {
  try {
    const existing = db.prepare("SELECT * FROM files WHERE id=? AND purpose='cms'").get(req.params.id);
    if (!existing) return res.status(404).json({ error:'File not found.' });
    const inUse = db.prepare('SELECT count(*) count FROM gallery_items WHERE file_id=?').get(req.params.id).count;
    if (inUse) return res.status(409).json({ error:'This file is used by the gallery. Remove the gallery item first.' });
    await deleteStoredFile(existing);
    db.prepare('DELETE FROM files WHERE id=?').run(req.params.id);
    audit(req.user.id,'file.deleted','file',req.params.id,{ name:existing.original_name });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get('/users',(req,res) => {
  const superAdmin = isSuperAdmin(req.user);
  if (!superAdmin && !hasPermission(req.user,PERMISSIONS.MANAGE_STUDENTS)) {
    return res.status(403).json({ error:'You do not have permission to manage students.',code:'PERMISSION_DENIED' });
  }
  const sql = `SELECT users.id,member_id,email,name,role,status,permissions,must_change_password,
      password_changed_at,users.created_at,users.updated_at,
      p.department,p.academic_year FROM users
      LEFT JOIN student_profiles p ON p.user_id=users.id`
    + (superAdmin ? '' : ` WHERE role='student'`) + ' ORDER BY role,name';
  const items = db.prepare(sql).all().map(row => ({
    ...row,must_change_password:Boolean(row.must_change_password),permissions:json(row.permissions,[]),
  }));
  res.json({ items });
});

router.post('/users', async (req, res, next) => {
  try {
    const input = userCreateSchema.parse(req.body);
    const superAdmin = isSuperAdmin(req.user);
    if (input.role === 'admin' && !superAdmin) {
      return res.status(403).json({ error:'Only a Super Administrator can create administrators.',code:'SUPER_ADMIN_REQUIRED' });
    }
    if (input.role === 'student' && !superAdmin && !hasPermission(req.user,PERMISSIONS.MANAGE_STUDENTS)) {
      return res.status(403).json({ error:'You do not have permission to create students.',code:'PERMISSION_DENIED' });
    }
    if (input.role === 'student' && input.permissions.length) {
      return res.status(400).json({ error:'Student accounts cannot be assigned administrator permissions.' });
    }
    const id = crypto.randomUUID();
    const time = now();
    const passwordHash = await hashPassword(input.password);
    db.transaction(() => {
      db.prepare(`INSERT INTO users (id,member_id,email,name,password_hash,role,status,permissions,
        must_change_password,password_changed_at,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id,input.memberId,input.email,input.name,passwordHash,
        input.role,input.status,JSON.stringify(input.role === 'student' ? [] : input.permissions),1,null,time,time
      );
      if (input.role === 'student') {
        ensureStudentProfile(id,time);
        if (input.profile) updateStudentProfile(id,input.profile,time);
      }
      audit(req.user.id,'user.created','user',id,{
        memberId:input.memberId,role:input.role,
        permissions:input.role === 'admin' ? input.permissions : [],
        mustChangePassword:true,
      });
    })();
    res.status(201).json({ id });
  } catch (error) { next(error); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const input = userSchema.parse(req.body);
    const existing = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!existing) return res.status(404).json({ error:'User not found.' });
    const superAdmin = isSuperAdmin(req.user);
    const existingPermissions = json(existing.permissions,[]);
    const changesAdminAuthority = existing.role === 'admin' || input.role === 'admin'
      || JSON.stringify(input.permissions) !== JSON.stringify(existingPermissions);
    if (changesAdminAuthority && !superAdmin) {
      return res.status(403).json({ error:'Only a Super Administrator can manage administrator roles or permissions.',code:'SUPER_ADMIN_REQUIRED' });
    }
    if (!changesAdminAuthority && !superAdmin && !hasPermission(req.user,PERMISSIONS.MANAGE_STUDENTS)) {
      return res.status(403).json({ error:'You do not have permission to update students.',code:'PERMISSION_DENIED' });
    }
    if (input.role === 'student' && input.permissions.length) {
      return res.status(400).json({ error:'Student accounts cannot be assigned administrator permissions.' });
    }
    if (req.params.id === req.user.id && (input.role !== 'admin' || input.status !== 'active')) {
      return res.status(400).json({ error:'You cannot remove your own active administrator access.' });
    }
    if (isStoredSuperAdmin(existing) && !willRemainActiveSuperAdmin(input) && activeSuperAdminCount() <= 1) {
      return res.status(409).json({ error:'The final active Super Administrator cannot lose access.' });
    }
    const time = now();
    db.transaction(() => {
      db.prepare(`UPDATE users SET member_id=?,email=?,name=?,role=?,status=?,permissions=?,updated_at=?
        WHERE id=?`).run(
        input.memberId,input.email,input.name,input.role,input.status,
        JSON.stringify(input.role === 'student' ? [] : input.permissions),time,req.params.id
      );
      if (input.role === 'student') {
        ensureStudentProfile(req.params.id,time);
        if (input.profile) updateStudentProfile(req.params.id,input.profile,time);
      }
    })();
    if (input.status !== 'active') db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.params.id);
    audit(req.user.id,'user.updated','user',req.params.id,{
      memberId:input.memberId,
      role:{ from:existing.role,to:input.role },
      status:{ from:existing.status,to:input.status },
      permissions:{ from:existingPermissions,to:input.role === 'student' ? [] : input.permissions },
    });
    res.json({ ok:true });
  } catch (error) { next(error); }
});

router.post('/users/:id/reset-password',async (req,res,next) => {
  try {
    const input = temporaryPasswordSchema.parse(req.body);
    const existing = db.prepare('SELECT id,member_id,role FROM users WHERE id=?').get(req.params.id);
    if (!existing) return res.status(404).json({ error:'User not found.' });
    if (existing.role === 'admin' && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error:'Only a Super Administrator can reset an administrator password.',code:'SUPER_ADMIN_REQUIRED' });
    }
    if (existing.role === 'student' && !isSuperAdmin(req.user)
      && !hasPermission(req.user,PERMISSIONS.MANAGE_STUDENTS)) {
      return res.status(403).json({ error:'You do not have permission to reset student passwords.',code:'PERMISSION_DENIED' });
    }
    const time = now();
    const passwordHash = await hashPassword(input.temporaryPassword);
    db.transaction(() => {
      db.prepare(`UPDATE users SET password_hash=?,must_change_password=1,
        password_changed_at=NULL,updated_at=? WHERE id=?`).run(passwordHash,time,existing.id);
      revokeUserSessions(existing.id);
      audit(req.user.id,'user.password_reset','user',existing.id,{ memberId:existing.member_id });
    })();
    res.json({ ok:true });
  } catch (error) { next(error); }
});

router.delete('/users/:id', (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error:'You cannot delete your own account.' });
  const existing = db.prepare('SELECT role,member_id FROM users WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error:'User not found.' });
  if (existing.role === 'admin' && !isSuperAdmin(req.user)) {
    return res.status(403).json({ error:'Only a Super Administrator can delete an administrator.',code:'SUPER_ADMIN_REQUIRED' });
  }
  if (existing.role === 'student' && !isSuperAdmin(req.user)
    && !hasPermission(req.user,PERMISSIONS.MANAGE_STUDENTS)) {
    return res.status(403).json({ error:'You do not have permission to delete students.',code:'PERMISSION_DENIED' });
  }
  if (existing.role === 'admin') {
    const full = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (isStoredSuperAdmin(full) && activeSuperAdminCount() <= 1) {
      return res.status(409).json({ error:'The final active Super Administrator cannot be deleted.' });
    }
  }
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  audit(req.user.id,'user.deleted','user',req.params.id,{ memberId:existing.member_id });
  res.status(204).end();
});

router.get('/settings',requirePermission(PERMISSIONS.MANAGE_SETTINGS),(req, res) => {
  const items = db.prepare('SELECT * FROM settings ORDER BY key').all()
    .map(row => ({ ...row,value:json(row.value,row.value),is_public:Boolean(row.is_public) }));
  res.json({ items });
});

router.put('/settings/:key',requirePermission(PERMISSIONS.MANAGE_SETTINGS),(req, res, next) => {
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

function isStoredSuperAdmin(user) {
  return user?.role === 'admin' && json(user.permissions,[]).includes(PERMISSIONS.SUPER_ADMIN);
}

function willRemainActiveSuperAdmin(input) {
  return input.role === 'admin' && input.status === 'active'
    && input.permissions.includes(PERMISSIONS.SUPER_ADMIN);
}

function activeSuperAdminCount() {
  return db.prepare(`SELECT role,status,permissions FROM users WHERE role='admin' AND status='active'`)
    .all().filter(isStoredSuperAdmin).length;
}

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
