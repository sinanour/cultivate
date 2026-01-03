import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Wait for auth check to complete
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    // Capture the current URL (pathname + search) and pass it as redirect parameter
    const redirectUrl = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectUrl)}`} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // For now, just redirect to dashboard if user doesn't have required role
    // In a real app, you might show an error page
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
