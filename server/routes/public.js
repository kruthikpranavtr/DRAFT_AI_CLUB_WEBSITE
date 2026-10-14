import { Readable } from 'node:stream';
import { Router } from 'express';
import { db, json } from '../db.js';

const router = Router();

const siteVideos = new Set([
  'hero-particle-ribbon-web.mp4',
  'section-discover.mp4',
  'section-create.mp4',
  'section-connect.mp4',
]);

router.get('/content', (req, res) => {
  const { page, type } = req.query;
  const filters = [`status='published'`];
  const values = [];
  if (page) { filters.push('page_key=?'); values.push(String(page)); }
  if (type) { filters.push('type=?'); values.push(String(type)); }
  const rows = db.prepare(`SELECT id,type,page_key,section_key,title,excerpt,body,payload,sort_order,published_at,updated_at
    FROM content_entries WHERE ${filters.join(' AND ')}
    ORDER BY page_key,sort_order,created_at`).all(...values);
  res.json({ items:rows.map(row => ({ ...row, payload:json(row.payload, {}) })) });
});

router.get('/gallery', (req, res) => {
  const items = db.prepare(`SELECT g.*,c.name category_name,c.slug category_slug,
      f.public_url,f.mime_type,f.original_name
    FROM gallery_items g
    LEFT JOIN gallery_categories c ON c.id=g.category_id
    JOIN files f ON f.id=g.file_id
    WHERE g.status='published'
    ORDER BY g.sort_order,g.created_at DESC`).all();
  const categories = db.prepare('SELECT * FROM gallery_categories ORDER BY name').all();
  res.json({ items, categories });
});

router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key,value FROM settings WHERE is_public=1').all();
  res.json({ settings:Object.fromEntries(rows.map(row => [row.key,json(row.value,row.value)])) });
});

router.get('/media/:name', async (req, res, next) => {
  try {
    const name = String(req.params.name || '');
    if (!siteVideos.has(name)) return res.status(404).json({ error:'Media not found.' });
    const { getStoredObjectUrl } = await import('../storage.js');
    const url = await getStoredObjectUrl(`site-videos/${name}`, 3600);
    if (url) return res.redirect(302, url);
    const fallbackBase = String(process.env.MEDIA_FALLBACK_BASE_URL || '').replace(/\/$/, '');
    if (fallbackBase) {
      const upstream = await fetch(`${fallbackBase}/${name}`, {
        headers:req.get('range') ? { Range:req.get('range') } : undefined,
      });
      if (!upstream.ok && upstream.status !== 206) {
        return res.status(upstream.status).json({ error:'Fallback media could not be loaded.' });
      }
      for (const header of ['content-type','content-length','content-range','accept-ranges','cache-control','etag','last-modified']) {
        const value = upstream.headers.get(header);
        if (value) res.setHeader(header, value);
      }
      res.status(upstream.status);
      if (!upstream.body) return res.end();
      return Readable.fromWeb(upstream.body).pipe(res);
    }
    return res.redirect(302, `/${name}`);
  } catch (error) { next(error); }
});

router.get('/files/:id', async (req, res, next) => {
  try {
    const record = db.prepare('SELECT * FROM files WHERE id=? AND is_public=1').get(req.params.id);
    if (!record) return res.status(404).json({ error:'File not found.' });
    const { sendStoredFile } = await import('../storage.js');
    await sendStoredFile(record,res,'inline');
  } catch (error) { next(error); }
});

export default router;
