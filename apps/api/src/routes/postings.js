import { Router } from 'express';
import { all, get, run } from '../db.js';
import { role } from '../security.js';
import { POSTING_SQL, postingOut, toIQD } from '../services.js';
import { SPECS, bad, num, parseList, safeUrl, str, wrap } from '../utils.js';

const r = Router();

r.get('/postings', (req, res) => {
  const { kind, spec, type, shift, min } = req.query;
  const filters = [['p.kind', kind], ['p.spec', spec], ['p.type', type], ['p.shift', shift]].filter(([, v]) => v);
  let rows = all(`${POSTING_SQL} WHERE p.status='open' AND u.status='active' ${filters.map(([c]) => `AND ${c}=?`).join(' ')} ORDER BY p.id DESC`, ...filters.map(([, v]) => v));
  if (min) rows = rows.filter((x) => toIQD(x.pay, x.cur) >= Number(min));
  const mine = req.user.role === 'student' ? all('SELECT posting_id,status FROM applications WHERE student_id=?', req.user.id) : [];
  res.json(rows.map((x) => ({ ...postingOut(x), my_status: mine.find((m) => m.posting_id === x.id)?.status || null })));
});

r.get('/postings/mine', role('company'), (req, res) => {
  res.json(all(`${POSTING_SQL} WHERE p.company_id=? ORDER BY p.id DESC`, req.user.id).map((x) => ({
    ...postingOut(x),
    applicants: get('SELECT COUNT(*) c FROM applications WHERE posting_id=?', x.id).c,
    pending: get("SELECT COUNT(*) c FROM applications WHERE posting_id=? AND status='pending'", x.id).c,
  })));
});

r.get('/postings/:id', (req, res) => {
  const x = get(`${POSTING_SQL} WHERE p.id=?`, req.params.id);
  if (!x) return bad(res, 'الفرصة غير موجودة', 404);
  const my = req.user.role === 'student' ? get('SELECT id,status,stage FROM applications WHERE posting_id=? AND student_id=?', x.id, req.user.id) : null;
  res.json({ ...postingOut(x), my_application: my || null });
});

/** يتحقق من حقول المنشور ويعيدها جاهزة للحفظ. */
function readPosting(b, kind, fallbackSpec = 'برمجة') {
  const title = str(b.title, 120), pay = num(b.pay);
  if (!title || !pay || pay <= 0) return null;
  const job = kind === 'job';
  return [
    title, str(b.description, 1500), SPECS.includes(b.spec) ? b.spec : fallbackSpec, pay, b.cur === 'ر.س' ? 'ر.س' : 'د.ع',
    job ? num(b.hours) || 6 : null, job ? str(b.schedule, 120) || 'يُحدد لاحقاً' : null,
    job ? (b.shift === 'مسائي' ? 'مسائي' : 'صباحي') : null, job ? (b.type === 'دوام كامل' ? 'دوام كامل' : 'دوام جزئي') : null,
    job ? null : num(b.days) || 7, str(b.address, 250), safeUrl(b.map_url), JSON.stringify(parseList(b.reqs)),
  ];
}

r.post('/postings', role('company'), wrap((req, res) => {
  const b = req.body || {};
  const kind = b.kind === 'project' ? 'project' : 'job';
  const v = readPosting(b, kind);
  if (!v) return bad(res, 'أكمل العنوان والمبلغ');
  const info = run(`INSERT INTO postings(company_id,kind,title,description,spec,pay,cur,hours,schedule,shift,type,days,address,map_url,reqs) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, req.user.id, kind, ...v);
  res.json({ id: Number(info.lastInsertRowid) });
}));

r.put('/postings/:id', role('company'), wrap((req, res) => {
  const p = get('SELECT * FROM postings WHERE id=? AND company_id=?', req.params.id, req.user.id);
  if (!p) return bad(res, 'غير مصرّح', 403);
  const v = readPosting(req.body || {}, p.kind, p.spec);
  if (!v) return bad(res, 'أكمل العنوان والمبلغ');
  run(`UPDATE postings SET title=?,description=?,spec=?,pay=?,cur=?,hours=?,schedule=?,shift=?,type=?,days=?,address=?,map_url=?,reqs=? WHERE id=?`, ...v, p.id);
  res.json({ id: p.id });
}));

r.patch('/postings/:id', wrap((req, res) => {
  const p = get('SELECT * FROM postings WHERE id=?', req.params.id);
  if (!p || (req.user.role !== 'admin' && p.company_id !== req.user.id)) return bad(res, 'غير مصرّح', 403);
  if (['open', 'closed'].includes(req.body?.status)) run('UPDATE postings SET status=? WHERE id=?', req.body.status, p.id);
  res.json({ ok: true });
}));

r.delete('/postings/:id', (req, res) => {
  const p = get('SELECT * FROM postings WHERE id=?', req.params.id);
  if (!p || (req.user.role !== 'admin' && p.company_id !== req.user.id)) return bad(res, 'غير مصرّح', 403);
  run('DELETE FROM postings WHERE id=?', p.id);
  res.json({ ok: true });
});

/* ---- التقديم ---- */
r.post('/postings/:id/apply', role('student'), wrap((req, res) => {
  const p = get("SELECT * FROM postings WHERE id=? AND status='open'", req.params.id);
  if (!p) return bad(res, 'الفرصة غير متاحة', 404);
  const message = str(req.body?.message, 800); if (!message) return bad(res, 'اكتب رسالة قصيرة');
  if (get('SELECT 1 FROM applications WHERE posting_id=? AND student_id=?', p.id, req.user.id)) return bad(res, 'قدّمت على هذه الفرصة مسبقاً', 409);
  const projects = (Array.isArray(req.body?.projects) ? req.body.projects : []).map((x) => str(x, 100)).filter(Boolean).slice(0, 2);
  run('INSERT INTO applications(posting_id,student_id,message,projects) VALUES(?,?,?,?)', p.id, req.user.id, message, JSON.stringify(projects));
  res.json({ ok: true });
}));

export default r;
