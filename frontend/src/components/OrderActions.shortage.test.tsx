import { fireEvent, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { OrderListItem } from '@/api/orders';
import { renderRoutes } from '@/test/render';
import { OrderActions } from './OrderActions';

const order: OrderListItem = {
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

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('OrderActions without shortage details', () => {
  it.each([undefined, null, {}, []])('shows the server message instead of an empty dialog (%s)', async (details) => {
    vi.spyOn(api, 'post').mockRejectedValue(new ApiError(409, 'INSUFFICIENT_STOCK', 'Stok yetersiz.', details));
    renderRoutes([{ path: '/', element: <OrderActions order={order} /> }], '/');

    fireEvent.click(screen.getByRole('button', { name: 'Onayla' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Onayla' }));

    expect(await screen.findByText('Stok yetersiz.')).toBeInTheDocument();
    expect(screen.queryByText('Stok yetersiz, sipariş onaylanamadı')).not.toBeInTheDocument();
  });
});
