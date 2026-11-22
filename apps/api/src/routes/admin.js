import { Router } from 'express';
import { config } from '../config.js';
import { all, get, run } from '../db.js';
import { role } from '../security.js';
import { POSTING_SQL, getSupport, postingOut } from '../services.js';
import { bad, emailOk, igHandle, qs, str } from '../utils.js';
import { getGoogleId } from './auth.js';

const r = Router();
r.use(role('admin'));

r.get('/users', async (req, res) => {
  const q = `%${str(req.query.q, 60)}%`;
  const rl = ['student', 'company', 'admin'].includes(qs(req.query.role)) ? req.query.role : '';
  res.json(await all(`SELECT id,name,email,role,avatar,status,created_at FROM users WHERE (name ILIKE ? OR email ILIKE ?) ${rl ? 'AND role=?' : ''} ORDER BY id DESC`, q, q, ...(rl ? [rl] : [])));
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
  res.json({ googleClientId: await getGoogleId(), fromEnv: !!config.googleClientId && !await get("SELECT 1 FROM settings WHERE key='google_client_id'"), supportEmail: sp.email, supportInstagram: sp.instagram });
});
const putSetting = (k, v) => (v ? run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, v) : run('DELETE FROM settings WHERE key=?', k));
r.put('/settings', async (req, res) => {
  const b = req.body || {};
  // كل حقل يُحدَّث فقط إن أُرسل (حتى لا يمسح حفظ قنوات الدعم إعداد Google أو العكس)
  if ('googleClientId' in b) {
    const id = str(b.googleClientId, 200);
    if (id && !/\.apps\.googleusercontent\.com$/.test(id)) return bad(res, 'المعرّف يجب أن ينتهي بـ .apps.googleusercontent.com');
    await putSetting('google_client_id', id);
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
  res.json({ googleClientId: await getGoogleId(), supportEmail: sp.email, supportInstagram: sp.instagram });
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
