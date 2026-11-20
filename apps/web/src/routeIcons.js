import {
  LayoutDashboard, Briefcase, FolderKanban, ClipboardList, MessagesSquare, Wallet, Award, UserCog, ListChecks, PlusCircle, Pencil,
  ClipboardCheck, Users, Search, ShieldCheck, FileText, Receipt, Settings, UserRound, Palette,
} from 'lucide-react';

/** أيقونة ولون لكل صفحة: تظهر أمام عنوان الصفحة وفي القائمة، فيعرف المستخدم أين هو بنظرة واحدة. */
const R = {
  '/app': [LayoutDashboard, ''],
  '/app/jobs': [Briefcase, 'gicon-c'],
  '/app/projects': [FolderKanban, 'gicon-g'],
  '/app/applications': [ClipboardList, 'gicon-p'],
  '/app/workspace': [MessagesSquare, 'gicon-v'],
  '/app/wallet': [Wallet, 'gicon-w'],
  '/app/portfolio': [Award, 'gicon-p'],
  '/app/profile': [UserCog, ''],
  '/app/people': [UserRound, ''],
  '/app/opportunity': [Briefcase, 'gicon-c'],
  '/app/my-postings/new': [PlusCircle, 'gicon-g'],
  '/app/my-postings': [ListChecks, 'gicon-w'],
  '/app/applicants': [Users, 'gicon-p'],
  '/app/talent': [Search, 'gicon-c'],
  '/app/users': [Users, ''],
  '/app/all-postings': [FileText, 'gicon-c'],
  '/app/all-applications': [ClipboardCheck, 'gicon-g'],
  '/app/transactions': [Receipt, 'gicon-w'],
  '/app/settings': [Settings, 'gicon-v'],
  '/brand': [Palette, 'gicon-v'],
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
