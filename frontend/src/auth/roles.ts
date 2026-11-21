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
