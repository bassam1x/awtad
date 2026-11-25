import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/* اختبار شامل لكل المسارات على PostgreSQL (PGlite): يكشف فروقات SQL (التجميع، أنواع الأرقام، الأخطاء...) */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awtad-ep-'));
process.env.DB_FILE = path.join(dir, 'ep.db');
process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_MAX = '1000';
process.env.SERVE_WEB = 'false';

const { createApp } = await import('../src/app.js');
const { seedIfEmpty, syncAdminPassword, ADMIN } = await import('../src/seed.js');
const dbm = await import('../src/db.js');

let server, base;
before(async () => { await seedIfEmpty(); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { server.close(); await dbm.db.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* مؤقت */ } });

const call = async (method, p, body, token) => {
  const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const login = async (email, password = 'Demo@1234') => (await call('POST', '/api/auth/login', { email, password })).json?.token;
const ok = (r, s = 200) => { assert.equal(r.status, s, JSON.stringify(r.json)); return r.json; };

test('ping خفيف بلا مصادقة ولا قاعدة', async () => {
  const r = await call('GET', '/api/ping');
  assert.equal(r.status, 200); assert.deepEqual(r.json, { ok: true });
});

test('القاعدة PostgreSQL وفحص الصحة يلمسها', async () => {
  const h = ok(await call('GET', '/api/health'));
  assert.equal(h.ok, true); assert.equal(h.db, process.env.DATABASE_URL ? 'postgres' : 'pglite');
});

test('الإحصائيات والرسوم لكل دور: أرقام لا نصوص', async () => {
  const adm = await login(ADMIN.email, ADMIN.password);
  const a = ok(await call('GET', '/api/stats', null, adm));
  for (const k of ['students', 'companies', 'banned', 'postings', 'openPostings', 'applications', 'accepted']) assert.equal(typeof a[k], 'number', k);
  assert.ok(a.students >= 5 && Array.isArray(a.volume) && a.volume.every((v) => typeof v.total === 'number'), JSON.stringify(a.volume));
  const c = ok(await call('GET', '/api/admin/charts', null, adm));
  assert.ok(c.appsByStatus.every((x) => typeof x.c === 'number'));
  assert.ok(c.postingsBySpec.length >= 2); assert.match(c.signups[0].d, /^\d{4}-\d{2}-\d{2}$/);

  const co = await login('nibras@demo.iq');
  const cs = ok(await call('GET', '/api/stats', null, co));
  assert.equal(typeof cs.postings, 'number'); assert.ok(Array.isArray(cs.paid));
  const st = await login('sara@demo.iq');
  const ss = ok(await call('GET', '/api/stats', null, st));
  assert.equal(typeof ss.pending, 'number'); assert.ok(ss.wallet.every((w) => typeof w.total === 'number'));
  assert.equal(typeof ss.avg, 'number');
});

test('مسارات المدير: مستخدمون (بحث بلا حساسية للحالة)، منشورات، معاملات، إعدادات، حظر', async () => {
  const adm = await login(ADMIN.email, ADMIN.password);
  const byName = ok(await call('GET', '/api/admin/users?q=SARA', null, adm));
  assert.equal(byName.length, 1); assert.equal(byName[0].email, 'sara@demo.iq');
  assert.ok(ok(await call('GET', '/api/admin/users?q=&role=company', null, adm)).length >= 4);
  const posts = ok(await call('GET', '/api/admin/postings', null, adm));
  assert.ok(posts.length >= 8 && posts.every((p) => typeof p.applicants === 'number'));
  const tx = ok(await call('GET', '/api/admin/transactions', null, adm));
  assert.ok(tx.length > 0 && tx[0].user_name);
  assert.equal(ok(await call('GET', '/api/admin/settings', null, adm)).googleSignIn, true);
  ok(await call('PUT', '/api/admin/settings', { googleSignIn: false }, adm));
  assert.equal(ok(await call('GET', '/api/admin/settings', null, adm)).googleSignIn, false);
  ok(await call('PUT', '/api/admin/settings', { googleSignIn: true }, adm));
  assert.equal(ok(await call('GET', '/api/admin/settings', null, adm)).googleSignIn, true);
  const users = ok(await call('GET', '/api/admin/users?q=ali@', null, adm));
  const id = users[0].id;
  ok(await call('PATCH', `/api/admin/users/${id}`, { status: 'banned' }, adm));
  assert.equal((await call('POST', '/api/auth/login', { email: 'ali@demo.iq', password: 'Demo@1234' })).status, 403);
  ok(await call('PATCH', `/api/admin/users/${id}`, { status: 'active' }, adm));
  assert.equal((await call('PATCH', '/api/admin/users/abc', { status: 'active' }, adm)).status, 404);
});

test('تخصصات الخدمات ونوع الدوام «عن بعد»: تُحفظ وتُفلتر، والقيم الغريبة تعود للافتراضي', async () => {
  const st = await login('sara@demo.iq'), co = await login('nibras@demo.iq');
  const remote = ok(await call('POST', '/api/postings', { kind: 'job', title: 'موظف دعم عن بعد', pay: 600000, spec: 'خدمة عملاء', type: 'عن بعد', address: 'عنوان لا يُحفظ', map_url: 'https://maps.google.com/?q=x' }, co));
  const rest = ok(await call('POST', '/api/postings', { kind: 'job', title: 'ويتر', pay: 500000, spec: 'مطاعم وكافيهات', type: 'دوام كامل', address: 'الكرادة' }, co));
  const odd = ok(await call('POST', '/api/postings', { kind: 'job', title: 'وظيفة غريبة', pay: 400000, spec: 'ليست موجودة', type: 'نوع مخترع' }, co));
  const r = ok(await call('GET', `/api/postings/${remote.id}`, null, st));
  assert.equal(r.type, 'عن بعد'); assert.equal(r.spec, 'خدمة عملاء'); assert.ok(!r.address.includes('لا يُحفظ'), 'العنوان لا يُحفظ لوظيفة عن بعد'); assert.ok(!r.map_url.includes('x'), 'ولا رابط الموقع');
  const w = ok(await call('GET', `/api/postings/${rest.id}`, null, st)); assert.equal(w.spec, 'مطاعم وكافيهات'); assert.equal(w.address, 'الكرادة');
  const o = ok(await call('GET', `/api/postings/${odd.id}`, null, st)); assert.equal(o.spec, 'برمجة'); assert.equal(o.type, 'دوام جزئي');
  assert.equal(o.suitable_for, '', 'الشارة اختيارية: فارغة إن لم يحددها صاحب العمل');
  const sf = ok(await call('POST', '/api/postings', { kind: 'job', title: 'للطلاب', pay: 400000, suitable_for: 'مناسب للطلاب' }, co));
  assert.equal(ok(await call('GET', `/api/postings/${sf.id}`, null, st)).suitable_for, 'مناسب للطلاب');
  ok(await call('PUT', `/api/postings/${sf.id}`, { title: 'للطلاب', pay: 400000, suitable_for: 'نص حر كتبه صاحب العمل' }, co));
  assert.equal(ok(await call('GET', `/api/postings/${sf.id}`, null, st)).suitable_for, 'نص حر كتبه صاحب العمل');
  assert.ok(ok(await call('GET', '/api/postings?kind=job', null, st)).some((j) => j.suitable_for === 'مناسب للخريجين الجدد'), 'الفرص التجريبية تحتفظ بشارتها');
  assert.ok(ok(await call('GET', '/api/postings?type=' + encodeURIComponent('عن بعد'), null, st)).some((j) => j.id === remote.id));
  assert.ok(ok(await call('GET', '/api/postings?spec=' + encodeURIComponent('مطاعم وكافيهات'), null, st)).every((j) => j.spec === 'مطاعم وكافيهات'));
});

test('الفرص: قوائم وفلاتر وminimum وmine وتعديل وحذف', async () => {
  const st = await login('sara@demo.iq'), co = await login('nibras@demo.iq');
  const jobs = ok(await call('GET', '/api/postings?kind=job', null, st));
  assert.ok(jobs.length >= 4 && jobs.every((j) => j.kind === 'job'));
  assert.ok(ok(await call('GET', '/api/postings?spec=تصميم', null, st)).every((j) => j.spec === 'تصميم'));
  const rich = ok(await call('GET', '/api/postings?min=1000000', null, st));
  assert.ok(rich.length >= 1 && rich.every((j) => j.pay >= 1000000 || j.cur === 'USD'));
  const mine = ok(await call('GET', '/api/postings/mine', null, co));
  assert.ok(mine.length >= 3 && mine.every((p) => typeof p.applicants === 'number' && typeof p.pending === 'number'));
  const created = ok(await call('POST', '/api/postings', { kind: 'job', title: 'اختبار', pay: 500000, hours: 4 }, co));
  assert.equal(typeof created.id, 'number');
  assert.equal(ok(await call('GET', `/api/postings/${created.id}`, null, st)).title, 'اختبار');
  ok(await call('PUT', `/api/postings/${created.id}`, { title: 'معدّل', pay: 600000 }, co));
  assert.equal(ok(await call('GET', `/api/postings/${created.id}`, null, st)).pay, 600000);
  ok(await call('PATCH', `/api/postings/${created.id}`, { status: 'closed' }, co));
  assert.equal((await call('POST', `/api/postings/${created.id}/apply`, { message: 'x' }, st)).status, 404);
  ok(await call('DELETE', `/api/postings/${created.id}`, null, co));
  assert.equal((await call('GET', `/api/postings/${created.id}`, null, st)).status, 404);
  assert.equal((await call('GET', '/api/postings/abc', null, st)).status, 404);
});

test('الدعوات والمحادثات والتقديم والمهارات والمعرض والأشخاص', async () => {
  const co = await login('dijla@demo.iq'), st = await login('maryam@demo.iq');
  const mine = ok(await call('GET', '/api/postings/mine', null, co));
  const posting = mine.find((p) => p.kind === 'project');
  const students = ok(await call('GET', '/api/students?spec=هندسة', null, co));
  assert.ok(students.length >= 1 && students.every((s) => s.spec === 'هندسة'));
  const target = students.find((x) => x.name.includes('مريم'));
  ok(await call('POST', '/api/invites', { posting_id: posting.id, student_id: target.id }, co));
  assert.equal((await call('POST', '/api/invites', { posting_id: posting.id, student_id: target.id }, co)).status, 409);
  const inv = ok(await call('GET', '/api/invites', null, st));
  assert.equal(inv.length, 1);
  ok(await call('POST', `/api/invites/${inv[0].id}/accept`, null, st));
  const convs = ok(await call('GET', '/api/conversations', null, st));
  assert.ok(convs.length >= 1);
  const appId = convs[0].id;
  ok(await call('POST', `/api/applications/${appId}/messages`, { text: 'مرحباً' }, st));
  const msgs = ok(await call('GET', `/api/applications/${appId}/messages`, null, co));
  assert.ok(msgs.length >= 2 && msgs.some((m) => m.text === 'مرحباً'));
  assert.equal((await call('GET', '/api/applications/abc', null, st)).status, 404);
  assert.equal((await call('GET', '/api/applications/99999999', null, st)).status, 404);

  // تقديم + قائمة طلبات الشركة مع المهارات
  const sara = await login('sara@demo.iq');
  const open = ok(await call('GET', '/api/postings?kind=job', null, sara)).find((j) => !j.my_status);
  ok(await call('POST', `/api/postings/${open.id}/apply`, { message: 'أرغب بالتقديم', projects: ['لوحة مبيعات بسيطة'] }, sara));
  assert.equal((await call('POST', `/api/postings/${open.id}/apply`, { message: 'مرة ثانية' }, sara)).status, 409);
  const companyApps = ok(await call('GET', '/api/applications', null, await login('nibras@demo.iq')));
  assert.ok(companyApps.length >= 1 && Array.isArray(companyApps[0].skills) && Array.isArray(companyApps[0].projects));
  assert.ok(ok(await call('GET', '/api/applications', null, await login(ADMIN.email, ADMIN.password))).length >= 1);

  // مهارات ومعرض وملف
  let me = ok(await call('POST', '/api/me/skills', { name: 'Postgres', level: 'متقدم' }, sara));
  assert.ok(me.skills.some((s) => s.name === 'Postgres'));
  me = ok(await call('DELETE', `/api/me/skills/${me.skills.find((s) => s.name === 'Postgres').id}`, null, sara));
  assert.ok(!me.skills.some((s) => s.name === 'Postgres'));
  me = ok(await call('POST', '/api/me/portfolio', { title: 'مشروع', url: 'example.com' }, sara));
  assert.ok(me.portfolio.some((p) => p.url === 'https://example.com/'));
  assert.equal(typeof me.wallet[0].total, 'number'); assert.equal(typeof me.avg, 'number');
  me = ok(await call('PUT', '/api/me', { bio: 'نبذة جديدة', phone: '0770' }, sara));
  assert.equal(me.bio, 'نبذة جديدة');
  assert.equal(ok(await call('GET', `/api/people/${me.id}`, null, co)).email, undefined);
  assert.equal((await call('GET', '/api/people/xyz', null, co)).status, 404);
  assert.equal((await call('GET', '/api/people/999999', null, co)).status, 404);
  assert.equal(typeof ok(await call('GET', '/api/wallet', null, sara)).balances[0].total, 'number');
});

test('تسجيل الشركة والحذف والترجمة المخزّنة', async () => {
  const r = ok(await call('POST', '/api/auth/register', { role: 'company', name: 'شركة اختبار', email: 'pg-co@example.com', password: 'Passw0rd!', sector: 'تقنية', city: 'بغداد' }));
  assert.equal(r.user.role, 'company'); assert.equal(r.user.city, 'بغداد');
  assert.equal((await call('POST', '/api/auth/register', { role: 'company', name: 'x', email: 'pg-co@example.com', password: 'Passw0rd!' })).status, 409);
  ok(await call('DELETE', '/api/me', null, r.token));
  assert.equal((await call('GET', '/api/me', null, r.token)).status, 401);
  // تزامن: عدة تسجيلات دفعة واحدة لا تتعارض
  const many = await Promise.all(Array.from({ length: 6 }, (_, i) => call('POST', '/api/auth/register', { role: 'student', name: `طالب ${i}`, email: `par${i}@example.com`, password: 'Passw0rd!', skills: 'a,b,c' })));
  assert.ok(many.every((x) => x.status === 200));
  const ids = new Set(many.map((x) => x.json.user.id)); assert.equal(ids.size, 6);
});

test('ADMIN_PASSWORD مرجع كلمة مرور المدير: يُطبَّق عند الإقلاع ويُبطل الجلسات القديمة', async () => {
  const old = await login(ADMIN.email, ADMIN.password);
  assert.equal(await syncAdminPassword(''), false);          // غير معيّن: لا تغيير
  assert.equal(await syncAdminPassword('short'), false);     // أقصر من 8: يُتجاهل
  assert.equal(await syncAdminPassword(ADMIN.password), false); // نفس الكلمة: لا تغيير
  assert.equal(await syncAdminPassword('New-Admin-Pass-9'), true);
  assert.equal((await call('POST', '/api/auth/login', { email: ADMIN.email, password: ADMIN.password })).status, 401);
  assert.ok(await login(ADMIN.email, 'New-Admin-Pass-9'));
  assert.equal((await call('GET', '/api/me', null, old)).status, 401);  // الجلسة القديمة أُبطلت
  assert.equal(await syncAdminPassword('New-Admin-Pass-9'), false);     // مكرّر: لا تغيير
});
test('العملة: IQD وUSD فقط، وترحيل القيم القديمة (د.ع، ر.س) آمن للتكرار', async () => {
  const { MIGRATE } = await import('../src/schema.js');
  const co = await login('nibras@demo.iq');
  const a = ok(await call('POST', '/api/postings', { kind: 'job', title: 'بالدولار', pay: 900, cur: 'USD', hours: 5 }, co));
  const b = ok(await call('POST', '/api/postings', { kind: 'job', title: 'عملة غريبة', pay: 500000, cur: 'EUR', hours: 5 }, co));
  const st = await login('sara@demo.iq');
  assert.equal(ok(await call('GET', `/api/postings/${a.id}`, null, st)).cur, 'USD');
  assert.equal(ok(await call('GET', `/api/postings/${b.id}`, null, st)).cur, 'IQD');           // أي قيمة أخرى تصير IQD
  assert.ok(ok(await call('GET', '/api/postings?min=1000000', null, st)).some((p) => p.id === a.id)); // 900$ ≈ 1.35 مليون د.ع

  // بيانات قديمة: 3750 ر.س = 1000 دولار، و500000 د.ع
  const u = (await dbm.get("SELECT id FROM users WHERE email='sara@demo.iq'")).id;
  await dbm.run("INSERT INTO wallet_tx(user_id,title,amount,cur) VALUES(?,?,?,?)", u, 'قديم ريال', 3750, 'ر.س');
  await dbm.run("INSERT INTO wallet_tx(user_id,title,amount,cur) VALUES(?,?,?,?)", u, 'قديم دينار', 500000, 'د.ع');
  await dbm.db.exec(MIGRATE); await dbm.db.exec(MIGRATE); // مرتان: لا يتضاعف التحويل
  const rows = await dbm.all("SELECT title, amount, cur FROM wallet_tx WHERE title IN ('قديم ريال','قديم دينار') ORDER BY title");
  assert.deepEqual(rows.map((r) => [r.title, r.amount, r.cur]), [['قديم دينار', 500000, 'IQD'], ['قديم ريال', 1000, 'USD']]);
  const bal = ok(await call('GET', '/api/wallet', null, st)).balances;
  assert.ok(bal.every((x) => ['IQD', 'USD'].includes(x.cur)) && bal.some((x) => x.cur === 'USD' && x.total === 1000));
});