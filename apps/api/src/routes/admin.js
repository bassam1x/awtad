import { Router } from 'express';
import { config } from '../config.js';
import { all, get, run } from '../db.js';
import { role, signImpersonation } from '../security.js';
import { POSTING_SQL, fullUser, getSupport, postingOut } from '../services.js';
import { bad, emailOk, igHandle, qs, str } from '../utils.js';
import { googleEnabled } from './auth.js';

const r = Router();
r.use(role('admin'));

r.get('/users', async (req, res) => {
  const q = `%${str(req.query.q, 60)}%`;
  const rl = ['student', 'company', 'admin'].includes(qs(req.query.role)) ? req.query.role : '';
  res.json(await all(`SELECT id,name,email,role,avatar,status,created_at FROM users WHERE (name ILIKE ? OR email ILIKE ?) ${rl ? 'AND role=?' : ''} ORDER BY id DESC`, q, q, ...(rl ? [rl] : [])));
});
/** ملف كامل لأي حساب للمدير: بيانات الدخول (دون كلمة المرور)، التفاصيل، المنشورات أو الطلبات، والحركات المالية. */
r.get('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return bad(res, 'غير موجود', 404);
  const u = await fullUser(id, { forSelf: true });
  if (!u) return bad(res, 'غير موجود', 404);
  const x = await get('SELECT email_verified,(google_id IS NOT NULL) AS has_google,(linkedin_id IS NOT NULL) AS has_linkedin FROM users WHERE id=?', id);
  const out = { ...u, email_verified: !!x.email_verified, has_google: !!x.has_google, has_linkedin: !!x.has_linkedin, has_password: !!u.has_password };
  if (u.role === 'student') {
    out.applications = await all(`SELECT a.id,a.status,a.stage,a.created_at,p.id AS posting_id,p.title,p.kind,c.name AS company_name FROM applications a JOIN postings p ON p.id=a.posting_id JOIN users c ON c.id=p.company_id WHERE a.student_id=? ORDER BY a.id DESC LIMIT 100`, id);
    out.transactions = await all('SELECT id,title,amount,cur,created_at FROM wallet_tx WHERE user_id=? ORDER BY id DESC LIMIT 50', id);
  } else if (u.role === 'company') {
    const rows = await all(`SELECT p.id,p.title,p.kind,p.status,p.pay,p.cur,p.created_at,(SELECT COUNT(*) FROM applications a WHERE a.posting_id=p.id) AS applicants FROM postings p WHERE p.company_id=? ORDER BY p.id DESC LIMIT 100`, id);
    out.postings = rows.map((p) => ({ ...p, applicants: Number(p.applicants) }));
  }
  res.json(out);
});
/** الدخول بحساب مستخدم أو شركة لمعالجة مشكلة أو مراجعة ما يراه. يُسجَّل في audit_log، ولا يتيح تغيير بيانات الدخول (انظر me.js). */
r.post('/users/:id/impersonate', async (req, res) => {
  const id = Number(req.params.id);
  const t = Number.isInteger(id) ? await get('SELECT id,role,status FROM users WHERE id=?', id) : null;
  if (!t) return bad(res, 'غير موجود', 404);
  if (t.role === 'admin') return bad(res, 'لا يمكن الدخول بحساب مدير');
  if (t.status === 'banned') return bad(res, 'الحساب موقوف: فعّله أولاً');
  await run('INSERT INTO audit_log(admin_id,action,target_id) VALUES(?,?,?)', req.user.id, 'impersonate', t.id);
  res.json({ token: await signImpersonation(t.id, req.user.id), user: await fullUser(t.id, { forSelf: true }) });
});
r.patch('/users/:id', async (req, res) => {
  const t = await get('SELECT id FROM users WHERE id=?', req.params.id);
  if (!t) return bad(res, 'غير موجود', 404);
  if (t.id === req.user.id) return bad(res, 'لا يمكنك تعديل حسابك من هنا');
  if (['active', 'banned'].includes(req.body?.status)) {
    await run('UPDATE users SET status=? WHERE id=?', req.body.status, t.id);
    if (req.body.status === 'banned') await run('UPDATE users SET token_version=token_version+1 WHERE id=?', t.id);
  }
  res.json({ ok: true });
});
r.delete('/users/:id', async (req, res) => {
  if (Number(req.params.id) === req.user.id) return bad(res, 'لا يمكنك حذف حسابك');
  await run('DELETE FROM users WHERE id=?', req.params.id);
  res.json({ ok: true });
});
r.get('/postings', async (_req, res) => {
  const rows = await all(`${POSTING_SQL} ORDER BY p.id DESC`);
  res.json(await Promise.all(rows.map(async (x) => ({ ...postingOut(x), applicants: (await get('SELECT COUNT(*) c FROM applications WHERE posting_id=?', x.id)).c }))));
});
r.get('/settings', async (_req, res) => {
  const sp = await getSupport();
  res.json({ googleSignIn: await googleEnabled(), googleConfigured: !!config.firebaseApiKey, supportEmail: sp.email, supportInstagram: sp.instagram });
});
const putSetting = (k, v) => (v ? run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, v) : run('DELETE FROM settings WHERE key=?', k));
r.put('/settings', async (req, res) => {
  const b = req.body || {};
  // كل حقل يُحدَّث فقط إن أُرسل (حتى لا يمسح حفظ قنوات الدعم إعداد Google أو العكس)
  if ('googleSignIn' in b) {
    if (typeof b.googleSignIn !== 'boolean') return bad(res, 'قيمة غير صالحة');
    await putSetting('google_signin', b.googleSignIn ? '' : 'off');
  }
  if ('supportEmail' in b) {
    const e = str(b.supportEmail, 120).toLowerCase();
    if (e && !emailOk(e)) return bad(res, 'بريد الدعم غير صحيح');
    await putSetting('support_email', e);
  }
  if ('supportInstagram' in b) {
    const raw = str(b.supportInstagram, 120), h = igHandle(raw);
    if (raw && !h) return bad(res, 'حساب إنستغرام غير صالح. اكتب الاسم فقط مثل awtad.iq أو الرابط.');
    await putSetting('support_instagram', h);
  }
  const sp = await getSupport();
  res.json({ googleSignIn: await googleEnabled(), googleConfigured: !!config.firebaseApiKey, supportEmail: sp.email, supportInstagram: sp.instagram });
});

/* ---- رسائل الدعم الفني ---- */
r.get('/support/count', async (_req, res) => res.json({ open: (await get("SELECT COUNT(*) c FROM support_tickets WHERE status='open'")).c }));
r.get('/support', async (_req, res) => {
  res.json(await all('SELECT id,user_id,name,email,topic,message,status,created_at FROM support_tickets ORDER BY (status=\'open\') DESC, id DESC LIMIT 300'));
});
r.patch('/support/:id', async (req, res) => {
  if (!['open', 'closed'].includes(req.body?.status)) return bad(res, 'حالة غير صالحة');
  const x = await run('UPDATE support_tickets SET status=? WHERE id=?', req.body.status, req.params.id);
  return x.changes ? res.json({ ok: true }) : bad(res, 'غير موجود', 404);
});
r.delete('/support/:id', async (req, res) => {
  const x = await run('DELETE FROM support_tickets WHERE id=?', req.params.id);
  return x.changes ? res.json({ ok: true }) : bad(res, 'غير موجود', 404);
});
r.get('/charts', async (_req, res) => {
  res.json({
    appsByStatus: await all('SELECT status, COUNT(*) c FROM applications GROUP BY status'),
    postingsBySpec: await all('SELECT spec, COUNT(*) c FROM postings GROUP BY spec'),
    signups: await all("SELECT substr(created_at, 1, 10) d, COUNT(*) c FROM users WHERE role<>'admin' GROUP BY d ORDER BY d DESC LIMIT 14"),
  });
});
r.get('/transactions', async (_req, res) => {
  res.json(await all('SELECT t.id,t.title,t.amount,t.cur,t.created_at,u.name AS user_name FROM wallet_tx t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 200'));
});

export default r;
