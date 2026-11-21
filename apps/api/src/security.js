import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { get } from './db.js';

function loadSecret() {
  if (config.jwtSecret) return config.jwtSecret;
  if (config.env === 'production') throw new Error('JWT_SECRET مطلوب في الإنتاج');
  const f = config.secretFile;
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const s = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();

/** تذكرة قصيرة العمر موقّعة (مثلاً بين خطوتي LinkedIn: التحقق ثم اختيار نوع الحساب) */
export const signTicket = (payload, expiresIn = '10m') => jwt.sign({ ...payload, tk: 1 }, SECRET, { expiresIn });
export function verifyTicket(token) { try { const p = jwt.verify(String(token || ''), SECRET); return p.tk === 1 ? p : null; } catch { return null; } }

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
export function checkPassword(pw, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [salt, h] = stored.split(':');
  if (!salt || !h) return false;
  const expected = Buffer.from(h, 'hex');
  if (expected.length !== 64) return false;
  return crypto.timingSafeEqual(crypto.scryptSync(pw, salt, 64), expected);
}

export const signToken = async (userId) => {
  const v = (await get('SELECT token_version v FROM users WHERE id=?', userId))?.v || 0;
  return jwt.sign({ id: userId, v }, SECRET, { expiresIn: '14d' });
};

export function auth() {
  return async (req, res, next) => {
    const h = req.headers.authorization || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!t) return res.status(401).json({ error: 'سجّل الدخول أولاً' });
    let claims;
    try { claims = jwt.verify(t, SECRET); } catch { return res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول مجدداً' }); }
    try {
      const u = await get('SELECT id,email,role,name,avatar,status,token_version FROM users WHERE id=?', claims.id);
      if (!u) return res.status(401).json({ error: 'الحساب غير موجود' });
      if ((claims.v || 0) !== u.token_version) return res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول مجدداً' });
      if (u.status === 'banned') return res.status(403).json({ error: 'هذا الحساب موقوف من الإدارة' });
      req.user = u;
    } catch (e) { return next(e); }
    next();
  };
}
export const role = (...roles) => async (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'غير مصرّح لك بهذا الإجراء' });

/** حدّ طلبات بسيط في الذاكرة لمنع تخمين كلمات المرور. */
export function rateLimit({ windowMs = 15 * 60 * 1000, max = config.rateLimitMax } = {}) {
  const hits = new Map();
  setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (t > v.reset) hits.delete(k); }, windowMs).unref();
  return async (req, res, next) => {
    const now = Date.now(); const key = `${req.ip}${req.path}`; const e = hits.get(key);
    if (!e || now > e.reset) { hits.set(key, { n: 1, reset: now + windowMs }); return next(); }
    if (++e.n > max) return res.status(429).json({ error: 'محاولات كثيرة، حاول لاحقاً' });
    next();
  };
}
