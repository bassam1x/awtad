import { isRtl, t } from '../i18n/index.js';
import { Tr } from '../translate.jsx';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Ban, Save, Briefcase, CheckCircle2, ClipboardList, Search, ShieldCheck, Trash2, Users, Wallet as WalletIcon, Building2, GraduationCap } from '../icons.jsx';
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
        <div className="card bg-goodsoft p-5"><div className="flex items-center gap-2 text-sm text-mute"><WalletIcon size={16} />{t('إجمالي المبالغ المحوّلة للمبدعين')}</div><div className="money mt-1 text-2xl">{s.volume.length ? s.volume.map((v) => `${fmt(v.total)} ${curLabel(v.cur)}`).join(' + ') : '0'}</div></div>
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
          <div key={u.id} className="card flex items-center gap-3 p-3"><Avatar u={u} size={40} square={u.role === 'company'} /><div className="min-w-0 flex-1"><div className="truncate font-semibold">{u.name}</div><div className="text-xs text-mute">{ROLE[u.role]} · {dateAr(u.created_at)}</div></div></div>
        ))}
      </div>
    </div>
  );
}

export function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
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
                  <td className="p-3"><div className="flex items-center gap-3"><Avatar u={u} size={36} square={u.role === 'company'} /><div className="min-w-0"><div className="font-semibold">{u.name}</div><div className="text-xs text-mute" dir="ltr" style={{ textAlign: isRtl ? 'right' : 'left' }}>{u.email}</div></div></div></td>
                  <td className="p-3">{ROLE[u.role]}</td>
                  <td className="p-3">{u.status === 'banned' ? <span className="chip chip-r">{t('موقوف')}</span> : <span className="chip chip-g"><CheckCircle2 size={12} />{t('نشط')}</span>}</td>
                  <td className="p-3 text-mute">{dateAr(u.created_at)}</td>
                  <td className="p-3">
                    {u.id !== me.id && (
                      <div className="flex justify-end gap-2">
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
      <PageHeader title={t('التعاملات المالية')} sub={t('كل المبالغ المحوّلة إلى محافظ المبدعين.')} />
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
  const [id, setId] = useState(null);
  if (loading) return <Spinner />;
  const val = id ?? data.googleClientId;
  const save = async (e) => {
    e.preventDefault();
    try { await api.put('/admin/settings', { googleClientId: val }); toast(val ? t('فُعّل تسجيل الدخول عبر Google') : t('عُطّل تسجيل الدخول عبر Google')); } catch (err) { toast(err.message, 'err'); }
  };
  return (
    <div>
      <PageHeader title={t('إعدادات المنصة')} sub={t('تفعيل تسجيل الدخول عبر Google للمستخدمين.')} />
      <form onSubmit={save} className="card max-w-2xl p-5">
        <h2 className="mb-1 font-bold">Google Sign-In</h2>
        <p className="mb-4 text-sm text-mute">{t('الصق معرّف العميل (OAuth Client ID) من Google Cloud Console. اتركه فارغاً لتعطيل الخدمة.')}</p>
        <label className="lbl" htmlFor="gid">Client ID</label>
        <input id="gid" dir="ltr" className="inp text-left" placeholder="1234567890-abc.apps.googleusercontent.com" value={val} onChange={(e) => setId(e.target.value)} />
        <ol className="mb-4 mt-4 list-inside list-decimal space-y-1 text-sm text-mute">
          <li>{t('في Google Cloud Console أنشئ OAuth client ID من نوع Web application.')}</li>
          <li>{t('أضف عنوان موقعك (مثل http://localhost:4000) إلى Authorized JavaScript origins.')}</li>
          <li>{t('انسخ المعرّف إلى الحقل أعلاه واضغط حفظ.')}</li>
        </ol>
        <button className="btn btn-p"><Save size={16} />{t('حفظ')}</button>
      </form>
    </div>
  );
}
