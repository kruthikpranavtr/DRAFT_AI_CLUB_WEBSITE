import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const here = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.UPLOAD_DIR || path.join(here, 'member-platform-uploads');
fs.mkdirSync(uploadDir, { recursive:true });

const hasS3 = Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
const s3 = hasS3 ? new S3Client({
  region:process.env.S3_REGION || 'auto',
  endpoint:process.env.S3_ENDPOINT,
  forcePathStyle:process.env.S3_FORCE_PATH_STYLE !== 'false',
  credentials:{
    accessKeyId:process.env.S3_ACCESS_KEY_ID,
    secretAccessKey:process.env.S3_SECRET_ACCESS_KEY,
  },
}) : null;

const extensionFor = name => path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
function localStoredPath(key) {
  const target=path.resolve(uploadDir,key);
  const relative=path.relative(path.resolve(uploadDir),target);
  if(!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid storage key.');
  return target;
}

export function classifyMime(mime) {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if ([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv',
  ].includes(mime)) return 'document';
  return 'other';
}

export async function storeUpload(file,{ prefix = 'cms',extension } = {}) {
  const storedName = `${Date.now()}-${crypto.randomUUID()}${extension || extensionFor(file.originalname)}`;
  const safePrefix = prefix.replace(/[^a-z0-9/-]/gi,'').replace(/^\/+|\/+$/g,'') || 'cms';
  const key = `${safePrefix}/${new Date().toISOString().slice(0,7)}/${storedName}`;
  if (s3) {
    await s3.send(new PutObjectCommand({
      Bucket:process.env.S3_BUCKET,
      Key:key,
      Body:file.buffer,
      ContentType:file.mimetype,
      Metadata:{ originalName:encodeURIComponent(file.originalname) },
    }));
  } else {
    fs.writeFileSync(path.join(uploadDir, storedName), file.buffer, { flag:'wx' });
  }
  return {
    storedName,
    storageKey:s3 ? key : storedName,
    publicUrl:'',
  };
}

export async function sendStoredFile(record, res, disposition = 'inline') {
  res.setHeader('Content-Type', record.mime_type);
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(record.original_name)}`);
  if (s3) {
    const result = await s3.send(new GetObjectCommand({ Bucket:process.env.S3_BUCKET, Key:record.storage_key }));
    if (result.ContentLength) res.setHeader('Content-Length', String(result.ContentLength));
    return result.Body.pipe(res);
  }
  // The upload root can legitimately live in .phase2-data/.codex. Authorization
  // is enforced by the caller; only a validated database storage key is accepted.
  return new Promise((resolve,reject)=>res.sendFile(localStoredPath(record.storage_key),{dotfiles:'allow'},
    error=>error?reject(error):resolve()));
}

export async function deleteStoredFile(record) {
  if (s3) {
    await s3.send(new DeleteObjectCommand({ Bucket:process.env.S3_BUCKET, Key:record.storage_key }));
    return;
  }
  const target = localStoredPath(record.storage_key);
  if (fs.existsSync(target)) fs.unlinkSync(target);
}

export async function getStoredObjectUrl(key, expiresIn = 3600) {
  if (!s3) return '';
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket:process.env.S3_BUCKET,
    Key:key,
  }), { expiresIn });
}

export const storageMode = s3 ? 'object-storage' : 'local-disk';
