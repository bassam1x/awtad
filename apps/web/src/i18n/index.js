/* الترجمة: العربية هي لغة المصدر؛ المفتاح هو النص العربي نفسه، وغياب الترجمة يعرض النص الأصلي.
   تغيير اللغة يعيد تحميل الصفحة، فتُحسب كل النصوص (حتى الثوابت على مستوى الوحدات) بلغة واحدة ثابتة. */
import en from './en.js';
import ku from './ku.js';

export const LANGS = {
  ar: { label: 'العربية', dir: 'rtl', locale: 'ar-IQ' },
  en: { label: 'English', dir: 'ltr', locale: 'en-US' },
  ku: { label: 'کوردی', dir: 'rtl', locale: 'ckb-IQ' },
};
const KEY = 'mahara-lang';
const DICTS = { en, ku };
const HAS_AR = /[؀-ۿ]/;

function readLang() {
  try { const s = localStorage.getItem(KEY); if (s && LANGS[s]) return s; } catch { /* ignore */ }
  return 'ar';
}

export const lang = readLang();
export const dir = LANGS[lang].dir;
export const locale = LANGS[lang].locale;
export const isRtl = dir === 'rtl';

if (typeof document !== 'undefined') {
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
}

export function setLang(l) {
  if (!LANGS[l] || l === lang) return;
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  location.reload();
}

/** يترجم نصاً عربياً. يحافظ على المسافات الطرفية، ويدعم {متغيرات}. */
export function t(s, vars) {
  if (typeof s !== 'string' || !s) return s;
  let out = s;
  if (lang !== 'ar') {
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const core = m[2].replace(/\s+/g, ' ');
    const hit = DICTS[lang][core];
    if (hit !== undefined) out = m[1] + hit + m[3];
    else if (HAS_AR.test(core) && typeof window !== 'undefined') (window.__i18nMissing ||= new Set()).add(core);
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
  return out;
}
