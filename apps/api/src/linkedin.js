import { config } from './config.js';

/* تسجيل الدخول عبر LinkedIn (Sign In with LinkedIn using OpenID Connect): نبادل الـ code بتوكن ثم نقرأ userinfo.
   عنوان العودة يجب أن يطابق المسجّل في تطبيق LinkedIn: {APP_URL}/auth/linkedin/callback */
export const linkedinEnabled = () => !!(config.linkedinClientId && config.linkedinClientSecret);
export const linkedinRedirect = () => `${config.appUrl}/auth/linkedin/callback`;

let doFetch = (...a) => fetch(...a); // لاستبداله في الاختبارات
export const setLinkedinFetch = (fn) => { doFetch = fn || ((...a) => fetch(...a)); };

/** يعيد { sub, name, email, picture } أو يرمي خطأً برسالة عربية مناسبة */
export async function exchangeLinkedinCode(code) {
  const body = new URLSearchParams({ grant_type: 'authorization_code', code: String(code || ''), redirect_uri: linkedinRedirect(), client_id: config.linkedinClientId, client_secret: config.linkedinClientSecret });
  const tok = await doFetch('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15000) });
  const tj = await tok.json().catch(() => ({}));
  if (!tok.ok || !tj.access_token) throw Object.assign(new Error('تعذّر التحقق من حساب LinkedIn'), { status: 401 });
  const ui = await doFetch('https://api.linkedin.com/v2/userinfo', { headers: { authorization: `Bearer ${tj.access_token}` }, signal: AbortSignal.timeout(15000) });
  const p = await ui.json().catch(() => ({}));
  if (!ui.ok || !p.sub) throw Object.assign(new Error('تعذّر قراءة بيانات حساب LinkedIn'), { status: 401 });
  if (!p.email || p.email_verified === false || p.email_verified === 'false') throw Object.assign(new Error('بريد LinkedIn غير موثّق'), { status: 401 });
  return { sub: String(p.sub), name: p.name || [p.given_name, p.family_name].filter(Boolean).join(' ') || String(p.email).split('@')[0], email: String(p.email).toLowerCase(), picture: p.picture || '' };
}
