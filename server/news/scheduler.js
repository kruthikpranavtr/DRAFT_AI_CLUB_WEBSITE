import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as db from '../db.js';
import { createNewsService } from './service.js';

export const schedulerNewsRouter=Router();
schedulerNewsRouter.use(rateLimit({windowMs:60000,limit:5,standardHeaders:'draft-8',legacyHeaders:false}));
schedulerNewsRouter.post('/collect',async(req,res,next) => {
  const secret=process.env.NEWS_CRON_SECRET;
  const bearer=req.get('authorization') || '';
  const expected=Buffer.from(`Bearer ${secret || ''}`);
  const supplied=Buffer.from(bearer);
  // This separate machine endpoint never uses cookies, roles, or CSRF exemptions
  // for browser/session actions. It authenticates only a high-entropy server key.
  if (!secret || secret.length<32 || supplied.length!==expected.length || !crypto.timingSafeEqual(supplied,expected)) {
    return res.status(401).json({error:'Scheduler authentication required.'});
  }
  try { res.set('Cache-Control','no-store').json(await createNewsService(db).collect({trigger:'scheduler'})); }
  catch(error) { next(error); }
});
