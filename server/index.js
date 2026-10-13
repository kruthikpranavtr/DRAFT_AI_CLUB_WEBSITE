import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import { cleanExpiredSessions } from './db.js';
import { seedDatabase } from './seed.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const here = path.dirname(fileURLToPath(import.meta.url));
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173')
  .split(',').map(value => value.trim()).filter(Boolean));

app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy:{ policy:'same-site' },
  contentSecurityPolicy:false,
}));
app.use(rateLimit({
  windowMs:60 * 1000,
  limit:300,
  standardHeaders:'draft-8',
  legacyHeaders:false,
}));
app.use(express.json({ limit:'2mb' }));
app.use(express.urlencoded({ extended:false, limit:'2mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin || allowedOrigins.has(origin)) return next();
  if (process.env.NODE_ENV === 'production' && origin === `${req.protocol}://${req.get('host')}`) return next();
  return res.status(403).json({ error:'Request origin is not allowed.' });
});

app.get('/api/health', (req, res) => res.json({ status:'ok', time:new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (req, res) => res.status(404).json({ error:'API endpoint not found.' }));

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  if (error instanceof ZodError) {
    return res.status(400).json({ error:'Invalid request.',issues:error.issues });
  }
  if (error?.message === 'Unsupported file type.') return res.status(400).json({ error:error.message });
  return res.status(500).json({ error:process.env.NODE_ENV === 'production' ? 'The server could not complete the request.' : error.message });
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(here,'..','dist');
  app.use(express.static(dist, { maxAge:'1h',etag:true }));
  app.use((req, res, next) => req.method === 'GET'
    ? res.sendFile(path.join(dist,'index.html'))
    : next());
}

await seedDatabase();
cleanExpiredSessions();
setInterval(cleanExpiredSessions, 60 * 60 * 1000).unref();

app.listen(port, () => {
  console.log(`AI Club CMS API running on http://127.0.0.1:${port}`);
});
