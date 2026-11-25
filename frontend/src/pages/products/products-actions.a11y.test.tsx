import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '@/api/client';
import type { Category, Product } from '@/api/types';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import { ProductFormModal } from './ProductFormModal';
import { ProductsPage } from './ProductsPage';

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

const electronics: Category = {
  id: 1,
  name: 'Elektronik',
  color: '#6366F1',
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  product_count: 12,
};

const mouse: Product = {
  id: 7,
  sku: 'ELK-0001',
  name: 'Kablosuz Mouse',
  description: null,
  category: { id: 1, name: 'Elektronik', color: '#6366F1' },
  sale_price: '349.90',
  cost_price: '200.00',
  stock: 3,
  min_stock: 10,
  stock_status: 'critical',
  image_url: null,
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};

function mockGet(products: Product[]) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/categories') return { data: [electronics] };
    if (url === '/products') return { data: { items: products, total: products.length, page: 1, page_size: 20 } };
    if (url === '/products/next-sku') return { data: { sku: 'ELK-0002' } };
    throw new Error(`unexpected GET ${url}`);
  });
}

async function productRow() {
  return (await screen.findByText('Kablosuz Mouse')).closest('tr') as HTMLElement;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ProductsPage actions', () => {
  it('renders row actions as focusable buttons', async () => {
    mockGet([mouse]);
    renderRoutes([{ path: '/products', element: <ProductsPage /> }], '/products');

    const row = await productRow();
    for (const name of ['Düzenle', 'Pasife Al']) {
      const button = within(row).getByRole('button', { name });
      button.focus();
      expect(button).toHaveFocus();
    }
    expect(document.title).toBe('Ürünler · Akıllı ERP');
  });

  it('deactivates after confirmation and refreshes the critical stock count', async () => {
    mockGet([mouse]);
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
    const { queryClient } = renderRoutes([{ path: '/products', element: <ProductsPage /> }], '/products');
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(within(await productRow()).getByRole('button', { name: 'Pasife Al' }));
    const popup = (await screen.findByText('Ürün pasife alınsın mı?')).closest('.ant-popover') as HTMLElement;
    fireEvent.click(within(popup).getByRole('button', { name: 'Pasife Al' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/products/7/status', { is_active: false }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['stock'] }));
  });

  it('activates an inactive product and refreshes the count', async () => {
    mockGet([{ ...mouse, is_active: false }]);
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
    const { queryClient } = renderRoutes([{ path: '/products', element: <ProductsPage /> }], '/products');
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(within(await productRow()).getByRole('button', { name: 'Aktifleştir' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/products/7/status', { is_active: true }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['stock'] }));
  });

  it('opens the edit form from the row', async () => {
    mockGet([mouse]);
    renderRoutes([{ path: '/products', element: <ProductsPage /> }], '/products');

    fireEvent.click(within(await productRow()).getByRole('button', { name: 'Düzenle' }));

    expect(await screen.findByText('Ürünü Düzenle')).toBeInTheDocument();
  });
});

describe('ProductFormModal stock refresh', () => {
  it('refreshes the critical stock count after saving a product', async () => {
    mockGet([]);
    vi.spyOn(api, 'put').mockResolvedValue({ data: { ...mouse, min_stock: 2 } });
    const onSaved = vi.fn();
    const { queryClient } = renderRoutes(
      [{ path: '/', element: <ProductFormModal open product={mouse} onOpenChange={vi.fn()} onSaved={onSaved} /> }],
      '/',
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(await screen.findByRole('button', { name: 'Kaydet' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['stock'] });
  });
});
