import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../../shared/permissions';
import { workspacePath } from '../lib/auth-routing';

export default function ProtectedRoute({ role,permission,children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="dash-auth-loading" role="status">Verifying secure session…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from:location.pathname }} />;
  }

  if (session.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (role && session.role !== role) {
    return <Navigate to={workspacePath(session)} replace />;
  }

  if (permission && !hasPermission(session,permission)) return <Navigate to="/admin/dashboard" replace/>;
  return children;
}
