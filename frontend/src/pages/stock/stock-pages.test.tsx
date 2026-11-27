import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { Product } from '@/api/types';
import type { AuthContextValue } from '@/auth/context';
import { StockMovementModal, type MovementProduct } from '@/components/StockMovementModal';
import { renderRoutes } from '@/test/render';
import { CriticalStockPage } from './CriticalStockPage';
import { StockPage } from './StockPage';

const auth: AuthContextValue = {
  user: {
    id: 2,
    full_name: 'Ayşe Kaya',
    email: 'depo@example.com',
    role: 'warehouse',
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

const mouse: Product = {
  id: 7,
  sku: 'ELK-0001',
  name: 'Kablosuz Mouse',
  description: null,
  category: { id: 1, name: 'Elektronik', color: '#6366F1' },
  sale_price: '349.90',
  stock: 12,
  min_stock: 10,
  stock_status: 'sufficient',
  image_url: null,
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  last_movement_at: null,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

function renderModal(product: MovementProduct, initialType: 'in' | 'out' = 'in') {
  const onClose = vi.fn();
  renderRoutes(
    [{ path: '/', element: <StockMovementModal product={product} initialType={initialType} onClose={onClose} /> }],
    '/',
  );
  return onClose;
}

describe('StockMovementModal', () => {
  it('previews the new stock and warns before falling below the minimum', async () => {
    renderModal(mouse, 'out');

    fireEvent.change(screen.getByLabelText('Miktar'), { target: { value: '5' } });

    expect(await screen.findByText('İşlem sonrası ürün kritik stoka düşecek.')).toBeInTheDocument();
    expect(screen.getByText(/olacak/).textContent).toBe('Stok 12 → 7 olacak.');
    expect(screen.getByText('İşlemi yapan: Ayşe Kaya')).toBeInTheDocument();
  });

  it('warns that the product runs out instead of falling critical when stock reaches zero', async () => {
    renderModal(mouse, 'out');

    fireEvent.change(screen.getByLabelText('Miktar'), { target: { value: '12' } });

    expect(await screen.findByText('İşlem sonrası ürün tükenecek.')).toBeInTheDocument();
    expect(screen.queryByText('İşlem sonrası ürün kritik stoka düşecek.')).not.toBeInTheDocument();
  });

  it('requires a reason for stock out', async () => {
    const post = vi.spyOn(api, 'post');
    renderModal(mouse, 'out');

    fireEvent.change(screen.getByLabelText('Miktar'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Çıkış işlemlerinde açıklama zorunludur.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('sends stock in without a reason and closes', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { movement: {}, product: { id: 7, stock: 62, stock_status: 'sufficient' } },
    });
    const onClose = renderModal(mouse, 'in');

    fireEvent.change(screen.getByLabelText('Miktar'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith('/stock/movements', {
      product_id: 7,
      movement_type: 'in',
      quantity: 50,
      description: null,
    });
  });

  it('shows the server stock when another user got there first', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError(409, 'INSUFFICIENT_STOCK', 'Yetersiz stok. Mevcut: 2.', [
        { product_id: 7, sku: 'ELK-0001', name: 'Kablosuz Mouse', requested: 10, available: 2 },
      ]),
    );
    renderModal(mouse, 'out');

    fireEvent.change(screen.getByLabelText('Miktar'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Açıklama'), { target: { value: 'Sayım farkı' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Yetersiz stok. Mevcut: 2.')).toBeInTheDocument();
    expect(screen.getByText(/Mevcut stok: 2/)).toBeInTheDocument();
  });
});

describe('StockMovementModal validation', () => {
  it('requires a quantity', async () => {
    const post = vi.spyOn(api, 'post');
    renderModal(mouse, 'in');

    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Miktar zorunludur.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects taking out more than the current stock', async () => {
    const post = vi.spyOn(api, 'post');
    renderModal(mouse, 'out');

    fireEvent.change(screen.getByLabelText('Miktar'), { target: { value: '13' } });
    fireEvent.change(screen.getByLabelText('Açıklama'), { target: { value: 'Sayım farkı' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Yetersiz stok. Mevcut: 12.')).toBeInTheDocument();
    expect(screen.queryByText(/olacak/)).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('allows taking out exactly the current stock', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { movement: {}, product: { id: 7, stock: 0, stock_status: 'out_of_stock' } },
    });
    const onClose = renderModal(mouse, 'out');

    fireEvent.change(screen.getByLabelText('Miktar'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Açıklama'), { target: { value: '  Fire  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith('/stock/movements', {
      product_id: 7,
      movement_type: 'out',
      quantity: 12,
      description: 'Fire',
    });
  });

  it('needs at least three characters of reason for stock out', async () => {
    const post = vi.spyOn(api, 'post');
    renderModal(mouse, 'out');

    fireEvent.change(screen.getByLabelText('Miktar'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Açıklama'), { target: { value: '  ab ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Çıkış işlemlerinde açıklama zorunludur.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('limits the reason to 500 characters', async () => {
    renderModal(mouse, 'in');

    fireEvent.change(screen.getByLabelText('Miktar'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Açıklama (isteğe bağlı)'), { target: { value: 'x'.repeat(501) } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Açıklama en fazla 500 karakter olabilir.')).toBeInTheDocument();
  });

  it('switches to stock out rules when the type changes', async () => {
    renderModal(mouse, 'in');

    fireEvent.change(screen.getByLabelText('Miktar'), { target: { value: '20' } });
    expect(await screen.findByText(/olacak/)).toHaveTextContent('Stok 12 → 32 olacak.');

    fireEvent.click(screen.getByText('Çıkış'));

    expect(await screen.findByLabelText('Açıklama')).toHaveAttribute('placeholder', 'Örn: Sayım farkı, fire');
    expect(screen.queryByText(/olacak/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Yetersiz stok. Mevcut: 12.')).toBeInTheDocument();
  });

  it('shows other server errors as a message and keeps the dialog open', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new ApiError(500, 'ERROR', 'İşlem sırasında bir hata oluştu.'));
    const onClose = renderModal(mouse, 'in');

    fireEvent.change(screen.getByLabelText('Miktar'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('İşlem sırasında bir hata oluştu.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing without a product', () => {
    renderRoutes([{ path: '/', element: <StockMovementModal product={null} onClose={vi.fn()} /> }], '/');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Stok İşlemi')).not.toBeInTheDocument();
  });
});

describe('StockPage', () => {
  it('opens the movement dialog when a scanned code matches one product', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/categories') return { data: [] };
      if (url === '/stock/summary') return { data: { active_products: 8, critical_count: 2, today_movements: 3 } };
      if (url === '/products') return { data: { items: [mouse], total: 1, page: 1, page_size: 20 } };
      throw new Error(`unexpected GET ${url}`);
    });
    renderRoutes([{ path: '/stock', element: <StockPage /> }], '/stock');

    const search = screen.getByPlaceholderText('Ürün adı veya SKU ile arayın');
    fireEvent.change(search, { target: { value: 'ELK-0001' } });
    fireEvent.keyDown(search, { key: 'Enter', code: 'Enter', keyCode: 13 });

    expect(await screen.findByRole('dialog')).toHaveTextContent('Kablosuz Mouse');
  });
});

describe('CriticalStockPage', () => {
  it('celebrates when nothing is critical', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/categories') return { data: [] };
      if (url === '/stock/critical/count') return { data: { count: 0 } };
      throw new Error(`unexpected GET ${url}`);
    });
    renderRoutes([{ path: '/stock/critical', element: <CriticalStockPage /> }], '/stock/critical');

    expect(await screen.findByText('Kritik stokta ürün yok.')).toBeInTheDocument();
  });
});
