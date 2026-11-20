import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { config } from './config.js';

/* حفظ القاعدة خارج الخادم: الخدمة المجانية على Render تمسح قرصها عند كل إعادة تشغيل، فنأخذ لقطة مضغوطة
   ومشفّرة (AES-256-GCM) من القاعدة ونرفعها إلى مخزن خارجي، ونستعيدها عند الإقلاع.
   لا يستورد هذا الملف db.js عمداً: الاستعادة يجب أن تتم قبل فتح القاعدة. */

const MAGIC = Buffer.from('AWB1');
const NAME = 'awtad-db.bin';
const TMP = `${NAME}.tmp`;
const TAG = 'awtad-db';

const keyOf = (secret) => crypto.scryptSync(secret, 'awtad-backup-v1', 32);

/** ضغط ثم تشفير: [MAGIC | iv(12) | tag(16) | بيانات مشفّرة] */
export function pack(plain, secret) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keyOf(secret), iv);
  const enc = Buffer.concat([c.update(zlib.gzipSync(plain, { level: 6 })), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), enc]);
}
export function unpack(buf, secret) {
  if (buf.length < 33 || !buf.subarray(0, 4).equals(MAGIC)) throw new Error('صيغة النسخة الاحتياطية غير معروفة');
  const d = crypto.createDecipheriv('aes-256-gcm', keyOf(secret), buf.subarray(4, 16));
  d.setAuthTag(buf.subarray(16, 32));
  try { return zlib.gunzipSync(Buffer.concat([d.update(buf.subarray(32)), d.final()])); }
  catch { throw new Error('تعذّر فكّ تشفير النسخة الاحتياطية: تأكد من BACKUP_SECRET'); }
}

/* ---------- مخزن ملفات (للاختبار أو لقرص دائم) ---------- */
export function fileStore(dir) {
  return {
    kind: 'file',
    async get() { try { return fs.readFileSync(path.join(dir, NAME)); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } },
    async put(buf) {
      fs.mkdirSync(dir, { recursive: true });
      const tmp = path.join(dir, TMP);
      fs.writeFileSync(tmp, buf); fs.renameSync(tmp, path.join(dir, NAME));
    },
  };
}

/* ---------- مخزن GitHub: ملف ملحق بإصدار (Release) في مستودع خاص، بلا تضخيم لسجل git ---------- */
export function githubStore({ repo, token, fetchImpl = (...a) => fetch(...a) }) {
  const API = 'https://api.github.com';
  const head = (extra = {}) => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'awtad-backup', ...extra });
  const call = async (url, opt = {}, ok = [200, 201, 204]) => {
    const res = await fetchImpl(url, { ...opt, headers: head(opt.headers) });
    if (!ok.includes(res.status)) throw new Error(`GitHub ${res.status} ${opt.method || 'GET'} ${url.replace(API, '')}: ${(await res.text()).slice(0, 160)}`);
    return res;
  };
  const release = async (create) => {
    const res = await call(`${API}/repos/${repo}/releases/tags/${TAG}`, {}, [200, 404]);
    if (res.status === 200) return res.json();
    if (!create) return null;
    return (await call(`${API}/repos/${repo}/releases`, { method: 'POST', body: JSON.stringify({ tag_name: TAG, name: 'Awtad database snapshot', body: 'Encrypted database snapshot. Do not edit.', draft: false, prerelease: true }) })).json();
  };
  return {
    kind: 'github',
    async get() {
      const rel = await release(false);
      const a = rel?.assets?.find((x) => x.name === NAME) || rel?.assets?.find((x) => x.name === TMP);
      if (!a) return null;
      const res = await call(`${API}/repos/${repo}/releases/assets/${a.id}`, { headers: { Accept: 'application/octet-stream' } });
      return Buffer.from(await res.arrayBuffer());
    },
    async put(buf) {
      const rel = await release(true);
      for (const a of rel.assets || []) if (a.name === TMP) await call(`${API}/repos/${repo}/releases/assets/${a.id}`, { method: 'DELETE' });
      const up = await (await call(`https://uploads.github.com/repos/${repo}/releases/${rel.id}/assets?name=${TMP}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: buf })).json();
      for (const a of rel.assets || []) if (a.name === NAME) await call(`${API}/repos/${repo}/releases/assets/${a.id}`, { method: 'DELETE' });
      await call(`${API}/repos/${repo}/releases/assets/${up.id}`, { method: 'PATCH', body: JSON.stringify({ name: NAME }) });
    },
  };
}

/** يختار المخزن من متغيرات البيئة. null = الحفظ الخارجي غير مفعّل. */
export function makeStore(env = process.env) {
  const secret = env.BACKUP_SECRET || config.jwtSecret;
  let store = null;
  if (env.BACKUP_DIR) store = fileStore(env.BACKUP_DIR);
  else if (env.BACKUP_GITHUB_REPO && env.BACKUP_GITHUB_TOKEN) store = githubStore({ repo: env.BACKUP_GITHUB_REPO, token: env.BACKUP_GITHUB_TOKEN });
  if (!store) return null;
  if (!secret) throw new Error('الحفظ الخارجي يحتاج BACKUP_SECRET (أو JWT_SECRET) لتشفير النسخة');
  return { store, secret };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** يستعيد القاعدة من المخزن إن لم يوجد ملف محلي. يرمي خطأ إن تعذّر الوصول أو فكّ التشفير (لا نبدأ بقاعدة فارغة فوق نسخة سليمة). */
export async function restoreIfNeeded({ made = makeStore(), file = config.dbFile, attempts = 4 } = {}) {
  if (!made) return { enabled: false, restored: false };
  if (fs.existsSync(file)) return { enabled: true, restored: false, reason: 'local-db-exists' };
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const buf = await made.store.get();
      if (!buf) return { enabled: true, restored: false, reason: 'no-snapshot' };
      const plain = unpack(buf, made.secret);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.restore`, plain); fs.renameSync(`${file}.restore`, file);
      return { enabled: true, restored: true, bytes: plain.length };
    } catch (e) { last = e; if (/BACKUP_SECRET|صيغة/.test(e.message)) break; await sleep(1500 * (i + 1)); }
  }
  throw last;
}
