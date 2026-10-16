import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { audit, query, queryOne, queryRows, withTransaction, now, json } from '../db.js';
import { createSession, destroySession, requireUser, revokeUserSessions, verifyPassword } from '../auth.js';
import { clearCsrfToken, issueCsrfToken } from '../csrf.js';
import { hashPassword } from '../passwords.js';
import { changePasswordSchema, loginSchema } from '../validation.js';

const router = Router();
const dummyPasswordHash = await hashPassword(crypto.randomUUID());
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
});

router.get('/csrf', (req, res) => res.json({ csrfToken: issueCsrfToken(req, res) }));

async function login(req, res, next, expectedRole = null) {
  try {
    const input = loginSchema.parse(req.body);
    const normalized = input.identifier.toLowerCase();
    // Role and permissions come only from the stored account. Student emails
    // are intentionally not login identifiers. Cross-account ambiguity fails closed.
    const matches = await queryRows(
      `SELECT * FROM users
       WHERE (lower(member_id) = $1 OR (role = 'admin' AND lower(email) = $1))
         AND ($2::text IS NULL OR role = $2) LIMIT 2`,
      [normalized, expectedRole]
    );
    const user = matches.length === 1 ? matches[0] : null;
    const passwordValid = await verifyPassword(input.password, user?.password_hash || dummyPasswordHash);
    // Public demo identities are never allowed on a production server.
    const valid = Boolean(
      user &&
      passwordValid &&
      !(process.env.NODE_ENV === 'production' && /^demo-/i.test(user.member_id))
    );
    if (!valid) return res.status(401).json({ error: 'The identifier or password is incorrect.' });
    if (user.status !== 'active') return res.status(403).json({ error: 'This account is not active. Contact an administrator.' });
    await createSession(res, user.id, input.remember);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

router.post('/login', loginLimit, (req, res, next) => login(req, res, next));
// Compatibility API only; both routes share one attempt budget.
router.post('/admin/login', loginLimit, (req, res, next) => login(req, res, next, 'admin'));

router.get('/me', requireUser, (req, res) => res.json({ user: req.user }));

router.post('/logout', async (req, res, next) => {
  try {
    await destroySession(req, res);
    clearCsrfToken(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/change-password', requireUser, async (req, res, next) => {
  try {
    const input = changePasswordSchema.parse(req.body);
    const user = await queryOne('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!user || !(await verifyPassword(input.currentPassword, user.password_hash))) {
      return res.status(400).json({ error: 'The current password is incorrect.', code: 'CURRENT_PASSWORD_INVALID' });
    }
    const time = now();
    const passwordHash = await hashPassword(input.newPassword);
    await withTransaction(async (tx) => {
      await tx.query(
        `UPDATE users SET password_hash = $1, must_change_password = FALSE,
         password_changed_at = $2, updated_at = $2 WHERE id = $3`,
        [passwordHash, time, req.user.id]
      );
      await tx.query('DELETE FROM sessions WHERE user_id = $1', [req.user.id]);
      await audit(req.user.id, 'auth.password_changed', 'user', req.user.id);
    });
    await createSession(res, req.user.id, false);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

function publicUser(user) {
  return {
    id: user.id,
    member_id: user.member_id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    permissions: json(user.permissions, []),
    must_change_password: Boolean(user.must_change_password),
  };
}

export default router;
