/** أخطاء يُسمح بعرض رسالتها للمستخدم (400 افتراضياً). */
export class UserError extends Error {
  constructor(message, status = 400) { super(message); this.user = true; this.status = status; }
}

/** يغلّف المعالج ليلتقط الأخطاء المتزامنة وغير المتزامنة ويحوّلها إلى JSON. */
export const wrap = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);

export const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
export const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; };
export const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** يقبل روابط http/https فقط (يمنع javascript: وغيرها) أو نصاً فارغاً. */
export const safeUrl = (v, max = 600) => {
  const s = str(v, max); if (!s) return '';
  try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u.href.slice(0, max) : ''; } catch { return ''; }
};

/** صور نقطية فقط (بدون SVG) وبحجم معقول. */
export const safeAvatar = (v) =>
  (typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 700000 ? v : null);

export const SPECS = ['برمجة', 'تصميم', 'هندسة'];
export const parseList = (v, max = 15, len = 40) =>
  (Array.isArray(v) ? v : String(v || '').split(/[,،]/)).map((x) => str(x, len)).filter(Boolean).slice(0, max);
