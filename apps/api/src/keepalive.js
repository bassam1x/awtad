/* الخطة المجانية على Render تُنيم الخدمة بعد 15 دقيقة بلا زيارات، فينتظر أول زائر قرابة دقيقة.
   نطلب عنواننا العلني دورياً. جدولة GitHub (keepalive.yml) تتأخر ساعة أو أكثر فلا تكفي وحدها، لكنها تبقى لإيقاظ الخدمة إن نامت.
   RENDER_EXTERNAL_URL يوفّره Render تلقائياً، فلا يعمل هذا في أي مكان آخر. للإيقاف: KEEP_ALIVE=false */
export function startKeepAlive({ url = process.env.RENDER_EXTERNAL_URL, enabled = process.env.KEEP_ALIVE !== 'false', every = 10 * 60 * 1000, fetcher = fetch } = {}) {
  if (!url || !enabled) return null;
  const target = `${url.replace(/\/$/, '')}/api/ping`;   // لا يلمس القاعدة، فتبقى Neon ضمن حدّها المجاني
  const timer = setInterval(() => { fetcher(target, { signal: AbortSignal.timeout(20000) }).catch(() => { /* نعيد في الدورة التالية */ }); }, every);
  timer.unref();
  return timer;
}
