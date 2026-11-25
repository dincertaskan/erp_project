import {
  AppstoreOutlined,
  BarChartOutlined,
  DashboardOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  TagsOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { UserRole } from '@/utils/labels';

export interface NavItem {
  path: string;
  name: string;
  icon?: ReactNode;
  roles: UserRole[];
}

/** Yan menüde ayrı bir kart olarak gösterilen menü grubu */
export interface NavGroup {
  key: string;
  title: string;
  items: NavItem[];
}

export const adminNavigation: NavGroup[] = [
  {
    key: 'general',
    title: 'Genel',
    items: [
      { path: '/dashboard', name: 'Genel Bakış', icon: <DashboardOutlined />, roles: ['admin'] },
      { path: '/reports', name: 'Raporlar', icon: <BarChartOutlined />, roles: ['admin'] },
    ],
  },
  {
    key: 'catalog',
    title: 'Katalog',
    items: [
      { path: '/products', name: 'Ürünler', icon: <AppstoreOutlined />, roles: ['admin', 'warehouse'] },
      { path: '/categories', name: 'Kategoriler', icon: <TagsOutlined />, roles: ['admin'] },
    ],
  },
  {
    key: 'stock',
    title: 'Stok',
    items: [
      { path: '/stock', name: 'Stok İşlemleri', icon: <InboxOutlined />, roles: ['admin', 'warehouse'] },
      { path: '/stock/movements', name: 'Stok Hareketleri', icon: <SwapOutlined />, roles: ['admin', 'warehouse'] },
      { path: '/stock/critical', name: 'Kritik Stok', icon: <WarningOutlined />, roles: ['admin', 'warehouse'] },
    ],
  },
  {
    key: 'sales',
    title: 'Satış',
    items: [
      { path: '/orders', name: 'Siparişler', icon: <ShoppingCartOutlined />, roles: ['admin', 'warehouse'] },
      { path: '/customers', name: 'Müşteriler', icon: <TeamOutlined />, roles: ['admin'] },
    ],
  },
  {
    key: 'admin',
    title: 'Yönetim',
    items: [{ path: '/users', name: 'Kullanıcılar', icon: <UserOutlined />, roles: ['admin'] }],
  },
];

/** Adrese en uzun eşleşen menü yolu: /stock/movements için /stock değil /stock/movements seçilir */
export function selectedMenuKey(groups: NavGroup[], pathname: string): string | undefined {
  return groups
    .flatMap((group) => group.items.map((item) => item.path))
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** Kullanıcının rolüne göre görebileceği menü grupları; boş kalan gruplar gizlenir */
export function navigationForRole(groups: NavGroup[], role: UserRole): NavGroup[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)) }))
    .filter((group) => group.items.length > 0);
}
