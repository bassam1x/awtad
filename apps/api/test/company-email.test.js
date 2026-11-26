import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/* بريد تسجيل دخول الشركة لا يظهر لأي مستخدم آخر. */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awtad-cemail-'));
process.env.DB_FILE = path.join(dir, 'c.db');
process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_MAX = '1000';
process.env.SERVE_WEB = 'false';

const { createApp } = await import('../src/app.js');
const { MIGRATE } = await import('../src/schema.js');
const dbm = await import('../src/db.js');

let server, base;
before(async () => { server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { server.close(); await dbm.db.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* مؤقت */ } });

const call = async (method, p, body, token) => {
  const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  assert.ok(res.status < 300, `${method} ${p} → ${res.status} ${JSON.stringify(json)}`);
  return json;
};
const register = (role, email) => call('POST', '/api/auth/register', { role, name: role, email, password: 'Pass-Word-1' });

test('بريد الدخول لا يظهر في ملف الشركة ولا في الطلبات، وبريد التواصل المختلف فقط يظهر', async () => {
  const login = 'owner@company.example';
  const co = await register('company', login), st = await register('student', 'creator@example.com');
  assert.equal(co.user.contact_email, '', 'لا يُنسخ بريد الدخول إلى بريد التواصل');
  const pid = (await call('POST', '/api/postings', { kind: 'project', title: 'مشروع', spec: 'تصميم', pay: 1000, days: 3, description: 'وصف المشروع' }, co.token)).id;
  await call('POST', `/api/postings/${pid}/apply`, { message: 'مرحباً', projects: [] }, st.token);
  const aid = (await call('GET', '/api/applications', undefined, co.token))[0].id;
  const seen = async () => JSON.stringify([
    await call('GET', `/api/people/${co.user.id}`, undefined, st.token), await call('GET', `/api/applications/${aid}`, undefined, st.token),
    await call('GET', `/api/postings/${pid}`, undefined, st.token), await call('GET', '/api/applications', undefined, st.token)]);
  assert.ok(!(await seen()).includes(login));

  await call('PUT', '/api/me', { contact_email: 'info@company.example' }, co.token);
  assert.equal((await call('GET', `/api/people/${co.user.id}`, undefined, st.token)).contact_email, 'info@company.example');
  // كتابة بريد الدخول في خانة التواصل (بأي حالة أحرف) لا تنشره
  assert.equal((await call('PUT', '/api/me', { contact_email: 'Owner@Company.example' }, co.token)).contact_email, '');
  assert.ok(!(await seen()).includes(login));
  // تغيير بريد الدخول إلى بريد التواصل يخفيه
  await call('PUT', '/api/me', { contact_email: 'new@company.example' }, co.token);
  const changed = await call('PUT', '/api/me', { email: 'new@company.example', current_password: 'Pass-Word-1' }, co.token);
  assert.equal(changed.contact_email, '');
  assert.ok(!(await seen()).includes('new@company.example'));
});

test('الحسابات القديمة: يُمسح البريد المنسوخ مرة واحدة ويبقى بريد التواصل المختلف', async () => {
  const a = await register('company', 'old-a@company.example'), b = await register('company', 'old-b@company.example');
  await dbm.run('UPDATE company_profiles SET contact_email=? WHERE user_id=?', 'old-a@company.example', a.user.id);
  await dbm.run('UPDATE company_profiles SET contact_email=? WHERE user_id=?', 'hello@company.example', b.user.id);
  await dbm.run("DELETE FROM settings WHERE key='hide_login_email_v1'");
  await dbm.db.exec(MIGRATE);
  const value = async (id) => (await dbm.get('SELECT contact_email FROM company_profiles WHERE user_id=?', id)).contact_email;
  assert.equal(await value(a.user.id), '');
  assert.equal(await value(b.user.id), 'hello@company.example');
  assert.equal((await dbm.get('SELECT email FROM users WHERE id=?', a.user.id)).email, 'old-a@company.example', 'بريد الدخول باقٍ');
});
