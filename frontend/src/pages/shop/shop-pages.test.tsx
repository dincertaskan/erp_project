import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '@/api/client';
import type { CatalogProduct, MyOrderDetail } from '@/api/shop';
import type { AuthContextValue } from '@/auth/context';
import { cartStore } from '@/cart/cartStore';
import { renderRoutes } from '@/test/render';
import { CartPage } from './CartPage';
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
