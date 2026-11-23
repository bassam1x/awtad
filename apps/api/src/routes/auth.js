import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';
import { all, get, run, tx } from '../db.js';
import crypto from 'node:crypto';
import { checkPasswordAsync, hashPasswordAsync, loginGuard, passwordOk, rateLimit, signTicket, verifyTicket } from '../security.js';
import { exchangeLinkedinCode, linkedinEnabled, linkedinRedirect } from '../linkedin.js';
import { createUser, getSupport, session } from '../services.js';
import { ADMIN, DEMO_DOMAIN, DEMO_PASSWORD, demoEnabled } from '../seed.js';
import { UserError, bad, emailOk, safeAvatar, str, wrap } from '../utils.js';

export const getGoogleId = async () => (await get("SELECT value FROM settings WHERE key='google_client_id'"))?.value || config.googleClientId;
const clients = new Map();
const clientFor = (id) => { if (!id) return null; if (!clients.has(id)) clients.set(id, new OAuth2Client(id)); return clients.get(id); };

const r = Router();
const limit = rateLimit();

/* حسابات التجربة للتبديل السريع: في التطوير دائماً (مع حساب المدير التجريبي)، وفي الإنتاج فقط عند DEMO_MODE=true
   (طلاب وشركات فقط، ولا يُعرض حساب المدير أبداً). */
const demoAccounts = async () => {
  if (!demoEnabled()) return undefined;
  const rows = await all(`SELECT email, role, name FROM users WHERE email LIKE ? ORDER BY CASE role WHEN 'company' THEN 0 ELSE 1 END, id`, `%${DEMO_DOMAIN}`);
  const list = rows.map((u) => ({ role: u.role, email: u.email, name: u.name, password: DEMO_PASSWORD }));
  return config.env === 'production' ? list : [{ role: 'admin', email: ADMIN.email, name: 'مدير المنصة', password: ADMIN.password }, ...list];
};
r.get('/config', async (_req, res) => res.json({
  googleClientId: await getGoogleId(), demo: await demoAccounts(),
  linkedinClientId: linkedinEnabled() ? config.linkedinClientId : '', linkedinRedirect: linkedinRedirect(),
  support: await getSupport(),
}));
r.post('/auth/register', limit, wrap(async (req, res) => {
  const b = req.body || {};
  if (!['student', 'company'].includes(b.role)) return bad(res, 'اختر نوع الحساب');
  const name = str(b.name, 80), email = str(b.email, 120).toLowerCase(), password = String(b.password || '');
  if (!name) return bad(res, 'أدخل الاسم');
  if (!emailOk(email)) return bad(res, 'البريد الإلكتروني غير صحيح');
  if (email.endsWith(DEMO_DOMAIN)) return bad(res, 'هذا النطاق محجوز للحسابات التجريبية');
  if (!passwordOk(password)) return bad(res, 'كلمة المرور بين 8 و128 حرفاً');
  if (await get('SELECT 1 FROM users WHERE email=?', email)) return bad(res, 'هذا البريد مسجّل مسبقاً', 409);
  const id = await createUser({ role: b.role, name, email, password, avatar: safeAvatar(b.avatar), extra: b });
  res.json(await session(id));
}));

r.post('/auth/login', limit, wrap(async (req, res) => {
  const email = str(req.body?.email, 120).toLowerCase();
  // تقييد المحاولات الفاشلة لكل (بريد + عنوان): لا يستطيع مهاجم من عنوان آخر قفل حساب الضحية، ولا تخمين مستمر من عنوان واحد
  const gk = `${email}|${req.ip}`;
  if (loginGuard.blocked(gk)) return bad(res, 'محاولات كثيرة، حاول بعد 15 دقيقة', 429);
  const u = await get('SELECT id,password_hash,status FROM users WHERE email=?', email);
  // checkPasswordAsync يستغرق الزمن نفسه سواء وُجد الحساب أم لا، ولا يحجب حلقة الأحداث
  if (!(await checkPasswordAsync(String(req.body?.password || ''), u?.password_hash)) || !u) { loginGuard.fail(gk); return bad(res, 'البريد أو كلمة المرور غير صحيحة', 401); }
  loginGuard.ok(gk);
  if (u.status === 'banned') return bad(res, 'هذا الحساب موقوف من الإدارة', 403);
  res.json(await session(u.id));
}));

r.post('/auth/google', limit, wrap(async (req, res) => {
  const gid = await getGoogleId(); const client = clientFor(gid);
  if (!client) return bad(res, 'تسجيل الدخول عبر Google غير مفعّل بعد. يفعّله مدير المنصة من صفحة الإعدادات.', 503);
  let p;
  try { p = (await client.verifyIdToken({ idToken: String(req.body?.credential || ''), audience: gid })).getPayload(); }
  catch { return bad(res, 'تعذّر التحقق من حساب Google', 401); }
  if (!p?.email || !p.email_verified) return bad(res, 'بريد Google غير موثّق', 401);
  const email = p.email.toLowerCase();
  const u = await get('SELECT id,status,google_id,email_verified,password_hash FROM users WHERE google_id=? OR email=?', p.sub, email);
  if (u) {
    if (u.status === 'banned') return bad(res, 'هذا الحساب موقوف من الإدارة', 403);
    if (!u.google_id) {
      // حساب بكلمة مرور لم يُتحقق من بريده قد يكون مُنشأً من منتحل قبل صاحب البريد؛
      // Google أثبتت الملكية، فنُلغي كلمة المرور القديمة ونُبطل الجلسات السابقة.
      if (u.password_hash && !u.email_verified) await run('UPDATE users SET password_hash=NULL, token_version=token_version+1 WHERE id=?', u.id);
      await run('UPDATE users SET google_id=?, email_verified=1 WHERE id=?', p.sub, u.id);
    }
    return res.json(await session(u.id));
  }
  const role = req.body?.role;
  if (!['student', 'company'].includes(role)) return res.status(202).json({ needsRole: true, name: p.name, email });
  res.json(await session(await createUser({ role, name: p.name || email.split('@')[0], email, googleId: p.sub })));
}));

/* ---------- LinkedIn (OpenID Connect) ----------
   الخطوة 1: {code} من LinkedIn ← نتحقق ونُدخل المستخدم، أو نعيد 202 مع تذكرة إن كان جديداً ويحتاج اختيار نوع الحساب.
   الخطوة 2: {ticket, role} ← ننشئ الحساب. (الـ code صالح لمرة واحدة، لذلك نستخدم تذكرة موقّعة بدل إعادته.) */
r.post('/auth/linkedin', limit, wrap(async (req, res) => {
  if (!linkedinEnabled()) return bad(res, 'تسجيل الدخول عبر LinkedIn غير مفعّل بعد.', 503);
  const role = req.body?.role;
  let p;
  if (req.body?.ticket) {
    const tk = verifyTicket(req.body.ticket);
    if (!tk || tk.kind !== 'linkedin') return bad(res, 'انتهت المحاولة، أعد الدخول عبر LinkedIn', 401);
    p = tk;
  } else {
    try { p = await exchangeLinkedinCode(req.body?.code); } catch (e) { return bad(res, e.message, e.status || 401); }
  }
  const u = await get('SELECT id,status,linkedin_id,email_verified,password_hash FROM users WHERE linkedin_id=? OR email=?', p.sub, p.email);
  if (u) {
    if (u.status === 'banned') return bad(res, 'هذا الحساب موقوف من الإدارة', 403);
    if (!u.linkedin_id) {
      // LinkedIn أثبتت ملكية البريد: نربط الحساب، ونُلغي كلمة مرور حساب لم يُتحقق بريده (قد يكون مُنشأً من منتحل)
      if (u.password_hash && !u.email_verified) await run('UPDATE users SET password_hash=NULL, token_version=token_version+1 WHERE id=?', u.id);
      await run('UPDATE users SET linkedin_id=?, email_verified=1 WHERE id=?', p.sub, u.id);
    }
    return res.json(await session(u.id));
  }
  if (!['student', 'company'].includes(role)) return res.status(202).json({ needsRole: true, name: p.name, email: p.email, ticket: signTicket({ kind: 'linkedin', sub: p.sub, name: p.name, email: p.email }) });
  res.json(await session(await createUser({ role, name: p.name || p.email.split('@')[0], email: p.email, linkedinId: p.sub })));
}));


export default r;
