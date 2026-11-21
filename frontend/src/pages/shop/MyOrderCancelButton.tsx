import { useQueryClient } from '@tanstack/react-query';
import { App, Button } from 'antd';
import { ApiError, api, errorMessage } from '@/api/client';
import type { MyOrderDetail, MyOrderSummary } from '@/api/shop';

/** Yalnızca onay bekleyen sipariş iptal edilebilir; sunucu da kontrol eder (409). */
export function MyOrderCancelButton({
  order,
  onCancelled,
}: {
  order: Pick<MyOrderSummary, 'id' | 'order_code' | 'can_cancel'>;
  onCancelled?: (order: MyOrderDetail) => void;
}) {
  const { modal, message } = App.useApp();
  const queryClient = useQueryClient();
  if (!order.can_cancel) return null;

  const cancel = () =>
    modal.confirm({
      title: `${order.order_code} iptal edilsin mi?`,
      content: 'Sipariş iptal edilecek. Emin misiniz?',
      okText: 'İptal Et',
      cancelText: 'Vazgeç',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const { data } = await api.post<MyOrderDetail>(`/me/orders/${order.id}/cancel`);
          message.success('Siparişiniz iptal edildi.');
          void queryClient.invalidateQueries({ queryKey: ['me', 'orders'] });
          onCancelled?.(data);
        } catch (err) {
          message.error(errorMessage(err));
          if (err instanceof ApiError && err.status === 409) {
            void queryClient.invalidateQueries({ queryKey: ['me', 'orders'] });
          }
        }
      },
    });

  return (
    <Button danger onClick={cancel}>
      İptal Et
    </Button>
  );
}
