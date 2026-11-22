import { t } from '../i18n/index.js';
import { Tr } from '../translate.jsx';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Briefcase, FolderKanban, Paperclip, PackageCheck, Plus, Trash2, Users, Wallet as WalletIcon, Zap, Pencil, Send, X } from '../icons.jsx';
import { api } from '../api.js';
import { useAuth, useFetch, useToast } from '../context.jsx';
import { Avatar, Banner, BarList, CURRENCIES, Empty, JOB_TYPES, ErrorBox, Field, MapKindHint, Modal, MoneyInput, PageHeader, Spinner, SPECS, StatCard, StatusChip, Stars, fmt, curLabel } from '../ui.jsx';
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
const TEMPLATES = [
  { k: t('منيو مطعم'), title: t('تصميم منيو رقمي'), spec: 'تصميم', pay: 150000, days: 5, reqs: 'Illustrator, Figma', description: t('منيو من 4 صفحات بألوان تناسب هوية المكان.') },
  { k: t('شعار'), title: t('تصميم شعار'), spec: 'تصميم', pay: 100000, days: 4, reqs: 'Illustrator', description: t('ثلاثة مقترحات أولية وتعديلان مجانيان.') },
  { k: t('موقع'), title: t('موقع تعريفي'), spec: 'برمجة', pay: 400000, days: 7, reqs: 'HTML/CSS, JavaScript', description: t('موقع من 3 صفحات متجاوب مع الجوال.') },
  { k: t('نظام كاشير'), title: t('نظام كاشير بسيط'), spec: 'برمجة', pay: 600000, days: 14, reqs: t('SQL, واجهة ويب'), description: t('تسجيل الطلبات والفواتير وتقرير يومي.') },
];
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
  const [f, setF] = useState({ title: '', spec: 'برمجة', pay: '', cur: 'IQD', hours: 6, schedule: '', shift: 'صباحي', type: 'دوام جزئي', address: '', map_url: '', reqs: '', description: '', days: 7 });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (ex) setF({ title: ex.title, spec: ex.spec, pay: ex.pay, cur: ex.cur, hours: ex.hours || 6, schedule: ex.schedule || '', shift: ex.shift || 'صباحي', type: ex.type || 'دوام جزئي', address: ex.address || '', map_url: ex.map_url || '', reqs: ex.reqs.join(', '), description: ex.description, days: ex.days || 7 });
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
        {!isJob && !id && (
          <div className="mb-4">
            <div className="lbl">{t('قوالب جاهزة بضغطة')}</div>
            <div className="flex flex-wrap gap-2">{TEMPLATES.map((tp) => <button type="button" key={tp.k} className="btn" onClick={() => setF((x) => ({ ...x, ...tp }))}><Zap size={14} />{tp.k}</button>)}</div>
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
                  <div className="text-sm text-mute">{t(a.spec)} · {t(a.student_status)} {t('· تقدّم على:')} <Tr>{a.title}</Tr></div>
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
                <div className="min-w-0"><div className="font-bold">{s.name}</div><div className="text-sm text-mute">{t(s.spec)} · {t(s.student_status)}</div>{s.works.length > 0 && <div className="flex items-center gap-1"><Stars v={s.avg} size={13} /><span className="text-xs">({s.works.length})</span></div>}</div>
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
