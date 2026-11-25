import { PageContainer } from '@ant-design/pro-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Result, Row, Space, Steps, Table, Typography } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, errorMessage } from '@/api/client';
import type { OrderDetail, OrderItem, StatusHistory } from '@/api/orders';
import { FullPageSpinner } from '@/auth/guards';
import { useAuth } from '@/auth/useAuth';
import { OrderActions } from '@/components/OrderActions';
import { ProductThumb } from '@/components/ProductThumb';
import { MovementQuantity, MovementTypeTag, OrderStatusTag } from '@/components/StatusTag';
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format';
import { orderStatusLabels, paymentMethodLabels, type OrderStatus } from '@/utils/labels';
import { usePageTitle } from '@/hooks/usePageTitle';

const FLOW: OrderStatus[] = ['pending', 'preparing', 'shipped', 'completed'];

function timelineItems(order: OrderDetail) {
  const reached = (status: OrderStatus): StatusHistory | undefined => order.history.find((h) => h.to_status === status);
  const describe = (entry?: StatusHistory) =>
    entry
      ? `${formatDateTime(entry.changed_at)}${entry.changed_by ? ` · ${entry.changed_by.full_name}` : ''}`
      : undefined;

  if (order.status === 'cancelled') {
    const steps = FLOW.filter((status) => reached(status)).map((status) => ({
      title: orderStatusLabels[status],
      description: describe(reached(status)),
      status: 'finish' as const,
    }));
    return [...steps, { title: 'İptal', description: describe(reached('cancelled')), status: 'error' as const }];
  }
  const current = FLOW.indexOf(order.status);
  return FLOW.map((status, index) => ({
    title: orderStatusLabels[status],
    description: describe(reached(status)),
    status:
      index < current || order.status === 'completed'
        ? ('finish' as const)
        : index === current
          ? ('process' as const)
          : ('wait' as const),
  }));
}

/** E-20 Sipariş Detayı */
export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const queryKey = ['orders', id];

  const {
    data: order,
    error,
    isPending,
  } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<OrderDetail>(`/orders/${id}`)).data,
  });

  usePageTitle(order ? `Sipariş ${order.order_code}` : 'Sipariş Detayı');

  if (isPending) return <FullPageSpinner />;
  if (error || !order) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <Result
        status={status === 404 ? '404' : status === 403 ? '403' : 'error'}
        title={status === 404 ? 'Sipariş bulunamadı' : errorMessage(error)}
        extra={<Button onClick={() => navigate('/orders')}>Siparişlere Dön</Button>}
      />
    );
  }

  const isPendingOrder = order.status === 'pending';
  const shortageById = new Map(order.shortages.map((s) => [s.product_id, s]));

  return (
    <PageContainer
      title={
        <Space size={12}>
          {`Sipariş ${order.order_code}`}
          <OrderStatusTag status={order.status} />
        </Space>
      }
      subTitle={formatDateTime(order.created_at)}
      onBack={() => navigate('/orders')}
      breadcrumb={{ items: [{ title: <Link to="/orders">Siparişler</Link> }, { title: order.order_code }] }}
      extra={<OrderActions order={order} onDone={(updated) => queryClient.setQueryData(queryKey, updated)} />}
    >
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        {isPendingOrder && order.shortages.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            message={`${order.shortages.length} üründe stok yetersiz; onaylamadan önce stok girişi yapılmalı.`}
          />
        ) : null}

        <Card>
          <Steps items={timelineItems(order)} size="small" />
        </Card>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card title="Sipariş Kalemleri" styles={{ body: { padding: 0 } }}>
              <Table<OrderItem>
                rowKey="id"
                pagination={false}
                dataSource={order.items}
                scroll={{ x: 640 }}
                columns={[
                  {
                    title: 'Ürün',
                    key: 'product',
                    render: (_, row) => (
                      <Space>
                        <ProductThumb
                          product={{ name: row.product.name, image_url: row.product.image_url }}
                          size={32}
                        />
                        <Link to={`/products/${row.product.id}`}>
                          <Typography.Text type="secondary">{row.product.sku}</Typography.Text> {row.product.name}
                        </Link>
                      </Space>
                    ),
                  },
                  { title: 'Adet', dataIndex: 'quantity', align: 'right', render: formatNumber },
                  { title: 'Birim Fiyat', dataIndex: 'unit_price', align: 'right', render: formatCurrency },
                  { title: 'Satır Toplamı', dataIndex: 'line_total', align: 'right', render: formatCurrency },
                  ...(isPendingOrder
                    ? [
                        {
                          title: 'Güncel Stok',
                          key: 'stock',
                          align: 'right' as const,
                          render: (_: unknown, row: OrderItem) => {
                            const missing = shortageById.get(row.product.id);
                            return missing ? (
                              <Typography.Text type="danger">
                                {formatNumber(row.product.stock)} · Eksik:{' '}
                                {formatNumber(missing.requested - missing.available)}
                              </Typography.Text>
                            ) : (
                              formatNumber(row.product.stock)
                            );
                          },
                        },
                      ]
                    : []),
                ]}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <Typography.Text strong>Genel Toplam</Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Typography.Text strong>{formatCurrency(order.total_amount)}</Typography.Text>
                    </Table.Summary.Cell>
                    {isPendingOrder ? <Table.Summary.Cell index={2} /> : null}
                  </Table.Summary.Row>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Card title="Müşteri">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Ad Soyad">
                    {isAdmin ? (
                      <Link to={`/customers/${order.customer.id}`}>{order.customer.full_name}</Link>
                    ) : (
                      order.customer.full_name
                    )}
                  </Descriptions.Item>
                  {order.customer.company_name ? (
                    <Descriptions.Item label="Firma">{order.customer.company_name}</Descriptions.Item>
                  ) : null}
                  <Descriptions.Item label="E-posta">{order.customer.email}</Descriptions.Item>
                  <Descriptions.Item label="Telefon">{order.customer.phone || '–'}</Descriptions.Item>
                  <Descriptions.Item label="Teslimat Adresi">{order.shipping_address || '–'}</Descriptions.Item>
                </Descriptions>
              </Card>
              <Card title="Özet">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Ödeme Yöntemi">
                    {paymentMethodLabels[order.payment_method]}
                  </Descriptions.Item>
                  <Descriptions.Item label="Oluşturan">{order.created_by?.full_name ?? 'Müşteri'}</Descriptions.Item>
                  <Descriptions.Item label="Not">{order.note || '–'}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Space>
          </Col>
        </Row>

        <Card title="İlgili Stok Hareketleri" styles={{ body: { padding: 0 } }}>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={order.movements}
            locale={{ emptyText: 'Bu sipariş için henüz stok hareketi yok.' }}
            columns={[
              { title: 'Tarih', dataIndex: 'created_at', render: formatDateTime },
              {
                title: 'Ürün',
                key: 'product',
                render: (_, row) => `${row.product.sku} · ${row.product.name}`,
              },
              { title: 'İşlem', key: 'type', render: (_, row) => <MovementTypeTag type={row.movement_type} /> },
              {
                title: 'Miktar',
                key: 'quantity',
                align: 'right',
                render: (_, row) => <MovementQuantity type={row.movement_type} quantity={row.quantity} />,
              },
              {
                title: 'Stok',
                key: 'stock',
                align: 'right',
                render: (_, row) => `${formatNumber(row.previous_stock)} → ${formatNumber(row.new_stock)}`,
              },
              { title: 'Yapan', key: 'user', render: (_, row) => row.user.full_name },
            ]}
          />
        </Card>
      </Space>
    </PageContainer>
  );
}
