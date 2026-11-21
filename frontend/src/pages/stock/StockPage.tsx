import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { App, Button, Card, Col, Input, Row, Select, Space, Statistic } from 'antd';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toSortParam, useCategories } from '@/api/catalog';
import { api, errorMessage } from '@/api/client';
import { useStockSummary } from '@/api/stock';
import type { Page, Product } from '@/api/types';
import { CategoryTag } from '@/components/CategoryTag';
import { ProductThumb } from '@/components/ProductThumb';
import { StockStatusTag } from '@/components/StatusTag';
import { StockMovementModal, type ManualMovementType, type MovementProduct } from '@/components/StockMovementModal';
import { formatDateTime, formatNumber } from '@/utils/format';
import { stockStatusLabels, type StockStatus } from '@/utils/labels';
import { tablePagination } from '@/utils/table';

interface StockFilters {
  keyword: string;
  categoryIds: number[];
  stockStatus?: StockStatus;
}

/** E-15 Stok İşlemleri: ürünü bulup giriş ya da çıkış yapmak. Barkod okuyucuyla da kullanılabilir. */
export function StockPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const { data: categories = [] } = useCategories();
  const { data: summary } = useStockSummary();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<StockFilters>({ keyword: '', categoryIds: [] });
  const [modal, setModal] = useState<{ product: MovementProduct; type: ManualMovementType } | null>(null);

  // Enter: tek sonuç varsa işlem penceresi doğrudan açılır (barkod okutma senaryosu).
  const onSearch = async (value: string) => {
    const keyword = value.trim();
    setFilters((f) => ({ ...f, keyword }));
    if (!keyword) return;
    try {
      const { data } = await api.get<Page<Product>>('/products', {
        params: { search: keyword, is_active: true, page_size: 2 },
      });
      if (data.total === 1) setModal({ product: data.items[0], type: 'in' });
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const columns: ProColumns<Product>[] = [
    { title: 'SKU', dataIndex: 'sku', width: 120, sorter: true },
    {
      title: 'Ürün',
      dataIndex: 'name',
      sorter: true,
      width: 260,
      render: (_, row) => (
        <Space>
          <ProductThumb product={row} size={32} />
          <Link to={`/products/${row.id}`}>{row.name}</Link>
        </Space>
      ),
    },
    {
      title: 'Kategori',
      dataIndex: 'category',
      width: 150,
      render: (_, row) => <CategoryTag category={row.category} />,
    },
    {
      title: 'Mevcut Stok',
      dataIndex: 'stock',
      sorter: true,
      align: 'right',
      width: 120,
      render: (_, row) => (
        <strong
          className="tabular-nums"
          style={{ fontSize: 16, color: row.stock_status === 'sufficient' ? undefined : '#DC2626' }}
        >
          {formatNumber(row.stock)}
        </strong>
      ),
    },
    {
      title: 'Min. Stok',
      dataIndex: 'min_stock',
      align: 'right',
      width: 100,
      render: (_, row) => formatNumber(row.min_stock),
    },
    {
      title: 'Durum',
      key: 'status',
      width: 110,
      render: (_, row) => <StockStatusTag stock={row.stock} minStock={row.min_stock} />,
    },
    {
      title: 'Son Hareket',
      dataIndex: 'last_movement_at',
      width: 150,
      render: (_, row) => formatDateTime(row.last_movement_at),
    },
    {
      title: 'İşlemler',
      valueType: 'option',
      fixed: 'right',
      width: 230,
      render: (_, row) => [
        <Button
          key="in"
          size="small"
          icon={<PlusOutlined />}
          style={{ color: '#059669', borderColor: '#A7F3D0' }}
          onClick={() => setModal({ product: row, type: 'in' })}
        >
          Giriş
        </Button>,
        <Button
          key="out"
          size="small"
          danger
          icon={<MinusOutlined />}
          onClick={() => setModal({ product: row, type: 'out' })}
        >
          Çıkış
        </Button>,
        <Link key="history" to={`/products/${row.id}`}>
          Geçmiş
        </Link>,
      ],
    },
  ];

  return (
    <PageContainer title="Stok İşlemleri">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Input.Search
          size="large"
          allowClear
          autoFocus
          placeholder="Ürün adı veya SKU ile arayın"
          enterButton="Ara"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!e.target.value) setFilters((f) => ({ ...f, keyword: '' }));
          }}
          onSearch={onSearch}
        />

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Statistic title="Aktif Ürün" value={summary?.active_products ?? '–'} groupSeparator="." />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Link to="/stock/critical">
              <Card size="small" hoverable>
                <Statistic
                  title="Kritik Stok"
                  value={summary?.critical_count ?? '–'}
                  valueStyle={summary?.critical_count ? { color: '#DC2626' } : undefined}
                />
              </Card>
            </Link>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Statistic title="Bugünkü Hareket" value={summary?.today_movements ?? '–'} groupSeparator="." />
            </Card>
          </Col>
        </Row>

        <ProTable<Product>
          rowKey="id"
          actionRef={actionRef}
          columns={columns}
          search={false}
          scroll={{ x: 1100 }}
          options={{ reload: true, density: false, setting: false }}
          pagination={tablePagination}
          params={filters}
          locale={{
            emptyText: filters.keyword ? `'${filters.keyword}' ile eşleşen ürün yok.` : 'Ürün bulunamadı.',
          }}
          toolBarRender={() => [
            <Select
              key="category"
              mode="multiple"
              allowClear
              placeholder="Kategori"
              style={{ minWidth: 200 }}
              maxTagCount="responsive"
              options={categories.map((c) => ({ label: c.name, value: c.id }))}
              onChange={(categoryIds: number[]) => setFilters((f) => ({ ...f, categoryIds }))}
            />,
            <Select
              key="status"
              allowClear
              placeholder="Stok durumu"
              style={{ width: 160 }}
              options={Object.entries(stockStatusLabels).map(([value, label]) => ({ value, label }))}
              onChange={(stockStatus?: StockStatus) => setFilters((f) => ({ ...f, stockStatus }))}
            />,
          ]}
          request={async (params, sort) => {
            const { data } = await api.get<Page<Product>>('/products', {
              params: {
                page: params.current,
                page_size: params.pageSize,
                search: filters.keyword || undefined,
                category_id: filters.categoryIds.length ? filters.categoryIds : undefined,
                stock_status: filters.stockStatus,
                is_active: true,
                sort: toSortParam(sort, 'name'),
              },
              paramsSerializer: { indexes: null },
            });
            return { data: data.items, total: data.total, success: true };
          }}
        />
      </Space>

      <StockMovementModal
        product={modal?.product ?? null}
        initialType={modal?.type}
        onClose={() => setModal(null)}
        onSaved={() => actionRef.current?.reload()}
      />
    </PageContainer>
  );
}
