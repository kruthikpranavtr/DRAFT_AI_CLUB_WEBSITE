import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import studentRoutes from './routes/students.js';
import memberRoutes from './routes/members.js';
import assessmentRoutes from './routes/assessments.js';
import { csrfProtection } from './csrf.js';

export function createApp() {
  const app = express();
  const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:5174,http://localhost:5174')
    .split(',').map(value => value.trim()).filter(Boolean));

  app.set('trust proxy',1);
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
  app.use(express.urlencoded({ extended:false,limit:'2mb' }));
  app.use(cookieParser());

  app.use((req,res,next) => {
    if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (!origin || allowedOrigins.has(origin)) return next();
    if (process.env.NODE_ENV === 'production' && origin === `${req.protocol}://${req.get('host')}`) return next();
    return res.status(403).json({ error:'Request origin is not allowed.',code:'ORIGIN_DENIED' });
  });
  app.use(csrfProtection);

  app.get('/api/health',(req,res) => res.json({ status:'ok',time:new Date().toISOString() }));
  app.use('/api/auth',authRoutes);
  app.use('/api/public',publicRoutes);
  app.use('/api/admin',adminRoutes);
  app.use('/api/students',studentRoutes);
  app.use('/api/members',memberRoutes);
  app.use('/api/assessments',assessmentRoutes);
  app.use('/api',(req,res) => res.status(404).json({ error:'API endpoint not found.' }));

  app.use((error,req,res,next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    if (error instanceof ZodError) {
      return res.status(400).json({ error:'Invalid request.',issues:error.issues });
    }
    if (error?.message === 'Unsupported file type.') return res.status(400).json({ error:error.message });
    return res.status(500).json({ error:process.env.NODE_ENV === 'production' ? 'The server could not complete the request.' : error.message });
  });
  return app;
}
