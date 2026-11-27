import { screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '@/api/client';
import type { AuditLog } from '@/api/audit';
import type { Page } from '@/api/types';
import { renderRoutes } from '@/test/render';
import { AuditLogsPage } from './AuditLogsPage';

const admin = { id: 1, full_name: 'Elif Yılmaz', email: 'yonetici@example.com' };

const base = { actor: admin, entity_id: null, old_value: null, new_value: null, ip_address: null };

const logs: AuditLog[] = [
  {
    ...base,
    id: 6,
    created_at: '2026-11-27T10:05:00Z',
    event_type: 'login_failed',
    actor: null,
    entity_type: 'user',
    entity_label: 'saldirgan@example.com',
    new_value: { reason: 'unknown_email' },
    ip_address: '203.0.113.7',
  },
  {
    ...base,
    id: 5,
    created_at: '2026-11-27T10:04:00Z',
    event_type: 'role_changed',
    entity_type: 'user',
    entity_id: 3,
    entity_label: 'depo@example.com',
    old_value: { role: 'customer' },
    new_value: { role: 'warehouse' },
  },
  {
    ...base,
    id: 4,
    created_at: '2026-11-27T10:03:00Z',
    event_type: 'product_price_changed',
    entity_type: 'product',
    entity_id: 7,
    entity_label: 'ELK-0001',
    old_value: { sale_price: '100.00', cost_price: '60.00' },
    new_value: { sale_price: '120.00', cost_price: '65.00' },
  },
  {
    ...base,
    id: 3,
    created_at: '2026-11-27T10:02:00Z',
    event_type: 'order_cancelled',
    entity_type: 'order',
    entity_id: 12,
    entity_label: 'SIP-2026-0012',
    old_value: { status: 'pending' },
    new_value: { status: 'cancelled' },
  },
  {
    ...base,
    id: 2,
    created_at: '2026-11-27T10:01:00Z',
    event_type: 'customer_status_changed',
    entity_type: 'customer',
    entity_id: 9,
    entity_label: 'deniz@firma.com',
    old_value: { is_active: true },
    new_value: { is_active: false },
  },
];

const page = <T,>(items: T[]): Page<T> => ({ items, total: items.length, page: 1, page_size: 20 });

function mockGet(items: AuditLog[] = logs) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/audit-logs') return { data: page(items) };
    if (url === '/users') return { data: page([]) };
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderRoutes([{ path: '/audit-logs', element: <AuditLogsPage /> }], '/audit-logs');
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('AuditLogsPage', () => {
  it('shows who did what to which record with old and new values', async () => {
    mockGet();
    renderPage();

    expect(await screen.findByText('Rol: Müşteri → Depo Personeli')).toBeInTheDocument();
    expect(screen.getByText('Satış fiyatı: 100,00 ₺ → 120,00 ₺')).toBeInTheDocument();
    expect(screen.getByText('Maliyet: 60,00 ₺ → 65,00 ₺')).toBeInTheDocument();
    expect(screen.getByText('Durum: Onay Bekliyor → İptal')).toBeInTheDocument();
    expect(screen.getByText('Durum: Aktif → Pasif')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SIP-2026-0012' })).toHaveAttribute('href', '/orders/12');
    expect(screen.getByRole('link', { name: 'ELK-0001' })).toHaveAttribute('href', '/products/7');
    expect(screen.getByRole('link', { name: 'deniz@firma.com' })).toHaveAttribute('href', '/customers/9');
    expect(screen.getAllByText('Elif Yılmaz').length).toBe(4);
    expect(document.title).toBe('İşlem Geçmişi · Akıllı ERP');
  });

  it('shows failed logins with the tried e-mail, reason and IP but no user', async () => {
    mockGet([logs[0]]);
    renderPage();

    const row = (await screen.findByText('saldirgan@example.com')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Başarısız Giriş')).toBeInTheDocument();
    expect(within(row).getByText('Bilinmiyor')).toBeInTheDocument();
    expect(within(row).getByText('Neden: Kayıtlı olmayan e-posta')).toBeInTheDocument();
    expect(within(row).getByText('203.0.113.7')).toBeInTheDocument();
  });

  it('asks for the last seven days and shows an empty state', async () => {
    const get = mockGet([]);
    renderPage();

    expect(await screen.findByText('Seçilen aralıkta kayıt yok.')).toBeInTheDocument();
    const lastParams = () => {
      const calls = get.mock.calls.filter(([url]) => url === '/audit-logs');
      return calls[calls.length - 1]?.[1]?.params as Record<string, unknown> | undefined;
    };
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 1, page_size: 20 }));
    expect(typeof lastParams()?.from).toBe('string');
    expect(typeof lastParams()?.to).toBe('string');
  });
});
