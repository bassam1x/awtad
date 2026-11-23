import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/* الإنتاج: لا حسابات تجريبية أبداً (حتى مع DEMO_MODE=true)، وأي بيانات تجريبية موجودة تُحذف عند الإقلاع */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awtad-demo-'));
process.env.DB_FILE = path.join(dir, 'd.db');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_PASSWORD = 'Prod-Admin-Pass-1';
process.env.DEMO_MODE = 'true';
process.env.RATE_LIMIT_MAX = '1000';
process.env.SERVE_WEB = 'false';

const { createApp } = await import('../src/app.js');
const { seedIfEmpty, seedDemo, ADMIN } = await import('../src/seed.js');
const dbm = await import('../src/db.js');

let server, base;
before(async () => { await seedIfEmpty(); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { server.close(); await dbm.db.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* مؤقت */ } });

const call = async (method, p, body, token) => {
  const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};

test('الإنتاج مع DEMO_MODE=true: لا تُنشأ حسابات تجريبية ولا تُعرض قائمة', async () => {
  assert.equal((await call('GET', '/api/config')).json.demo, undefined);
  assert.equal((await call('POST', '/api/auth/login', { email: 'sara@demo.iq', password: 'Demo@1234' })).status, 401);
  const adm = (await call('POST', '/api/auth/login', { email: ADMIN.email, password: 'Prod-Admin-Pass-1' })).json.token;
  assert.ok(adm);
  assert.equal((await call('POST', '/api/auth/register', { role: 'student', name: 'x', email: 'fake@demo.iq', password: 'Passw0rd!' })).status, 400);
});

test('بيانات تجريبية موجودة مسبقاً في الإنتاج تُحذف كلها عند الإقلاع، والمدير يبقى', async () => {
  await seedDemo();                                   // نحاكي قاعدة قديمة فيها بيانات تجريبية
  const adm = (await call('POST', '/api/auth/login', { email: ADMIN.email, password: 'Prod-Admin-Pass-1' })).json.token;
  assert.ok((await call('GET', '/api/stats', null, adm)).json.students >= 10, 'البيانات التجريبية موجودة قبل الإقلاع');
  await seedIfEmpty();                                // إقلاع جديد
  const st = (await call('GET', '/api/stats', null, adm)).json;
  assert.equal(st.students, 0); assert.equal(st.companies, 0); assert.equal(st.postings, 0); assert.equal(st.applications, 0);
  assert.equal((await call('POST', '/api/auth/login', { email: 'sara@demo.iq', password: 'Demo@1234' })).status, 401);
  assert.equal((await call('GET', '/api/config')).json.demo, undefined);
});
