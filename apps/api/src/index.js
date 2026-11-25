import { config } from './config.js';
import { startKeepAlive } from './keepalive.js';

/* القاعدة (PostgreSQL) تُفتح عند أول استيراد لـ db.js: DATABASE_URL في الإنتاج، وPGlite محلياً. */
const { seedIfEmpty, syncAdminPassword } = await import('./seed.js');
const { createApp } = await import('./app.js');
const { db } = await import('./db.js');

if (config.env === 'production' && db.kind !== 'postgres') {
  console.warn('تحذير: لا يوجد DATABASE_URL، فالبيانات على قرص مؤقت وتُفقد عند إعادة تشغيل الخدمة المجانية.');
}
await seedIfEmpty();
await syncAdminPassword();
const server = createApp().listen(config.port, () => console.log(`أوتاد API تعمل على http://localhost:${config.port} (قاعدة: ${db.kind})`));

startKeepAlive();

/* إغلاق نظيف عند إيقاف الخدمة */
let closing = false;
const shutdown = (sig) => {
  if (closing) return;
  closing = true;
  console.log(`${sig}: إغلاق...`);
  setTimeout(() => process.exit(0), 5000).unref();
  server.close(async () => { try { await db.close(); } catch { /* تجاهل */ } process.exit(0); });
};
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => shutdown(s));
