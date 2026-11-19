import { Router } from 'express';
import { config } from '../config.js';
import { all, get, run } from '../db.js';
import { role } from '../security.js';
import { POSTING_SQL, postingOut } from '../services.js';
import { bad, str } from '../utils.js';
import { getGoogleId } from './auth.js';

const r = Router();
r.use(role('admin'));

r.get('/users', (req, res) => {
  const q = `%${str(req.query.q, 60)}%`;
  const rl = req.query.role;
  res.json(all(`SELECT id,name,email,role,avatar,status,created_at FROM users WHERE (name LIKE ? OR email LIKE ?) ${rl ? 'AND role=?' : ''} ORDER BY id DESC`, q, q, ...(rl ? [rl] : [])));
});
r.patch('/users/:id', (req, res) => {
  const t = get('SELECT id FROM users WHERE id=?', req.params.id);
  if (!t) return bad(res, 'غير موجود', 404);
  if (t.id === req.user.id) return bad(res, 'لا يمكنك تعديل حسابك من هنا');
  if (['active', 'banned'].includes(req.body?.status)) {
    run('UPDATE users SET status=? WHERE id=?', req.body.status, t.id);
    if (req.body.status === 'banned') run('UPDATE users SET token_version=token_version+1 WHERE id=?', t.id);
  }
  res.json({ ok: true });
});
r.delete('/users/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) return bad(res, 'لا يمكنك حذف حسابك');
  run('DELETE FROM users WHERE id=?', req.params.id);
  res.json({ ok: true });
});
r.get('/postings', (_req, res) => {
  res.json(all(`${POSTING_SQL} ORDER BY p.id DESC`).map((x) => ({ ...postingOut(x), applicants: get('SELECT COUNT(*) c FROM applications WHERE posting_id=?', x.id).c })));
});
r.get('/settings', (_req, res) => {
  res.json({ googleClientId: getGoogleId(), fromEnv: !!config.googleClientId && !get("SELECT 1 FROM settings WHERE key='google_client_id'") });
});
r.put('/settings', (req, res) => {
  const id = str(req.body?.googleClientId, 200);
  if (id && !/\.apps\.googleusercontent\.com$/.test(id)) return bad(res, 'المعرّف يجب أن ينتهي بـ .apps.googleusercontent.com');
  if (id) run("INSERT INTO settings(key,value) VALUES('google_client_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", id);
  else run("DELETE FROM settings WHERE key='google_client_id'");
  res.json({ googleClientId: getGoogleId() });
});
r.get('/charts', (_req, res) => {
  res.json({
    appsByStatus: all('SELECT status, COUNT(*) c FROM applications GROUP BY status'),
    postingsBySpec: all('SELECT spec, COUNT(*) c FROM postings GROUP BY spec'),
    signups: all("SELECT strftime('%Y-%m-%d', created_at) d, COUNT(*) c FROM users WHERE role<>'admin' GROUP BY d ORDER BY d DESC LIMIT 14"),
  });
});
r.get('/transactions', (_req, res) => {
  res.json(all('SELECT t.id,t.title,t.amount,t.cur,t.created_at,u.name AS user_name FROM wallet_tx t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 200'));
});

export default r;
