import { useSyncExternalStore } from 'react';
import { api, getToken } from './api.js';
import { lang } from './i18n/index.js';

/* ترجمة محتوى المستخدمين (عناوين الوظائف، الأوصاف، النبذات...) إلى لغة الواجهة.
   النص يظهر فوراً بلغته الأصلية، ثم يُستبدل بالترجمة عند وصولها. كل الطلبات تُجمَّع في طلب واحد،
   والخادم يخزّن كل ترجمة دائماً فلا تُحسب مرتين. */
const AR = /[؀-ۿ]/g, LAT = /[A-Za-z]/g, KU_ONLY = /[ەێۆڕڵڤ]/;
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

/** هل يحتاج هذا النص ترجمة إلى لغة الواجهة؟ (نفس منطق الخادم، لتجنّب الطلبات غير اللازمة) */
export function needsTr(text) {
  if (typeof text !== 'string') return false;
  const s = text.trim();
  if (s.length < 2) return false;
  const ar = (s.match(AR) || []).length, lat = (s.match(LAT) || []).length, tot = ar + lat;
  if (!tot) return false;
  if (lang === 'en') return ar / tot > 0.6;
  if (lang === 'ku') return (ar / tot > 0.6 && !KU_ONLY.test(s)) || (lat / tot > 0.6 && words(s) >= 3);
  return lat / tot > 0.6 && words(s) >= 3;
}

const cache = new Map();
const failedAt = new Map();
const queue = new Set();
const subs = new Set();
let version = 0, timer = 0, busy = false;
const emit = () => { version++; subs.forEach((f) => f()); };
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

async function flush() {
  timer = 0;
  if (busy || !queue.size) return;
  busy = true;
  const batch = [...queue].slice(0, 40);
  batch.forEach((x) => queue.delete(x));
  try {
    const r = await api.post('/translate', { lang, texts: batch });
    batch.forEach((x, i) => { const o = r.translations?.[i]; if (o && o !== x) cache.set(x, o); else if (!o) failedAt.set(x, Date.now()); });
  } catch { batch.forEach((x) => failedAt.set(x, Date.now())); }
  busy = false;
  emit();
  if (queue.size) timer = setTimeout(flush, 30);
}

/** يعيد الترجمة إن كانت جاهزة، وإلا النص الأصلي ويطلبها في الخلفية */
export function tr(text) {
  if (!needsTr(text) || !getToken()) return text;
  const hit = cache.get(text);
  if (hit) return hit;
  const f = failedAt.get(text);
  if (!queue.has(text) && (!f || Date.now() - f > 60000)) {
    queue.add(text);
    if (!timer) timer = setTimeout(flush, 40);
  }
  return text;
}

/** ملف يُعيد التصيير عند وصول ترجمات جديدة */
export const useTrVersion = () => useSyncExternalStore(subscribe, () => version);

/** <Tr>{نص}</Tr> يعرض النص مترجماً إلى لغة الواجهة (أي نص ليس سلسلة يُترك كما هو) */
export function Tr({ children }) {
  useTrVersion();
  return typeof children === 'string' ? tr(children) : (children ?? null);
}
