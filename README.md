# مهارة

منصة توظيف ومشاريع تعاونية للطلاب والخريجين والشركات، بلا شرط سنوات الخبرة.

```
apps/api   خادم Node.js + Express يرجّع JSON فقط، قاعدة SQLite (node:sqlite)
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
| مدير | admin@mahara.iq | Admin@12345 |
| شركة | nibras@demo.iq / dijla@demo.iq | Demo@1234 |
| مبدع | sara@demo.iq / ali@demo.iq | Demo@1234 |

في الإنتاج (`NODE_ENV=production`) تُنشأ قاعدة فارغة فيها حساب المدير فقط، بكلمة من `ADMIN_PASSWORD` أو عشوائية تُطبع مرة واحدة في السجل.

## الإعداد (`apps/api/.env`)

انظر [apps/api/.env.example](apps/api/.env.example). أهمها: `JWT_SECRET` (مطلوب في الإنتاج)، `CORS_ORIGINS` (عنوان الواجهة عند فصلها)، `GOOGLE_CLIENT_ID`، `TRUST_PROXY`.

## واجهة الـ API

كل الردود JSON، بما فيها الأخطاء (`{"error": "..."}`) والمسارات غير المعروفة. المصادقة بترويسة `Authorization: Bearer <token>`. فحص الصحة: `GET /api/health`.

## النشر على AWS

الواجهة على S3 خلف CloudFront (الدلو خاص، والوصول عبر OAC، ومسارات React Router تُوجَّه إلى index.html):

```powershell
.\infra\deploy-web.ps1 -StackName mahara-web -BucketName <اسم-فريد> -ApiUrl https://api.example.com -Region eu-central-1
```

الخادم (Node + SQLite) يحتاج مكاناً دائماً بقرص ثابت، مثل EC2 مع `systemctl`/pm2، ولا يصلح لـ Lambda أو Beanstalk بقرص مؤقت. اضبط عليه `NODE_ENV=production` و`JWT_SECRET` و`CORS_ORIGINS=<عنوان CloudFront>` و`TRUST_PROXY=true` خلف HTTPS.

## ترجمة المحتوى

عند تغيير لغة الواجهة تتغير كل النصوص الثابتة، ويُترجَم أيضاً **محتوى المستخدمين** (عناوين الوظائف والأوصاف والنبذات...) تلقائياً عبر `POST /api/translate`، وتُخزَّن كل ترجمة في قاعدة البيانات فلا تُحسب مرتين. رسائل الدردشة خاصة فلا تُترجم تلقائياً، وبجانب كل رسالة زر «ترجمة». المزوّد الافتراضي نقطة Google المجانية غير الرسمية (مع MyMemory احتياطاً)؛ للتعطيل `TRANSLATE_PROVIDER=none`، وللإنتاج الجاد استخدم مزوّداً رسمياً بمفتاح عبر `setProvider`.

## ملاحظات

- المبالغ تُسجَّل في محفظة المبدع داخل المنصة فقط، بلا بوابة دفع حقيقية.
- المحادثة تعمل بالاستطلاع الدوري كل 4 ثوانٍ.
- لا يوجد تأكيد للبريد بالإيميل؛ ربط Google بحساب غير مؤكد يُلغي كلمة مرور ذلك الحساب.
