import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';
import { api, ApiError, tokenStorage } from '@/api/client';
import type { CurrentUser } from '@/api/types';
import { AuthProvider } from './AuthProvider';
import { RequireAuth } from './guards';

const admin: CurrentUser = {
  id: 1,
  full_name: 'Elif Yılmaz',
  email: 'yonetici@example.com',
  role: 'admin',
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  last_login_at: null,
  customer: null,
};

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/orders',
        element: (
          <RequireAuth>
            <p>Siparişler</p>
          </RequireAuth>
        ),
      },
      { path: '/login', element: <p>Giriş sayfası</p> },
    ],
    { initialEntries: ['/orders'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('session check failures', () => {
  it.each([
    ['a network error', new ApiError(0, 'NETWORK_ERROR', 'Sunucuya ulaşılamıyor.')],
    ['a server error', new ApiError(503, 'ERROR', 'Hizmet geçici olarak kullanılamıyor.')],
  ])('keeps the session and offers a retry after %s', async (_, error) => {
    tokenStorage.set('abc');
    const get = vi.spyOn(api, 'get').mockRejectedValueOnce(error).mockResolvedValueOnce({ data: admin });

    const router = renderApp();

    expect(await screen.findByText('Sunucuya ulaşılamıyor')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/orders');
    expect(tokenStorage.get()).toBe('abc');

    fireEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));

    expect(await screen.findByText('Siparişler')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('ends the session only on 401', async () => {
    tokenStorage.set('expired');
    vi.spyOn(api, 'get').mockRejectedValue(new ApiError(401, 'INVALID_TOKEN', 'Oturumunuzun süresi doldu.'));

    const router = renderApp();

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(screen.queryByText('Sunucuya ulaşılamıyor')).not.toBeInTheDocument();
  });
});
