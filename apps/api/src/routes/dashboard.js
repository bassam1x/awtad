import { Router } from 'express';
import { all, get } from '../db.js';
import { role } from '../security.js';
import { balance, fullUser } from '../services.js';
import { LANGS, translateMany } from '../translate.js';
import { bad, wrap } from '../utils.js';
import { rateLimit } from '../security.js';

const r = Router();
const count = (sql, ...p) => get(sql, ...p).c;

r.get('/wallet', role('student'), (req, res) => {
  res.json({ balances: balance(req.user.id), tx: all('SELECT id,title,amount,cur,created_at FROM wallet_tx WHERE user_id=? ORDER BY id DESC', req.user.id) });
});

r.get('/stats', (req, res) => {
  const u = req.user;
  if (u.role === 'student') {
    const f = fullUser(u.id, { forSelf: true });
    return res.json({
      pending: count("SELECT COUNT(*) c FROM applications WHERE student_id=? AND status='pending'", u.id),
      accepted: count("SELECT COUNT(*) c FROM applications WHERE student_id=? AND status='accepted'", u.id),
      rejected: count("SELECT COUNT(*) c FROM applications WHERE student_id=? AND status='rejected'", u.id),
      invites: count("SELECT COUNT(*) c FROM invites WHERE student_id=? AND status='open'", u.id),
      openJobs: count("SELECT COUNT(*) c FROM postings WHERE status='open'"),
      works: f.works.length, avg: f.avg, badges: f.badges, wallet: f.wallet,
    });
  }
  if (u.role === 'company') {
    const own = 'FROM applications a JOIN postings p ON p.id=a.posting_id WHERE p.company_id=?';
    return res.json({
      postings: count('SELECT COUNT(*) c FROM postings WHERE company_id=?', u.id),
      jobs: count("SELECT COUNT(*) c FROM postings WHERE company_id=? AND kind='job'", u.id),
      projects: count("SELECT COUNT(*) c FROM postings WHERE company_id=? AND kind='project'", u.id),
      applicants: count(`SELECT COUNT(*) c ${own}`, u.id),
      pending: count(`SELECT COUNT(*) c ${own} AND a.status='pending'`, u.id),
      awaiting: count(`SELECT COUNT(*) c ${own} AND a.stage='delivered'`, u.id),
      paid: all(`SELECT p.cur, SUM(p.pay) total ${own} AND a.stage='paid' GROUP BY p.cur`, u.id),
    });
  }
  res.json({
    students: count("SELECT COUNT(*) c FROM users WHERE role='student'"),
    companies: count("SELECT COUNT(*) c FROM users WHERE role='company'"),
    banned: count("SELECT COUNT(*) c FROM users WHERE status='banned'"),
    postings: count('SELECT COUNT(*) c FROM postings'),
    openPostings: count("SELECT COUNT(*) c FROM postings WHERE status='open'"),
    applications: count('SELECT COUNT(*) c FROM applications'),
    accepted: count("SELECT COUNT(*) c FROM applications WHERE status='accepted'"),
    volume: all('SELECT cur, SUM(amount) total FROM wallet_tx GROUP BY cur'),
    recent: all("SELECT id,name,role,avatar,created_at FROM users WHERE role<>'admin' ORDER BY id DESC LIMIT 6"),
  });
});

/* ترجمة محتوى المستخدمين إلى لغة الواجهة (مخزّنة دائماً). للمسجّلين فقط. */
r.post('/translate', rateLimit({ windowMs: 60 * 1000, max: 90 }), wrap(async (req, res) => {
  const { lang, texts } = req.body || {};
  if (!LANGS.includes(lang)) return bad(res, 'لغة غير مدعومة');
  if (!Array.isArray(texts) || !texts.length || texts.length > 40 || texts.some((x) => typeof x !== 'string' || x.length > 2000)) return bad(res, 'طلب غير صالح');
  res.json({ translations: await translateMany(texts, lang) });
}));

export default r;
