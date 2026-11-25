import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '@/api/client';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import { OrdersPage } from './OrdersPage';

const auth: AuthContextValue = {
  user: {
    id: 1,
    full_name: 'Elif Yılmaz',
    email: 'yonetici@example.com',
    role: 'admin',
    is_active: true,
    created_at: '2026-11-01T10:00:00Z',
    last_login_at: null,
    customer: null,
  },
  isLoading: false,
  sessionExpired: false,
  signedOut: false,
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('OrdersPage address state', () => {
  it('opens the tab and page given in the address', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({
      data: { items: [], total: 120, page: 3, page_size: 20, counts_by_status: { shipped: 120 } },
    });
    renderRoutes([{ path: '/orders', element: <OrdersPage /> }], '/orders?status=shipped&page=3');

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls[0][1]?.params).toMatchObject({ status: 'shipped', page: 3, page_size: 20 });
  });

  it('keeps the chosen tab in the address and starts it from the first page', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({
      data: { items: [], total: 0, page: 1, page_size: 20, counts_by_status: {} },
    });
    const { router } = renderRoutes([{ path: '/orders', element: <OrdersPage /> }], '/orders?page=2');
    await waitFor(() => expect(get).toHaveBeenCalled());

    fireEvent.click(await screen.findByText('Kargolandı'));

    await waitFor(() => expect(router.state.location.search).toBe('?status=shipped'));
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/orders', {
        params: expect.objectContaining({ status: 'shipped', page: 1 }),
      }),
    );
  });
});
