import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { auth, rateLimit } from './security.js';
import { bad } from './utils.js';
import { db, get } from './db.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import postingRoutes from './routes/postings.js';
import applicationRoutes from './routes/applications.js';
import dashboardRoutes from './routes/dashboard.js';
import adminRoutes from './routes/admin.js';
import supportRoutes from './routes/support.js';

/** سياسة أمان المحتوى (CSP). السكربتات: من نفس الأصل فقط + بصمات السكربتات المضمّنة في index.html (تُحسب عند الإقلاع) + apis.google.com (يحتاجها Firebase Auth).
 *  الأنماط تسمح بـ inline لأن الواجهة تستعمل style="" كثيراً (لا يُنفَّذ بها كود). */
function inlineScriptHashes() {
  try {
    const html = fs.readFileSync(path.join(config.webDist, 'index.html'), 'utf8');
    return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
  } catch { return []; }
}
export function buildCsp() {
  return [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes().join(' ')} https://apis.google.com`.replace(/\s+/g, ' '),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
    `frame-src https://${config.firebaseProjectId}.firebaseapp.com`,
    "frame-ancestors 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
    ...(config.env === 'production' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}
/** صفحة المعاينة الداخلية (phone.html) تحتاج سكربتاً مضمّناً، فلها سياسة خاصة (لا تُحمّل شيئاً من الخارج). */
const PREVIEW_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'";

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  const csp = buildCsp();
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups', // يسمح بنافذة تسجيل Google المنبثقة
      'Content-Security-Policy': req.path === '/phone.html' ? PREVIEW_CSP : csp,
    });
    if (config.env === 'production') res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store'); // بيانات المستخدمين لا تُخزَّن في متصفح ولا وسيط
    next();
  });

  // CORS: يُسمح فقط لأصول الواجهة المعرّفة في CORS_ORIGINS
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      res.set({ 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Max-Age': '600' });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  /* ping خفيف بلا قاعدة بيانات: يُبقي الخدمة مستيقظة دون إيقاظ القاعدة (حدّ ساعات Neon المجاني) */
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));
  app.get('/api/health', async (_req, res) => {
    try { await get('SELECT 1 AS ok'); res.json({ ok: true, db: db.kind }); }
    catch (e) { console.error('فحص الصحة: القاعدة لا تستجيب:', e.message); res.status(503).json({ ok: false, error: 'قاعدة البيانات لا تستجيب' }); }
  });

  // حماية عامة من الإغراق حسب العنوان (واسعة لأن كثيرين يشتركون بعنوان واحد)، ثم حدّ حسب المستخدم بعد تسجيل الدخول
  app.use('/api', rateLimit({ windowMs: 60 * 1000, max: config.ipRateMax, key: (req) => `ip${req.ip}` }));
  const userLimit = rateLimit({ windowMs: 60 * 1000, max: config.userRateMax, key: (req) => `u${req.user.id}` });

  // مسارات عامة
  app.use('/api', authRoutes, supportRoutes);
  // كل ما بعده يتطلب تسجيل الدخول
  app.use('/api/admin', auth(), userLimit, adminRoutes);
  app.use('/api', auth(), userLimit, meRoutes, postingRoutes, applicationRoutes, dashboardRoutes);

  // أي مسار /api غير معروف يرجع JSON
  app.use('/api', (_req, res) => bad(res, 'المسار غير موجود', 404));

  // تقديم الواجهة من نفس الخادم (اختياري)
  if (config.serveWeb && fs.existsSync(config.webDist)) {
    app.use(express.static(config.webDist));
    // ملف أصول ناقص (جزء واجهة قديم بعد نشر جديد) يُرجع 404 صريحاً بدل صفحة HTML، حتى تعرف الواجهة أنها قديمة وتُحدّث نفسها
app.get(/^\/(assets|fonts)\/.*/, (_req, res) => res.status(404).type('text/plain').send('Not found'));
app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(config.webDist, 'index.html')));
  }

  // معالج الأخطاء: دائماً JSON
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.user) return bad(res, err.message, err.status || 400);
    if (err?.type === 'entity.parse.failed') return bad(res, 'طلب غير صالح');
    if (err?.type === 'entity.too.large') return bad(res, 'حجم الطلب كبير جداً', 413);
    console.error(err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  });

  return app;
}
