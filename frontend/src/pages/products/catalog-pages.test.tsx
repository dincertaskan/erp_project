import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { Category, CurrentUser, Product } from '@/api/types';
import type { AuthContextValue } from '@/auth/context';
import { CategoriesPage } from '@/pages/categories/CategoriesPage';
import { renderRoutes } from '@/test/render';
import type { UserRole } from '@/utils/labels';
import { ProductFormModal } from './ProductFormModal';
import { ProductsPage } from './ProductsPage';

const auth: AuthContextValue = {
  user: null,
  isLoading: false,
  sessionExpired: false,
  signedOut: false,
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));

function signIn(role: UserRole) {
  auth.user = {
    id: 1,
    full_name: 'Test',
    email: 'test@example.com',
    role,
    is_active: true,
    created_at: '2026-11-01T10:00:00Z',
    last_login_at: null,
    customer: null,
  } satisfies CurrentUser;
}

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
  cost_price: '420.00',
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
    throw new Error(`unexpected GET ${url}`);
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ProductsPage', () => {
  it('shows cost and management actions to admins', async () => {
    signIn('admin');
    mockGet([mouse]);
    renderRoutes([{ path: '/products', element: <ProductsPage /> }], '/products');

    expect(await screen.findByText('Kablosuz Mouse')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Maliyet/ })).toBeInTheDocument();
    expect(screen.getByText('420,00 ₺')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yeni Ürün/ })).toBeInTheDocument();
  });

  it('is read-only for warehouse staff and hides cost', async () => {
    signIn('warehouse');
    const { cost_price: _cost, ...withoutCost } = mouse;
    mockGet([withoutCost]);
    renderRoutes([{ path: '/products', element: <ProductsPage /> }], '/products');

    expect(await screen.findByText('Kablosuz Mouse')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Maliyet/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Yeni Ürün/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Düzenle')).not.toBeInTheDocument();
  });

  it('asks the API for active products sorted by name by default', async () => {
    signIn('admin');
    const get = mockGet([]);
    renderRoutes([{ path: '/products', element: <ProductsPage /> }], '/products');

    await waitFor(() => expect(get).toHaveBeenCalledWith('/products', expect.anything()));
    const call = get.mock.calls.find(([url]) => url === '/products');
    expect(call?.[1]?.params).toMatchObject({ page: 1, page_size: 20, is_active: 'true', sort: 'name' });
  });
});

describe('ProductFormModal', () => {
  function renderModal(product: Product | null) {
    const onSaved = vi.fn();
    renderRoutes(
      [
        {
          path: '/',
          element: <ProductFormModal open product={product} onOpenChange={vi.fn()} onSaved={onSaved} />,
        },
      ],
      '/',
    );
    return onSaved;
  }

  it('warns when the sale price is below cost but still allows saving', async () => {
    signIn('admin');
    mockGet([]);
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: mouse });
    const onSaved = renderModal(mouse);

    expect(await screen.findByText('Satış fiyatı maliyetin altında (zararına satış).')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(put).toHaveBeenCalledWith(
      '/products/7',
      expect.objectContaining({ sku: 'ELK-0001', sale_price: '349.90', cost_price: '420.00' }),
    );
    expect(put.mock.calls[0][1]).not.toHaveProperty('initial_stock');
  });

  it('shows a taken SKU under the SKU field', async () => {
    signIn('admin');
    mockGet([]);
    vi.spyOn(api, 'put').mockRejectedValue(
      new ApiError(409, 'SKU_TAKEN', 'Bu SKU kullanılıyor.', [{ field: 'sku', message: 'Bu SKU kullanılıyor.' }]),
    );
    renderModal(mouse);

    fireEvent.click(await screen.findByRole('button', { name: 'Kaydet' }));

    const fieldError = await screen.findByText('Bu SKU kullanılıyor.');
    expect(fieldError.closest('.ant-form-item')).toHaveTextContent('SKU');
  });

  it('asks for the initial stock only when adding', async () => {
    signIn('admin');
    mockGet([]);
    renderModal(null);

    expect(await screen.findByLabelText('Başlangıç Stoku')).toBeInTheDocument();
    expect(screen.getByText('Boş bırakılırsa otomatik üretilir.')).toBeInTheDocument();
  });
});

describe('CategoriesPage', () => {
  it('warns how many active products a category has before deactivating', async () => {
    signIn('admin');
    mockGet([]);
    renderRoutes([{ path: '/categories', element: <CategoriesPage /> }], '/categories');

    const row = (await screen.findByText('Elektronik')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByText('Pasife Al'));

    expect(
      await screen.findByText('Bu kategoride 12 aktif ürün var. Ürünleri müşteri kataloğunda görünmez olur.'),
    ).toBeInTheDocument();
  });
});
