import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/* LinkedIn وبريد استرجاع كلمة المرور (بمزوّدين وهميين، بلا شبكة) */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awtad-id-'));
process.env.DB_FILE = path.join(dir, 'id.db');
process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_MAX = '1000';
process.env.SERVE_WEB = 'false';
process.env.APP_URL = 'https://app.example.com';
process.env.LINKEDIN_CLIENT_ID = 'li-client';
process.env.LINKEDIN_CLIENT_SECRET = 'li-secret';

const { createApp } = await import('../src/app.js');
const { seedIfEmpty } = await import('../src/seed.js');
const { setMailer } = await import('../src/mailer.js');
const { setLinkedinFetch } = await import('../src/linkedin.js');
const dbm = await import('../src/db.js');

let server, base; const mails = [];
before(async () => {
  await seedIfEmpty(); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}`;
  setMailer(async (m) => { mails.push(m); return true; });
});
after(async () => { server.close(); await dbm.db.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* مؤقت */ } });

const call = async (method, p, body, token) => {
  const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const settle = () => new Promise((r) => setTimeout(r, 60)); // الإرسال غير منتظَر في المسار

/* LinkedIn وهمي: code → بيانات المستخدم */
const profiles = { good: { sub: 'li-100', name: 'Lina Test', email: 'Lina@Example.com', email_verified: true }, unverified: { sub: 'li-200', name: 'X', email: 'x@example.com', email_verified: false } };
const fakeLinkedin = (calls) => async (url, opt = {}) => {
  calls.push(url);
  const json = (o, ok = true) => ({ ok, json: async () => o });
  if (url.includes('/oauth/v2/accessToken')) {
    const b = new URLSearchParams(opt.body);
    assert.equal(b.get('redirect_uri'), 'https://app.example.com/auth/linkedin/callback');
    assert.equal(b.get('client_id'), 'li-client'); assert.equal(b.get('client_secret'), 'li-secret');
    return profiles[b.get('code')] ? json({ access_token: `tok-${b.get('code')}` }) : json({ error: 'invalid_grant' }, false);
  }
  const tok = opt.headers.authorization.replace('Bearer tok-', '');
  return json(profiles[tok]);
};

test('/config: LinkedIn مفعّل ويعيد عنوان العودة، والبريد متاح', async () => {
  const c = (await call('GET', '/api/config')).json;
  assert.equal(c.linkedinClientId, 'li-client');
  assert.equal(c.linkedinRedirect, 'https://app.example.com/auth/linkedin/callback');
  assert.ok(!JSON.stringify(c).includes('li-secret'), 'السر لا يظهر أبداً');
});

test('LinkedIn: مستخدم جديد ← تذكرة ثم اختيار الدور ثم دخول، ثم الدخول التالي مباشر', async () => {
  const calls = []; setLinkedinFetch(fakeLinkedin(calls));
  let r = await call('POST', '/api/auth/linkedin', { code: 'bad' });
  assert.equal(r.status, 401);
  r = await call('POST', '/api/auth/linkedin', { code: 'unverified' });
  assert.equal(r.status, 401); assert.match(r.json.error, /غير موثّق/);

  r = await call('POST', '/api/auth/linkedin', { code: 'good' });
  assert.equal(r.status, 202); assert.equal(r.json.needsRole, true); assert.equal(r.json.email, 'lina@example.com');
  assert.ok(r.json.ticket);
  assert.equal((await call('POST', '/api/auth/linkedin', { ticket: 'forged.jwt.value', role: 'student' })).status, 401);
  assert.equal((await call('POST', '/api/auth/linkedin', { ticket: r.json.ticket, role: 'admin' })).status, 202); // دور غير مسموح: لا يُنشأ شيء
  const made = await call('POST', '/api/auth/linkedin', { ticket: r.json.ticket, role: 'student' });
  assert.equal(made.status, 200); assert.equal(made.json.user.role, 'student'); assert.equal(made.json.user.name, 'Lina Test');
  assert.ok((await call('GET', '/api/me', null, made.json.token)).json.email === 'lina@example.com');
  const again = await call('POST', '/api/auth/linkedin', { code: 'good' });
  assert.equal(again.status, 200); assert.equal(again.json.user.id, made.json.user.id);
  assert.equal((await dbm.get("SELECT email_verified FROM users WHERE email='lina@example.com'")).email_verified, 1);
});

test('LinkedIn: ربط حساب موجود بنفس البريد، وإلغاء كلمة مرور حساب غير موثّق (منع الانتحال)', async () => {
  setLinkedinFetch(fakeLinkedin([]));
  profiles.squat = { sub: 'li-300', name: 'Real Owner', email: 'victim@example.com', email_verified: true };
  const reg = await call('POST', '/api/auth/register', { role: 'student', name: 'منتحل', email: 'victim@example.com', password: 'Squatter-Pass-1' });
  assert.equal(reg.status, 200);
  const r = await call('POST', '/api/auth/linkedin', { code: 'squat' });
  assert.equal(r.status, 200); assert.equal(r.json.user.id, reg.json.user.id);
  assert.equal((await call('POST', '/api/auth/login', { email: 'victim@example.com', password: 'Squatter-Pass-1' })).status, 401, 'كلمة المنتحل أُلغيت');
  assert.equal((await call('GET', '/api/me', null, reg.json.token)).status, 401, 'جلسة المنتحل أُبطلت');
  profiles.banned = { sub: 'li-400', name: 'B', email: 'ban@example.com', email_verified: true };
  const b = await call('POST', '/api/auth/linkedin', { code: 'banned' }); // جديد ← تذكرة
  const acc = await call('POST', '/api/auth/linkedin', { ticket: b.json.ticket, role: 'company' });
  await dbm.run("UPDATE users SET status='banned' WHERE id=?", acc.json.user.id);
  assert.equal((await call('POST', '/api/auth/linkedin', { code: 'banned' })).status, 403);
});

test('خدمة نسيان كلمة المرور محذوفة: لا مسارات ولا رسائل', async () => {
  for (const [path, body] of [['/api/auth/forgot', { email: 'a@example.com' }], ['/api/auth/reset', { token: 'x', password: 'New-Password-1' }]]) {
    const r = await call('POST', path, body);
    assert.ok([401, 404].includes(r.status), `${path} يجب ألا يعمل (${r.status})`);
    assert.notEqual(r.json?.ok, true);
  }
});
