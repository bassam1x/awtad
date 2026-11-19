import { Link } from 'react-router-dom';
import { BadgeCheck, Briefcase, FolderKanban, Wallet, MapPin, MessagesSquare, ShieldCheck, UserPlus, Send, Handshake } from 'lucide-react';
import { Logo } from '../ui.jsx';
import { ThemeButton } from '../Layout.jsx';
import { LoginForm } from './Auth.jsx';

const features = [
  [BadgeCheck, 'بلا شرط سنوات الخبرة', 'لا يوجد حقل «سنوات خبرة» في أي مكان. ملفك يثبت كفاءتك بمهاراتك وأعمالك المنجزة.'],
  [Briefcase, 'وظائف بشفافية كاملة', 'راتب شهري محدد، ساعات وأوقات العمل، نوع الدوام، وعنوان نصي مع رابط خرائط جوجل.'],
  [FolderKanban, 'مشاريع وتعاونات', 'منيو مطعم، شعار، موقع، نظام كاشير. مشاريع بمبالغ واضحة تبني بها سجلّ أعمالك.'],
  [Wallet, 'محفظة وتقييمات', 'عند اعتماد التسليم يتحول المبلغ إلى محفظتك ويُضاف العمل مع تقييمه إلى ملفك.'],
  [MessagesSquare, 'محادثة مباشرة', 'بعد قبول طلبك تفتح محادثة مع الشركة لمتابعة العمل والتسليم في مكان واحد.'],
  [ShieldCheck, 'إدارة ورقابة', 'لوحة إدارة تراجع الحسابات والفرص وتحافظ على جودة المنصة.'],
];
const steps = [
  [UserPlus, 'أنشئ حسابك', 'سجّل كمبدع أو كشركة، أو ادخل بحساب Google.'],
  [Send, 'قدّم أو انشر', 'قدّم على الفرص بمشروعين من أعمالك، أو انشر وظيفة ومشروعاً.'],
  [Handshake, 'اعمل واكسب', 'تحدثا، سلّم العمل، واستلم المبلغ مع تقييم يدعم ملفك.'],
];

export default function Welcome() {
  return (
    <div className="min-h-full">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo size={38} />
        <div className="flex items-center gap-2">
          <ThemeButton />
          <Link to="/brand" className="btn hidden sm:inline-flex">الهوية البصرية</Link>
          <Link to="/register" className="btn btn-p">إنشاء حساب</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1fr_400px] lg:items-start">
        <div className="min-w-0">
          <span className="chip chip-g mb-4"><MapPin size={13} />منصة عراقية وعربية للطلاب والخريجين</span>
          <h1 className="max-w-2xl text-3xl font-bold leading-snug sm:text-5xl" style={{ textWrap: 'balance' }}>
            وظيفتك ومشاريعك الأولى تبدأ بمهارتك.. لا بشرط سنوات الخبرة
          </h1>
          <p className="mt-4 max-w-xl text-lg text-mute">
            مهارة تربط الطلاب والخريجين الجدد والمبرمجين والمهندسين بالشركات وأصحاب الأعمال عبر مسارين: التوظيف، والمشاريع التعاونية.
          </p>

          <section className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="مميزات المنصة">
            {features.map(([I, t, d]) => (
              <div key={t} className="card p-5">
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-soft text-brand"><I size={20} /></span>
                <h2 className="font-bold">{t}</h2>
                <p className="mt-1 text-sm text-mute">{d}</p>
              </div>
            ))}
          </section>

          <section className="mt-12">
            <h2 className="mb-4 text-xl font-bold">كيف تعمل المنصة؟</h2>
            <ol className="grid gap-4 sm:grid-cols-3">
              {steps.map(([I, t, d], i) => (
                <li key={t} className="card p-5">
                  <div className="mb-2 flex items-center gap-2 text-brand"><I size={20} /><span className="text-sm font-semibold text-mute">الخطوة {i + 1}</span></div>
                  <div className="font-bold">{t}</div>
                  <p className="mt-1 text-sm text-mute">{d}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12 grid gap-4 sm:grid-cols-2">
            <div className="card bg-soft p-5"><h3 className="font-bold">للطلاب والخريجين</h3><p className="mt-1 text-sm text-mute">ابنِ ملفاً يثبت مهاراتك، قدّم على وظائف مناسبة للمبتدئين، ونفّذ مشاريع صغيرة بمبالغ واضحة.</p></div>
            <div className="card bg-goodsoft p-5"><h3 className="font-bold">للشركات وأصحاب الأعمال</h3><p className="mt-1 text-sm text-mute">انشر وظيفة أو مشروعاً، راجع الأعمال السابقة للمتقدمين بدل سنوات الخبرة، وادفع عند الاعتماد فقط.</p></div>
          </section>
        </div>

        <aside className="card p-6 lg:sticky lg:top-6" aria-label="تسجيل الدخول">
          <h2 className="text-xl font-bold">تسجيل الدخول</h2>
          <p className="mb-5 mt-1 text-sm text-mute">ادخل إلى حسابك، أو أنشئ حساباً جديداً.</p>
          <LoginForm />
          <p className="mt-5 text-center text-sm text-mute">ليس لديك حساب؟ <Link className="font-semibold text-brand" to="/register">إنشاء حساب جديد</Link></p>
        </aside>
      </div>
    </div>
  );
}
