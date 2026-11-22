import { t } from '../i18n/index.js';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Headset, Instagram, Mail, Send } from '../icons.jsx';
import { api } from '../api.js';
import { useAuth, useFetch, useToast } from '../context.jsx';
import { Field, Logo, PageHeader, Spinner } from '../ui.jsx';
import { LangSwitch, ThemeButton } from '../Layout.jsx';

/* الدعم الفني والتواصل: صفحة واحدة تُعرض للزائر (/support) ولداخل الحساب (/app/support).
   قنوات التواصل (بريد، إنستغرام) تظهر فقط حين يضبطها المدير من إعدادات المنصة، والنموذج يعمل دائماً. */
const TOPICS = [['technical', 'مشكلة تقنية'], ['account', 'حسابي'], ['payment', 'المبالغ والمحفظة'], ['suggestion', 'اقتراح'], ['report', 'بلاغ عن مخالفة'], ['other', 'أخرى']];
const FAQ = [
  ['نسيت كلمة المرور، ماذا أفعل؟', 'من صفحة الدخول اضغط «نسيت كلمة المرور؟» ونرسل رابطاً إلى بريدك لاختيار كلمة جديدة.'],
  ['متى يصلني المبلغ؟', 'عندما تعتمد الشركة التسليم يصل المبلغ إلى محفظتك مع تقييم.'],
  ['كيف أنشر وظيفة أو مشروعاً؟', 'من حساب الشركة اختر «نشر وظيفة» أو «نشر مشروع» من القائمة، وتوجد قوالب جاهزة تسهّل الكتابة.'],
  ['كيف أبلّغ عن إعلان أو حساب مخالف؟', 'اختر «بلاغ عن مخالفة» في النموذج، واذكر اسم الحساب أو رابط الصفحة.'],
];

function Channels({ support }) {
  if (!support?.email && !support?.instagram) return null;
  return (
    <section aria-label={t('قنوات التواصل')} className="mb-6">
      <h2 className="mb-3 font-bold">{t('قنوات التواصل')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {support.email && (
          <a className="card flex items-center gap-3 p-4 hover:border-brand" href={`mailto:${support.email}`}>
            <span className="gicon"><Mail size={20} /></span>
            <span className="min-w-0"><span className="block text-sm text-mute">{t('البريد الإلكتروني')}</span><span className="block truncate font-semibold" dir="ltr">{support.email}</span></span>
          </a>
        )}
        {support.instagram && (
          <a className="card flex items-center gap-3 p-4 hover:border-brand" href={support.instagramUrl} target="_blank" rel="noopener noreferrer">
            <span className="gicon gicon-r"><Instagram size={20} /></span>
            <span className="min-w-0"><span className="block text-sm text-mute">{t('إنستغرام')}</span><span className="block truncate font-semibold" dir="ltr">@{support.instagram}</span></span>
          </a>
        )}
      </div>
    </section>
  );
}

function SupportForm() {
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: user?.name || '', email: user?.email || '', topic: 'technical', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post('/support', f); setDone(r.id || 0); }
    catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  if (done !== null) {
    return (
      <div role="status" className="card p-6 text-center">
        <span className="gicon gicon-g gicon-lg mx-auto mb-3"><CheckCircle2 size={26} /></span>
        <h2 className="text-lg font-bold">{t('وصلتنا رسالتك')}</h2>
        <p className="mt-1 text-mute">{done ? t('رقم رسالتك: {id}. سنرد عليك على بريدك قريباً.', { id: done }) : t('سنرد عليك على بريدك قريباً.')}</p>
        <button type="button" className="btn mt-4" onClick={() => { setDone(null); set('message', ''); }}>{t('إرسال رسالة أخرى')}</button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="card p-5" aria-label={t('أرسل لنا رسالة')}>
      <h2 className="mb-3 font-bold">{t('أرسل لنا رسالة')}</h2>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label={t('الاسم')}><input id="sp-name" className="inp" autoComplete="name" maxLength={80} value={f.name} onChange={(e) => set('name', e.target.value)} required /></Field>
        <Field label={t('بريدك لنرد عليك')}><input id="sp-email" type="email" dir="ltr" className="inp text-left" autoComplete="email" maxLength={120} value={f.email} onChange={(e) => set('email', e.target.value)} required /></Field>
      </div>
      <Field label={t('نوع الرسالة')}>
        <select id="sp-topic" className="inp" value={f.topic} onChange={(e) => set('topic', e.target.value)}>{TOPICS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
      </Field>
      <Field label={t('رسالتك')} hint={t('اشرح باختصار، واذكر رابط الصفحة إن كانت المشكلة فيها.')}>
        <textarea id="sp-msg" rows="5" className="inp" minLength={10} maxLength={2000} value={f.message} onChange={(e) => set('message', e.target.value)} required />
        <div className="mt-1 text-end text-xs text-mute" dir="ltr">{f.message.length} / 2000</div>
      </Field>
      {/* مصيدة للروبوتات: حقل مخفي عن البشر، فإن مُلئ تُتجاهل الرسالة */}
      <div aria-hidden="true" style={{ position: 'absolute', insetInlineStart: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website', e.target.value)} /></label>
      </div>
      <button className="btn btn-p" disabled={busy}><Send size={16} />{busy ? t('جارٍ الإرسال…') : t('إرسال')}</button>
    </form>
  );
}

function Faq() {
  return (
    <section className="mt-6" aria-label={t('أسئلة سريعة')}>
      <h2 className="mb-3 font-bold">{t('أسئلة سريعة')}</h2>
      <div className="grid gap-2">
        {FAQ.map(([q, a]) => (
          <details key={q} className="card p-4">
            <summary className="cursor-pointer font-semibold">{t(q)}</summary>
            <p className="mt-2 text-sm text-mute">{t(a)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Body() {
  const { data: cfg, loading } = useFetch('/config');
  if (loading && !cfg) return <Spinner />;
  return (
    <>
      <Channels support={cfg?.support} />
      <SupportForm />
      <Faq />
    </>
  );
}

/** داخل الحساب: بتخطيط التطبيق المعتاد */
export function SupportInApp() {
  return (
    <div className="max-w-3xl">
      <PageHeader title={t('الدعم الفني والتواصل')} sub={t('اكتب لنا مشكلتك أو اقتراحك وسنرد عليك على بريدك.')} />
      <Body />
    </div>
  );
}

/** للزائر قبل تسجيل الدخول؛ المسجّل يُحوَّل لصفحته داخل التطبيق */
export default function SupportPublic() {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (user) return <Navigate to="/app/support" replace />;
  return (
    <div className="flex min-h-full flex-col items-center px-4 py-8">
      <div className="mb-6 flex w-full max-w-3xl items-center justify-between">
        <Link to="/" aria-label="أوتاد"><Logo size={36} /></Link>
        <div className="flex gap-2"><ThemeButton /><LangSwitch /></div>
      </div>
      <div className="w-full max-w-3xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="gicon gicon-lg"><Headset size={24} /></span>
          <div>
            <h1 className="text-2xl font-bold">{t('الدعم الفني والتواصل')}</h1>
            <p className="text-mute">{t('اكتب لنا مشكلتك أو اقتراحك وسنرد عليك على بريدك.')}</p>
          </div>
        </div>
        <Body />
        <Link to="/" className="mt-6 inline-flex items-center gap-1 text-sm text-mute hover:text-ink"><ArrowRight size={14} className="ltr:rotate-180" />{t('العودة للصفحة الرئيسية')}</Link>
      </div>
    </div>
  );
}
