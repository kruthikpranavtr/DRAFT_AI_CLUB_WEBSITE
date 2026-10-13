import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { createSession, destroySession, requireUser, verifyPassword } from '../auth.js';
import { loginSchema } from '../validation.js';

const router = Router();
const loginLimit = rateLimit({
  windowMs:15 * 60 * 1000,
  limit:10,
  standardHeaders:'draft-8',
  legacyHeaders:false,
  message:{ error:'Too many sign-in attempts. Try again in 15 minutes.' },
});

router.post('/login', loginLimit, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const normalized = input.identifier.toLowerCase();
    const user = db.prepare(`SELECT * FROM users
      WHERE lower(member_id)=? OR lower(email)=?`).get(normalized, normalized);
    const valid = user && await verifyPassword(input.password, user.password_hash);
    if (!valid) return res.status(401).json({ error:'The ID/email or password is incorrect.' });
    if (user.status !== 'active') return res.status(403).json({ error:'This account is not active. Contact an administrator.' });
    createSession(res, user.id, input.remember);
    res.json({ user:publicUser(user) });
  } catch (error) { next(error); }
});

router.get('/me', requireUser, (req, res) => res.json({ user:req.user }));

router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.status(204).end();
});

function publicUser(user) {
  return {
    id:user.id,
    member_id:user.member_id,
    email:user.email,
    name:user.name,
    role:user.role,
    status:user.status,
    permissions:JSON.parse(user.permissions || '[]'),
  };
}

export default router;
