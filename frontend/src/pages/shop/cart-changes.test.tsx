import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '@/api/client';
import type { CatalogProduct, CartIssue } from '@/api/shop';
import type { AuthContextValue } from '@/auth/context';
import { cartStore } from '@/cart/cartStore';
import { renderRoutes } from '@/test/render';
import { CartPage } from './CartPage';

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
const keyboard: CatalogProduct = { ...mouse, id: 8, sku: 'ELK-0002', name: 'Klavye', sale_price: '250.00' };
const cable: CatalogProduct = { ...mouse, id: 9, sku: 'ELK-0003', name: 'Kablo', sale_price: '50.00' };

const issue = (product_id: number, type: CartIssue['issue'], available_qty: number | null): CartIssue => ({
  product_id,
  issue: type,
  message: `Sorun ${product_id}`,
  old_price: null,
  new_price: null,
  available_qty,
});

beforeEach(() => {
  vi.restoreAllMocks();
  cartStore.clearAll();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CartPage changes', () => {
  it('removes lines that cannot be bought and refreshes the rest on update', async () => {
    cartStore.add(9, mouse, 1);
    cartStore.add(9, keyboard, 1);
    cartStore.add(9, cable, 2);
    vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        products: [
          { ...keyboard, available_qty: 0, availability: 'out_of_stock' },
          { ...cable, sale_price: '60.00' },
        ],
        issues: [issue(7, 'not_available', 0), issue(8, 'insufficient_stock', 0), issue(9, 'price_changed', null)],
      },
    });
    renderRoutes([{ path: '/shop/cart', element: <CartPage /> }], '/shop/cart');

    expect(await screen.findByText(/stoğu tükenen 2 ürün sepetten çıkarılacak/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Güncelle' }));

    await waitFor(() => expect(cartStore.get(9)).toHaveLength(1));
    expect(cartStore.get(9)[0]).toMatchObject({ productId: 9, price: '60.00', quantity: 2 });
  });

  it('waits for the quantity to settle before validating again', async () => {
    cartStore.add(9, mouse, 1);
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { products: [mouse], issues: [] } });
    renderRoutes([{ path: '/shop/cart', element: <CartPage /> }], '/shop/cart');
    const input = await screen.findByLabelText('Kablosuz Mouse adedi');
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));

    vi.useFakeTimers();
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.change(input, { target: { value: '4' } });
    expect(screen.getByRole('button', { name: 'Siparişi Tamamla' })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(post).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    vi.useRealTimers();

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post).toHaveBeenLastCalledWith('/me/cart/validate', {
      items: [{ product_id: 7, quantity: 4, expected_price: '100.00' }],
    });
  });
});

describe('cartStore storage', () => {
  it.each(['{"productId":7}', '42', '"metin"', 'null', '{bozuk'])('treats %s in storage as an empty cart', (raw) => {
    localStorage.setItem('erp.cart.9', raw);

    expect(cartStore.get(9)).toEqual([]);
    cartStore.add(9, mouse, 1);
    expect(cartStore.get(9)).toHaveLength(1);
  });
});
