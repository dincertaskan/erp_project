import type { ComponentType } from 'react';
import { createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom';
import { HomeRedirect, PublicOnly, RequireAuth } from '@/auth/guards';
import { ADMIN_ONLY, CUSTOMER_ONLY, STAFF_ROLES } from '@/auth/roles';
import { ErrorPage } from '@/pages/errors/ErrorPage';
import { RouteError } from '@/pages/errors/RouteError';

type PageModule = Record<string, ComponentType>;

/**
 * Sayfalar rol gruplarına göre ayrı parçalarda, ilk ihtiyaç duyulduğunda yüklenir:
 * müşteri yönetim ekranlarını, personel mağazayı indirmez. Parça yüklenemezse RouteError gösterilir.
 */
function lazyPage<M extends PageModule>(load: () => Promise<M>, name: keyof M & string) {
  return async () => ({ Component: (await load())[name] });
}

const adminPages = () => import('./adminPages');
const shopPages = () => import('./shopPages');
const authPages = () => import('./authPages');
const accountPages = () => import('./accountPages');
// Grafik kütüphanesi yalnızca dashboard ve raporlar açılınca yüklenir.
const dashboardPage = () => import('@/pages/dashboard/DashboardPage');
const reportsPage = () => import('@/pages/reports/ReportsPage');

const appRoutes: RouteObject[] = [
  { path: '/', element: <HomeRedirect /> },
  {
    element: (
      <PublicOnly>
        <Outlet />
      </PublicOnly>
    ),
    children: [
      { path: '/login', lazy: lazyPage(authPages, 'LoginPage') },
      { path: '/register', lazy: lazyPage(authPages, 'RegisterPage') },
    ],
  },
  {
    element: (
      <RequireAuth roles={STAFF_ROLES}>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      {
        lazy: lazyPage(adminPages, 'AdminLayout'),
        children: [
          { path: '/products', lazy: lazyPage(adminPages, 'ProductsPage') },
          { path: '/products/:id', lazy: lazyPage(adminPages, 'ProductDetailPage') },
          { path: '/stock', lazy: lazyPage(adminPages, 'StockPage') },
          { path: '/stock/movements', lazy: lazyPage(adminPages, 'StockMovementsPage') },
          { path: '/stock/critical', lazy: lazyPage(adminPages, 'CriticalStockPage') },
          { path: '/orders', lazy: lazyPage(adminPages, 'OrdersPage') },
          { path: '/orders/:id', lazy: lazyPage(adminPages, 'OrderDetailPage') },
          {
            element: (
              <RequireAuth roles={ADMIN_ONLY}>
                <Outlet />
              </RequireAuth>
            ),
            children: [
              { path: '/dashboard', lazy: lazyPage(dashboardPage, 'DashboardPage') },
              { path: '/categories', lazy: lazyPage(adminPages, 'CategoriesPage') },
              { path: '/orders/new', lazy: lazyPage(adminPages, 'NewOrderPage') },
              { path: '/customers', lazy: lazyPage(adminPages, 'CustomersPage') },
              { path: '/customers/:id', lazy: lazyPage(adminPages, 'CustomerDetailPage') },
              { path: '/reports', lazy: lazyPage(reportsPage, 'ReportsPage') },
              { path: '/users', lazy: lazyPage(adminPages, 'UsersPage') },
            ],
          },
        ],
      },
    ],
  },
  {
    element: (
      <RequireAuth roles={CUSTOMER_ONLY}>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      {
        lazy: lazyPage(shopPages, 'ShopLayout'),
        children: [
          { path: '/shop', lazy: lazyPage(shopPages, 'ShopCatalogPage') },
          { path: '/shop/products/:id', lazy: lazyPage(shopPages, 'ShopProductPage') },
          { path: '/shop/cart', lazy: lazyPage(shopPages, 'CartPage') },
          { path: '/shop/orders', lazy: lazyPage(shopPages, 'MyOrdersPage') },
          { path: '/shop/orders/:id', lazy: lazyPage(shopPages, 'MyOrderDetailPage') },
        ],
      },
    ],
  },
  {
    element: (
      <RequireAuth>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      {
        lazy: lazyPage(accountPages, 'RoleLayout'),
        children: [
          { path: '/profile', lazy: lazyPage(accountPages, 'ProfilePage') },
          { path: '/profile/password', lazy: lazyPage(accountPages, 'ChangePasswordPage') },
        ],
      },
    ],
  },
  { path: '/403', element: <ErrorPage status={403} /> },
  { path: '*', element: <ErrorPage status={404} /> },
];

// Yüklenemeyen sayfalar (ör. geç yüklenen parça) tek bir Türkçe hata ekranında yakalanır.
export const routes: RouteObject[] = [{ errorElement: <RouteError />, children: appRoutes }];

export const router = createBrowserRouter(routes);
