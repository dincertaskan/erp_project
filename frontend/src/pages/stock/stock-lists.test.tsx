import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '@/api/client';
import type { Category, CriticalProduct, CurrentUser, Page, StockMovementListItem, User } from '@/api/types';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import type { UserRole } from '@/utils/labels';
import { CriticalStockPage } from './CriticalStockPage';
import { StockMovementsPage } from './StockMovementsPage';

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
    id: 2,
    full_name: 'Ayşe Kaya',
    email: 'depo@example.com',
    role,
    is_active: true,
    created_at: '2026-11-01T10:00:00Z',
    last_login_at: null,
    customer: null,
  } satisfies CurrentUser;
}

const page = <T,>(items: T[]): Page<T> => ({ items, total: items.length, page: 1, page_size: 20 });

const electronics: Category = {
  id: 1,
  name: 'Elektronik',
  color: '#6366F1',
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  product_count: 12,
};

const movement: StockMovementListItem = {
  id: 51,
  movement_type: 'out',
  quantity: 3,
  previous_stock: 15,
  new_stock: 12,
  description: 'Sayım farkı',
  created_at: '2026-11-20T09:30:00Z',
  user: { id: 2, full_name: 'Ayşe Kaya' },
  order: null,
  product: { id: 7, sku: 'ELK-0001', name: 'Kablosuz Mouse' },
};

const orderMovement: StockMovementListItem = {
  ...movement,
  id: 52,
  movement_type: 'order_out',
  quantity: 1,
  description: null,
  order: { id: 12, order_code: 'SIP-2026-0012' },
};

const staff: User = {
  id: 2,
  full_name: 'Ayşe Kaya',
  email: 'depo@example.com',
  role: 'warehouse',
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  last_login_at: null,
};

const customerUser: User = { ...staff, id: 9, full_name: 'Can Demir', role: 'customer' };

const lowMouse: CriticalProduct = {
  id: 7,
  sku: 'ELK-0001',
  name: 'Kablosuz Mouse',
  description: null,
  category: { id: 1, name: 'Elektronik', color: '#6366F1' },
  sale_price: '349.90',
  stock: 2,
  min_stock: 10,
  stock_status: 'critical',
  image_url: null,
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  shortage: 8,
  sold_last_30_days: 1200,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('StockMovementsPage', () => {
  function mockGet(items: StockMovementListItem[] = [movement, orderMovement]) {
    return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/stock/movements') return { data: page(items) };
      if (url === '/products') return { data: page([]) };
      if (url === '/users') return { data: page([staff, customerUser]) };
      throw new Error(`unexpected GET ${url}`);
    });
  }

  function lastMovementParams(get: ReturnType<typeof mockGet>) {
    const calls = get.mock.calls.filter(([url]) => url === '/stock/movements');
    return calls[calls.length - 1]?.[1]?.params as Record<string, unknown>;
  }

  it('lists movements of the last seven days with product and order links', async () => {
    signIn('warehouse');
    const get = mockGet();
    renderRoutes([{ path: '/stock/movements', element: <StockMovementsPage /> }], '/stock/movements');

    const orderLink = await screen.findByRole('link', { name: 'SIP-2026-0012' });
    expect(orderLink).toHaveAttribute('href', '/orders/12');
    expect(screen.getAllByRole('link', { name: /Kablosuz Mouse/ })[0]).toHaveAttribute('href', '/products/7');
    expect(screen.getByText('Sayım farkı')).toBeInTheDocument();
    expect(screen.getByText('−3')).toBeInTheDocument();
    expect(document.title).toBe('Stok Hareketleri · Akıllı ERP');

    const params = lastMovementParams(get);
    expect(params).toMatchObject({ page: 1, page_size: 20 });
    expect(typeof params.from).toBe('string');
    expect(typeof params.to).toBe('string');
  });

  it('shows an empty state for the selected range', async () => {
    signIn('warehouse');
    mockGet([]);
    renderRoutes([{ path: '/stock/movements', element: <StockMovementsPage /> }], '/stock/movements');

    expect(await screen.findByText('Seçilen aralıkta stok hareketi yok.')).toBeInTheDocument();
  });

  it('filters by order code', async () => {
    signIn('warehouse');
    const get = mockGet();
    renderRoutes([{ path: '/stock/movements', element: <StockMovementsPage /> }], '/stock/movements');

    await screen.findByText('Sayım farkı');
    fireEvent.change(screen.getByPlaceholderText('Sipariş kodu'), { target: { value: 'SIP-2026-0012' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filtrele' }));

    await waitFor(() => expect(lastMovementParams(get)).toMatchObject({ order_code: 'SIP-2026-0012' }));
  });

  it('loads the staff filter for admins', async () => {
    signIn('admin');
    const get = mockGet();
    renderRoutes([{ path: '/stock/movements', element: <StockMovementsPage /> }], '/stock/movements');

    await screen.findByText('Sayım farkı');
    await waitFor(() => expect(get).toHaveBeenCalledWith('/users', { params: { page_size: 100 } }));
  });

  it('does not ask warehouse staff for the user list', async () => {
    signIn('warehouse');
    const get = mockGet();
    renderRoutes([{ path: '/stock/movements', element: <StockMovementsPage /> }], '/stock/movements');

    await screen.findByText('Sayım farkı');
    expect(get).not.toHaveBeenCalledWith('/users', expect.anything());
  });
});

describe('CriticalStockPage', () => {
  function mockGet(count: number, items: CriticalProduct[] = [lowMouse]) {
    return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/categories') return { data: [electronics] };
      if (url === '/stock/critical/count') return { data: { count } };
      if (url === '/stock/critical') return { data: page(items) };
      throw new Error(`unexpected GET ${url}`);
    });
  }

  function renderPage() {
    return renderRoutes([{ path: '/stock/critical', element: <CriticalStockPage /> }], '/stock/critical');
  }

  it('lists critical products with the shortage and a summary', async () => {
    signIn('warehouse');
    mockGet(1);
    renderPage();

    expect(await screen.findByText('1 ürün kritik stok seviyesinde.')).toBeInTheDocument();
    const row = (await screen.findByRole('link', { name: 'Kablosuz Mouse' })).closest('tr') as HTMLElement;
    expect(within(row).getByText('8')).toBeInTheDocument();
    expect(within(row).getByText('1.200')).toBeInTheDocument();
    expect(within(row).getByText('Kritik')).toBeInTheDocument();
    expect(document.title).toBe('Kritik Stok · Akıllı ERP');
  });

  it('shows an empty message when a category filter has no critical products', async () => {
    signIn('warehouse');
    mockGet(3, []);
    renderPage();

    expect(await screen.findByText('Bu kategoride kritik stokta ürün yok.')).toBeInTheDocument();
  });

  it('filters by category', async () => {
    signIn('warehouse');
    const get = mockGet(1);
    renderPage();

    await screen.findByRole('link', { name: 'Kablosuz Mouse' });
    const select = screen
      .getByText('Kategori', { selector: '.ant-select-selection-placeholder' })
      .closest('.ant-select') as HTMLElement;
    fireEvent.mouseDown(within(select).getByRole('combobox'));
    fireEvent.click(await screen.findByTitle('Elektronik'));

    await waitFor(() => {
      const calls = get.mock.calls.filter(([url]) => url === '/stock/critical');
      expect(calls[calls.length - 1][1]?.params).toMatchObject({ category_id: [1] });
    });
  });

  it('opens a stock-in dialog for the product', async () => {
    signIn('warehouse');
    mockGet(1);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Stok Girişi/ }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Kablosuz Mouse');
    expect(within(dialog).getByText('Giriş').closest('.ant-segmented-item')).toHaveClass('ant-segmented-item-selected');
  });
});
