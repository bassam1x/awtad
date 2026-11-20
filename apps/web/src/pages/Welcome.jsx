import { t } from '../i18n/index.js';
import { Link } from 'react-router-dom';
import { BadgeCheck, Briefcase, FolderKanban, Wallet, MapPin, MessagesSquare, ShieldCheck, UserPlus, Send, Handshake } from 'lucide-react';
import { Logo } from '../ui.jsx';
import { LangSwitch, ThemeButton } from '../Layout.jsx';
import { LoginForm } from './Auth.jsx';

const features = [
  [BadgeCheck, t('بلا سنوات خبرة'), t('أعمالك ومهاراتك هي الدليل، لا عدد السنين.')],
  [Briefcase, t('وظائف واضحة'), t('الراتب والدوام والعنوان مكتوبة من البداية.')],
  [FolderKanban, t('مشاريع تبني سجلّك'), t('نفّذ مشاريع صغيرة بمبالغ محددة وأضفها إلى ملفك.')],
  [Wallet, t('مبلغ وتقييم عند التسليم'), t('عند اعتماد العمل يصل المبلغ إلى محفظتك مع تقييم.')],
  [MessagesSquare, t('محادثة مباشرة'), t('تابع العمل مع الشركة في مكان واحد.')],
  [ShieldCheck, t('حسابات وفرص مراجَعة'), t('نراجع الحسابات والفرص للحفاظ على الجودة.')],
];
const steps = [
  [UserPlus, t('أنشئ حسابك'), t('كمبدع أو كشركة، أو عبر Google.')],
  [Send, t('قدّم أو انشر'), t('قدّم بمشروعين من أعمالك، أو انشر فرصتك.')],
  [Handshake, t('اعمل واكسب'), t('تحادثا، سلّم العمل، واستلم المبلغ مع تقييم.')],
];

export default function Welcome() {
  const why = t('ليش نختار {name}؟').split('{name}');
  return (
    <div className="page-in min-h-full">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo size={38} />
        <div className="flex items-center gap-2">
          <ThemeButton />
          <LangSwitch />
          {/* على الجوال يقع نموذج الدخول أسفل الصفحة، فنضع رابطاً ظاهراً في الأعلى */}
          <Link to="/login" className="btn lg:hidden">{t('دخول')}</Link>
          <Link to="/register" className="btn btn-p">{t('إنشاء حساب')}</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1fr_400px] lg:items-start">
        <div className="min-w-0">
          <span className="chip chip-g mb-4"><MapPin size={13} />{t('منصة عراقية وعربية للطلاب والخريجين')}</span>
          <h1 className="max-w-2xl text-3xl font-bold leading-snug sm:text-5xl" style={{ textWrap: 'balance' }}>
            {t('مهاراتك تفتح لك أول فرصة.. بلا شرط سنوات الخبرة')}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-mute">
            {t('أوتاد تجمع الطلاب والخريجين مع الشركات في مكان واحد: وظائف للمبتدئين، ومشاريع صغيرة بمبالغ واضحة.')}
          </p>

          <div className="mt-12">
            <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">
              {why[0]}<span className="text-brand">{t('أوتاد')}</span>{why[1]}
            </h2>
            <span className="mt-3 block h-1.5 w-16 rounded-full bg-brand" aria-hidden="true" />
            <p className="mt-3 text-mute">{t('ستة أسباب تجعلها بدايتك الصحيحة')}</p>
          </div>

          <section className="mt-6 grid gap-4 sm:grid-cols-2" aria-label={t('مميزات المنصة')}>
            {features.map(([I, title, d]) => (
              <div key={title} className="card p-5">
                <span className="gicon gicon-live mb-3"><I size={20} /></span>
                <h2 className="font-bold">{title}</h2>
                <p className="mt-1 text-sm text-mute">{d}</p>
              </div>
            ))}
          </section>

          <section className="mt-12">
            <h2 className="mb-4 text-xl font-bold">{t('ابدأ في ثلاث خطوات')}</h2>
            <ol className="grid gap-4 sm:grid-cols-3">
              {steps.map(([I, title, d], i) => (
                <li key={title} className="card p-5">
                  <div className="mb-2 flex items-center gap-2 text-brand"><span className="gicon gicon-sm"><I size={16} /></span><span className="text-sm font-semibold text-mute">{t('الخطوة')} {i + 1}</span></div>
                  <div className="font-bold">{title}</div>
                  <p className="mt-1 text-sm text-mute">{d}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12 grid gap-4 sm:grid-cols-2">
            <div className="card bg-soft p-5"><h3 className="font-bold">{t('للطلاب والخريجين')}</h3><p className="mt-1 text-sm text-mute">{t('ملف يثبت مهاراتك، ووظائف ومشاريع مناسبة للمبتدئين.')}</p></div>
            <div className="card bg-goodsoft p-5"><h3 className="font-bold">{t('للشركات وأصحاب الأعمال')}</h3><p className="mt-1 text-sm text-mute">{t('انشر فرصتك، وراجع أعمال المتقدمين بدل سنوات الخبرة.')}</p></div>
          </section>
        </div>

        <aside className="card p-6 lg:sticky lg:top-6" aria-label={t('تسجيل الدخول')}>
          <h2 className="text-xl font-bold">{t('تسجيل الدخول')}</h2>
          <p className="mb-5 mt-1 text-sm text-mute">{t('ادخل إلى حسابك، أو أنشئ حساباً جديداً.')}</p>
          <LoginForm />
          <p className="mt-5 text-center text-sm text-mute">{t('ليس لديك حساب؟')} <Link className="font-semibold text-brand" to="/register">{t('إنشاء حساب جديد')}</Link></p>
        </aside>
      </div>
    </div>
  );
}
