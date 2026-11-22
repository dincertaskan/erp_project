import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { OrderAction, OrderListItem } from '@/api/orders';
import { renderRoutes } from '@/test/render';
import type { OrderStatus } from '@/utils/labels';
import { OrderActions } from './OrderActions';

const baseOrder: OrderListItem = {
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

// Sunucunun yöneticiye her durumda döndürdüğü geçişler (arka uçtaki durum makinesiyle aynı)
const ACTIONS_BY_STATUS: [OrderStatus, OrderAction[], string[]][] = [
  ['pending', ['approve', 'cancel'], ['Onayla', 'İptal Et']],
  ['preparing', ['ship', 'cancel'], ['Kargoya Ver', 'İptal Et']],
  ['shipped', ['complete'], ['Teslim Edildi']],
  ['completed', [], []],
  ['cancelled', [], []],
];

function renderActions(order: Partial<OrderListItem>, onDone = vi.fn()) {
  renderRoutes(
    [
      { path: '/', element: <OrderActions order={{ ...baseOrder, ...order }} onDone={onDone} /> },
      { path: '/stock', element: <p>Stok sayfası</p> },
    ],
    '/',
  );
  return onDone;
}

async function confirmAction(label: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: label }));
  return dialog;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('OrderActions', () => {
  it.each(ACTIONS_BY_STATUS)('shows the allowed buttons for a %s order', (status, actions, labels) => {
    renderActions({ status, allowed_actions: actions });

    expect(screen.queryAllByRole('button').map((button) => button.textContent?.replace(/\s/g, ''))).toEqual(
      labels.map((label) => label.replace(/\s/g, '')),
    );
  });

  it('marks only the cancel button as dangerous', () => {
    renderActions({ status: 'preparing', allowed_actions: ['ship', 'cancel'] });

    expect(screen.getByRole('button', { name: 'İptal Et' })).toHaveClass('ant-btn-dangerous');
    expect(screen.getByRole('button', { name: 'Kargoya Ver' })).not.toHaveClass('ant-btn-dangerous');
  });

  it.each([
    ['pending', 'approve', 'Onayla', 'Sipariş onaylanacak ve 2 ürünün stoğu düşülecek.'],
    ['preparing', 'ship', 'Kargoya Ver', 'Sipariş kargoya verildi olarak işaretlenecek.'],
    ['shipped', 'complete', 'Teslim Edildi', 'Sipariş teslim edildi olarak işaretlenecek.'],
    ['pending', 'cancel', 'İptal Et', 'Sipariş iptal edilecek.'],
    ['preparing', 'cancel', 'İptal Et', 'Sipariş iptal edilecek ve düşülen stok geri eklenecek.'],
  ] as const)('explains what %s → %s will do before running it', async (status, action, label, text) => {
    const post = vi.spyOn(api, 'post');
    renderActions({ status, allowed_actions: [action] });

    fireEvent.click(screen.getByRole('button', { name: label }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(text)).toBeInTheDocument();
    expect(dialog).toHaveTextContent(`SIP-2026-000041 · ${label}`);
    expect(post).not.toHaveBeenCalled();
  });

  it('does nothing when the confirmation is dismissed', async () => {
    const post = vi.spyOn(api, 'post');
    renderActions({ status: 'pending', allowed_actions: ['cancel'] });

    fireEvent.click(screen.getByRole('button', { name: 'İptal Et' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));

    // Pencerenin kapanma animasyonu bitene kadar beklenir; onay verilmediği için istek gitmemelidir.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    ['preparing', 'ship', 'Kargoya Ver', 'Sipariş kargoya verildi.'],
    ['shipped', 'complete', 'Teslim Edildi', 'Sipariş teslim edildi olarak işaretlendi.'],
    ['pending', 'cancel', 'İptal Et', 'Sipariş iptal edildi.'],
  ] as const)('posts the %s → %s transition and reports success', async (status, action, label, done) => {
    const updated = { ...baseOrder, status: 'shipped' };
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: updated });
    const onDone = renderActions({ status, allowed_actions: [action] });

    await confirmAction(label);

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(updated));
    expect(post).toHaveBeenCalledWith(`/orders/41/${action}`);
    expect(await screen.findByText(`SIP-2026-000041: ${done}`)).toBeInTheDocument();
  });

  it('shows the server message when a transition fails for another reason', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError(409, 'INVALID_TRANSITION', 'Sipariş bu durumdan kargoya verilemez.'),
    );
    const onDone = renderActions({ status: 'preparing', allowed_actions: ['ship'] });

    await confirmAction('Kargoya Ver');

    expect(await screen.findByText('Sipariş bu durumdan kargoya verilemez.')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.queryByText('Stok yetersiz, sipariş onaylanamadı')).not.toBeInTheDocument();
  });

  it('lists the missing quantity and can jump to stock operations when approval is short', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError(409, 'INSUFFICIENT_STOCK', 'Stok yetersiz.', [
        { product_id: 7, sku: 'ELK-0001', name: 'Kablosuz Mouse', requested: 5, available: 2 },
      ]),
    );
    renderActions({ status: 'pending', allowed_actions: ['approve'] });

    await confirmAction('Onayla');

    const shortage = (await screen.findByText('Stok yetersiz, sipariş onaylanamadı')).closest(
      '.ant-modal',
    ) as HTMLElement;
    const row = within(shortage).getByText('Kablosuz Mouse').closest('tr') as HTMLElement;
    expect(
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['ELK-0001 Kablosuz Mouse', '5', '2', '3']);

    fireEvent.click(within(shortage).getByRole('button', { name: 'Stok İşlemlerine Git' }));

    expect(await screen.findByText('Stok sayfası')).toBeInTheDocument();
  });
});
