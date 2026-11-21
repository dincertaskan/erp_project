import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { CatalogProduct, MyOrderDetail } from '@/api/shop';
import type { AuthContextValue } from '@/auth/context';
import { cartStore } from '@/cart/cartStore';
import { renderRoutes } from '@/test/render';
import { CartPage } from './CartPage';
import { MyOrderCancelButton } from './MyOrderCancelButton';
import { MyOrderDetailPage } from './MyOrderDetailPage';
import { ShopProductCard } from './ShopProductCard';

const auth: AuthContextValue = {
  user: {
    id: 9,
    full_name: 'Can Demir',
    email: 'musteri@example.com',
    role: 'customer',
    is_active: true,
    created_at: '2026-11-01T10:00:00Z',
    last_login_at: null,
    customer: { id: 3, phone: null, company_name: null, address: 'Örnek Mah. No: 1', city: 'İstanbul' },
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
  availability: 'low_stock',
  available_qty: 3,
};

beforeEach(() => {
  vi.restoreAllMocks();
  cartStore.clearAll();
});

describe('cartStore', () => {
  it('keeps carts per user and never exceeds the available quantity', () => {
    cartStore.add(9, mouse, 2);
    cartStore.add(9, mouse, 5);
    cartStore.add(10, mouse, 1);

    expect(cartStore.get(9)).toMatchObject([{ productId: 7, quantity: 3, price: '100.00' }]);
    expect(cartStore.get(10)).toMatchObject([{ quantity: 1 }]);
  });

  it('is wiped on sign-out', () => {
    cartStore.add(9, mouse, 1);

    cartStore.clearAll();

    expect(cartStore.get(9)).toEqual([]);
  });
});

describe('ShopProductCard', () => {
  it('cannot add an out-of-stock product', () => {
    renderRoutes(
      [
        {
          path: '/',
          element: <ShopProductCard product={{ ...mouse, availability: 'out_of_stock', available_qty: 0 }} />,
        },
      ],
      '/',
    );

    expect(screen.getByText('Stokta yok')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stokta Yok/ })).toBeDisabled();
  });
});

describe('CartPage', () => {
  it('marks changed prices and blocks checkout until updated', async () => {
    cartStore.add(9, mouse, 1);
    vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        products: [{ ...mouse, sale_price: '120.00' }],
        issues: [
          {
            product_id: 7,
            issue: 'price_changed',
            message: 'Fiyat 100.00 ₺ → 120.00 ₺ olarak güncellendi.',
            old_price: '100.00',
            new_price: '120.00',
            available_qty: null,
          },
        ],
      },
    });
    renderRoutes([{ path: '/shop/cart', element: <CartPage /> }], '/shop/cart');

    expect(await screen.findByText('Fiyat 100.00 ₺ → 120.00 ₺ olarak güncellendi.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siparişi Tamamla' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Güncelle' }));

    await waitFor(() => expect(cartStore.get(9)[0].price).toBe('120.00'));
  });

  it('places the order with the saved address, clears the cart and shows the confirmation', async () => {
    cartStore.add(9, mouse, 2);
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/me/cart/validate') return { data: { products: [mouse], issues: [] } };
      return { data: { id: 55 } };
    });
    const { router } = renderRoutes(
      [
        { path: '/shop/cart', element: <CartPage /> },
        { path: '/shop/orders/:id', element: <p>Sipariş sayfası</p> },
      ],
      '/shop/cart',
    );

    expect(await screen.findByDisplayValue('Örnek Mah. No: 1, İstanbul')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Kapıda Ödeme'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Siparişi Tamamla' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Siparişi Tamamla' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/shop/orders/55'));
    expect(router.state.location.search).toBe('?new=1');
    expect(post).toHaveBeenCalledWith('/me/orders', {
      payment_method: 'cash_on_delivery',
      shipping_address: 'Örnek Mah. No: 1, İstanbul',
      note: null,
      items: [{ product_id: 7, quantity: 2, expected_price: '100.00' }],
    });
    expect(cartStore.get(9)).toEqual([]);
  });

  it('updates the line total and revalidates when the quantity changes', async () => {
    cartStore.add(9, mouse, 1);
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { products: [mouse], issues: [] } });
    renderRoutes([{ path: '/shop/cart', element: <CartPage /> }], '/shop/cart');

    fireEvent.change(await screen.findByLabelText('Kablosuz Mouse adedi'), { target: { value: '3' } });

    await waitFor(() => expect(cartStore.get(9)[0].quantity).toBe(3));
    expect(screen.getAllByText(/300,00/).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith('/me/cart/validate', {
        items: [{ product_id: 7, quantity: 3, expected_price: '100.00' }],
      }),
    );
  });

  it('does not accept a quantity above the available stock or below one', async () => {
    cartStore.add(9, mouse, 2);
    vi.spyOn(api, 'post').mockResolvedValue({ data: { products: [mouse], issues: [] } });
    renderRoutes([{ path: '/shop/cart', element: <CartPage /> }], '/shop/cart');
    const input = await screen.findByLabelText('Kablosuz Mouse adedi');

    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);
    await waitFor(() => expect(cartStore.get(9)[0].quantity).toBe(3));

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    await waitFor(() => expect(cartStore.get(9)[0].quantity).toBe(1));
  });

  it('removes a line and falls back to the empty state', async () => {
    cartStore.add(9, mouse, 1);
    vi.spyOn(api, 'post').mockResolvedValue({ data: { products: [mouse], issues: [] } });
    renderRoutes([{ path: '/shop/cart', element: <CartPage /> }], '/shop/cart');

    fireEvent.click(await screen.findByRole('button', { name: 'Kablosuz Mouse sepetten çıkar' }));

    expect(await screen.findByText('Sepetiniz boş')).toBeInTheDocument();
    expect(cartStore.get(9)).toEqual([]);
  });

  it('empties the cart after confirmation', async () => {
    cartStore.add(9, mouse, 1);
    vi.spyOn(api, 'post').mockResolvedValue({ data: { products: [mouse], issues: [] } });
    renderRoutes([{ path: '/shop/cart', element: <CartPage /> }], '/shop/cart');

    fireEvent.click(await screen.findByRole('button', { name: 'Sepeti Boşalt' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Boşalt' }));

    expect(await screen.findByText('Sepetiniz boş')).toBeInTheDocument();
  });

  it('locks the quantity of a product that is no longer sold', async () => {
    cartStore.add(9, mouse, 1);
    vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        products: [],
        issues: [
          {
            product_id: 7,
            issue: 'not_available',
            message: 'Bu ürün artık satışta değil.',
            old_price: null,
            new_price: null,
            available_qty: 0,
          },
        ],
      },
    });
    renderRoutes([{ path: '/shop/cart', element: <CartPage /> }], '/shop/cart');

    expect(await screen.findByText('Bu ürün artık satışta değil.')).toBeInTheDocument();
    expect(screen.getByLabelText('Kablosuz Mouse adedi')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siparişi Tamamla' })).toBeDisabled();
  });

  it('revalidates the cart when the server says it changed during checkout', async () => {
    cartStore.add(9, mouse, 1);
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/me/cart/validate') return { data: { products: [mouse], issues: [] } };
      throw new ApiError(409, 'CART_CHANGED', 'Sepetinizdeki ürünler değişti.');
    });
    renderRoutes([{ path: '/shop/cart', element: <CartPage /> }], '/shop/cart');

    fireEvent.click(await screen.findByLabelText('Havale/EFT'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Siparişi Tamamla' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Siparişi Tamamla' }));

    expect(await screen.findByText('Sepetinizdeki ürünler değişti.')).toBeInTheDocument();
    await waitFor(() =>
      expect(post.mock.calls.filter(([url]) => url === '/me/cart/validate').length).toBeGreaterThanOrEqual(2),
    );
    expect(cartStore.get(9)).toHaveLength(1);
  });

  it('shows an empty state', () => {
    renderRoutes([{ path: '/shop/cart', element: <CartPage /> }], '/shop/cart');

    expect(screen.getByText('Sepetiniz boş')).toBeInTheDocument();
  });
});

describe('MyOrderDetailPage', () => {
  it('confirms a new order and lets the customer cancel it while pending', async () => {
    const order: MyOrderDetail = {
      id: 55,
      order_code: 'SIP-2026-000055',
      created_at: '2026-11-21T10:00:00Z',
      status: 'pending',
      total_amount: '200.00',
      item_count: 1,
      preview: [],
      can_cancel: true,
      items: [
        {
          product_id: 7,
          sku: 'ELK-0001',
          name: 'Kablosuz Mouse',
          image_url: null,
          quantity: 2,
          unit_price: '100.00',
          line_total: '200.00',
        },
      ],
      payment_method: 'cash_on_delivery',
      shipping_address: 'Örnek Mah. No: 1, İstanbul',
      note: null,
      timeline: [{ status: 'pending', at: '2026-11-21T10:00:00Z' }],
    };
    vi.spyOn(api, 'get').mockResolvedValue({ data: order });
    renderRoutes([{ path: '/shop/orders/:id', element: <MyOrderDetailPage /> }], '/shop/orders/55?new=1');

    expect(await screen.findByText('Siparişiniz alındı!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'İptal Et' })).toBeInTheDocument();
    expect(screen.getByText('Kapıda Ödeme')).toBeInTheDocument();
  });
});

describe('MyOrderCancelButton', () => {
  const order = { id: 55, order_code: 'SIP-2026-000055', can_cancel: true };

  async function confirmCancel() {
    fireEvent.click(screen.getByRole('button', { name: 'İptal Et' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('SIP-2026-000055 iptal edilsin mi?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'İptal Et' }));
  }

  it('is hidden once the order can no longer be cancelled', () => {
    renderRoutes([{ path: '/', element: <MyOrderCancelButton order={{ ...order, can_cancel: false }} /> }], '/');

    expect(screen.queryByRole('button', { name: 'İptal Et' })).not.toBeInTheDocument();
  });

  it('cancels after confirmation and reports back', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 55, status: 'cancelled' } });
    const onCancelled = vi.fn();
    renderRoutes([{ path: '/', element: <MyOrderCancelButton order={order} onCancelled={onCancelled} /> }], '/');

    await confirmCancel();

    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith({ id: 55, status: 'cancelled' }));
    expect(post).toHaveBeenCalledWith('/me/orders/55/cancel');
    expect(await screen.findByText('Siparişiniz iptal edildi.')).toBeInTheDocument();
  });

  it('explains why when the order was approved in the meantime', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError(409, 'INVALID_TRANSITION', 'Onaylanan sipariş iptal edilemez.'),
    );
    const onCancelled = vi.fn();
    renderRoutes([{ path: '/', element: <MyOrderCancelButton order={order} onCancelled={onCancelled} /> }], '/');

    await confirmCancel();

    expect(await screen.findByText('Onaylanan sipariş iptal edilemez.')).toBeInTheDocument();
    expect(onCancelled).not.toHaveBeenCalled();
  });
});
