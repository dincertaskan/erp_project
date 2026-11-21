import { PlusOutlined } from '@ant-design/icons';
import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Button } from 'antd';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toSortParam } from '@/api/catalog';
import { api } from '@/api/client';
import type { CustomerListItem } from '@/api/customers';
import type { Page } from '@/api/types';
import { CustomerFormModal } from '@/components/CustomerFormModal';
import { ActiveTag } from '@/components/StatusTag';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';
import { tablePagination } from '@/utils/table';

interface CustomerFilters {
  keyword?: string;
  city?: string;
  is_active?: 'true' | 'false' | 'all';
  has_account?: 'true' | 'false';
  current?: number;
  pageSize?: number;
}

/** E-22 Müşteri Listesi (yalnızca yönetici) */
export function CustomersPage() {
  const actionRef = useRef<ActionType>(null);
  const [editing, setEditing] = useState<CustomerListItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = (customer: CustomerListItem | null) => {
    setEditing(customer);
    setModalOpen(true);
  };

  const columns: ProColumns<CustomerListItem>[] = [
    {
      title: 'Arama',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: 'Ad, e-posta, telefon veya firma' },
    },
    {
      title: 'Şehir',
      dataIndex: 'city',
      valueType: 'select',
      hideInTable: true,
      fieldProps: { placeholder: 'Tümü', showSearch: true },
      request: async () =>
        (await api.get<string[]>('/customers/cities')).data.map((city) => ({ label: city, value: city })),
    },
    {
      title: 'Kayıt Durumu',
      dataIndex: 'is_active',
      valueType: 'select',
      hideInTable: true,
      initialValue: 'true',
      fieldProps: { allowClear: false },
      valueEnum: { true: { text: 'Aktif' }, false: { text: 'Pasif' }, all: { text: 'Tümü' } },
    },
    {
      title: 'Giriş Hesabı',
      dataIndex: 'has_account',
      valueType: 'select',
      hideInTable: true,
      fieldProps: { placeholder: 'Tümü' },
      valueEnum: { true: { text: 'Var' }, false: { text: 'Yok' } },
    },
    {
      title: 'Ad Soyad',
      dataIndex: 'full_name',
      search: false,
      sorter: true,
      width: 200,
      render: (_, row) => <Link to={`/customers/${row.id}`}>{row.full_name}</Link>,
    },
    {
      title: 'Firma',
      dataIndex: 'company_name',
      search: false,
      width: 160,
      render: (_, row) => row.company_name || '–',
    },
    { title: 'E-posta', dataIndex: 'email', search: false, width: 220, ellipsis: true },
    { title: 'Telefon', dataIndex: 'phone', search: false, width: 140, render: (_, row) => row.phone || '–' },
    { title: 'Şehir', key: 'city_col', search: false, width: 110, render: (_, row) => row.city || '–' },
    {
      title: 'Sipariş',
      dataIndex: 'order_count',
      search: false,
      sorter: true,
      align: 'right',
      width: 100,
      render: (_, row) => formatNumber(row.order_count),
    },
    {
      title: 'Toplam Harcama',
      dataIndex: 'total_spent',
      search: false,
      sorter: true,
      align: 'right',
      width: 150,
      tooltip: 'Onaylanmış ve iptal edilmemiş siparişler',
      render: (_, row) => <span className="tabular-nums">{formatCurrency(row.total_spent)}</span>,
    },
    {
      title: 'Son Sipariş',
      dataIndex: 'last_order_at',
      search: false,
      sorter: true,
      width: 120,
      render: (_, row) => formatDate(row.last_order_at),
    },
    {
      title: 'Durum',
      key: 'status',
      search: false,
      width: 90,
      render: (_, row) => <ActiveTag active={row.is_active} />,
    },
    {
      title: 'İşlemler',
      valueType: 'option',
      fixed: 'right',
      width: 130,
      render: (_, row) => [
        row.source === 'app' ? (
          <a key="edit" onClick={() => openModal(row)}>
            Düzenle
          </a>
        ) : null,
        <Link key="detail" to={`/customers/${row.id}`}>
          Detay
        </Link>,
      ],
    },
  ];

  return (
    <PageContainer
      title="Müşteriler"
      extra={[
        <Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
          Yeni Müşteri
        </Button>,
      ]}
    >
      <ProTable<CustomerListItem, CustomerFilters>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        scroll={{ x: 1500 }}
        search={{ labelWidth: 'auto', searchText: 'Ara', resetText: 'Temizle' }}
        options={{ reload: true, density: false, setting: true }}
        pagination={tablePagination}
        locale={{ emptyText: 'Müşteri bulunamadı.' }}
        request={async (params, sort) => {
          const { data } = await api.get<Page<CustomerListItem>>('/customers', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              search: params.keyword || undefined,
              city: params.city || undefined,
              is_active: params.is_active === 'all' ? undefined : params.is_active,
              has_account: params.has_account,
              sort: toSortParam(sort, 'full_name'),
            },
          });
          return { data: data.items, total: data.total, success: true };
        }}
      />
      <CustomerFormModal
        open={modalOpen}
        customer={editing}
        onOpenChange={setModalOpen}
        onSaved={() => actionRef.current?.reload()}
      />
    </PageContainer>
  );
}
