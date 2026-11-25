# أوتاد

منصة توظيف ومشاريع تعاونية للطلاب والخريجين والشركات، بلا شرط سنوات الخبرة.

```
apps/api   خادم Node.js + Express يرجّع JSON فقط، قاعدة PostgreSQL
apps/web   واجهة React + Vite + Tailwind + React Router
infra/     قالب CloudFormation وسكربت نشر الواجهة على S3 + CloudFront
```

يتطلب Node.js 22.13 أو أحدث.

## التشغيل محلياً

```bash
npm install
npm run build      # يبني الواجهة، ويقدّمها الخادم من نفس العنوان
npm start          # http://localhost:4000
```

للتطوير بنافذتين: `npm run dev:api` و`npm run dev:web` (الواجهة على http://localhost:5173 وتمرّر /api إلى 4000).

الاختبارات: `npm test`

## الحسابات التجريبية (بيئة التطوير فقط)

| الدور | البريد | كلمة المرور |
|---|---|---|
| مدير | admin@awtad.iq | Admin@12345 |
| شركة | nibras@demo.iq / dijla@demo.iq | Demo@1234 |
| مبدع | sara@demo.iq / ali@demo.iq | Demo@1234 |

في الإنتاج (`NODE_ENV=production`) تُنشأ قاعدة فارغة فيها حساب المدير فقط، بكلمة من `ADMIN_PASSWORD` أو عشوائية تُطبع مرة واحدة في السجل.

## الإعداد (`apps/api/.env`)

انظر [apps/api/.env.example](apps/api/.env.example). أهمها: `JWT_SECRET` (مطلوب في الإنتاج)، `CORS_ORIGINS` (عنوان الواجهة عند فصلها)، `GOOGLE_CLIENT_ID`، `TRUST_PROXY`.

## واجهة الـ API

كل الردود JSON، بما فيها الأخطاء (`{"error": "..."}`) والمسارات غير المعروفة. المصادقة بترويسة `Authorization: Bearer <token>`. فحص الصحة: `GET /api/health`.

## النشر على AWS

**الطريقة المستحسنة:** خادم Lightsail واحد عليه كل شيء (المنصة وقاعدة البيانات وhttps والنسخ الاحتياطي) بسكربت جاهز. الدليل خطوة بخطوة: [deploy/aws/README.md](deploy/aws/README.md).

**بديل للواجهة وحدها:** على S3 خلف CloudFront (الدلو خاص، والوصول عبر OAC، ومسارات React Router تُوجَّه إلى index.html):

```powershell
.\infra\deploy-web.ps1 -StackName awtad-web -BucketName <اسم-فريد> -ApiUrl https://api.example.com -Region eu-central-1
```

الخادم (Node) يحتاج مكاناً دائماً مثل EC2 مع `systemctl`/pm2 أو أي استضافة، ويتصل بقاعدة PostgreSQL خارجية (`DATABASE_URL`). اضبط عليه `NODE_ENV=production` و`JWT_SECRET` و`CORS_ORIGINS=<عنوان CloudFront>` و`TRUST_PROXY=true` خلف HTTPS.

## ترجمة المحتوى

عند تغيير لغة الواجهة تتغير كل النصوص الثابتة، ويُترجَم أيضاً **محتوى المستخدمين** (عناوين الوظائف والأوصاف والنبذات...) تلقائياً عبر `POST /api/translate`، وتُخزَّن كل ترجمة في قاعدة البيانات فلا تُحسب مرتين. رسائل الدردشة خاصة فلا تُترجم تلقائياً، وبجانب كل رسالة زر «ترجمة». المزوّد الافتراضي نقطة Google المجانية غير الرسمية (مع MyMemory احتياطاً)؛ للتعطيل `TRANSLATE_PROVIDER=none`، وللإنتاج الجاد استخدم مزوّداً رسمياً بمفتاح عبر `setProvider`.

## قاعدة البيانات (PostgreSQL)

الخادم يستخدم PostgreSQL:

- **الإنتاج:** عيّن `DATABASE_URL` (مثلاً قاعدة مجانية على [Neon](https://neon.tech): `postgresql://user:pass@host/db?sslmode=require`). تُنشأ الجداول تلقائياً عند أول إقلاع، وتبقى البيانات عند إعادة تشغيل الخدمة أو نشر نسخة جديدة. يُفضَّل رابط الاتصال المجمَّع (`-pooler`).
- **التطوير والاختبارات:** بدون `DATABASE_URL` تُستخدم [PGlite](https://pglite.dev) (PostgreSQL حقيقي داخل العملية، يُحفظ في `data/awtad.db.pgdata`) فلا حاجة لتثبيت شيء.
- فحص الصحة `GET /api/health` يلمس القاعدة ويعيد `db: "postgres"` أو `"pglite"`؛ وعند تعطلها يعيد 503.
- في الإنتاج بدون `DATABASE_URL` يطبع الخادم تحذيراً لأن البيانات تُفقد على الخدمات المجانية ذات القرص المؤقت.
## تسجيل الدخول عبر Google

- يعمل عبر **Firebase Authentication** (مشروع `awtad-5aeb2`): نافذة Google في المتصفح تعيد رمز هوية، ويتحقق الخادم من توقيعه ومشروعه وأن مصدره Google وبريده موثّق (`apps/api/src/firebase.js`)، ثم يفتح جلسة المنصة المعتادة. المستخدم الجديد يختار نوع حسابه، والحساب الموجود بنفس البريد يُربط به.
- المطلوب في Firebase Console: تفعيل مزوّد Google، وإضافة نطاق المنصة إلى Authentication ← Settings ← Authorized domains (مضاف: `awtad.onrender.com`). عند تغيير النطاق أضف الجديد هناك.
- يمكن للمدير تعطيله من «إعدادات المنصة». متصفحات التطبيقات المضمّنة (إنستغرام وغيره) ترفضها Google، فتظهر رسالة تطلب فتح المنصة في Chrome أو Safari.

## تسجيل الدخول عبر LinkedIn واسترجاع كلمة المرور

- **LinkedIn:** أنشئ تطبيقاً في [LinkedIn Developers](https://www.linkedin.com/developers/apps) (يتطلب صفحة شركة مجانية)، وفعّل المنتج «Sign In with LinkedIn using OpenID Connect»، وأضف عنوان العودة `{APP_URL}/auth/linkedin/callback`، ثم عيّن `LINKEDIN_CLIENT_ID` و`LINKEDIN_CLIENT_SECRET`. المستخدم الجديد يختار نوع حسابه (مبدع/شركة) بعد الدخول، والحساب الموجود بنفس البريد يُربط به (LinkedIn تثبت ملكية البريد).
- **استرجاع كلمة المرور:** «نسيت كلمة المرور؟» ترسل رابطاً صالحاً 30 دقيقة ولمرة واحدة (نخزّن بصمته فقط)، ويُبطل كل الجلسات القديمة عند الاستخدام، والجواب واحد سواء وُجد الحساب أم لا. الإرسال بإحدى طريقتين (الأولى لها الأولوية): **(1) Gmail عبر Google Apps Script** (مجاني بلا دومين، ~100 رسالة يومياً): الصق `tools/gmail-relay.gs` في script.google.com وانشره Web app، ثم عيّن `MAIL_SCRIPT_URL` و`MAIL_SCRIPT_SECRET`. **(2) [Brevo](https://www.brevo.com)** (300 رسالة يومياً): أنشئ مفتاح API ووثّق بريد المرسِل، ثم عيّن `BREVO_API_KEY` و`MAIL_FROM`. بدونهما يعيد الخادم 503 في الإنتاج، وفي التطوير يطبع الرابط في السجل.
## ملاحظات

- المبالغ تُسجَّل في محفظة المبدع داخل المنصة فقط، بلا بوابة دفع حقيقية.
- المحادثة تعمل بالاستطلاع الدوري كل 4 ثوانٍ.
- لا يوجد تأكيد للبريد بالإيميل؛ ربط Google بحساب غير مؤكد يُلغي كلمة مرور ذلك الحساب.
