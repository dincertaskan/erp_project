import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { CatalogProduct } from '@/api/shop';
import type { AuthContextValue } from '@/auth/context';
import { cartStore } from '@/cart/cartStore';
import { renderRoutes } from '@/test/render';
import { AvailabilityText, ProductImage, ShopProductCard } from './ShopProductCard';

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
  image_url: 'https://example.com/mouse.jpg',
  availability: 'in_stock',
  available_qty: 30,
};

beforeEach(() => {
  cartStore.clearAll();
});

describe('ShopProductCard keyboard access', () => {
  it('links the product name to the detail page', async () => {
    const { router } = renderRoutes(
      [
        { path: '/shop', element: <ShopProductCard product={mouse} /> },
        { path: '/shop/products/:id', element: <p>Ürün detayı</p> },
      ],
      '/shop',
    );

    const link = screen.getByRole('link', { name: 'Kablosuz Mouse' });
    expect(link).toHaveAttribute('href', '/shop/products/7');
    link.focus();
    expect(link).toHaveFocus();

    fireEvent.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe('/shop/products/7'));
  });

  it('adds to the cart without opening the detail page', () => {
    const { router } = renderRoutes(
      [
        { path: '/shop', element: <ShopProductCard product={mouse} /> },
        { path: '/shop/products/:id', element: <p>Ürün detayı</p> },
      ],
      '/shop',
    );

    fireEvent.click(screen.getByRole('button', { name: /Sepete Ekle/ }));

    expect(cartStore.get(9)).toMatchObject([{ productId: 7, quantity: 1 }]);
    expect(router.state.location.pathname).toBe('/shop');
  });
});

describe('ProductImage', () => {
  it('loads lazily with a fixed height', () => {
    render(<ProductImage src="https://example.com/mouse.jpg" alt="Kablosuz Mouse" height={180} />);

    const image = screen.getByRole('img', { name: 'Kablosuz Mouse' });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('height', '180');
  });

  it('falls back to the placeholder when the image cannot be loaded', () => {
    const { container } = render(
      <ProductImage src="https://example.com/broken.jpg" alt="Kablosuz Mouse" height={180} />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Kablosuz Mouse' }));

    expect(screen.queryByRole('img', { name: 'Kablosuz Mouse' })).not.toBeInTheDocument();
    expect(container.querySelector('.anticon-picture')).toBeInTheDocument();
  });

  it('tries again when the address changes', () => {
    const { rerender } = render(<ProductImage src="https://example.com/a.jpg" alt="Mouse" height={120} />);
    fireEvent.error(screen.getByRole('img', { name: 'Mouse' }));

    rerender(<ProductImage src="https://example.com/b.jpg" alt="Mouse" height={120} />);

    expect(screen.getByRole('img', { name: 'Mouse' })).toHaveAttribute('src', 'https://example.com/b.jpg');
  });
});

describe('AvailabilityText', () => {
  it.each([
    ['in_stock', 30, 'Stokta', 'rgb(4, 120, 87)'],
    ['low_stock', 2, 'Son 2 ürün', 'rgb(180, 83, 9)'],
    ['out_of_stock', 0, 'Stokta Yok', 'rgb(100, 116, 139)'],
  ] as const)('uses readable colours for %s', (availability, qty, text, color) => {
    render(<AvailabilityText product={{ availability, available_qty: qty }} />);

    expect(screen.getByText(text)).toHaveStyle({ color });
  });
});
