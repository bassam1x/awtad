import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Logo, LogoMark } from '../ui.jsx';
import { ThemeButton } from '../Layout.jsx';

const palette = [
  ['أزرق مهارة', '#2563EB', 'الأزرار الرئيسية والروابط والعناصر النشطة'],
  ['أخضر الإنجاز', '#10B981', 'الرواتب والأرباح والمحفظة وحالات النجاح'],
  ['كحلي', '#0F172A', 'النصوص والعناوين'],
  ['فيروزي', '#0EA5A4', 'التدرج في الشعار والرسوم'],
  ['رمادي مزرق', '#64748B', 'النصوص الثانوية'],
  ['خلفية', '#F8FAFC', 'خلفية التطبيق في النهاري'],
];
const dark = [['خلفية ليلية', '#0B1220'], ['بطاقة ليلية', '#111A2E'], ['أزرق ليلي', '#60A5FA'], ['أخضر ليلي', '#34D399']];

export default function Brand() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <Link to="/" className="btn"><ArrowRight size={16} />رجوع</Link>
        <ThemeButton />
      </div>
      <h1 className="text-3xl font-bold">الهوية البصرية لمهارة</h1>
      <p className="mt-2 max-w-2xl text-mute">فكرة الشعار: ثلاثة أعمدة متصاعدة تمثل نمو المهارة خطوة بعد خطوة، ونقطة خضراء فوق العمود الأعلى تمثل الإنجاز المعتمد، وتشبه نقطة الحرف العربي.</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card flex h-44 items-center justify-center"><Logo size={56} /></div>
        <div className="card flex h-44 items-center justify-center bg-ink"><span className="inline-flex items-center gap-3 text-white"><LogoMark size={56} /><span className="text-4xl font-bold">مهارة</span></span></div>
        <div className="card flex h-44 items-center justify-center gap-4"><LogoMark size={28} /><LogoMark size={44} /><LogoMark size={64} /></div>
      </section>

      <h2 className="mb-3 mt-10 text-xl font-bold">الألوان</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {palette.map(([n, h, d]) => (
          <div key={h} className="card overflow-hidden">
            <div className="h-20" style={{ background: h }} />
            <div className="p-3"><div className="font-bold">{n}</div><div className="text-sm text-mute" dir="ltr" style={{ textAlign: 'right' }}>{h}</div><div className="mt-1 text-sm text-mute">{d}</div></div>
          </div>
        ))}
      </div>
      <h3 className="mb-3 mt-6 font-bold">الوضع الليلي</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {dark.map(([n, h]) => <div key={h} className="card overflow-hidden"><div className="h-14" style={{ background: h }} /><div className="p-3 text-sm"><b>{n}</b><div className="text-mute" dir="ltr" style={{ textAlign: 'right' }}>{h}</div></div></div>)}
      </div>

      <h2 className="mb-3 mt-10 text-xl font-bold">الخط</h2>
      <div className="card p-6">
        <div className="text-4xl font-bold">IBM Plex Sans Arabic</div>
        <p className="mt-3 text-lg">وظيفتك ومشاريعك الأولى تبدأ بمهارتك. ٠١٢٣٤٥٦٧٨٩ 0123456789</p>
        <div className="mt-4 flex flex-wrap gap-6 text-mute"><span className="font-normal">عادي 400</span><span className="font-medium">متوسط 500</span><span className="font-semibold">شبه عريض 600</span><span className="font-bold">عريض 700</span></div>
      </div>

      <h2 className="mb-3 mt-10 text-xl font-bold">العناصر</h2>
      <div className="card flex flex-wrap items-center gap-3 p-6">
        <button className="btn btn-p">زر رئيسي</button><button className="btn btn-g">زر إنجاز</button><button className="btn">زر ثانوي</button>
        <span className="chip chip-b">تخصص</span><span className="chip chip-g">مقبول</span><span className="chip chip-w">قيد المراجعة</span><span className="chip chip-r">مرفوض</span>
        <span className="money text-xl">1,200,000 د.ع</span>
      </div>
      <h2 className="mb-3 mt-10 text-xl font-bold">قواعد الاستخدام</h2>
      <ul className="list-inside list-disc space-y-1 text-mute">
        <li>الأزرق للإجراء، والأخضر للمال والإنجاز فقط.</li>
        <li>حافظ على مساحة فارغة حول الشعار تساوي عرض أحد أعمدته.</li>
        <li>على الخلفيات الداكنة استخدم الشعار الملون نفسه دون تعديل.</li>
        <li>لا يُستخدم أي نص عن «سنوات الخبرة» في أي واجهة أو إعلان.</li>
      </ul>
    </div>
  );
}
