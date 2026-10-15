import crypto from 'node:crypto';

const COOKIE = 'aiclub_csrf';

function cookieOptions() {
  return {
    httpOnly:false,
    sameSite:'strict',
    secure:process.env.NODE_ENV === 'production',
    path:'/',
    maxAge:24 * 60 * 60 * 1000,
  };
}

export function issueCsrfToken(req,res) {
  const existing = req.cookies?.[COOKIE];
  const token = typeof existing === 'string' && existing.length >= 32
    ? existing
    : crypto.randomBytes(32).toString('base64url');
  res.cookie(COOKIE,token,cookieOptions());
  return token;
}

export function csrfProtection(req,res,next) {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  const cookieToken = req.cookies?.[COOKIE];
  const headerToken = req.get('x-csrf-token');
  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') {
    return res.status(403).json({ error:'A valid CSRF token is required.',code:'CSRF_INVALID' });
  }
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  if (cookieBuffer.length !== headerBuffer.length || !crypto.timingSafeEqual(cookieBuffer,headerBuffer)) {
    return res.status(403).json({ error:'A valid CSRF token is required.',code:'CSRF_INVALID' });
  }
  next();
}

export function clearCsrfToken(res) {
  res.clearCookie(COOKIE,{ path:'/',sameSite:'strict',secure:process.env.NODE_ENV === 'production' });
}
