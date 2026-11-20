import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/* وضع التجربة في الإنتاج: يُنشأ عند DEMO_MODE=true، ولا يُعرض حساب المدير، ويُحذف كله عند إيقافه */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awtad-demo-'));
process.env.DB_FILE = path.join(dir, 'd.db');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_PASSWORD = 'Prod-Admin-Pass-1';
process.env.DEMO_MODE = 'true';
process.env.RATE_LIMIT_MAX = '1000';
process.env.SERVE_WEB = 'false';

const { createApp } = await import('../src/app.js');
const { seedIfEmpty, ADMIN } = await import('../src/seed.js');
const dbm = await import('../src/db.js');

let server, base;
before(async () => { await seedIfEmpty(); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { server.close(); await dbm.db.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* مؤقت */ } });

const call = async (method, p, body, token) => {
  const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};

test('DEMO_MODE في الإنتاج: بيانات غنية وحسابات للتبديل بلا المدير، وإعادة التهيئة لا تكرّرها', async () => {
  const cfg = (await call('GET', '/api/config')).json;
  assert.ok(Array.isArray(cfg.demo) && cfg.demo.length >= 12, `demo=${cfg.demo?.length}`);
  assert.ok(cfg.demo.every((d) => d.role !== 'admin' && d.email !== ADMIN.email), 'لا يُعرض المدير أبداً');
  assert.ok(cfg.demo.some((d) => d.role === 'company') && cfg.demo.some((d) => d.role === 'student'));
  // كل حساب معروض يدخل فعلاً
  for (const d of cfg.demo.slice(0, 3)) assert.equal((await call('POST', '/api/auth/login', { email: d.email, password: d.password })).status, 200);
  // المدير بكلمته الحقيقية وليس التجريبية
  assert.equal((await call('POST', '/api/auth/login', { email: ADMIN.email, password: ADMIN.password })).status, 401);
  const adm = (await call('POST', '/api/auth/login', { email: ADMIN.email, password: 'Prod-Admin-Pass-1' })).json.token;
  const st = (await call('GET', '/api/stats', null, adm)).json;
  assert.ok(st.students >= 10 && st.companies >= 6 && st.postings >= 18 && st.applications >= 15, JSON.stringify(st));
  await seedIfEmpty(); // لا تكرار
  assert.equal((await call('GET', '/api/stats', null, adm)).json.students, st.students);
  // النطاق التجريبي محجوز للتسجيل
  assert.equal((await call('POST', '/api/auth/register', { role: 'student', name: 'x', email: 'fake@demo.iq', password: 'Passw0rd!' })).status, 400);
});

test('إيقاف DEMO_MODE في الإنتاج يحذف كل الحسابات التجريبية وما يتبعها ويُخفي القائمة', async () => {
  process.env.DEMO_MODE = 'false';
  await seedIfEmpty();
  assert.equal((await call('GET', '/api/config')).json.demo, undefined);
  const adm = (await call('POST', '/api/auth/login', { email: ADMIN.email, password: 'Prod-Admin-Pass-1' })).json.token;
  const st = (await call('GET', '/api/stats', null, adm)).json;
  assert.equal(st.students, 0); assert.equal(st.companies, 0); assert.equal(st.postings, 0); assert.equal(st.applications, 0);
  assert.equal((await call('POST', '/api/auth/login', { email: 'sara@demo.iq', password: 'Demo@1234' })).status, 401);
  // حساب المدير باقٍ
  assert.ok(adm);
});
