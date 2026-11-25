import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { DashboardSummary } from '@/api/dashboard';
import { renderRoutes } from '@/test/render';
import { DashboardPage } from './DashboardPage';

vi.mock('@ant-design/plots', () => ({ Area: () => <div data-testid="area-chart" /> }));

const summary: DashboardSummary = {
  today_sales: '0',
  today_order_count: 0,
  yesterday_sales: '0',
  month_sales: '0',
  prev_month_sales: '0',
  pending_orders: 7376,
  critical_stock_count: 1204,
};

const critical = {
  items: [{ id: 7, sku: 'ELK-0001', name: 'Kablosuz Mouse', image_url: null, stock: 1, min_stock: 5 }],
  total: 1,
  page: 1,
  page_size: 5,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

function renderDashboard() {
  return renderRoutes([{ path: '/dashboard', element: <DashboardPage /> }], '/dashboard');
}

describe('DashboardPage links', () => {
  it('formats large counts and makes the cards and critical rows keyboard reachable links', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/dashboard/summary') return { data: summary };
      if (url === '/stock/critical') return { data: critical };
      if (url === '/orders') return { data: { items: [], total: 0, page: 1, page_size: 10, counts_by_status: {} } };
      return { data: [] };
    });
    renderDashboard();

    expect(await screen.findByText('7.376')).toBeInTheDocument();
    expect(screen.getByText('1.204')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Onay Bekleyen Sipariş/ })).toHaveAttribute(
      'href',
      '/orders?status=pending',
    );
    expect(screen.getByRole('link', { name: /Kritik Stoktaki Ürün/ })).toHaveAttribute('href', '/stock/critical');
    expect(await screen.findByRole('link', { name: 'Kablosuz Mouse' })).toHaveAttribute('href', '/products/7');
  });
});

describe('DashboardPage errors', () => {
  it('shows an error with a retry for each failed section instead of empty data', async () => {
    let fail = true;
    const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (fail) throw new ApiError(500, 'ERROR', 'Sunucu hatası.');
      if (url === '/dashboard/summary') return { data: summary };
      if (url === '/dashboard/sales-trend') return { data: [] };
      if (url === '/dashboard/top-products') return { data: [] };
      if (url === '/stock/critical') return { data: { ...critical, items: [] } };
      return { data: { items: [], total: 0, page: 1, page_size: 10, counts_by_status: {} } };
    });
    renderDashboard();

    expect(await screen.findByText('Özet bilgiler yüklenemedi')).toBeInTheDocument();
    expect(await screen.findByText('Satış trendi yüklenemedi')).toBeInTheDocument();
    expect(await screen.findByText('En çok satan ürünler yüklenemedi')).toBeInTheDocument();
    expect(await screen.findByText('Kritik stok listesi yüklenemedi')).toBeInTheDocument();
    expect(await screen.findByText('Son siparişler yüklenemedi')).toBeInTheDocument();
    expect(screen.queryByText('Henüz satış verisi yok.')).not.toBeInTheDocument();
    expect(screen.queryByText('Bu dönemde satış yok.')).not.toBeInTheDocument();

    fail = false;
    const calls = get.mock.calls.length;
    for (const button of screen.getAllByRole('button', { name: 'Tekrar Dene' })) fireEvent.click(button);

    expect(await screen.findByText('Henüz satış verisi yok.')).toBeInTheDocument();
    expect(await screen.findByText('7.376')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Tekrar Dene' })).not.toBeInTheDocument());
    expect(get.mock.calls.length).toBeGreaterThanOrEqual(calls + 5);
  });
});
