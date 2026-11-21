import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context.jsx';
import { Spinner } from './ui.jsx';
import Layout from './Layout.jsx';

/* تقسيم الكود: كل صفحة تُحمَّل عند الحاجة فقط */
const page = (loader, name) => lazy(() => loader().then((m) => ({ default: name ? m[name] : m.default })));
const Welcome = page(() => import('./pages/Welcome.jsx'));
const LoginPage = page(() => import('./pages/Auth.jsx'), 'LoginPage');
const RegisterPage = page(() => import('./pages/Auth.jsx'), 'RegisterPage');
const ForgotPage = page(() => import('./pages/Auth.jsx'), 'ForgotPage');
const ResetPage = page(() => import('./pages/Auth.jsx'), 'ResetPage');
const LinkedInCallback = page(() => import('./pages/Auth.jsx'), 'LinkedInCallback');
const Profile = page(() => import('./pages/Profile.jsx'));
const PublicProfile = page(() => import('./pages/PublicProfile.jsx'));
const Workspace = page(() => import('./pages/Workspace.jsx'));
const Opportunity = page(() => import('./pages/Opportunity.jsx'));
const StudentDashboard = page(() => import('./pages/student.jsx'), 'StudentDashboard');
const Browse = page(() => import('./pages/student.jsx'), 'Browse');
const Applications = page(() => import('./pages/student.jsx'), 'Applications');
const Wallet = page(() => import('./pages/student.jsx'), 'Wallet');
const Portfolio = page(() => import('./pages/student.jsx'), 'Portfolio');
const CompanyDashboard = page(() => import('./pages/company.jsx'), 'CompanyDashboard');
const MyPostings = page(() => import('./pages/company.jsx'), 'MyPostings');
const PostingForm = page(() => import('./pages/company.jsx'), 'PostingForm');
const Applicants = page(() => import('./pages/company.jsx'), 'Applicants');
const Talent = page(() => import('./pages/company.jsx'), 'Talent');
const AdminDashboard = page(() => import('./pages/admin.jsx'), 'AdminDashboard');
const AdminUsers = page(() => import('./pages/admin.jsx'), 'AdminUsers');
const AdminPostings = page(() => import('./pages/admin.jsx'), 'AdminPostings');
const AdminTransactions = page(() => import('./pages/admin.jsx'), 'AdminTransactions');
const AdminApplications = page(() => import('./pages/admin.jsx'), 'AdminApplications');
const AdminSettings = page(() => import('./pages/admin.jsx'), 'AdminSettings');

function Gate({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  return user ? children : <Navigate to="/" replace />;
}
function PublicOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  return user ? <Navigate to="/app" replace /> : children;
}
function Role({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user.role) ? children : <Navigate to="/app" replace />;
}
/* مفتاح بالمسار حتى لا تبقى قيم نموذج سابق عند التنقل بين «جديد» و«تعديل» */
function KeyedPostingForm() {
  const { pathname, search } = useLocation();
  return <PostingForm key={pathname + search} />;
}
function Index() {
  const { user } = useAuth();
  if (user.role === 'student') return <StudentDashboard />;
  if (user.role === 'company') return <CompanyDashboard />;
  return <AdminDashboard />;
}

export default function App() {
  const S = ['student'], C = ['company'], A = ['admin'];
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<PublicOnly><Welcome /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
        <Route path="/forgot" element={<PublicOnly><ForgotPage /></PublicOnly>} />
        <Route path="/reset-password" element={<ResetPage />} />
        <Route path="/auth/linkedin/callback" element={<LinkedInCallback />} />
        <Route path="/app" element={<Gate><Layout /></Gate>}>
          <Route index element={<Index />} />
          <Route path="profile" element={<Profile />} />
          <Route path="people/:id" element={<PublicProfile />} />
          <Route path="opportunity/:id" element={<Opportunity />} />
          <Route path="workspace" element={<Workspace />} />
          <Route path="workspace/:appId" element={<Workspace />} />
          {/* مبدع */}
          <Route path="jobs" element={<Role roles={S}><Browse key="job" kind="job" /></Role>} />
          <Route path="projects" element={<Role roles={S}><Browse key="project" kind="project" /></Role>} />
          <Route path="applications" element={<Role roles={S}><Applications /></Role>} />
          <Route path="wallet" element={<Role roles={S}><Wallet /></Role>} />
          <Route path="portfolio" element={<Role roles={S}><Portfolio /></Role>} />
          {/* شركة */}
          <Route path="my-postings" element={<Role roles={C}><MyPostings /></Role>} />
          <Route path="my-postings/new" element={<Role roles={C}><KeyedPostingForm /></Role>} />
          <Route path="my-postings/:id/edit" element={<Role roles={C}><KeyedPostingForm /></Role>} />
          <Route path="applicants" element={<Role roles={C}><Applicants /></Role>} />
          <Route path="talent" element={<Role roles={C}><Talent /></Role>} />
          {/* مدير */}
          <Route path="users" element={<Role roles={A}><AdminUsers /></Role>} />
          <Route path="all-postings" element={<Role roles={A}><AdminPostings /></Role>} />
          <Route path="all-applications" element={<Role roles={A}><AdminApplications /></Role>} />
          <Route path="settings" element={<Role roles={A}><AdminSettings /></Role>} />
          <Route path="transactions" element={<Role roles={A}><AdminTransactions /></Role>} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
