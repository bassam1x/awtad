import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { checkPassword, hashPassword, role, signToken } from '../security.js';
import { fullUser } from '../services.js';
import { SPECS, UserError, bad, emailOk, safeAvatar, safeUrl, str, wrap } from '../utils.js';

const r = Router();

r.get('/me', (req, res) => res.json(fullUser(req.user.id, { forSelf: true })));

r.put('/me', wrap((req, res) => {
  const b = req.body || {}; const id = req.user.id;
  tx(() => {
    if (b.name !== undefined) { const n = str(b.name, 80); if (!n) throw new UserError('الاسم مطلوب'); run('UPDATE users SET name=? WHERE id=?', n, id); }
    if (b.email !== undefined) {
      const e = str(b.email, 120).toLowerCase();
      if (!emailOk(e)) throw new UserError('البريد الإلكتروني غير صحيح');
      if (get('SELECT 1 FROM users WHERE email=? AND id<>?', e, id)) throw new UserError('البريد مستخدم لحساب آخر');
      run('UPDATE users SET email=?, email_verified=0 WHERE id=? AND email<>?', e, id, e);
    }
    if (b.phone !== undefined) run('UPDATE users SET phone=? WHERE id=?', str(b.phone, 30), id);
    if (b.avatar !== undefined) run('UPDATE users SET avatar=? WHERE id=?', safeAvatar(b.avatar), id);
    if (req.user.role === 'student') {
      if (SPECS.includes(b.spec)) run('UPDATE student_profiles SET spec=? WHERE user_id=?', b.spec, id);
      if (['طالب', 'خريج جديد'].includes(b.student_status)) run('UPDATE student_profiles SET status=? WHERE user_id=?', b.student_status, id);
      if (b.bio !== undefined) run('UPDATE student_profiles SET bio=? WHERE user_id=?', str(b.bio, 1000), id);
    }
    if (req.user.role === 'company') {
      for (const [k, max] of [['sector', 80], ['city', 80], ['about', 1000], ['address', 250], ['map_url', 600], ['contact_email', 120]])
        if (b[k] !== undefined) run(`UPDATE company_profiles SET ${k}=? WHERE user_id=?`, k === 'map_url' ? safeUrl(b[k], max) : str(b[k], max), id);
    }
  });
  res.json(fullUser(id, { forSelf: true }));
}));

r.put('/me/password', wrap((req, res) => {
  const u = get('SELECT password_hash FROM users WHERE id=?', req.user.id);
  const { current, next } = req.body || {};
  if (u.password_hash && !checkPassword(String(current || ''), u.password_hash)) return bad(res, 'كلمة المرور الحالية غير صحيحة', 401);
  if (String(next || '').length < 8) return bad(res, 'كلمة المرور الجديدة 8 أحرف على الأقل');
  // رفع نسخة التوكن يُبطل كل الجلسات القديمة؛ نُعيد توكناً جديداً لهذه الجلسة.
  run('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', hashPassword(String(next)), req.user.id);
  res.json({ ok: true, token: signToken(req.user.id) });
}));

r.delete('/me', role('student', 'company'), (req, res) => { run('DELETE FROM users WHERE id=?', req.user.id); res.json({ ok: true }); });

const mine = (req) => fullUser(req.user.id, { forSelf: true });
r.post('/me/skills', role('student'), (req, res) => {
  const name = str(req.body?.name, 40); if (!name) return bad(res, 'أدخل اسم المهارة');
  const level = ['مبتدئ', 'جيد', 'جيد جداً', 'متقدم'].includes(req.body?.level) ? req.body.level : 'مبتدئ';
  run('INSERT INTO skills(user_id,name,level) VALUES(?,?,?)', req.user.id, name, level);
  res.json(mine(req));
});
r.delete('/me/skills/:id', role('student'), (req, res) => { run('DELETE FROM skills WHERE id=? AND user_id=?', req.params.id, req.user.id); res.json(mine(req)); });
r.post('/me/portfolio', role('student'), (req, res) => {
  const title = str(req.body?.title, 80); if (!title) return bad(res, 'أدخل عنوان المشروع');
  let url = str(req.body?.url, 300); if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  run('INSERT INTO portfolio(user_id,title,url) VALUES(?,?,?)', req.user.id, title, safeUrl(url, 300));
  res.json(mine(req));
});
r.delete('/me/portfolio/:id', role('student'), (req, res) => { run('DELETE FROM portfolio WHERE id=? AND user_id=?', req.params.id, req.user.id); res.json(mine(req)); });

/* ---- أشخاص ---- */
r.get('/students', role('company', 'admin'), (req, res) => {
  const spec = req.query.spec;
  const ids = all(`SELECT u.id FROM users u JOIN student_profiles sp ON sp.user_id=u.id WHERE u.role='student' AND u.status='active' ${spec ? 'AND sp.spec=?' : ''} ORDER BY u.id DESC`, ...(spec ? [spec] : []));
  res.json(ids.map((x) => fullUser(x.id)));
});
r.get('/people/:id', (req, res) => {
  const u = fullUser(Number(req.params.id));
  if (!u || u.role === 'admin') return bad(res, 'غير موجود', 404);
  res.json(u);
});

export default r;
