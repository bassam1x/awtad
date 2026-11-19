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
    ['الرئيسية', [['/app', 'لوحة التحكم', LayoutDashboard, true]]],
    ['الفرص', [['/app/jobs', 'الوظائف الشاغرة', Briefcase], ['/app/projects', 'المشاريع والتعاونات', FolderKanban], ['/app/applications', 'طلباتي ودعواتي', ClipboardList]]],
    ['العمل', [['/app/workspace', 'مساحة العمل', MessagesSquare], ['/app/wallet', 'المحفظة', Wallet]]],
    ['حسابي', [['/app/portfolio', 'ملفي المهني', Award], ['/app/profile', 'إعدادات الحساب', UserCog]]],
  ],
  company: [
    ['الرئيسية', [['/app', 'لوحة التحكم', LayoutDashboard, true]]],
    ['التوظيف', [['/app/my-postings', 'الوظائف والمشاريع', ListChecks, true], ['/app/my-postings/new?kind=job', 'نشر وظيفة', PlusCircle], ['/app/my-postings/new?kind=project', 'نشر مشروع', FolderPlus], ['/app/applicants', 'مراجعة المتقدمين', Users]]],
    ['التواصل', [['/app/workspace', 'مساحة العمل', MessagesSquare], ['/app/talent', 'تصفح المبدعين', Search]]],
    ['الشركة', [['/app/profile', 'ملف الشركة والحساب', Building2]]],
  ],
  admin: [
    ['الرئيسية', [['/app', 'لوحة الإدارة', ShieldCheck, true]]],
    ['الإدارة', [['/app/users', 'المستخدمون', Users], ['/app/all-postings', 'الفرص المنشورة', FileText], ['/app/all-applications', 'طلبات التقديم', ClipboardCheck], ['/app/transactions', 'التعاملات المالية', Receipt]]],
    ['النظام', [['/app/settings', 'إعدادات المنصة', Settings]]],
    ['حسابي', [['/app/profile', 'إعدادات الحساب', UserCog]]],
  ],
};
const ROLE_LABEL = { student: 'مبدع', company: 'شركة', admin: 'مدير المنصة' };

export function ThemeButton({ className = '' }) {
  const { dark, toggle } = useTheme();
  return (
    <button className={`btn ${className}`} onClick={toggle} aria-label={dark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'} title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}>
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
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
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-card px-4 py-3 lg:hidden">
        <Logo size={30} />
        <button className="btn" onClick={() => setOpen(true)} aria-label="القائمة"><Menu size={18} /></button>
      </div>
      {open && <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col border-l border-line bg-card transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-5">
          <Link to="/app"><Logo size={36} /></Link>
          <button className="btn btn-sm lg:hidden" onClick={() => setOpen(false)} aria-label="إغلاق"><X size={16} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="التنقل الرئيسي">
          {groups.map(([title, items]) => (
            <div key={title} className="mb-4">
              <div className="px-3 pb-1 text-xs font-semibold text-mute/80">{title}</div>
              {items.map(([to, label, Icon, end]) => (
                <NavLink key={to} to={to} className={`nav-link ${isActive(to, end) ? 'active' : ''}`}><Icon size={18} /><span className="flex-1">{label}</span>{counts[to] > 0 && <span className="rounded-full bg-bad px-2 text-xs font-bold text-white">{counts[to]}</span>}</NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <Link to="/app/profile" className="flex items-center gap-3 rounded-xl p-2 hover:bg-app">
            <Avatar u={user} size={40} square={user.role === 'company'} />
            <div className="min-w-0"><div className="truncate text-sm font-semibold">{user.name}</div><div className="text-xs text-mute">{ROLE_LABEL[user.role]}</div></div>
          </Link>
          <div className="mt-2 flex gap-2">
            <ThemeButton />
            <Link to="/brand" className="btn" title="الهوية البصرية" aria-label="الهوية البصرية"><Palette size={16} /></Link>
            <button className="btn flex-1" onClick={logout}><LogOut size={16} />خروج</button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8"><div className="mx-auto max-w-6xl"><Outlet /></div></main>
    </div>
  );
}
