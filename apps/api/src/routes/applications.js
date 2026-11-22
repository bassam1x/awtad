import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { role } from '../security.js';
import { addMsg, appAccess, fullUser } from '../services.js';
import { UserError, bad, num, qs, str, wrap } from '../utils.js';
import { rateLimit } from '../security.js';

const r = Router();
const parse = (x) => ({ ...x, projects: JSON.parse(x.projects || '[]') });

r.get('/applications', async (req, res) => {
  const u = req.user;
  let rows;
  if (u.role === 'student') {
    rows = await all(`SELECT a.*, p.title, p.kind, p.pay, p.cur, p.company_id, c.name AS company_name, c.avatar AS company_avatar
      FROM applications a JOIN postings p ON p.id=a.posting_id JOIN users c ON c.id=p.company_id WHERE a.student_id=? ORDER BY a.id DESC`, u.id);
  } else if (u.role === 'company') {
    const posting = qs(req.query.posting);
    rows = await all(`SELECT a.*, p.title, p.kind, p.pay, p.cur, p.company_id, s.name AS student_name, s.avatar AS student_avatar, sp.spec, sp.status AS student_status
      FROM applications a JOIN postings p ON p.id=a.posting_id JOIN users s ON s.id=a.student_id LEFT JOIN student_profiles sp ON sp.user_id=s.id
      WHERE p.company_id=? ${posting ? 'AND a.posting_id=?' : ''} ORDER BY a.id DESC`, u.id, ...(posting ? [posting] : []));
    for (const x of rows) x.skills = await all('SELECT name,level FROM skills WHERE user_id=? LIMIT 6', x.student_id);
  } else {
    rows = await all(`SELECT a.*, p.title, p.kind, p.pay, p.cur, s.name AS student_name, c.name AS company_name FROM applications a
      JOIN postings p ON p.id=a.posting_id JOIN users s ON s.id=a.student_id JOIN users c ON c.id=p.company_id ORDER BY a.id DESC LIMIT 300`);
  }
  res.json(rows.map(parse));
});

r.get('/applications/:id', async (req, res) => {
  const a = await appAccess(req.params.id, req.user); if (!a) return bad(res, 'غير موجود', 404);
  res.json({ ...parse(a), student: await fullUser(a.student_id), company: await fullUser(a.company_id) });
});

/* كل انتقال حالة يتم بتحديث مشروط داخل المعاملة (WHERE status/stage = القيمة المتوقعة) ويُتحقق من عدد الصفوف المتأثرة،
   فلو وصل طلبان متزامنان لنفس الإجراء نجح أحدهما فقط ولا تتكرر دفعة ولا رسالة. */
const already = () => new UserError('تم تنفيذ هذا الإجراء مسبقاً', 409);

r.post('/applications/:id/accept', role('company'), wrap(async (req, res) => {
  const a = await appAccess(req.params.id, req.user);
  if (!a || a.company_id !== req.user.id || a.status !== 'pending') return bad(res, 'لا يمكن تنفيذ الإجراء', 403);
  await tx(async () => {
    if (!(await run("UPDATE applications SET status='accepted', stage=? WHERE id=? AND status='pending'", a.kind === 'project' ? 'progress' : null, a.id)).changes) throw already();
    await addMsg(a.id, null, 'تم قبول الطلب. يمكنكما بدء المحادثة الآن.');
  });
  res.json({ ok: true });
}));

r.post('/applications/:id/reject', role('company'), wrap(async (req, res) => {
  const a = await appAccess(req.params.id, req.user);
  if (!a || a.company_id !== req.user.id || a.status !== 'pending') return bad(res, 'لا يمكن تنفيذ الإجراء', 403);
  if (!(await run("UPDATE applications SET status='rejected' WHERE id=? AND status='pending'", a.id)).changes) throw already();
  res.json({ ok: true });
}));

r.post('/applications/:id/deliver', role('student'), wrap(async (req, res) => {
  const a = await appAccess(req.params.id, req.user);
  if (!a || a.student_id !== req.user.id || a.stage !== 'progress') return bad(res, 'لا يمكن التسليم الآن', 403);
  await tx(async () => {
    if (!(await run("UPDATE applications SET stage='delivered' WHERE id=? AND stage='progress'", a.id)).changes) throw already();
    await addMsg(a.id, null, 'سلّم المبدع العمل وبانتظار اعتماد الشركة.');
  });
  res.json({ ok: true });
}));

r.post('/applications/:id/approve', role('company'), wrap(async (req, res) => {
  const a = await appAccess(req.params.id, req.user);
  if (!a || a.company_id !== req.user.id || a.stage !== 'delivered') return bad(res, 'لا يمكن الاعتماد الآن', 403);
  const rating = Math.min(5, Math.max(1, num(req.body?.rating) || 5));
  const comment = str(req.body?.comment, 400) || 'تم التسليم بنجاح.';
  const co = await get('SELECT name FROM users WHERE id=?', a.company_id);
  await tx(async () => {
    // الدفع مرة واحدة فقط مهما تكررت الطلبات المتزامنة
    if (!(await run("UPDATE applications SET stage='paid' WHERE id=? AND stage='delivered'", a.id)).changes) throw already();
    await run('INSERT INTO wallet_tx(user_id,title,amount,cur) VALUES(?,?,?,?)', a.student_id, a.posting_title, a.pay, a.cur);
    await run('INSERT INTO works(student_id,title,rating,comment,company_name,amount,cur) VALUES(?,?,?,?,?,?,?)', a.student_id, a.posting_title, rating, comment, co.name, a.pay, a.cur);
    await addMsg(a.id, null, 'اعتُمد التسليم وحُوّل المبلغ إلى محفظة المبدع.');
  });
  res.json({ ok: true });
}));

/* ---- المحادثة ---- */
r.get('/applications/:id/messages', async (req, res) => {
  if (!await appAccess(req.params.id, req.user)) return bad(res, 'غير موجود', 404);
  res.json(await all('SELECT id,sender_id,text,created_at FROM messages WHERE application_id=? ORDER BY id', req.params.id));
});
const msgLimit = rateLimit({ windowMs: 60 * 1000, max: 40, key: (req) => `msg${req.user.id}` });
r.post('/applications/:id/messages', msgLimit, async (req, res) => {
  const a = await appAccess(req.params.id, req.user);
  if (!a || a.status !== 'accepted' || req.user.role === 'admin') return bad(res, 'المحادثة غير متاحة', 403);
  const text = str(req.body?.text, 1000); if (!text) return bad(res, 'اكتب رسالة');
  await addMsg(a.id, req.user.id, text);
  res.json({ ok: true });
});
r.get('/conversations', role('student', 'company'), async (req, res) => {
  res.json(req.user.role === 'student'
    ? await all(`SELECT a.id,a.stage,p.title,p.kind,p.pay,p.cur,c.id AS other_id,c.name AS other_name,c.avatar AS other_avatar FROM applications a JOIN postings p ON p.id=a.posting_id JOIN users c ON c.id=p.company_id WHERE a.student_id=? AND a.status='accepted' ORDER BY a.id DESC`, req.user.id)
    : await all(`SELECT a.id,a.stage,p.title,p.kind,p.pay,p.cur,s.id AS other_id,s.name AS other_name,s.avatar AS other_avatar FROM applications a JOIN postings p ON p.id=a.posting_id JOIN users s ON s.id=a.student_id WHERE p.company_id=? AND a.status='accepted' ORDER BY a.id DESC`, req.user.id));
});

/* ---- الدعوات ---- */
r.post('/invites', role('company'), async (req, res) => {
  const p = await get("SELECT * FROM postings WHERE id=? AND company_id=? AND status='open'", req.body?.posting_id, req.user.id);
  const s = await get("SELECT id FROM users WHERE id=? AND role='student' AND status='active'", req.body?.student_id);
  if (!p || !s) return bad(res, 'بيانات غير صحيحة');
  if (await get('SELECT 1 FROM invites WHERE posting_id=? AND student_id=?', p.id, s.id) || await get('SELECT 1 FROM applications WHERE posting_id=? AND student_id=?', p.id, s.id))
    return bad(res, 'سبق أن دُعي أو قدّم على هذه الفرصة', 409);
  await run('INSERT INTO invites(posting_id,student_id) VALUES(?,?)', p.id, s.id);
  res.json({ ok: true });
});
r.get('/invites', role('student'), async (req, res) => {
  res.json(await all(`SELECT i.id,i.status,p.id AS posting_id,p.title,p.kind,p.pay,p.cur,c.name AS company_name,c.avatar AS company_avatar FROM invites i JOIN postings p ON p.id=i.posting_id JOIN users c ON c.id=p.company_id WHERE i.student_id=? AND i.status='open' ORDER BY i.id DESC`, req.user.id));
});
r.post('/invites/:id/accept', role('student'), wrap(async (req, res) => {
  const i = await get(`SELECT i.*, p.kind FROM invites i JOIN postings p ON p.id=i.posting_id WHERE i.id=? AND i.student_id=? AND i.status='open' AND p.status='open'`, req.params.id, req.user.id);
  if (!i) return bad(res, 'الدعوة غير موجودة', 404);
  await tx(async () => {
    if (!(await run("UPDATE invites SET status='done' WHERE id=? AND status='open'", i.id)).changes) throw already();
    const info = await run('INSERT INTO applications(posting_id,student_id,message,status,stage) VALUES(?,?,?,?,?)', i.posting_id, req.user.id, 'قبول دعوة من الشركة', 'accepted', i.kind === 'project' ? 'progress' : null);
    await addMsg(Number(info.lastInsertRowid), null, 'تم قبول الدعوة. يمكنكما بدء المحادثة الآن.');
  });
  res.json({ ok: true });
}));

export default r;
