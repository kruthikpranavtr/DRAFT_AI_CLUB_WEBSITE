import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import SiteAnnouncement from './components/SiteAnnouncement';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import GalleryPage from './pages/GalleryPage';
import AboutPage from './pages/AboutPage';
import NewsPage from './pages/NewsPage';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import StudentProfilePage from './pages/StudentProfilePage';
import MemberDirectoryPage from './pages/MemberDirectoryPage';
import MemberProfilePage from './pages/MemberProfilePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminStudentsPage from './pages/AdminStudentsPage';
import AdminAssessmentsPage from './pages/AdminAssessmentsPage';
import StudentAssessmentsPage,{ StudentAssessmentAttemptPage } from './pages/StudentAssessmentsPage';
import CommunityPage from './pages/CommunityPage';
import CommunityPostPage from './pages/CommunityPostPage';
import AdminModerationPage from './pages/AdminModerationPage';
import { PERMISSIONS } from '../shared/permissions';
import { workspacePath } from './lib/auth-routing';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top:0, behavior:'auto' }); }, [pathname]);
  return null;
}

function DashboardRedirect() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={workspacePath(session)} replace />;
}

function AppRoutes() {
  const { pathname } = useLocation();
  const standalone = pathname === '/login' || pathname === '/forgot-password' || pathname === '/change-password' || pathname.startsWith('/admin') || pathname.startsWith('/student');

  return <>
    {!standalone && <><Navbar/><SiteAnnouncement/></>}
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/gallery" element={<GalleryPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/assessment" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<DashboardRedirect />} />
      <Route path="/student/dashboard" element={<ProtectedRoute role="student"><StudentDashboardPage /></ProtectedRoute>} />
      <Route path="/student/profile" element={<ProtectedRoute role="student"><StudentProfilePage /></ProtectedRoute>} />
      <Route path="/student/members" element={<ProtectedRoute role="student"><MemberDirectoryPage /></ProtectedRoute>} />
      <Route path="/student/assessments" element={<ProtectedRoute role="student"><StudentAssessmentsPage /></ProtectedRoute>} />
      <Route path="/student/assessments/attempt/:attemptId" element={<ProtectedRoute role="student"><StudentAssessmentAttemptPage /></ProtectedRoute>} />
      <Route path="/student/members/:id" element={<ProtectedRoute role="student"><MemberProfilePage /></ProtectedRoute>} />
      <Route path="/student/community" element={<ProtectedRoute role="student"><CommunityPage /></ProtectedRoute>} />
      <Route path="/student/community/posts/:postId" element={<ProtectedRoute role="student"><CommunityPostPage /></ProtectedRoute>} />
      <Route path="/admin/community" element={<ProtectedRoute role="admin"><CommunityPage /></ProtectedRoute>} />
      <Route path="/admin/community/posts/:postId" element={<ProtectedRoute role="admin"><CommunityPostPage /></ProtectedRoute>} />
      <Route path="/admin/members/:id" element={<ProtectedRoute role="admin"><MemberProfilePage /></ProtectedRoute>} />
      <Route path="/admin/moderation" element={<ProtectedRoute role="admin" permission={PERMISSIONS.MODERATE_COMMUNITY}><AdminModerationPage /></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminDashboardPage /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute role="admin" permission={PERMISSIONS.MANAGE_STUDENTS}><AdminStudentsPage /></ProtectedRoute>} />
      <Route path="/admin/assessments" element={<ProtectedRoute role="admin"><AdminAssessmentsPage /></ProtectedRoute>} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  </>;
}

export default function App() {
  return <ThemeProvider><AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider></ThemeProvider>;
}
