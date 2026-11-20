import { all, get, run, tx } from './db.js';
import { hashPassword, signToken } from './security.js';
import { SPECS, str } from './utils.js';

export function badges(works) {
  const b = [];
  const avg = works.length ? works.reduce((a, w) => a + w.rating, 0) / works.length : 0;
  if (works.length >= 1) b.push('أول إنجاز');
  if (works.length >= 2 && avg >= 4.5) b.push('منجز موثوق');
  if (works.length >= 3) b.push('مُنجز متميز');
  return { badges: b, avg: Math.round(avg * 10) / 10 };
}

export const balance = (uid) => all('SELECT cur, SUM(amount) AS total FROM wallet_tx WHERE user_id=? GROUP BY cur', uid);

export async function fullUser(id, { forSelf = false } = {}) {
  const u = await get('SELECT id,email,role,name,avatar,phone,status,created_at,(password_hash IS NOT NULL) AS has_password,(google_id IS NOT NULL) AS has_google FROM users WHERE id=?', id);
  if (!u) return null;
  if (!forSelf) { delete u.email; delete u.phone; delete u.has_password; delete u.has_google; }
  if (u.role === 'student') {
    Object.assign(u, await get('SELECT spec,status AS student_status,bio FROM student_profiles WHERE user_id=?', id));
    u.skills = await all('SELECT id,name,level FROM skills WHERE user_id=?', id);
    u.portfolio = await all('SELECT id,title,url FROM portfolio WHERE user_id=?', id);
    u.works = await all('SELECT id,title,rating,comment,company_name,amount,cur,created_at FROM works WHERE student_id=? ORDER BY id DESC', id);
    Object.assign(u, badges(u.works));
    if (forSelf) u.wallet = await balance(id);
  } else if (u.role === 'company') {
    Object.assign(u, await get('SELECT sector,city,about,address,map_url,contact_email FROM company_profiles WHERE user_id=?', id));
  }
  return u;
}

export const POSTING_SQL = `SELECT p.*, u.name AS company_name, u.avatar AS company_avatar, cp.city, cp.sector, cp.address AS caddress, cp.map_url AS cmap
  FROM postings p JOIN users u ON u.id=p.company_id LEFT JOIN company_profiles cp ON cp.user_id=u.id`;

export const postingOut = (r) => ({
  id: r.id, kind: r.kind, title: r.title, description: r.description, spec: r.spec, pay: r.pay, cur: r.cur,
  hours: r.hours, schedule: r.schedule, shift: r.shift, type: r.type, days: r.days, status: r.status,
  reqs: JSON.parse(r.reqs || '[]'), created_at: r.created_at,
  address: r.address || r.caddress || '', map_url: r.map_url || r.cmap || '',
  company: { id: r.company_id, name: r.company_name, avatar: r.company_avatar, city: r.city, sector: r.sector },
});

/** تحويل تقريبي للمقارنة بين العملات عند فلترة الراتب (1 دولار = 1500 دينار) */
export const toIQD = (n, cur) => (cur === 'USD' ? n * 1500 : n);

export async function appAccess(id, user) {
  const a = await get(`SELECT a.*, p.company_id, p.title AS posting_title, p.kind, p.pay, p.cur FROM applications a JOIN postings p ON p.id=a.posting_id WHERE a.id=?`, id);
  if (!a) return null;
  return user.role === 'admin' || a.student_id === user.id || a.company_id === user.id ? a : null;
}

export const addMsg = (appId, sender, text) => run('INSERT INTO messages(application_id,sender_id,text) VALUES(?,?,?)', appId, sender, text);

export async function createUser({ role, name, email, password, googleId, avatar, extra = {} }) {
  return await tx(async () => {
    const info = await run('INSERT INTO users(email,password_hash,google_id,role,name,avatar,email_verified) VALUES(?,?,?,?,?,?,?)',
      email, password ? hashPassword(password) : null, googleId || null, role, name, avatar || null, googleId ? 1 : 0);
    const id = Number(info.lastInsertRowid);
    if (role === 'student') {
      await run('INSERT INTO student_profiles(user_id,spec,status) VALUES(?,?,?)', id,
        SPECS.includes(extra.spec) ? extra.spec : 'برمجة', extra.student_status === 'خريج جديد' ? 'خريج جديد' : 'طالب');
      for (const s of String(extra.skills || '').split(/[,،]/).map((x) => x.trim()).filter(Boolean).slice(0, 15))
        await run('INSERT INTO skills(user_id,name) VALUES(?,?)', id, s.slice(0, 40));
    } else if (role === 'company') {
      await run('INSERT INTO company_profiles(user_id,sector,city,about,contact_email,address,map_url) VALUES(?,?,?,?,?,?,?)', id,
        str(extra.sector, 80), str(extra.city, 80), str(extra.about, 800), email, str(extra.city, 80),
        'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ' ' + str(extra.city, 80)));
    }
    return id;
  });
}

export const session = async (id) => ({ token: await signToken(id), user: await fullUser(id, { forSelf: true }) });
