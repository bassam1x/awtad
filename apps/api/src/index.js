import { config } from './config.js';
import { restoreIfNeeded } from './backup-store.js';

/* 1) استعادة القاعدة من المخزن الخارجي (إن فُعّل) قبل فتحها. إن تعذّرت لا نبدأ بقاعدة فارغة
      حتى لا تُستبدل النسخة السليمة بلقطة فارغة؛ تُعيد المنصة تشغيل الخدمة وتحاول مجدداً. */
try {
  const r = await restoreIfNeeded();
  if (r.restored) console.log(`استُعيدت القاعدة من النسخة الخارجية (${r.bytes} بايت).`);
  else if (r.enabled) console.log(r.reason === 'no-snapshot' ? 'لا توجد نسخة خارجية بعد: بداية جديدة.' : 'يوجد ملف قاعدة محلي: لن تُستعاد نسخة.');
} catch (e) {
  console.error('تعذّرت استعادة القاعدة من النسخة الخارجية، تم إيقاف الإقلاع حمايةً للبيانات:', e.message);
  process.exit(1);
}

/* 2) الآن نفتح القاعدة ونشغّل الخادم */
const { seedIfEmpty } = await import('./seed.js');
const { createApp } = await import('./app.js');
const { startBackups, flush } = await import('./backup.js');

seedIfEmpty();
startBackups();
const server = createApp().listen(config.port, () => console.log(`أوتاد API تعمل على http://localhost:${config.port}`));

/* 3) عند الإيقاف (نوم الخدمة أو نشر جديد) نرفع آخر لقطة قبل الخروج */
let closing = false;
const shutdown = async (sig) => {
  if (closing) return;
  closing = true;
  console.log(`${sig}: حفظ آخر لقطة قبل الإيقاف...`);
  const t = setTimeout(() => process.exit(1), 20000); t.unref();
  try { await flush(); } catch (e) { console.error(e.message); }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => shutdown(s));
