import { useQuery } from '@tanstack/react-query';
import { Avatar, Button, Card, Empty, Input, Pagination, Segmented, Skeleton, Space, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import type { MyOrderSummary, StatusGroup } from '@/api/shop';
import type { Page } from '@/api/types';
import { OrderStatusTag } from '@/components/StatusTag';
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
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isPending } = useQuery({
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
        <Segmented
          options={tabs}
          value={tab}
          onChange={(value) => {
            setTab(value as Tab);
            setPage(1);
          }}
        />
        <Input.Search
          allowClear
          placeholder="Sipariş kodu"
          style={{ width: 220 }}
          onSearch={(value) => {
            setSearch(value.trim());
            setPage(1);
          }}
        />
      </Space>

      {isPending || !data ? (
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
            onChange={setPage}
          />
        </>
      )}
    </Space>
  );
}
