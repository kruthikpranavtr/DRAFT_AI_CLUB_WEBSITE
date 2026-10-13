import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import GalleryPage from './pages/GalleryPage';
import AboutPage from './pages/AboutPage';
import NewsPage from './pages/NewsPage';
import AssessmentPage from './pages/AssessmentPage';
import AdminLoginPage from './pages/AdminLoginPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function AppRoutes() {
  const { pathname } = useLocation();
  const isLoginRoute = pathname === '/login' || pathname.startsWith('/admin');

  return (
    <>
      {!isLoginRoute && <Navbar />}
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/assessment" element={<AssessmentPage />} />
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
}
