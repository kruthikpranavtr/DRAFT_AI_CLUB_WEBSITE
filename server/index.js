import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { cleanExpiredSessions } from './db.js';
import { seedDatabase } from './seed.js';
import { createApp } from './app.js';
import { cleanupStagedMedia } from './community-media.js';

const app = createApp();
const port = Number(process.env.PORT || 3002);
const here = path.dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(here,'..','dist');
  app.use(express.static(dist, { maxAge:'1h',etag:true }));
  app.use((req, res, next) => req.method === 'GET'
    ? res.sendFile(path.join(dist,'index.html'))
    : next());
}

if (process.env.NODE_ENV === 'production' && process.env.AI_CLUB_DEMO_MODE === '1') {
  throw new Error('Public demo mode is forbidden in production.');
}
await seedDatabase();
cleanExpiredSessions();
setInterval(cleanExpiredSessions, 60 * 60 * 1000).unref();
await cleanupStagedMedia();
setInterval(() => cleanupStagedMedia().catch(error => console.error('Community cleanup failed.',error.message)),15 * 60 * 1000).unref();

// Public demo credentials must never be exposed beyond the local computer.
const listenHost = process.env.AI_CLUB_DEMO_MODE === '1' ? '127.0.0.1' : '0.0.0.0';
app.listen(port,listenHost, () => {
  console.log(`AI Club CMS API running on http://127.0.0.1:${port}`);
});
