import { t } from '../i18n/index.js';
import { Tr } from '../translate.jsx';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Briefcase, DotsThree, FolderKanban, Paperclip, PackageCheck, Plus, Trash2, Users, Wallet as WalletIcon, Zap, Pencil, Send, X } from '../icons.jsx';
import { api } from '../api.js';
import { useAuth, useFetch, useToast } from '../context.jsx';
import { Avatar, Banner, BarList, CURRENCIES, Empty, JOB_TYPES, SUITABLE, ErrorBox, Field, MapKindHint, Modal, MoneyInput, PageHeader, Spinner, SPECS, StatCard, StatusChip, Stars, fmt, curLabel, specText } from '../ui.jsx';
import { ProfileBody } from './PublicProfile.jsx';

/* ---------- Dashboard ---------- */
export function CompanyDashboard() {
  const { user } = useAuth();
  const { data: s, loading, error } = useFetch('/stats');
  const { data: apps } = useFetch('/applications');
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  const pending = (apps || []).filter((a) => a.status === 'pending').slice(0, 5);
  return (
    <div>
      <Banner title={t('أهلاً {name}', { name: user.name })} sub={t('ملخص التوظيف والمشاريع في شركتك، وما ينتظر قرارك اليوم.')}>
        <Link to="/app/my-postings/new?kind=job" className="btn border-white/0 bg-white text-slate-900 hover:bg-white/90"><Plus size={16} />{t('وظيفة جديدة')}</Link>
        <Link to="/app/my-postings/new?kind=project" className="btn border-white/40 bg-white/15 text-white hover:bg-white/25"><Plus size={16} />{t('مشروع جديد')}</Link>
      </Banner>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Briefcase} label={t('وظائف منشورة')} value={s.jobs} to="/app/my-postings?kind=job" />
        <StatCard icon={FolderKanban} label={t('مشاريع منشورة')} value={s.projects} tone="g" to="/app/my-postings?kind=project" />
        <StatCard icon={Users} label={t('طلبات بانتظار مراجعتك')} value={s.pending} tone="w" to="/app/applicants?status=pending" hint={<div className="text-xs text-mute">{t('من أصل')} {s.applicants} {t('متقدم')}</div>} />
        <StatCard icon={PackageCheck} label={t('تسليمات بانتظار اعتمادك')} value={s.awaiting} tone={s.awaiting ? 'r' : 'g'} to="/app/workspace" />
      </div>
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <BarList title={t('مسار المتقدمين')} rows={[{ label: t('إجمالي المتقدمين'), value: s.applicants }, { label: t('بانتظار المراجعة'), value: s.pending, color: 'bg-warn' }, { label: t('تسليمات بانتظار الاعتماد'), value: s.awaiting, color: 'bg-good' }]} />
        <div className="card bg-goodsoft p-5"><div className="flex items-center gap-2 text-sm text-mute"><WalletIcon size={16} />{t('إجمالي ما دُفع للمبدعين')}</div><div className="money mt-1 text-2xl">{s.paid.length ? s.paid.map((p) => `${fmt(p.total)} ${curLabel(p.cur)}`).join(' + ') : '0'}</div></div>
      </div>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">{t('أحدث الطلبات المعلّقة')}</h2><Link to="/app/applicants" className="text-sm font-semibold text-brand">{t('عرض الكل')}</Link></div>
      {pending.length ? <div className="grid gap-3">{pending.map((a) => (
        <div key={a.id} className="card flex flex-wrap items-center gap-3 p-4">
          <Avatar u={{ id: a.student_id, name: a.student_name, avatar: a.student_avatar }} size={44} />
          <div className="min-w-0 flex-1"><div className="font-semibold">{a.student_name}</div><div className="text-sm text-mute">{t('تقدّم على:')} <Tr>{a.title}</Tr></div></div>
          <Link className="btn" to={`/app/applicants?posting=${a.posting_id}`}>{t('مراجعة')}</Link>
        </div>
      ))}</div> : <Empty>{t('لا طلبات معلّقة حالياً.')}</Empty>}
    </div>
  );
}

/* ---------- Manage postings ---------- */
export function MyPostings() {
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const kindF = ['job', 'project'].includes(sp.get('kind')) ? sp.get('kind') : '';
  const { data: all, loading, error, reload } = useFetch('/postings/mine');
  const data = (all || []).filter((p) => !kindF || p.kind === kindF);
  const del = async (id) => { try { await api.del(`/postings/${id}`); toast(t('أُزيل المنشور')); reload(); } catch (e) { toast(e.message, 'err'); } };
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  return (
    <div>
      <PageHeader title={t('الوظائف والمشاريع المنشورة')} sub={t('كل فرصة نشرتها مع عدد المتقدمين.')}>
        <Link to="/app/my-postings/new?kind=job" className="btn btn-p"><Plus size={16} />{t('وظيفة شاغرة جديدة')}</Link>
        <Link to="/app/my-postings/new?kind=project" className="btn btn-g"><Plus size={16} />{t('مشروع / تعاون جديد')}</Link>
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t('نوع المنشور')}>
        {[['', t('الكل')], ['job', t('وظائف')], ['project', t('مشاريع')]].map(([k, l]) => (
          <button key={k} type="button" aria-pressed={kindF === k} className={`btn btn-sm ${kindF === k ? 'btn-p' : ''}`} onClick={() => setSp(k ? { kind: k } : {})}>{l}{all ? ` (${k ? all.filter((p) => p.kind === k).length : all.length})` : ''}</button>
        ))}
      </div>
      {data.length ? (
        <div className="grid gap-3">
          {data.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center gap-3 p-4">
              <span className={`chip ${p.kind === 'job' ? 'chip-b' : 'chip-g'}`}>{p.kind === 'job' ? t('وظيفة') : t('مشروع')}</span>
              <div className="min-w-0 flex-1">
                <Link to={`/app/opportunity/${p.id}`} className="font-bold hover:text-brand"><Tr>{p.title}</Tr></Link>
                <div className="text-sm text-mute">{t(p.spec)} · <span className="money">{fmt(p.pay)} {curLabel(p.cur)}</span>{p.kind === 'job' ? ` · ${t(p.shift)} · ${t(p.type)}` : ` · ${t('{n} أيام', { n: p.days })}`}</div>
              </div>
              {p.status === 'closed' && <span className="chip chip-r">{t('مغلق')}</span>}
              <span className="chip"><Users size={13} />{p.applicants} {t('متقدم')}</span>
              {p.pending > 0 && <span className="chip chip-w">{p.pending} {t('جديد')}</span>}
              <Link className="btn" to={`/app/applicants?posting=${p.id}`}>{t('عرض المتقدمين')}</Link>
              <Link className="btn" to={`/app/my-postings/${p.id}/edit`} aria-label={t('تعديل')} data-tip={t('تعديل')}><Pencil size={16} /></Link>
              <button className="btn btn-d" aria-label={t('حذف')} data-tip={t('حذف')} onClick={() => del(p.id)}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      ) : <Empty>{t('لا منشورات بعد. انشر أول وظيفة أو مشروع.')}</Empty>}
    </div>
  );
}

/* ---------- New posting form (own page) ---------- */
/* قوالب جاهزة بضغطة: تعبّئ النموذج ويعدّل صاحب العمل ما يشاء. المبالغ بالدينار العراقي، ومرجعها أسعار السوق للأعمال الصغيرة. */
const PROJECT_TEMPLATES = [
  { k: t('منيو مطعم'), title: t('تصميم منيو رقمي'), spec: 'تصميم', pay: 150000, days: 5, reqs: 'Illustrator, Figma', description: t('منيو من 4 صفحات بألوان تناسب هوية المكان.') },
  { k: t('شعار'), title: t('تصميم شعار'), spec: 'تصميم', pay: 100000, days: 4, reqs: 'Illustrator', description: t('ثلاثة مقترحات أولية وتعديلان مجانيان.') },
  { k: t('موقع'), title: t('موقع تعريفي'), spec: 'برمجة', pay: 400000, days: 7, reqs: 'HTML/CSS, JavaScript', description: t('موقع من 3 صفحات متجاوب مع الجوال.') },
  { k: t('نظام كاشير'), title: t('نظام كاشير بسيط'), spec: 'برمجة', pay: 600000, days: 14, reqs: t('SQL, واجهة ويب'), description: t('تسجيل الطلبات والفواتير وتقرير يومي.') },
  { k: t('منشورات سوشال'), title: t('تصميم 10 منشورات سوشال ميديا'), spec: 'تصميم', pay: 120000, days: 5, reqs: 'Photoshop, Canva', description: t('عشرة تصاميم بقياسات إنستغرام وفيسبوك بهوية موحّدة.') },
  { k: t('عرض تقديمي'), title: t('تصميم عرض تقديمي'), spec: 'تصميم', pay: 90000, days: 3, reqs: 'PowerPoint, Canva', description: t('عرض من 15 شريحة بتصميم احترافي.') },
  { k: t('تصوير منتجات'), title: t('تصوير منتجات للمتجر'), spec: 'تسويق ومحتوى', pay: 150000, days: 4, reqs: t('تصوير, تعديل صور'), description: t('تصوير 20 منتجاً بخلفية نظيفة وتعديل الألوان.') },
  { k: t('مونتاج فيديو'), title: t('مونتاج فيديو ترويجي'), spec: 'تسويق ومحتوى', pay: 200000, days: 5, reqs: 'Premiere, CapCut', description: t('فيديو من 30 إلى 60 ثانية مع موسيقى وعناوين.') },
  { k: t('كتابة محتوى'), title: t('كتابة محتوى لصفحات التواصل'), spec: 'تسويق ومحتوى', pay: 100000, days: 5, reqs: t('كتابة, تدقيق لغوي'), description: t('خمسة عشر منشوراً بلغة بسيطة تناسب جمهور المكان.') },
  { k: t('إدارة صفحة'), title: t('إدارة صفحة إنستغرام لمدة شهر'), spec: 'تسويق ومحتوى', pay: 250000, days: 30, reqs: t('إدارة حسابات, Canva'), description: t('نشر منتظم والرد على الرسائل وتقرير أسبوعي.') },
  { k: t('تطبيق جوال'), title: t('تطبيق جوال بسيط'), spec: 'برمجة', pay: 900000, days: 21, reqs: 'Flutter, Firebase', description: t('تطبيق من 4 شاشات يعمل على أندرويد وآيفون.') },
  { k: t('متجر إلكتروني'), title: t('متجر إلكتروني صغير'), spec: 'برمجة', pay: 700000, days: 14, reqs: 'Shopify, HTML/CSS', description: t('عرض المنتجات وسلة الشراء وطلب عبر واتساب.') },
  { k: t('مخطط هندسي'), title: t('رسم مخطط هندسي'), spec: 'هندسة', pay: 200000, days: 6, reqs: 'AutoCAD', description: t('رسم مخطط تنفيذي من الكروكي مع الأبعاد.') },
  { k: t('ترجمة'), title: t('ترجمة مستند'), spec: 'أخرى', pay: 80000, days: 3, reqs: t('ترجمة, تدقيق'), description: t('ترجمة بين العربية والإنجليزية لعشر صفحات.') },
  { k: t('إدخال بيانات'), title: t('إدخال وتنظيم بيانات'), spec: 'محاسبة وإدارة', pay: 70000, days: 3, reqs: 'Excel', description: t('نقل بيانات من ورق أو صور إلى جدول منظم.') },
].map((x) => ({ cur: 'IQD', ...x }));
const JOB_TEMPLATES = [
  { k: t('ويتر'), title: t('ويتر / نادل'), spec: 'مطاعم وكافيهات', pay: 600000, hours: 8, shift: 'مسائي', type: 'دوام كامل', schedule: t('يومياً عدا الجمعة، 4 م إلى 12 ص'), reqs: t('خدمة الزبائن, نظافة'), description: t('استقبال الزبائن وأخذ الطلبات وتقديمها بسرعة وأدب.') },
  { k: t('مساعد طباخ'), title: t('مساعد طباخ'), spec: 'مطاعم وكافيهات', pay: 650000, hours: 8, shift: 'صباحي', type: 'دوام كامل', schedule: t('يومياً عدا الجمعة، 12 ظ إلى 8 م'), reqs: t('نظافة, سرعة'), description: t('تجهيز المكونات وتنظيف المطبخ ومساعدة الطباخ الرئيسي.') },
  { k: t('كاشير'), title: t('كاشير'), spec: 'مبيعات وكاشير', pay: 650000, hours: 8, shift: 'صباحي', type: 'دوام كامل', schedule: t('السبت – الخميس، 9 ص إلى 5 م'), reqs: t('دقة, حاسبة'), description: t('استلام المبالغ وإصدار الفواتير وإغلاق الصندوق آخر اليوم.') },
  { k: t('مندوب مبيعات'), title: t('مندوب مبيعات'), spec: 'مبيعات وكاشير', pay: 700000, hours: 8, shift: 'صباحي', type: 'دوام كامل', schedule: t('السبت – الخميس، 10 ص إلى 6 م'), reqs: t('إقناع, تواصل'), description: t('زيارة المحلات وعرض المنتجات وتسجيل الطلبات.') },
  { k: t('مندوب توصيل'), title: t('مندوب توصيل'), spec: 'توصيل ونقل', pay: 700000, hours: 8, shift: 'صباحي', type: 'دوام كامل', schedule: t('يومياً، 11 ص إلى 7 م'), reqs: t('دراجة نارية, معرفة بالمدينة'), description: t('توصيل الطلبات للزبائن في وقتها مع المحافظة على جودتها.') },
  { k: t('خدمة عملاء'), title: t('موظف خدمة عملاء عن بعد'), spec: 'خدمة عملاء', pay: 600000, hours: 6, shift: 'مسائي', type: 'عن بعد', schedule: t('الأحد – الخميس، 3 م إلى 9 م'), reqs: t('مهارات تواصل, واتساب'), description: t('الرد على استفسارات الزبائن عبر الرسائل والمكالمات.') },
  { k: t('سوشال ميديا'), title: t('مسؤول سوشال ميديا عن بعد'), spec: 'تسويق ومحتوى', pay: 650000, hours: 5, shift: 'صباحي', type: 'عن بعد', schedule: t('الأحد – الخميس، 10 ص إلى 3 م'), reqs: t('Canva, كتابة'), description: t('نشر المحتوى والرد على التعليقات وإعداد تقرير شهري.') },
  { k: t('محاسب'), title: t('محاسب مبتدئ'), spec: 'محاسبة وإدارة', pay: 900000, hours: 7, shift: 'صباحي', type: 'دوام كامل', schedule: t('السبت – الخميس، 9 ص إلى 4 م'), reqs: t('Excel, محاسبة'), description: t('تسجيل القيود اليومية وإعداد كشوف بسيطة ومتابعة الفواتير.') },
  { k: t('مدرّس'), title: t('مدرّس لغة إنجليزية'), spec: 'تعليم وتدريب', pay: 500000, hours: 4, shift: 'مسائي', type: 'دوام جزئي', schedule: t('الأحد – الخميس، 4 م إلى 8 م'), reqs: t('لغة إنجليزية, صبر'), description: t('تدريس مجموعات صغيرة من الطلاب وتحضير الدروس والتمارين.') },
].map((x) => ({ cur: 'IQD', ...x }));
/** قوالب جاهزة: أول 4 ظاهرة، والباقي في قائمة (⋯) حتى لا يزدحم النموذج. */
function TemplatePicker({ items, onPick, visible = 4 }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const shown = items.slice(0, visible), rest = items.slice(visible);
  const pick = (tp) => { const { k, ...vals } = tp; onPick(vals); setOpen(false); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {shown.map((tp) => <button type="button" key={tp.k} className="btn" onClick={() => pick(tp)}><Zap size={14} />{tp.k}</button>)}
      {rest.length > 0 && (
        <div className="relative" ref={box}>
          <button type="button" className="btn" aria-haspopup="menu" aria-expanded={open} aria-label={t('المزيد من القوالب')} data-tip={t('المزيد من القوالب')} onClick={() => setOpen((o) => !o)}>
            <DotsThree size={20} />
            <span className="text-xs text-mute">{rest.length}</span>
          </button>
          {open && (
            <div role="menu" className="more-menu">
              {rest.map((tp) => <button type="button" role="menuitem" key={tp.k} className="switcher-item" onClick={() => pick(tp)}><Zap size={14} className="text-mute" /><span className="truncate text-sm font-semibold">{tp.k}</span></button>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export function PostingForm() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { id } = useParams();
  const { data: loaded, loading: exLoading } = useFetch(id ? `/postings/${id}` : null);
  const ex = id ? loaded : null; // لا نعيد استخدام بيانات منشور سابق عند فتح نموذج جديد
  const kind = ex ? ex.kind : sp.get('kind') === 'project' ? 'project' : 'job';
  const isJob = kind === 'job';
  const [f, setF] = useState({ title: '', spec: 'برمجة', pay: '', cur: 'IQD', hours: 6, schedule: '', shift: 'صباحي', type: 'دوام جزئي', address: '', map_url: '', reqs: '', description: '', days: 7, suitable_for: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (ex) setF({ title: ex.title, spec: ex.spec, pay: ex.pay, cur: ex.cur, hours: ex.hours || 6, schedule: ex.schedule || '', shift: ex.shift || 'صباحي', type: ex.type || 'دوام جزئي', address: ex.address || '', map_url: ex.map_url || '', reqs: ex.reqs.join(', '), description: ex.description, days: ex.days || 7, suitable_for: ex.suitable_for || '' });
  }, [ex]);  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = id ? await api.put(`/postings/${id}`, f) : await api.post('/postings', { ...f, kind }); toast(id ? t('حُفظت التعديلات') : t('نُشر بنجاح')); nav(`/app/opportunity/${r.id}`); } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  if (id && exLoading) return <Spinner />;
  return (
    <div>
      <PageHeader title={id ? t('تعديل المنشور') : isJob ? t('وظيفة شاغرة جديدة') : t('مشروع / تعاون جديد')} sub={isJob ? t('كل التفاصيل واضحة للمتقدمين: الراتب والأوقات والموقع.') : t('حدّد المبلغ ومدة التسليم، ويُحوَّل المبلغ عند اعتمادك للتسليم.')} />
      <form onSubmit={submit} className="card max-w-3xl p-5">
        {!id && (
          <div className="mb-4">
            <div className="lbl">{t('قوالب جاهزة بضغطة')}</div>
            <TemplatePicker items={isJob ? JOB_TEMPLATES : PROJECT_TEMPLATES} onPick={(vals) => setF((x) => ({ ...x, ...vals }))} />
          </div>
        )}
        <Field label={isJob ? t('المسمى الوظيفي') : t('عنوان المشروع')}><input id="np-title" className="inp" value={f.title} onChange={(e) => set('title', e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
          <Field label={isJob ? t('الراتب الشهري') : t('المبلغ')}><MoneyInput id="np-pay" value={f.pay} onChange={(v) => set('pay', v)} required placeholder="1,000,000" /></Field>
          <Field label={t('العملة')}><select id="np-cur" className="inp" value={f.cur} onChange={(e) => set('cur', e.target.value)}>{CURRENCIES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></Field>
          <Field label={t('التخصص')}><select id="np-spec" className="inp" value={f.spec} onChange={(e) => set('spec', e.target.value)}>{SPECS.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></Field>
          {isJob ? (
            <>
              <Field label={t('ساعات العمل يومياً')}><input id="np-hours" type="number" min="1" max="16" className="inp" value={f.hours} onChange={(e) => set('hours', e.target.value)} /></Field>
              <Field label={t('نوع الدوام')}><select id="np-type" className="inp" value={f.type} onChange={(e) => set('type', e.target.value)}>{JOB_TYPES.map((v) => <option key={v} value={v}>{t(v)}</option>)}</select></Field>
              <Field label={t('الفترة')}><select id="np-shift" className="inp" value={f.shift} onChange={(e) => set('shift', e.target.value)}><option value="صباحي">{t('صباحي')}</option><option value="مسائي">{t('مسائي')}</option></select></Field>
            </>
          ) : <Field label={t('مدة التسليم (أيام)')}><input id="np-days" type="number" min="1" className="inp" value={f.days} onChange={(e) => set('days', e.target.value)} /></Field>}
        </div>
        {isJob && (
          <>
            <Field label={t('أوقات العمل')}><input id="np-sched" className="inp" value={f.schedule} onChange={(e) => set('schedule', e.target.value)} placeholder={t('السبت – الخميس، 9 ص إلى 3 م')} /></Field>
            {f.type === 'عن بعد' ? (
              <p className="mb-3 rounded-xl border border-line bg-soft p-3 text-sm text-mute">{t('الوظيفة عن بعد، فلا حاجة للعنوان ولا لرابط الموقع.')}</p>
            ) : (
              <>
                <Field label={t('العنوان النصي')} hint={t('اتركه فارغاً لاستخدام عنوان الشركة من ملفها.')}><input id="np-addr" className="inp" value={f.address} onChange={(e) => set('address', e.target.value)} placeholder={user.address} /></Field>
                <Field label={t('رابط الموقع: Google Maps أو Waze (اختياري)')} hint={<span className="flex flex-wrap items-center gap-2">{t('الصق رابط المشاركة من Google Maps أو Waze. إن تركته فارغاً نبني الأزرار من العنوان.')}<MapKindHint url={f.map_url} /></span>}><input id="np-map" dir="ltr" className="inp text-left" inputMode="url" placeholder="https://waze.com/ul?..." value={f.map_url} onChange={(e) => set('map_url', e.target.value)} /></Field>
              </>
            )}
          </>
        )}
        <Field label={t('المتطلبات: مهارات وأدوات فقط')} hint={t('افصل بينها بفاصلة')}><input id="np-reqs" className="inp" value={f.reqs} onChange={(e) => set('reqs', e.target.value)} /></Field>
        <Field label={t('الوصف')}><textarea id="np-desc" rows="3" className="inp" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label={t('مناسب لـ (اختياري)')} hint={t('يظهر كشارة على بطاقة الفرصة. اختر من المقترحات أو اكتب ما تشاء، أو اتركه فارغاً.')}>
          <input id="np-suit" className="inp" maxLength={80} value={f.suitable_for} onChange={(e) => set('suitable_for', e.target.value)} placeholder={t('مثلاً: مناسب للطلاب')} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUITABLE.map((s) => <button type="button" key={s} aria-pressed={f.suitable_for === s} className={`chip ${f.suitable_for === s ? 'chip-g' : ''}`} onClick={() => set('suitable_for', f.suitable_for === s ? '' : s)}>{t(s)}</button>)}
          </div>
        </Field>
        <div className="flex gap-2"><button className="btn btn-p" disabled={busy}><Send size={16} />{id ? t('حفظ') : t('نشر')}</button><Link to="/app/my-postings" className="btn">{t('إلغاء')}</Link></div>
      </form>
    </div>
  );
}

/* ---------- Applicants ---------- */
export function Applicants() {
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const posting = sp.get('posting') || '';
  const { data: mine } = useFetch('/postings/mine');
  const { data: allApps, loading, reload } = useFetch(`/applications${posting ? `?posting=${posting}` : ''}`);
  const statusF = sp.get('status') === 'pending' ? 'pending' : '';
  const apps = statusF ? allApps?.filter((a) => a.status === 'pending') : allApps;
  const [view, setView] = useState(null);
  const act = async (id, what) => { try { await api.post(`/applications/${id}/${what}`); toast(what === 'accept' ? t('تم القبول وفتحت المحادثة') : t('رُفض الطلب')); reload(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div>
      <PageHeader title={t('مراجعة المتقدمين')} sub={t('راجع أعمالهم السابقة بدل سنوات الخبرة، ثم اقبل أو ارفض.')} />
      <div className="mb-4 max-w-md">
        <label className="lbl" htmlFor="app-sel">{t('المنشور')}</label>
        <select id="app-sel" className="inp" value={posting} onChange={(e) => setSp({ ...(e.target.value ? { posting: e.target.value } : {}), ...(statusF ? { status: statusF } : {}) })}>
          <option value="">{t('كل المنشورات')}</option>
          {mine?.map((p) => <option key={p.id} value={p.id}><Tr>{p.title}</Tr> ({p.applicants})</option>)}
        </select>
      </div>
      {statusF && <div className="mb-3"><button type="button" className="chip chip-w" onClick={() => setSp(posting ? { posting } : {})} aria-label={t('إلغاء التصفية')}>{t('قيد المراجعة فقط')} <X size={12} /></button></div>}
      {loading ? <Spinner /> : apps?.length ? (
        <div className="grid gap-3">
          {apps.map((a) => (
            <div key={a.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar u={{ id: a.student_id, name: a.student_name, avatar: a.student_avatar }} size={52} />
                <div className="min-w-0 flex-1">
                  <button className="text-lg font-bold text-brand" onClick={() => setView(a.student_id)}>{a.student_name}</button>
                  <div className="text-sm text-mute">{specText(a)} · {t(a.student_status)} {t('· تقدّم على:')} <Tr>{a.title}</Tr></div>
                  <div className="my-2 flex flex-wrap gap-1.5">{a.skills.map((k) => <span key={k.name} className="chip chip-b"><Tr>{k.name}</Tr></span>)}</div>
                  <p className="mb-2 text-sm">«<Tr>{t(a.message)}</Tr>»</p>
                  <div className="flex flex-wrap gap-1.5">{a.projects.map((p) => <span key={p} className="chip"><Paperclip size={12} />{p}</span>)}</div>
                </div>
                <div className="flex flex-col items-stretch gap-2">
                  {a.status === 'pending' ? (
                    <>
                      <button className="btn btn-g" onClick={() => act(a.id, 'accept')}>{t('قبول وبدء المحادثة')}</button>
                      <button className="btn btn-d" onClick={() => act(a.id, 'reject')}>{t('رفض الطلب')}</button>
                    </>
                  ) : (
                    <>
                      <StatusChip status={a.status} />
                      {a.status === 'accepted' && <Link to={`/app/workspace/${a.id}`} className="btn btn-sm">{t('المحادثة')}</Link>}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : <Empty>{t('لا متقدمين حتى الآن.')}</Empty>}
      {view && <ProfileModal id={view} onClose={() => setView(null)} />}
    </div>
  );
}
function ProfileModal({ id, onClose, invite }) {
  const { data, loading } = useFetch(`/people/${id}`);
  return (
    <Modal title={t('ملف المبدع')} onClose={onClose} wide>
      {loading ? <Spinner /> : <><ProfileBody p={data} />{invite && <InviteBox student={data} onDone={onClose} />}</>}
    </Modal>
  );
}
function InviteBox({ student, onDone }) {
  const toast = useToast();
  const { data: mine } = useFetch('/postings/mine');
  const [pid, setPid] = useState('');
  const open = (mine || []).filter((p) => p.status === 'open');
  if (!mine) return null;
  if (!open.length) return <p className="mt-4 text-mute">{t('انشر وظيفة أو مشروعاً أولاً لتتمكن من الدعوة.')}</p>;
  const send = async () => {
    try { await api.post('/invites', { posting_id: Number(pid || open[0].id), student_id: student.id }); toast(t('أُرسلت الدعوة إلى {name}', { name: student.name })); onDone(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-line pt-4">
      <div className="min-w-[200px] flex-1"><label className="lbl" htmlFor="inv-sel">{t('دعوة إلى')}</label><select id="inv-sel" className="inp" value={pid || open[0].id} onChange={(e) => setPid(e.target.value)}>{open.map((p) => <option key={p.id} value={p.id}><Tr>{p.title}</Tr></option>)}</select></div>
      <button className="btn btn-p" onClick={send}><Send size={16} />{t('إرسال الدعوة')}</button>
    </div>
  );
}

/* ---------- Talent ---------- */
export function Talent() {
  const [spec, setSpec] = useState('');
  const { data, loading, error } = useFetch(`/students${spec ? `?spec=${encodeURIComponent(spec)}` : ''}`);
  const [view, setView] = useState(null);
  return (
    <div>
      <PageHeader title={t('تصفح المبدعين')} sub={t('اطّلع على ملفات الطلاب والخريجين وادعُ المناسبين لوظيفتك أو مشروعك.')} />
      <div className="card mb-5 flex items-center gap-3 p-3">
        <select aria-label={t('التخصص')} className="inp !w-auto" value={spec} onChange={(e) => setSpec(e.target.value)}><option value="">{t('كل التخصصات')}</option>{SPECS.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select>
        {data && <span className="chip ms-auto">{data.length} {t('مبدع')}</span>}
      </div>
      {loading ? <Spinner /> : error ? <ErrorBox>{error}</ErrorBox> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => (
            <div key={s.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <Avatar u={s} size={52} />
                <div className="min-w-0"><div className="font-bold">{s.name}</div><div className="text-sm text-mute">{specText(s)} · {t(s.student_status)}</div>{s.works.length > 0 && <div className="flex items-center gap-1"><Stars v={s.avg} size={13} /><span className="text-xs">({s.works.length})</span></div>}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">{s.skills.slice(0, 4).map((k) => <span key={k.id} className="chip chip-b"><Tr>{k.name}</Tr></span>)}</div>
              <div className="flex flex-wrap gap-1.5">{s.badges.slice(0, 2).map((b) => <span key={b} className="chip chip-g">{t(b)}</span>)}</div>
              <button className="btn btn-p mt-auto" onClick={() => setView(s.id)}>{t('عرض الملف والدعوة')}</button>
            </div>
          ))}
        </div>
      )}
      {view && <ProfileModal id={view} invite onClose={() => setView(null)} />}
    </div>
  );
}
