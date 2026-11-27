import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Modal,
  Popconfirm,
  Result,
  Row,
  Space,
  Statistic,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, errorMessage } from '@/api/client';
import type { CustomerDetail, CustomerInvite, CustomerOrder } from '@/api/customers';
import type { Page } from '@/api/types';
import { FullPageSpinner } from '@/auth/guards';
import { CustomerFormModal } from '@/components/CustomerFormModal';
import { ActiveTag, OrderStatusTag } from '@/components/StatusTag';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { orderStatusLabels } from '@/utils/labels';
import { tablePagination } from '@/utils/table';
import { usePageTitle } from '@/hooks/usePageTitle';

interface OrderFilters {
  status?: string;
  created_at?: [string, string];
  current?: number;
  pageSize?: number;
}

/** E-24 Müşteri Detayı ve Sipariş Geçmişi */
export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [invite, setInvite] = useState<CustomerInvite | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const queryKey = ['customers', id];

  const {
    data: customer,
    error,
    isPending,
  } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<CustomerDetail>(`/customers/${id}`)).data,
  });

  usePageTitle(customer?.full_name ?? 'Müşteri Detayı');

  if (isPending) return <FullPageSpinner />;
  if (error || !customer) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Result
        status={notFound ? '404' : 'error'}
        title={notFound ? 'Müşteri bulunamadı' : errorMessage(error)}
        extra={<Button onClick={() => navigate('/customers')}>Müşterilere Dön</Button>}
      />
    );
  }

  const editable = customer.source === 'app';
  // Kayıt olan kişi bu karta yalnızca davet koduyla bağlanır; kod hesabı olmayan aktif uygulama kartları için üretilir.
  const canInvite = editable && customer.is_active && !customer.has_account;

  const createInvite = async () => {
    setCreatingInvite(true);
    try {
      const { data } = await api.post<CustomerInvite>(`/customers/${customer.id}/invite`);
      setInvite(data);
      queryClient.setQueryData<CustomerDetail>(queryKey, { ...customer, invite_expires_at: data.expires_at });
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setCreatingInvite(false);
    }
  };

  const setStatus = async (isActive: boolean) => {
    try {
      const { data } = await api.patch<CustomerDetail>(`/customers/${customer.id}/status`, { is_active: isActive });
      queryClient.setQueryData(queryKey, data);
      message.success(isActive ? 'Müşteri aktifleştirildi.' : 'Müşteri pasife alındı.');
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const columns: ProColumns<CustomerOrder>[] = [
    {
      title: 'Sipariş Kodu',
      dataIndex: 'order_code',
      search: false,
      render: (_, row) => <Link to={`/orders/${row.id}`}>{row.order_code}</Link>,
    },
    {
      title: 'Tarih',
      dataIndex: 'created_at',
      valueType: 'dateRange',
      fieldProps: { placeholder: ['Başlangıç', 'Bitiş'] },
      render: (_, row) => formatDateTime(row.created_at),
    },
    { title: 'Kalem', dataIndex: 'item_count', search: false, render: (_, row) => `${row.item_count} ürün` },
    {
      title: 'Tutar',
      dataIndex: 'total_amount',
      search: false,
      align: 'right',
      render: (_, row) => formatCurrency(row.total_amount),
    },
    {
      title: 'Durum',
      dataIndex: 'status',
      valueType: 'select',
      fieldProps: { placeholder: 'Tümü' },
      valueEnum: Object.fromEntries(Object.entries(orderStatusLabels).map(([key, label]) => [key, { text: label }])),
      render: (_, row) => <OrderStatusTag status={row.status} />,
    },
  ];

  return (
    <PageContainer
      title={
        <Space size={12}>
          {customer.full_name}
          <ActiveTag active={customer.is_active} />
        </Space>
      }
      onBack={() => navigate('/customers')}
      breadcrumb={{ items: [{ title: <Link to="/customers">Müşteriler</Link> }, { title: customer.full_name }] }}
      extra={[
        <Button
          key="order"
          type="primary"
          disabled={!customer.is_active}
          onClick={() => navigate(`/orders/new?customer=${customer.id}`)}
        >
          Bu Müşteri Adına Sipariş Oluştur
        </Button>,
        ...(canInvite
          ? [
              customer.invite_expires_at ? (
                <Popconfirm
                  key="invite"
                  title="Yeni davet kodu oluşturulsun mu?"
                  description="Müşteriye daha önce iletilen kod geçersiz olur."
                  okText="Oluştur"
                  cancelText="Vazgeç"
                  onConfirm={createInvite}
                >
                  <Button loading={creatingInvite}>Yeni Davet Kodu</Button>
                </Popconfirm>
              ) : (
                <Button key="invite" loading={creatingInvite} onClick={createInvite}>
                  Davet Kodu Oluştur
                </Button>
              ),
            ]
          : []),
        ...(editable
          ? [
              <Button key="edit" onClick={() => setEditOpen(true)}>
                Düzenle
              </Button>,
              customer.is_active ? (
                <Popconfirm
                  key="status"
                  title="Müşteri pasife alınsın mı?"
                  description="Pasif müşteri adına sipariş oluşturulamaz."
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
          : []),
      ]}
    >
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card>
          <Descriptions column={{ xs: 1, md: 2, lg: 3 }} size="small">
            <Descriptions.Item label="E-posta">{customer.email}</Descriptions.Item>
            <Descriptions.Item label="Telefon">{customer.phone || '–'}</Descriptions.Item>
            <Descriptions.Item label="Firma">{customer.company_name || '–'}</Descriptions.Item>
            <Descriptions.Item label="Şehir">{customer.city || '–'}</Descriptions.Item>
            <Descriptions.Item label="Kayıt Tarihi">{formatDate(customer.created_at)}</Descriptions.Item>
            <Descriptions.Item label="Giriş Hesabı">
              {customer.has_account
                ? 'Var'
                : customer.invite_expires_at
                  ? `Yok (davet kodu ${formatDateTime(customer.invite_expires_at)} tarihine kadar geçerli)`
                  : 'Yok'}
            </Descriptions.Item>
            <Descriptions.Item label="Adres" span={3}>
              {customer.address || '–'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="Toplam Sipariş" value={customer.stats.order_count} groupSeparator="." />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="Toplam Harcama" value={formatCurrency(customer.stats.total_spent)} />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="Ortalama Sepet" value={formatCurrency(customer.stats.average_basket)} />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="Son Sipariş" value={formatDate(customer.stats.last_order_at)} />
            </Card>
          </Col>
        </Row>

        <ProTable<CustomerOrder, OrderFilters>
          headerTitle="Sipariş Geçmişi"
          rowKey="id"
          columns={columns}
          search={{ labelWidth: 'auto', searchText: 'Filtrele', resetText: 'Temizle' }}
          options={false}
          pagination={tablePagination}
          locale={{ emptyText: 'Bu müşterinin henüz siparişi yok.' }}
          request={async (params) => {
            const [from, to] = params.created_at ?? [];
            const { data } = await api.get<Page<CustomerOrder>>(`/customers/${customer.id}/orders`, {
              params: {
                page: params.current,
                page_size: params.pageSize,
                status: params.status || undefined,
                from: from ? dayjs(from).startOf('day').format() : undefined,
                to: to ? dayjs(to).endOf('day').format() : undefined,
              },
            });
            return { data: data.items, total: data.total, success: true };
          }}
        />
      </Space>

      <Modal
        open={invite !== null}
        title="Davet Kodu"
        destroyOnHidden
        onCancel={() => setInvite(null)}
        footer={
          <Button type="primary" onClick={() => setInvite(null)}>
            Tamam
          </Button>
        }
      >
        {invite ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Paragraph style={{ margin: 0 }}>
              Kodu müşteriye iletin. Müşteri <strong>{customer.email}</strong> adresiyle kayıt olurken &quot;Davet
              kodu&quot; alanına girdiğinde hesabı bu kayda bağlanır ve sipariş geçmişini görür.
            </Typography.Paragraph>
            <Typography.Text copyable={{ text: invite.code }} strong style={{ fontSize: 24, letterSpacing: 2 }}>
              {invite.code}
            </Typography.Text>
            <Typography.Text type="secondary">
              Son geçerlilik: {formatDateTime(invite.expires_at)}. Kod tek kullanımlıktır.
            </Typography.Text>
            <Alert
              type="warning"
              showIcon
              message="Kod yalnızca şimdi gösterilir. Kaybolursa yeni kod oluşturun; eskisi geçersiz olur."
            />
          </Space>
        ) : null}
      </Modal>

      <CustomerFormModal
        open={editOpen}
        customer={customer}
        onOpenChange={setEditOpen}
        onSaved={(data) => queryClient.setQueryData(queryKey, data)}
      />
    </PageContainer>
  );
}
