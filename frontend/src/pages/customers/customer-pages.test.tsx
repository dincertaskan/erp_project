import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { CustomerDetail } from '@/api/customers';
import type { AuthContextValue } from '@/auth/context';
import { CustomerFormModal } from '@/components/CustomerFormModal';
import { NewOrderPage } from '@/pages/orders/NewOrderPage';
import { renderRoutes } from '@/test/render';
import { CustomerDetailPage } from './CustomerDetailPage';
import { CustomersPage } from './CustomersPage';

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

const can: CustomerDetail = {
  id: 3,
  full_name: 'Can Demir',
  email: 'musteri@example.com',
  phone: '0532 000 00 00',
  company_name: 'Demir Ticaret',
  address: 'Örnek Mah. No: 1',
  city: 'İstanbul',
  is_active: true,
  source: 'app',
  created_at: '2026-11-01T10:00:00Z',
  has_account: true,
  invite_expires_at: null,
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

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CustomersPage', () => {
  it('lists customers with their order stats', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/customers/cities') return { data: ['İstanbul'] };
      return { data: { items: [can], total: 1, page: 1, page_size: 20 } };
    });
    renderRoutes([{ path: '/customers', element: <CustomersPage /> }], '/customers');

    expect(await screen.findByText('Can Demir')).toBeInTheDocument();
    expect(screen.getByText('1.500,00 ₺')).toBeInTheDocument();
    expect(screen.getByText('Demir Ticaret')).toBeInTheDocument();
  });
});

describe('CustomerFormModal', () => {
  it('locks the e-mail of a customer with an account', async () => {
    renderRoutes(
      [{ path: '/', element: <CustomerFormModal open customer={can} onOpenChange={vi.fn()} onSaved={vi.fn()} /> }],
      '/',
    );

    expect(await screen.findByLabelText('E-posta')).toBeDisabled();
    expect(screen.getByText('Müşterinin giriş hesabı olduğu için değiştirilemez.')).toBeInTheDocument();
  });

  it('shows a taken e-mail under the field when adding', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError(409, 'EMAIL_TAKEN', 'Bu e-posta adresiyle kayıtlı bir müşteri var.', [
        { field: 'email', message: 'Bu e-posta adresiyle kayıtlı bir müşteri var.' },
      ]),
    );
    renderRoutes(
      [{ path: '/', element: <CustomerFormModal open customer={null} onOpenChange={vi.fn()} onSaved={vi.fn()} /> }],
      '/',
    );

    fireEvent.change(await screen.findByLabelText('Ad Soyad'), { target: { value: 'Deniz Ak' } });
    fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: 'deniz@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    const fieldError = await screen.findByText('Bu e-posta adresiyle kayıtlı bir müşteri var.');
    expect(fieldError.closest('.ant-form-item')).toHaveTextContent('E-posta');
  });
});

describe('CustomerDetailPage', () => {
  it('shows stats and links to a new order for this customer', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/customers/3') return { data: can };
      return { data: { items: [], total: 0, page: 1, page_size: 20 } };
    });
    const { router } = renderRoutes(
      [
        { path: '/customers/:id', element: <CustomerDetailPage /> },
        { path: '/orders/new', element: <p>Yeni sipariş</p> },
      ],
      '/customers/3',
    );

    expect(await screen.findByText('750,00 ₺')).toBeInTheDocument();
    expect(await screen.findByText('Bu müşterinin henüz siparişi yok.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bu Müşteri Adına Sipariş Oluştur' }));
    await waitFor(() => expect(router.state.location.search).toBe('?customer=3'));
  });
});

describe('NewOrderPage with a preset customer', () => {
  it('selects the customer and fills the saved address', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: can });
    renderRoutes([{ path: '/orders/new', element: <NewOrderPage /> }], '/orders/new?customer=3');

    expect(await screen.findByDisplayValue('Örnek Mah. No: 1, İstanbul')).toBeInTheDocument();
    expect(screen.getByText(/Can Demir · musteri@example.com/)).toBeInTheDocument();
  });
});
