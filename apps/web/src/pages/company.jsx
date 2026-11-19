import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Briefcase, FolderKanban, Paperclip, PackageCheck, Plus, Trash2, Users, Wallet as WalletIcon, Zap, Pencil, Send } from 'lucide-react';
import { api } from '../api.js';
import { useAuth, useFetch, useToast } from '../context.jsx';
import { Avatar, Banner, BarList, Empty, ErrorBox, Field, Modal, PageHeader, Spinner, SPECS, StatCard, StatusChip, Stars, fmt } from '../ui.jsx';
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
      <Banner title={`أهلاً ${user.name}`} sub="ملخص التوظيف والمشاريع في شركتك، وما ينتظر قرارك اليوم.">
        <Link to="/app/my-postings/new?kind=job" className="btn border-white/0 bg-white text-slate-900 hover:bg-white/90"><Plus size={16} />وظيفة جديدة</Link>
        <Link to="/app/my-postings/new?kind=project" className="btn border-white/40 bg-white/15 text-white hover:bg-white/25"><Plus size={16} />مشروع جديد</Link>
      </Banner>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Briefcase} label="وظائف منشورة" value={s.jobs} />
        <StatCard icon={FolderKanban} label="مشاريع منشورة" value={s.projects} tone="g" />
        <StatCard icon={Users} label="طلبات بانتظار مراجعتك" value={s.pending} tone="w" hint={<div className="text-xs text-mute">من أصل {s.applicants} متقدم</div>} />
        <StatCard icon={PackageCheck} label="تسليمات بانتظار اعتمادك" value={s.awaiting} tone={s.awaiting ? 'r' : 'g'} />
      </div>
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <BarList title="مسار المتقدمين" rows={[{ label: 'إجمالي المتقدمين', value: s.applicants }, { label: 'بانتظار المراجعة', value: s.pending, color: 'bg-warn' }, { label: 'تسليمات بانتظار الاعتماد', value: s.awaiting, color: 'bg-good' }]} />
        <div className="card bg-goodsoft p-5"><div className="flex items-center gap-2 text-sm text-mute"><WalletIcon size={16} />إجمالي ما دُفع للمبدعين</div><div className="money mt-1 text-2xl">{s.paid.length ? s.paid.map((p) => `${fmt(p.total)} ${p.cur}`).join(' + ') : '0'}</div></div>
      </div>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">أحدث الطلبات المعلّقة</h2><Link to="/app/applicants" className="text-sm font-semibold text-brand">عرض الكل</Link></div>
      {pending.length ? <div className="grid gap-3">{pending.map((a) => (
        <div key={a.id} className="card flex flex-wrap items-center gap-3 p-4">
          <Avatar u={{ id: a.student_id, name: a.student_name, avatar: a.student_avatar }} size={44} />
          <div className="min-w-0 flex-1"><div className="font-semibold">{a.student_name}</div><div className="text-sm text-mute">تقدّم على: {a.title}</div></div>
          <Link className="btn" to={`/app/applicants?posting=${a.posting_id}`}>مراجعة</Link>
        </div>
      ))}</div> : <Empty>لا طلبات معلّقة حالياً.</Empty>}
    </div>
  );
}

/* ---------- Manage postings ---------- */
export function MyPostings() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/postings/mine');
  const del = async (id) => { try { await api.del(`/postings/${id}`); toast('أُزيل المنشور'); reload(); } catch (e) { toast(e.message, 'err'); } };
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  return (
    <div>
      <PageHeader title="الوظائف والمشاريع المنشورة" sub="كل فرصة نشرتها مع عدد المتقدمين.">
        <Link to="/app/my-postings/new?kind=job" className="btn btn-p"><Plus size={16} />وظيفة شاغرة جديدة</Link>
        <Link to="/app/my-postings/new?kind=project" className="btn btn-g"><Plus size={16} />مشروع / تعاون جديد</Link>
      </PageHeader>
      {data.length ? (
        <div className="grid gap-3">
          {data.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center gap-3 p-4">
              <span className={`chip ${p.kind === 'job' ? 'chip-b' : 'chip-g'}`}>{p.kind === 'job' ? 'وظيفة' : 'مشروع'}</span>
              <div className="min-w-0 flex-1">
                <Link to={`/app/opportunity/${p.id}`} className="font-bold hover:text-brand">{p.title}</Link>
                <div className="text-sm text-mute">{p.spec} · <span className="money">{fmt(p.pay)} {p.cur}</span>{p.kind === 'job' ? ` · ${p.shift} · ${p.type}` : ` · ${p.days} أيام`}</div>
              </div>
              {p.status === 'closed' && <span className="chip chip-r">مغلق</span>}
              <span className="chip"><Users size={13} />{p.applicants} متقدم</span>
              {p.pending > 0 && <span className="chip chip-w">{p.pending} جديد</span>}
              <Link className="btn" to={`/app/applicants?posting=${p.id}`}>عرض المتقدمين</Link>
              <Link className="btn" to={`/app/my-postings/${p.id}/edit`} aria-label="تعديل"><Pencil size={16} /></Link>
              <button className="btn btn-d" aria-label="حذف" onClick={() => del(p.id)}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      ) : <Empty>لا منشورات بعد. انشر أول وظيفة أو مشروع.</Empty>}
    </div>
  );
}

/* ---------- New posting form (own page) ---------- */
const TEMPLATES = [
  { k: 'منيو مطعم', title: 'تصميم منيو رقمي', spec: 'تصميم', pay: 150000, days: 5, reqs: 'Illustrator, Figma', description: 'منيو من 4 صفحات بألوان تناسب هوية المكان.' },
  { k: 'شعار', title: 'تصميم شعار', spec: 'تصميم', pay: 100000, days: 4, reqs: 'Illustrator', description: 'ثلاثة مقترحات أولية وتعديلان مجانيان.' },
  { k: 'موقع', title: 'موقع تعريفي', spec: 'برمجة', pay: 400000, days: 7, reqs: 'HTML/CSS, JavaScript', description: 'موقع من 3 صفحات متجاوب مع الجوال.' },
  { k: 'نظام كاشير', title: 'نظام كاشير بسيط', spec: 'برمجة', pay: 600000, days: 14, reqs: 'SQL, واجهة ويب', description: 'تسجيل الطلبات والفواتير وتقرير يومي.' },
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
  const [f, setF] = useState({ title: '', spec: 'برمجة', pay: '', cur: 'د.ع', hours: 6, schedule: '', shift: 'صباحي', type: 'دوام جزئي', address: '', map_url: '', reqs: '', description: '', days: 7 });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (ex) setF({ title: ex.title, spec: ex.spec, pay: ex.pay, cur: ex.cur, hours: ex.hours || 6, schedule: ex.schedule || '', shift: ex.shift || 'صباحي', type: ex.type || 'دوام جزئي', address: ex.address || '', map_url: ex.map_url || '', reqs: ex.reqs.join(', '), description: ex.description, days: ex.days || 7 });
  }, [ex]);  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = id ? await api.put(`/postings/${id}`, f) : await api.post('/postings', { ...f, kind }); toast(id ? 'حُفظت التعديلات' : 'نُشر بنجاح'); nav(`/app/opportunity/${r.id}`); } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  if (id && exLoading) return <Spinner />;
  return (
    <div>
      <PageHeader title={id ? 'تعديل المنشور' : isJob ? 'وظيفة شاغرة جديدة' : 'مشروع / تعاون جديد'} sub={isJob ? 'كل التفاصيل واضحة للمتقدمين: الراتب والأوقات والموقع.' : 'حدّد المبلغ ومدة التسليم، ويُحوَّل المبلغ عند اعتمادك للتسليم.'} />
      <form onSubmit={submit} className="card max-w-3xl p-5">
        {!isJob && !id && (
          <div className="mb-4">
            <div className="lbl">قوالب جاهزة بضغطة</div>
            <div className="flex flex-wrap gap-2">{TEMPLATES.map((t) => <button type="button" key={t.k} className="btn" onClick={() => setF((x) => ({ ...x, ...t }))}><Zap size={14} />{t.k}</button>)}</div>
          </div>
        )}
        <Field label={isJob ? 'المسمى الوظيفي' : 'عنوان المشروع'}><input id="np-title" className="inp" value={f.title} onChange={(e) => set('title', e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
          <Field label={isJob ? 'الراتب الشهري' : 'المبلغ'}><input id="np-pay" type="number" min="1" className="inp" value={f.pay} onChange={(e) => set('pay', e.target.value)} required /></Field>
          <Field label="العملة"><select id="np-cur" className="inp" value={f.cur} onChange={(e) => set('cur', e.target.value)}><option>د.ع</option><option>ر.س</option></select></Field>
          <Field label="التخصص"><select id="np-spec" className="inp" value={f.spec} onChange={(e) => set('spec', e.target.value)}>{SPECS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          {isJob ? (
            <>
              <Field label="ساعات العمل يومياً"><input id="np-hours" type="number" min="1" max="16" className="inp" value={f.hours} onChange={(e) => set('hours', e.target.value)} /></Field>
              <Field label="نوع الدوام"><select id="np-type" className="inp" value={f.type} onChange={(e) => set('type', e.target.value)}><option>دوام كامل</option><option>دوام جزئي</option></select></Field>
              <Field label="الفترة"><select id="np-shift" className="inp" value={f.shift} onChange={(e) => set('shift', e.target.value)}><option>صباحي</option><option>مسائي</option></select></Field>
            </>
          ) : <Field label="مدة التسليم (أيام)"><input id="np-days" type="number" min="1" className="inp" value={f.days} onChange={(e) => set('days', e.target.value)} /></Field>}
        </div>
        {isJob && (
          <>
            <Field label="أوقات العمل"><input id="np-sched" className="inp" value={f.schedule} onChange={(e) => set('schedule', e.target.value)} placeholder="السبت – الخميس، 9 ص إلى 3 م" /></Field>
            <Field label="العنوان النصي" hint="اتركه فارغاً لاستخدام عنوان الشركة من ملفها."><input id="np-addr" className="inp" value={f.address} onChange={(e) => set('address', e.target.value)} placeholder={user.address} /></Field>
            <Field label="رابط Google Maps (اختياري)"><input id="np-map" dir="ltr" className="inp text-left" value={f.map_url} onChange={(e) => set('map_url', e.target.value)} /></Field>
          </>
        )}
        <Field label="المتطلبات: مهارات وأدوات فقط" hint="افصل بينها بفاصلة"><input id="np-reqs" className="inp" value={f.reqs} onChange={(e) => set('reqs', e.target.value)} /></Field>
        <Field label="الوصف"><textarea id="np-desc" rows="3" className="inp" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="flex gap-2"><button className="btn btn-p" disabled={busy}><Send size={16} />{id ? 'حفظ' : 'نشر'}</button><Link to="/app/my-postings" className="btn">إلغاء</Link></div>
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
  const { data: apps, loading, reload } = useFetch(`/applications${posting ? `?posting=${posting}` : ''}`);
  const [view, setView] = useState(null);
  const act = async (id, what) => { try { await api.post(`/applications/${id}/${what}`); toast(what === 'accept' ? 'تم القبول وفتحت المحادثة' : 'رُفض الطلب'); reload(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div>
      <PageHeader title="مراجعة المتقدمين" sub="راجع أعمالهم السابقة بدل سنوات الخبرة، ثم اقبل أو ارفض." />
      <div className="mb-4 max-w-md">
        <label className="lbl" htmlFor="app-sel">المنشور</label>
        <select id="app-sel" className="inp" value={posting} onChange={(e) => setSp(e.target.value ? { posting: e.target.value } : {})}>
          <option value="">كل المنشورات</option>
          {mine?.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.applicants})</option>)}
        </select>
      </div>
      {loading ? <Spinner /> : apps.length ? (
        <div className="grid gap-3">
          {apps.map((a) => (
            <div key={a.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar u={{ id: a.student_id, name: a.student_name, avatar: a.student_avatar }} size={52} />
                <div className="min-w-0 flex-1">
                  <button className="text-lg font-bold text-brand" onClick={() => setView(a.student_id)}>{a.student_name}</button>
                  <div className="text-sm text-mute">{a.spec} · {a.student_status} · تقدّم على: {a.title}</div>
                  <div className="my-2 flex flex-wrap gap-1.5">{a.skills.map((k) => <span key={k.name} className="chip chip-b">{k.name}</span>)}</div>
                  <p className="mb-2 text-sm">«{a.message}»</p>
                  <div className="flex flex-wrap gap-1.5">{a.projects.map((p) => <span key={p} className="chip"><Paperclip size={12} />{p}</span>)}</div>
                </div>
                <div className="flex flex-col items-stretch gap-2">
                  {a.status === 'pending' ? (
                    <>
                      <button className="btn btn-g" onClick={() => act(a.id, 'accept')}>قبول وبدء المحادثة</button>
                      <button className="btn btn-d" onClick={() => act(a.id, 'reject')}>رفض الطلب</button>
                    </>
                  ) : (
                    <>
                      <StatusChip status={a.status} />
                      {a.status === 'accepted' && <Link to={`/app/workspace/${a.id}`} className="btn btn-sm">المحادثة</Link>}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : <Empty>لا متقدمين حتى الآن.</Empty>}
      {view && <ProfileModal id={view} onClose={() => setView(null)} />}
    </div>
  );
}
function ProfileModal({ id, onClose, invite }) {
  const { data, loading } = useFetch(`/people/${id}`);
  return (
    <Modal title="ملف المبدع" onClose={onClose} wide>
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
  if (!open.length) return <p className="mt-4 text-mute">انشر وظيفة أو مشروعاً أولاً لتتمكن من الدعوة.</p>;
  const send = async () => {
    try { await api.post('/invites', { posting_id: Number(pid || open[0].id), student_id: student.id }); toast(`أُرسلت الدعوة إلى ${student.name}`); onDone(); } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-line pt-4">
      <div className="min-w-[200px] flex-1"><label className="lbl" htmlFor="inv-sel">دعوة إلى</label><select id="inv-sel" className="inp" value={pid || open[0].id} onChange={(e) => setPid(e.target.value)}>{open.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
      <button className="btn btn-p" onClick={send}><Send size={16} />إرسال الدعوة</button>
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
      <PageHeader title="تصفح المبدعين" sub="اطّلع على ملفات الطلاب والخريجين وادعُ المناسبين لوظيفتك أو مشروعك." />
      <div className="card mb-5 flex items-center gap-3 p-3">
        <select aria-label="التخصص" className="inp !w-auto" value={spec} onChange={(e) => setSpec(e.target.value)}><option value="">كل التخصصات</option>{SPECS.map((s) => <option key={s}>{s}</option>)}</select>
        {data && <span className="chip mr-auto">{data.length} مبدع</span>}
      </div>
      {loading ? <Spinner /> : error ? <ErrorBox>{error}</ErrorBox> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => (
            <div key={s.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <Avatar u={s} size={52} />
                <div className="min-w-0"><div className="font-bold">{s.name}</div><div className="text-sm text-mute">{s.spec} · {s.student_status}</div>{s.works.length > 0 && <div className="flex items-center gap-1"><Stars v={s.avg} size={13} /><span className="text-xs">({s.works.length})</span></div>}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">{s.skills.slice(0, 4).map((k) => <span key={k.id} className="chip chip-b">{k.name}</span>)}</div>
              <div className="flex flex-wrap gap-1.5">{s.badges.slice(0, 2).map((b) => <span key={b} className="chip chip-g">{b}</span>)}</div>
              <button className="btn btn-p mt-auto" onClick={() => setView(s.id)}>عرض الملف والدعوة</button>
            </div>
          ))}
        </div>
      )}
      {view && <ProfileModal id={view} invite onClose={() => setView(null)} />}
    </div>
  );
}
