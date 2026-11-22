import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
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
const ALG = { algorithms: ['HS256'] };

/** تذكرة قصيرة العمر موقّعة (مثلاً بين خطوتي LinkedIn: التحقق ثم اختيار نوع الحساب). تحمل tk:1 فلا تُقبل كجلسة أبداً. */
export const signTicket = (payload, expiresIn = '10m') => jwt.sign({ ...payload, tk: 1 }, SECRET, { expiresIn, algorithm: 'HS256' });
export function verifyTicket(token) { try { const p = jwt.verify(String(token || ''), SECRET, ALG); return p.tk === 1 ? p : null; } catch { return null; } }

/* ---------- كلمات المرور (scrypt) ----------
   النسخ غير المتزامنة هي المستعملة في الطلبات حتى لا تحجب حلقة الأحداث (كل تجزئة ~60ms)؛ والمتزامنة للبذور فقط. */
export const MAX_PASSWORD = 128;
export const passwordOk = (pw) => typeof pw === 'string' && pw.length >= 8 && pw.length <= MAX_PASSWORD;
const scryptAsync = promisify(crypto.scrypt);

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
export async function hashPasswordAsync(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${(await scryptAsync(pw, salt, 64)).toString('hex')}`;
}
export function checkPassword(pw, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [salt, h] = stored.split(':');
  if (!salt || !h) return false;
  const expected = Buffer.from(h, 'hex');
  if (expected.length !== 64) return false;
  return crypto.timingSafeEqual(crypto.scryptSync(pw, salt, 64), expected);
}
/** نفس زمن التنفيذ سواء وُجد الحساب أم لا (لا كشف للبريدات المسجّلة بقياس الزمن). */
const DUMMY_HASH = hashPassword('تجزئة-وهمية-لتثبيت-الزمن');
export async function checkPasswordAsync(pw, stored) {
  const real = typeof stored === 'string' && stored.includes(':');
  const [salt, h] = (real ? stored : DUMMY_HASH).split(':');
  const expected = Buffer.from(h, 'hex');
  if (expected.length !== 64) return false;
  const got = await scryptAsync(String(pw).slice(0, MAX_PASSWORD + 1), salt, 64);
  return crypto.timingSafeEqual(got, expected) && real;
}

export const signToken = async (userId) => {
  const v = (await get('SELECT token_version v FROM users WHERE id=?', userId))?.v || 0;
  return jwt.sign({ id: userId, v }, SECRET, { expiresIn: '14d', algorithm: 'HS256' });
};

export function auth() {
  return async (req, res, next) => {
    const h = req.headers.authorization || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!t) return res.status(401).json({ error: 'سجّل الدخول أولاً' });
    let claims;
    try { claims = jwt.verify(t, SECRET, ALG); } catch { return res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول مجدداً' }); }
    if (claims.tk || !Number.isInteger(claims.id)) return res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول مجدداً' }); // التذاكر الداخلية ليست جلسات
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
/** مستخدم اختياري: يعيد صاحب الجلسة إن وُجد توكن صالح، وإلا null بلا أي خطأ (للمسارات العامة التي تستفيد من معرفة المستخدم). */
export async function tryAuth(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const c = jwt.verify(h.slice(7), SECRET, ALG);
    if (c.tk || !Number.isInteger(c.id)) return null;
    const u = await get('SELECT id,email,name,status,token_version FROM users WHERE id=?', c.id);
    return u && u.status !== 'banned' && (c.v || 0) === u.token_version ? u : null;
  } catch { return null; }
}
export const role = (...roles) => async (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'غير مصرّح لك بهذا الإجراء' });

/** حدّ طلبات في الذاكرة. المفتاح الافتراضي: العنوان + المسار. يمكن تمرير key لتقييد حسب المستخدم (مهم لأن كثيراً من المستخدمين
 *  في العراق يشتركون بعنوان IP واحد عبر شبكات الجوال، فلا نعتمد على العنوان وحده للمستخدمين المسجّلين). */
export function rateLimit({ windowMs = 15 * 60 * 1000, max = config.rateLimitMax, key = (req) => `${req.ip}${req.path}` } = {}) {
  const hits = new Map();
  setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (t > v.reset) hits.delete(k); }, Math.min(windowMs, 60 * 1000)).unref();
  return (req, res, next) => {
    const now = Date.now(); const k = key(req); const e = hits.get(k);
    if (!e || now > e.reset) { hits.set(k, { n: 1, reset: now + windowMs }); return next(); }
    if (++e.n > max) { res.set('Retry-After', String(Math.ceil((e.reset - now) / 1000))); return res.status(429).json({ error: 'محاولات كثيرة، حاول لاحقاً' }); }
    next();
  };
}

/** يعدّ المحاولات الفاشلة لمفتاح معيّن (مثل بريد+عنوان)، ويحجبه مؤقتاً بعد تجاوز الحد. النجاح يصفّر العدّاد.
 *  المفتاح يضم العنوان فلا يستطيع مهاجم من عنوان آخر قفل حساب الضحية. */
export function failGuard({ windowMs = 15 * 60 * 1000, max = 8 } = {}) {
  const m = new Map();
  setInterval(() => { const t = Date.now(); for (const [k, v] of m) if (t > v.reset) m.delete(k); }, 60 * 1000).unref();
  return {
    blocked(key) { const e = m.get(key); return !!e && Date.now() < e.reset && e.n >= max; },
    fail(key) { const now = Date.now(); const e = m.get(key); if (!e || now > e.reset) m.set(key, { n: 1, reset: now + windowMs }); else e.n++; },
    ok(key) { m.delete(key); },
  };
}
export const loginGuard = failGuard();
