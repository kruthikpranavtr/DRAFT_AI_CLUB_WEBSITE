import crypto from 'node:crypto';
import { db, now, json } from './db.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { hasPermission, isSuperAdmin } from './permissions.js';
const COOKIE = 'aiclub_session';
const SESSION_DAYS = 7;

const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');

export function createSession(res, userId, remember = true) {
  const token = crypto.randomBytes(32).toString('base64url');
  const maxAge = (remember ? SESSION_DAYS : 1) * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + maxAge).toISOString();
  db.prepare('INSERT INTO sessions (id,token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?,?)')
    .run(crypto.randomUUID(), tokenHash(token), userId, expiresAt, now());
  res.cookie(COOKIE, token, {
    httpOnly:true,
    sameSite:'strict',
    secure:process.env.NODE_ENV === 'production',
    maxAge:remember ? maxAge : undefined,
    path:'/',
  });
}

export function destroySession(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
  res.clearCookie(COOKIE, { path:'/', sameSite:'strict', secure:process.env.NODE_ENV === 'production' });
}

export function sessionUser(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  const row = db.prepare(`SELECT u.id,u.member_id,u.email,u.name,u.role,u.status,u.permissions,
      u.must_change_password,u.password_changed_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>?`).get(tokenHash(token), now());
  if (!row || row.status !== 'active' || (process.env.NODE_ENV === 'production' && /^demo-/i.test(row.member_id))) return null;
  return { ...row,must_change_password:Boolean(row.must_change_password),permissions:json(row.permissions,[]) };
}

export function requireUser(req, res, next) {
  res.setHeader('Cache-Control','private, no-store');
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error:'Authentication required.' });
  req.user = user;
  next();
}

export function requirePasswordChanged(req,res,next) {
  if (!req.user) return res.status(401).json({ error:'Authentication required.' });
  if (req.user.must_change_password) {
    return res.status(403).json({ error:'Change your temporary password before continuing.',code:'PASSWORD_CHANGE_REQUIRED' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  res.setHeader('Cache-Control','private, no-store');
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error:'Authentication required.' });
  if (user.role !== 'admin') return res.status(403).json({ error:'Administrator access required.' });
  req.user = user;
  requirePasswordChanged(req,res,next);
}

export function requirePermission(permission) {
  return (req,res,next) => {
    if (!req.user) return res.status(401).json({ error:'Authentication required.' });
    if (!hasPermission(req.user,permission)) {
      return res.status(403).json({ error:'You do not have permission to perform this action.',code:'PERMISSION_DENIED' });
    }
    next();
  };
}

export function requireSuperAdmin(req,res,next) {
  if (!req.user) return res.status(401).json({ error:'Authentication required.' });
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({ error:'Super Administrator access required.',code:'SUPER_ADMIN_REQUIRED' });
  }
  next();
}

export function revokeUserSessions(userId) {
  return db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId).changes;
}

export { hashPassword,verifyPassword };
