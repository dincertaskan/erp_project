import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components';
import { Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import type { Page, Product, StockMovementListItem, User } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { MovementQuantity, MovementTypeTag } from '@/components/StatusTag';
import { formatDateTime, formatNumber } from '@/utils/format';
import { movementTypeLabels } from '@/utils/labels';
import { tablePagination } from '@/utils/table';

interface MovementFilters {
  created_at?: [string, string];
  product_id?: number;
  movement_type?: string[];
  user_id?: number;
  order_code?: string;
  current?: number;
  pageSize?: number;
}

const lastSevenDays = (): [dayjs.Dayjs, dayjs.Dayjs] => [dayjs().subtract(6, 'day'), dayjs()];

async function searchProducts(keyWords?: string) {
  const { data } = await api.get<Page<Product>>('/products', {
    params: { search: keyWords || undefined, page_size: 20 },
  });
  return data.items.map((p) => ({ label: `${p.sku} · ${p.name}`, value: p.id }));
}

async function loadUsers() {
  const { data } = await api.get<Page<User>>('/users', { params: { page_size: 100 } });
  return data.items.filter((u) => u.role !== 'customer').map((u) => ({ label: u.full_name, value: u.id }));
}

/** E-17 Stok Hareketleri: tüm ürünlerin hareket geçmişi. Kullanıcı filtresi yalnızca yöneticide (kullanıcı listesi yöneticiye açık). */
export function StockMovementsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const columns: ProColumns<StockMovementListItem>[] = [
    {
      title: 'Tarih',
      dataIndex: 'created_at',
      valueType: 'dateRange',
      initialValue: lastSevenDays(),
      fieldProps: { placeholder: ['Başlangıç', 'Bitiş'] },
      width: 150,
      render: (_, row) => formatDateTime(row.created_at),
    },
    {
      title: 'Ürün',
      dataIndex: 'product_id',
      valueType: 'select',
      width: 240,
      fieldProps: { showSearch: true, placeholder: 'Ürün ara' },
      request: async ({ keyWords }) => searchProducts(keyWords as string | undefined),
      debounceTime: 300,
      render: (_, row) => (
        <Link to={`/products/${row.product.id}`}>
          <Typography.Text type="secondary">{row.product.sku}</Typography.Text> {row.product.name}
        </Link>
      ),
    },
    {
      title: 'İşlem Türü',
      dataIndex: 'movement_type',
      valueType: 'select',
      width: 140,
      fieldProps: { mode: 'multiple', placeholder: 'Tümü', maxTagCount: 'responsive' },
      valueEnum: Object.fromEntries(Object.entries(movementTypeLabels).map(([key, label]) => [key, { text: label }])),
      render: (_, row) => <MovementTypeTag type={row.movement_type} />,
    },
    {
      title: 'Miktar',
      dataIndex: 'quantity',
      search: false,
      align: 'right',
      width: 90,
      render: (_, row) => <MovementQuantity type={row.movement_type} quantity={row.quantity} />,
    },
    {
      title: 'Önceki Stok',
      dataIndex: 'previous_stock',
      search: false,
      align: 'right',
      width: 110,
      render: (_, row) => formatNumber(row.previous_stock),
    },
    {
      title: 'Yeni Stok',
      dataIndex: 'new_stock',
      search: false,
      align: 'right',
      width: 100,
      render: (_, row) => formatNumber(row.new_stock),
    },
    {
      title: 'Açıklama',
      dataIndex: 'description',
      search: false,
      width: 220,
      ellipsis: true,
      render: (_, row) =>
        row.description ? (
          <Tooltip title={row.description}>
            <span>{row.description}</span>
          </Tooltip>
        ) : (
          '–'
        ),
    },
    {
      title: 'Yapan',
      dataIndex: 'user_id',
      valueType: 'select',
      width: 150,
      hideInSearch: !isAdmin,
      fieldProps: { placeholder: 'Tümü' },
      request: isAdmin ? loadUsers : undefined,
      render: (_, row) => row.user.full_name,
    },
    {
      title: 'Sipariş',
      dataIndex: 'order_code',
      width: 140,
      fieldProps: { placeholder: 'Sipariş kodu' },
      render: (_, row) => (row.order ? <Link to={`/orders/${row.order.id}`}>{row.order.order_code}</Link> : '–'),
    },
  ];

  return (
    <PageContainer title="Stok Hareketleri">
      <ProTable<StockMovementListItem, MovementFilters>
        rowKey="id"
        columns={columns}
        scroll={{ x: 1300 }}
        search={{ labelWidth: 'auto', searchText: 'Filtrele', resetText: 'Filtreleri Temizle' }}
        options={{ reload: true, density: false, setting: false }}
        pagination={tablePagination}
        locale={{ emptyText: 'Seçilen aralıkta stok hareketi yok.' }}
        request={async (params) => {
          const [from, to] = params.created_at ?? [];
          const { data } = await api.get<Page<StockMovementListItem>>('/stock/movements', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              from: from ? dayjs(from).startOf('day').format() : undefined,
              to: to ? dayjs(to).endOf('day').format() : undefined,
              product_id: params.product_id,
              type: params.movement_type?.length ? params.movement_type : undefined,
              user_id: params.user_id,
              order_code: params.order_code || undefined,
            },
            paramsSerializer: { indexes: null },
          });
          return { data: data.items, total: data.total, success: true };
        }}
      />
    </PageContainer>
  );
}
