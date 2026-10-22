import { Readable } from 'node:stream';
import { Router } from 'express';
import { queryOne, queryRows, json } from '../db.js';
import { approvedSourceIds } from '../news/service.js';

const router = Router();

const siteVideos = new Set([
  'hero-particle-ribbon-web.mp4',
  'section-discover.mp4',
  'section-create.mp4',
  'section-connect.mp4',
]);

router.get('/content', async (req, res, next) => {
  try {
    const { page, type } = req.query;
    const filters = ["status = 'published'",`NOT EXISTS (SELECT 1 FROM news_details n LEFT JOIN news_sources s ON s.id=n.source_id
      WHERE n.content_id=content_entries.id AND (n.approval<>'approved' OR n.archived=TRUE OR
        (n.source_id IS NOT NULL AND (s.enabled IS NOT TRUE OR NOT (n.source_id=ANY($1::text[]))))))`];
    const values = [approvedSourceIds];
    if (page) {
      values.push(String(page));
      filters.push(`page_key = $${values.length}`);
    }
    if (type) {
      values.push(String(type));
      filters.push(`type = $${values.length}`);
    }
    const rows = await queryRows(
      `SELECT id, type, page_key, section_key, title, excerpt, body, payload, sort_order, published_at, updated_at
       FROM content_entries WHERE ${filters.join(' AND ')}
       ORDER BY page_key, sort_order, created_at`,
      values
    );
    res.json({ items: rows.map((row) => ({ ...row, payload: json(row.payload, {}) })) });
  } catch (error) {
    next(error);
  }
});

router.get('/gallery', async (req, res, next) => {
  try {
    const items = await queryRows(
      `SELECT g.*, c.name AS category_name, c.slug AS category_slug,
          f.public_url, f.mime_type, f.original_name
       FROM gallery_items g
       LEFT JOIN gallery_categories c ON c.id = g.category_id
       JOIN files f ON f.id = g.file_id
       WHERE g.status = 'published' AND f.purpose = 'cms' AND f.is_public = TRUE AND f.kind = 'image'
       ORDER BY g.sort_order, g.created_at DESC`
    );
    const categories = await queryRows('SELECT * FROM gallery_categories ORDER BY name');
    res.json({ items, categories });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', async (req, res, next) => {
  try {
    const rows = await queryRows('SELECT key, value FROM settings WHERE is_public = TRUE');
    res.json({ settings: Object.fromEntries(rows.map((row) => [row.key, json(row.value, row.value)])) });
  } catch (error) {
    next(error);
  }
});

router.get('/media/:name', async (req, res, next) => {
  try {
    const name = String(req.params.name || '');
    if (!siteVideos.has(name)) return res.status(404).json({ error: 'Media not found.' });
    const { getStoredObjectUrl } = await import('../storage.js');
    const url = await getStoredObjectUrl(`site-videos/${name}`, 3600);
    if (url) return res.redirect(302, url);
    const fallbackBase = String(process.env.MEDIA_FALLBACK_BASE_URL || '').replace(/\/$/, '');
    if (fallbackBase) {
      const upstream = await fetch(`${fallbackBase}/${name}`, {
        headers: req.get('range') ? { Range: req.get('range') } : undefined,
      });
      if (!upstream.ok && upstream.status !== 206) {
        return res.status(upstream.status).json({ error: 'Fallback media could not be loaded.' });
      }
      for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified']) {
        const value = upstream.headers.get(header);
        if (value) res.setHeader(header, value);
      }
      res.status(upstream.status);
      if (!upstream.body) return res.end();
      return Readable.fromWeb(upstream.body).pipe(res);
    }
    return res.redirect(302, `/${name}`);
  } catch (error) {
    next(error);
  }
});

router.get('/files/:id', async (req, res, next) => {
  try {
    const record = await queryOne("SELECT * FROM files WHERE id = $1 AND is_public = TRUE AND purpose = 'cms'", [req.params.id]);
    if (!record) return res.status(404).json({ error: 'File not found.' });
    const { sendStoredFile } = await import('../storage.js');
    await sendStoredFile(record, res, 'inline');
  } catch (error) {
    next(error);
  }
});

export default router;
