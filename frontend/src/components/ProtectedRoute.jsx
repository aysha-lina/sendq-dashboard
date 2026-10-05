import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { canAccessAdminPath } from '../utils/access';
import AdminAccessDenied from './AdminAccessDenied';

export const ProtectedRoute = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!token) return <Navigate to="/login" replace />;

  // Client-side admin gate (S7): an authenticated non-admin (or a limited admin) who
  // hits an admin page they have no ability for sees a clear "no access" panel instead
  // of a page that just fires 403s. The server still enforces every admin route.
  if (location.pathname.startsWith('/admin') && !canAccessAdminPath(user, location.pathname)) {
    return <AdminAccessDenied />;
  }

  return children;
};

export const PublicRoute = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  return token ? <Navigate to="/dashboard" replace /> : children;
};
