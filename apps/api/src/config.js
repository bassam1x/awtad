import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* لا يوجد .env */ }

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  dbFile: process.env.DB_FILE || path.join(ROOT, 'data', 'mahara.db'),
  secretFile: path.join(ROOT, 'data', '.jwt-secret'),
  jwtSecret: process.env.JWT_SECRET || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  // أصول الواجهة المسموح لها باستدعاء الـ API من متصفح آخر (CloudFront مثلاً)، مفصولة بفاصلة
  corsOrigins: list(process.env.CORS_ORIGINS),
  // مسار مجلد الواجهة المبنية لتقديمها من نفس الخادم (اختياري)
  webDist: process.env.WEB_DIST || path.join(ROOT, '..', 'web', 'dist'),
  serveWeb: process.env.SERVE_WEB !== 'false',
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 20,
  trustProxy: process.env.TRUST_PROXY === 'true',
};
