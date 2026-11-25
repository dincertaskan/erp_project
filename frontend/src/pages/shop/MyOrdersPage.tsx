import { useQuery } from '@tanstack/react-query';
import { Alert, Avatar, Button, Card, Empty, Input, Pagination, Segmented, Skeleton, Space, Typography } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '@/api/client';
import type { MyOrderSummary, StatusGroup } from '@/api/shop';
import type { Page } from '@/api/types';
import { OrderStatusTag } from '@/components/StatusTag';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { MyOrderCancelButton } from './MyOrderCancelButton';
import { ProductImage } from './ShopProductCard';

type Tab = StatusGroup | 'all';

const tabs: { value: Tab; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'active', label: 'Devam Eden' },
  { value: 'completed', label: 'Tamamlanan' },
  { value: 'cancelled', label: 'İptal' },
];

const PAGE_SIZE = 10;

function OrderCard({ order }: { order: MyOrderSummary }) {
  const navigate = useNavigate();
  const more = order.item_count - order.preview.length;
  return (
    <Card size="small">
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <Space direction="vertical" size={2}>
          <Space>
            <Link to={`/shop/orders/${order.id}`}>
              <Typography.Text strong>{order.order_code}</Typography.Text>
            </Link>
            <OrderStatusTag status={order.status} />
          </Space>
          <Typography.Text type="secondary">{formatDateTime(order.created_at)}</Typography.Text>
        </Space>
        <Typography.Text strong style={{ fontSize: 16 }}>
          {formatCurrency(order.total_amount)}
        </Typography.Text>
      </Space>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginTop: 12 }} wrap>
        <Space size={8}>
          {order.preview.map((item) => (
            <div key={item.product_id} title={item.name} style={{ width: 40, borderRadius: 4, overflow: 'hidden' }}>
              <ProductImage src={item.image_url} alt={item.name} height={40} />
            </div>
          ))}
          {more > 0 ? <Avatar shape="square" size={40}>{`+${more}`}</Avatar> : null}
        </Space>
        <Space>
          <MyOrderCancelButton order={order} />
          <Button onClick={() => navigate(`/shop/orders/${order.id}`)}>Detay</Button>
        </Space>
      </Space>
    </Card>
  );
}

/** E-34 Siparişlerim */
export function MyOrdersPage() {
  const navigate = useNavigate();
  usePageTitle('Siparişlerim');
  // Filtreler adreste tutulur; detaydan geri dönünce aynı sekme ve sayfa açılır.
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('status') as Tab | null;
  const tab: Tab = requestedTab && tabs.some((t) => t.value === requestedTab) ? requestedTab : 'all';
  const search = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const updateParams = (patch: { status?: Tab; q?: string; page?: number }) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      const values = { status: tab, q: search, page: 1, ...patch };
      if (values.status === 'all') next.delete('status');
      else next.set('status', values.status);
      if (values.q) next.set('q', values.q);
      else next.delete('q');
      if (values.page > 1) next.set('page', String(values.page));
      else next.delete('page');
      return next;
    });

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['me', 'orders', { tab, search, page }],
    queryFn: async () =>
      (
        await api.get<Page<MyOrderSummary>>('/me/orders', {
          params: {
            status_group: tab === 'all' ? undefined : tab,
            search: search || undefined,
            page,
            page_size: PAGE_SIZE,
          },
        })
      ).data,
    placeholderData: (previous) => previous,
  });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Siparişlerim
      </Typography.Title>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Segmented options={tabs} value={tab} onChange={(value) => updateParams({ status: value as Tab })} />
        <Input.Search
          key={search}
          allowClear
          placeholder="Sipariş kodu"
          style={{ width: 220 }}
          defaultValue={search}
          onSearch={(value) => updateParams({ q: value.trim() })}
        />
      </Space>

      {isError && !data ? (
        <Alert
          type="error"
          showIcon
          message="Siparişleriniz yüklenemedi"
          description={errorMessage(error)}
          action={
            <Button size="small" onClick={() => void refetch()} loading={isFetching}>
              Tekrar Dene
            </Button>
          }
        />
      ) : isPending || !data ? (
        <Card>
          <Skeleton active />
        </Card>
      ) : data.items.length === 0 ? (
        <Card>
          <Empty description={tab === 'all' && !search ? 'Henüz siparişiniz yok.' : 'Bu filtrede sipariş yok.'}>
            {tab === 'all' && !search ? (
              <Button type="primary" onClick={() => navigate('/shop')}>
                Alışverişe Başla
              </Button>
            ) : null}
          </Empty>
        </Card>
      ) : (
        <>
          {data.items.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
          <Pagination
            align="center"
            current={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            hideOnSinglePage
            onChange={(next) => updateParams({ page: next })}
          />
        </>
      )}
    </Space>
  );
}
