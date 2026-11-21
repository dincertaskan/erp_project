import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { CurrentUser } from '@/api/types';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import { ErrorPage } from './ErrorPage';
import { RouteError } from './RouteError';

const auth: AuthContextValue = {
  user: null,
  isLoading: false,
  sessionExpired: false,
  signedOut: false,
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));

const warehouseUser: CurrentUser = {
  id: 2,
  full_name: 'Ayşe Kaya',
  email: 'depo@example.com',
  role: 'warehouse',
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  last_login_at: null,
  customer: null,
};

function Thrower({ error }: { error: Error }): never {
  throw error;
}

beforeEach(() => {
  vi.restoreAllMocks();
  auth.user = null;
});

describe('ErrorPage', () => {
  it('sends a signed-in user back to the home page of their role', async () => {
    auth.user = warehouseUser;
    const { router } = renderRoutes(
      [
        { path: '/403', element: <ErrorPage status={403} /> },
        { path: '/stock', element: <p>Stok</p> },
      ],
      '/403',
    );

    expect(screen.getByText('Erişim yetkiniz yok')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ana Sayfaya Dön' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/stock'));
  });

  it('offers the login page to visitors', async () => {
    const { router } = renderRoutes(
      [
        { path: '*', element: <ErrorPage status={404} /> },
        { path: '/login', element: <p>Giriş</p> },
      ],
      '/yok',
    );

    expect(screen.getByText('Sayfa bulunamadı')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('RouteError', () => {
  beforeEach(() => {
    // Yönlendiricinin yakaladığı hata konsola yazılır; test çıktısını kirletmesin.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('suggests a reload when a lazy page chunk failed to load', () => {
    renderRoutes(
      [
        {
          path: '/',
          errorElement: <RouteError />,
          element: <Thrower error={new TypeError('Failed to fetch dynamically imported module: /assets/x.js')} />,
        },
      ],
      '/',
    );

    expect(screen.getByText('Sayfa yüklenemedi')).toBeInTheDocument();
    expect(screen.getByText('Uygulama güncellenmiş olabilir. Sayfayı yenileyip tekrar deneyin.')).toBeInTheDocument();
  });

  it('shows a generic message for other errors', () => {
    renderRoutes(
      [{ path: '/', errorElement: <RouteError />, element: <Thrower error={new Error('beklenmeyen')} /> }],
      '/',
    );

    expect(screen.getByText('Beklenmeyen bir hata oluştu. Sayfayı yenileyip tekrar deneyin.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sayfayı Yenile' })).toBeInTheDocument();
  });
});
