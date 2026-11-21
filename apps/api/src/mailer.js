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

/* نص رسالة إعادة تعيين كلمة المرور بلغة المستخدم */
const COPY = {
  ar: { subject: 'إعادة تعيين كلمة المرور في أوتاد', hi: 'مرحباً', body: 'طلبت إعادة تعيين كلمة المرور. اضغط الرابط التالي لاختيار كلمة جديدة (صالح 30 دقيقة):', btn: 'تعيين كلمة مرور جديدة', ign: 'إن لم تطلب ذلك فتجاهل هذه الرسالة؛ لن يتغير شيء في حسابك.', dir: 'rtl' },
  en: { subject: 'Reset your Awtad password', hi: 'Hello', body: 'You asked to reset your password. Use the link below to choose a new one (valid for 30 minutes):', btn: 'Set a new password', ign: 'If you did not request this, ignore this email; nothing will change in your account.', dir: 'ltr' },
  ku: { subject: 'ڕێکخستنەوەی وشەی نهێنی لە ئەوتاد', hi: 'سڵاو', body: 'داوای ڕێکخستنەوەی وشەی نهێنیت کرد. ئەم بەستەرە بەکاربهێنە بۆ هەڵبژاردنی یەکێکی نوێ (٣٠ خولەک کاردەکات):', btn: 'وشەی نهێنی نوێ دابنێ', ign: 'ئەگەر تۆ داوات نەکردووە، ئەم نامەیە پشتگوێ بخە؛ هیچ شتێک لە هەژمارەکەت ناگۆڕێت.', dir: 'rtl' },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function resetEmail({ name, link, lang = 'ar' }) {
  const c = COPY[lang] || COPY.ar;
  const text = `${c.hi} ${name}\n\n${c.body}\n${link}\n\n${c.ign}`;
  const html = `<div dir="${c.dir}" style="font-family:Arial,Tahoma,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">
<h2 style="margin:0 0 12px">${esc(c.subject)}</h2><p>${esc(c.hi)} ${esc(name)}،</p><p>${esc(c.body)}</p>
<p style="margin:24px 0"><a href="${esc(link)}" style="background:#1e40af;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block">${esc(c.btn)}</a></p>
<p style="color:#64748b;font-size:13px">${esc(c.ign)}</p></div>`;
  return { subject: c.subject, text, html };
}
