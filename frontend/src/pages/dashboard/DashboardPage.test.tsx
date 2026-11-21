import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '@/api/client';
import { changePercent, type DashboardSummary, type TrendPoint } from '@/api/dashboard';
import { renderRoutes } from '@/test/render';
import { DashboardPage } from './DashboardPage';

// jsdom'da canvas yok; grafik yerine aldığı veriyi gösteren bir yer tutucu çizilir.
vi.mock('@ant-design/plots', () => ({
  Area: ({ data }: { data: unknown[] }) => <div data-testid="area-chart">{data.length} nokta</div>,
}));

const summary: DashboardSummary = {
  today_sales: '1500.00',
  today_order_count: 3,
  yesterday_sales: '1000.00',
  month_sales: '9000.00',
  prev_month_sales: '0',
  pending_orders: 4,
  critical_stock_count: 2,
};

function mockApi(trend: TrendPoint[]) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    switch (url) {
      case '/dashboard/summary':
        return { data: summary };
      case '/dashboard/sales-trend':
        return { data: trend };
      case '/dashboard/top-products':
        return { data: [{ product_id: 7, sku: 'ELK-0001', name: 'Kablosuz Mouse', quantity: 12, revenue: '5398.80' }] };
      case '/stock/critical':
        return { data: { items: [], total: 0, page: 1, page_size: 5 } };
      case '/orders':
        return { data: { items: [], total: 0, page: 1, page_size: 10, counts_by_status: {} } };
      default:
        throw new Error(`unexpected GET ${url}`);
    }
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('changePercent', () => {
  it('compares with the previous period and skips an empty one', () => {
    expect(changePercent('1500', '1000')).toBe(50);
    expect(changePercent(500, 1000)).toBe(-50);
    expect(changePercent('900', '0')).toBeNull();
  });
});

describe('DashboardPage', () => {
  it('shows the summary, comparisons, top products and an all-clear stock note', async () => {
    mockApi([{ date: '2026-11-21', amount: '1500.00', order_count: 3 }]);
    renderRoutes([{ path: '/dashboard', element: <DashboardPage /> }], '/dashboard');

    expect(await screen.findByText('1.500,00 ₺')).toBeInTheDocument();
    expect(screen.getByText(/%50/)).toBeInTheDocument();
    expect(screen.getByText('geçen aya göre satış yok')).toBeInTheDocument();
    expect(await screen.findByTestId('area-chart')).toHaveTextContent('1 nokta');
    expect(await screen.findByText('Kablosuz Mouse')).toBeInTheDocument();
    expect(await screen.findByText('Kritik stokta ürün yok.')).toBeInTheDocument();
  });

  it('shows an empty state instead of a flat chart when there are no sales', async () => {
    mockApi([{ date: '2026-11-21', amount: '0', order_count: 0 }]);
    renderRoutes([{ path: '/dashboard', element: <DashboardPage /> }], '/dashboard');

    expect(await screen.findByText('Henüz satış verisi yok.')).toBeInTheDocument();
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
  });

  it('opens pending orders from the summary card', async () => {
    mockApi([]);
    const { router } = renderRoutes(
      [
        { path: '/dashboard', element: <DashboardPage /> },
        { path: '/orders', element: <p>Siparişler</p> },
      ],
      '/dashboard',
    );

    fireEvent.click(await screen.findByText('Onay Bekleyen Sipariş'));

    await waitFor(() => expect(router.state.location.search).toBe('?status=pending'));
  });
});
