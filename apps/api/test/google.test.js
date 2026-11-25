import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

/* تسجيل الدخول عبر Google (Firebase): نوقّع رموزاً بمفتاح اختبار ونحقنه كمصدر مفاتيح بدل خوادم Google. */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awtad-google-'));
process.env.DB_FILE = path.join(dir, 'g.db');
process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_MAX = '1000';
process.env.SERVE_WEB = 'false';
process.env.FIREBASE_API_KEY = 'test-web-key';
process.env.FIREBASE_PROJECT_ID = 'test-proj';

const { createApp } = await import('../src/app.js');
const { seedIfEmpty, ADMIN } = await import('../src/seed.js');
const { setCertSource } = await import('../src/firebase.js');
const dbm = await import('../src/db.js');

const pair = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const good = pair(), evil = pair();
let offline = false;

let server, base;
before(async () => {
  setCertSource(async () => { if (offline) throw new Error('offline'); return { certs: { k1: good.publicKey }, maxAge: 3600 }; });
  await seedIfEmpty(); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await dbm.db.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* مؤقت */ } });

const call = async (method, p, body, token) => {
  const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null), headers: res.headers };
};
const ok = (r, s = 200) => { assert.equal(r.status, s, JSON.stringify(r.json)); return r.json; };
const idToken = (over = {}, { key = good.privateKey, kid = 'k1' } = {}) => {
  const now = Math.floor(Date.now() / 1000), email = over.email || 'new.person@gmail.com', sub = over.gsub || 'g-100';
  const { gsub, ...rest } = over;
  return jwt.sign({ iss: 'https://securetoken.google.com/test-proj', aud: 'test-proj', sub: 'fb-' + sub, iat: now, exp: now + 3600, auth_time: now, name: 'شخص جديد', email, email_verified: true,
    firebase: { sign_in_provider: 'google.com', identities: { 'google.com': [sub], email: [email] } }, ...rest }, key, { algorithm: 'RS256', keyid: kid });
};

test('الإعدادات العلنية وسياسة المحتوى تسمحان بـ Firebase فقط', async () => {
  const r = await call('GET', '/api/config');
  assert.deepEqual(ok(r).google, { apiKey: 'test-web-key', projectId: 'test-proj', authDomain: 'test-proj.firebaseapp.com' });
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'[^;]*https:\/\/apis\.google\.com/);
  assert.match(csp, /connect-src[^;]*identitytoolkit\.googleapis\.com/);
  assert.match(csp, /frame-src https:\/\/test-proj\.firebaseapp\.com/);
});

test('مستخدم جديد: يُسأل عن نوع الحساب، ثم يُنشأ مرة واحدة ويدخل بعدها مباشرة', async () => {
  const credential = idToken();
  const ask = ok(await call('POST', '/api/auth/google', { credential }), 202);
  assert.equal(ask.needsRole, true); assert.equal(ask.name, 'شخص جديد');
  assert.equal((await call('POST', '/api/auth/google', { credential, role: 'admin' })).status, 202, 'لا يمكن طلب دور المدير');
  const made = ok(await call('POST', '/api/auth/google', { credential, role: 'student' }));
  assert.equal(made.user.role, 'student'); assert.equal(made.user.email, 'new.person@gmail.com'); assert.equal(made.user.has_google, true);
  ok(await call('GET', '/api/me', undefined, made.token));
  const again = ok(await call('POST', '/api/auth/google', { credential: idToken() }));
  assert.equal(again.user.id, made.user.id);
  const co = ok(await call('POST', '/api/auth/google', { credential: idToken({ email: 'boss@gmail.com', gsub: 'g-200' }), role: 'company' }));
  assert.equal(co.user.role, 'company');
});

test('حساب بنفس البريد يُربط، وكلمة المرور غير الموثّقة تُلغى، والمحظور لا يدخل', async () => {
  const reg = ok(await call('POST', '/api/auth/register', { role: 'student', name: 'قديم', email: 'old@gmail.com', password: 'Pass-Word-1' }));
  const linked = ok(await call('POST', '/api/auth/google', { credential: idToken({ email: 'old@gmail.com', gsub: 'g-300' }) }));
  assert.equal(linked.user.id, reg.user.id);
  assert.equal((await call('GET', '/api/me', undefined, reg.token)).status, 401, 'الجلسات القديمة تُبطل');
  assert.equal((await call('POST', '/api/auth/login', { email: 'old@gmail.com', password: 'Pass-Word-1' })).status, 401);
  await dbm.run("UPDATE users SET status='banned' WHERE id=?", reg.user.id);
  assert.equal((await call('POST', '/api/auth/google', { credential: idToken({ email: 'old@gmail.com', gsub: 'g-300' }) })).status, 403);
});

test('رموز مرفوضة: توقيع أو مشروع أو صلاحية أو مزوّد أو بريد غير صحيح', async () => {
  const now = Math.floor(Date.now() / 1000), email = 'victim@gmail.com', gsub = 'g-400';
  const none = `${Buffer.from('{"alg":"none","kid":"k1"}').toString('base64url')}.${idToken({ email, gsub }).split('.')[1]}.`;
  const bad = {
    'فارغ': '', 'ليس رمزاً': 'abc.def.ghi', 'بلا توقيع': none,
    'مفتاح آخر': idToken({ email, gsub }, { key: evil.privateKey }),
    'مفتاح مجهول': idToken({ email, gsub }, { kid: 'k9' }),
    'HS256': jwt.sign({ aud: 'test-proj' }, good.publicKey.replace(/-----[^-]+-----|\s/g, ''), { keyid: 'k1' }),
    'مشروع آخر': idToken({ email, gsub, aud: 'other-proj' }),
    'مُصدر آخر': idToken({ email, gsub, iss: 'https://securetoken.google.com/other-proj' }),
    'منتهٍ': idToken({ email, gsub, iat: now - 7200, exp: now - 3600 }),
    'من المستقبل': idToken({ email, gsub, auth_time: now + 3600 }),
    'مزوّد كلمة مرور': idToken({ email, gsub, firebase: { sign_in_provider: 'password', identities: { email: [email] } } }),
    'بريد غير موثّق': idToken({ email, gsub, email_verified: false }),
  };
  for (const [label, credential] of Object.entries(bad)) assert.equal((await call('POST', '/api/auth/google', { credential, role: 'student' })).status, 401, label);
  assert.equal(await dbm.get('SELECT 1 FROM users WHERE email=?', email), undefined, 'لم يُنشأ أي حساب');
});

test('تعذّر الاتصال بـ Google يعطي 503 لا خطأً داخلياً', async () => {
  offline = true; setCertSource(async () => { throw new Error('offline'); });
  assert.equal((await call('POST', '/api/auth/google', { credential: idToken() })).status, 503);
  offline = false; setCertSource(async () => ({ certs: { k1: good.publicKey }, maxAge: 3600 }));
});

test('المدير يعطّل الخدمة ويعيدها', async () => {
  const adm = ok(await call('POST', '/api/auth/login', { email: ADMIN.email, password: ADMIN.password })).token;
  assert.equal((await call('PUT', '/api/admin/settings', { googleSignIn: 'no' }, adm)).status, 400);
  assert.equal(ok(await call('PUT', '/api/admin/settings', { googleSignIn: false }, adm)).googleSignIn, false);
  assert.equal(ok(await call('GET', '/api/config')).google, null);
  assert.equal((await call('POST', '/api/auth/google', { credential: idToken() })).status, 503);
  assert.equal(ok(await call('PUT', '/api/admin/settings', { googleSignIn: true }, adm)).googleSignIn, true);
  assert.ok(ok(await call('GET', '/api/config')).google);
});
