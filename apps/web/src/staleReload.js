/* بعد نشر نسخة جديدة تختفي أجزاء الواجهة القديمة (الملفات ذات الأسماء المشفّرة)، فتفشل الصفحة المفتوحة عند فتح قسم جديد.
   نعيد تحميل الصفحة تلقائياً مرة واحدة فقط لجلب النسخة الجديدة، ثم نصفّر العلامة بعد استقرار الصفحة. */
const KEY = 'awtad-stale-reload';
export const isChunkError = (e) => /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically|Unable to preload CSS/i.test(String(e?.message || e || ''));
export function reloadOnceIfStale(e) {
  try {
    if (!isChunkError(e) || sessionStorage.getItem(KEY)) return false;
    sessionStorage.setItem(KEY, '1'); location.reload(); return true;
  } catch { return false; }
}
export function armStaleReload() {
  window.addEventListener('vite:preloadError', (ev) => { if (reloadOnceIfStale(ev.payload || ev)) ev.preventDefault(); });
  window.addEventListener('unhandledrejection', (ev) => { reloadOnceIfStale(ev.reason); });
  setTimeout(() => { try { sessionStorage.removeItem(KEY); } catch { /* تجاهل */ } }, 15000);
}
