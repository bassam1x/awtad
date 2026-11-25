/* التحقق من «رمز الهوية» الصادر عن Firebase Authentication (تسجيل الدخول عبر Google).
   الرمز JWT موقّع RS256 بمفاتيح Google العلنية؛ نتحقق من التوقيع والمشروع والجهة المُصدِرة والصلاحية الزمنية،
   فلا يُقبل رمز مزوّر ولا رمز صادر لمشروع آخر. لا نحتاج أي سر على الخادم. */
import crypto from 'node:crypto';
import { config } from './config.js';

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const SKEW = 300; // فرق ساعات مقبول بالثواني
const RETRY = 60_000;

async function fetchCerts() {
  const r = await fetch(CERTS_URL, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`certs ${r.status}`);
  return { certs: await r.json(), maxAge: Number(/max-age=(\d+)/.exec(r.headers.get('cache-control') || '')?.[1]) || 3600 };
}

let source = fetchCerts;
let cache = null; // { keys: Map, expires, fetched }
/** للاختبارات: مصدر مفاتيح بديل. */
export function setCertSource(fn) { source = fn || fetchCerts; cache = null; }

async function publicKey(kid) {
  const now = Date.now();
  // نجدّد عند انتهاء المهلة، أو عند ظهور مفتاح جديد (تدوير المفاتيح) بحد مرة في الدقيقة
  if (!cache || now >= cache.expires || (!cache.keys.has(kid) && now - cache.fetched > RETRY)) {
    const { certs, maxAge } = await source();
    cache = { keys: new Map(Object.entries(certs).map(([k, pem]) => [k, crypto.createPublicKey(pem)])), expires: now + maxAge * 1000, fetched: now };
  }
  return cache.keys.get(kid);
}

const part = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

/** يعيد محتوى الرمز إن كان صحيحاً، وإلا null. يرمي خطأً فقط إن تعذّر جلب مفاتيح Google. */
export async function verifyFirebaseToken(token) {
  const bits = typeof token === 'string' && token.length < 8192 ? token.split('.') : [];
  if (bits.length !== 3) return null;
  let header, p;
  try { header = part(bits[0]); p = part(bits[1]); } catch { return null; }
  if (header?.alg !== 'RS256' || typeof header.kid !== 'string' || !p) return null;
  const key = await publicKey(header.kid);
  if (!key || !crypto.verify('RSA-SHA256', Buffer.from(`${bits[0]}.${bits[1]}`), key, Buffer.from(bits[2], 'base64url'))) return null;
  const now = Math.floor(Date.now() / 1000), pid = config.firebaseProjectId;
  if (p.aud !== pid || p.iss !== `https://securetoken.google.com/${pid}`) return null;
  if (!(p.exp > now) || !(p.iat <= now + SKEW) || !(p.auth_time <= now + SKEW)) return null;
  if (typeof p.sub !== 'string' || !p.sub || p.sub.length > 128) return null;
  return p;
}
