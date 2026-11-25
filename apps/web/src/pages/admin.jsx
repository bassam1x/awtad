import { isRtl, t } from '../i18n/index.js';
import { Tr } from '../translate.jsx';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Ban, Save, Briefcase, CheckCircle2, ClipboardList, Mail, Search, ShieldCheck, Trash2, Users, Wallet as WalletIcon, Building2, GraduationCap } from '../icons.jsx';
import { api } from '../api.js';
import { useAuth, useFetch, useToast } from '../context.jsx';
import { Avatar, Banner, BarList, Empty, ErrorBox, PageHeader, Spinner, StatCard, dateAr, fmt , curLabel } from '../ui.jsx';

const ROLE = { student: t('مبدع'), company: t('شركة'), admin: t('مدير') };

export function AdminDashboard() {
  const { data: s, loading, error } = useFetch('/stats');
  const { data: ch } = useFetch('/admin/charts');
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  return (
    <div>
      <Banner title={t('لوحة الإدارة')} sub={t('نظرة عامة على نشاط المنصة وجودة المحتوى.')} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={GraduationCap} label={t('مبدعون مسجلون')} value={s.students} to="/app/users?role=student" />
        <StatCard icon={Building2} label={t('شركات مسجلة')} value={s.companies} tone="g" to="/app/users?role=company" />
        <StatCard icon={Briefcase} label={t('فرص منشورة')} value={s.postings} to="/app/all-postings" hint={<div className="text-xs text-mute">{s.openPostings} {t('مفتوحة')}</div>} />
        <StatCard icon={ClipboardList} label={t('طلبات تقديم')} value={s.applications} tone="w" to="/app/all-applications" hint={<div className="text-xs text-mute">{s.accepted} {t('مقبولة')}</div>} />
      </div>
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="card bg-goodsoft p-5"><div className="flex items-center gap-2 text-sm text-mute"><WalletIcon size={16} />{t('إجمالي الدفعات المسجّلة للمبدعين')}</div><div className="money mt-1 text-2xl">{s.volume.length ? s.volume.map((v) => `${fmt(v.total)} ${curLabel(v.cur)}`).join(' + ') : '0'}</div></div>
        <div className="card p-5"><div className="flex items-center gap-2 text-sm text-mute"><Ban size={16} />{t('حسابات موقوفة')}</div><div className="mt-1 text-2xl font-bold">{s.banned}</div></div>
      </div>
      {ch && (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <BarList title={t('طلبات التقديم حسب الحالة')} rows={ch.appsByStatus.map((r) => ({ label: { pending: t('قيد المراجعة'), accepted: t('مقبولة'), rejected: t('مرفوضة') }[r.status] || r.status, value: r.c, color: r.status === 'accepted' ? 'bg-good' : r.status === 'rejected' ? 'bg-bad' : 'bg-warn' }))} />
          <BarList title={t('الفرص حسب التخصص')} rows={ch.postingsBySpec.map((r) => ({ label: r.spec, value: r.c }))} />
        </div>
      )}
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">{t('أحدث المسجلين')}</h2><Link to="/app/users" className="text-sm font-semibold text-brand">{t('إدارة المستخدمين')}</Link></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {s.recent.map((u) => (
          <Link key={u.id} to={`/app/users/${u.id}`} className="card flex items-center gap-3 p-3"><Avatar u={u} size={40} square={u.role === 'company'} /><div className="min-w-0 flex-1"><div className="truncate font-semibold">{u.name}</div><div className="text-xs text-mute">{ROLE[u.role]} · {dateAr(u.created_at)}</div></div></Link>
        ))}
      </div>
    </div>
  );
}

export function AdminUsers() {
  const { user: me, impersonate } = useAuth();
  const toast = useToast();
  const enter = async (u) => { try { await impersonate(u.id); } catch (e) { toast(e.message, 'err'); } };
  const [q, setQ] = useState('');
  const [sp] = useSearchParams();
  const [role, setRole] = useState(['student', 'company'].includes(sp.get('role')) ? sp.get('role') : '');
  const [confirm, setConfirm] = useState(null);
  const { data, loading, error, reload } = useFetch(`/admin/users?q=${encodeURIComponent(q)}${role ? `&role=${role}` : ''}`);
  const setStatus = async (u, status) => { try { await api.patch(`/admin/users/${u.id}`, { status }); toast(status === 'banned' ? t('تم إيقاف الحساب') : t('أُعيد تفعيل الحساب')); reload(); } catch (e) { toast(e.message, 'err'); } };
  const del = async (u) => { try { await api.del(`/admin/users/${u.id}`); setConfirm(null); toast(t('حُذف المستخدم')); reload(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div>
      <PageHeader title={t('المستخدمون')} sub={t('ابحث، أوقف، أعد تفعيل، أو احذف الحسابات.')} />
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1"><Search size={16} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-mute" /><input aria-label={t('بحث')} className="inp !pe-9" placeholder={t('بحث بالاسم أو البريد')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select aria-label={t('النوع')} className="inp !w-auto" value={role} onChange={(e) => setRole(e.target.value)}><option value="">{t('كل الأنواع')}</option><option value="student">{t('مبدعون')}</option><option value="company">{t('شركات')}</option><option value="admin">{t('مدراء')}</option></select>
        {data && <span className="chip">{data.length} {t('حساب')}</span>}
      </div>
      {loading ? <Spinner /> : error ? <ErrorBox>{error}</ErrorBox> : data.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-mute"><th className="p-3 text-start">{t('المستخدم')}</th><th className="p-3 text-start">{t('النوع')}</th><th className="p-3 text-start">{t('الحالة')}</th><th className="p-3 text-start">{t('التسجيل')}</th><th className="p-3" /></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="p-3"><div className="flex items-center gap-3"><Avatar u={u} size={36} square={u.role === 'company'} /><div className="min-w-0"><Link to={`/app/users/${u.id}`} className="font-semibold hover:text-brand">{u.name}</Link><div className="text-xs text-mute" dir="ltr" style={{ textAlign: isRtl ? 'right' : 'left' }}>{u.email}</div></div></div></td>
                  <td className="p-3">{ROLE[u.role]}</td>
                  <td className="p-3">{u.status === 'banned' ? <span className="chip chip-r">{t('موقوف')}</span> : <span className="chip chip-g"><CheckCircle2 size={12} />{t('نشط')}</span>}</td>
                  <td className="p-3 text-mute">{dateAr(u.created_at)}</td>
                  <td className="p-3">
                    {u.id !== me.id && (
                      <div className="flex justify-end gap-2">
                        <Link className="btn btn-sm" to={`/app/users/${u.id}`}>{t('الملف')}</Link>
                        {u.status !== 'banned' && <button className="btn btn-sm btn-p" onClick={() => enter(u)}>{t('دخول بالحساب')}</button>}
                        {u.status === 'banned' ? <button className="btn btn-sm" onClick={() => setStatus(u, 'active')}>{t('تفعيل')}</button> : <button className="btn btn-sm" onClick={() => setStatus(u, 'banned')}><Ban size={13} />{t('إيقاف')}</button>}
                        {confirm === u.id ? <button className="btn btn-d btn-sm" onClick={() => del(u)}>{t('تأكيد الحذف')}</button> : <button className="btn btn-d btn-sm" aria-label={t('حذف')} data-tip={t('حذف')} onClick={() => setConfirm(u.id)}><Trash2 size={13} /></button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>{t('لا نتائج.')}</Empty>}
    </div>
  );
}

export function AdminPostings() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/admin/postings');
  const del = async (id) => { try { await api.del(`/postings/${id}`); toast(t('أُزيل المنشور')); reload(); } catch (e) { toast(e.message, 'err'); } };
  const toggle = async (p) => { try { await api.patch(`/postings/${p.id}`, { status: p.status === 'open' ? 'closed' : 'open' }); reload(); } catch (e) { toast(e.message, 'err'); } };
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  return (
    <div>
      <PageHeader title={t('الفرص المنشورة')} sub={t('راجع كل الوظائف والمشاريع، وأغلق أو احذف المخالف منها.')} />
      {data.length ? (
        <div className="grid gap-3">
          {data.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center gap-3 p-4">
              <span className={`chip ${p.kind === 'job' ? 'chip-b' : 'chip-g'}`}>{p.kind === 'job' ? t('وظيفة') : t('مشروع')}</span>
              <div className="min-w-0 flex-1"><Link to={`/app/opportunity/${p.id}`} className="font-bold hover:text-brand"><Tr>{p.title}</Tr></Link><div className="text-sm text-mute"><Tr>{p.company.name}</Tr> · <span className="money">{fmt(p.pay)} {curLabel(p.cur)}</span> · {p.applicants} {t('متقدم')}</div></div>
              {p.status === 'closed' && <span className="chip chip-r">{t('مغلق')}</span>}
              <button className="btn btn-sm" onClick={() => toggle(p)}>{p.status === 'open' ? t('إغلاق') : t('فتح')}</button>
              <button className="btn btn-d btn-sm" aria-label={t('حذف')} data-tip={t('حذف')} onClick={() => del(p.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      ) : <Empty>{t('لا منشورات.')}</Empty>}
    </div>
  );
}

export function AdminTransactions() {
  const { data, loading, error } = useFetch('/admin/transactions');
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  return (
    <div>
      <PageHeader title={t('التعاملات المالية')} sub={t('كل الدفعات التي أكّدت الشركات دفعها للمبدعين.')} />
      {data.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-mute"><th className="p-3 text-start">{t('المبدع')}</th><th className="p-3 text-start">{t('المشروع')}</th><th className="p-3 text-start">{t('التاريخ')}</th><th className="p-3 text-start">{t('المبلغ')}</th></tr></thead>
            <tbody>{data.map((x) => <tr key={x.id} className="border-b border-line last:border-0"><td className="p-3">{x.user_name}</td><td className="p-3"><Tr>{x.title}</Tr></td><td className="p-3 text-mute">{dateAr(x.created_at)}</td><td className="money p-3">{fmt(x.amount)} {curLabel(x.cur)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <Empty>{t('لا عمليات بعد.')}</Empty>}
    </div>
  );
}

export function AdminApplications() {
  const { data, loading, error } = useFetch('/applications');
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  const st = { pending: [t('قيد المراجعة'), 'chip-w'], accepted: [t('مقبول'), 'chip-g'], rejected: [t('مرفوض'), 'chip-r'] };
  return (
    <div>
      <PageHeader title={t('طلبات التقديم')} sub={t('كل الطلبات على المنصة بين المبدعين والشركات.')} />
      {data.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-mute"><th className="p-3 text-start">{t('المبدع')}</th><th className="p-3 text-start">{t('الفرصة')}</th><th className="p-3 text-start">{t('الشركة')}</th><th className="p-3 text-start">{t('الحالة')}</th><th className="p-3 text-start">{t('التاريخ')}</th></tr></thead>
            <tbody>{data.map((a) => <tr key={a.id} className="border-b border-line last:border-0"><td className="p-3">{a.student_name}</td><td className="p-3"><Link className="hover:text-brand" to={`/app/opportunity/${a.posting_id}`}><Tr>{a.title}</Tr></Link></td><td className="p-3"><Tr>{a.company_name}</Tr></td><td className="p-3"><span className={`chip ${st[a.status][1]}`}>{st[a.status][0]}</span></td><td className="p-3 text-mute">{dateAr(a.created_at)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <Empty>{t('لا طلبات بعد.')}</Empty>}
    </div>
  );
}

export function AdminSettings() {
  const toast = useToast();
  const { data, loading } = useFetch('/admin/settings');
  const [google, setGoogle] = useState(null);
  const [sup, setSup] = useState(null); // { email, instagram } قيد التعديل
  if (loading) return <Spinner />;
  const googleOn = google ?? data.googleSignIn;
  const supVal = sup ?? { email: data.supportEmail || '', instagram: data.supportInstagram || '' };
  const toggleGoogle = async () => {
    try { const r = await api.put('/admin/settings', { googleSignIn: !googleOn }); setGoogle(r.googleSignIn); toast(r.googleSignIn ? t('فُعّل تسجيل الدخول عبر Google') : t('عُطّل تسجيل الدخول عبر Google')); } catch (err) { toast(err.message, 'err'); }
  };
  const saveSupport = async (e) => {
    e.preventDefault();
    try { const r = await api.put('/admin/settings', { supportEmail: supVal.email, supportInstagram: supVal.instagram }); setSup({ email: r.supportEmail, instagram: r.supportInstagram }); toast(t('تم حفظ قنوات الدعم')); } catch (err) { toast(err.message, 'err'); }
  };
  return (
    <div>
      <PageHeader title={t('إعدادات المنصة')} sub={t('تسجيل الدخول عبر Google وقنوات الدعم والتواصل.')} />
      <form onSubmit={saveSupport} className="card mb-5 max-w-2xl p-5">
        <h2 className="mb-1 font-bold">{t('قنوات الدعم والتواصل')}</h2>
        <p className="mb-4 text-sm text-mute">{t('تظهر في صفحة الدعم الفني لكل المستخدمين، ويصلك إشعار على بريد الدعم عند كل رسالة جديدة. اتركها فارغة لإخفائها.')}</p>
        <label className="lbl" htmlFor="sup-email">{t('بريد الدعم')}</label>
        <input id="sup-email" type="email" dir="ltr" className="inp mb-3 text-left" placeholder="support@example.com" maxLength={120} value={supVal.email} onChange={(e) => setSup({ ...supVal, email: e.target.value })} />
        <label className="lbl" htmlFor="sup-ig">{t('حساب إنستغرام')}</label>
        <input id="sup-ig" dir="ltr" className="inp mb-4 text-left" placeholder="awtad.iq" maxLength={120} value={supVal.instagram} onChange={(e) => setSup({ ...supVal, instagram: e.target.value })} />
        <p className="mb-4 text-xs text-mute">{t('للإنستغرام اكتب اسم الحساب فقط (مثل awtad.iq) أو الصق رابطه.')}</p>
        <button className="btn btn-p"><Save size={16} />{t('حفظ')}</button>
      </form>
      <div className="card max-w-2xl p-5">
        <h2 className="mb-1 font-bold">{t('تسجيل الدخول عبر Google')}</h2>
        <p className="mb-4 text-sm text-mute">{t('يعمل عبر Firebase Authentication. عند تعطيله يختفي زر Google من صفحتي الدخول وإنشاء الحساب.')}</p>
        {data.googleConfigured ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className={`chip ${googleOn ? 'chip-g' : ''}`}>{googleOn ? t('مفعّل') : t('معطّل')}</span>
            <button type="button" className={`btn ${googleOn ? '' : 'btn-p'}`} onClick={toggleGoogle}>{googleOn ? t('تعطيل') : t('تفعيل')}</button>
          </div>
        ) : <p className="text-sm text-mute">{t('مفاتيح Firebase غير مضبوطة على الخادم.')}</p>}
      </div>
    </div>
  );
}

const TOPIC_LABEL = { technical: 'مشكلة تقنية', account: 'حسابي', payment: 'المبالغ والمحفظة', suggestion: 'اقتراح', report: 'بلاغ عن مخالفة', other: 'أخرى' };

/** وارد رسائل الدعم الفني: المفتوحة أولاً، ويمكن إغلاقها أو حذفها. نص الرسالة يُعرض كنص عادي (React يهرّب أي وسوم). */
export function AdminSupport() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/admin/support');
  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  const act = async (fn) => { try { await fn(); await reload?.(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div>
      <PageHeader title={t('رسائل الدعم')} sub={t('رسائل الزوار والمستخدمين من صفحة الدعم الفني.')} />
      {!data.length ? <Empty>{t('لا توجد رسائل دعم بعد.')}</Empty> : (
        <div className="grid gap-3">
          {data.map((m) => (
            <article key={m.id} className={`card p-4 ${m.status === 'open' ? '' : 'opacity-70'}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-bold">{m.name}</span>
                <a className="text-sm text-brand hover:underline" dir="ltr" href={`mailto:${m.email}`}>{m.email}</a>
                {m.user_id && <Link className="chip" to={`/app/people/${m.user_id}`}>{t('مسجّل')}</Link>}
                <span className="chip chip-b">{t(TOPIC_LABEL[m.topic] || 'أخرى')}</span>
                <span className={`chip ${m.status === 'open' ? 'chip-w' : 'chip-g'}`}>{m.status === 'open' ? t('مفتوحة') : t('مغلقة')}</span>
                <span className="ms-auto text-xs text-mute">#{m.id} · {dateAr(m.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words">{m.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="btn btn-sm" href={`mailto:${m.email}`}><Mail size={14} />{t('رد بالبريد')}</a>
                <button className="btn btn-sm" onClick={() => act(() => api.patch(`/admin/support/${m.id}`, { status: m.status === 'open' ? 'closed' : 'open' }))}>{m.status === 'open' ? t('إغلاق') : t('إعادة فتح')}</button>
                <button className="btn btn-sm btn-d" onClick={() => { if (window.confirm(t('حذف هذه الرسالة نهائياً؟'))) act(() => api.del(`/admin/support/${m.id}`)); }}><Trash2 size={14} />{t('حذف')}</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const APP_ST = { pending: ['قيد المراجعة', 'chip-w'], accepted: ['مقبول', 'chip-g'], rejected: ['مرفوض', 'chip-r'] };
const Row = ({ k, children }) => (children === '' || children == null ? null : <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-2 last:border-0"><span className="text-sm text-mute">{k}</span><span className="min-w-0 break-words text-end font-semibold">{children}</span></div>);

/** ملف كامل لأي حساب للمدير: التفاصيل الخاصة، المنشورات أو الطلبات، المالية، مع الإيقاف والحذف. */
export function AdminUserDetail() {
  const { id } = useParams();
  const { user: me, impersonate } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const enter = async () => { try { await impersonate(id); } catch (e) { toast(e.message, 'err'); } };
  const { data: u, loading, error, reload } = useFetch(`/admin/users/${id}`);
  const [confirm, setConfirm] = useState(false);
  if (loading) return <Spinner />;
  if (error || !u) return <ErrorBox>{error || t('غير موجود')}</ErrorBox>;
  const isS = u.role === 'student', isC = u.role === 'company', mine = u.id === me.id;
  const setStatus = async (status) => { try { await api.patch(`/admin/users/${u.id}`, { status }); toast(status === 'banned' ? t('تم إيقاف الحساب') : t('أُعيد تفعيل الحساب')); reload(); } catch (e) { toast(e.message, 'err'); } };
  const del = async () => { try { await api.del(`/admin/users/${u.id}`); toast(t('حُذف المستخدم')); nav('/app/users', { replace: true }); } catch (e) { toast(e.message, 'err'); } };
  const methods = [u.has_password && t('كلمة مرور'), u.has_google && 'Google', u.has_linkedin && 'LinkedIn'].filter(Boolean).join(' · ');
  return (
    <div>
      <PageHeader title={u.name} sub={`${ROLE[u.role]} · ${t('انضم')} ${dateAr(u.created_at)}`} />
      <div className="card mb-5 flex flex-wrap items-center gap-4 p-4">
        <Avatar u={u} size={64} square={isC} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{u.name}</span>
            {u.status === 'banned' ? <span className="chip chip-r">{t('موقوف')}</span> : <span className="chip chip-g"><CheckCircle2 size={12} />{t('نشط')}</span>}
            <span className="chip">{ROLE[u.role]}</span>
          </div>
          <div className="text-sm text-mute" dir="ltr" style={{ textAlign: isRtl ? 'right' : 'left' }}>{u.email}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {u.role !== 'admin' && u.status !== 'banned' && <button className="btn btn-sm btn-p" onClick={enter}>{t('دخول بالحساب')}</button>}
          {u.role !== 'admin' && <Link className="btn btn-sm" to={`/app/people/${u.id}`}>{t('الملف العام')}</Link>}
          {!mine && (u.status === 'banned' ? <button className="btn btn-sm" onClick={() => setStatus('active')}>{t('تفعيل')}</button> : <button className="btn btn-sm" onClick={() => setStatus('banned')}><Ban size={13} />{t('إيقاف')}</button>)}
          {!mine && (confirm ? <button className="btn btn-d btn-sm" onClick={del}>{t('تأكيد الحذف')}</button> : <button className="btn btn-d btn-sm" onClick={() => setConfirm(true)}><Trash2 size={13} />{t('حذف')}</button>)}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-2 font-bold">{t('بيانات الحساب')}</h2>
          <Row k={t('البريد الإلكتروني')}><span dir="ltr">{u.email}</span></Row>
          <Row k={t('رقم الهاتف')}>{u.phone ? <span dir="ltr">{u.phone}</span> : ''}</Row>
          <Row k={t('طرق الدخول')}>{methods}</Row>
          <Row k={t('البريد موثّق')}>{u.email_verified ? t('نعم') : t('لا')}</Row>
          <Row k={t('تاريخ التسجيل')}>{dateAr(u.created_at)}</Row>
          <Row k={t('رقم الحساب')}><span dir="ltr">#{u.id}</span></Row>
        </section>

        {isS && (
          <section className="card p-5">
            <h2 className="mb-2 font-bold">{t('الملف المهني')}</h2>
            <Row k={t('التخصص')}>{u.spec === 'أخرى' && u.spec_other ? u.spec_other : t(u.spec)}</Row>
            <Row k={t('الحالة')}>{t(u.student_status)}</Row>
            <Row k={t('التقييم')}>{u.works?.length ? `${(Number(u.avg) || 0).toFixed(1)} (${u.works.length})` : ''}</Row>
            {u.bio && <p className="mt-3 whitespace-pre-wrap text-sm text-mute"><Tr>{u.bio}</Tr></p>}
            {u.skills?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{u.skills.map((s) => <span key={s.id} className="chip">{s.name}</span>)}</div>}
            {u.portfolio?.length > 0 && <div className="mt-3 grid gap-1 text-sm">{u.portfolio.map((p) => <a key={p.id} className="truncate text-brand hover:underline" href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a>)}</div>}
          </section>
        )}

        {isC && (
          <section className="card p-5">
            <h2 className="mb-2 font-bold">{t('ملف الشركة')}</h2>
            <Row k={t('قطاع العمل')}>{u.sector}</Row>
            <Row k={t('المدينة')}>{u.city}</Row>
            <Row k={t('العنوان')}>{u.address}</Row>
            <Row k={t('بريد التواصل')}>{u.contact_email ? <span dir="ltr">{u.contact_email}</span> : ''}</Row>
            {u.map_url && <Row k={t('الموقع على الخريطة')}><a className="text-brand hover:underline" href={u.map_url} target="_blank" rel="noopener noreferrer">{t('فتح')}</a></Row>}
            {u.about && <p className="mt-3 whitespace-pre-wrap text-sm text-mute"><Tr>{u.about}</Tr></p>}
          </section>
        )}
      </div>

      {isS && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-2 font-bold">{t('طلبات التقديم')} ({u.applications.length})</h2>
            {u.applications.length ? u.applications.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-0">
                <Link className="min-w-0 hover:text-brand" to={`/app/opportunity/${a.posting_id}`}><span className="font-semibold"><Tr>{a.title}</Tr></span><span className="block text-xs text-mute"><Tr>{a.company_name}</Tr> · {dateAr(a.created_at)}</span></Link>
                <span className={`chip ${(APP_ST[a.status] || APP_ST.pending)[1]}`}>{t((APP_ST[a.status] || APP_ST.pending)[0])}</span>
              </div>
            )) : <p className="text-sm text-mute">{t('لا توجد طلبات.')}</p>}
          </section>
          <section className="card p-5">
            <h2 className="mb-2 font-bold">{t('المحفظة')}</h2>
            {u.wallet?.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{u.wallet.map((w) => <span key={w.cur} className="chip chip-g money">{fmt(w.total)} {curLabel(w.cur)}</span>)}</div>}
            {u.transactions.length ? u.transactions.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-2 border-b border-line py-2 text-sm last:border-0"><span className="min-w-0"><Tr>{x.title}</Tr><span className="block text-xs text-mute">{dateAr(x.created_at)}</span></span><span className="money font-semibold">{fmt(x.amount)} {curLabel(x.cur)}</span></div>
            )) : <p className="text-sm text-mute">{t('لا توجد حركات مالية.')}</p>}
          </section>
        </div>
      )}

      {isC && (
        <section className="card mt-5 p-5">
          <h2 className="mb-2 font-bold">{t('الفرص المنشورة')} ({u.postings.length})</h2>
          {u.postings.length ? u.postings.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-0">
              <Link className="min-w-0 hover:text-brand" to={`/app/opportunity/${p.id}`}><span className="font-semibold"><Tr>{p.title}</Tr></span><span className="block text-xs text-mute">{p.kind === 'job' ? t('وظيفة') : t('مشروع')} · {fmt(p.pay)} {curLabel(p.cur)} · {dateAr(p.created_at)}</span></Link>
              <span className="flex items-center gap-2"><span className="chip">{p.applicants} {t('متقدم')}</span><span className={`chip ${p.status === 'open' ? 'chip-g' : ''}`}>{p.status === 'open' ? t('مفتوحة') : t('مغلقة')}</span></span>
            </div>
          )) : <p className="text-sm text-mute">{t('لم ينشر أي فرصة بعد.')}</p>}
        </section>
      )}
    </div>
  );
}

