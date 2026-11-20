import {
  LayoutDashboard, Briefcase, FolderKanban, ClipboardList, MessagesSquare, Wallet, Award, UserCog, ListChecks, PlusCircle, Pencil,
  ClipboardCheck, Users, Search, ShieldCheck, FileText, Receipt, Settings, UserRound, Palette,
} from 'lucide-react';

/** أيقونة ولون لكل صفحة: تظهر أمام عنوان الصفحة وفي القائمة، فيعرف المستخدم أين هو بنظرة واحدة. */
const R = {
  '/app': [LayoutDashboard, ''],
  '/app/jobs': [Briefcase, ''],
  '/app/projects': [FolderKanban, ''],
  '/app/applications': [ClipboardList, ''],
  '/app/workspace': [MessagesSquare, ''],
  '/app/wallet': [Wallet, ''],
  '/app/portfolio': [Award, ''],
  '/app/profile': [UserCog, ''],
  '/app/people': [UserRound, ''],
  '/app/opportunity': [Briefcase, ''],
  '/app/my-postings/new': [PlusCircle, ''],
  '/app/my-postings': [ListChecks, ''],
  '/app/applicants': [Users, ''],
  '/app/talent': [Search, ''],
  '/app/users': [Users, ''],
  '/app/all-postings': [FileText, ''],
  '/app/all-applications': [ClipboardCheck, ''],
  '/app/transactions': [Receipt, ''],
  '/app/settings': [Settings, ''],
  '/brand': [Palette, ''],
};
const KEYS = Object.keys(R).sort((a, b) => b.length - a.length);

export function routeIcon(pathname) {
  if (/\/my-postings\/\d+\/edit$/.test(pathname)) return [Pencil, ''];
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
