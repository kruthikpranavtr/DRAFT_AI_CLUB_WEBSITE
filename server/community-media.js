import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import { query, queryOne, queryRows, withTransaction, now, audit } from './db.js';
import { fail } from './community.js';
import { storeUpload, sendStoredFile, deleteStoredFile } from './storage.js';
import { verifyProfileImage } from './image-security.js';

export const mediaRouter = Router();
let processing = 0;
const MAX_BYTES = 5 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 0, parts: 1 } });
const uploadLimit = rateLimit({
  windowMs: 10 * 60000,
  limit: 20,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Upload limit reached. Please try again later.', code: 'RATE_LIMITED' },
});

function processingSlot(req, res, next) {
  if (processing >= 2) return res.status(503).set('Retry-After', '3').json({ error: 'Image processing is busy. Try again shortly.' });
  processing++;
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      processing--;
    }
  };
  req.releaseCommunitySlot = release;
  res.once('finish', release);
  res.once('close', () => {
    if (!req.communityProcessing) release();
  });
  next();
}

function isAnimatedPng(buffer) {
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    if (buffer.subarray(offset + 4, offset + 8).toString() === 'acTL') return true;
    if (length > buffer.length - offset - 12) break;
    offset += length + 12;
  }
  return false;
}

export async function prepareCommunityImage(file) {
  try {
    verifyProfileImage(file);
    const image = sharp(file.buffer, { limitInputPixels: 20000000, failOn: 'warning' });
    const metadata = await image.metadata();
    const expected = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[file.mimetype];
    if (
      metadata.format !== expected ||
      metadata.width > 8192 ||
      metadata.height > 8192 ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages || 1) > 1 ||
      (metadata.format === 'png' && isAnimatedPng(file.buffer))
    ) {
      throw new Error('Unsupported image.');
    }
    const output = await image
      .rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    const thumbnail = await sharp(output.data)
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    return { image: output.data, thumbnail, width: output.info.width, height: output.info.height };
  } catch {
    fail(400, 'Choose a valid, static JPEG, PNG, or WebP image (5 MB, 20 megapixels, 8192 px maximum).', 'INVALID_COMMUNITY_IMAGE');
  }
}

export async function cleanupStagedMedia() {
  const expired = await queryRows(
    "SELECT id FROM community_media WHERE state = 'staged' AND expires_at <= $1 LIMIT 20",
    [now()]
  );
  for (const media of expired) {
    const variants = await queryRows(
      'SELECT storage_key FROM community_media_variants WHERE media_id = $1',
      [media.id]
    );
    try {
      for (const variant of variants) await deleteStoredFile(variant);
      await query(
        "DELETE FROM community_media WHERE id = $1 AND state = 'staged' AND expires_at <= $2",
        [media.id, now()]
      );
    } catch (error) {
      console.error('Staged image cleanup will retry.', error.message);
    }
  }
}

mediaRouter.post('/uploads', uploadLimit, processingSlot, upload.single('image'), async (req, res, next) => {
  if (req.aborted) {
    req.releaseCommunitySlot();
    return;
  }
  req.communityProcessing = true;
  const saved = [];
  try {
    if (!req.file) fail(400, 'Choose an image to upload.');
    const prepared = await prepareCommunityImage(req.file);
    await cleanupStagedMedia();
    const id = crypto.randomUUID();
    const time = now();
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    for (const variant of ['image', 'thumbnail']) {
      const record = await storeUpload(
        { buffer: prepared[variant], originalname: 'community-image.webp', mimetype: 'image/webp' },
        { prefix: 'community-private', extension: '.webp' }
      );
      saved.push({ ...record, variant, size: prepared[variant].length });
    }
    await withTransaction(async (tx) => {
      const usage = await tx.queryOne(
        "SELECT count(*)::int AS count, coalesce(sum(size), 0)::bigint AS size FROM community_media WHERE owner_id = $1 AND state = 'staged'",
        [req.user.id]
      );
      const storedRow = await tx.queryOne(
        "SELECT coalesce(sum(size), 0)::bigint AS size FROM community_media WHERE owner_id = $1",
        [req.user.id]
      );
      const stored = Number(storedRow?.size) || 0;
      const usageCount = Number(usage?.count) || 0;
      const usageSize = Number(usage?.size) || 0;
      const total = saved.reduce((sum, file) => sum + file.size, 0);
      if (usageCount >= 12 || usageSize + total > 50 * 1024 * 1024 || stored + total > 250 * 1024 * 1024) {
        fail(429, 'Your private image quota is full. Remove unused uploads or contact a moderator.');
      }
      await tx.query(
        'INSERT INTO community_media (id, owner_id, size, width, height, created_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, req.user.id, total, prepared.width, prepared.height, time, expiresAt]
      );
      for (const file of saved) {
        await tx.query(
          'INSERT INTO community_media_variants (media_id, variant, storage_key, mime_type, size) VALUES ($1, $2, $3, $4, $5)',
          [id, file.variant, file.storageKey, 'image/webp', file.size]
        );
      }
    });
    res.status(201).json({
      image: {
        id,
        width: prepared.width,
        height: prepared.height,
        description: '',
        url: `/api/community/media/${id}`,
        thumbnailUrl: `/api/community/media/${id}/thumbnail`,
        expiresAt,
      },
    });
  } catch (error) {
    for (const file of saved) {
      await deleteStoredFile({ storage_key: file.storageKey }).catch((cleanupError) =>
        console.error('Unreferenced community file requires operator cleanup.', file.storageKey, cleanupError.message)
      );
    }
    next(error);
  } finally {
    req.releaseCommunitySlot();
  }
});

export async function serveCommunityMedia(req, res, next, { moderation = false } = {}) {
  try {
    const media = await queryOne(
      `SELECT m.*, a.post_id, p.status AS post_status 
       FROM community_media m
       LEFT JOIN community_post_attachments a ON a.media_id = m.id 
       LEFT JOIN community_posts p ON p.id = a.post_id 
       WHERE m.id = $1`,
      [req.params.id]
    );
    const staged = media?.state === 'staged' && media.owner_id === req.user.id && new Date(media.expires_at) > new Date(now());
    const attached =
      media?.state === 'attached' &&
      media.post_id &&
      (media.post_status === 'visible' || (moderation && ['hidden', 'removed'].includes(media.post_status)));
    if (!media || (!staged && !attached)) fail(404, 'Image is unavailable.');
    const variant = req.path.endsWith('/thumbnail') ? 'thumbnail' : 'image';
    const record = await queryOne(
      'SELECT * FROM community_media_variants WHERE media_id = $1 AND variant = $2',
      [media.id, variant]
    );
    if (!record) fail(404, 'Image is unavailable.');
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    await sendStoredFile({ ...record, original_name: 'community-image.webp' }, res, 'inline');
  } catch (error) {
    next(error);
  }
}

mediaRouter.get(['/media/:id', '/media/:id/thumbnail'], serveCommunityMedia);

mediaRouter.delete('/uploads/:id', async (req, res, next) => {
  try {
    const media = await queryOne(
      "SELECT * FROM community_media WHERE id = $1 AND owner_id = $2 AND state = 'staged'",
      [req.params.id, req.user.id]
    );
    if (!media) fail(404, 'Staged upload is unavailable.');
    await query('UPDATE community_media SET expires_at = $1 WHERE id = $2', [now(), media.id]);
    const variants = await queryRows(
      'SELECT storage_key FROM community_media_variants WHERE media_id = $1',
      [media.id]
    );
    for (const variant of variants) await deleteStoredFile(variant);
    await query("DELETE FROM community_media WHERE id = $1 AND state = 'staged'", [media.id]);
    await audit(req.user.id, 'community.upload_discarded', 'community-media', media.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

mediaRouter.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ error: 'Upload one image at a time, up to 5 MB.' });
  next(error);
});
