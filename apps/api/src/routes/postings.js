import { Router } from 'express';
import { all, get, run } from '../db.js';
import { role } from '../security.js';
import { POSTING_SQL, postingOut, toIQD } from '../services.js';
import { JOB_TYPES, MAX_MONEY, SPECS, bad, clamp, num, parseList, qs, safeUrl, str, wrap } from '../utils.js';

const r = Router();

r.get('/postings', async (req, res) => {
  // معاملات الاستعلام نصوص فقط (?a[]=1 أو التكرار لا يُسقطان الاستعلام)
  const kind = qs(req.query.kind), spec = qs(req.query.spec), type = qs(req.query.type), shift = qs(req.query.shift), min = qs(req.query.min);
  const filters = [['p.kind', kind], ['p.spec', spec], ['p.type', type], ['p.shift', shift]].filter(([, v]) => v);
  let rows = await all(`${POSTING_SQL} WHERE p.status='open' AND u.status='active' ${filters.map(([c]) => `AND ${c}=?`).join(' ')} ORDER BY p.id DESC`, ...filters.map(([, v]) => v));
  if (min && Number.isFinite(Number(min))) rows = rows.filter((x) => toIQD(x.pay, x.cur) >= Number(min));
  const mine = req.user.role === 'student' ? await all('SELECT posting_id,status FROM applications WHERE student_id=?', req.user.id) : [];
  res.json(rows.map((x) => ({ ...postingOut(x), my_status: mine.find((m) => m.posting_id === x.id)?.status || null })));
});

r.get('/postings/mine', role('company'), async (req, res) => {
  const rows = await all(`${POSTING_SQL} WHERE p.company_id=? ORDER BY p.id DESC`, req.user.id);
  res.json(await Promise.all(rows.map(async (x) => ({
    ...postingOut(x),
    applicants: (await get('SELECT COUNT(*) c FROM applications WHERE posting_id=?', x.id)).c,
    pending: (await get("SELECT COUNT(*) c FROM applications WHERE posting_id=? AND status='pending'", x.id)).c,
  }))));
});

r.get('/postings/:id', async (req, res) => {
  const x = await get(`${POSTING_SQL} WHERE p.id=?`, req.params.id);
  if (!x) return bad(res, 'الفرصة غير موجودة', 404);
  const my = req.user.role === 'student' ? await get('SELECT id,status,stage FROM applications WHERE posting_id=? AND student_id=?', x.id, req.user.id) : null;
  res.json({ ...postingOut(x), my_application: my || null });
});

/** يتحقق من حقول المنشور ويعيدها جاهزة للحفظ. */
function readPosting(b, kind, fallbackSpec = 'برمجة') {
  const title = str(b.title, 120), pay = num(b.pay);
  if (!title || !pay || pay <= 0 || pay > MAX_MONEY) return null;
  const job = kind === 'job';
  const remote = job && b.type === 'عن بعد';
  return [
    title, str(b.description, 1500), SPECS.includes(b.spec) ? b.spec : fallbackSpec, pay, b.cur === 'USD' ? 'USD' : 'IQD',
    job ? clamp(num(b.hours), 1, 24, 6) : null, job ? str(b.schedule, 120) || 'يُحدد لاحقاً' : null,
    job ? (b.shift === 'مسائي' ? 'مسائي' : 'صباحي') : null, job ? (JOB_TYPES.includes(b.type) ? b.type : 'دوام جزئي') : null,
    job ? null : clamp(num(b.days), 1, 365, 7), remote ? '' : str(b.address, 250), remote ? '' : safeUrl(b.map_url), JSON.stringify(parseList(b.reqs)), str(b.suitable_for, 80),
  ];
}

r.post('/postings', role('company'), wrap(async (req, res) => {
  const b = req.body || {};
  const kind = b.kind === 'project' ? 'project' : 'job';
  const v = readPosting(b, kind);
  if (!v) return bad(res, 'أكمل العنوان والمبلغ');
  const info = await run(`INSERT INTO postings(company_id,kind,title,description,spec,pay,cur,hours,schedule,shift,type,days,address,map_url,reqs,suitable_for) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, req.user.id, kind, ...v);
  res.json({ id: Number(info.lastInsertRowid) });
}));

r.put('/postings/:id', role('company'), wrap(async (req, res) => {
  const p = await get('SELECT * FROM postings WHERE id=? AND company_id=?', req.params.id, req.user.id);
  if (!p) return bad(res, 'غير مصرّح', 403);
  const v = readPosting(req.body || {}, p.kind, p.spec);
  if (!v) return bad(res, 'أكمل العنوان والمبلغ');
  await run(`UPDATE postings SET title=?,description=?,spec=?,pay=?,cur=?,hours=?,schedule=?,shift=?,type=?,days=?,address=?,map_url=?,reqs=?,suitable_for=? WHERE id=?`, ...v, p.id);
  res.json({ id: p.id });
}));

r.patch('/postings/:id', wrap(async (req, res) => {
  const p = await get('SELECT * FROM postings WHERE id=?', req.params.id);
  if (!p || (req.user.role !== 'admin' && p.company_id !== req.user.id)) return bad(res, 'غير مصرّح', 403);
  if (['open', 'closed'].includes(req.body?.status)) await run('UPDATE postings SET status=? WHERE id=?', req.body.status, p.id);
  res.json({ ok: true });
}));

r.delete('/postings/:id', async (req, res) => {
  const p = await get('SELECT * FROM postings WHERE id=?', req.params.id);
  if (!p || (req.user.role !== 'admin' && p.company_id !== req.user.id)) return bad(res, 'غير مصرّح', 403);
  await run('DELETE FROM postings WHERE id=?', p.id);
  res.json({ ok: true });
});

/* ---- التقديم ---- */
r.post('/postings/:id/apply', role('student'), wrap(async (req, res) => {
  const p = await get("SELECT * FROM postings WHERE id=? AND status='open'", req.params.id);
  if (!p) return bad(res, 'الفرصة غير متاحة', 404);
  const message = str(req.body?.message, 800); if (!message) return bad(res, 'اكتب رسالة قصيرة');
  if (await get('SELECT 1 FROM applications WHERE posting_id=? AND student_id=?', p.id, req.user.id)) return bad(res, 'قدّمت على هذه الفرصة مسبقاً', 409);
  const projects = (Array.isArray(req.body?.projects) ? req.body.projects : []).map((x) => str(x, 100)).filter(Boolean).slice(0, 2);
  try { await run('INSERT INTO applications(posting_id,student_id,message,projects) VALUES(?,?,?,?)', p.id, req.user.id, message, JSON.stringify(projects)); }
  catch (e) { if (e.code === '23505') return bad(res, 'قدّمت على هذه الفرصة مسبقاً', 409); throw e; } // طلبان متزامنان: يمنعهما القيد الفريد
  res.json({ ok: true });
}));

export default r;
