import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AxiosRequestConfig } from 'axios';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { CatalogProduct, MyOrderDetail } from '@/api/shop';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import { MyOrderDetailPage } from './MyOrderDetailPage';
import { MyOrdersPage } from './MyOrdersPage';
import { ShopCatalogPage } from './ShopCatalogPage';
import { ShopProductPage } from './ShopProductPage';

const auth: AuthContextValue = {
  user: {
    id: 9,
    full_name: 'Can Demir',
    email: 'musteri@example.com',
    role: 'customer',
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

const mouse: CatalogProduct = {
  id: 7,
  sku: 'ELK-0001',
  name: 'Kablosuz Mouse',
  description: null,
  category: { id: 1, name: 'Elektronik', color: '#6366F1' },
  sale_price: '100.00',
  image_url: null,
  availability: 'in_stock',
  available_qty: 10,
};

const order: MyOrderDetail = {
  id: 55,
  order_code: 'SIP-2026-000055',
  created_at: '2026-11-21T10:00:00Z',
  status: 'pending',
  total_amount: '200.00',
  item_count: 1,
  preview: [],
  can_cancel: false,
  items: [],
  payment_method: 'cash_on_delivery',
  shipping_address: null,
  note: null,
  timeline: [{ status: 'pending', at: '2026-11-21T10:00:00Z' }],
};

const emptyPage = { items: [], total: 0, page: 1, page_size: 10 };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('MyOrdersPage', () => {
  it('reads the status and page from the address and writes changes back', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { ...emptyPage, total: 30 } });
    const { router } = renderRoutes(
      [{ path: '/shop/orders', element: <MyOrdersPage /> }],
      '/shop/orders?status=completed&page=2',
    );

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls[0][1]?.params).toMatchObject({ status_group: 'completed', page: 2 });

    fireEvent.click(await screen.findByText('İptal'));

    await waitFor(() => expect(router.state.location.search).toBe('?status=cancelled'));
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/me/orders', {
        params: expect.objectContaining({ status_group: 'cancelled', page: 1 }),
      }),
    );
  });

  it('shows an error with a retry instead of loading forever', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Sunucuya ulaşılamıyor.'))
      .mockResolvedValue({ data: emptyPage });
    renderRoutes([{ path: '/shop/orders', element: <MyOrdersPage /> }], '/shop/orders');

    expect(await screen.findByText('Siparişleriniz yüklenemedi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));

    expect(await screen.findByText('Henüz siparişiniz yok.')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe('ShopCatalogPage', () => {
  function mockCatalog() {
    return vi.spyOn(api, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
      if (url === '/catalog/categories') return { data: [{ ...mouse.category, product_count: 1 }] };
      // Aramada sonuç çıkmazsa boş durumdaki "Filtreleri Temizle" düğmesi görünür.
      const search = (config?.params as { search?: string } | undefined)?.search;
      const items = search === 'klavye' ? [] : [mouse];
      return { data: { items, total: items.length, page: 1, page_size: 12, min_price: '100', max_price: '100' } };
    });
  }

  it('restores search, category, sort and page from the address', async () => {
    const get = mockCatalog();
    renderRoutes([{ path: '/shop', element: <ShopCatalogPage /> }], '/shop?q=mouse&category=1&sort=price_asc&page=2');

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/catalog/products', {
        params: expect.objectContaining({ search: 'mouse', category_id: 1, sort: 'price_asc', page: 2 }),
      }),
    );
    expect(screen.getByPlaceholderText('Ürün ara')).toHaveValue('mouse');
  });

  it('clears the search box together with the filters', async () => {
    mockCatalog();
    const { router } = renderRoutes([{ path: '/shop', element: <ShopCatalogPage /> }], '/shop');
    const input = await screen.findByPlaceholderText('Ürün ara');

    fireEvent.change(input, { target: { value: 'klavye' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    await waitFor(() => expect(router.state.location.search).toBe('?q=klavye'));

    fireEvent.click(await screen.findByRole('button', { name: 'Filtreleri Temizle' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(input).toHaveValue('');
  });
});

describe('MyOrderDetailPage', () => {
  it('shows the confirmation once and removes the flag from the address', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: order });
    const { router } = renderRoutes(
      [{ path: '/shop/orders/:id', element: <MyOrderDetailPage /> }],
      '/shop/orders/55?new=1',
    );

    expect(await screen.findByText('Siparişiniz alındı!')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.getByText('Siparişiniz alındı!')).toBeInTheDocument();
  });

  it('tells a missing order apart from a failed request', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Sipariş bulunamadı.'));
    renderRoutes([{ path: '/shop/orders/:id', element: <MyOrderDetailPage /> }], '/shop/orders/99');

    expect(await screen.findByText('Sipariş bulunamadı')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tekrar Dene' })).not.toBeInTheDocument();
  });

  it('offers a retry when the request fails', async () => {
    vi.spyOn(api, 'get')
      .mockRejectedValueOnce(new ApiError(500, 'ERROR', 'Sunucu hatası.'))
      .mockResolvedValue({ data: order });
    renderRoutes([{ path: '/shop/orders/:id', element: <MyOrderDetailPage /> }], '/shop/orders/55');

    expect(await screen.findByText('Sipariş yüklenemedi')).toBeInTheDocument();
    expect(screen.getByText('Sunucu hatası.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));

    expect(await screen.findByText('Sipariş SIP-2026-000055')).toBeInTheDocument();
  });
});

describe('ShopProductPage', () => {
  it('says the product is no longer sold only on 404', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Ürün bulunamadı.'));
    renderRoutes([{ path: '/shop/products/:id', element: <ShopProductPage /> }], '/shop/products/7');

    expect(await screen.findByText('Bu ürün artık satışta değil.')).toBeInTheDocument();
  });

  it('shows the server error with a retry otherwise', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Sunucuya ulaşılamıyor.'));
    renderRoutes([{ path: '/shop/products/:id', element: <ShopProductPage /> }], '/shop/products/7');

    expect(await screen.findByText('Ürün yüklenemedi')).toBeInTheDocument();
    expect(screen.getByText('Sunucuya ulaşılamıyor.')).toBeInTheDocument();
    expect(screen.queryByText('Bu ürün artık satışta değil.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tekrar Dene' })).toBeInTheDocument();
  });
});
