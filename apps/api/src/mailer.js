import { config } from './config.js';

/* إرسال البريد. الخطط المجانية على Render تحجب SMTP، فلا نستخدمه. طريقتان عبر HTTPS (الأولى لها الأولوية إن عُيّنت):
   1) Gmail عبر Google Apps Script: MAIL_SCRIPT_URL و MAIL_SCRIPT_SECRET (مجاني، بلا دومين، ~100 رسالة يومياً)
   2) Brevo: BREVO_API_KEY و MAIL_FROM (بريد مُرسِل موثَّق في Brevo)
   بدونهما لا يُرسل شيء. */
let sender = null; // لاستبداله في الاختبارات

export const setMailer = (fn) => { sender = fn; };
const viaScript = () => !!(config.mailScriptUrl && config.mailScriptSecret);
const viaBrevo = () => !!(config.brevoApiKey && config.mailFrom);
export const mailEnabled = () => !!sender || viaScript() || viaBrevo();

export async function sendMail({ to, subject, text, html }) {
  if (sender) return sender({ to, subject, text, html });
  if (viaScript()) {
    // السكربت يردّ بإعادة توجيه 302 إلى عنوان النتيجة؛ fetch يتبعها تلقائياً
    const res = await fetch(config.mailScriptUrl, {
      method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, redirect: 'follow',
      body: JSON.stringify({ secret: config.mailScriptSecret, to, subject, text, html, name: config.mailFromName }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) throw new Error(`Gmail relay ${res.status}: ${String(body?.error || 'رد غير متوقع').slice(0, 160)}`);
    return true;
  }
  if (!viaBrevo()) throw new Error('البريد غير مفعّل: عيّن MAIL_SCRIPT_URL و MAIL_SCRIPT_SECRET (أو BREVO_API_KEY و MAIL_FROM)');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': config.brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: config.mailFromName, email: config.mailFrom }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return true;
}
