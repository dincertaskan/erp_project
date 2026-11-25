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

/** Yol önekine göre erişebilen roller; listede olmayan yollar (profil, hata sayfaları) herkese açıktır. */
const ACCESS_RULES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: '/orders/new', roles: ADMIN_ONLY },
  { prefix: '/dashboard', roles: ADMIN_ONLY },
  { prefix: '/categories', roles: ADMIN_ONLY },
  { prefix: '/customers', roles: ADMIN_ONLY },
  { prefix: '/reports', roles: ADMIN_ONLY },
  { prefix: '/users', roles: ADMIN_ONLY },
  { prefix: '/products', roles: STAFF_ROLES },
  { prefix: '/stock', roles: STAFF_ROLES },
  { prefix: '/orders', roles: STAFF_ROLES },
  { prefix: '/shop', roles: CUSTOMER_ONLY },
];

/** Verilen uygulama içi yolun bu rol için açılıp açılamayacağı */
export function canAccess(path: string, role: UserRole): boolean {
  const pathname = path.split(/[?#]/)[0];
  const rule = ACCESS_RULES.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return !rule || rule.roles.includes(role);
}

/** Girişten sonraki hedef: ?redirect= güvenli ve rol için erişilebilirse o, değilse rolün ana sayfası */
export function landingPath(redirect: string | null, role: UserRole): string {
  const target = safeRedirect(redirect);
  return target && canAccess(target, role) ? target : homePathByRole[role];
}
