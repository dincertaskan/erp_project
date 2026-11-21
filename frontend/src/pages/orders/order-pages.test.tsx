import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { OrderDetail, OrderListItem } from '@/api/orders';
import type { CurrentUser } from '@/api/types';
import type { AuthContextValue } from '@/auth/context';
import { OrderActions } from '@/components/OrderActions';
import { renderRoutes } from '@/test/render';
import type { UserRole } from '@/utils/labels';
import { NewOrderPage } from './NewOrderPage';
import { OrderDetailPage } from './OrderDetailPage';
import { OrdersPage } from './OrdersPage';

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

const listItem: OrderListItem = {
  id: 41,
  order_code: 'SIP-2026-000041',
  created_at: '2026-11-20T09:00:00Z',
  status: 'pending',
  customer: { id: 3, full_name: 'Can Demir' },
  item_count: 2,
  total_amount: '1250.00',
  payment_method: 'bank_transfer',
  source: 'app',
  allowed_actions: ['approve', 'cancel'],
};

const detail: OrderDetail = {
  ...listItem,
  customer: {
    id: 3,
    full_name: 'Can Demir',
    email: 'musteri@example.com',
    phone: null,
    company_name: null,
    address: null,
    city: null,
  },
  shipping_address: 'Kadıköy, İstanbul',
  note: null,
  created_by: { id: 1, full_name: 'Elif Yılmaz' },
  approved_at: null,
  shipped_at: null,
  completed_at: null,
  cancelled_at: null,
  items: [
    {
      id: 1,
      product: { id: 7, sku: 'ELK-0001', name: 'Kablosuz Mouse', image_url: null, stock: 2 },
      quantity: 5,
      unit_price: '250.00',
      line_total: '1250.00',
    },
  ],
  history: [
    {
      from_status: null,
      to_status: 'pending',
      changed_at: '2026-11-20T09:00:00Z',
      changed_by: { id: 1, full_name: 'Elif Yılmaz' },
    },
  ],
  movements: [],
  shortages: [{ product_id: 7, sku: 'ELK-0001', name: 'Kablosuz Mouse', requested: 5, available: 2 }],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('OrderActions', () => {
  it('confirms approval and lists every missing item when stock is short', async () => {
    signIn('admin');
    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError(409, 'INSUFFICIENT_STOCK', '2 üründe stok yetersiz.', [
        { product_id: 7, sku: 'ELK-0001', name: 'Kablosuz Mouse', requested: 5, available: 2 },
        { product_id: 8, sku: 'YDK-0002', name: 'Şarj Adaptörü', requested: 1, available: 0 },
      ]),
    );
    renderRoutes([{ path: '/', element: <OrderActions order={listItem} /> }], '/');

    fireEvent.click(screen.getByRole('button', { name: 'Onayla' }));
    expect(await screen.findByText('Sipariş onaylanacak ve 2 ürünün stoğu düşülecek.')).toBeInTheDocument();
    const confirmDialog = screen.getByRole('dialog');
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Onayla' }));

    expect(await screen.findByText('Stok yetersiz, sipariş onaylanamadı')).toBeInTheDocument();
    expect(screen.getByText('Şarj Adaptörü')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stok İşlemlerine Git' })).toBeInTheDocument();
  });

  it('renders nothing when no action is allowed', () => {
    signIn('admin');
    const { container } = renderRoutes(
      [{ path: '/', element: <OrderActions order={{ ...listItem, allowed_actions: [] }} /> }],
      '/',
    );

    expect(container.querySelector('button')).toBeNull();
  });
});

describe('OrdersPage', () => {
  it('shows warehouse staff only the preparing and shipped tabs', async () => {
    signIn('warehouse');
    const get = vi.spyOn(api, 'get').mockResolvedValue({
      data: { items: [], total: 0, page: 1, page_size: 20, counts_by_status: { preparing: 3, shipped: 1 } },
    });
    renderRoutes([{ path: '/orders', element: <OrdersPage /> }], '/orders');

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls[0][1]?.params).toMatchObject({ status: 'preparing' });
    expect(screen.queryByRole('button', { name: /Yeni Sipariş/ })).not.toBeInTheDocument();
    expect(await screen.findByText('Hazırlanıyor')).toBeInTheDocument();
    expect(screen.queryByText('Onay Bekliyor')).not.toBeInTheDocument();
  });
});

describe('OrderDetailPage', () => {
  it('warns about short stock before approval', async () => {
    signIn('admin');
    vi.spyOn(api, 'get').mockResolvedValue({ data: detail });
    renderRoutes([{ path: '/orders/:id', element: <OrderDetailPage /> }], '/orders/41');

    expect(
      await screen.findByText('1 üründe stok yetersiz; onaylamadan önce stok girişi yapılmalı.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Eksik: 3/)).toBeInTheDocument();
    expect(screen.getByText('Kadıköy, İstanbul')).toBeInTheDocument();
  });
});

describe('NewOrderPage', () => {
  it('requires a customer and at least one product', async () => {
    signIn('admin');
    const post = vi.spyOn(api, 'post');
    renderRoutes([{ path: '/orders/new', element: <NewOrderPage /> }], '/orders/new');

    fireEvent.click(screen.getByRole('button', { name: 'Siparişi Oluştur' }));

    expect(await screen.findByText('Müşteri seçin.')).toBeInTheDocument();
    expect(screen.getByText('Ödeme yöntemi seçin.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
