import { t } from './i18n/index.js';
/* عميل الـ API: كل الردود JSON.
   VITE_API_URL: عنوان الخادم عند فصل الواجهة (مثلاً على S3/CloudFront)؛ فارغ = نفس الأصل. */
const BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api`;
const KEY = 'mahara-token';
const TIMEOUT_MS = 20000;

export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* ignore */ } };

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function req(method, path, body) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, signal: ctrl.signal, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error(t('تعذّر الاتصال بالخادم. تأكد أنه يعمل.'));
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && !path.startsWith('/auth')) onUnauthorized();
  if (!res.ok && res.status !== 202) throw Object.assign(new Error(t(data.error || 'حدث خطأ')), { status: res.status });
  return Object.assign(data, res.status === 202 ? { _status: 202 } : {});
}

export const api = {
  get: (p) => req('GET', p),
  post: (p, b = {}) => req('POST', p, b),
  put: (p, b = {}) => req('PUT', p, b),
  patch: (p, b = {}) => req('PATCH', p, b),
  del: (p) => req('DELETE', p),
};
