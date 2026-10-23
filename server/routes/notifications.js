import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query, queryOne, queryRows, withTransaction } from '../db.js';
import { requireUser, requirePasswordChanged, requireAdmin, requireSuperAdmin } from '../auth.js';
import { addNotification } from '../notifications.js';

const router = Router();
router.use(requireUser, requirePasswordChanged);
router.use((req,res,next) => { res.set('Cache-Control','private, no-store'); next(); });

const visible = `(n.recipient_id IS NULL OR n.recipient_id = $1)
  AND n.actor_id IS DISTINCT FROM $1`;
const uuid = z.string().uuid();
const changesLimit = rateLimit({windowMs:60000,limit:40,standardHeaders:'draft-8',legacyHeaders:false});

router.get('/unread', async(req,res,next) => {
  try {
    const row = await queryOne(`SELECT COUNT(*)::int AS unread FROM notification_events n
      WHERE ${visible} AND NOT EXISTS (
        SELECT 1 FROM notification_reads r WHERE r.event_id=n.id AND r.user_id=$1
      )`,[req.user.id]);
    res.json({unread:row.unread});
  } catch(error) { next(error); }
});

router.get('/', async(req,res,next) => {
  try {
    const schema = z.object({
      limit:z.coerce.number().int().min(1).max(50).default(30),
      offset:z.coerce.number().int().min(0).max(1000).default(0),
      unread:z.enum(['true','false']).optional(),
    });
    const {limit,offset,unread}=schema.parse(req.query);
    const unreadFilter=unread==='true' ? 'AND r.event_id IS NULL' : '';
    const entries=await queryRows(`SELECT n.id,n.type,n.title,n.body,n.link,n.created_at,
      r.read_at, u.name AS actor_name
      FROM notification_events n
      LEFT JOIN notification_reads r ON r.event_id=n.id AND r.user_id=$1
      LEFT JOIN users u ON u.id=n.actor_id
      WHERE ${visible} ${unreadFilter}
      ORDER BY n.created_at DESC,n.id DESC
      LIMIT $2 OFFSET $3`,[req.user.id,limit,offset]);
    const count=await queryOne(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE r.event_id IS NULL)::int AS unread
      FROM notification_events n
      LEFT JOIN notification_reads r ON r.event_id=n.id AND r.user_id=$1
      WHERE ${visible}`,[req.user.id]);
    res.json({items:entries.map(entry=>({...entry,read:entry.read_at!==null})),...count,limit,offset});
  } catch(error) { next(error); }
});

router.post('/read-all',changesLimit,async(req,res,next) => {
  try {
    const result=await query(`INSERT INTO notification_reads(user_id,event_id)
      SELECT $1,n.id FROM notification_events n WHERE ${visible}
      ON CONFLICT(user_id,event_id) DO NOTHING`,[req.user.id]);
    res.json({ok:true,marked:result.rowCount});
  } catch(error) { next(error); }
});

router.post('/:id/read',changesLimit,async(req,res,next) => {
  try {
    const id=uuid.parse(req.params.id);
    const result=await query(`INSERT INTO notification_reads(user_id,event_id)
      SELECT $1,n.id FROM notification_events n
      WHERE n.id=$2 AND ${visible}
      ON CONFLICT(user_id,event_id) DO NOTHING`,[req.user.id,id]);
    // A duplicate read is fine, but a user cannot mark another user's event.
    if (!result.rowCount) {
      const exists=await queryOne(`SELECT n.id FROM notification_events n WHERE n.id=$2 AND ${visible}`,[req.user.id,id]);
      if (!exists) return res.status(404).json({error:'Notification not found.'});
    }
    res.json({ok:true});
  } catch(error) { next(error); }
});

// Authenticated super administrators can send club-wide messages, not impersonated alerts.
router.post('/broadcast',requireAdmin,requireSuperAdmin,
  rateLimit({windowMs:60000,limit:5,standardHeaders:'draft-8',legacyHeaders:false}),
  async(req,res,next) => {
    try {
      const input=z.object({
        title:z.string().trim().min(3).max(180),
        body:z.string().trim().min(1).max(800),
      }).strict().parse(req.body);
      await withTransaction(async tx => {
        await addNotification(tx,{
          type:'direct_message',title:input.title,body:input.body,
          actorId:req.user.id,link:'/notifications',
        });
      });
      res.status(201).json({ok:true});
    } catch(error) { next(error); }
  });
export default router;
