/** أخطاء يُسمح بعرض رسالتها للمستخدم (400 افتراضياً). */
export class UserError extends Error {
  constructor(message, status = 400) { super(message); this.user = true; this.status = status; }
}

/** يغلّف المعالج ليلتقط الأخطاء المتزامنة وغير المتزامنة ويحوّلها إلى JSON. */
export const wrap = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);

export const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
// الحرف الصفري (\u0000) غير مسموح في نصوص PostgreSQL ويسبّب خطأ 500، فنحذفه من كل المدخلات
export const str = (v, max = 500) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '');
export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; };
/** معاملات الاستعلام: نصوص فقط (المصفوفات والكائنات من ?a[]=1 تُعامل كفارغة بدل أن تُسقط الاستعلام). */
export const qs = (v) => (typeof v === 'string' ? v.replace(/\u0000/g, '') : '');
export const clamp = (n, lo, hi, dflt) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt);
export const MAX_MONEY = 1_000_000_000; // سقف معقول للمبالغ (ويحمي من تجاوز INTEGER في القاعدة)
/** اسم حساب إنستغرام من @name أو name أو رابط كامل؛ فارغ إن لم يكن صالحاً (يمنع حقن روابط أخرى). */
export const igHandle = (v) => {
  const s = str(v, 120).replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0];
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : '';
};
export const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** يقبل روابط http/https فقط (يمنع javascript: وغيرها) أو نصاً فارغاً. */
export const safeUrl = (v, max = 600) => {
  const s = str(v, max); if (!s) return '';
  try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u.href.slice(0, max) : ''; } catch { return ''; }
};

/** صور نقطية فقط (بدون SVG) وبحجم معقول. */
export const safeAvatar = (v) =>
  (typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 700000 ? v : null);

/** التخصصات: تغطي المهن التقنية والخدمية (مطاعم، كاشير، توصيل…) مع «أخرى» لما لا يناسب أياً منها. */
export const SPECS = ['برمجة', 'تصميم', 'هندسة', 'تسويق ومحتوى', 'مبيعات وكاشير', 'مطاعم وكافيهات', 'خدمة عملاء', 'محاسبة وإدارة', 'توصيل ونقل', 'تعليم وتدريب', 'أخرى'];
/** أنواع الدوام؛ «عن بعد» لا يحتاج عنواناً ولا موقعاً. */
export const JOB_TYPES = ['دوام كامل', 'دوام جزئي', 'عن بعد'];
export const parseList = (v, max = 15, len = 40) =>
  (Array.isArray(v) ? v : String(v || '').split(/[,،]/)).map((x) => str(x, len)).filter(Boolean).slice(0, max);
