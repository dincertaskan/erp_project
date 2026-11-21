import { useAuth } from '@/auth/useAuth';
import { AdminLayout } from './AdminLayout';
import { ShopLayout } from './ShopLayout';

/** Profil gibi tüm rollerin kullandığı sayfalar, kullanıcının rolüne uygun düzende açılır. */
export function RoleLayout() {
  const { user } = useAuth();
  return user?.role === 'customer' ? <ShopLayout /> : <AdminLayout />;
}
