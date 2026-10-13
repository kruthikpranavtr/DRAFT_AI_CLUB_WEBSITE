import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ role, children }) {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from:location.pathname }} />;
  }

  if (role && session.role !== role) {
    const destination = session.role === 'admin' ? '/admin/dashboard' : '/student/dashboard';
    return <Navigate to={destination} replace />;
  }

  return children;
}
