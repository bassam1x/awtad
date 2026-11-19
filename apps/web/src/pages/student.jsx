import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Briefcase, CheckCircle2, ClipboardList, Mail, Plus, SlidersHorizontal, Sprout, Star, Trash2, Wallet as WalletIcon, X } from 'lucide-react';
import { api } from '../api.js';
import { useAuth, useFetch, useToast } from '../context.jsx';
import { Avatar, Banner, Empty, ErrorBox, Field, PageHeader, Spinner, SPECS, StatCard, StatusChip, fmt, dateAr, postingChips } from '../ui.jsx';
import { ProfileBody } from './PublicProfile.jsx';

function PostingCard({ p }) {
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <Avatar u={p.company} size={44} square />
        <div className="min-w-0"><div className="font-bold leading-snug">{p.title}</div><div className="text-sm text-mute">{p.company.name} · {p.company.city}</div></div>
      </div>
      <div className="money text-lg">{fmt(p.pay)} {p.cur}<span className="text-sm font-medium text-mute">{p.kind === 'job' ? ' / شهرياً' : ' / للمشروع'}</span></div>
      <div className="flex flex-wrap gap-1.5"><span className="chip chip-b">{p.spec}</span>{postingChips(p).map((t) => <span key={t} className="chip">{t}</span>)}</div>
      <div className="mt-auto flex items-center justify-between pt-1">
        {p.my_status ? <StatusChip status={p.my_status} /> : <span className="chip chip-g"><Sprout size={13} />مناسب للخريجين الجدد</span>}
        <Link to={`/app/opportunity/${p.id}`} className="btn btn-p">التفاصيل</Link>
      </div>
    </div>
  );
}

/* ---------- Dashboard ---------- */
export function StudentDashboard() {
  const { user } = useAuth();
  const { data: s, loading, error } = useFetch('/stats');
  const { data: jobs } = useFetch('/postings?kind=job');
  const { data: projects } = useFetch('/postings?kind=project');
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  const bal = s.wallet?.length ? s.wallet.map((w) => `${fmt(w.total)} ${w.cur}`).join(' + ') : '0';
  return (
    <div>
      <Banner title={`أهلاً ${user.name.split(' ')[0]}`} sub="هذا ملخص نشاطك على المنصة. مهاراتك وأعمالك هي ما يراه أصحاب العمل.">
        <Link to="/app/jobs" className="btn border-white/0 bg-white text-slate-900 hover:bg-white/90">تصفح الوظائف</Link>
        <Link to="/app/portfolio" className="btn border-white/40 bg-white/15 text-white hover:bg-white/25">حدّث ملفي المهني</Link>
      </Banner>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ClipboardList} label="طلبات قيد المراجعة" value={s.pending} tone="w" />
        <StatCard icon={CheckCircle2} label="طلبات مقبولة" value={s.accepted} tone="g" />
        <StatCard icon={Mail} label="دعوات جديدة" value={s.invites} />
        <StatCard icon={Star} label="متوسط التقييم" value={s.works ? s.avg : '—'} tone="w" hint={<div className="text-xs text-mute">{s.works} أعمال منجزة</div>} />
      </div>
      <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><Award size={18} />شاراتك</h2>
          <div className="flex flex-wrap gap-2">{s.badges.map((b) => <span key={b} className="chip chip-g">{b}</span>)}{!s.badges.length && <span className="text-mute">أنجز أول مشروع لتحصل على شارتك الأولى.</span>}</div>
        </div>
        <div className="card bg-goodsoft p-5"><div className="flex items-center gap-2 text-sm text-mute"><WalletIcon size={16} />رصيد المحفظة</div><div className="money mt-1 text-2xl">{bal}</div><Link to="/app/wallet" className="mt-2 inline-block text-sm font-semibold text-brand">عرض التفاصيل</Link></div>
      </div>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">وظائف جديدة</h2><Link to="/app/jobs" className="text-sm font-semibold text-brand">عرض الكل</Link></div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{jobs?.slice(0, 3).map((p) => <PostingCard key={p.id} p={p} />)}</div>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">مشاريع للتعاون</h2><Link to="/app/projects" className="text-sm font-semibold text-brand">عرض الكل</Link></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects?.slice(0, 3).map((p) => <PostingCard key={p.id} p={p} />)}</div>
    </div>
  );
}

/* ---------- Browse jobs / projects ---------- */
export function Browse({ kind }) {
  const [f, setF] = useState({ spec: '', type: '', shift: '', min: 0 });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const qs = new URLSearchParams({ kind, ...(f.spec && { spec: f.spec }), ...(f.type && { type: f.type }), ...(f.shift && { shift: f.shift }), ...(f.min && { min: f.min }) });
  const { data, loading, error } = useFetch(`/postings?${qs}`);
  const mins = kind === 'job' ? [[0, 'أي راتب'], [800000, 'من 800 ألف'], [1000000, 'من مليون'], [1500000, 'من 1.5 مليون']] : [[0, 'أي مبلغ'], [100000, 'من 100 ألف'], [300000, 'من 300 ألف'], [500000, 'من 500 ألف']];
  return (
    <div>
      <PageHeader title={kind === 'job' ? 'الوظائف الشاغرة' : 'المشاريع والتعاونات'} sub={kind === 'job' ? 'وظائف برواتب وأوقات وعناوين واضحة، بلا شرط سنوات خبرة.' : 'مشاريع بمبالغ واضحة، تُحوَّل لمحفظتك عند اعتماد التسليم.'} />
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-3">
        <span className="flex items-center gap-2 font-semibold"><SlidersHorizontal size={16} />فلاتر</span>
        <select aria-label="التخصص" className="inp !w-auto" value={f.spec} onChange={(e) => set('spec', e.target.value)}><option value="">كل التخصصات</option>{SPECS.map((s) => <option key={s}>{s}</option>)}</select>
        {kind === 'job' && (
          <>
            <select aria-label="نوع الدوام" className="inp !w-auto" value={f.type} onChange={(e) => set('type', e.target.value)}><option value="">كل أنواع الدوام</option><option>دوام كامل</option><option>دوام جزئي</option></select>
            <select aria-label="الفترة" className="inp !w-auto" value={f.shift} onChange={(e) => set('shift', e.target.value)}><option value="">صباحي ومسائي</option><option>صباحي</option><option>مسائي</option></select>
          </>
        )}
        <select aria-label="الحد الأدنى" className="inp !w-auto" value={f.min} onChange={(e) => set('min', +e.target.value)}>{mins.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {data && <span className="chip mr-auto">{data.length} نتيجة</span>}
      </div>
      {loading ? <Spinner /> : error ? <ErrorBox>{error}</ErrorBox> : data.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.map((p) => <PostingCard key={p.id} p={p} />)}</div> : <Empty>لا توجد نتائج مطابقة، جرّب تغيير الفلاتر.</Empty>}
    </div>
  );
}

/* ---------- Applications + invites ---------- */
export function Applications() {
  const toast = useToast();
  const { data: apps, loading, reload } = useFetch('/applications');
  const { data: inv, reload: reloadInv } = useFetch('/invites');
  const accept = async (id) => { try { await api.post(`/invites/${id}/accept`); toast('تم قبول الدعوة'); reload(); reloadInv(); } catch (e) { toast(e.message, 'err'); } };
  if (loading) return <Spinner />;
  return (
    <div>
      <PageHeader title="طلباتي ودعواتي" sub="تابع حالة طلبات التقديم والدعوات القادمة من الشركات." />
      {inv?.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><Mail size={18} />دعوات من الشركات</h2>
          <div className="grid gap-3">
            {inv.map((i) => (
              <div key={i.id} className="card flex flex-wrap items-center gap-3 p-4">
                <Avatar u={{ id: i.id, name: i.company_name, avatar: i.company_avatar }} size={40} square />
                <div className="min-w-0 flex-1"><div className="font-semibold">{i.company_name} تدعوك إلى: {i.title}</div><div className="money">{fmt(i.pay)} {i.cur}</div></div>
                <Link className="btn" to={`/app/opportunity/${i.posting_id}`}>التفاصيل</Link>
                <button className="btn btn-g" onClick={() => accept(i.id)}>قبول الدعوة</button>
              </div>
            ))}
          </div>
        </section>
      )}
      <h2 className="mb-3 font-bold">طلبات التقديم</h2>
      {apps.length ? (
        <div className="grid gap-3">
          {apps.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center gap-3 p-4">
              <Avatar u={{ id: a.company_id, name: a.company_name, avatar: a.company_avatar }} size={44} square />
              <div className="min-w-0 flex-1"><div className="font-semibold">{a.title}</div><div className="text-sm text-mute">{a.company_name} · {a.kind === 'job' ? 'وظيفة' : 'مشروع'} · {dateAr(a.created_at)}</div></div>
              <StatusChip status={a.status} />
              <Link className="btn" to={`/app/opportunity/${a.posting_id}`}>عرض</Link>
              {a.status === 'accepted' && <Link className="btn btn-g" to={`/app/workspace/${a.id}`}>المحادثة</Link>}
            </div>
          ))}
        </div>
      ) : <Empty>لم تقدّم على أي فرصة بعد. تصفح <Link className="font-semibold text-brand" to="/app/jobs">الوظائف</Link> أو <Link className="font-semibold text-brand" to="/app/projects">المشاريع</Link>.</Empty>}
    </div>
  );
}

/* ---------- Wallet ---------- */
export function Wallet() {
  const { data, loading } = useFetch('/wallet');
  if (loading) return <Spinner />;
  return (
    <div>
      <PageHeader title="المحفظة" sub="أرباحك من المشاريع المعتمدة." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {data.balances.length ? data.balances.map((b) => (
          <div key={b.cur} className="card bg-goodsoft p-5"><div className="text-sm text-mute">الرصيد ({b.cur})</div><div className="money text-3xl">{fmt(b.total)}</div></div>
        )) : <div className="card bg-goodsoft p-5"><div className="text-sm text-mute">الرصيد</div><div className="money text-3xl">0</div></div>}
      </div>
      <h2 className="mb-3 font-bold">سجل العمليات</h2>
      {data.tx.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-mute"><th className="p-3 text-start">المشروع</th><th className="p-3 text-start">التاريخ</th><th className="p-3 text-start">المبلغ</th></tr></thead>
            <tbody>{data.tx.map((t) => <tr key={t.id} className="border-b border-line last:border-0"><td className="p-3">{t.title}</td><td className="p-3 text-mute">{dateAr(t.created_at)}</td><td className="money p-3">+{fmt(t.amount)} {t.cur}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <Empty>لا عمليات بعد. تظهر هنا أرباحك عند اعتماد أول مشروع.</Empty>}
    </div>
  );
}

/* ---------- Portfolio (skills + external projects + public preview) ---------- */
export function Portfolio() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [sk, setSk] = useState({ name: '', level: 'مبتدئ' });
  const [pf, setPf] = useState({ title: '', url: '' });
  const act = async (fn) => { try { setUser(await fn()); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div>
      <PageHeader title="ملفي المهني" sub="هذا ما تراه الشركات عنك. أضف مهاراتك ومشاريعك." />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="grid h-fit gap-5">
          <div className="card p-5">
            <h2 className="mb-3 font-bold">المهارات</h2>
            <div className="mb-4 flex flex-wrap gap-2">
              {user.skills.map((k) => <span key={k.id} className="chip chip-b">{k.name} · {k.level}<button aria-label="حذف" onClick={() => act(() => api.del(`/me/skills/${k.id}`))}><X size={12} /></button></span>)}
              {!user.skills.length && <span className="text-sm text-mute">لا مهارات بعد.</span>}
            </div>
            <div className="flex gap-2">
              <input id="sk-name" className="inp" placeholder="اسم المهارة" value={sk.name} onChange={(e) => setSk({ ...sk, name: e.target.value })} />
              <select aria-label="مستوى الإتقان" className="inp !w-32" value={sk.level} onChange={(e) => setSk({ ...sk, level: e.target.value })}><option>مبتدئ</option><option>جيد</option><option>جيد جداً</option><option>متقدم</option></select>
              <button className="btn btn-p" aria-label="إضافة" onClick={() => { if (!sk.name.trim()) return; act(() => api.post('/me/skills', sk)); setSk({ name: '', level: 'مبتدئ' }); }}><Plus size={16} /></button>
            </div>
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-bold">مشاريع خارجية</h2>
            <div className="mb-4 grid gap-2">
              {user.portfolio.map((x) => <div key={x.id} className="flex items-center justify-between gap-2 rounded-xl border border-line p-2 text-sm"><span className="truncate">{x.title}</span><button className="btn btn-d btn-sm" aria-label="حذف" onClick={() => act(() => api.del(`/me/portfolio/${x.id}`))}><Trash2 size={14} /></button></div>)}
              {!user.portfolio.length && <span className="text-sm text-mute">لا مشاريع خارجية بعد.</span>}
            </div>
            <div className="grid gap-2">
              <input id="pf-title" className="inp" placeholder="عنوان المشروع" value={pf.title} onChange={(e) => setPf({ ...pf, title: e.target.value })} />
              <input id="pf-url" dir="ltr" className="inp text-left" placeholder="https://" value={pf.url} onChange={(e) => setPf({ ...pf, url: e.target.value })} />
              <button className="btn" onClick={() => { if (!pf.title.trim()) return; act(() => api.post('/me/portfolio', pf)); setPf({ title: '', url: '' }); }}><Plus size={16} />إضافة مشروع</button>
            </div>
          </div>
          <p className="text-sm text-mute">لتعديل الاسم والصورة والنبذة ادخل إلى <Link className="font-semibold text-brand" to="/app/profile">إعدادات الحساب</Link>.</p>
        </div>
        <div className="card min-w-0 p-5"><ProfileBody p={user} /></div>
      </div>
    </div>
  );
}
