import { createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom';
import { HomeRedirect, PublicOnly, RequireAuth } from '@/auth/guards';
import { ADMIN_ONLY, CUSTOMER_ONLY, STAFF_ROLES } from '@/auth/roles';
import { AdminLayout } from '@/layouts/AdminLayout';
import { RoleLayout } from '@/layouts/RoleLayout';
import { ShopLayout } from '@/layouts/ShopLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ErrorPage } from '@/pages/errors/ErrorPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ChangePasswordPage } from '@/pages/profile/ChangePasswordPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';

const page = (title: string) => <PlaceholderPage title={title} />;

export const routes: RouteObject[] = [
  { path: '/', element: <HomeRedirect /> },
  {
    element: (
      <PublicOnly>
        <Outlet />
      </PublicOnly>
    ),
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: (
      <RequireAuth roles={STAFF_ROLES}>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/products', element: page('Ürünler') },
      { path: '/products/:id', element: page('Ürün Detayı') },
      { path: '/stock', element: page('Stok İşlemleri') },
      { path: '/stock/movements', element: page('Stok Hareketleri') },
      { path: '/stock/critical', element: page('Kritik Stok') },
      { path: '/orders', element: page('Siparişler') },
      { path: '/orders/:id', element: page('Sipariş Detayı') },
      {
        element: (
          <RequireAuth roles={ADMIN_ONLY}>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          { path: '/dashboard', element: page('Dashboard') },
          { path: '/categories', element: page('Kategoriler') },
          { path: '/orders/new', element: page('Yeni Sipariş') },
          { path: '/customers', element: page('Müşteriler') },
          { path: '/customers/:id', element: page('Müşteri Detayı') },
          { path: '/reports', element: page('Raporlar') },
          { path: '/users', element: page('Kullanıcılar') },
        ],
      },
    ],
  },
  {
    element: (
      <RequireAuth roles={CUSTOMER_ONLY}>
        <ShopLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/shop', element: page('Ürünler') },
      { path: '/shop/products/:id', element: page('Ürün Detayı') },
      { path: '/shop/cart', element: page('Sepetim') },
      { path: '/shop/orders', element: page('Siparişlerim') },
      { path: '/shop/orders/:id', element: page('Sipariş Detayı') },
    ],
  },
  {
    element: (
      <RequireAuth>
        <RoleLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/profile', element: <ProfilePage /> },
      { path: '/profile/password', element: <ChangePasswordPage /> },
    ],
  },
  { path: '/403', element: <ErrorPage status={403} /> },
  { path: '*', element: <ErrorPage status={404} /> },
];

export const router = createBrowserRouter(routes);
