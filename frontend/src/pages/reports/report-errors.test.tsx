import { fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import { renderRoutes } from '@/test/render';
import { OrderReportTab } from './OrderReportTab';
import { ReportsPage } from './ReportsPage';
import { StockReportTab } from './StockReportTab';

vi.mock('@ant-design/plots', () => ({ Column: () => <div data-testid="column-chart" /> }));

const failure = new ApiError(500, 'ERROR', 'Rapor hazırlanırken bir hata oluştu.');

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('report errors', () => {
  it('shows the error with a retry on the sales report instead of an empty table', async () => {
    let fail = true;
    const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/categories') return { data: [] };
      if (fail) throw failure;
      return {
        data: {
          rows: [],
          totals: { order_count: 0, quantity: 0, revenue: '0', cost: '0', gross_profit: '0' },
        },
      };
    });
    renderRoutes([{ path: '/reports', element: <ReportsPage /> }], '/reports');

    expect(await screen.findByText('Rapor yüklenemedi')).toBeInTheDocument();
    expect(screen.getByText('Rapor hazırlanırken bir hata oluştu.')).toBeInTheDocument();
    expect(screen.queryByText('Seçilen aralıkta kayıt yok.')).not.toBeInTheDocument();

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));

    expect(await screen.findByText('Seçilen aralıkta kayıt yok.')).toBeInTheDocument();
    expect(screen.queryByText('Rapor yüklenemedi')).not.toBeInTheDocument();
    expect(get.mock.calls.filter(([url]) => url === '/reports/sales')).toHaveLength(2);
  });

  it.each([
    ['stock', <StockReportTab key="stock" />],
    ['order', <OrderReportTab key="orders" />],
  ])('shows the error on the %s report', async (_, element) => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/categories') return { data: [] };
      throw failure;
    });
    renderRoutes([{ path: '/', element }], '/');

    expect(await screen.findByText('Rapor yüklenemedi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tekrar Dene' })).toBeInTheDocument();
  });
});
