import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { db, get, run, tx } from './db.js';
import { checkPassword, hashPassword } from './security.js';

export const ADMIN = { email: 'admin@awtad.iq', password: 'Admin@12345' };
export const DEMO_PASSWORD = 'Demo@1234';
export const DEMO_DOMAIN = '@demo.iq';
const map = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

/** وضع التجربة: بيانات وحسابات تجريبية. دائماً في التطوير، وفي الإنتاج فقط عند DEMO_MODE=true. */
export const demoEnabled = () => config.env !== 'production' || process.env.DEMO_MODE === 'true';

/** إن عُيّن ADMIN_PASSWORD فهو مرجع كلمة مرور المدير: يُطبَّق عند كل إقلاع إن اختلف عن المخزّنة، وتُبطَل الجلسات القديمة.
    (لتغييرها من لوحة الاستضافة: عدّل المتغير وأعد النشر.) */
export async function syncAdminPassword(pw = process.env.ADMIN_PASSWORD) {
  if (!pw) return false;
  if (pw.length < 8) { console.warn('ADMIN_PASSWORD أقصر من 8 أحرف: تم تجاهله.'); return false; }
  const a = await get("SELECT id, password_hash FROM users WHERE email=? AND role='admin'", ADMIN.email);
  if (!a || checkPassword(pw, a.password_hash)) return false;
  await run('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', hashPassword(pw), a.id);
  console.log('تم تحديث كلمة مرور المدير من ADMIN_PASSWORD.');
  return true;
}

/** يحذف كل الحسابات التجريبية وما يتبعها (للإنتاج عند إيقاف DEMO_MODE، فكلمة مرورها معروفة) */
export async function purgeDemo() {
  const r = await run('DELETE FROM users WHERE email LIKE ?', `%${DEMO_DOMAIN}`);
  if (r.changes) console.log(`حُذفت ${r.changes} حساباً تجريبياً (DEMO_MODE غير مفعّل).`);
  return r.changes;
}

/** بيانات تجريبية غنية: شركات ومبدعون ووظائف ومشاريع وطلبات بمراحل مختلفة ومحادثات ومحفظة. تُنشأ مرة واحدة. */
export async function seedDemo() {
  if (await get('SELECT 1 FROM users WHERE email=?', `sara${DEMO_DOMAIN}`)) return false;
  await tx(async () => {
    const mk = async (role, name, email) => Number((await run('INSERT INTO users(email,password_hash,role,name) VALUES(?,?,?,?)', email, hashPassword(DEMO_PASSWORD), role, name)).lastInsertRowid);

    const company = async (name, email, sector, city, about, address) => {
      const id = await mk('company', name, email);
      await run('INSERT INTO company_profiles(user_id,sector,city,about,address,map_url,contact_email) VALUES(?,?,?,?,?,?,?)', id, sector, city, about, address, map(address), email);
      return id;
    };
    const c1 = await company('مطعم دجلة الذهبي', 'dijla@demo.iq', 'مطاعم وضيافة', 'بغداد', 'مطعم عائلي في الكرادة يقدم المشاويات العراقية، ونعمل على رقمنة خدماتنا بسواعد شابة.', 'الكرادة، شارع 62، قرب ساحة الواثق، بغداد');
    const c2 = await company('نبراس للحلول التقنية', 'nibras@demo.iq', 'تقنية المعلومات', 'أربيل', 'شركة برمجيات ناشئة تبني أنظمة إدارة وتطبيقات ويب للشركات في إقليم كردستان.', 'شارع 100 متر، مجمع ماجدي مول، الطابق 3، أربيل');
    const c3 = await company('الرافدين للاستشارات الهندسية', 'rafidain@demo.iq', 'هندسة وإنشاءات', 'البصرة', 'مكتب استشارات هندسية يشرف على مشاريع سكنية وبنى تحتية في جنوب العراق.', 'العشار، شارع الكورنيش، البصرة');
    const c4 = await company('واحة الرياض للتجارة', 'waha@demo.iq', 'تجارة إلكترونية', 'الرياض', 'متجر إلكتروني سعودي متنامٍ للمنتجات المنزلية، يبحث عن مواهب شابة.', 'حي العليا، طريق الملك فهد، الرياض');
    const c5 = await company('أيام للتسويق الرقمي', 'ayam@demo.iq', 'تسويق وإعلان', 'النجف', 'وكالة تسويق رقمي تدير حملات لعلامات تجارية محلية، وتبحث عن مواهب في المحتوى وتحليل البيانات.', 'شارع الكوفة، قرب جامعة الكوفة، النجف');
    const c6 = await company('استوديو بيان للتصميم', 'bayan@demo.iq', 'تصميم وإبداع', 'السليمانية', 'استوديو تصميم يعمل على الهويات والواجهات لمشاريع ناشئة في إقليم كردستان.', 'شارع سالم، السليمانية');

    const student = async (name, email, spec, status, bio, skills, works, portfolio) => {
      const id = await mk('student', name, email);
      await run('INSERT INTO student_profiles(user_id,spec,status,bio) VALUES(?,?,?,?)', id, spec, status, bio);
      for (const [n, l] of skills) await run('INSERT INTO skills(user_id,name,level) VALUES(?,?,?)', id, n, l);
      for (const [t, u] of portfolio) await run('INSERT INTO portfolio(user_id,title,url) VALUES(?,?,?)', id, t, u);
      for (const [t, r, c, co, a] of works) {
        await run('INSERT INTO works(student_id,title,rating,comment,company_name,amount) VALUES(?,?,?,?,?,?)', id, t, r, c, co, a);
        await run('INSERT INTO wallet_tx(user_id,title,amount) VALUES(?,?,?)', id, t, a);
      }
      return id;
    };
    const s1 = await student('سارة العبيدي', 'sara@demo.iq', 'برمجة', 'خريج جديد', 'خريجة علوم حاسوب من جامعة بغداد، أحب بناء واجهات ويب نظيفة وسريعة، وأتعلم Node.js حالياً.',
      [['React', 'جيد جداً'], ['JavaScript', 'جيد جداً'], ['Tailwind CSS', 'متقدم'], ['Git', 'جيد']],
      [['موقع تعريفي لمكتبة', 5, 'تسليم قبل الموعد وكود مرتب.', 'مكتبة دجلة', 300000], ['لوحة مبيعات بسيطة', 5, 'ممتازة في التواصل وفهم المطلوب.', 'نبراس للحلول التقنية', 450000], ['صفحة هبوط لحملة إعلانية', 4, 'عمل جيد وتعديلات سريعة.', 'متجر الزهور', 200000]],
      [['تطبيق مهام (GitHub)', 'https://github.com'], ['معرض أعمالي', 'https://example.com']]);
    const s2 = await student('علي الحسني', 'ali@demo.iq', 'تصميم', 'طالب', 'طالب تصميم جرافيك في جامعة البصرة، أصمم الشعارات والهويات والمنيوهات.',
      [['Illustrator', 'متقدم'], ['Figma', 'جيد جداً'], ['Photoshop', 'جيد']],
      [['شعار مقهى', 5, 'هوية بصرية جميلة.', 'مقهى الفرات', 100000], ['منيو مطعم شاورما', 4, 'تصميم أنيق ومقروء.', 'شاورما الأصيل', 120000]], [['Behance', 'https://behance.net']]);
    const s3 = await student('مريم القيسي', 'maryam@demo.iq', 'هندسة', 'خريج جديد', 'مهندسة مدنية حديثة التخرج، أتقن AutoCAD وحساب الكميات وأدخل مجال إدارة المشاريع.',
      [['AutoCAD', 'جيد جداً'], ['Revit', 'جيد'], ['Excel', 'جيد جداً']],
      [['مخطط أرضي لمنزل سكني', 5, 'دقة عالية في الرسم.', 'مكتب الأمين', 250000]], [['مشروع التخرج: جسر مشاة', 'https://example.com']]);
    const s4 = await student('حسين الجبوري', 'hussein@demo.iq', 'برمجة', 'طالب', 'طالب برمجيات في الجامعة التكنولوجية، أطور تطبيقات Flutter وأنظمة نقاط بيع صغيرة.',
      [['Flutter', 'جيد جداً'], ['Firebase', 'جيد'], ['SQL', 'جيد']],
      [['نظام كاشير لمحل ملابس', 5, 'النظام يعمل بثبات.', 'محل أناقة', 600000], ['تطبيق حجز مواعيد', 4, 'جيد جداً.', 'عيادة الشفاء', 500000]], [['GitHub', 'https://github.com']]);
    const s5 = await student('نور الهدى كاظم', 'noor@demo.iq', 'تصميم', 'خريج جديد', 'مصممة واجهات وتجربة مستخدم، أحول الأفكار إلى شاشات واضحة وسهلة.',
      [['Figma', 'متقدم'], ['UX Research', 'جيد'], ['Prototyping', 'جيد جداً']],
      [['تصميم تطبيق توصيل', 5, 'واجهات رائعة.', 'نبراس للحلول التقنية', 700000]], [['Dribbble', 'https://dribbble.com']]);
    const s6 = await student('زهراء الموسوي', 'zahraa@demo.iq', 'برمجة', 'خريج جديد', 'خريجة هندسة برمجيات من جامعة النهرين، أبني واجهات برمجية بـ Python وDjango وأحب الأنظمة الصغيرة المنظمة.',
      [['Python', 'جيد جداً'], ['Django', 'جيد'], ['PostgreSQL', 'جيد'], ['Git', 'جيد']],
      [['API لإدارة مخزون', 5, 'توثيق واضح واختبارات جيدة.', 'متجر النخيل', 550000]], [['مشروع التخرج: نظام حجوزات', 'https://github.com']]);
    const s7 = await student('عمر الشمري', 'omar@demo.iq', 'هندسة', 'طالب', 'طالب هندسة مدنية في جامعة الموصل، أجيد الرسم الإنشائي وحساب الكميات وأتعلم ETABS.',
      [['AutoCAD', 'جيد جداً'], ['Excel', 'جيد جداً'], ['ETABS', 'مبتدئ']],
      [['جدول كميات لمبنى تجاري', 4, 'دقيق ومرتب.', 'مكتب الأفق الهندسي', 280000]], [['لوحات مادة الإنشاءات', 'https://example.com']]);
    const s8 = await student('ليلى الكعبي', 'layla@demo.iq', 'تصميم', 'طالب', 'طالبة تصميم في كلية الفنون الجميلة، أعمل على الموشن غرافيك والهوية البصرية.',
      [['After Effects', 'جيد جداً'], ['Illustrator', 'جيد جداً'], ['Figma', 'جيد']],
      [['فيديو موشن لإعلان مطعم', 5, 'إبداع وسرعة في التسليم.', 'مطعم دجلة الذهبي', 180000], ['هوية بصرية لمخبز', 4, 'ألوان جميلة.', 'مخبز الصباح', 140000]], [['Behance', 'https://behance.net']]);
    const s9 = await student('كرار الساعدي', 'karar@demo.iq', 'برمجة', 'طالب', 'طالب علوم حاسوب مهتم بتحليل البيانات؛ أستخدم SQL وPower BI وPython لبناء لوحات معلومات.',
      [['SQL', 'جيد جداً'], ['Power BI', 'جيد'], ['Python', 'جيد'], ['Excel', 'جيد جداً']],
      [['لوحة مؤشرات مبيعات', 5, 'لوحة واضحة وسهلة القراءة.', 'واحة الرياض للتجارة', 320000]], [['لوحات Power BI', 'https://example.com']]);
    const s10 = await student('رشا العاني', 'rasha@demo.iq', 'برمجة', 'خريج جديد', 'خريجة نظم معلومات، أعمل في اختبار البرمجيات اليدوي وكتابة حالات الاختبار وأتعلم الأتمتة.',
      [['اختبار يدوي', 'جيد جداً'], ['Jira', 'جيد'], ['Selenium', 'مبتدئ']],
      [['اختبار تطبيق توصيل', 4, 'تقارير أخطاء دقيقة.', 'نبراس للحلول التقنية', 260000]], [['نماذج حالات اختبار', 'https://example.com']]);

    const job = async (c, title, spec, pay, cur, hours, schedule, shift, type, reqs, d) =>
      Number((await run('INSERT INTO postings(company_id,kind,title,description,spec,pay,cur,hours,schedule,shift,type,reqs) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', c, 'job', title, d, spec, pay, cur, hours, schedule, shift, type, JSON.stringify(reqs))).lastInsertRowid);
    const proj = async (c, title, spec, pay, cur, days, reqs, d) =>
      Number((await run('INSERT INTO postings(company_id,kind,title,description,spec,pay,cur,days,reqs) VALUES(?,?,?,?,?,?,?,?,?)', c, 'project', title, d, spec, pay, cur, days, JSON.stringify(reqs))).lastInsertRowid);

    const j1 = await job(c2, 'مطوّر واجهات React', 'برمجة', 1200000, 'د.ع', 6, 'السبت – الخميس، 9 ص إلى 3 م', 'صباحي', 'دوام جزئي', ['React', 'JavaScript', 'Tailwind CSS', 'Git'], 'ستنضم إلى فريق المنتج لبناء واجهات لوحات التحكم، مع إرشاد من مطوّر أول.');
    const j2 = await job(c3, 'مهندس موقع مساعد', 'هندسة', 1100000, 'د.ع', 8, 'السبت – الخميس، 8 ص إلى 4 م', 'صباحي', 'دوام كامل', ['AutoCAD', 'قراءة المخططات', 'Excel'], 'متابعة التنفيذ في مواقع سكنية بالبصرة وإعداد تقارير يومية.');
    await job(c1, 'مصمم محتوى سوشال ميديا', 'تصميم', 800000, 'د.ع', 5, 'الأحد – الخميس، 4 م إلى 9 م', 'مسائي', 'دوام جزئي', ['Photoshop', 'Illustrator', 'Canva'], 'تصميم منشورات وقصص يومية لحسابات المطعم، وتصوير بسيط للأطباق.');
    await job(c4, 'مطوّر تطبيقات Flutter', 'برمجة', 4500, 'ر.س', 8, 'الأحد – الخميس، 10 ص إلى 6 م', 'صباحي', 'دوام كامل', ['Flutter', 'Firebase', 'REST APIs'], 'تطوير تطبيق المتجر على أندرويد وآيفون ضمن فريق صغير.');
    await job(c2, 'مختبر جودة برمجيات (QA)', 'برمجة', 900000, 'د.ع', 5, 'الأحد – الخميس، 3 م إلى 8 م', 'مسائي', 'دوام جزئي', ['اختبار يدوي', 'كتابة حالات اختبار', 'Jira'], 'اختبار الإصدارات الجديدة وتوثيق الأخطاء مع المطورين.');
    const j6 = await job(c2, 'مطوّر Backend (Node.js)', 'برمجة', 1400000, 'د.ع', 6, 'الأحد – الخميس، 10 ص إلى 4 م', 'صباحي', 'دوام جزئي', ['Node.js', 'SQL', 'REST APIs'], 'بناء واجهات برمجية لمنتجات الشركة مع مراجعة كود أسبوعية.');
    const j7 = await job(c5, 'محلل بيانات مبتدئ', 'برمجة', 950000, 'د.ع', 5, 'السبت – الأربعاء، 2 م إلى 7 م', 'مسائي', 'دوام جزئي', ['SQL', 'Excel', 'Power BI'], 'إعداد تقارير أداء الحملات الأسبوعية وبناء لوحات معلومات بسيطة.');
    const j8 = await job(c6, 'مصمم واجهات UI/UX', 'تصميم', 1000000, 'د.ع', 6, 'الأحد – الخميس، 11 ص إلى 5 م', 'صباحي', 'دوام جزئي', ['Figma', 'Prototyping', 'UX Research'], 'تصميم شاشات لتطبيقات الجوال مع فريق المنتج.');
    const j9 = await job(c3, 'مهندس كهرباء مساعد', 'هندسة', 1050000, 'د.ع', 8, 'السبت – الخميس، 8 ص إلى 4 م', 'صباحي', 'دوام كامل', ['AutoCAD', 'قراءة المخططات الكهربائية'], 'متابعة أعمال التمديدات الكهربائية في مشاريع سكنية بالبصرة.');
    await job(c4, 'مصمم عروض وصور منتجات', 'تصميم', 3200, 'ر.س', 6, 'الأحد – الخميس، 12 ظ إلى 6 م', 'صباحي', 'دوام جزئي', ['Photoshop', 'Canva'], 'تجهيز صور وعروض المنتجات للمتجر ومنصات التواصل.');

    const p1 = await proj(c1, 'تصميم منيو رقمي للمطعم', 'تصميم', 150000, 'د.ع', 5, ['Illustrator', 'Figma'], 'منيو من 4 صفحات يُطبع ويُعرض كـ PDF، بألوان تناسب هوية المطعم.');
    await proj(c2, 'شعار لمتجر ناشئ', 'تصميم', 100000, 'د.ع', 4, ['Illustrator'], 'ثلاثة مقترحات أولية وتعديلان مجانيان، مع تسليم الملفات المفتوحة.');
    await proj(c4, 'موقع تعريفي بسيط', 'برمجة', 400, 'ر.س', 7, ['HTML/CSS', 'JavaScript'], 'موقع من 3 صفحات متجاوب مع الجوال ونموذج تواصل.');
    await proj(c1, 'نظام كاشير بسيط للمطعم', 'برمجة', 600000, 'د.ع', 14, ['SQL', 'واجهة ويب أو Flutter'], 'تسجيل الطلبات وطباعة الفواتير وتقرير مبيعات يومي.');
    const p5 = await proj(c6, 'هوية بصرية كاملة لمقهى', 'تصميم', 350000, 'د.ع', 10, ['Illustrator', 'Figma'], 'شعار وألوان وخطوط وقائمة مطبوعة مع دليل استخدام مبسّط.');
    const p6 = await proj(c2, 'لوحة تحكم مبيعات (Dashboard)', 'برمجة', 700000, 'د.ع', 12, ['React', 'Tailwind CSS'], 'لوحة تعرض المبيعات اليومية والشهرية مع رسوم بيانية وتصدير.');
    const p7 = await proj(c3, 'مخطط وكميات لفيلا سكنية', 'هندسة', 500000, 'د.ع', 8, ['AutoCAD', 'Excel'], 'مخططات أرضية وجدول كميات أولي لفيلا من طابقين.');
    const p8 = await proj(c5, 'حملة محتوى إنستغرام لأسبوع', 'تصميم', 300000, 'د.ع', 7, ['Canva', 'Photoshop'], 'سبعة منشورات وقصص لعلامة تجارية ناشئة مع كتابة النصوص.');

    const app = async (post, st, msg, projects, status, stage) =>
      Number((await run('INSERT INTO applications(posting_id,student_id,message,projects,status,stage) VALUES(?,?,?,?,?,?)', post, st, msg, JSON.stringify(projects), status, stage)).lastInsertRowid);
    const say = (a, from, t) => run('INSERT INTO messages(application_id,sender_id,text) VALUES(?,?,?)', a, from, t);

    // طلبات قيد المراجعة
    await app(j1, s1, 'أحب العمل مع React وأرفقت أقرب مشروعين لهذا الدور.', ['لوحة مبيعات بسيطة', 'تطبيق مهام (GitHub)'], 'pending', null);
    await app(j1, s4, 'متحمس للتعلم والتطور ضمن فريقكم.', ['تطبيق حجز مواعيد'], 'pending', null);
    await app(j2, s3, 'أرفقت مخطط منزل أنجزته مؤخراً.', ['مخطط أرضي لمنزل سكني'], 'pending', null);
    await app(j6, s6, 'أعمل بـ Python وDjango حالياً، وأتعلم Node.js وأرغب بتطبيق خبرتي في تصميم الـ API.', ['API لإدارة مخزون'], 'pending', null);
    await app(j7, s9, 'عملت على لوحة مؤشرات مبيعات وأحب التقارير الواضحة.', ['لوحة مؤشرات مبيعات'], 'pending', null);
    await app(j7, s10, 'أجيد تتبع الأخطاء والتوثيق وأرغب بالانتقال لتحليل البيانات.', ['اختبار تطبيق توصيل'], 'pending', null);
    await app(j8, s8, 'أصمم بالموشن والهوية وأتعلم تصميم الواجهات.', ['فيديو موشن لإعلان مطعم', 'هوية بصرية لمخبز'], 'pending', null);
    await app(j8, s2, 'لدي خبرة بالتصميم الجرافيكي وأريد توسيعها لتصميم التطبيقات.', ['شعار مقهى', 'منيو مطعم شاورما'], 'pending', null);
    await app(j9, s7, 'أرغب بالتدرّب في الموقع وأجيد قراءة المخططات.', ['جدول كميات لمبنى تجاري'], 'pending', null);
    await app(p6, s4, 'خبرتي بالواجهات بسيطة لكني أتعلم بسرعة.', ['تطبيق حجز مواعيد'], 'pending', null);
    await app(p8, s5, 'أستطيع تجهيز التصاميم والنصوص خلال الأسبوع.', ['تصميم تطبيق توصيل'], 'pending', null);
    await app(p8, s2, 'عندي خبرة بتصميم المنشورات وأسلّم بسرعة.', ['شعار مقهى'], 'pending', null);
    // مرفوض
    await app(j1, s7, 'أود التقديم رغم اختلاف تخصصي.', [], 'rejected', null);

    // مقبول: قيد التنفيذ مع محادثة
    const a4 = await app(p1, s2, 'عندي خبرة بتصميم المنيوهات وأستطيع التسليم خلال 4 أيام.', ['منيو مطعم شاورما', 'شعار مقهى'], 'accepted', 'progress');
    await say(a4, null, 'تم قبول الطلب. يمكنكما بدء المحادثة الآن.');
    await say(a4, c1, 'أهلاً علي، الألوان المفضلة عندنا الذهبي والأسود.');
    await say(a4, s2, 'ممتاز، سأرسل لك مسودة أولى غداً.');
    const a5 = await app(p6, s1, 'بنيت لوحة مبيعات مشابهة، وأستطيع البدء فوراً.', ['لوحة مبيعات بسيطة'], 'accepted', 'progress');
    await say(a5, null, 'تم قبول الطلب. يمكنكما بدء المحادثة الآن.');
    await say(a5, c2, 'مرحباً سارة، نحتاج رسمين بيانيين: يومي وشهري، مع زر تصدير.');
    await say(a5, s1, 'تمام، سأبدأ بالهيكل وأرسل لكم رابط معاينة بعد يومين.');

    // مسلَّم بانتظار الاعتماد
    const a6 = await app(p5, s8, 'أعمل على الهوية البصرية وأعرض عليكم ثلاثة اتجاهات.', ['هوية بصرية لمخبز', 'فيديو موشن لإعلان مطعم'], 'accepted', 'delivered');
    await say(a6, null, 'تم قبول الطلب. يمكنكما بدء المحادثة الآن.');
    await say(a6, c6, 'جميل، نفضّل الاتجاه الثاني بألوان أدفأ.');
    await say(a6, null, 'سلّم المبدع العمل وبانتظار اعتماد الشركة.');

    // معتمد ومدفوع (يظهر في الأعمال والمحفظة)
    const a7 = await app(p7, s3, 'أرفقت مخططاً مشابهاً أنجزته مسبقاً.', ['مخطط أرضي لمنزل سكني'], 'accepted', 'paid');
    await say(a7, null, 'تم قبول الطلب. يمكنكما بدء المحادثة الآن.');
    await say(a7, null, 'اعتُمد التسليم وحُوّل المبلغ إلى محفظة المبدع.');
    await run('INSERT INTO works(student_id,title,rating,comment,company_name,amount) VALUES(?,?,?,?,?,?)', s3, 'مخطط وكميات لفيلا سكنية', 5, 'تسليم متقن وجدول كميات دقيق.', 'الرافدين للاستشارات الهندسية', 500000);
    await run('INSERT INTO wallet_tx(user_id,title,amount) VALUES(?,?,?)', s3, 'مخطط وكميات لفيلا سكنية', 500000);

    // دعوة مفتوحة من شركة لمبدع
    await run('INSERT INTO invites(posting_id,student_id) VALUES(?,?)', j6, s1);
  });
  console.log('تمت تهيئة البيانات التجريبية (شركات ومبدعون ووظائف ومشاريع).');
  return true;
}

export async function seedIfEmpty() {
  if ((await get('SELECT COUNT(*) c FROM users')).c === 0) {
    if (config.env === 'production') {
      // الإنتاج: حساب مدير بكلمة مرور من ADMIN_PASSWORD أو عشوائية تُطبع مرة واحدة
      const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
      await run('INSERT INTO users(email,password_hash,role,name) VALUES(?,?,?,?)', ADMIN.email, hashPassword(pw), 'admin', 'مدير المنصة');
      if (!process.env.ADMIN_PASSWORD) console.log(`كلمة مرور المدير (${ADMIN.email}): ${pw}`);
    } else {
      await run('INSERT INTO users(email,password_hash,role,name) VALUES(?,?,?,?)', ADMIN.email, hashPassword(ADMIN.password), 'admin', 'مدير المنصة');
    }
  }
  if (demoEnabled()) await seedDemo();
  else if (config.env === 'production') await purgeDemo();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--reset')) {
    await db.exec('TRUNCATE users, student_profiles, company_profiles, skills, portfolio, postings, applications, messages, works, wallet_tx, invites RESTART IDENTITY CASCADE;');
  }
  await seedIfEmpty();
  await db.close();
}
