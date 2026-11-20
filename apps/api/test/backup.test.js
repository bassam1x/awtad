import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileStore, githubStore, pack, restoreIfNeeded, unpack } from '../src/backup-store.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'awtad-bk-'));

test('التشفير: ذهاب وإياب، ومفتاح خاطئ يفشل، وبيانات عبثية تُرفض', () => {
  const data = Buffer.from('بيانات سرية '.repeat(500));
  const blob = pack(data, 'secret-1');
  assert.ok(!blob.includes(Buffer.from('بيانات')), 'النسخة لا تحتوي نصاً صريحاً');
  assert.deepEqual(unpack(blob, 'secret-1'), data);
  assert.throws(() => unpack(blob, 'wrong'), /BACKUP_SECRET/);
  assert.throws(() => unpack(Buffer.from('not a backup at all, definitely'), 'secret-1'), /غير معروفة/);
  const tampered = Buffer.from(blob); tampered[tampered.length - 5] ^= 1;
  assert.throws(() => unpack(tampered, 'secret-1'), /BACKUP_SECRET/);
});

test('مخزن الملفات + الاستعادة: قاعدة حقيقية تعود بعد فقدان القرص', async () => {
  const dir = tmp(), db1 = path.join(tmp(), 'a.db');
  const a = new DatabaseSync(db1);
  a.exec("CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT); INSERT INTO users(name) VALUES ('سارة'),('علي');");
  const snap = path.join(tmp(), 's.db'); a.exec(`VACUUM INTO '${snap}'`); a.close();

  const store = fileStore(dir), made = { store, secret: 'k' };
  assert.equal(await store.get(), null);
  await store.put(pack(fs.readFileSync(snap), 'k'));

  const lost = path.join(tmp(), 'data', 'new.db'); // قرص جديد فارغ
  const r = await restoreIfNeeded({ made, file: lost, attempts: 1 });
  assert.equal(r.restored, true);
  const b = new DatabaseSync(lost);
  assert.deepEqual(b.prepare('SELECT name FROM users ORDER BY id').all().map((x) => x.name), ['سارة', 'علي']);
  b.close();

  // وجود ملف محلي: لا نستبدله
  const again = await restoreIfNeeded({ made, file: lost, attempts: 1 });
  assert.equal(again.restored, false);
  assert.equal(again.reason, 'local-db-exists');
  // لا توجد نسخة: بداية جديدة مسموحة
  const empty = await restoreIfNeeded({ made: { store: fileStore(tmp()), secret: 'k' }, file: path.join(tmp(), 'x.db'), attempts: 1 });
  assert.equal(empty.reason, 'no-snapshot');
  // معطّل
  assert.equal((await restoreIfNeeded({ made: null })).enabled, false);
});

test('الاستعادة تفشل بأمان (لا بداية فارغة) عند مفتاح خاطئ أو تعطل المخزن', async () => {
  const dir = tmp(); const store = fileStore(dir);
  await store.put(pack(Buffer.from('x'), 'right'));
  await assert.rejects(restoreIfNeeded({ made: { store, secret: 'wrong' }, file: path.join(tmp(), 'f.db'), attempts: 3 }), /BACKUP_SECRET/);
  const broken = { kind: 'x', get: async () => { throw new Error('network down'); }, put: async () => {} };
  const t0 = Date.now();
  await assert.rejects(restoreIfNeeded({ made: { store: broken, secret: 'k' }, file: path.join(tmp(), 'g.db'), attempts: 2 }), /network down/);
  assert.ok(Date.now() - t0 >= 1400, 'أعاد المحاولة قبل الفشل');
});

test('مخزن GitHub: تسلسل الاستدعاءات صحيح (رفع مؤقت ثم حذف القديم ثم إعادة تسمية) والتنزيل', async () => {
  const calls = []; let assets = [{ id: 11, name: 'awtad-db.bin' }];
  const fake = async (url, opt = {}) => {
    const m = opt.method || 'GET'; calls.push(`${m} ${url.replace('https://api.github.com', '').replace('https://uploads.github.com', 'UP')}`);
    assert.match(opt.headers.Authorization, /^Bearer tok$/);
    const json = (o, s = 200) => ({ status: s, json: async () => o, text: async () => JSON.stringify(o), arrayBuffer: async () => Buffer.from('PAYLOAD') });
    if (url.endsWith('/releases/tags/awtad-db')) return json({ id: 5, assets });
    if (url.includes('uploads.github.com')) { assert.equal(opt.headers['Content-Type'], 'application/octet-stream'); assert.ok(Buffer.isBuffer(opt.body)); return json({ id: 22 }, 201); }
    if (m === 'DELETE') return { status: 204, text: async () => '' };
    if (m === 'PATCH') { assert.equal(JSON.parse(opt.body).name, 'awtad-db.bin'); return json({}); }
    if (url.endsWith('/assets/11')) { assert.equal(opt.headers.Accept, 'application/octet-stream'); return json({}); }
    throw new Error(`unexpected ${m} ${url}`);
  };
  const s = githubStore({ repo: 'o/r', token: 'tok', fetchImpl: fake });
  await s.put(Buffer.from('db'));
  assert.deepEqual(calls, ['GET /repos/o/r/releases/tags/awtad-db', 'POST UP/repos/o/r/releases/5/assets?name=awtad-db.bin.tmp', 'DELETE /repos/o/r/releases/assets/11', 'PATCH /repos/o/r/releases/assets/22']);
  calls.length = 0;
  assert.equal((await s.get()).toString(), 'PAYLOAD');
  assert.deepEqual(calls, ['GET /repos/o/r/releases/tags/awtad-db', 'GET /repos/o/r/releases/assets/11']);
  // لا إصدار بعد: get يعيد null، وput ينشئ الإصدار
  const none = githubStore({ repo: 'o/r', token: 'tok', fetchImpl: async (u, o = {}) => (u.endsWith('/tags/awtad-db') ? { status: 404, text: async () => 'nf' } : { status: 200, text: async () => '' }) });
  assert.equal(await none.get(), null);
  // خطأ مصادقة يُرمى برسالة واضحة
  const denied = githubStore({ repo: 'o/r', token: 'bad', fetchImpl: async () => ({ status: 401, text: async () => 'Bad credentials' }) });
  await assert.rejects(denied.get(), /GitHub 401/);
});
