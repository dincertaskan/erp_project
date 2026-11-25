import { PlusOutlined } from '@ant-design/icons';
import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { useQueryClient } from '@tanstack/react-query';
import { App, Button, Popconfirm } from 'antd';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toSortParam, useCategories } from '@/api/catalog';
import { api, errorMessage } from '@/api/client';
import { invalidateStock } from '@/api/stock';
import type { Page, Product } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { CategoryTag } from '@/components/CategoryTag';
import { ProductThumb } from '@/components/ProductThumb';
import { ActiveTag, StockStatusTag } from '@/components/StatusTag';
import { tablePagination } from '@/utils/table';
import { formatCurrency, formatNumber } from '@/utils/format';
import { stockStatusLabels } from '@/utils/labels';
import { ProductFormModal } from './ProductFormModal';
import { DEACTIVATE_PRODUCT_DESCRIPTION, DEACTIVATE_PRODUCT_TITLE } from './productTexts';
import { ActionLink } from '@/components/ActionLink';
import { usePageTitle } from '@/hooks/usePageTitle';

interface ProductFilters {
  keyword?: string;
  category_id?: number[];
  stock_status?: string;
  is_active?: 'true' | 'false' | 'all';
  current?: number;
  pageSize?: number;
}

/** E-11 Ürün Listesi. Depo personeli salt okur ve maliyeti görmez. */
export function ProductsPage() {
  usePageTitle('Ürünler');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const { data: categories = [] } = useCategories();
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = (product: Product | null) => {
    setEditing(product);
    setModalOpen(true);
  };

  const setStatus = async (product: Product, isActive: boolean) => {
    try {
      await api.patch(`/products/${product.id}/status`, { is_active: isActive });
      message.success(isActive ? 'Ürün aktifleştirildi.' : 'Ürün pasife alındı.');
      // Pasif ürünler kritik stok sayısına girmez; rozet ve özet yenilenir.
      invalidateStock(queryClient);
      actionRef.current?.reload();
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const columns: ProColumns<Product>[] = [
    {
      title: 'Arama',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: 'Ürün adı veya SKU' },
    },
    {
      title: 'Kategori',
      dataIndex: 'category_id',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        placeholder: 'Tümü',
        mode: 'multiple',
        options: categories.map((c) => ({ label: c.name, value: c.id })),
        maxTagCount: 'responsive',
      },
    },
    {
      title: 'Stok Durumu',
      dataIndex: 'stock_status',
      hideInTable: true,
      valueType: 'select',
      fieldProps: { placeholder: 'Tümü' },
      valueEnum: Object.fromEntries(Object.entries(stockStatusLabels).map(([key, label]) => [key, { text: label }])),
    },
    {
      title: 'Kayıt Durumu',
      dataIndex: 'is_active',
      hideInTable: true,
      valueType: 'select',
      initialValue: 'true',
      fieldProps: { allowClear: false },
      valueEnum: { true: { text: 'Aktif' }, false: { text: 'Pasif' }, all: { text: 'Tümü' } },
    },
    {
      title: 'Görsel',
      dataIndex: 'image_url',
      search: false,
      width: 72,
      render: (_, row) => <ProductThumb product={row} />,
    },
    { title: 'SKU', dataIndex: 'sku', search: false, sorter: true, copyable: true, width: 140 },
    {
      title: 'Ürün Adı',
      dataIndex: 'name',
      search: false,
      sorter: true,
      width: 240,
      render: (_, row) => <Link to={`/products/${row.id}`}>{row.name}</Link>,
    },
    {
      title: 'Kategori',
      dataIndex: 'category',
      search: false,
      width: 160,
      render: (_, row) => <CategoryTag category={row.category} />,
    },
    {
      title: 'Satış Fiyatı',
      dataIndex: 'sale_price',
      search: false,
      sorter: true,
      width: 140,
      align: 'right',
      render: (_, row) => <span className="tabular-nums">{formatCurrency(row.sale_price)}</span>,
    },
    ...(isAdmin
      ? [
          {
            title: 'Maliyet',
            dataIndex: 'cost_price',
            search: false,
            sorter: true,
            width: 130,
            align: 'right',
            render: (_, row) => <span className="tabular-nums">{formatCurrency(row.cost_price)}</span>,
          } satisfies ProColumns<Product>,
        ]
      : []),
    {
      title: 'Stok',
      dataIndex: 'stock',
      search: false,
      sorter: true,
      width: 90,
      align: 'right',
      render: (_, row) => (
        <span className="tabular-nums" style={row.stock_status === 'sufficient' ? undefined : { color: '#DC2626' }}>
          {formatNumber(row.stock)}
        </span>
      ),
    },
    {
      title: 'Min. Stok',
      dataIndex: 'min_stock',
      search: false,
      width: 100,
      align: 'right',
      render: (_, row) => <span className="tabular-nums">{formatNumber(row.min_stock)}</span>,
    },
    {
      title: 'Stok Durumu',
      key: 'stock_status_tag',
      search: false,
      width: 120,
      render: (_, row) => <StockStatusTag stock={row.stock} minStock={row.min_stock} />,
    },
    {
      title: 'Durum',
      key: 'is_active_tag',
      search: false,
      width: 90,
      render: (_, row) => <ActiveTag active={row.is_active} />,
    },
    {
      title: 'İşlemler',
      valueType: 'option',
      fixed: 'right',
      width: isAdmin ? 200 : 80,
      render: (_, row) => [
        <Link key="detail" to={`/products/${row.id}`}>
          Detay
        </Link>,
        ...(isAdmin
          ? [
              <ActionLink key="edit" onClick={() => openModal(row)}>
                Düzenle
              </ActionLink>,
              row.is_active ? (
                <Popconfirm
                  key="status"
                  title={DEACTIVATE_PRODUCT_TITLE}
                  description={DEACTIVATE_PRODUCT_DESCRIPTION}
                  okText="Pasife Al"
                  cancelText="Vazgeç"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => setStatus(row, false)}
                >
                  <ActionLink danger>Pasife Al</ActionLink>
                </Popconfirm>
              ) : (
                <ActionLink key="status" onClick={() => setStatus(row, true)}>
                  Aktifleştir
                </ActionLink>
              ),
            ]
          : []),
      ],
    },
  ];

  return (
    <PageContainer title="Ürünler">
      <ProTable<Product, ProductFilters>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        scroll={{ x: 1400 }}
        search={{ labelWidth: 'auto', defaultCollapsed: false, searchText: 'Ara', resetText: 'Temizle' }}
        options={{ density: true, setting: true, reload: true }}
        pagination={tablePagination}
        locale={{ emptyText: 'Aramanıza uygun ürün bulunamadı.' }}
        request={async (params, sort) => {
          const { data } = await api.get<Page<Product>>('/products', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              search: params.keyword || undefined,
              category_id: params.category_id?.length ? params.category_id : undefined,
              stock_status: params.stock_status || undefined,
              is_active: params.is_active === 'all' ? undefined : params.is_active,
              sort: toSortParam(sort, 'name'),
            },
            paramsSerializer: { indexes: null },
          });
          return { data: data.items, total: data.total, success: true };
        }}
        toolBarRender={() =>
          isAdmin
            ? [
                <Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
                  Yeni Ürün
                </Button>,
              ]
            : []
        }
      />
      {isAdmin ? (
        <ProductFormModal
          open={modalOpen}
          product={editing}
          onOpenChange={setModalOpen}
          onSaved={() => actionRef.current?.reload()}
        />
      ) : null}
    </PageContainer>
  );
}
