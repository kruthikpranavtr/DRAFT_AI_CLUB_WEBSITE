import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db, now, json } from './db.js';

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'aiclub_session';
const SESSION_DAYS = 7;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm, salt, expectedHex] = String(stored).split(':');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const derived = Buffer.from(await scrypt(password, salt, 64));
  const expected = Buffer.from(expectedHex, 'hex');
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

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
  const row = db.prepare(`SELECT u.id,u.member_id,u.email,u.name,u.role,u.status,u.permissions
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>?`).get(tokenHash(token), now());
  if (!row || row.status !== 'active') return null;
  return { ...row, permissions:json(row.permissions, []) };
}

export function requireUser(req, res, next) {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error:'Authentication required.' });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error:'Authentication required.' });
  if (user.role !== 'admin') return res.status(403).json({ error:'Administrator access required.' });
  req.user = user;
  next();
}
