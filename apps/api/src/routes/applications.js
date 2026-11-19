import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { role } from '../security.js';
import { addMsg, appAccess, fullUser } from '../services.js';
import { bad, num, str } from '../utils.js';

const r = Router();
const parse = (x) => ({ ...x, projects: JSON.parse(x.projects || '[]') });

r.get('/applications', (req, res) => {
  const u = req.user;
  let rows;
  if (u.role === 'student') {
    rows = all(`SELECT a.*, p.title, p.kind, p.pay, p.cur, p.company_id, c.name AS company_name, c.avatar AS company_avatar
      FROM applications a JOIN postings p ON p.id=a.posting_id JOIN users c ON c.id=p.company_id WHERE a.student_id=? ORDER BY a.id DESC`, u.id);
  } else if (u.role === 'company') {
    const posting = req.query.posting;
    rows = all(`SELECT a.*, p.title, p.kind, p.pay, p.cur, p.company_id, s.name AS student_name, s.avatar AS student_avatar, sp.spec, sp.status AS student_status
      FROM applications a JOIN postings p ON p.id=a.posting_id JOIN users s ON s.id=a.student_id LEFT JOIN student_profiles sp ON sp.user_id=s.id
      WHERE p.company_id=? ${posting ? 'AND a.posting_id=?' : ''} ORDER BY a.id DESC`, u.id, ...(posting ? [posting] : []));
    for (const x of rows) x.skills = all('SELECT name,level FROM skills WHERE user_id=? LIMIT 6', x.student_id);
  } else {
    rows = all(`SELECT a.*, p.title, p.kind, p.pay, p.cur, s.name AS student_name, c.name AS company_name FROM applications a
      JOIN postings p ON p.id=a.posting_id JOIN users s ON s.id=a.student_id JOIN users c ON c.id=p.company_id ORDER BY a.id DESC LIMIT 300`);
  }
  res.json(rows.map(parse));
});

r.get('/applications/:id', (req, res) => {
  const a = appAccess(req.params.id, req.user); if (!a) return bad(res, 'غير موجود', 404);
  res.json({ ...parse(a), student: fullUser(a.student_id), company: fullUser(a.company_id) });
});

r.post('/applications/:id/accept', role('company'), (req, res) => {
  const a = appAccess(req.params.id, req.user);
  if (!a || a.company_id !== req.user.id || a.status !== 'pending') return bad(res, 'لا يمكن تنفيذ الإجراء', 403);
  tx(() => {
    run('UPDATE applications SET status=?, stage=? WHERE id=?', 'accepted', a.kind === 'project' ? 'progress' : null, a.id);
    addMsg(a.id, null, 'تم قبول الطلب. يمكنكما بدء المحادثة الآن.');
  });
  res.json({ ok: true });
});

r.post('/applications/:id/reject', role('company'), (req, res) => {
  const a = appAccess(req.params.id, req.user);
  if (!a || a.company_id !== req.user.id || a.status !== 'pending') return bad(res, 'لا يمكن تنفيذ الإجراء', 403);
  run("UPDATE applications SET status='rejected' WHERE id=?", a.id);
  res.json({ ok: true });
});

r.post('/applications/:id/deliver', role('student'), (req, res) => {
  const a = appAccess(req.params.id, req.user);
  if (!a || a.student_id !== req.user.id || a.stage !== 'progress') return bad(res, 'لا يمكن التسليم الآن', 403);
  tx(() => { run("UPDATE applications SET stage='delivered' WHERE id=?", a.id); addMsg(a.id, null, 'سلّم المبدع العمل وبانتظار اعتماد الشركة.'); });
  res.json({ ok: true });
});

r.post('/applications/:id/approve', role('company'), (req, res) => {
  const a = appAccess(req.params.id, req.user);
  if (!a || a.company_id !== req.user.id || a.stage !== 'delivered') return bad(res, 'لا يمكن الاعتماد الآن', 403);
  const rating = Math.min(5, Math.max(1, num(req.body?.rating) || 5));
  const comment = str(req.body?.comment, 400) || 'تم التسليم بنجاح.';
  const co = get('SELECT name FROM users WHERE id=?', a.company_id);
  tx(() => {
    run("UPDATE applications SET stage='paid' WHERE id=?", a.id);
    run('INSERT INTO wallet_tx(user_id,title,amount,cur) VALUES(?,?,?,?)', a.student_id, a.posting_title, a.pay, a.cur);
    run('INSERT INTO works(student_id,title,rating,comment,company_name,amount,cur) VALUES(?,?,?,?,?,?,?)', a.student_id, a.posting_title, rating, comment, co.name, a.pay, a.cur);
    addMsg(a.id, null, 'اعتُمد التسليم وحُوّل المبلغ إلى محفظة المبدع.');
  });
  res.json({ ok: true });
});

/* ---- المحادثة ---- */
r.get('/applications/:id/messages', (req, res) => {
  if (!appAccess(req.params.id, req.user)) return bad(res, 'غير موجود', 404);
  res.json(all('SELECT id,sender_id,text,created_at FROM messages WHERE application_id=? ORDER BY id', req.params.id));
});
r.post('/applications/:id/messages', (req, res) => {
  const a = appAccess(req.params.id, req.user);
  if (!a || a.status !== 'accepted' || req.user.role === 'admin') return bad(res, 'المحادثة غير متاحة', 403);
  const text = str(req.body?.text, 1000); if (!text) return bad(res, 'اكتب رسالة');
  addMsg(a.id, req.user.id, text);
  res.json({ ok: true });
});
r.get('/conversations', role('student', 'company'), (req, res) => {
  res.json(req.user.role === 'student'
    ? all(`SELECT a.id,a.stage,p.title,p.kind,p.pay,p.cur,c.id AS other_id,c.name AS other_name,c.avatar AS other_avatar FROM applications a JOIN postings p ON p.id=a.posting_id JOIN users c ON c.id=p.company_id WHERE a.student_id=? AND a.status='accepted' ORDER BY a.id DESC`, req.user.id)
    : all(`SELECT a.id,a.stage,p.title,p.kind,p.pay,p.cur,s.id AS other_id,s.name AS other_name,s.avatar AS other_avatar FROM applications a JOIN postings p ON p.id=a.posting_id JOIN users s ON s.id=a.student_id WHERE p.company_id=? AND a.status='accepted' ORDER BY a.id DESC`, req.user.id));
});

/* ---- الدعوات ---- */
r.post('/invites', role('company'), (req, res) => {
  const p = get("SELECT * FROM postings WHERE id=? AND company_id=? AND status='open'", req.body?.posting_id, req.user.id);
  const s = get("SELECT id FROM users WHERE id=? AND role='student' AND status='active'", req.body?.student_id);
  if (!p || !s) return bad(res, 'بيانات غير صحيحة');
  if (get('SELECT 1 FROM invites WHERE posting_id=? AND student_id=?', p.id, s.id) || get('SELECT 1 FROM applications WHERE posting_id=? AND student_id=?', p.id, s.id))
    return bad(res, 'سبق أن دُعي أو قدّم على هذه الفرصة', 409);
  run('INSERT INTO invites(posting_id,student_id) VALUES(?,?)', p.id, s.id);
  res.json({ ok: true });
});
r.get('/invites', role('student'), (req, res) => {
  res.json(all(`SELECT i.id,i.status,p.id AS posting_id,p.title,p.kind,p.pay,p.cur,c.name AS company_name,c.avatar AS company_avatar FROM invites i JOIN postings p ON p.id=i.posting_id JOIN users c ON c.id=p.company_id WHERE i.student_id=? AND i.status='open' ORDER BY i.id DESC`, req.user.id));
});
r.post('/invites/:id/accept', role('student'), (req, res) => {
  const i = get(`SELECT i.*, p.kind FROM invites i JOIN postings p ON p.id=i.posting_id WHERE i.id=? AND i.student_id=? AND i.status='open' AND p.status='open'`, req.params.id, req.user.id);
  if (!i) return bad(res, 'الدعوة غير موجودة', 404);
  tx(() => {
    run("UPDATE invites SET status='done' WHERE id=?", i.id);
    const info = run('INSERT INTO applications(posting_id,student_id,message,status,stage) VALUES(?,?,?,?,?)', i.posting_id, req.user.id, 'قبول دعوة من الشركة', 'accepted', i.kind === 'project' ? 'progress' : null);
    addMsg(Number(info.lastInsertRowid), null, 'تم قبول الدعوة. يمكنكما بدء المحادثة الآن.');
  });
  res.json({ ok: true });
});

export default r;
