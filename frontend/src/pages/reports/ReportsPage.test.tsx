import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '@/api/client';
import { renderRoutes } from '@/test/render';
import { ReportsPage } from './ReportsPage';

vi.mock('@ant-design/plots', () => ({
  Column: ({ data }: { data: unknown[] }) => <div data-testid="column-chart">{data.length} dönem</div>,
}));

const report = {
  rows: [
    {
      period: '2026-11-01',
      label: '01.11.2026',
      order_count: 0,
      quantity: 0,
      revenue: '0',
      cost: '0',
      gross_profit: '0',
    },
    {
      period: '2026-11-02',
      label: '02.11.2026',
      order_count: 2,
      quantity: 16,
      revenue: '250.00',
      cost: '160.00',
      gross_profit: '90.00',
    },
  ],
  totals: { order_count: 2, quantity: 16, revenue: '250.00', cost: '160.00', gross_profit: '90.00' },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ReportsPage', () => {
  it('shows totals, a chart for time groups and only lists after pressing Listele', async () => {
    const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/categories') return { data: [] };
      return { data: report };
    });
    renderRoutes([{ path: '/reports', element: <ReportsPage /> }], '/reports');

    expect(await screen.findByText('Toplam')).toBeInTheDocument();
    expect(screen.getAllByText('250,00 ₺').length).toBeGreaterThan(0);
    expect(screen.getByTestId('column-chart')).toHaveTextContent('2 dönem');
    const salesCalls = () => get.mock.calls.filter(([url]) => url === '/reports/sales').length;
    const before = salesCalls();

    fireEvent.mouseDown(screen.getByText('Gruplama: Gün'));
    fireEvent.click(await screen.findByText('Gruplama: Kategori'));
    expect(salesCalls()).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Listele' }));

    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/reports/sales', {
        params: expect.objectContaining({ group_by: 'category' }),
      }),
    );
  });

  it('shows an empty state when the range has no sales', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/categories') return { data: [] };
      return { data: { rows: [report.rows[0]], totals: { ...report.totals, order_count: 0 } } };
    });
    renderRoutes([{ path: '/reports', element: <ReportsPage /> }], '/reports');

    expect(await screen.findByText('Seçilen aralıkta kayıt yok.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excel'e Aktar/ })).toBeDisabled();
  });
});
