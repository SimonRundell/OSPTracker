/**
 * ProtectedRoute - wraps authenticated (and optionally admin-only) routes.
 * @module ProtectedRoute
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Protects a route. Redirects to /login if not authenticated.
 * If requiredRole is 'admin', redirects to /dashboard for non-admins.
 * @param {{ children: React.ReactNode, requiredRole?: string }} props
 */
export function ProtectedRoute({ children, requiredRole }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password && pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/dashboard" replace />;

  return children;
}

export default ProtectedRoute;
