import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components';
import { Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import type { AuditLog } from '@/api/audit';
import type { Page, User } from '@/api/types';
import { formatCurrency, formatDateTime } from '@/utils/format';
import {
  auditEventLabels,
  orderStatusLabels,
  roleLabels,
  type AuditEvent,
  type OrderStatus,
  type UserRole,
} from '@/utils/labels';
import { tablePagination } from '@/utils/table';
import { usePageTitle } from '@/hooks/usePageTitle';

interface AuditFilters {
  created_at?: [string, string];
  event_type?: AuditEvent[];
  actor_id?: number;
  current?: number;
  pageSize?: number;
}

const lastSevenDays = (): [dayjs.Dayjs, dayjs.Dayjs] => [dayjs().subtract(6, 'day'), dayjs()];

const fieldLabels: Record<string, string> = {
  role: 'Rol',
  is_active: 'Durum',
  sale_price: 'Satış fiyatı',
  cost_price: 'Maliyet',
  status: 'Durum',
  reason: 'Neden',
};

const failureReasons: Record<string, string> = {
  wrong_password: 'Yanlış şifre',
  unknown_email: 'Kayıtlı olmayan e-posta',
};

const entityLinks: Partial<Record<AuditLog['entity_type'], string>> = {
  customer: '/customers',
  product: '/products',
  order: '/orders',
};

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '–';
  switch (key) {
    case 'role':
      return roleLabels[value as UserRole] ?? String(value);
    case 'is_active':
      return value ? 'Aktif' : 'Pasif';
    case 'sale_price':
    case 'cost_price':
      return formatCurrency(value as string);
    case 'status':
      return orderStatusLabels[value as OrderStatus] ?? String(value);
    case 'reason':
      return failureReasons[String(value)] ?? String(value);
    default:
      return String(value);
  }
}

/** Eski ve yeni değerleri alan alan gösterir: "Rol: Müşteri → Depo Personeli" */
function Change({ row }: { row: AuditLog }) {
  const keys = [...new Set([...Object.keys(row.old_value ?? {}), ...Object.keys(row.new_value ?? {})])];
  if (keys.length === 0) return <>–</>;
  return (
    <Space direction="vertical" size={0}>
      {keys.map((key) => {
        const label = fieldLabels[key] ?? key;
        const after = formatValue(key, row.new_value?.[key]);
        if (!row.old_value || !(key in row.old_value)) return <span key={key}>{`${label}: ${after}`}</span>;
        return <span key={key}>{`${label}: ${formatValue(key, row.old_value[key])} → ${after}`}</span>;
      })}
    </Space>
  );
}

function Entity({ row }: { row: AuditLog }) {
  const label = row.entity_label ?? '–';
  const base = entityLinks[row.entity_type];
  return base && row.entity_id !== null ? <Link to={`${base}/${row.entity_id}`}>{label}</Link> : <>{label}</>;
}

async function searchUsers(keyWords?: string) {
  const { data } = await api.get<Page<User>>('/users', { params: { search: keyWords || undefined, page_size: 20 } });
  return data.items.map((u) => ({ label: `${u.full_name} (${u.email})`, value: u.id }));
}

/** İşlem Geçmişi (denetim günlüğü, OWASP A09): yalnızca yönetici görür. */
export function AuditLogsPage() {
  usePageTitle('İşlem Geçmişi');

  const columns: ProColumns<AuditLog>[] = [
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
      title: 'Olay',
      dataIndex: 'event_type',
      valueType: 'select',
      width: 160,
      fieldProps: { mode: 'multiple', placeholder: 'Tümü', maxTagCount: 'responsive' },
      valueEnum: Object.fromEntries(Object.entries(auditEventLabels).map(([key, label]) => [key, { text: label }])),
      render: (_, row) => (
        <Tag color={row.event_type === 'login_failed' ? 'red' : 'blue'}>{auditEventLabels[row.event_type]}</Tag>
      ),
    },
    {
      title: 'Kullanıcı',
      dataIndex: 'actor_id',
      valueType: 'select',
      width: 200,
      fieldProps: { showSearch: true, placeholder: 'Kullanıcı ara' },
      request: async ({ keyWords }) => searchUsers(keyWords as string | undefined),
      debounceTime: 300,
      render: (_, row) =>
        row.actor ? (
          <Space direction="vertical" size={0}>
            <span>{row.actor.full_name}</span>
            <Typography.Text type="secondary">{row.actor.email}</Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="secondary">Bilinmiyor</Typography.Text>
        ),
    },
    { title: 'Kayıt', dataIndex: 'entity_label', search: false, width: 200, render: (_, row) => <Entity row={row} /> },
    { title: 'Değişiklik', key: 'change', search: false, width: 260, render: (_, row) => <Change row={row} /> },
    { title: 'IP', dataIndex: 'ip_address', search: false, width: 130, render: (_, row) => row.ip_address ?? '–' },
  ];

  return (
    <PageContainer
      title="İşlem Geçmişi"
      content="Rol atama, kullanıcı ve müşteri durum değişikliği, fiyat değişikliği, sipariş iptali ve başarısız girişler."
    >
      <ProTable<AuditLog, AuditFilters>
        rowKey="id"
        columns={columns}
        scroll={{ x: 1100 }}
        search={{ labelWidth: 'auto', searchText: 'Filtrele', resetText: 'Filtreleri Temizle' }}
        options={{ reload: true, density: false, setting: false }}
        pagination={tablePagination}
        locale={{ emptyText: 'Seçilen aralıkta kayıt yok.' }}
        request={async (params) => {
          const [from, to] = params.created_at ?? [];
          const { data } = await api.get<Page<AuditLog>>('/audit-logs', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              from: from ? dayjs(from).startOf('day').format() : undefined,
              to: to ? dayjs(to).endOf('day').format() : undefined,
              actor_id: params.actor_id,
              event_type: params.event_type?.length ? params.event_type : undefined,
            },
            paramsSerializer: { indexes: null },
          });
          return { data: data.items, total: data.total, success: true };
        }}
      />
    </PageContainer>
  );
}
