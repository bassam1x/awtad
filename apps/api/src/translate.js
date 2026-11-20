import crypto from 'node:crypto';
import { get, run } from './db.js';

/** ترجمة محتوى المستخدمين (المنشورات، النبذات...) إلى لغة الواجهة، مع تخزين دائم لكل نص فلا يُترجم مرتين.
 *  المزوّد الافتراضي: نقطة Google المجانية غير الرسمية، ثم MyMemory احتياطاً. للإنتاج الجاد يُنصح بمزوّد رسمي
 *  بمفتاح (Google Cloud Translation أو DeepL...) عبر setProvider أو متغير TRANSLATE_PROVIDER=none لتعطيل الترجمة. */
const CODE = { ar: 'ar', en: 'en', ku: 'ckb' };
export const LANGS = Object.keys(CODE);

const AR = /[؀-ۿ]/g, LAT = /[A-Za-z]/g, KU_ONLY = /[ەێۆڕڵڤ]/;
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

/** هل يحتاج النص ترجمة إلى هذه اللغة؟ (يحمي من ترجمة الأسماء التقنية مثل React أو النصوص المكتوبة أصلاً بلغة الواجهة) */
export function needsTranslation(text, lang) {
  if (typeof text !== 'string') return false;
  const s = text.trim();
  if (s.length < 2 || !CODE[lang]) return false;
  const ar = (s.match(AR) || []).length, lat = (s.match(LAT) || []).length, tot = ar + lat;
  if (!tot) return false;
  const arShare = ar / tot, latShare = lat / tot;
  if (lang === 'en') return arShare > 0.6;
  if (lang === 'ku') return (arShare > 0.6 && !KU_ONLY.test(s)) || (latShare > 0.6 && words(s) >= 3);
  return latShare > 0.6 && words(s) >= 3; // ar
}

async function viaGoogle(text, target) {
  const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`google ${r.status}`);
  const j = await r.json();
  const out = (j?.[0] || []).map((x) => x?.[0] || '').join('');
  if (!out) throw new Error('google empty');
  return out;
}
async function viaMyMemory(text, target) {
  if (text.length > 480) throw new Error('mymemory too long');
  const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${/[؀-ۿ]/.test(text) ? 'ar' : 'en'}|${target}`, { signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  const out = j?.responseData?.translatedText;
  if (!r.ok || !out || j.responseStatus !== 200 || /MYMEMORY WARNING/i.test(out)) throw new Error('mymemory failed');
  return out;
}

let provider = async (text, target) => {
  const mode = process.env.TRANSLATE_PROVIDER || 'google';
  if (mode === 'none') return null;
  const chain = mode === 'mymemory' ? [viaMyMemory] : [viaGoogle, viaMyMemory];
  for (const f of chain) { try { return await f(text, target); } catch { /* التالي */ } }
  return null;
};
/** لاستبدال المزوّد (مزوّد رسمي بمفتاح، أو وهمي في الاختبارات) */
export const setProvider = (fn) => { provider = fn; };

const hash = (t) => crypto.createHash('sha1').update(t).digest('hex');

export async function translateMany(texts, lang) {
  const target = CODE[lang];
  const out = new Array(texts.length).fill(null);
  const todo = [];
  texts.forEach((t, i) => {
    if (!needsTranslation(t, lang)) { out[i] = t; return; }
    const h = hash(t.trim());
    const hit = get('SELECT out FROM translations WHERE h=? AND lang=?', h, lang);
    if (hit) out[i] = hit.out; else todo.push([i, t.trim(), h]);
  });
  // نترجم بالتوازي لكن بحدّ 4 طلبات معاً حتى لا نُحظر
  for (let k = 0; k < todo.length; k += 4) {
    await Promise.all(todo.slice(k, k + 4).map(async ([i, t, h]) => {
      const r = await provider(t, target);
      if (r && r.trim()) { out[i] = r.trim(); run('INSERT OR REPLACE INTO translations(h,lang,out) VALUES(?,?,?)', h, lang, out[i]); }
    }));
  }
  return out;
}
