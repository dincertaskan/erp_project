import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { OrderDetail, OrderListItem } from '@/api/orders';
import type { CustomerDetail } from '@/api/customers';
import type { CurrentUser, Product } from '@/api/types';
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

describe('NewOrderPage flow', () => {
  const customer: CustomerDetail = {
    id: 3,
    full_name: 'Can Demir',
    email: 'musteri@example.com',
    phone: null,
    company_name: null,
    address: 'Moda Cad. 5',
    city: 'İstanbul',
    is_active: true,
    source: 'app',
    created_at: '2026-11-01T10:00:00Z',
    has_account: true,
    order_count: 0,
    total_spent: '0',
    stats: { order_count: 0, revenue_order_count: 0, total_spent: '0', average_basket: '0', last_order_at: null },
  } as CustomerDetail;

  const mouse = {
    id: 7,
    sku: 'ELK-0001',
    name: 'Kablosuz Mouse',
    sale_price: '250.00',
    stock: 2,
    min_stock: 1,
  } as Product;

  function mockApi() {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/customers/3') return { data: customer };
      if (url === '/products') return { data: { items: [mouse], total: 1, page: 1, page_size: 20 } };
      if (url === '/customers') return { data: { items: [customer], total: 1, page: 1, page_size: 20 } };
      throw new Error(`unexpected GET ${url}`);
    });
  }

  async function pick(combobox: HTMLElement, option: string) {
    fireEvent.focus(combobox);
    fireEvent.mouseDown(combobox);
    fireEvent.click(await screen.findByTitle(option));
  }

  it('creates an order for a preset customer and merges repeated products', async () => {
    signIn('admin');
    mockApi();
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 77, order_code: 'SIP-2026-000077' } });
    const { router } = renderRoutes(
      [
        { path: '/orders/new', element: <NewOrderPage /> },
        { path: '/orders/:id', element: <p>Sipariş detayı</p> },
      ],
      '/orders/new?customer=3',
    );

    expect(await screen.findByDisplayValue('Moda Cad. 5, İstanbul')).toBeInTheDocument();
    const [, productSelect, paymentSelect] = screen.getAllByRole('combobox');

    await pick(productSelect, 'ELK-0001 · Kablosuz Mouse · Stok: 2');
    fireEvent.change(screen.getByLabelText('Adet'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Ekle/ }));
    await pick(productSelect, 'ELK-0001 · Kablosuz Mouse · Stok: 2');
    fireEvent.click(screen.getByRole('button', { name: /Ekle/ }));

    expect(await screen.findByText('Stokta 2 var')).toBeInTheDocument();
    expect(screen.getByLabelText('Kablosuz Mouse adedi')).toHaveValue('3');
    expect(screen.getAllByText(/750,00/).length).toBeGreaterThan(0);

    await pick(paymentSelect, 'Havale/EFT');
    fireEvent.change(screen.getByLabelText('Not'), { target: { value: '  Hızlı teslimat  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siparişi Oluştur' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/orders/77'));
    expect(post).toHaveBeenCalledWith('/orders', {
      customer_id: 3,
      payment_method: 'bank_transfer',
      shipping_address: 'Moda Cad. 5, İstanbul',
      note: 'Hızlı teslimat',
      items: [{ product_id: 7, quantity: 3 }],
    });
  });

  it('asks for at least one product before sending', async () => {
    signIn('admin');
    mockApi();
    const post = vi.spyOn(api, 'post');
    renderRoutes([{ path: '/orders/new', element: <NewOrderPage /> }], '/orders/new?customer=3');

    expect(await screen.findByDisplayValue('Moda Cad. 5, İstanbul')).toBeInTheDocument();
    await pick(screen.getAllByRole('combobox')[2], 'Kapıda Ödeme');
    fireEvent.click(screen.getByRole('button', { name: 'Siparişi Oluştur' }));

    expect(await screen.findByText('Siparişe en az bir ürün ekleyin.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('removes a product line', async () => {
    signIn('admin');
    mockApi();
    renderRoutes([{ path: '/orders/new', element: <NewOrderPage /> }], '/orders/new');

    await pick(screen.getAllByRole('combobox')[1], 'ELK-0001 · Kablosuz Mouse · Stok: 2');
    fireEvent.click(screen.getByRole('button', { name: /Ekle/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kablosuz Mouse kaldır' }));

    expect(await screen.findByText('Henüz ürün eklenmedi.')).toBeInTheDocument();
  });

  it('fills the saved address when a customer is chosen', async () => {
    signIn('admin');
    mockApi();
    renderRoutes([{ path: '/orders/new', element: <NewOrderPage /> }], '/orders/new');

    await pick(screen.getAllByRole('combobox')[0], 'Can Demir · musteri@example.com');

    expect(await screen.findByDisplayValue('Moda Cad. 5, İstanbul')).toBeInTheDocument();
  });
});
