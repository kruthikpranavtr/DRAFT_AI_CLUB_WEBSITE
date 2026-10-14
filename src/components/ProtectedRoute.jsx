import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ role, children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="dash-auth-loading" role="status">Verifying secure session…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from:location.pathname }} />;
  }

  if (role && session.role !== role) {
    const destination = session.role === 'student' ? '/student/dashboard' : '/';
    return <Navigate to={destination} replace />;
  }

  return children;
}
