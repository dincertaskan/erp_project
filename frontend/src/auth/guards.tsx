import { Spin } from 'antd';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import type { UserRole } from '@/utils/labels';
import { useAuth } from './useAuth';
import { homePathByRole, safeRedirect } from './roles';

export function FullPageSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Spin size="large" />
    </div>
  );
}

/** Giriş yapılmamışsa giriş ekranına, rol uygun değilse 403 sayfasına yönlendirir. */
export function RequireAuth({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  const { user, isLoading, signedOut } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;
  if (!user && signedOut) return <Navigate to="/login" replace />;
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}

/** Giriş ve kayıt ekranları: oturum açıksa ?redirect= adresine ya da rolün ana sayfasına gönderir. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [params] = useSearchParams();
  if (isLoading) return <FullPageSpinner />;
  if (user) return <Navigate to={safeRedirect(params.get('redirect')) ?? homePathByRole[user.role]} replace />;
  return <>{children}</>;
}

export function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  return <Navigate to={user ? homePathByRole[user.role] : '/login'} replace />;
}
