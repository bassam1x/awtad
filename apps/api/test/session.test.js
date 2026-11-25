import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

/* بقاء تسجيل الدخول: جلسة طويلة تتجدد عند الاستعمال، بسقف سنة، وتُبطل عند تغيير كلمة المرور. */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awtad-session-'));
process.env.DB_FILE = path.join(dir, 's.db');
process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_MAX = '1000';
process.env.SERVE_WEB = 'false';

const { createApp } = await import('../src/app.js');
const { seedIfEmpty, ADMIN } = await import('../src/seed.js');
const dbm = await import('../src/db.js');

let server, base;
before(async () => { await seedIfEmpty(); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { server.close(); await dbm.db.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* مؤقت */ } });

const call = async (method, p, body, token) => {
  const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const DAY = 86400, now = () => Math.floor(Date.now() / 1000);
const days = (claims) => Math.round((claims.exp - claims.iat) / DAY);
const old = (id, { age = 2 * DAY, since = age, ...extra } = {}) => jwt.sign({ id, v: 0, at: now() - since, iat: now() - age, exp: now() + DAY, ...extra }, 'test-secret');

test('الدخول يعطي 90 يوماً للمستخدم و30 للمدير، ولا تجديد لتوكن حديث', async () => {
  const r = await call('POST', '/api/auth/register', { role: 'student', name: 'جلسة', email: 'session@example.com', password: 'Pass-Word-1' });
  assert.equal(days(jwt.decode(r.json.token)), 90);
  const me = await call('GET', '/api/me', undefined, r.json.token);
  assert.equal(me.status, 200); assert.equal(me.json.renewedToken, undefined);
  const adm = await call('POST', '/api/auth/login', { email: ADMIN.email, password: ADMIN.password });
  assert.equal(days(jwt.decode(adm.json.token)), 30);
});

test('توكن مضى عليه يوم يتجدد ويحتفظ بوقت الدخول الأصلي، والقديم بصيغة 14 يوماً يتجدد أيضاً', async () => {
  const id = (await dbm.get('SELECT id FROM users WHERE email=?', 'session@example.com')).id;
  const token = old(id, { since: 100 * DAY });
  const me = await call('GET', '/api/me', undefined, token);
  const fresh = jwt.decode(me.json.renewedToken);
  assert.equal(fresh.at, jwt.decode(token).at); assert.equal(days(fresh), 90);
  assert.equal((await call('GET', '/api/me', undefined, me.json.renewedToken)).status, 200);
  const legacy = jwt.sign({ id, v: 0, iat: now() - 5 * DAY, exp: now() + 9 * DAY }, 'test-secret');
  assert.ok((await call('GET', '/api/me', undefined, legacy)).json.renewedToken);
});

test('السقف سنة، وجلسة المدير المنتحِلة والمنتهية والملغاة لا تتجدد', async () => {
  const id = (await dbm.get('SELECT id FROM users WHERE email=?', 'session@example.com')).id;
  const near = jwt.decode((await call('GET', '/api/me', undefined, old(id, { since: 360 * DAY }))).json.renewedToken);
  assert.ok(near.exp - now() <= 5 * DAY + 5, 'لا يتجاوز سنة من الدخول');
  assert.equal((await call('GET', '/api/me', undefined, old(id, { since: 366 * DAY }))).json.renewedToken, undefined);
  const adminId = (await dbm.get("SELECT id FROM users WHERE role='admin'")).id;
  const imp = await call('GET', '/api/me', undefined, old(id, { imp: adminId }));
  assert.equal(imp.status, 200); assert.equal(imp.json.renewedToken, undefined);
  assert.equal((await call('GET', '/api/me', undefined, jwt.sign({ id, v: 0, iat: now() - 3 * DAY, exp: now() - DAY }, 'test-secret'))).status, 401);
  await dbm.run('UPDATE users SET token_version=token_version+1 WHERE id=?', id);
  assert.equal((await call('GET', '/api/me', undefined, old(id))).status, 401);
});
