import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import GalleryPage from './pages/GalleryPage';
import AboutPage from './pages/AboutPage';
import NewsPage from './pages/NewsPage';
import AssessmentPage from './pages/AssessmentPage';
import AdminLoginPage from './pages/AdminLoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top:0, behavior:'auto' }); }, [pathname]);
  return null;
}

function DashboardRedirect() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={session.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'} replace />;
}

function AppRoutes() {
  const { pathname } = useLocation();
  const standalone = pathname === '/login' || pathname === '/forgot-password' || pathname.startsWith('/admin') || pathname.startsWith('/student');

  return <>
    {!standalone && <Navbar />}
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/gallery" element={<GalleryPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/assessment" element={<ProtectedRoute role="student"><AssessmentPage /></ProtectedRoute>} />
      <Route path="/login" element={<AdminLoginPage />} />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/dashboard" element={<DashboardRedirect />} />
      <Route path="/student/dashboard" element={<ProtectedRoute role="student"><StudentDashboardPage /></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminDashboardPage /></ProtectedRoute>} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  </>;
}

export default function App() {
  return <ThemeProvider><AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider></ThemeProvider>;
}
