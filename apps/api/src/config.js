import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* لا يوجد .env */ }

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  // PostgreSQL: DATABASE_URL (الإنتاج، مثل Neon). بدونه تُستخدم PGlite محلياً في مجلد بجانب DB_FILE.
  databaseUrl: process.env.DATABASE_URL || '',
  dbFile: process.env.DB_FILE || path.join(ROOT, 'data', 'awtad.db'),
  pgliteDir: (process.env.DB_FILE || path.join(ROOT, 'data', 'awtad.db')) + '.pgdata',
  secretFile: path.join(ROOT, 'data', '.jwt-secret'),
  jwtSecret: process.env.JWT_SECRET || '',
  // تسجيل الدخول عبر Google من خلال Firebase Authentication. هذه القيم علنية بطبيعتها (تصل لكل متصفح)، والحماية
  // بالنطاقات المصرّحة في Firebase وبالتحقق من الرمز في الخادم. اجعل FIREBASE_API_KEY فارغاً لإلغاء الخدمة.
  firebaseApiKey: process.env.FIREBASE_API_KEY ?? 'AIzaSyCE4sleI3Osot5kcHhT_YLjNDOKFQyLZeA',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'awtad-5aeb2',
  // تسجيل الدخول عبر LinkedIn (OpenID Connect): معرّف التطبيق علني، والسر يبقى في الخادم
  linkedinClientId: process.env.LINKEDIN_CLIENT_ID || '',
  linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
  // عنوان المنصة العلني لبناء روابط البريد وعنوان العودة من LinkedIn (RENDER_EXTERNAL_URL يوفّره Render تلقائياً)
  appUrl: (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${Number(process.env.PORT) || 4000}`).replace(/\/$/, ''),
  // بريد استرجاع كلمة المرور عبر واجهة Brevo (مجانية 300 رسالة يومياً؛ SMTP محجوب على الخطط المجانية لذا نستخدم HTTPS)
  brevoApiKey: process.env.BREVO_API_KEY || '',
  mailFrom: process.env.MAIL_FROM || '',
  // بديل مجاني بلا دومين: سكربت Google Apps Script منشور كتطبيق ويب يرسل من حساب Gmail نفسه (انظر tools/gmail-relay.gs)
  mailScriptUrl: process.env.MAIL_SCRIPT_URL || '',
  mailScriptSecret: process.env.MAIL_SCRIPT_SECRET || '',
  mailFromName: process.env.MAIL_FROM_NAME || 'أوتاد',
  // قنوات الدعم (تُضبط من لوحة المدير أيضاً؛ ما في لوحة المدير يغلب هذه القيم)
  supportEmail: process.env.SUPPORT_EMAIL || 'iqawtad@gmail.com',
  supportInstagram: process.env.SUPPORT_INSTAGRAM || 'awtadiq',
  // أصول الواجهة المسموح لها باستدعاء الـ API من متصفح آخر (CloudFront مثلاً)، مفصولة بفاصلة
  corsOrigins: list(process.env.CORS_ORIGINS),
  // مسار مجلد الواجهة المبنية لتقديمها من نفس الخادم (اختياري)
  webDist: process.env.WEB_DIST || path.join(ROOT, '..', 'web', 'dist'),
  serveWeb: process.env.SERVE_WEB !== 'false',
  // محاولات الدخول والتسجيل لكل (عنوان + مسار) كل ربع ساعة. واسع لأن كثيرين في العراق يشتركون بعنوان واحد عبر شبكات الجوال؛
  // تخمين كلمات المرور محمي بحد منفصل لكل (بريد + عنوان) في loginGuard.
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 100,
  // حدود الطلبات في الدقيقة: لكل عنوان (واسع) ولكل مستخدم مسجّل
  ipRateMax: Number(process.env.IP_RATE_MAX) || 1500,
  userRateMax: Number(process.env.USER_RATE_MAX) || 600,
  trustProxy: process.env.TRUST_PROXY === 'true',
};
