import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Result,
  Row,
  Space,
  Spin,
  Steps,
  Table,
  Typography,
} from 'antd';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import type { MyOrderDetail, MyOrderItem } from '@/api/shop';
import { OrderStatusTag } from '@/components/StatusTag';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { orderStatusLabels, paymentMethodLabels, type OrderStatus } from '@/utils/labels';
import { MyOrderCancelButton } from './MyOrderCancelButton';

const FLOW: OrderStatus[] = ['pending', 'preparing', 'shipped', 'completed'];

/** Müşteriye yalnızca durum ve tarih gösterilir; işlemi yapan personel adı gösterilmez. */
function timeline(order: MyOrderDetail) {
  const at = (status: OrderStatus) => order.timeline.find((step) => step.status === status)?.at;
  if (order.status === 'cancelled') {
    return [
      ...FLOW.filter((status) => at(status)).map((status) => ({
        title: orderStatusLabels[status],
        description: formatDateTime(at(status)),
        status: 'finish' as const,
      })),
      { title: 'İptal', description: formatDateTime(at('cancelled')), status: 'error' as const },
    ];
  }
  const current = FLOW.indexOf(order.status);
  return FLOW.map((status, index) => ({
    title: orderStatusLabels[status],
    description: at(status) ? formatDateTime(at(status)) : undefined,
    status:
      index < current || order.status === 'completed'
        ? ('finish' as const)
        : index === current
          ? ('process' as const)
          : ('wait' as const),
  }));
}

/** E-35 Sipariş Detayı (müşteri); ?new=1 ile gelindiyse E-33 "Siparişiniz alındı" şeridi gösterilir. */
export function MyOrderDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queryKey = ['me', 'orders', 'detail', id];
  const justPlaced = params.get('new') === '1';

  const {
    data: order,
    error,
    isPending,
  } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<MyOrderDetail>(`/me/orders/${id}`)).data,
  });

  if (isPending) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }
  if (error || !order) {
    return (
      <Result
        status="404"
        title="Sipariş bulunamadı"
        extra={<Button onClick={() => navigate('/shop/orders')}>Siparişlerime Dön</Button>}
      />
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: <Link to="/shop/orders">Siparişlerim</Link> }, { title: order.order_code }]} />

      {justPlaced ? (
        <Alert
          type="success"
          showIcon
          message={
            <Space>
              Siparişiniz alındı!
              <Typography.Text strong copyable>
                {order.order_code}
              </Typography.Text>
            </Space>
          }
          description="Siparişiniz yönetici onayından sonra hazırlanacak. Durumunu bu sayfadan ve Siparişlerim sayfasından izleyebilirsiniz."
          action={<Button onClick={() => navigate('/shop')}>Alışverişe Devam Et</Button>}
        />
      ) : null}

      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <Space size={12}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Sipariş {order.order_code}
          </Typography.Title>
          <OrderStatusTag status={order.status} />
        </Space>
        <MyOrderCancelButton order={order} onCancelled={(updated) => queryClient.setQueryData(queryKey, updated)} />
      </Space>

      <Card>
        <Steps size="small" items={timeline(order)} />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Ürünler" styles={{ body: { padding: 0 } }}>
            <Table<MyOrderItem>
              rowKey="product_id"
              pagination={false}
              dataSource={order.items}
              scroll={{ x: 520 }}
              columns={[
                {
                  title: 'Ürün',
                  key: 'name',
                  render: (_, item) => <Link to={`/shop/products/${item.product_id}`}>{item.name}</Link>,
                },
                { title: 'Adet', dataIndex: 'quantity', align: 'right' },
                { title: 'Birim Fiyat', dataIndex: 'unit_price', align: 'right', render: formatCurrency },
                { title: 'Toplam', dataIndex: 'line_total', align: 'right', render: formatCurrency },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Özet">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Toplam">
                <Typography.Text strong>{formatCurrency(order.total_amount)}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ödeme">{paymentMethodLabels[order.payment_method]}</Descriptions.Item>
              <Descriptions.Item label="Teslimat Adresi">{order.shipping_address || '–'}</Descriptions.Item>
              <Descriptions.Item label="Not">{order.note || '–'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
