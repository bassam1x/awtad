import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';
import { get, run } from '../db.js';
import { checkPassword, rateLimit } from '../security.js';
import { createUser, session } from '../services.js';
import { ADMIN, DEMO_PASSWORD } from '../seed.js';
import { bad, emailOk, safeAvatar, str, wrap } from '../utils.js';

export const getGoogleId = () => get("SELECT value FROM settings WHERE key='google_client_id'")?.value || config.googleClientId;
const clients = new Map();
const clientFor = (id) => { if (!id) return null; if (!clients.has(id)) clients.set(id, new OAuth2Client(id)); return clients.get(id); };

const r = Router();
const limit = rateLimit();

/* حسابات التجربة للتبديل السريع: تظهر في بيئة التطوير فقط، ولا تُعرض أبداً في الإنتاج. */
const demoAccounts = () => (config.env === 'production' ? undefined : [
  { role: 'admin', email: ADMIN.email, password: ADMIN.password },
  { role: 'student', email: 'sara@demo.iq', password: DEMO_PASSWORD },
  { role: 'company', email: 'dijla@demo.iq', password: DEMO_PASSWORD },
]);
r.get('/config', (_req, res) => res.json({ googleClientId: getGoogleId(), demo: demoAccounts() }));

r.post('/auth/register', limit, wrap((req, res) => {
  const b = req.body || {};
  if (!['student', 'company'].includes(b.role)) return bad(res, 'اختر نوع الحساب');
  const name = str(b.name, 80), email = str(b.email, 120).toLowerCase(), password = String(b.password || '');
  if (!name) return bad(res, 'أدخل الاسم');
  if (!emailOk(email)) return bad(res, 'البريد الإلكتروني غير صحيح');
  if (password.length < 8) return bad(res, 'كلمة المرور 8 أحرف على الأقل');
  if (get('SELECT 1 FROM users WHERE email=?', email)) return bad(res, 'هذا البريد مسجّل مسبقاً', 409);
  const id = createUser({ role: b.role, name, email, password, avatar: safeAvatar(b.avatar), extra: b });
  res.json(session(id));
}));

r.post('/auth/login', limit, wrap((req, res) => {
  const email = str(req.body?.email, 120).toLowerCase();
  const u = get('SELECT id,password_hash,status FROM users WHERE email=?', email);
  if (!u || !checkPassword(String(req.body?.password || ''), u.password_hash)) return bad(res, 'البريد أو كلمة المرور غير صحيحة', 401);
  if (u.status === 'banned') return bad(res, 'هذا الحساب موقوف من الإدارة', 403);
  res.json(session(u.id));
}));

r.post('/auth/google', limit, wrap(async (req, res) => {
  const gid = getGoogleId(); const client = clientFor(gid);
  if (!client) return bad(res, 'تسجيل الدخول عبر Google غير مفعّل بعد. يفعّله مدير المنصة من صفحة الإعدادات.', 503);
  let p;
  try { p = (await client.verifyIdToken({ idToken: String(req.body?.credential || ''), audience: gid })).getPayload(); }
  catch { return bad(res, 'تعذّر التحقق من حساب Google', 401); }
  if (!p?.email || !p.email_verified) return bad(res, 'بريد Google غير موثّق', 401);
  const email = p.email.toLowerCase();
  const u = get('SELECT id,status,google_id,email_verified,password_hash FROM users WHERE google_id=? OR email=?', p.sub, email);
  if (u) {
    if (u.status === 'banned') return bad(res, 'هذا الحساب موقوف من الإدارة', 403);
    if (!u.google_id) {
      // حساب بكلمة مرور لم يُتحقق من بريده قد يكون مُنشأً من منتحل قبل صاحب البريد؛
      // Google أثبتت الملكية، فنُلغي كلمة المرور القديمة ونُبطل الجلسات السابقة.
      if (u.password_hash && !u.email_verified) run('UPDATE users SET password_hash=NULL, token_version=token_version+1 WHERE id=?', u.id);
      run('UPDATE users SET google_id=?, email_verified=1 WHERE id=?', p.sub, u.id);
    }
    return res.json(session(u.id));
  }
  const role = req.body?.role;
  if (!['student', 'company'].includes(role)) return res.status(202).json({ needsRole: true, name: p.name, email });
  res.json(session(createUser({ role, name: p.name || email.split('@')[0], email, googleId: p.sub })));
}));

export default r;
