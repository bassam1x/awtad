import {
  LayoutDashboard, Briefcase, FolderKanban, ClipboardList, MessagesSquare, Wallet, Award, UserCog, ListChecks, PlusCircle, Pencil,
  ClipboardCheck, Users, Search, ShieldCheck, FileText, Receipt, Settings, UserRound,
} from './icons.jsx';

/** أيقونة ولون لكل صفحة: تظهر أمام عنوان الصفحة وفي القائمة، فيعرف المستخدم أين هو بنظرة واحدة. */
const R = {
  '/app': [LayoutDashboard, ''],
  '/app/jobs': [Briefcase, ''],
  '/app/projects': [FolderKanban, 'gicon-t'],
  '/app/applications': [ClipboardList, 'gicon-v'],
  '/app/workspace': [MessagesSquare, 'gicon-t'],
  '/app/wallet': [Wallet, 'gicon-w'],
  '/app/portfolio': [Award, 'gicon-v'],
  '/app/profile': [UserCog, 'gicon-v'],
  '/app/people': [UserRound, 'gicon-v'],
  '/app/opportunity': [Briefcase, ''],
  '/app/my-postings/new': [PlusCircle, 'gicon-t'],
  '/app/my-postings': [ListChecks, ''],
  '/app/applicants': [Users, 'gicon-v'],
  '/app/talent': [Search, 'gicon-t'],
  '/app/users': [Users, ''],
  '/app/all-postings': [FileText, 'gicon-t'],
  '/app/all-applications': [ClipboardCheck, 'gicon-v'],
  '/app/transactions': [Receipt, 'gicon-w'],
  '/app/settings': [Settings, 'gicon-s'],
};
const KEYS = Object.keys(R).sort((a, b) => b.length - a.length);

export function routeIcon(pathname) {
  if (/\/my-postings\/\d+\/edit$/.test(pathname)) return [Pencil, 'gicon-w'];
  const k = KEYS.find((x) => pathname === x || pathname.startsWith(`${x}/`));
  return k ? R[k] : [ShieldCheck, ''];
}

/** مسارات الـ API التي نحمّلها مسبقاً عند تمرير المؤشر فوق رابط في القائمة */
export const PREFETCH = {
  '/app': '/stats',
  '/app/jobs': '/postings?kind=job',
  '/app/projects': '/postings?kind=project',
  '/app/applications': '/applications',
  '/app/wallet': '/wallet',
  '/app/my-postings': '/postings/mine',
  '/app/applicants': '/applications',
  '/app/talent': '/students',
  '/app/users': '/admin/users?q=',
  '/app/all-postings': '/admin/postings',
  '/app/all-applications': '/applications',
  '/app/transactions': '/admin/transactions',
};
