import { PlusOutlined } from '@ant-design/icons';
import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Alert, Button, Result, Select, Space } from 'antd';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCategories } from '@/api/catalog';
import { api } from '@/api/client';
import { useCriticalCount } from '@/api/stock';
import type { CriticalProduct, Page } from '@/api/types';
import { CategoryTag } from '@/components/CategoryTag';
import { ProductThumb } from '@/components/ProductThumb';
import { StockStatusTag } from '@/components/StatusTag';
import { StockMovementModal, type MovementProduct } from '@/components/StockMovementModal';
import { formatNumber } from '@/utils/format';
import { tablePagination } from '@/utils/table';
import { usePageTitle } from '@/hooks/usePageTitle';

/** E-18 Kritik Stok: stoğu 0 ile minimum arasındaki (0 < stok < minimum) ürünler, en kritik olan önce. Tükenenler burada yer almaz. */
export function CriticalStockPage() {
  usePageTitle('Kritik Stok');
  const actionRef = useRef<ActionType>(null);
  const { data: categories = [] } = useCategories();
  const { data: count, isPending } = useCriticalCount();
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [product, setProduct] = useState<MovementProduct | null>(null);

  const columns: ProColumns<CriticalProduct>[] = [
    {
      title: 'Ürün',
      dataIndex: 'name',
      width: 260,
      render: (_, row) => (
        <Space>
          <ProductThumb product={row} size={32} />
          <Link to={`/products/${row.id}`}>{row.name}</Link>
        </Space>
      ),
    },
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    {
      title: 'Kategori',
      dataIndex: 'category',
      width: 150,
      render: (_, row) => <CategoryTag category={row.category} />,
    },
    {
      title: 'Mevcut Stok',
      dataIndex: 'stock',
      align: 'right',
      width: 110,
      render: (_, row) => (
        <strong className="tabular-nums" style={{ color: '#DC2626' }}>
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
      title: 'Eksik Miktar',
      dataIndex: 'shortage',
      align: 'right',
      width: 110,
      render: (_, row) => formatNumber(row.shortage),
    },
    {
      title: 'Son 30 Gün Satış',
      dataIndex: 'sold_last_30_days',
      align: 'right',
      width: 140,
      render: (_, row) => formatNumber(row.sold_last_30_days),
    },
    {
      title: 'Durum',
      key: 'status',
      width: 110,
      render: (_, row) => <StockStatusTag stock={row.stock} minStock={row.min_stock} />,
    },
    {
      title: 'İşlemler',
      valueType: 'option',
      fixed: 'right',
      width: 140,
      render: (_, row) => [
        <Button key="in" size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => setProduct(row)}>
          Stok Girişi
        </Button>,
      ],
    },
  ];

  const allFine = !isPending && count === 0;

  return (
    <PageContainer title="Kritik Stok">
      {allFine ? (
        <Result
          status="success"
          title="Kritik stokta ürün yok."
          subTitle={'Stokta olmayan ürünleri Ürünler sayfasında "Stokta Yok" filtresiyle görebilirsiniz.'}
        />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {count ? <Alert type="error" showIcon message={`${count} ürün kritik stok seviyesinde.`} /> : null}
          <ProTable<CriticalProduct>
            rowKey="id"
            actionRef={actionRef}
            columns={columns}
            search={false}
            scroll={{ x: 1100 }}
            options={{ reload: true, density: false, setting: false }}
            pagination={tablePagination}
            params={{ categoryIds }}
            locale={{ emptyText: 'Bu kategoride kritik stokta ürün yok.' }}
            toolBarRender={() => [
              <Select
                key="category"
                mode="multiple"
                allowClear
                placeholder="Kategori"
                style={{ minWidth: 220 }}
                maxTagCount="responsive"
                options={categories.map((c) => ({ label: c.name, value: c.id }))}
                onChange={setCategoryIds}
              />,
            ]}
            request={async (params) => {
              const { data } = await api.get<Page<CriticalProduct>>('/stock/critical', {
                params: {
                  page: params.current,
                  page_size: params.pageSize,
                  category_id: categoryIds.length ? categoryIds : undefined,
                },
                paramsSerializer: { indexes: null },
              });
              return { data: data.items, total: data.total, success: true };
            }}
          />
        </Space>
      )}

      <StockMovementModal
        product={product}
        initialType="in"
        onClose={() => setProduct(null)}
        onSaved={() => actionRef.current?.reload()}
      />
    </PageContainer>
  );
}
