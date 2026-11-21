import {
  AppstoreOutlined,
  BarChartOutlined,
  DashboardOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  TagsOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { UserRole } from '@/utils/labels';

export interface NavItem {
  path: string;
  name: string;
  icon?: ReactNode;
  roles: UserRole[];
  children?: NavItem[];
}

export const adminNavigation: NavItem[] = [
  { path: '/dashboard', name: 'Dashboard', icon: <DashboardOutlined />, roles: ['admin'] },
  { path: '/products', name: 'Ürünler', icon: <AppstoreOutlined />, roles: ['admin', 'warehouse'] },
  { path: '/categories', name: 'Kategoriler', icon: <TagsOutlined />, roles: ['admin'] },
  {
    path: '/stock-menu',
    name: 'Stok',
    icon: <InboxOutlined />,
    roles: ['admin', 'warehouse'],
    children: [
      { path: '/stock', name: 'Stok İşlemleri', roles: ['admin', 'warehouse'] },
      { path: '/stock/movements', name: 'Stok Hareketleri', roles: ['admin', 'warehouse'] },
      { path: '/stock/critical', name: 'Kritik Stok', roles: ['admin', 'warehouse'] },
    ],
  },
  { path: '/orders', name: 'Siparişler', icon: <ShoppingCartOutlined />, roles: ['admin', 'warehouse'] },
  { path: '/customers', name: 'Müşteriler', icon: <TeamOutlined />, roles: ['admin'] },
  { path: '/reports', name: 'Raporlar', icon: <BarChartOutlined />, roles: ['admin'] },
  { path: '/users', name: 'Kullanıcılar', icon: <UserOutlined />, roles: ['admin'] },
];

/** Kullanıcının rolüne göre görebileceği menü öğeleri */
export function navigationForRole(items: NavItem[], role: UserRole): NavItem[] {
  return items
    .filter((item) => item.roles.includes(role))
    .map((item) => (item.children ? { ...item, children: navigationForRole(item.children, role) } : item));
}
