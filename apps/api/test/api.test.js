import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awtad-'));
process.env.DB_FILE = path.join(dir, 'test.db');
process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_MAX = '10';
process.env.CORS_ORIGINS = 'https://app.example.com';
process.env.SERVE_WEB = 'false';

const { createApp } = await import('../src/app.js');
const { seedIfEmpty } = await import('../src/seed.js');
const tr = await import('../src/translate.js');

let server, base;
before(async () => { await seedIfEmpty(); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => {
  server.close();
  await (await import('../src/db.js')).db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* مجلد مؤقت، لا يهم */ }
});

const call = async (method, p, body, token, headers = {}) => {
  const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
};
const login = async (email, password = 'Demo@1234') => (await call('POST', '/api/auth/login', { email, password })).json?.token;

test('كل الردود JSON: 404 وJSON تالف وبدون توكن', async () => {
  let r = await call('GET', '/api/nope');
  assert.equal(r.status, 401); assert.ok(r.json.error);
  const t = await login('sara@demo.iq');
  r = await call('GET', '/api/nope', null, t);
  assert.equal(r.status, 404); assert.ok(r.json.error);
  const raw = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
  assert.equal(raw.status, 400); assert.ok((await raw.json()).error);
  assert.equal((await call('GET', '/api/health')).json.ok, true);
});

test('حسابات التجربة تظهر في التطوير ولا تظهر أبداً في الإنتاج', async () => {
  const { config } = await import('../src/config.js');
  let r = await call('GET', '/api/config');
  assert.ok(Array.isArray(r.json.demo) && r.json.demo.length === 3);
  const old = config.env; config.env = 'production';
  try { r = await call('GET', '/api/config'); assert.equal(r.json.demo, undefined); } finally { config.env = old; }
});

test('الترجمة: تخزين دائم، حدود، ولا ترجمة لما لا يحتاجها', async () => {
  let calls = 0;
  tr.setProvider(async (t, target) => { calls++; return `[${target}] ${t}`; });
  const st = await login('sara@demo.iq');
  assert.equal((await call('POST', '/api/translate', { lang: 'en', texts: ['x'] })).status, 401, 'يتطلب تسجيل دخول');
  assert.equal((await call('POST', '/api/translate', { lang: 'fr', texts: ['x'] }, st)).status, 400);
  assert.equal((await call('POST', '/api/translate', { lang: 'en', texts: new Array(41).fill('a') }, st)).status, 400);
  const body = { lang: 'en', texts: ['مصمم محتوى سوشال ميديا', 'React', 'Hello world again'] };
  let r = await call('POST', '/api/translate', body, st);
  assert.equal(r.status, 200);
  assert.equal(r.json.translations[0], '[en] مصمم محتوى سوشال ميديا');
  assert.equal(r.json.translations[1], 'React', 'اسم تقني لا يُترجم');
  assert.equal(r.json.translations[2], 'Hello world again', 'نص إنكليزي إلى الإنكليزية لا يُترجم');
  assert.equal(calls, 1);
  r = await call('POST', '/api/translate', body, st);
  assert.equal(r.json.translations[0], '[en] مصمم محتوى سوشال ميديا');
  assert.equal(calls, 1, 'الثانية من التخزين الدائم');
  r = await call('POST', '/api/translate', { lang: 'ar', texts: ['Looking for a talented designer to join us'] }, st);
  assert.match(r.json.translations[0], /^\[ar\]/);
  tr.setProvider(async () => null);
  r = await call('POST', '/api/translate', { lang: 'ku', texts: ['نص جديد لم يُترجم من قبل'] }, st);
  assert.equal(r.json.translations[0], null, 'فشل المزوّد يعيد null ولا يُخزَّن');
});

test('الترويسات الأمنية وCORS', async () => {
  const r = await call('GET', '/api/health', null, null, { Origin: 'https://app.example.com' });
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://app.example.com');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-powered-by'), null);
  const other = await call('GET', '/api/health', null, null, { Origin: 'https://evil.example.com' });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
  const pre = await fetch(`${base}/api/me`, { method: 'OPTIONS', headers: { Origin: 'https://app.example.com' } });
  assert.equal(pre.status, 204);
});

test('تسجيل مستخدم جديد وصلاحيات الأدوار', async () => {
  let r = await call('POST', '/api/auth/register', { role: 'student', name: 'تجربة', email: 'new@test.iq', password: 'short' });
  assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/register', { role: 'student', name: 'تجربة', email: 'new@test.iq', password: 'longenough1', skills: 'React, Git' });
  assert.equal(r.status, 200); assert.equal(r.json.user.skills.length, 2);
  assert.equal((await call('POST', '/api/auth/register', { role: 'student', name: 'x', email: 'new@test.iq', password: 'longenough1' })).status, 409);
  const st = r.json.token;
  assert.equal((await call('GET', '/api/postings/mine', null, st)).status, 403);
  assert.equal((await call('GET', '/api/admin/users', null, st)).status, 403);
});

test('دورة العمل كاملة: تقديم، قبول، تسليم، اعتماد، محفظة', async () => {
  const co = await login('dijla@demo.iq');
  const st = await login('hussein@demo.iq');
  let r = await call('POST', '/api/postings', { kind: 'project', title: 'مشروع اختبار', pay: 250000, spec: 'برمجة', days: 3, reqs: 'a, b' }, co);
  const pid = r.json.id; assert.ok(pid);
  assert.equal((await call('POST', `/api/postings/${pid}/apply`, { message: '' }, st)).status, 400);
  assert.equal((await call('POST', `/api/postings/${pid}/apply`, { message: 'أنا جاهز' }, st)).status, 200);
  assert.equal((await call('POST', `/api/postings/${pid}/apply`, { message: 'مرة ثانية' }, st)).status, 409);
  const apps = (await call('GET', `/api/applications?posting=${pid}`, null, co)).json;
  assert.equal(apps.length, 1);
  const aid = apps[0].id;
  assert.equal((await call('POST', `/api/applications/${aid}/deliver`, {}, st)).status, 403);
  assert.equal((await call('POST', `/api/applications/${aid}/accept`, {}, co)).status, 200);
  assert.equal((await call('POST', `/api/applications/${aid}/messages`, { text: 'مرحباً' }, st)).status, 200);
  assert.equal((await call('POST', `/api/applications/${aid}/deliver`, {}, st)).status, 200);
  const before = (await call('GET', '/api/wallet', null, st)).json.balances.find((b) => b.cur === 'د.ع')?.total || 0;
  assert.equal((await call('POST', `/api/applications/${aid}/approve`, { rating: 5 }, co)).status, 200);
  assert.equal((await call('POST', `/api/applications/${aid}/approve`, { rating: 5 }, co)).status, 403, 'لا دفع مرتين');
  const after = (await call('GET', '/api/wallet', null, st)).json.balances.find((b) => b.cur === 'د.ع').total;
  assert.equal(after - before, 250000);
});

test('التحقق من المدخلات: الروابط والصور والدعوات', async () => {
  const co = await login('nibras@demo.iq');
  const st = await login('sara@demo.iq');
  let r = await call('PUT', '/api/me', { map_url: 'javascript:alert(1)' }, co);
  assert.equal(r.json.map_url, '');
  r = await call('POST', '/api/me/portfolio', { title: 'x', url: 'javascript:alert(1)' }, st);
  assert.ok(!r.json.portfolio.some((p) => /javascript/.test(p.url)));
  r = await call('PUT', '/api/me', { avatar: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }, st);
  assert.equal(r.json.avatar, null);
  const pid = (await call('POST', '/api/postings', { title: 'مغلق', pay: 100 }, co)).json.id;
  await call('PATCH', `/api/postings/${pid}`, { status: 'closed' }, co);
  const sid = (await call('GET', '/api/me', null, st)).json.id;
  assert.equal((await call('POST', '/api/invites', { posting_id: pid, student_id: sid }, co)).status, 400);
});

test('إبطال الجلسات عند تغيير كلمة المرور', async () => {
  const old = await login('ali@demo.iq');
  const r = await call('PUT', '/api/me/password', { current: 'Demo@1234', next: 'NewPass@123' }, old);
  assert.equal(r.status, 200);
  assert.equal((await call('GET', '/api/me', null, old)).status, 401);
  assert.equal((await call('GET', '/api/me', null, r.json.token)).status, 200);
});

test('حدّ المحاولات على الدخول', async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await call('POST', '/api/auth/login', { email: 'x@y.zz', password: 'bad' });
  assert.equal(last.status, 429);
});
