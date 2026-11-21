import type { UserRole } from '@/utils/labels';

/** Girişten sonra her rolün açılış sayfası */
export const homePathByRole: Record<UserRole, string> = {
  admin: '/dashboard',
  warehouse: '/stock',
  customer: '/shop',
};

export const STAFF_ROLES: UserRole[] = ['admin', 'warehouse'];
export const ADMIN_ONLY: UserRole[] = ['admin'];
export const CUSTOMER_ONLY: UserRole[] = ['customer'];

/** Girişten sonra dönülecek adres: yalnızca uygulama içi yollar kabul edilir */
export function safeRedirect(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if (value.startsWith('/login') || value.startsWith('/register')) return null;
  return value;
}
