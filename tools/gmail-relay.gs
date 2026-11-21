/**
 * أوتاد: مُرسِل بريد مجاني عبر Gmail (Google Apps Script)
 *
 * لماذا؟ الخطط المجانية على Render تحجب SMTP، وخدمات البريد تطلب دومين خاصاً.
 * هذا السكربت يعمل كتطبيق ويب بحسابك في Google، فيرسل منه الإيميلات (الحد ~100 رسالة يومياً للحساب العادي).
 *
 * الإعداد:
 *  1) script.google.com ← New project ← الصق هذا الملف كاملاً مكان الكود الموجود.
 *  2) غيّر قيمة SECRET بالأسفل إلى سرّ طويل عشوائي (نفس القيمة ستضعها في Render باسم MAIL_SCRIPT_SECRET).
 *  3) من القائمة اختر الدالة authorize ثم Run، ووافق على الصلاحيات (مرة واحدة).
 *  4) Deploy ← New deployment ← النوع Web app ← Execute as: Me ← Who has access: Anyone ← Deploy.
 *  5) انسخ رابط Web app (ينتهي بـ /exec) وضعه في Render باسم MAIL_SCRIPT_URL.
 *
 * عند تعديل الكود لاحقاً: Deploy ← Manage deployments ← Edit ← New version (الرابط يبقى نفسه).
 * لا تنشر السرّ في أي مكان عام؛ من يعرفه يستطيع الإرسال من حسابك.
 */
const SECRET = 'PUT_A_LONG_RANDOM_SECRET_HERE';

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (SECRET.indexOf('PUT_A_LONG') === 0 || !b.secret || b.secret !== SECRET) return reply({ ok: false, error: 'unauthorized' });
    const to = String(b.to || '').trim();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) return reply({ ok: false, error: 'bad recipient' });
    MailApp.sendEmail({
      to: to,
      subject: String(b.subject || '').slice(0, 200),
      body: String(b.text || ''),
      htmlBody: String(b.html || ''),
      name: String(b.name || 'Awtad').slice(0, 60),
    });
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** شغّلها مرة واحدة يدوياً لمنح الصلاحيات (إرسال البريد) */
function authorize() {
  Logger.log('Remaining daily quota: ' + MailApp.getRemainingDailyQuota());
}
