import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { query, queryOne, queryRows, withTransaction, now, json, audit } from '../db.js';
import { requireAdmin, requirePermission, revokeUserSessions } from '../auth.js';
import { hashPassword } from '../passwords.js';
import { hasPermission, isSuperAdmin, PERMISSIONS } from '../permissions.js';
import {
  categorySchema,
  contentSchema,
  gallerySchema,
  settingSchema,
  temporaryPasswordSchema,
  userCreateSchema,
  userSchema,
} from '../validation.js';
import { classifyMime, deleteStoredFile, sendStoredFile, storeUpload, storageMode } from '../storage.js';
import { ensureStudentProfile, updateStudentProfile } from '../profiles.js';
import { addNotification } from '../notifications.js';

const router = Router();
router.use(requireAdmin);

const contentPermissions = [
  PERMISSIONS.CONTENT_NEWS,
  PERMISSIONS.CONTENT_GALLERY,
  PERMISSIONS.CONTENT_ABOUT,
  PERMISSIONS.CONTENT_SITE,
];

const requireAnyContentPermission = (req, res, next) =>
  contentPermissions.some((permission) => hasPermission(req.user, permission))
    ? next()
    : res.status(403).json({ error: 'You do not have permission to manage content.', code: 'PERMISSION_DENIED' });

const permissionForContent = (content) =>
  content?.page_key === 'news' || content?.pageKey === 'news' || content?.type === 'news'
    ? PERMISSIONS.CONTENT_NEWS
    : content?.page_key === 'about' || content?.pageKey === 'about'
      ? PERMISSIONS.CONTENT_ABOUT
      : content?.type === 'gallery'
        ? PERMISSIONS.CONTENT_GALLERY
        : PERMISSIONS.CONTENT_SITE;

const allowedMime = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'video/mp4',
  'video/webm',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 100 * 1024 * 1024), files: 1 },
  fileFilter(req, file, callback) {
    callback(allowedMime.has(file.mimetype) ? null : new Error('Unsupported file type.'), allowedMime.has(file.mimetype));
  },
});

router.get('/overview', async (req, res, next) => {
  try {
    const scalar = async (sql) => {
      const row = await queryOne(sql);
      return Number(Object.values(row || {})[0]) || 0;
    };
    const recent = hasPermission(req.user, PERMISSIONS.READ_AUDIT)
      ? await queryRows(
          `SELECT a.*, u.name AS actor_name FROM activity_logs a
           LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 12`
        )
      : [];
    res.json({
      stats: {
        students: await scalar("SELECT count(*) FROM users WHERE role = 'student'"),
        files: await scalar('SELECT count(*) FROM files'),
        gallery: await scalar('SELECT count(*) FROM gallery_items'),
        published: await scalar("SELECT count(*) FROM content_entries WHERE status = 'published'"),
        drafts: await scalar("SELECT count(*) FROM content_entries WHERE status = 'draft'"),
      },
      recent: recent.map((row) => ({ ...row, details: json(row.details, {}) })),
      storageMode,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/activities', requirePermission(PERMISSIONS.READ_AUDIT), async (req, res, next) => {
  try {
    const items = await queryRows(
      `SELECT a.*, u.name AS actor_name FROM activity_logs a
       LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 100`
    );
    res.json({ items: items.map((row) => ({ ...row, details: json(row.details, {}) })) });
  } catch (error) {
    next(error);
  }
});

router.get('/content', requireAnyContentPermission, async (req, res, next) => {
  try {
    const items = (
      await queryRows(
        `SELECT c.*, u.name AS updated_by_name FROM content_entries c
         LEFT JOIN users u ON u.id = c.updated_by ORDER BY c.page_key, c.sort_order, c.updated_at DESC`
      )
    ).filter((item) => hasPermission(req.user, permissionForContent(item)));
    res.json({ items: items.map((row) => ({ ...row, payload: json(row.payload, {}) })) });
  } catch (error) {
    next(error);
  }
});

router.post('/content', async (req, res, next) => {
  try {
    const input = contentSchema.parse(req.body);
    if (!hasPermission(req.user, permissionForContent(input))) {
      return res.status(403).json({ error: 'You do not have permission to manage this content area.', code: 'PERMISSION_DENIED' });
    }
    const id = crypto.randomUUID();
    const time = now();
    const publishedAt = input.status === 'published' ? time : null;
    await withTransaction(async tx => {
    await tx.query(
      `INSERT INTO content_entries
        (id, type, page_key, section_key, title, excerpt, body, payload, status, sort_order, published_at, created_at, updated_at, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $13)`,
      [
        id,
        input.type,
        input.pageKey,
        input.sectionKey,
        input.title,
        input.excerpt,
        input.body,
        JSON.stringify(input.payload),
        input.status,
        input.sortOrder,
        publishedAt,
        time,
        req.user.id,
      ]
    );
    await audit(req.user.id, 'content.created', 'content', id, { title: input.title, status: input.status }, tx);
    if (input.status === 'published') await addNotification(tx, {
      type:'site_update',title:'New website update',body:input.title.slice(0,180),
      link:['/','/news','/about','/gallery'].includes('/'+input.pageKey) ? '/'+input.pageKey : '/',actorId:req.user.id,
    });
    });
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

router.put('/content/:id', async (req, res, next) => {
  try {
    const input = contentSchema.parse(req.body);
    const existing = await queryOne('SELECT * FROM content_entries WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Content entry not found.' });
    const aggregated = await queryOne('SELECT source_id FROM news_details WHERE content_id=$1 AND source_id IS NOT NULL',[req.params.id]);
    if (aggregated) return res.status(409).json({ error:'Use News Management to edit aggregated news and preserve its moderation and attribution.' });
    if (!hasPermission(req.user, permissionForContent(existing)) || !hasPermission(req.user, permissionForContent(input))) {
      return res.status(403).json({ error: 'You do not have permission to manage this content area.', code: 'PERMISSION_DENIED' });
    }
    const publishedAt = input.status === 'published' ? existing.published_at || now() : existing.published_at;
    await withTransaction(async tx => {
    await tx.query(
      `UPDATE content_entries SET type = $1, page_key = $2, section_key = $3, title = $4, excerpt = $5, body = $6,
        payload = $7, status = $8, sort_order = $9, published_at = $10, updated_at = $11, updated_by = $12 WHERE id = $13`,
      [
        input.type,
        input.pageKey,
        input.sectionKey,
        input.title,
        input.excerpt,
        input.body,
        JSON.stringify(input.payload),
        input.status,
        input.sortOrder,
        publishedAt,
        now(),
        req.user.id,
        req.params.id,
      ]
    );
    await audit(req.user.id, 'content.updated', 'content', req.params.id, { title: input.title, status: input.status }, tx);
    if (input.status === 'published') await addNotification(tx, {
      type:'site_update',title:'Website content updated',body:input.title.slice(0,180),
      link:['/','/news','/about','/gallery'].includes('/'+input.pageKey) ? '/'+input.pageKey : '/',actorId:req.user.id,
    });
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/content/:id', async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT title, type, page_key FROM content_entries WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Content entry not found.' });
    if (!hasPermission(req.user, permissionForContent(existing))) {
      return res.status(403).json({ error: 'You do not have permission to manage this content area.', code: 'PERMISSION_DENIED' });
    }
    await query('DELETE FROM content_entries WHERE id = $1', [req.params.id]);
    await audit(req.user.id, 'content.deleted', 'content', req.params.id, { title: existing.title });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/categories', requirePermission(PERMISSIONS.CONTENT_GALLERY), async (req, res, next) => {
  try {
    const items = await queryRows(
      `SELECT c.*, count(g.id)::int AS item_count FROM gallery_categories c
       LEFT JOIN gallery_items g ON g.category_id = c.id GROUP BY c.id ORDER BY c.name`
    );
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/categories', requirePermission(PERMISSIONS.CONTENT_GALLERY), async (req, res, next) => {
  try {
    const input = categorySchema.parse(req.body);
    const id = crypto.randomUUID();
    await query(
      'INSERT INTO gallery_categories (id, name, slug, description, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, input.name, input.slug, input.description, now()]
    );
    await audit(req.user.id, 'category.created', 'gallery-category', id, { name: input.name });
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

router.put('/categories/:id', requirePermission(PERMISSIONS.CONTENT_GALLERY), async (req, res, next) => {
  try {
    const input = categorySchema.parse(req.body);
    const result = await query(
      'UPDATE gallery_categories SET name = $1, slug = $2, description = $3 WHERE id = $4',
      [input.name, input.slug, input.description, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Category not found.' });
    await audit(req.user.id, 'category.updated', 'gallery-category', req.params.id, { name: input.name });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/categories/:id', requirePermission(PERMISSIONS.CONTENT_GALLERY), async (req, res, next) => {
  try {
    const result = await query('DELETE FROM gallery_categories WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Category not found.' });
    await audit(req.user.id, 'category.deleted', 'gallery-category', req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/gallery', requirePermission(PERMISSIONS.CONTENT_GALLERY), async (req, res, next) => {
  try {
    const items = await queryRows(
      `SELECT g.*, c.name AS category_name, f.public_url, f.original_name, f.mime_type
       FROM gallery_items g LEFT JOIN gallery_categories c ON c.id = g.category_id
       LEFT JOIN files f ON f.id = g.file_id AND f.purpose = 'cms'
       WHERE g.file_id IS NULL OR f.id IS NOT NULL ORDER BY g.sort_order, g.updated_at DESC`
    );
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/gallery', requirePermission(PERMISSIONS.CONTENT_GALLERY), async (req, res, next) => {
  try {
    const input = gallerySchema.parse(req.body);
    const file = await queryOne("SELECT id, kind FROM files WHERE id = $1 AND purpose = 'cms'", [input.fileId]);
    if (!file || file.kind !== 'image') return res.status(400).json({ error: 'Select a valid uploaded image.' });
    const id = crypto.randomUUID();
    const time = now();
    await withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO gallery_items
          (id, category_id, title, caption, alt_text, file_id, status, sort_order, created_at, updated_at, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10)`,
        [id, input.categoryId || null, input.title, input.caption, input.altText, input.fileId, input.status, input.sortOrder, time, req.user.id]
      );
      if (input.status === 'published') {
        await tx.query('UPDATE files SET is_public = TRUE WHERE id = $1', [input.fileId]);
      }
      await audit(req.user.id, 'gallery.created', 'gallery', id, { title: input.title, status: input.status });
    });
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

router.put('/gallery/:id', requirePermission(PERMISSIONS.CONTENT_GALLERY), async (req, res, next) => {
  try {
    const input = gallerySchema.parse(req.body);
    const file = await queryOne("SELECT id, kind FROM files WHERE id = $1 AND purpose = 'cms'", [input.fileId]);
    if (!file || file.kind !== 'image') return res.status(400).json({ error: 'Select a valid uploaded CMS image.' });
    let updated = false;
    await withTransaction(async (tx) => {
      const result = await tx.query(
        `UPDATE gallery_items SET category_id = $1, title = $2, caption = $3, alt_text = $4,
          file_id = $5, status = $6, sort_order = $7, updated_at = $8, updated_by = $9 WHERE id = $10`,
        [input.categoryId || null, input.title, input.caption, input.altText, input.fileId, input.status, input.sortOrder, now(), req.user.id, req.params.id]
      );
      if (!result.rowCount) return;
      updated = true;
      if (input.status === 'published') {
        await tx.query('UPDATE files SET is_public = TRUE WHERE id = $1', [input.fileId]);
      }
      await audit(req.user.id, 'gallery.updated', 'gallery', req.params.id, { title: input.title, status: input.status });
    });
    if (!updated) return res.status(404).json({ error: 'Gallery item not found.' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/gallery/:id', requirePermission(PERMISSIONS.CONTENT_GALLERY), async (req, res, next) => {
  try {
    const result = await query('DELETE FROM gallery_items WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Gallery item not found.' });
    await audit(req.user.id, 'gallery.deleted', 'gallery', req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/files', requireAnyContentPermission, async (req, res, next) => {
  try {
    const items = await queryRows(
      `SELECT f.*, u.name AS uploaded_by_name FROM files f
       LEFT JOIN users u ON u.id = f.uploaded_by WHERE f.purpose = 'cms' ORDER BY f.created_at DESC`
    );
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/files', requireAnyContentPermission, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' });
    const saved = await storeUpload(req.file);
    const id = crypto.randomUUID();
    const time = now();
    const publicUrl = `/api/public/files/${id}`;
    await query(
      `INSERT INTO files
        (id, original_name, stored_name, mime_type, size, storage_key, public_url, kind, is_public, created_at, updated_at, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9, $9, $10)`,
      [
        id,
        req.file.originalname,
        saved.storedName,
        req.file.mimetype,
        req.file.size,
        saved.storageKey,
        publicUrl,
        classifyMime(req.file.mimetype),
        time,
        req.user.id,
      ]
    );
    await audit(req.user.id, 'file.uploaded', 'file', id, { name: req.file.originalname, size: req.file.size });
    res.status(201).json({ id, publicUrl });
  } catch (error) {
    next(error);
  }
});

router.get('/files/:id/download', requireAnyContentPermission, async (req, res, next) => {
  try {
    const record = await queryOne("SELECT * FROM files WHERE id = $1 AND purpose = 'cms'", [req.params.id]);
    if (!record) return res.status(404).json({ error: 'File not found.' });
    await sendStoredFile(record, res, 'attachment');
  } catch (error) {
    next(error);
  }
});

router.put('/files/:id', requireAnyContentPermission, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a replacement file.' });
    const existing = await queryOne("SELECT * FROM files WHERE id = $1 AND purpose = 'cms'", [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'File not found.' });
    const inGallery = await queryOne('SELECT 1 FROM gallery_items WHERE file_id = $1', [existing.id]);
    if (inGallery && classifyMime(req.file.mimetype) !== 'image') {
      return res.status(400).json({ error: 'Gallery files must remain images.' });
    }
    const saved = await storeUpload(req.file);
    await deleteStoredFile(existing);
    await query(
      `UPDATE files SET original_name = $1, stored_name = $2, mime_type = $3, size = $4, storage_key = $5,
        kind = $6, updated_at = $7 WHERE id = $8`,
      [
        req.file.originalname,
        saved.storedName,
        req.file.mimetype,
        req.file.size,
        saved.storageKey,
        classifyMime(req.file.mimetype),
        now(),
        req.params.id,
      ]
    );
    await audit(req.user.id, 'file.replaced', 'file', req.params.id, { name: req.file.originalname });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/files/:id', requireAnyContentPermission, async (req, res, next) => {
  try {
    const existing = await queryOne("SELECT * FROM files WHERE id = $1 AND purpose = 'cms'", [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'File not found.' });
    const inUse = await queryOne('SELECT count(*)::int AS count FROM gallery_items WHERE file_id = $1', [req.params.id]);
    if (Number(inUse?.count) > 0) {
      return res.status(409).json({ error: 'This file is used by the gallery. Remove the gallery item first.' });
    }
    await deleteStoredFile(existing);
    await query('DELETE FROM files WHERE id = $1', [req.params.id]);
    await audit(req.user.id, 'file.deleted', 'file', req.params.id, { name: existing.original_name });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const superAdmin = isSuperAdmin(req.user);
    if (!superAdmin && !hasPermission(req.user, PERMISSIONS.MANAGE_STUDENTS)) {
      return res.status(403).json({ error: 'You do not have permission to manage students.', code: 'PERMISSION_DENIED' });
    }
    const sql =
      `SELECT users.id, member_id, email, name, role, status, permissions, must_change_password,
          password_changed_at, users.created_at, users.updated_at,
          p.department, p.academic_year FROM users
          LEFT JOIN student_profiles p ON p.user_id = users.id` +
      (superAdmin ? '' : " WHERE role = 'student'") +
      ' ORDER BY role, name';
    const items = (await queryRows(sql)).map((row) => ({
      ...row,
      must_change_password: Boolean(row.must_change_password),
      permissions: json(row.permissions, []),
    }));
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const input = userCreateSchema.parse(req.body);
    const superAdmin = isSuperAdmin(req.user);
    if (input.role === 'admin' && !superAdmin) {
      return res.status(403).json({ error: 'Only a Super Administrator can create administrators.', code: 'SUPER_ADMIN_REQUIRED' });
    }
    if (input.role === 'student' && !superAdmin && !hasPermission(req.user, PERMISSIONS.MANAGE_STUDENTS)) {
      return res.status(403).json({ error: 'You do not have permission to create students.', code: 'PERMISSION_DENIED' });
    }
    if (input.role === 'student' && input.permissions.length) {
      return res.status(400).json({ error: 'Student accounts cannot be assigned administrator permissions.' });
    }
    const id = crypto.randomUUID();
    const time = now();
    const passwordHash = await hashPassword(input.password);
    await withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO users (id, member_id, email, name, password_hash, role, status, permissions,
          must_change_password, password_changed_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, null, $9, $9)`,
        [
          id,
          input.memberId,
          input.email,
          input.name,
          passwordHash,
          input.role,
          input.status,
          JSON.stringify(input.role === 'student' ? [] : input.permissions),
          time,
        ]
      );
      if (input.role === 'student') {
        await tx.query(
          `INSERT INTO student_profiles (user_id, created_at, updated_at) VALUES ($1, $2, $2) ON CONFLICT (user_id) DO NOTHING`,
          [id, time]
        );
        if (input.profile) {
          await updateStudentProfile(id, input.profile, time, tx);
        }
      }
      await audit(req.user.id, 'user.created', 'user', id, {
        memberId: input.memberId,
        role: input.role,
        permissions: input.role === 'admin' ? input.permissions : [],
        mustChangePassword: true,
      });
    });
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const input = userSchema.parse(req.body);
    const existing = await queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    const superAdmin = isSuperAdmin(req.user);
    const existingPermissions = json(existing.permissions, []);
    const changesAdminAuthority =
      existing.role === 'admin' ||
      input.role === 'admin' ||
      JSON.stringify(input.permissions) !== JSON.stringify(existingPermissions);
    if (changesAdminAuthority && !superAdmin) {
      return res.status(403).json({ error: 'Only a Super Administrator can manage administrator roles or permissions.', code: 'SUPER_ADMIN_REQUIRED' });
    }
    if (!changesAdminAuthority && !superAdmin && !hasPermission(req.user, PERMISSIONS.MANAGE_STUDENTS)) {
      return res.status(403).json({ error: 'You do not have permission to update students.', code: 'PERMISSION_DENIED' });
    }
    if (input.role === 'student' && input.permissions.length) {
      return res.status(400).json({ error: 'Student accounts cannot be assigned administrator permissions.' });
    }
    if (req.params.id === req.user.id && (input.role !== 'admin' || input.status !== 'active')) {
      return res.status(400).json({ error: 'You cannot remove your own active administrator access.' });
    }
    if (isStoredSuperAdmin(existing) && !willRemainActiveSuperAdmin(input) && (await activeSuperAdminCount()) <= 1) {
      return res.status(409).json({ error: 'The final active Super Administrator cannot lose access.' });
    }
    const time = now();
    await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE users SET member_id = $1, email = $2, name = $3, role = $4, status = $5, permissions = $6, updated_at = $7
          WHERE id = $8`,
        [
          input.memberId,
          input.email,
          input.name,
          input.role,
          input.status,
          JSON.stringify(input.role === 'student' ? [] : input.permissions),
          time,
          req.params.id,
        ]
      );
      if (input.role === 'student') {
        await tx.query(
          `INSERT INTO student_profiles (user_id, created_at, updated_at) VALUES ($1, $2, $2) ON CONFLICT (user_id) DO NOTHING`,
          [req.params.id, time]
        );
        if (input.profile) {
          await updateStudentProfile(req.params.id, input.profile, time, tx);
        }
      }
    });
    if (input.status !== 'active') await query('DELETE FROM sessions WHERE user_id = $1', [req.params.id]);
    await audit(req.user.id, 'user.updated', 'user', req.params.id, {
      memberId: input.memberId,
      role: { from: existing.role, to: input.role },
      status: { from: existing.status, to: input.status },
      permissions: { from: existingPermissions, to: input.role === 'student' ? [] : input.permissions },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const input = temporaryPasswordSchema.parse(req.body);
    const existing = await queryOne('SELECT id, member_id, role FROM users WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    if (existing.role === 'admin' && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only a Super Administrator can reset an administrator password.', code: 'SUPER_ADMIN_REQUIRED' });
    }
    if (existing.role === 'student' && !isSuperAdmin(req.user) && !hasPermission(req.user, PERMISSIONS.MANAGE_STUDENTS)) {
      return res.status(403).json({ error: 'You do not have permission to reset student passwords.', code: 'PERMISSION_DENIED' });
    }
    const time = now();
    const passwordHash = await hashPassword(input.temporaryPassword);
    await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE users SET password_hash = $1, must_change_password = TRUE,
          password_changed_at = NULL, updated_at = $2 WHERE id = $3`,
        [passwordHash, time, existing.id]
      );
      await tx.query('DELETE FROM sessions WHERE user_id = $1', [existing.id]);
      await audit(req.user.id, 'user.password_reset', 'user', existing.id, { memberId: existing.member_id }, tx);
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
    const existing = await queryOne('SELECT role, member_id, permissions FROM users WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    if (existing.role === 'admin' && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only a Super Administrator can delete an administrator.', code: 'SUPER_ADMIN_REQUIRED' });
    }
    if (existing.role === 'student' && !isSuperAdmin(req.user) && !hasPermission(req.user, PERMISSIONS.MANAGE_STUDENTS)) {
      return res.status(403).json({ error: 'You do not have permission to delete students.', code: 'PERMISSION_DENIED' });
    }
    if (existing.role === 'admin') {
      if (isStoredSuperAdmin(existing) && (await activeSuperAdminCount()) <= 1) {
        return res.status(409).json({ error: 'The final active Super Administrator cannot be deleted.' });
      }
    }
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    await audit(req.user.id, 'user.deleted', 'user', req.params.id, { memberId: existing.member_id });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/settings', requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    const items = (await queryRows('SELECT * FROM settings ORDER BY key')).map((row) => ({
      ...row,
      value: json(row.value, row.value),
      is_public: Boolean(row.is_public),
    }));
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.put('/settings/:key', requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    const input = settingSchema.parse(req.body);
    const time = now();
    await withTransaction(async tx => {
    await tx.query(
      `INSERT INTO settings (key, value, is_public, updated_at, updated_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, is_public = EXCLUDED.is_public,
        updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
      [req.params.key, JSON.stringify(input.value), Boolean(input.isPublic), time, req.user.id]
    );
    await audit(req.user.id, 'setting.updated', 'setting', req.params.key, {}, tx);
    if (req.params.key === 'announcement.text' && typeof input.value === 'string' && input.value.trim()) {
      await addNotification(tx, {
        type:'site_update',title:'AI Club announcement',body:input.value.trim().slice(0,800),
        link:'/',actorId:req.user.id,
      });
    }
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

function isStoredSuperAdmin(user) {
  return user?.role === 'admin' && json(user.permissions, []).includes(PERMISSIONS.SUPER_ADMIN);
}

function willRemainActiveSuperAdmin(input) {
  return input.role === 'admin' && input.status === 'active' && input.permissions.includes(PERMISSIONS.SUPER_ADMIN);
}

async function activeSuperAdminCount() {
  const rows = await queryRows("SELECT role, status, permissions FROM users WHERE role = 'admin' AND status = 'active'");
  return rows.filter(isStoredSuperAdmin).length;
}

router.use((error, req, res, next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: 'Please correct the highlighted fields.', issues: error.issues });
  }
  if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.code === '23505') {
    return res.status(409).json({ error: 'A record with the same ID, email, name, or slug already exists.' });
  }
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'The selected file is too large.' : error.message });
  }
  next(error);
});

export default router;
