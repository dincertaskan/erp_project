import { PlusOutlined } from '@ant-design/icons';
import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Badge, Button, Space } from 'antd';
import dayjs from 'dayjs';
import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import type { OrderListItem, OrderPage } from '@/api/orders';
import { useAuth } from '@/auth/useAuth';
import { OrderActions } from '@/components/OrderActions';
import { OrderStatusTag } from '@/components/StatusTag';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { orderStatusLabels, paymentMethodLabels, type OrderStatus } from '@/utils/labels';
import { tablePagination } from '@/utils/table';

type Tab = OrderStatus | 'all';

const ADMIN_TABS: Tab[] = ['all', 'pending', 'preparing', 'shipped', 'completed', 'cancelled'];
const WAREHOUSE_TABS: Tab[] = ['preparing', 'shipped'];

interface OrderFilters {
  tab?: Tab;
  keyword?: string;
  created_at?: [string, string];
  current?: number;
  pageSize?: number;
}

/** E-19 Sipariş Listesi. Depo personeli yalnızca Hazırlanıyor ve Kargolandı sekmelerini görür. */
export function OrdersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const tabs = isAdmin ? ADMIN_TABS : WAREHOUSE_TABS;
  const [params] = useSearchParams();
  // Dashboard'dan ?status=pending ile gelinebilir.
  const requested = params.get('status') as Tab | null;
  const [tab, setTab] = useState<Tab>(requested && tabs.includes(requested) ? requested : tabs[0]);
  const [counts, setCounts] = useState<OrderPage['counts_by_status']>({});
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);

  const columns: ProColumns<OrderListItem>[] = [
    {
      title: 'Arama',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: 'Sipariş kodu veya müşteri' },
    },
    {
      title: 'Tarih',
      dataIndex: 'created_at',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: { placeholder: ['Başlangıç', 'Bitiş'] },
    },
    {
      title: 'Sipariş Kodu',
      dataIndex: 'order_code',
      search: false,
      width: 170,
      render: (_, row) => <Link to={`/orders/${row.id}`}>{row.order_code}</Link>,
    },
    { title: 'Tarih', key: 'date', search: false, width: 150, render: (_, row) => formatDateTime(row.created_at) },
    ...(isAdmin
      ? [
          {
            title: 'Müşteri',
            dataIndex: ['customer', 'full_name'],
            search: false,
            width: 180,
            render: (_, row) => <Link to={`/customers/${row.customer.id}`}>{row.customer.full_name}</Link>,
          } satisfies ProColumns<OrderListItem>,
        ]
      : []),
    { title: 'Kalem', dataIndex: 'item_count', search: false, width: 90, render: (_, row) => `${row.item_count} ürün` },
    {
      title: 'Toplam Tutar',
      dataIndex: 'total_amount',
      search: false,
      align: 'right',
      width: 140,
      render: (_, row) => <span className="tabular-nums">{formatCurrency(row.total_amount)}</span>,
    },
    {
      title: 'Ödeme',
      dataIndex: 'payment_method',
      search: false,
      width: 130,
      render: (_, row) => paymentMethodLabels[row.payment_method],
    },
    {
      title: 'Durum',
      dataIndex: 'status',
      search: false,
      width: 140,
      render: (_, row) => <OrderStatusTag status={row.status} />,
    },
    {
      title: 'İşlemler',
      valueType: 'option',
      fixed: 'right',
      width: 270,
      render: (_, row) => (
        <Space size={8}>
          <OrderActions order={row} size="small" onDone={() => actionRef.current?.reload()} />
          <Link to={`/orders/${row.id}`}>Detay</Link>
        </Space>
      ),
    },
  ];

  const tabLabel = (key: Tab) => {
    const count = key === 'all' ? total : (counts[key] ?? 0);
    return (
      <Space size={6}>
        {key === 'all' ? 'Tümü' : orderStatusLabels[key]}
        <Badge count={count} showZero overflowCount={9999} color="#E5E7EB" style={{ color: '#4B5563' }} />
      </Space>
    );
  };

  return (
    <PageContainer
      title="Siparişler"
      extra={
        isAdmin
          ? [
              <Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/orders/new')}>
                Yeni Sipariş
              </Button>,
            ]
          : []
      }
    >
      <ProTable<OrderListItem, OrderFilters>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        scroll={{ x: 1300 }}
        params={{ tab }}
        search={{ labelWidth: 'auto', searchText: 'Ara', resetText: 'Temizle' }}
        options={{ reload: true, density: false, setting: false }}
        pagination={tablePagination}
        locale={{ emptyText: 'Bu durumda sipariş yok.' }}
        toolbar={{
          menu: {
            type: 'tab',
            activeKey: tab,
            items: tabs.map((key) => ({ key, label: tabLabel(key) })),
            onChange: (key) => setTab(key as Tab),
          },
        }}
        request={async (params) => {
          const [from, to] = params.created_at ?? [];
          const { data } = await api.get<OrderPage>('/orders', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              status: tab === 'all' ? undefined : tab,
              search: params.keyword || undefined,
              from: from ? dayjs(from).startOf('day').format() : undefined,
              to: to ? dayjs(to).endOf('day').format() : undefined,
            },
          });
          setCounts(data.counts_by_status);
          return { data: data.items, total: data.total, success: true };
        }}
      />
    </PageContainer>
  );
}
