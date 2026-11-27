import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { CurrentUser, Page, ProductDetail, StockMovement } from '@/api/types';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import type { UserRole } from '@/utils/labels';
import { ProductDetailPage } from './ProductDetailPage';

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
    full_name: 'Elif Yılmaz',
    email: 'test@example.com',
    role,
    is_active: true,
    created_at: '2026-11-01T10:00:00Z',
    last_login_at: null,
    customer: null,
  } satisfies CurrentUser;
}

const mouse: ProductDetail = {
  id: 7,
  sku: 'ELK-0001',
  name: 'Kablosuz Mouse',
  description: 'Sessiz tıklama',
  category: { id: 1, name: 'Elektronik', color: '#6366F1' },
  sale_price: '400.00',
  cost_price: '350.00',
  stock: 3,
  min_stock: 10,
  stock_status: 'critical',
  image_url: null,
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  stats: { sold_last_30_days: 1250, last_movement_at: null },
};

const movement: StockMovement = {
  id: 31,
  movement_type: 'order_out',
  quantity: 2,
  previous_stock: 5,
  new_stock: 3,
  description: 'Müşteri teslimatı',
  created_at: '2026-11-20T09:30:00Z',
  user: { id: 1, full_name: 'Elif Yılmaz' },
  order: { id: 12, order_code: 'SIP-2026-0012' },
};

function mockGet(product: ProductDetail | Error, movements: StockMovement[] = [movement]) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/categories') return { data: [] };
    if (url === '/products/7/movements') {
      const page: Page<StockMovement> = { items: movements, total: movements.length, page: 1, page_size: 20 };
      return { data: page };
    }
    if (url === '/products/7') {
      if (product instanceof Error) throw product;
      return { data: product };
    }
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderRoutes(
    [
      { path: '/products/:id', element: <ProductDetailPage /> },
      { path: '/products', element: <p>Ürün listesi</p> },
    ],
    '/products/7',
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ProductDetailPage', () => {
  it('shows details, stats and the margin with a leading percent sign to admins', async () => {
    signIn('admin');
    mockGet(mouse);
    renderPage();

    expect(await screen.findByText('Sessiz tıklama')).toBeInTheDocument();
    expect(screen.getByText('400,00 ₺')).toBeInTheDocument();
    expect(screen.getByText(/350,00 ₺ · Kâr marjı %12,5/)).toBeInTheDocument();
    expect(screen.getByText('Kritik')).toBeInTheDocument();
    expect(screen.getByText('Son 30 Günde Satılan')).toBeInTheDocument();
    expect(screen.getByText('1.250')).toBeInTheDocument();
    expect(document.title).toBe('Kablosuz Mouse · Akıllı ERP');
  });

  it('lists the stock movements with a link to the order', async () => {
    signIn('admin');
    mockGet(mouse);
    renderPage();

    const orderLink = await screen.findByRole('link', { name: 'SIP-2026-0012' });
    expect(orderLink).toHaveAttribute('href', '/orders/12');
    const row = orderLink.closest('tr') as HTMLElement;
    expect(within(row).getByText('Sipariş Çıkışı')).toBeInTheDocument();
    expect(within(row).getByText('Müşteri teslimatı')).toBeInTheDocument();
  });

  it('shows an empty history message', async () => {
    signIn('admin');
    mockGet(mouse, []);
    renderPage();

    expect(await screen.findByText('Bu ürün için henüz stok hareketi yok.')).toBeInTheDocument();
  });

  it('hides cost and admin actions from warehouse staff', async () => {
    signIn('warehouse');
    const { cost_price: _cost, ...withoutCost } = mouse;
    mockGet(withoutCost);
    renderPage();

    expect(await screen.findByText('Sessiz tıklama')).toBeInTheDocument();
    expect(screen.queryByText(/Kâr marjı/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Düzenle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pasife Al' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stok Girişi/Çıkışı' })).toBeEnabled();
  });

  it('opens the stock dialog for the product', async () => {
    signIn('warehouse');
    mockGet(mouse);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Stok Girişi/Çıkışı' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('Stok İşlemi');
  });

  it('asks the same question as the list before deactivating and refreshes the stock badge', async () => {
    signIn('admin');
    mockGet(mouse);
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
    const { queryClient } = renderPage();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(await screen.findByRole('button', { name: 'Pasife Al' }));
    const popup = (await screen.findByText('Ürün pasife alınsın mı?')).closest('.ant-popover') as HTMLElement;
    expect(
      within(popup).getByText('Pasif ürünler müşteri kataloğunda görünmez ve siparişe eklenemez.'),
    ).toBeInTheDocument();
    fireEvent.click(within(popup).getByRole('button', { name: 'Pasife Al' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/products/7/status', { is_active: false }));
    expect(await screen.findByText('Ürün pasife alındı.')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['stock'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['products'] });
  });

  it('activates an inactive product and disables stock changes while inactive', async () => {
    signIn('admin');
    mockGet({ ...mouse, is_active: false });
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Stok Girişi/Çıkışı' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Aktifleştir' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/products/7/status', { is_active: true }));
    expect(await screen.findByText('Ürün aktifleştirildi.')).toBeInTheDocument();
  });

  it('shows the server message when the status change fails', async () => {
    signIn('admin');
    mockGet({ ...mouse, is_active: false });
    vi.spyOn(api, 'patch').mockRejectedValue(new ApiError(409, 'CATEGORY_INACTIVE', 'Kategori pasif.'));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Aktifleştir' }));

    expect(await screen.findByText('Kategori pasif.')).toBeInTheDocument();
  });

  it('opens the edit form with the product values', async () => {
    signIn('admin');
    mockGet(mouse);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Düzenle' }));

    expect(await screen.findByText('Ürünü Düzenle')).toBeInTheDocument();
    expect(screen.getByLabelText('Ürün Adı')).toHaveValue('Kablosuz Mouse');
    expect(screen.getByRole('button', { name: 'Vazgeç' })).toBeInTheDocument();
  });

  it('shows not found and goes back to the list', async () => {
    signIn('admin');
    mockGet(new ApiError(404, 'NOT_FOUND', 'Ürün bulunamadı.'));
    const { router } = renderPage();

    expect(await screen.findByText('Ürün bulunamadı')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ürünlere Dön' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/products'));
  });

  it('shows other load errors', async () => {
    signIn('admin');
    mockGet(new ApiError(500, 'ERROR', 'Sunucuya ulaşılamadı.'));
    renderPage();

    expect(await screen.findByText('Sunucuya ulaşılamadı.')).toBeInTheDocument();
  });
});
