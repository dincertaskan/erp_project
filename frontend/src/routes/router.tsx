import { createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom';
import { HomeRedirect, PublicOnly, RequireAuth } from '@/auth/guards';
import { ADMIN_ONLY, CUSTOMER_ONLY, STAFF_ROLES } from '@/auth/roles';
import { AdminLayout } from '@/layouts/AdminLayout';
import { RoleLayout } from '@/layouts/RoleLayout';
import { ShopLayout } from '@/layouts/ShopLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { CategoriesPage } from '@/pages/categories/CategoriesPage';
import { CustomerDetailPage } from '@/pages/customers/CustomerDetailPage';
import { CustomersPage } from '@/pages/customers/CustomersPage';
import { NewOrderPage } from '@/pages/orders/NewOrderPage';
import { OrderDetailPage } from '@/pages/orders/OrderDetailPage';
import { OrdersPage } from '@/pages/orders/OrdersPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ErrorPage } from '@/pages/errors/ErrorPage';
import { RouteError } from '@/pages/errors/RouteError';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ChangePasswordPage } from '@/pages/profile/ChangePasswordPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { UsersPage } from '@/pages/users/UsersPage';
import { CartPage } from '@/pages/shop/CartPage';
import { MyOrderDetailPage } from '@/pages/shop/MyOrderDetailPage';
import { MyOrdersPage } from '@/pages/shop/MyOrdersPage';
import { ShopCatalogPage } from '@/pages/shop/ShopCatalogPage';
import { ShopProductPage } from '@/pages/shop/ShopProductPage';
import { ProductDetailPage } from '@/pages/products/ProductDetailPage';
import { ProductsPage } from '@/pages/products/ProductsPage';
import { CriticalStockPage } from '@/pages/stock/CriticalStockPage';
import { StockMovementsPage } from '@/pages/stock/StockMovementsPage';
import { StockPage } from '@/pages/stock/StockPage';

const page = (title: string) => <PlaceholderPage title={title} />;

const appRoutes: RouteObject[] = [
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
      { path: '/products', element: <ProductsPage /> },
      { path: '/products/:id', element: <ProductDetailPage /> },
      { path: '/stock', element: <StockPage /> },
      { path: '/stock/movements', element: <StockMovementsPage /> },
      { path: '/stock/critical', element: <CriticalStockPage /> },
      { path: '/orders', element: <OrdersPage /> },
      { path: '/orders/:id', element: <OrderDetailPage /> },
      {
        element: (
          <RequireAuth roles={ADMIN_ONLY}>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          {
            path: '/dashboard',
            // Grafik kütüphanesi yalnızca dashboard açılınca yüklenir.
            lazy: async () => ({ Component: (await import('@/pages/dashboard/DashboardPage')).DashboardPage }),
          },
          { path: '/categories', element: <CategoriesPage /> },
          { path: '/orders/new', element: <NewOrderPage /> },
          { path: '/customers', element: <CustomersPage /> },
          { path: '/customers/:id', element: <CustomerDetailPage /> },
          { path: '/reports', element: page('Raporlar') },
          { path: '/users', element: <UsersPage /> },
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
      { path: '/shop', element: <ShopCatalogPage /> },
      { path: '/shop/products/:id', element: <ShopProductPage /> },
      { path: '/shop/cart', element: <CartPage /> },
      { path: '/shop/orders', element: <MyOrdersPage /> },
      { path: '/shop/orders/:id', element: <MyOrderDetailPage /> },
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

// Yüklenemeyen sayfalar (ör. geç yüklenen parça) tek bir Türkçe hata ekranında yakalanır.
export const routes: RouteObject[] = [{ errorElement: <RouteError />, children: appRoutes }];

export const router = createBrowserRouter(routes);
