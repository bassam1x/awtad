# نشر أوتاد على Amazon Web Services (Lightsail)

خادم واحد (VPS) عليه المنصة وقاعدة بيانات PostgreSQL وشهادة https تلقائية ونسخة احتياطية يومية.

**الكلفة** (حسب صفحة أسعار Lightsail، تأكد منها): خادم Linux بعنوان IPv4 بسعر 7$ شهرياً (1GB) أو 12$ (2GB، المستحسن).
يُعلن Amazon عن ثلاثة أشهر مجانية على هذه الباقات للحسابات المؤهلة.

## 1. الحساب (تسويه بنفسك)

1. أنشئ حساباً على <https://aws.amazon.com> بمعلوماتك وبطاقتك. اختر بلدك الحقيقي.
2. فعّل التحقق بخطوتين (MFA) للحساب.
3. من **Billing → Budgets** أنشئ تنبيهاً شهرياً بالمبلغ الذي ترتضيه.

## 2. الخادم

من <https://lightsail.aws.amazon.com> اضغط **Create instance**:

- المنطقة: **Frankfurt** (الأقرب للعراق من مناطق Lightsail في أوروبا).
- النظام: **Linux/Unix → OS Only → Ubuntu 24.04 LTS**.
- **Add launch script** والصق هذا السطر:

```bash
curl -fsSL https://raw.githubusercontent.com/bassam1x/awtad/main/deploy/aws/setup.sh -o /root/awtad-setup.sh && bash /root/awtad-setup.sh > /var/log/awtad-setup.log 2>&1
```

- الباقة: 12$ (2GB) أو 7$ (1GB). الاسم: `awtad`.

بعد إنشائه:

1. **Networking → Create static IP** واربطه بالخادم (حتى لا يتغير العنوان).
2. **Networking → IPv4 Firewall → Add rule → HTTPS** (المنفذ 443). المنفذان 22 و80 مفتوحان أصلاً.
3. انتظر 5 إلى 10 دقائق ثم افتح `http://<العنوان الثابت>`.

متابعة التثبيت: من زر **Connect** (الطرفية داخل المتصفح): `sudo tail -f /var/log/awtad-setup.log`

## 3. حساب مدير المنصة

```bash
sudo awtad password
```

البريد `admin@awtad.iq` وكلمة المرور تُولَّد عشوائياً على خادمك فقط. لتغييرها: `sudo awtad config ADMIN_PASSWORD`.

## 4. نقل البيانات من الموقع القديم

من Render ← الخدمة ← **Environment** انسخ قيمة `DATABASE_URL`، ثم على الخادم:

```bash
sudo awtad import-db
```

الصق الرابط حين يُطلب (لا يظهر على الشاشة). ينقل الحسابات والمنشورات والمحادثات كما هي.

## 5. الإعدادات السرية

انسخ من Render ما كان مضبوطاً، واحداً واحداً:

```bash
sudo awtad config LINKEDIN_CLIENT_ID
sudo awtad config LINKEDIN_CLIENT_SECRET
```

وانسخ `JWT_SECRET` أيضاً (`sudo awtad config JWT_SECRET`) إن أردت أن يبقى المستخدمون مسجّلين بعد النقل على الدومين نفسه.

## 6. الدومين

1. اشترِ دومين من أي مسجّل.
2. أضف سجل **A** للدومين (و`www` إن أردت) يشير إلى العنوان الثابت.
3. على الخادم: `sudo awtad domain example.com`
4. في Firebase ← Authentication ← Settings ← **Authorized domains** أضف الدومين (لزر Google).
5. في تطبيق LinkedIn أضف `https://example.com/auth/linkedin/callback`.

بدون دومين يعمل الموقع على http للتجربة فقط: لا تنشره للناس بهذه الحالة.

## الحماية من هجمات DDoS (Cloudflare المجانية)

1. أنشئ حساباً على <https://dash.cloudflare.com>، وأضف الدومين واختر الخطة **Free**.
2. تأكد من السجلين: **A** للدومين إلى العنوان الثابت، و**CNAME** لـ`www` إلى الدومين، وكلاهما **Proxied** (الغيمة برتقالية).
3. **SSL/TLS → Overview**: اختر **Full (strict)**. اترك **Always Use HTTPS** مطفأ (الخادم يحوّل إلى https بنفسه، وهذا يبقي تجديد الشهادة يعمل).
4. عند مسجّل الدومين غيّر الـ **Nameservers** إلى الاثنين اللذين يعطيهما Cloudflare، وانتظر حتى يصير الدومين **Active**.
5. على الخادم: `sudo awtad web` ثم `sudo awtad cloudflare on` (يرفض القفل إن لم يكن الموقع يمر عبر Cloudflare).

للتراجع: `sudo awtad cloudflare off`. أثناء هجوم فعّل **Under Attack Mode** من صفحة الدومين في Cloudflare.
إن انقطع الموقع بعد القفل بزمن طويل فقد تكون Cloudflare أضافت عناوين جديدة: قارن `CLOUDFLARE_IPS` في `awtad.sh` مع صفحة العناوين المنشورة.

## 7. إيقاف Render (آخر خطوة)

بعد أن تتأكد أن الموقع الجديد يعمل وبياناتك فيه:

1. في Render ← الخدمة ← **Settings → Suspend service** (يمكن التراجع). احذفها لاحقاً بعد أسبوع مثلاً.
2. أبقِ قاعدة Neon أسبوعاً كنسخة أمان قبل حذفها.

## الأوامر اليومية

| الأمر | الوظيفة |
|---|---|
| `sudo awtad status` | هل كل شيء يعمل |
| `sudo awtad update` | تنزيل آخر نسخة من GitHub (يأخذ نسخة احتياطية أولاً ويتراجع عند الفشل) |
| `sudo awtad logs` | سجل التطبيق |
| `sudo awtad backup` | نسخة احتياطية الآن (آخر 14 في `/var/backups/awtad`) |
| `sudo awtad restore <ملف>` | استعادة نسخة |
| `sudo awtad web` | إعادة كتابة إعداد خادم الويب |
| `sudo awtad cloudflare on` / `off` | قبول الزوار عبر Cloudflare فقط، أو من الجميع |

النشر لم يعد تلقائياً كما في Render: بعد أي تعديل على GitHub شغّل `sudo awtad update`.

النسخ الاحتياطية محفوظة على الخادم نفسه. فعّل **Automatic snapshots** من صفحة الخادم في Lightsail لتبقى نسخة خارجه (بكلفة تخزين صغيرة).
