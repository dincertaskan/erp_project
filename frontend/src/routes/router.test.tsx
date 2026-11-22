import { screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '@/api/client';
import type { CurrentUser } from '@/api/types';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import type { UserRole } from '@/utils/labels';
import { routes } from './router';

const auth: AuthContextValue = {
  user: null,
  isLoading: false,
  sessionExpired: false,
  signedOut: false,
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));

// jsdom'da canvas yok; grafikler yer tutucuyla değiştirilir.
vi.mock('@ant-design/plots', () => ({
  Area: () => <div data-testid="chart" />,
  Column: () => <div data-testid="chart" />,
}));

function signIn(role: UserRole | null) {
  auth.user =
    role === null
      ? null
      : ({
          id: 1,
          full_name: 'Test Kullanıcı',
          email: 'test@example.com',
          role,
          is_active: true,
          created_at: '2026-11-01T10:00:00Z',
          last_login_at: null,
          customer: null,
        } satisfies CurrentUser);
}

const ADMIN_PATHS = ['/dashboard', '/categories', '/orders/new', '/customers', '/customers/5', '/reports', '/users'];
const STAFF_PATHS = [
  '/products',
  '/products/7',
  '/stock',
  '/stock/movements',
  '/stock/critical',
  '/orders',
  '/orders/41',
];
const CUSTOMER_PATHS = ['/shop', '/shop/products/7', '/shop/cart', '/shop/orders', '/shop/orders/3'];
const SHARED_PATHS = ['/profile', '/profile/password'];

async function visit(path: string) {
  const { router } = renderRoutes(routes, path);
  // Geç yüklenen sayfalar (dashboard, raporlar) için yönlendirmenin bitmesi beklenir.
  await waitFor(() => expect(router.state.navigation.state).toBe('idle'));
  return router;
}

beforeEach(() => {
  vi.restoreAllMocks();
  auth.signedOut = false;
  // Sayfa verileri bu testlerin konusu değil; istekler hiç yanıtlanmaz, sayfalar yükleniyor durumunda kalır.
  vi.spyOn(api, 'get').mockReturnValue(new Promise(() => {}));
  vi.spyOn(api, 'post').mockReturnValue(new Promise(() => {}));
});

describe('route protection', () => {
  it.each(ADMIN_PATHS)('sends warehouse staff from admin-only %s to 403', async (path) => {
    signIn('warehouse');

    const router = await visit(path);

    await waitFor(() => expect(router.state.location.pathname).toBe('/403'));
    expect(await screen.findByText('Erişim yetkiniz yok')).toBeInTheDocument();
  });

  it.each(ADMIN_PATHS)('lets an admin open %s', async (path) => {
    signIn('admin');

    const router = await visit(path);

    expect(router.state.location.pathname).toBe(path);
    expect(screen.queryByText('Erişim yetkiniz yok')).not.toBeInTheDocument();
  });

  it.each(STAFF_PATHS)('lets warehouse staff open %s', async (path) => {
    signIn('warehouse');

    const router = await visit(path);

    expect(router.state.location.pathname).toBe(path);
    expect(screen.queryByText('Erişim yetkiniz yok')).not.toBeInTheDocument();
  });

  it.each(STAFF_PATHS)('keeps customers out of the staff page %s', async (path) => {
    signIn('customer');

    const router = await visit(path);

    await waitFor(() => expect(router.state.location.pathname).toBe('/403'));
  });

  it.each(
    CUSTOMER_PATHS.flatMap((path) => [
      { path, role: 'admin' as const },
      { path, role: 'warehouse' as const },
    ]),
  )('sends $role users from the customer page $path to 403', async ({ path, role }) => {
    signIn(role);

    const router = await visit(path);

    await waitFor(() => expect(router.state.location.pathname).toBe('/403'));
  });

  it.each(CUSTOMER_PATHS)('lets a customer open %s', async (path) => {
    signIn('customer');

    const router = await visit(path);

    expect(router.state.location.pathname).toBe(path);
  });

  it.each([...ADMIN_PATHS, ...STAFF_PATHS, ...CUSTOMER_PATHS, ...SHARED_PATHS])(
    'sends anonymous visitors from %s to the login page with a redirect back',
    async (path) => {
      signIn(null);

      const router = await visit(path);

      await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
      expect(router.state.location.search).toBe(`?redirect=${encodeURIComponent(path)}`);
    },
  );

  it('keeps the query string in the redirect', async () => {
    signIn(null);

    const router = await visit('/orders?status=pending');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(new URLSearchParams(router.state.location.search).get('redirect')).toBe('/orders?status=pending');
  });

  it.each(['admin', 'warehouse', 'customer'] as const)('opens the profile page for %s users', async (role) => {
    signIn(role);

    const router = await visit('/profile');

    expect(router.state.location.pathname).toBe('/profile');
  });
});

describe('home and public routes', () => {
  it.each([
    ['admin', '/dashboard'],
    ['warehouse', '/stock'],
    ['customer', '/shop'],
  ] as const)('sends %s users from / to %s', async (role, home) => {
    signIn(role);

    const router = await visit('/');

    await waitFor(() => expect(router.state.location.pathname).toBe(home));
  });

  it('sends anonymous visitors from / to the login page', async () => {
    signIn(null);

    const router = await visit('/');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('');
  });

  it.each(['/login', '/register'])('moves a signed-in user away from %s', async (path) => {
    signIn('warehouse');

    const router = await visit(path);

    await waitFor(() => expect(router.state.location.pathname).toBe('/stock'));
  });

  it('shows the 404 page for unknown paths', async () => {
    signIn(null);

    await visit('/olmayan-sayfa');

    expect(screen.getByText('Sayfa bulunamadı')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giriş Yap' })).toBeInTheDocument();
  });
});
