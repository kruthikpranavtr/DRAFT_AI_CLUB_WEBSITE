import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { audit, db, now, json } from '../db.js';
import { createSession, destroySession, requireUser, revokeUserSessions, verifyPassword } from '../auth.js';
import { clearCsrfToken, issueCsrfToken } from '../csrf.js';
import { hashPassword } from '../passwords.js';
import { changePasswordSchema, loginSchema } from '../validation.js';

const router = Router();
const dummyPasswordHash = await hashPassword(crypto.randomUUID());
const loginLimit = rateLimit({
  windowMs:15 * 60 * 1000,
  limit:10,
  standardHeaders:'draft-8',
  legacyHeaders:false,
  message:{ error:'Too many sign-in attempts. Try again in 15 minutes.' },
});

router.get('/csrf',(req,res) => res.json({ csrfToken:issueCsrfToken(req,res) }));

async function login(req,res,next,expectedRole = null) {
  try {
    const input = loginSchema.parse(req.body);
    const normalized = input.identifier.toLowerCase();
    // Role and permissions come only from the stored account. Student emails
    // are intentionally not login identifiers. Cross-account ambiguity fails closed.
    const matches = db.prepare(`SELECT * FROM users
      WHERE (lower(member_id)=? OR (role='admin' AND lower(email)=?))
        AND (? IS NULL OR role=?) LIMIT 2`).all(normalized,normalized,expectedRole,expectedRole);
    const user = matches.length === 1 ? matches[0] : null;
    const passwordValid = await verifyPassword(input.password,user?.password_hash || dummyPasswordHash);
    // Public demo identities are never allowed on a production server.
    const valid = Boolean(user && passwordValid &&
      !(process.env.NODE_ENV === 'production' && /^demo-/i.test(user.member_id)));
    if (!valid) return res.status(401).json({ error:'The identifier or password is incorrect.' });
    if (user.status !== 'active') return res.status(403).json({ error:'This account is not active. Contact an administrator.' });
    createSession(res,user.id,input.remember);
    res.json({ user:publicUser(user) });
  } catch (error) { next(error); }
}

router.post('/login',loginLimit,(req,res,next) => login(req,res,next));
// Compatibility API only; both routes share one attempt budget.
router.post('/admin/login',loginLimit,(req,res,next) => login(req,res,next,'admin'));

router.get('/me', requireUser, (req, res) => res.json({ user:req.user }));

router.post('/logout', (req, res) => {
  destroySession(req, res);
  clearCsrfToken(res);
  res.status(204).end();
});

router.post('/change-password',requireUser,async (req,res,next) => {
  try {
    const input = changePasswordSchema.parse(req.body);
    const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id);
    if (!user || !await verifyPassword(input.currentPassword,user.password_hash)) {
      return res.status(400).json({ error:'The current password is incorrect.',code:'CURRENT_PASSWORD_INVALID' });
    }
    const time = now();
    const passwordHash = await hashPassword(input.newPassword);
    db.transaction(() => {
      db.prepare(`UPDATE users SET password_hash=?,must_change_password=0,
        password_changed_at=?,updated_at=? WHERE id=?`)
        .run(passwordHash,time,time,req.user.id);
      revokeUserSessions(req.user.id);
      audit(req.user.id,'auth.password_changed','user',req.user.id);
    })();
    createSession(res,req.user.id,false);
    res.json({ ok:true });
  } catch (error) { next(error); }
});

function publicUser(user) {
  return {
    id:user.id,
    member_id:user.member_id,
    email:user.email,
    name:user.name,
    role:user.role,
    status:user.status,
    permissions:json(user.permissions,[]),
    must_change_password:Boolean(user.must_change_password),
  };
}

export default router;
