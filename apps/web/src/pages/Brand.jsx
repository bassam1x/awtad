import { isRtl, t } from '../i18n/index.js';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Logo, LogoMark } from '../ui.jsx';
import { LangSwitch, ThemeButton } from '../Layout.jsx';

const palette = [
  [t('أزرق أوتاد'), '#2563EB', t('الأزرار الرئيسية والروابط والعناصر النشطة')],
  [t('أخضر الإنجاز'), '#10B981', t('الرواتب والأرباح والمحفظة وحالات النجاح')],
  [t('كحلي'), '#0F172A', t('النصوص والعناوين')],
  [t('فيروزي'), '#0EA5A4', t('التدرج في الشعار والرسوم')],
  [t('رمادي مزرق'), '#64748B', t('النصوص الثانوية')],
  [t('خلفية'), '#F8FAFC', t('خلفية التطبيق في النهاري')],
];
const dark = [[t('خلفية ليلية'), '#0B1220'], [t('بطاقة ليلية'), '#111A2E'], [t('أزرق ليلي'), '#60A5FA'], [t('أخضر ليلي'), '#34D399']];

export default function Brand() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <Link to="/" className="btn"><ArrowRight size={16} className="ltr:rotate-180" />{t('رجوع')}</Link>
        <div className="flex gap-2"><ThemeButton /><LangSwitch /></div>
      </div>
      <h1 className="text-3xl font-bold">{t('الهوية البصرية لأوتاد')}</h1>
      <p className="mt-2 max-w-2xl text-mute">{t('معنى الاسم: «أوتاد» جمع وتد، وهو الثابت الذي يُبنى عليه كل شيء. هكذا تكون المهارة أساس مستقبلك المهني.')}</p>
      <p className="mt-2 max-w-2xl text-mute">{t('فكرة الشعار: ثلاثة أعمدة متصاعدة تمثل نمو المهارة خطوة بعد خطوة، ونقطة خضراء فوق العمود الأعلى تمثل الإنجاز المعتمد، وتشبه نقطة الحرف العربي.')}</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card flex h-44 items-center justify-center"><Logo size={56} /></div>
        <div className="card flex h-44 items-center justify-center !bg-[#0b1220] !bg-none"><span className="text-white [&_.text-mute]:!text-white/60"><Logo size={56} /></span></div>
        <div className="card flex h-44 items-center justify-center gap-4"><LogoMark size={28} /><LogoMark size={44} /><LogoMark size={64} /></div>
      </section>

      <h2 className="mb-3 mt-10 text-xl font-bold">{t('الألوان')}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {palette.map(([n, h, d]) => (
          <div key={h} className="card overflow-hidden">
            <div className="h-20" style={{ background: h }} />
            <div className="p-3"><div className="font-bold">{n}</div><div className="text-sm text-mute" dir="ltr" style={{ textAlign: isRtl ? 'right' : 'left' }}>{h}</div><div className="mt-1 text-sm text-mute">{d}</div></div>
          </div>
        ))}
      </div>
      <h3 className="mb-3 mt-6 font-bold">{t('الوضع الليلي')}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {dark.map(([n, h]) => <div key={h} className="card overflow-hidden"><div className="h-14" style={{ background: h }} /><div className="p-3 text-sm"><b>{n}</b><div className="text-mute" dir="ltr" style={{ textAlign: isRtl ? 'right' : 'left' }}>{h}</div></div></div>)}
      </div>

      <h2 className="mb-3 mt-10 text-xl font-bold">{t('الخط')}</h2>
      <div className="card p-6">
        <div className="text-4xl font-bold">IBM Plex Sans Arabic</div>
        <p className="mt-3 text-lg">{t('وظيفتك ومشاريعك الأولى تبدأ بمهارتك. ٠١٢٣٤٥٦٧٨٩ 0123456789')}</p>
        <div className="mt-4 flex flex-wrap gap-6 text-mute"><span className="font-normal">{t('عادي 400')}</span><span className="font-medium">{t('متوسط 500')}</span><span className="font-semibold">{t('شبه عريض 600')}</span><span className="font-bold">{t('عريض 700')}</span></div>
      </div>

      <h2 className="mb-3 mt-10 text-xl font-bold">{t('العناصر')}</h2>
      <div className="card flex flex-wrap items-center gap-3 p-6">
        <button className="btn btn-p">{t('زر رئيسي')}</button><button className="btn btn-g">{t('زر إنجاز')}</button><button className="btn">{t('زر ثانوي')}</button>
        <span className="chip chip-b">{t('تخصص')}</span><span className="chip chip-g">{t('مقبول')}</span><span className="chip chip-w">{t('قيد المراجعة')}</span><span className="chip chip-r">{t('مرفوض')}</span>
        <span className="money text-xl">{t('1,200,000 د.ع')}</span>
      </div>
      <h2 className="mb-3 mt-10 text-xl font-bold">{t('قواعد الاستخدام')}</h2>
      <ul className="list-inside list-disc space-y-1 text-mute">
        <li>{t('الأزرق للإجراء، والأخضر للمال والإنجاز فقط.')}</li>
        <li>{t('حافظ على مساحة فارغة حول الشعار تساوي عرض أحد أعمدته.')}</li>
        <li>{t('على الخلفيات الداكنة استخدم الشعار الملون نفسه دون تعديل.')}</li>
        <li>{t('لا يُستخدم أي نص عن «سنوات الخبرة» في أي واجهة أو إعلان.')}</li>
      </ul>
    </div>
  );
}
