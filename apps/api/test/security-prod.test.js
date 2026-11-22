import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/* وضع الإنتاج: HSTS وupgrade-insecure-requests، وسياسة CSP تتضمن بصمة السكربت المضمّن في index.html فقط (لا unsafe-inline للسكربتات). */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awtad-secprod-'));
const web = path.join(dir, 'web'); fs.mkdirSync(web);
const INLINE = "try{document.documentElement.dataset.x='1'}catch(e){}";
fs.writeFileSync(path.join(web, 'index.html'), `<!doctype html><html><head><script>${INLINE}</script><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>`);
fs.writeFileSync(path.join(web, 'phone.html'), '<!doctype html><script>1</script>');
process.env.NODE_ENV = 'production';
process.env.DB_FILE = path.join(dir, 'p.db');
process.env.JWT_SECRET = 'prod-test-secret';
process.env.ADMIN_PASSWORD = 'Prod-Admin-Pass-1';
process.env.DEMO_MODE = 'false';
process.env.WEB_DIST = web;
process.env.SERVE_WEB = 'true';
process.env.RATE_LIMIT_MAX = '1000';

const { createApp } = await import('../src/app.js');
const { seedIfEmpty } = await import('../src/seed.js');
const dbm = await import('../src/db.js');

let server, base;
before(async () => { await seedIfEmpty(); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { server.close(); await dbm.db.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* مؤقت */ } });

test('الإنتاج: HSTS وCSP ببصمة السكربت المضمّن فقط، وبلا unsafe-inline للسكربتات', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('strict-transport-security') || '', /max-age=\d+/);
  const csp = r.headers.get('content-security-policy') || '';
  const hash = `'sha256-${crypto.createHash('sha256').update(INLINE).digest('base64')}'`;
  const script = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('script-src'));
  assert.ok(script.includes(hash), `بصمة السكربت المضمّن غائبة: ${script}`);
  assert.ok(!script.includes("'unsafe-inline'") && !script.includes("'unsafe-eval'"), script);
  assert.ok(csp.includes('upgrade-insecure-requests'));
  assert.ok(csp.includes("object-src 'none'") && csp.includes("frame-ancestors 'self'") && csp.includes("base-uri 'self'"));
});

test('صفحة المعاينة الداخلية لها سياسة خاصة، وملفات الواجهة الأخرى بالسياسة الصارمة', async () => {
  const p = await fetch(base + '/phone.html');
  assert.match(p.headers.get('content-security-policy') || '', /script-src 'self' 'unsafe-inline'/);
  const api = await fetch(base + '/api/ping');
  const apiScript = (api.headers.get('content-security-policy') || '').split(';').map((s) => s.trim()).find((s) => s.startsWith('script-src')) || '';
  assert.ok(apiScript && !apiScript.includes("'unsafe-inline'"), 'الـ API بالسياسة الصارمة: ' + apiScript);
  assert.match(api.headers.get('cache-control') || '', /no-store/);
});

test('الإنتاج: لا حسابات تجريبية، ولا يُعرض أي حساب مدير، وكلمة المرور من البيئة', async () => {
  const cfg = await (await fetch(base + '/api/config')).json();
  assert.equal(cfg.demo, undefined);
  const login = (email, password) => fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal((await login('admin@awtad.iq', 'Admin@12345')).status, 401, 'كلمة المدير الافتراضية لا تعمل في الإنتاج');
  assert.equal((await login('admin@awtad.iq', 'Prod-Admin-Pass-1')).status, 200);
});
