import { useQueryClient } from '@tanstack/react-query';
import { App, Button, Modal, Space, Table, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api, errorMessage } from '@/api/client';
import {
  orderActionDoneMessages,
  orderActionLabels,
  type OrderAction,
  type OrderDetail,
  type OrderListItem,
  type Shortage,
} from '@/api/orders';
import { invalidateStock } from '@/api/stock';
import { formatNumber } from '@/utils/format';

type ActionOrder = Pick<OrderListItem, 'id' | 'order_code' | 'status' | 'item_count' | 'allowed_actions'>;

function confirmText(action: OrderAction, order: ActionOrder): string {
  switch (action) {
    case 'approve':
      return `Sipariş onaylanacak ve ${order.item_count} ürünün stoğu düşülecek.`;
    case 'ship':
      return 'Sipariş kargoya verildi olarak işaretlenecek.';
    case 'complete':
      return 'Sipariş teslim edildi olarak işaretlenecek.';
    case 'cancel':
      return order.status === 'preparing'
        ? 'Sipariş iptal edilecek ve düşülen stok geri eklenecek.'
        : 'Sipariş iptal edilecek.';
  }
}

interface OrderActionsProps {
  order: ActionOrder;
  size?: 'small' | 'middle';
  onDone?: (order: OrderDetail) => void;
}

/** Sunucunun izin verdiği (allowed_actions) durum geçişlerini onay penceresiyle gösterir. */
export function OrderActions({ order, size = 'middle', onDone }: OrderActionsProps) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [shortages, setShortages] = useState<Shortage[] | null>(null);

  const run = async (action: OrderAction) => {
    try {
      const { data } = await api.post<OrderDetail>(`/orders/${order.id}/${action}`);
      message.success(`${order.order_code}: ${orderActionDoneMessages[action]}`);
      if (action === 'approve' || action === 'cancel') invalidateStock(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      onDone?.(data);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INSUFFICIENT_STOCK') setShortages(err.details as Shortage[]);
      else message.error(errorMessage(err));
    }
  };

  const confirm = (action: OrderAction) =>
    modal.confirm({
      title: `${order.order_code} · ${orderActionLabels[action]}`,
      content: confirmText(action, order),
      okText: orderActionLabels[action],
      cancelText: 'Vazgeç',
      okButtonProps: action === 'cancel' ? { danger: true } : undefined,
      onOk: () => run(action),
    });

  if (order.allowed_actions.length === 0) return null;

  return (
    <>
      <Space size={8} wrap={size !== 'small'}>
        {order.allowed_actions.map((action) => (
          <Button
            key={action}
            size={size}
            type={action === 'cancel' ? 'default' : 'primary'}
            danger={action === 'cancel'}
            ghost={action !== 'cancel' && size === 'small'}
            onClick={() => confirm(action)}
          >
            {orderActionLabels[action]}
          </Button>
        ))}
      </Space>
      <ShortageModal shortages={shortages} onClose={() => setShortages(null)} />
    </>
  );
}

/** Onay stok yetersizliğinden reddedilince eksik kalemleri gösterir. */
export function ShortageModal({ shortages, onClose }: { shortages: Shortage[] | null; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Modal
      open={shortages !== null}
      title="Stok yetersiz, sipariş onaylanamadı"
      onCancel={onClose}
      width={560}
      footer={[
        <Button key="close" onClick={onClose}>
          Kapat
        </Button>,
        <Button key="stock" type="primary" onClick={() => navigate('/stock')}>
          Stok İşlemlerine Git
        </Button>,
      ]}
    >
      <Typography.Paragraph type="secondary">
        Aşağıdaki ürünler için stok girişi yapıldıktan sonra sipariş onaylanabilir. Hiçbir stok değiştirilmedi.
      </Typography.Paragraph>
      <Table<Shortage>
        rowKey="product_id"
        size="small"
        pagination={false}
        dataSource={shortages ?? []}
        columns={[
          {
            title: 'Ürün',
            dataIndex: 'name',
            render: (_, row) => (
              <>
                <Typography.Text type="secondary">{row.sku}</Typography.Text> {row.name}
              </>
            ),
          },
          { title: 'İstenen', dataIndex: 'requested', align: 'right', render: formatNumber },
          { title: 'Mevcut', dataIndex: 'available', align: 'right', render: formatNumber },
          {
            title: 'Eksik',
            key: 'missing',
            align: 'right',
            render: (_, row) => (
              <Typography.Text type="danger">{formatNumber(row.requested - row.available)}</Typography.Text>
            ),
          },
        ]}
      />
    </Modal>
  );
}
