import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Col, Descriptions, Popconfirm, Result, Row, Space, Statistic, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage } from '@/api/client';
import type { Page, ProductDetail, StockMovement } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { FullPageSpinner } from '@/auth/guards';
import { CategoryTag } from '@/components/CategoryTag';
import { ProductThumb } from '@/components/ProductThumb';
import { ActiveTag, MovementQuantity, MovementTypeTag, StockStatusTag } from '@/components/StatusTag';
import { tablePagination } from '@/utils/table';
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format';
import { movementTypeLabels } from '@/utils/labels';
import { ProductFormModal } from './ProductFormModal';

interface MovementFilters {
  movement_type?: string;
  created_at?: [string, string];
  updatedAt?: string;
  current?: number;
  pageSize?: number;
}

function marginText(sale: string, cost: string | undefined) {
  const salePrice = Number(sale);
  const costPrice = Number(cost ?? 0);
  if (!salePrice) return '–';
  const margin = ((salePrice - costPrice) / salePrice) * 100;
  return `${margin.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}%`;
}

/** E-13 Ürün Detayı ve Stok Geçmişi */
export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const queryKey = ['products', id];

  const {
    data: product,
    error,
    isPending,
  } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<ProductDetail>(`/products/${id}`)).data,
  });

  if (isPending) return <FullPageSpinner />;
  if (error || !product) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Result
        status={notFound ? '404' : 'error'}
        title={notFound ? 'Ürün bulunamadı' : errorMessage(error)}
        extra={<Button onClick={() => navigate('/products')}>Ürünlere Dön</Button>}
      />
    );
  }

  const refresh = () => void queryClient.invalidateQueries({ queryKey });

  const setStatus = async (isActive: boolean) => {
    try {
      await api.patch(`/products/${product.id}/status`, { is_active: isActive });
      message.success(isActive ? 'Ürün aktifleştirildi.' : 'Ürün pasife alındı.');
      refresh();
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const columns: ProColumns<StockMovement>[] = [
    {
      title: 'Tarih',
      dataIndex: 'created_at',
      valueType: 'dateRange',
      fieldProps: { placeholder: ['Başlangıç', 'Bitiş'] },
      render: (_, row) => formatDateTime(row.created_at),
    },
    {
      title: 'İşlem Türü',
      dataIndex: 'movement_type',
      valueType: 'select',
      fieldProps: { placeholder: 'Tümü' },
      valueEnum: Object.fromEntries(Object.entries(movementTypeLabels).map(([key, label]) => [key, { text: label }])),
      render: (_, row) => <MovementTypeTag type={row.movement_type} />,
    },
    {
      title: 'Miktar',
      dataIndex: 'quantity',
      search: false,
      align: 'right',
      render: (_, row) => <MovementQuantity type={row.movement_type} quantity={row.quantity} />,
    },
    {
      title: 'Önceki Stok',
      dataIndex: 'previous_stock',
      search: false,
      align: 'right',
      render: (_, row) => formatNumber(row.previous_stock),
    },
    {
      title: 'Yeni Stok',
      dataIndex: 'new_stock',
      search: false,
      align: 'right',
      render: (_, row) => formatNumber(row.new_stock),
    },
    { title: 'Açıklama', dataIndex: 'description', search: false, ellipsis: true },
    { title: 'Yapan', dataIndex: ['user', 'full_name'], search: false },
    {
      title: 'Sipariş',
      dataIndex: 'order',
      search: false,
      render: (_, row) => (row.order ? <Link to={`/orders/${row.order.id}`}>{row.order.order_code}</Link> : '–'),
    },
  ];

  return (
    <PageContainer
      title={product.name}
      onBack={() => navigate('/products')}
      breadcrumb={{ items: [{ title: <Link to="/products">Ürünler</Link> }, { title: product.name }] }}
      extra={
        isAdmin
          ? [
              <Button key="edit" onClick={() => setEditOpen(true)}>
                Düzenle
              </Button>,
              product.is_active ? (
                <Popconfirm
                  key="status"
                  title="Ürün pasife alınsın mı?"
                  okText="Pasife Al"
                  cancelText="Vazgeç"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => setStatus(false)}
                >
                  <Button danger>Pasife Al</Button>
                </Popconfirm>
              ) : (
                <Button key="status" onClick={() => setStatus(true)}>
                  Aktifleştir
                </Button>
              ),
            ]
          : []
      }
    >
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card>
          <Row gutter={24} wrap={false}>
            <Col flex="none">
              <ProductThumb product={product} size={120} />
            </Col>
            <Col flex="auto" style={{ minWidth: 0 }}>
              <Descriptions column={{ xs: 1, md: 2 }} size="small">
                <Descriptions.Item label="SKU">
                  <Typography.Text copyable>{product.sku}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Kategori">
                  <CategoryTag category={product.category} />
                </Descriptions.Item>
                <Descriptions.Item label="Satış Fiyatı">{formatCurrency(product.sale_price)}</Descriptions.Item>
                {isAdmin ? (
                  <Descriptions.Item label="Maliyet">
                    {formatCurrency(product.cost_price)} · Kâr marjı{' '}
                    {marginText(product.sale_price, product.cost_price)}
                  </Descriptions.Item>
                ) : null}
                <Descriptions.Item label="Durum">
                  <ActiveTag active={product.is_active} />
                </Descriptions.Item>
                <Descriptions.Item label="Oluşturma">{formatDateTime(product.created_at)}</Descriptions.Item>
                <Descriptions.Item label="Açıklama" span={2}>
                  {product.description || '–'}
                </Descriptions.Item>
              </Descriptions>
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic
                title={
                  <Space size={8}>
                    Mevcut Stok
                    <StockStatusTag stock={product.stock} minStock={product.min_stock} />
                  </Space>
                }
                value={product.stock}
                groupSeparator="."
              />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="Minimum Stok" value={product.min_stock} groupSeparator="." />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="Son 30 Günde Satılan" value={product.stats.sold_last_30_days} groupSeparator="." />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="Son Hareket" value={formatDateTime(product.stats.last_movement_at)} />
            </Card>
          </Col>
        </Row>

        <ProTable<StockMovement, MovementFilters>
          headerTitle="Stok Hareketleri"
          rowKey="id"
          columns={columns}
          search={{ labelWidth: 'auto', searchText: 'Filtrele', resetText: 'Temizle' }}
          options={false}
          pagination={tablePagination}
          locale={{ emptyText: 'Bu ürün için henüz stok hareketi yok.' }}
          params={{ updatedAt: product.updated_at }}
          request={async (params) => {
            const [from, to] = params.created_at ?? [];
            const { data } = await api.get<Page<StockMovement>>(`/products/${product.id}/movements`, {
              params: {
                page: params.current,
                page_size: params.pageSize,
                type: params.movement_type || undefined,
                from: from ? dayjs(from).startOf('day').format() : undefined,
                to: to ? dayjs(to).endOf('day').format() : undefined,
              },
            });
            return { data: data.items, total: data.total, success: true };
          }}
        />
      </Space>

      {isAdmin ? (
        <ProductFormModal open={editOpen} product={product} onOpenChange={setEditOpen} onSaved={refresh} />
      ) : null}
    </PageContainer>
  );
}
