import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { CustomerDetail, CustomerOrder } from '@/api/customers';
import type { Page } from '@/api/types';
import { renderRoutes } from '@/test/render';
import { CustomerDetailPage } from './CustomerDetailPage';

const can: CustomerDetail = {
  id: 3,
  full_name: 'Can Demir',
  email: 'musteri@example.com',
  phone: null,
  company_name: 'Demir Ticaret',
  address: null,
  city: 'İstanbul',
  is_active: true,
  source: 'app',
  created_at: '2026-11-01T10:00:00Z',
  has_account: true,
  order_count: 4,
  total_spent: '1500.00',
  last_order_at: '2026-11-20T10:00:00Z',
  stats: {
    order_count: 4,
    revenue_order_count: 2,
    total_spent: '1500.00',
    average_basket: '750.00',
    last_order_at: '2026-11-20T10:00:00Z',
  },
};

const order: CustomerOrder = {
  id: 12,
  order_code: 'SIP-2026-0012',
  created_at: '2026-11-20T10:00:00Z',
  item_count: 3,
  total_amount: '1250.00',
  status: 'shipped',
};

function mockGet(customer: CustomerDetail | Error, orders: CustomerOrder[] = [order]) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/customers/3/orders') {
      const page: Page<CustomerOrder> = { items: orders, total: orders.length, page: 1, page_size: 20 };
      return { data: page };
    }
    if (url === '/customers/3') {
      if (customer instanceof Error) throw customer;
      return { data: customer };
    }
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderRoutes(
    [
      { path: '/customers/:id', element: <CustomerDetailPage /> },
      { path: '/customers', element: <p>Müşteri listesi</p> },
    ],
    '/customers/3',
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CustomerDetailPage', () => {
  it('shows contact details, stats and order history', async () => {
    mockGet(can);
    renderPage();

    expect(await screen.findByText('musteri@example.com')).toBeInTheDocument();
    expect(screen.getByText('Demir Ticaret')).toBeInTheDocument();
    expect(screen.getByText('İstanbul')).toBeInTheDocument();
    expect(screen.getByText('Var')).toBeInTheDocument();
    expect(screen.getAllByText('1.500,00 ₺').length).toBeGreaterThan(0);
    expect(screen.getByText('750,00 ₺')).toBeInTheDocument();
    expect(document.title).toBe('Can Demir · Akıllı ERP');

    const orderLink = await screen.findByRole('link', { name: 'SIP-2026-0012' });
    expect(orderLink).toHaveAttribute('href', '/orders/12');
    const row = orderLink.closest('tr') as HTMLElement;
    expect(within(row).getByText('3 ürün')).toBeInTheDocument();
    expect(within(row).getByText('1.250,00 ₺')).toBeInTheDocument();
    expect(within(row).getByText('Kargolandı')).toBeInTheDocument();
  });

  it('deactivates after confirmation and shows the new status', async () => {
    mockGet(can, []);
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: { ...can, is_active: false } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Pasife Al' }));
    const popup = (await screen.findByText('Müşteri pasife alınsın mı?')).closest('.ant-popover') as HTMLElement;
    expect(within(popup).getByText('Pasif müşteri adına sipariş oluşturulamaz.')).toBeInTheDocument();
    fireEvent.click(within(popup).getByRole('button', { name: 'Pasife Al' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/customers/3/status', { is_active: false }));
    expect(await screen.findByText('Müşteri pasife alındı.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Aktifleştir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bu Müşteri Adına Sipariş Oluştur' })).toBeDisabled();
  });

  it('activates an inactive customer', async () => {
    mockGet({ ...can, is_active: false }, []);
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: can });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Aktifleştir' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/customers/3/status', { is_active: true }));
    expect(await screen.findByText('Müşteri aktifleştirildi.')).toBeInTheDocument();
  });

  it('shows the server message when the status change fails', async () => {
    mockGet({ ...can, is_active: false }, []);
    vi.spyOn(api, 'patch').mockRejectedValue(new ApiError(500, 'ERROR', 'İşlem tamamlanamadı.'));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Aktifleştir' }));

    expect(await screen.findByText('İşlem tamamlanamadı.')).toBeInTheDocument();
  });

  it('does not allow editing customers imported from Olist', async () => {
    mockGet({ ...can, source: 'olist', has_account: false }, []);
    renderPage();

    expect(await screen.findByText('Yok')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Düzenle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pasife Al' })).not.toBeInTheDocument();
  });

  it('opens the edit form and shows the saved data', async () => {
    mockGet(can, []);
    vi.spyOn(api, 'put').mockResolvedValue({ data: { ...can, company_name: 'Demir A.Ş.' } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Düzenle' }));
    const dialog = (await screen.findByRole('dialog')) as HTMLElement;
    expect(within(dialog).getByLabelText('Ad Soyad')).toHaveValue('Can Demir');
    expect(within(dialog).getByRole('button', { name: 'Vazgeç' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Demir A.Ş.')).toBeInTheDocument();
  });

  it('shows the empty order history', async () => {
    mockGet(can, []);
    renderPage();

    expect(await screen.findByText('Bu müşterinin henüz siparişi yok.')).toBeInTheDocument();
  });

  it('shows not found and goes back to the list', async () => {
    mockGet(new ApiError(404, 'NOT_FOUND', 'Müşteri bulunamadı.'));
    const { router } = renderPage();

    expect(await screen.findByText('Müşteri bulunamadı')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Müşterilere Dön' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/customers'));
  });

  it('shows other load errors', async () => {
    mockGet(new ApiError(500, 'ERROR', 'Sunucuya ulaşılamadı.'));
    renderPage();

    expect(await screen.findByText('Sunucuya ulaşılamadı.')).toBeInTheDocument();
  });
});
