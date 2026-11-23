import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

/* اختبارات أمنية: صلاحيات وIDOR، سباقات الدفع، تحقق المدخلات، حماية الدخول، رؤوس الحماية، والحسابات التجريبية. */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awtad-sec-'));
process.env.DB_FILE = path.join(dir, 'sec.db');
process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_MAX = '1000';
process.env.SERVE_WEB = 'false';

const { createApp } = await import('../src/app.js');
const { seedIfEmpty, ADMIN } = await import('../src/seed.js');
const { setMailer } = await import('../src/mailer.js');
const dbm = await import('../src/db.js');

let server, base; const mails = [];
before(async () => { await seedIfEmpty(); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}`; setMailer(async (m) => { mails.push(m); return true; }); });
after(async () => { server.close(); await dbm.db.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* مؤقت */ } });

const call = async (method, p, body, token, headers = {}) => {
  const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null), headers: res.headers };
};
const login = async (email, password = 'Demo@1234') => (await call('POST', '/api/auth/login', { email, password })).json?.token;
const ok = (r, s = 200) => { assert.equal(r.status, s, JSON.stringify(r.json)); return r.json; };
const settle = () => new Promise((r) => setTimeout(r, 80));

test('رؤوس الحماية وCORS: لا كشف للتقنية، ولا سماح لأصل غريب، والردود غير مخزَّنة', async () => {
  const r = await call('GET', '/api/ping', undefined, null, { origin: 'https://evil.example' });
  const h = r.headers;
  assert.equal(h.get('x-powered-by'), null);
  assert.equal(h.get('x-content-type-options'), 'nosniff');
  assert.ok(h.get('permissions-policy'), 'Permissions-Policy');
  assert.match(h.get('content-security-policy') || '', /default-src 'self'/);
  assert.match(h.get('content-security-policy') || '', /object-src 'none'/);
  assert.match(h.get('content-security-policy') || '', /frame-ancestors 'self'/);
  assert.equal(h.get('access-control-allow-origin'), null, 'أصل غريب لا يُسمح له');
  assert.match(h.get('cache-control') || '', /no-store/);
});

test('المصادقة: رموز مزوّرة أو بلا توقيع أو بسر آخر أو تذاكر داخلية لا تدخل', async () => {
  assert.equal((await call('GET', '/api/me')).status, 401);
  assert.equal((await call('GET', '/api/me', undefined, 'garbage')).status, 401);
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"id":1,"v":0}').toString('base64url')}.`;
  assert.equal((await call('GET', '/api/me', undefined, none)).status, 401, 'alg=none');
  assert.equal((await call('GET', '/api/me', undefined, jwt.sign({ id: 1, v: 0 }, 'غير-السر'))).status, 401, 'سر آخر');
  const real = await login('sara@demo.iq');
  const id = jwt.decode(real).id;
  assert.equal((await call('GET', '/api/me', undefined, jwt.sign({ id, v: 0, tk: 1, kind: 'linkedin' }, 'test-secret'))).status, 401, 'تذكرة LinkedIn لا تصلح كجلسة');
  assert.equal((await call('GET', '/api/me', undefined, real)).status, 200);
});

test('الصلاحيات: المدير للمدير فقط، وقوائم الطلاب للشركات، والمحفظة للطلاب', async () => {
  const st = await login('sara@demo.iq'), co = await login('nibras@demo.iq'), adm = await login(ADMIN.email, ADMIN.password);
  for (const p of ['/api/admin/users', '/api/admin/postings', '/api/admin/settings', '/api/admin/transactions']) {
    assert.equal((await call('GET', p, undefined, st)).status, 403, p + ' للطالب');
    assert.equal((await call('GET', p, undefined, co)).status, 403, p + ' للشركة');
    assert.equal((await call('GET', p, undefined, adm)).status, 200, p + ' للمدير');
  }
  assert.equal((await call('GET', '/api/students', undefined, st)).status, 403);
  assert.equal((await call('GET', '/api/wallet', undefined, co)).status, 403);
  assert.equal((await call('POST', '/api/postings', { kind: 'job', title: 'x', pay: 1 }, st)).status, 403, 'الطالب لا ينشر');
  assert.equal((await call('PUT', '/api/admin/settings', { googleClientId: 'x.apps.googleusercontent.com' }, co)).status, 403);
});

test('الخصوصية وIDOR: لا بريد ولا هاتف للآخرين، ولا وصول لطلبات ومحادثات غيرك', async () => {
  const st = await login('sara@demo.iq'), co = await login('nibras@demo.iq'), other = await login('dijla@demo.iq');
  const meId = jwt.decode(st).id;
  const mine = ok(await call('GET', '/api/me', undefined, st)); assert.ok(mine.email);
  const cid = jwt.decode(co).id;
  const pub = ok(await call('GET', `/api/people/${cid}`, undefined, st));
  assert.equal(pub.email, undefined); assert.equal(pub.phone, undefined);
  const list = ok(await call('GET', '/api/students', undefined, co)); assert.ok(list.every((s) => s.email === undefined && s.phone === undefined));
  // طلب يخص شركة nibras: شركة أخرى (dijla) لا تراه ولا تتحكم به
  const apps = ok(await call('GET', '/api/applications', undefined, co)); assert.ok(apps.length);
  const a = apps.find((x) => x.status === 'accepted') || apps[0];
  assert.equal((await call('GET', `/api/applications/${a.id}`, undefined, other)).status, 404);
  assert.equal((await call('GET', `/api/applications/${a.id}/messages`, undefined, other)).status, 404);
  assert.equal((await call('POST', `/api/applications/${a.id}/messages`, { text: 'اختراق' }, other)).status, 403);
  for (const act of ['accept', 'reject', 'approve']) assert.equal((await call('POST', `/api/applications/${a.id}/${act}`, {}, other)).status, 403, act);
  // طالب آخر لا يسلّم عمل غيره
  const st2 = await login('ali@demo.iq').catch(() => null);
  if (st2 && jwt.decode(st2).id !== a.student_id) assert.equal((await call('POST', `/api/applications/${a.id}/deliver`, {}, st2)).status, 403);
  // شركة أخرى لا تعدّل ولا تحذف منشور غيرها
  const post = ok(await call('GET', '/api/postings/mine', undefined, co))[0];
  assert.equal((await call('PUT', `/api/postings/${post.id}`, { title: 'x', pay: 5 }, other)).status, 403);
  assert.equal((await call('DELETE', `/api/postings/${post.id}`, undefined, other)).status, 403);
  assert.ok(meId);
});

test('الدفع: اعتماد التسليم مرتين بالتزامن لا يحوّل المبلغ إلا مرة واحدة', async () => {
  const co = await login('nibras@demo.iq');
  const students = ok(await call('GET', '/api/students', undefined, co));
  const sid = students.find((s) => s.name)?.id;
  const stEmail = (await dbm.get('SELECT email FROM users WHERE id=?', sid)).email;
  const st = await login(stEmail);
  const { id: pid } = ok(await call('POST', '/api/postings', { kind: 'project', title: 'مشروع اختبار السباق', pay: 77777, days: 3 }, co));
  ok(await call('POST', `/api/postings/${pid}/apply`, { message: 'أرغب بالتنفيذ' }, st));
  const app = ok(await call('GET', '/api/applications', undefined, st)).find((x) => x.posting_id === pid);
  ok(await call('POST', `/api/applications/${app.id}/accept`, {}, co));
  ok(await call('POST', `/api/applications/${app.id}/deliver`, {}, st));
  const rs = await Promise.all(Array.from({ length: 6 }, () => call('POST', `/api/applications/${app.id}/approve`, { rating: 5 }, co)));
  assert.equal(rs.filter((r) => r.status === 200).length, 1, `نجح اعتماد واحد فقط: ${rs.map((r) => r.status)}`);
  assert.ok(rs.every((r) => r.status < 500), 'لا أخطاء خادم');
  const w = ok(await call('GET', '/api/wallet', undefined, st));
  assert.equal(w.tx.filter((t) => t.title === 'مشروع اختبار السباق').length, 1, 'دفعة واحدة فقط');
  assert.equal((await dbm.get('SELECT COUNT(*) c FROM works WHERE title=?', 'مشروع اختبار السباق')).c, 1);
});

test('التقديم المتزامن المكرر: واحد ينجح والبقية 409 لا 500', async () => {
  const co = await login('nibras@demo.iq'), st = await login('sara@demo.iq');
  const { id: pid } = ok(await call('POST', '/api/postings', { kind: 'job', title: 'وظيفة اختبار تقديم', pay: 500000 }, co));
  const rs = await Promise.all(Array.from({ length: 4 }, () => call('POST', `/api/postings/${pid}/apply`, { message: 'مهتم' }, st)));
  assert.equal(rs.filter((r) => r.status === 200).length, 1, rs.map((r) => r.status).join());
  assert.ok(rs.every((r) => [200, 409].includes(r.status)), rs.map((r) => r.status).join());
});

test('المدخلات: قيم ضخمة أو مصفوفات أو حقن SQL لا تُسقط الخادم ولا تسرّب', async () => {
  const co = await login('nibras@demo.iq'), st = await login('sara@demo.iq');
  assert.equal((await call('POST', '/api/postings', { kind: 'job', title: 'ضخم', pay: 1e15 }, co)).status, 400, 'مبلغ ضخم');
  assert.equal((await call('POST', '/api/postings', { kind: 'job', title: 'ساعات', pay: 100, hours: 9999 }, co)).status, 200);
  const created = ok(await call('GET', '/api/postings?kind=job', undefined, st)).find((j) => j.title === 'ساعات');
  assert.ok(created.hours <= 24, 'ساعات العمل محدودة');
  for (const q of ['spec[]=a&spec=b', "spec=' OR 1=1--", 'min=abc', 'type[x]=1', 'kind=job&kind=project', 'shift=%00']) {
    const r = await call('GET', `/api/postings?${q}`, undefined, st); assert.ok(r.status < 500, `${q} → ${r.status}`);
  }
  const inj = await call('GET', `/api/postings?spec=${encodeURIComponent("' OR '1'='1")}`, undefined, st);
  assert.equal(inj.status, 200); assert.equal(inj.json.length, 0, 'الحقن لا يرجع بيانات');
  assert.ok((await call('GET', '/api/admin/users?role[]=a', undefined, await login(ADMIN.email, ADMIN.password))).status < 500);
  assert.ok((await call('GET', '/api/students?spec[]=a', undefined, co)).status < 500);
  assert.equal((await call('POST', '/api/translate', { lang: 'en', texts: Array(10).fill('ا'.repeat(1000)) }, st)).status, 400, 'حجم الترجمة الكلي محدود');
});

test('كلمات المرور: حد أقصى للطول (لا استنزاف)، والتغيير يُبطل الجلسات القديمة', async () => {
  assert.equal((await call('POST', '/api/auth/register', { role: 'student', name: 'ط', email: 'longpw@example.com', password: 'x'.repeat(5000) })).status, 400);
  const reg = ok(await call('POST', '/api/auth/register', { role: 'student', name: 'جلسة', email: 'sess@example.com', password: 'Pass-Word-1' }));
  const old = reg.token;
  assert.equal((await call('PUT', '/api/me/password', { current: 'Pass-Word-1', next: 'y'.repeat(5000) }, old)).status, 400);
  const ch = ok(await call('PUT', '/api/me/password', { current: 'Pass-Word-1', next: 'Another-Pass-2' }, old));
  assert.equal((await call('GET', '/api/me', undefined, old)).status, 401, 'الجلسة القديمة أُبطلت');
  assert.equal((await call('GET', '/api/me', undefined, ch.token)).status, 200);
});

test('تغيير البريد يتطلب كلمة المرور الحالية (منع الاستيلاء بجلسة مسروقة)', async () => {
  const reg = ok(await call('POST', '/api/auth/register', { role: 'student', name: 'بريد', email: 'chg@example.com', password: 'Pass-Word-1' }));
  const t = reg.token;
  assert.equal((await call('PUT', '/api/me', { email: 'evil@example.com' }, t)).status, 403, 'بدون كلمة المرور (403 لا 401: الواجهة تعتبر 401 انتهاء جلسة)');
  assert.equal((await call('PUT', '/api/me', { email: 'evil@example.com', current_password: 'خطأ' }, t)).status, 403);
  assert.equal((await call('GET', '/api/me', undefined, t)).status, 200, 'الجلسة باقية بعد كلمة مرور خاطئة');
  assert.equal((await call('PUT', '/api/me', { name: 'اسم جديد' }, t)).status, 200, 'تعديل بقية البيانات لا يتطلبها');
  ok(await call('PUT', '/api/me', { email: 'chg2@example.com', current_password: 'Pass-Word-1' }, t));
});

test('حماية الدخول: تقييد المحاولات الفاشلة لكل حساب، مع عدم تأثر الحسابات الأخرى', async () => {
  ok(await call('POST', '/api/auth/register', { role: 'student', name: 'قفل', email: 'lock@example.com', password: 'Right-Pass-1' }));
  let blocked = 0;
  for (let i = 0; i < 12; i++) if ((await call('POST', '/api/auth/login', { email: 'lock@example.com', password: 'wrong-' + i })).status === 429) blocked++;
  assert.ok(blocked >= 1, 'تم التقييد بعد محاولات فاشلة متكررة');
  assert.equal((await call('POST', '/api/auth/login', { email: 'lock@example.com', password: 'Right-Pass-1' })).status, 429, 'حتى الصحيحة مقيّدة مؤقتاً');
  assert.equal((await call('POST', '/api/auth/login', { email: 'sara@demo.iq', password: 'Demo@1234' })).status, 200, 'حساب آخر من نفس العنوان غير متأثر');
});

test('الحسابات التجريبية: لا تغيير لبيانات الدخول ولا حذف (حتى لا يقفلها أي زائر)', async () => {
  const st = await login('sara@demo.iq');
  assert.equal((await call('PUT', '/api/me/password', { current: 'Demo@1234', next: 'Hacked-Pass-1' }, st)).status, 403);
  assert.equal((await call('PUT', '/api/me', { email: 'taken@example.com', current_password: 'Demo@1234' }, st)).status, 403);
  assert.equal((await call('DELETE', '/api/me', undefined, st)).status, 403);
  assert.equal((await call('POST', '/api/auth/login', { email: 'sara@demo.iq', password: 'Demo@1234' })).status, 200, 'ما زالت صالحة');
});

test('البريد المساعد للشركة: بريد صحيح فقط', async () => {
  const co = await login('dijla@demo.iq');
  ok(await call('PUT', '/api/me', { contact_email: 'not an email' }, co));
  assert.notEqual(ok(await call('GET', '/api/me', undefined, co)).contact_email, 'not an email');
  ok(await call('PUT', '/api/me', { contact_email: 'info@example.com' }, co));
  assert.equal(ok(await call('GET', '/api/me', undefined, co)).contact_email, 'info@example.com');
});

test('الدعم الفني: التحقق، المصيدة، حدود السبام، صلاحيات المدير، وضبط القنوات من الإعدادات', async () => {
  const adm = await login(ADMIN.email, ADMIN.password), st = await login('sara@demo.iq');
  // لا قنوات قبل ضبطها
  const c0 = ok(await call('GET', '/api/config')).support; assert.deepEqual([c0.email, c0.instagram], ['', 'awtadiq']);
  // التحقق
  assert.equal((await call('POST', '/api/support', { name: 'أ', email: 'a@example.com', message: 'رسالة طويلة كفاية' })).status, 400, 'اسم قصير');
  assert.equal((await call('POST', '/api/support', { name: 'زائر', email: 'not-an-email', message: 'رسالة طويلة كفاية' })).status, 400, 'بريد خاطئ');
  assert.equal((await call('POST', '/api/support', { name: 'زائر', email: 'v1@example.com', message: 'قصيرة' })).status, 400, 'رسالة قصيرة');
  // المصيدة: تُقبل شكلاً ولا تُحفظ
  const before = (await dbm.get('SELECT COUNT(*) c FROM support_tickets')).c;
  assert.equal(ok(await call('POST', '/api/support', { name: 'روبوت', email: 'bot@example.com', message: 'رسالة سبام طويلة', website: 'http://spam' })).id, 0);
  assert.equal((await dbm.get('SELECT COUNT(*) c FROM support_tickets')).c, before, 'لا تُحفظ');
  // رسالة صحيحة من زائر، ثم من مسجّل (يُملأ الاسم والبريد من حسابه)
  const t1 = ok(await call('POST', '/api/support', { name: 'زائر كريم', email: 'visitor@example.com', topic: 'technical', message: 'الصفحة لا تفتح عندي على الجوال' }));
  assert.ok(t1.id > 0);
  const t2 = ok(await call('POST', '/api/support', { topic: 'ما-هذا', message: 'سؤال عن المحفظة والمبالغ' }, st));
  const row = await dbm.get('SELECT user_id,email,topic FROM support_tickets WHERE id=?', t2.id);
  assert.equal(row.email, 'sara@demo.iq'); assert.equal(row.topic, 'other'); assert.ok(row.user_id);
  // حد البريد الواحد: 3 في الساعة
  const rs = []; for (let i = 0; i < 4; i++) rs.push((await call('POST', '/api/support', { name: 'مكرر', email: 'dup@example.com', message: 'رسالة رقم ' + i + ' طويلة كفاية' })).status);
  assert.deepEqual(rs, [200, 200, 200, 429]);
  // المدير فقط يقرأ ويغلق ويحذف
  assert.equal((await call('GET', '/api/admin/support', undefined, st)).status, 403);
  assert.equal((await call('GET', '/api/admin/support')).status, 401);
  const list = ok(await call('GET', '/api/admin/support', undefined, adm)); assert.ok(list.some((x) => x.id === t1.id && x.status === 'open'));
  assert.ok(ok(await call('GET', '/api/admin/support/count', undefined, adm)).open >= 2);
  ok(await call('PATCH', `/api/admin/support/${t1.id}`, { status: 'closed' }, adm));
  assert.equal((await call('PATCH', `/api/admin/support/${t1.id}`, { status: 'x' }, adm)).status, 400);
  ok(await call('DELETE', `/api/admin/support/${t2.id}`, undefined, adm));
  assert.equal((await call('DELETE', `/api/admin/support/${t2.id}`, undefined, adm)).status, 404);
  // ضبط القنوات: بريد صحيح وإنستغرام من رابط، وحفظها لا يمسح إعداد Google
  ok(await call('PUT', '/api/admin/settings', { googleClientId: '123.apps.googleusercontent.com' }, adm));
  assert.equal((await call('PUT', '/api/admin/settings', { supportEmail: 'bad' }, adm)).status, 400);
  assert.equal((await call('PUT', '/api/admin/settings', { supportInstagram: 'javascript:alert(1)' }, adm)).status, 400, 'لا روابط مخادعة');
  ok(await call('PUT', '/api/admin/settings', { supportEmail: 'Help@Awtad.iq', supportInstagram: 'https://www.instagram.com/awtad.iq/?hl=en' }, adm));
  const c1 = ok(await call('GET', '/api/config')).support;
  assert.equal(c1.email, 'help@awtad.iq'); assert.equal(c1.instagram, 'awtad.iq'); assert.equal(c1.instagramUrl, 'https://www.instagram.com/awtad.iq/');
  assert.equal(ok(await call('GET', '/api/admin/settings', undefined, adm)).googleClientId, '123.apps.googleusercontent.com', 'إعداد Google سليم');
  // إشعار البريد: يصل لبريد الدعم، ولا يمكن حقن رؤوس عبر الاسم
  mails.length = 0;
  ok(await call('POST', '/api/support', { name: 'محقن\r\nBcc: x@evil.com', email: 'notify@example.com', topic: 'report', message: 'بلاغ عن إعلان مخالف وسبب البلاغ' }));
  await settle();
  assert.equal(mails.length, 1); assert.equal(mails[0].to, 'help@awtad.iq');
  assert.ok(!/[\r\n]/.test(mails[0].subject), 'لا أسطر جديدة في العنوان');
  ok(await call('PUT', '/api/admin/settings', { supportEmail: '', supportInstagram: '' }, adm));
  assert.equal(ok(await call('GET', '/api/config')).support.email, '');
});