import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { auth } from './security.js';
import { bad } from './utils.js';
import { db, get } from './db.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import postingRoutes from './routes/postings.js';
import applicationRoutes from './routes/applications.js';
import dashboardRoutes from './routes/dashboard.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
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

  // مسارات عامة
  app.use('/api', authRoutes);
  // كل ما بعده يتطلب تسجيل الدخول
  app.use('/api/admin', auth(), adminRoutes);
  app.use('/api', auth(), meRoutes, postingRoutes, applicationRoutes, dashboardRoutes);

  // أي مسار /api غير معروف يرجع JSON
  app.use('/api', (_req, res) => bad(res, 'المسار غير موجود', 404));

  // تقديم الواجهة من نفس الخادم (اختياري)
  if (config.serveWeb && fs.existsSync(config.webDist)) {
    app.use(express.static(config.webDist));
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
