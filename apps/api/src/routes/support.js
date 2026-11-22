import { Router } from 'express';
import { config } from '../config.js';
import { get, run } from '../db.js';
import { mailEnabled, sendMail } from '../mailer.js';
import { rateLimit, tryAuth } from '../security.js';
import { getSupport } from '../services.js';
import { bad, emailOk, str, wrap } from '../utils.js';

/* الدعم الفني والتواصل: يقبل رسائل من الزوار والمستخدمين. محميّ من السبام بأربع طبقات:
   حدّ لكل عنوان، وحدّ لكل بريد، وحقل مصيدة مخفي (honeypot)، وسقف يومي عام يحمي القاعدة من الإغراق. */
const r = Router();
export const TOPICS = ['technical', 'account', 'payment', 'suggestion', 'report', 'other'];
const TOPIC_AR = { technical: 'مشكلة تقنية', account: 'حسابي', payment: 'المبالغ والمحفظة', suggestion: 'اقتراح', report: 'بلاغ عن مخالفة', other: 'أخرى' };
const DAILY_CAP = 300;

const perIp = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, key: (req) => `sup|${req.ip}` });
const perEmail = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, key: (req) => { const e = str(req.body?.email, 120).toLowerCase(); return `supm|${emailOk(e) ? e : req.ip}`; } });

r.post('/support', perIp, perEmail, wrap(async (req, res) => {
  const b = req.body || {};
  if (str(b.website, 50)) return res.json({ ok: true, id: 0 }); // مصيدة للروبوتات: نتظاهر بالنجاح دون حفظ
  const user = await tryAuth(req);
  const name = str(b.name, 80) || str(user?.name, 80);
  const email = (str(b.email, 120) || str(user?.email, 120)).toLowerCase();
  const topic = TOPICS.includes(b.topic) ? b.topic : 'other';
  const message = str(b.message, 2000);
  if (name.length < 2) return bad(res, 'أدخل اسمك');
  if (!emailOk(email)) return bad(res, 'أدخل بريداً صحيحاً لنرد عليك');
  if (message.length < 10) return bad(res, 'اكتب رسالتك (10 أحرف على الأقل)');
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  if ((await get('SELECT COUNT(*) c FROM support_tickets WHERE created_at > ?', since)).c >= DAILY_CAP) return bad(res, 'الدعم مشغول الآن، حاول لاحقاً', 429);
  const info = await run('INSERT INTO support_tickets(user_id,name,email,topic,message) VALUES(?,?,?,?,?)', user?.id ?? null, name, email, topic, message);
  const id = Number(info.lastInsertRowid);
  // إشعار بالبريد إن كان بريد الدعم مضبوطاً والإرسال مفعّلاً (لا ننتظره ولا نفشل بسببه)
  const to = (await getSupport()).email;
  if (to && mailEnabled()) {
    const clean = (s) => String(s).replace(/[\r\n]+/g, ' ').slice(0, 80);
    sendMail({ to, subject: `رسالة دعم #${id}: ${TOPIC_AR[topic]}`, text: `من: ${clean(name)} <${email}>\nالموضوع: ${TOPIC_AR[topic]}\n\n${message}\n\nتجدها وتغلقها من لوحة المدير ← رسائل الدعم: ${config.appUrl}/app/support-inbox`, html: '<p dir="rtl" style="font-family:Arial,Tahoma,sans-serif">رسالة دعم جديدة رقم ' + id + ' من ' + clean(name).replace(/[<>&]/g, '') + '. افتح لوحة المدير لقراءتها.</p>' })
      .catch((e) => console.error('تعذّر إرسال إشعار الدعم:', e.message));
  }
  res.json({ ok: true, id });
}));

export default r;
