import { LANGS, lang, setLang, t } from './i18n/index.js';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, FolderKanban, ClipboardList, MessagesSquare, Wallet, Award, UserCog,
  ListChecks, PlusCircle, Settings, ClipboardCheck, FolderPlus, Users, Search, Building2, ShieldCheck, FileText, Receipt, LogOut, Menu, X, Sun, Moon, Palette,
} from 'lucide-react';
import { useAuth, useFetch, useTheme } from './context.jsx';
import { Avatar, Logo } from './ui.jsx';

const NAV = {
  student: [
    [t('الرئيسية'), [['/app', t('لوحة التحكم'), LayoutDashboard, true]]],
    [t('الفرص'), [['/app/jobs', t('الوظائف الشاغرة'), Briefcase], ['/app/projects', t('المشاريع والتعاونات'), FolderKanban], ['/app/applications', t('طلباتي ودعواتي'), ClipboardList]]],
    [t('العمل'), [['/app/workspace', t('مساحة العمل'), MessagesSquare], ['/app/wallet', t('المحفظة'), Wallet]]],
    [t('حسابي'), [['/app/portfolio', t('ملفي المهني'), Award], ['/app/profile', t('إعدادات الحساب'), UserCog]]],
  ],
  company: [
    [t('الرئيسية'), [['/app', t('لوحة التحكم'), LayoutDashboard, true]]],
    [t('التوظيف'), [['/app/my-postings', t('الوظائف والمشاريع'), ListChecks, true], ['/app/my-postings/new?kind=job', t('نشر وظيفة'), PlusCircle], ['/app/my-postings/new?kind=project', t('نشر مشروع'), FolderPlus], ['/app/applicants', t('مراجعة المتقدمين'), Users]]],
    [t('التواصل'), [['/app/workspace', t('مساحة العمل'), MessagesSquare], ['/app/talent', t('تصفح المبدعين'), Search]]],
    [t('الشركة'), [['/app/profile', t('ملف الشركة والحساب'), Building2]]],
  ],
  admin: [
    [t('الرئيسية'), [['/app', t('لوحة الإدارة'), ShieldCheck, true]]],
    [t('الإدارة'), [['/app/users', t('المستخدمون'), Users], ['/app/all-postings', t('الفرص المنشورة'), FileText], ['/app/all-applications', t('طلبات التقديم'), ClipboardCheck], ['/app/transactions', t('التعاملات المالية'), Receipt]]],
    [t('النظام'), [['/app/settings', t('إعدادات المنصة'), Settings]]],
    [t('حسابي'), [['/app/profile', t('إعدادات الحساب'), UserCog]]],
  ],
};
const TONES = ['', 'gicon-g', 'gicon-w', 'gicon-v', 'gicon-p', 'gicon-c'];
const toneOf = (to) => TONES[[...to.split('?')[0]].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
const ROLE_LABEL = { student: t('مبدع'), company: t('شركة'), admin: t('مدير المنصة') };

export function ThemeButton({ className = '' }) {
  const { dark, toggle } = useTheme();
  return (
    <button className={`btn ${className}`} onClick={toggle} aria-label={dark ? t('تفعيل الوضع النهاري') : t('تفعيل الوضع الليلي')} title={dark ? t('الوضع النهاري') : t('الوضع الليلي')}>
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/** مبدّل اللغة: يحفظ الاختيار ويعيد تحميل الصفحة. */
export function LangSwitch({ className = '' }) {
  return (
    <select aria-label="Language" title="Language" className={`btn !px-2 ${className}`} value={lang} onChange={(e) => setLang(e.target.value)}>
      {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
    </select>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname, loc.search]);
  const groups = NAV[user.role];
  const { data: st } = useFetch(user.role === 'admin' ? null : '/stats', [loc.pathname]);
  const counts = st ? (user.role === 'student' ? { '/app/applications': st.invites } : { '/app/applicants': st.pending, '/app/workspace': st.awaiting }) : {};
  const isActive = (to, end) => {
    const [p, q] = to.split('?');
    if (q) return loc.pathname === p && loc.search.includes(q);
    if (p === '/app/my-postings') return loc.pathname === p;
    return end ? loc.pathname === p : loc.pathname.startsWith(p);
  };
  return (
    <div className="min-h-full lg:flex">
      {/* زر القائمة على نفس جهة خروج القائمة: يمين في العربية/الكردية ويسار في الإنكليزية */}
      <div className="sticky top-0 z-30 flex flex-row-reverse items-center justify-between border-b border-line bg-card/60 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo size={30} />
        <button className="btn" onClick={() => setOpen(true)} aria-label={t('القائمة')}><Menu size={18} /></button>
      </div>
      {open && <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-line bg-card/55 backdrop-blur-2xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:ltr:translate-x-0 lg:rtl:translate-x-0 ${open ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-5">
          <Link to="/app"><Logo size={36} /></Link>
          <button className="btn btn-sm lg:hidden" onClick={() => setOpen(false)} aria-label={t('إغلاق')}><X size={16} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label={t('التنقل الرئيسي')}>
          {groups.map(([title, items]) => (
            <div key={title} className="mb-4">
              <div className="px-3 pb-1 text-xs font-semibold text-mute/80">{title}</div>
              {items.map(([to, label, Icon, end]) => (
                <NavLink key={to} to={to} className={`nav-link ${isActive(to, end) ? 'active' : ''}`}><span className={`gicon ${toneOf(to)}`}><Icon size={19} /></span><span className="flex-1">{label}</span>{counts[to] > 0 && <span className="rounded-full bg-bad px-2 text-xs font-bold text-white">{counts[to]}</span>}</NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <Link to="/app/profile" className="flex items-center gap-3 rounded-xl p-2 hover:bg-app">
            <Avatar u={user} size={40} square={user.role === 'company'} />
            <div className="min-w-0"><div className="truncate text-sm font-semibold">{user.name}</div><div className="text-xs text-mute">{ROLE_LABEL[user.role]}</div></div>
          </Link>
          <LangSwitch className="mt-2 w-full" />
          <div className="mt-2 flex gap-2">
            <ThemeButton />
            <Link to="/brand" className="btn" title={t('الهوية البصرية')} aria-label={t('الهوية البصرية')}><Palette size={16} /></Link>
            <button className="btn flex-1" onClick={logout}><LogOut size={16} />{t('خروج')}</button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8"><div key={loc.pathname} className="page-in mx-auto max-w-6xl"><Outlet /></div></main>
    </div>
  );
}
