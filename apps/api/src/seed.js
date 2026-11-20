import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { db, get, run, tx } from './db.js';
import { hashPassword } from './security.js';

export const ADMIN = { email: 'admin@awtad.iq', password: 'Admin@12345' };
export const DEMO_PASSWORD = 'Demo@1234';
const map = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

export async function seedIfEmpty() {
  if ((await get('SELECT COUNT(*) c FROM users')).c > 0) return;
  if (process.env.NODE_ENV === 'production') {
    // في الإنتاج: حساب مدير فقط بكلمة مرور من ADMIN_PASSWORD أو عشوائية تُطبع مرة واحدة، بلا بيانات تجريبية
    const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
    await run('INSERT INTO users(email,password_hash,role,name) VALUES(?,?,?,?)', ADMIN.email, hashPassword(pw), 'admin', 'مدير المنصة');
    if (!process.env.ADMIN_PASSWORD) console.log(`كلمة مرور المدير (${ADMIN.email}): ${pw}`);
    return;
  }
  await tx(async () => {
    const mk = async (role, name, email, pw) => Number((await run('INSERT INTO users(email,password_hash,role,name) VALUES(?,?,?,?)', email, hashPassword(pw), role, name)).lastInsertRowid);
    await mk('admin', 'مدير المنصة', ADMIN.email, ADMIN.password);

    const company = async (name, email, sector, city, about, address) => {
      const id = await mk('company', name, email, DEMO_PASSWORD);
      await run('INSERT INTO company_profiles(user_id,sector,city,about,address,map_url,contact_email) VALUES(?,?,?,?,?,?,?)', id, sector, city, about, address, map(address), email);
      return id;
    };
    const c1 = await company('مطعم دجلة الذهبي', 'dijla@demo.iq', 'مطاعم وضيافة', 'بغداد', 'مطعم عائلي في الكرادة يقدم المشاويات العراقية، ونعمل على رقمنة خدماتنا بسواعد شابة.', 'الكرادة، شارع 62، قرب ساحة الواثق، بغداد');
    const c2 = await company('نبراس للحلول التقنية', 'nibras@demo.iq', 'تقنية المعلومات', 'أربيل', 'شركة برمجيات ناشئة تبني أنظمة إدارة وتطبيقات ويب للشركات في إقليم كردستان.', 'شارع 100 متر، مجمع ماجدي مول، الطابق 3، أربيل');
    const c3 = await company('الرافدين للاستشارات الهندسية', 'rafidain@demo.iq', 'هندسة وإنشاءات', 'البصرة', 'مكتب استشارات هندسية يشرف على مشاريع سكنية وبنى تحتية في جنوب العراق.', 'العشار، شارع الكورنيش، البصرة');
    const c4 = await company('واحة الرياض للتجارة', 'waha@demo.iq', 'تجارة إلكترونية', 'الرياض', 'متجر إلكتروني سعودي متنامٍ للمنتجات المنزلية، يبحث عن مواهب شابة.', 'حي العليا، طريق الملك فهد، الرياض');

    const student = async (name, email, spec, status, bio, skills, works, portfolio) => {
      const id = await mk('student', name, email, DEMO_PASSWORD);
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
    await student('نور الهدى كاظم', 'noor@demo.iq', 'تصميم', 'خريج جديد', 'مصممة واجهات وتجربة مستخدم، أحول الأفكار إلى شاشات واضحة وسهلة.',
      [['Figma', 'متقدم'], ['UX Research', 'جيد'], ['Prototyping', 'جيد جداً']],
      [['تصميم تطبيق توصيل', 5, 'واجهات رائعة.', 'نبراس للحلول التقنية', 700000]], [['Dribbble', 'https://dribbble.com']]);

    const job = async (c, title, spec, pay, cur, hours, schedule, shift, type, reqs, d) =>
      Number((await run(`INSERT INTO postings(company_id,kind,title,description,spec,pay,cur,hours,schedule,shift,type,reqs) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, c, 'job', title, d, spec, pay, cur, hours, schedule, shift, type, JSON.stringify(reqs))).lastInsertRowid);
    const proj = async (c, title, spec, pay, cur, days, reqs, d) =>
      Number((await run(`INSERT INTO postings(company_id,kind,title,description,spec,pay,cur,days,reqs) VALUES(?,?,?,?,?,?,?,?,?)`, c, 'project', title, d, spec, pay, cur, days, JSON.stringify(reqs))).lastInsertRowid);
    const j1 = await job(c2, 'مطوّر واجهات React', 'برمجة', 1200000, 'د.ع', 6, 'السبت – الخميس، 9 ص إلى 3 م', 'صباحي', 'دوام جزئي', ['React', 'JavaScript', 'Tailwind CSS', 'Git'], 'ستنضم إلى فريق المنتج لبناء واجهات لوحات التحكم، مع إرشاد من مطوّر أول.');
    const j2 = await job(c3, 'مهندس موقع مساعد', 'هندسة', 1100000, 'د.ع', 8, 'السبت – الخميس، 8 ص إلى 4 م', 'صباحي', 'دوام كامل', ['AutoCAD', 'قراءة المخططات', 'Excel'], 'متابعة التنفيذ في مواقع سكنية بالبصرة وإعداد تقارير يومية.');
    await job(c1, 'مصمم محتوى سوشال ميديا', 'تصميم', 800000, 'د.ع', 5, 'الأحد – الخميس، 4 م إلى 9 م', 'مسائي', 'دوام جزئي', ['Photoshop', 'Illustrator', 'Canva'], 'تصميم منشورات وقصص يومية لحسابات المطعم، وتصوير بسيط للأطباق.');
    await job(c4, 'مطوّر تطبيقات Flutter', 'برمجة', 4500, 'ر.س', 8, 'الأحد – الخميس، 10 ص إلى 6 م', 'صباحي', 'دوام كامل', ['Flutter', 'Firebase', 'REST APIs'], 'تطوير تطبيق المتجر على أندرويد وآيفون ضمن فريق صغير.');
    await job(c2, 'مختبر جودة برمجيات (QA)', 'برمجة', 900000, 'د.ع', 5, 'الأحد – الخميس، 3 م إلى 8 م', 'مسائي', 'دوام جزئي', ['اختبار يدوي', 'كتابة حالات اختبار', 'Jira'], 'اختبار الإصدارات الجديدة وتوثيق الأخطاء مع المطورين.');
    const p1 = await proj(c1, 'تصميم منيو رقمي للمطعم', 'تصميم', 150000, 'د.ع', 5, ['Illustrator', 'Figma'], 'منيو من 4 صفحات يُطبع ويُعرض كـ PDF، بألوان تناسب هوية المطعم.');
    await proj(c2, 'شعار لمتجر ناشئ', 'تصميم', 100000, 'د.ع', 4, ['Illustrator'], 'ثلاثة مقترحات أولية وتعديلان مجانيان، مع تسليم الملفات المفتوحة.');
    await proj(c4, 'موقع تعريفي بسيط', 'برمجة', 400, 'ر.س', 7, ['HTML/CSS', 'JavaScript'], 'موقع من 3 صفحات متجاوب مع الجوال ونموذج تواصل.');
    await proj(c1, 'نظام كاشير بسيط للمطعم', 'برمجة', 600000, 'د.ع', 14, ['SQL', 'واجهة ويب أو Flutter'], 'تسجيل الطلبات وطباعة الفواتير وتقرير مبيعات يومي.');

    const app = async (post, st, msg, projects, status, stage) =>
      Number((await run('INSERT INTO applications(posting_id,student_id,message,projects,status,stage) VALUES(?,?,?,?,?,?)', post, st, msg, JSON.stringify(projects), status, stage)).lastInsertRowid);
    await app(j1, s1, 'أحب العمل مع React وأرفقت أقرب مشروعين لهذا الدور.', ['لوحة مبيعات بسيطة', 'تطبيق مهام (GitHub)'], 'pending', null);
    await app(j1, s4, 'متحمس للتعلم والتطور ضمن فريقكم.', ['تطبيق حجز مواعيد'], 'pending', null);
    await app(j2, s3, 'أرفقت مخطط منزل أنجزته مؤخراً.', ['مخطط أرضي لمنزل سكني'], 'pending', null);
    const a4 = await app(p1, s2, 'عندي خبرة بتصميم المنيوهات وأستطيع التسليم خلال 4 أيام.', ['منيو مطعم شاورما', 'شعار مقهى'], 'accepted', 'progress');
    const msg = async (a, from, t) => await run('INSERT INTO messages(application_id,sender_id,text) VALUES(?,?,?)', a, from, t);
    await msg(a4, null, 'تم قبول الطلب. يمكنكما بدء المحادثة الآن.');
    await msg(a4, c1, 'أهلاً علي، الألوان المفضلة عندنا الذهبي والأسود.');
    await msg(a4, s2, 'ممتاز، سأرسل لك مسودة أولى غداً.');
  });
  console.log('تمت تهيئة قاعدة البيانات بحسابات تجريبية');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--reset')) {
    await db.exec('TRUNCATE users, student_profiles, company_profiles, skills, portfolio, postings, applications, messages, works, wallet_tx, invites RESTART IDENTITY CASCADE;');
  }
  await seedIfEmpty();
  await db.close();
}
