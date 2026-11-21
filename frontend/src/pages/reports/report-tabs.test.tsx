import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '@/api/client';
import { renderRoutes } from '@/test/render';
import { OrderReportTab } from './OrderReportTab';
import { StockReportTab } from './StockReportTab';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('StockReportTab', () => {
  it('shows opening and closing stock with the shared status tag', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/categories') return { data: [] };
      return {
        data: {
          rows: [
            {
              product_id: 1,
              sku: 'SR-1',
              name: 'Kağıt',
              category: 'Ofis',
              opening_stock: 50,
              stock_in: 3,
              stock_out: 15,
              closing_stock: 38,
              stock_value: '95.00',
              status: 'Kritik',
            },
          ],
          totals: { stock_in: 3, stock_out: 15, stock_value: '95.00' },
        },
      };
    });
    renderRoutes([{ path: '/', element: <StockReportTab /> }], '/');

    expect(await screen.findByText('Kağıt')).toBeInTheDocument();
    expect(screen.getByText('38')).toBeInTheDocument();
    expect(screen.getAllByText('95,00 ₺').length).toBeGreaterThan(0);
    expect(screen.getByText('Kritik')).toBeInTheDocument();
  });
});

describe('OrderReportTab', () => {
  it('filters by status only after pressing Listele', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { rows: [], total: 0, total_amount: '0' } });
    renderRoutes([{ path: '/', element: <OrderReportTab /> }], '/');

    expect(await screen.findByText('Seçilen aralıkta kayıt yok.')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('Tamamlandı'));
    const calls = get.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Listele' }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(calls));
    expect(get.mock.calls.at(-1)?.[1]?.params).toMatchObject({ status: ['completed'], page: 1 });
  });
});
