import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { AxiosRequestConfig } from 'axios';
import { vi } from 'vitest';
import { api } from '@/api/client';
import type { Product } from '@/api/types';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import { NewOrderPage } from './NewOrderPage';

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

const product = (id: number, name: string) =>
  ({ id, sku: `SKU-${id}`, name, sale_price: '10.00', stock: 5, min_stock: 1 }) as Product;

const page = (items: Product[]) => ({ data: { items, total: items.length, page: 1, page_size: 20 } });

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

function searchTerm(config?: AxiosRequestConfig) {
  return (config?.params as { search?: string } | undefined)?.search ?? '';
}

describe('NewOrderPage product search', () => {
  it('waits until typing pauses and only searches for the last term', async () => {
    const get = vi.spyOn(api, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
      if (url === '/products') return page([product(1, `Sonuç ${searchTerm(config) || 'hepsi'}`)]);
      return page([]);
    });
    renderRoutes([{ path: '/orders/new', element: <NewOrderPage /> }], '/orders/new');
    const productSelect = screen.getAllByRole('combobox')[1];
    fireEvent.focus(productSelect);
    fireEvent.mouseDown(productSelect);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    vi.useFakeTimers();
    for (const value of ['k', 'kl', 'kla']) fireEvent.change(productSelect, { target: { value } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(get).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    vi.useRealTimers();

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(searchTerm(get.mock.calls[1][1])).toBe('kla');
  });

  it('ignores a slow answer for an older term', async () => {
    let answerSlow: (value: unknown) => void = () => {};
    vi.spyOn(api, 'get').mockImplementation((url: string, config?: AxiosRequestConfig) => {
      const term = searchTerm(config);
      if (url !== '/products') return Promise.resolve(page([]));
      if (term === 'mou') return new Promise((resolve) => (answerSlow = resolve));
      return Promise.resolve(page([product(term === 'mouse' ? 2 : 3, term === 'mouse' ? 'Kablosuz Mouse' : 'Hepsi')]));
    });
    renderRoutes([{ path: '/orders/new', element: <NewOrderPage /> }], '/orders/new');
    const productSelect = screen.getAllByRole('combobox')[1];
    fireEvent.focus(productSelect);
    fireEvent.mouseDown(productSelect);
    expect(await screen.findByTitle('SKU-3 · Hepsi · Stok: 5')).toBeInTheDocument();

    fireEvent.change(productSelect, { target: { value: 'mou' } });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2), { timeout: 2000 });
    fireEvent.change(productSelect, { target: { value: 'mouse' } });
    expect(await screen.findByTitle('SKU-2 · Kablosuz Mouse · Stok: 5', {}, { timeout: 2000 })).toBeInTheDocument();

    await act(async () => {
      answerSlow(page([product(4, 'Eski Sonuç')]));
    });

    expect(screen.queryByTitle('SKU-4 · Eski Sonuç · Stok: 5')).not.toBeInTheDocument();
    expect(screen.getByTitle('SKU-2 · Kablosuz Mouse · Stok: 5')).toBeInTheDocument();
  });

  it('limits the quantity to what the server accepts', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(page([]));
    renderRoutes([{ path: '/orders/new', element: <NewOrderPage /> }], '/orders/new');

    expect(screen.getByLabelText('Adet')).toHaveAttribute('aria-valuemax', '10000');
  });
});
