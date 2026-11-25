import { ArrowDownOutlined, ArrowUpOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  List,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Table,
  Typography,
} from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '@/api/client';
import {
  DASHBOARD_KEY,
  changePercent,
  useDashboardSummary,
  useSalesTrend,
  useTopProducts,
  type Granularity,
  type Period,
} from '@/api/dashboard';
import type { OrderListItem, OrderPage } from '@/api/orders';
import { STOCK_KEY } from '@/api/stock';
import type { CriticalProduct, Page } from '@/api/types';
import { ProductThumb } from '@/components/ProductThumb';
import { OrderStatusTag, StockStatusTag } from '@/components/StatusTag';
import { formatCurrency, formatDateTime, formatNumber, formatRelative } from '@/utils/format';
import { SalesTrendChart } from './SalesTrendChart';
import { usePageTitle } from '@/hooks/usePageTitle';

const periodOptions = [
  { label: 'Bugün', value: 'today' },
  { label: 'Bu Hafta', value: 'week' },
  { label: 'Bu Ay', value: 'month' },
];

function Change({ current, previous, label }: { current: string; previous: string; label: string }) {
  const percent = changePercent(current, previous);
  if (percent === null) return <Typography.Text type="secondary">{label} satış yok</Typography.Text>;
  const up = percent >= 0;
  return (
    <Typography.Text type={up ? 'success' : 'danger'}>
      {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} %
      {Math.abs(percent).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}{' '}
      <Typography.Text type="secondary">{label}</Typography.Text>
    </Typography.Text>
  );
}

/** Bölüm verisi alınamadığında boş durum yerine hata ve tekrar deneme gösterilir. */
function SectionError({ error, onRetry, title }: { error: unknown; onRetry: () => void; title: string }) {
  return (
    <Alert
      type="error"
      showIcon
      message={title}
      description={errorMessage(error)}
      action={
        <Button size="small" onClick={onRetry}>
          Tekrar Dene
        </Button>
      }
    />
  );
}

/** E-10 Dashboard (yalnızca yönetici). Satışlar onaylanmış ve iptal edilmemiş siparişlerden hesaplanır. */
export function DashboardPage() {
  usePageTitle('Genel Bakış');
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('month');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const summary = useDashboardSummary();
  const trend = useSalesTrend(granularity);
  const top = useTopProducts(period);
  const critical = useQuery({
    queryKey: [...STOCK_KEY, 'critical', 'top5'],
    queryFn: async () =>
      (await api.get<Page<CriticalProduct>>('/stock/critical', { params: { page_size: 5 } })).data.items,
  });
  const recent = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: async () => (await api.get<OrderPage>('/orders', { params: { page_size: 10 } })).data.items,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    void queryClient.invalidateQueries({ queryKey: STOCK_KEY });
    void queryClient.invalidateQueries({ queryKey: ['orders', 'recent'] });
  };

  const s = summary.data;
  const hasSales = trend.data?.some((point) => Number(point.amount) > 0);

  return (
    <PageContainer
      title="Genel Bakış"
      extra={[
        <Segmented key="period" options={periodOptions} value={period} onChange={(v) => setPeriod(v as Period)} />,
        <Button key="refresh" icon={<ReloadOutlined />} onClick={refresh}>
          Yenile
        </Button>,
      ]}
    >
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        {summary.isError ? (
          <SectionError
            title="Özet bilgiler yüklenemedi"
            error={summary.error}
            onRetry={() => void summary.refetch()}
          />
        ) : null}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <Card loading={summary.isPending}>
              <Statistic title="Bugünkü Satış" value={s ? formatCurrency(s.today_sales) : '–'} />
              {s ? <Change current={s.today_sales} previous={s.yesterday_sales} label="düne göre" /> : null}
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card loading={summary.isPending}>
              <Statistic title="Bu Ayki Satış" value={s ? formatCurrency(s.month_sales) : '–'} />
              {s ? <Change current={s.month_sales} previous={s.prev_month_sales} label="geçen aya göre" /> : null}
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Link to="/orders?status=pending">
              <Card loading={summary.isPending} hoverable>
                <Statistic title="Onay Bekleyen Sipariş" value={s?.pending_orders ?? '–'} groupSeparator="." />
                <Typography.Text type="secondary">Siparişlere git</Typography.Text>
              </Card>
            </Link>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Link to="/stock/critical">
              <Card loading={summary.isPending} hoverable>
                <Statistic
                  title="Kritik Stoktaki Ürün"
                  value={s?.critical_stock_count ?? '–'}
                  groupSeparator="."
                  valueStyle={s?.critical_stock_count ? { color: '#DC2626' } : undefined}
                />
                <Typography.Text type="secondary">Kritik stoka git</Typography.Text>
              </Card>
            </Link>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={16}>
            <Card
              title="Satış Trendi"
              extra={
                <Segmented
                  size="small"
                  value={granularity}
                  onChange={(v) => setGranularity(v as Granularity)}
                  options={[
                    { label: 'Son 30 gün', value: 'day' },
                    { label: 'Son 12 ay', value: 'month' },
                  ]}
                />
              }
            >
              {trend.isError ? (
                <SectionError
                  title="Satış trendi yüklenemedi"
                  error={trend.error}
                  onRetry={() => void trend.refetch()}
                />
              ) : trend.isPending ? (
                <Skeleton active />
              ) : hasSales && trend.data ? (
                <SalesTrendChart data={trend.data} granularity={granularity} />
              ) : (
                <Empty description="Henüz satış verisi yok." style={{ height: 280, paddingTop: 80 }} />
              )}
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card title="En Çok Satan Ürünler" loading={top.isPending} styles={{ body: { minHeight: 280 } }}>
              {top.isError ? (
                <SectionError
                  title="En çok satan ürünler yüklenemedi"
                  error={top.error}
                  onRetry={() => void top.refetch()}
                />
              ) : (
                <List
                  dataSource={top.data ?? []}
                  locale={{ emptyText: 'Bu dönemde satış yok.' }}
                  renderItem={(item, index) => (
                    <List.Item extra={<Typography.Text strong>{formatCurrency(item.revenue)}</Typography.Text>}>
                      <List.Item.Meta
                        avatar={<Typography.Text type="secondary">{index + 1}.</Typography.Text>}
                        title={<Link to={`/products/${item.product_id}`}>{item.name}</Link>}
                        description={`${formatNumber(item.quantity)} adet`}
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card title="Kritik Stoktaki Ürünler" extra={<Link to="/stock/critical">Tümünü Gör</Link>}>
              {critical.isError ? (
                <SectionError
                  title="Kritik stok listesi yüklenemedi"
                  error={critical.error}
                  onRetry={() => void critical.refetch()}
                />
              ) : critical.data && critical.data.length === 0 ? (
                <Space>
                  <CheckCircleOutlined style={{ color: '#059669' }} />
                  <Typography.Text>Kritik stokta ürün yok.</Typography.Text>
                </Space>
              ) : (
                <Table<CriticalProduct>
                  rowKey="id"
                  size="small"
                  pagination={false}
                  loading={critical.isPending}
                  dataSource={critical.data ?? []}
                  columns={[
                    {
                      title: 'Ürün',
                      key: 'product',
                      render: (_, row) => (
                        <Space>
                          <ProductThumb product={row} size={24} />
                          <Link to={`/products/${row.id}`}>{row.name}</Link>
                        </Space>
                      ),
                    },
                    { title: 'SKU', dataIndex: 'sku' },
                    { title: 'Stok', dataIndex: 'stock', align: 'right', render: formatNumber },
                    { title: 'Min.', dataIndex: 'min_stock', align: 'right', render: formatNumber },
                    {
                      title: 'Durum',
                      key: 'status',
                      render: (_, row) => <StockStatusTag stock={row.stock} minStock={row.min_stock} />,
                    },
                  ]}
                />
              )}
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card title="Son Siparişler" extra={<Link to="/orders">Tümünü Gör</Link>}>
              {recent.isError ? (
                <SectionError
                  title="Son siparişler yüklenemedi"
                  error={recent.error}
                  onRetry={() => void recent.refetch()}
                />
              ) : (
                <Table<OrderListItem>
                  rowKey="id"
                  size="small"
                  pagination={false}
                  loading={recent.isPending}
                  dataSource={recent.data ?? []}
                  locale={{ emptyText: 'Henüz sipariş yok.' }}
                  columns={[
                    {
                      title: 'Sipariş',
                      key: 'code',
                      render: (_, row) => (
                        <Link to={`/orders/${row.id}`} style={{ whiteSpace: 'nowrap' }}>
                          {row.order_code}
                        </Link>
                      ),
                    },
                    { title: 'Müşteri', key: 'customer', render: (_, row) => row.customer.full_name },
                    {
                      title: 'Tutar',
                      dataIndex: 'total_amount',
                      align: 'right',
                      render: (value: string) => <span style={{ whiteSpace: 'nowrap' }}>{formatCurrency(value)}</span>,
                    },
                    { title: 'Durum', key: 'status', render: (_, row) => <OrderStatusTag status={row.status} /> },
                    {
                      title: 'Tarih',
                      key: 'date',
                      render: (_, row) => (
                        <Typography.Text
                          type="secondary"
                          title={formatDateTime(row.created_at)}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {formatRelative(row.created_at)}
                        </Typography.Text>
                      ),
                    },
                  ]}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Space>
    </PageContainer>
  );
}
