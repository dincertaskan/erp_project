import {
  ModalForm,
  PageContainer,
  ProFormRadio,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { Alert, App, Popconfirm, Tooltip } from 'antd';
import { useRef, useState } from 'react';
import { api, errorMessage } from '@/api/client';
import type { Page, User } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { ActiveTag, RoleTag } from '@/components/StatusTag';
import { formatDate, formatDateTime } from '@/utils/format';
import { roleLabels, type UserRole } from '@/utils/labels';
import { tablePagination } from '@/utils/table';
import { usePageTitle } from '@/hooks/usePageTitle';

interface UserFilters {
  keyword?: string;
  role?: UserRole;
  is_active?: 'true' | 'false';
  current?: number;
  pageSize?: number;
}

const SELF_HINT = 'Kendi hesabınızda bu işlem yapılamaz.';

/** E-26 Kullanıcılar (yalnızca yönetici). Personel hesapları kayıt + rol atama ile oluşur (karar 10). */
export function UsersPage() {
  usePageTitle('Kullanıcılar');
  const { user: me } = useAuth();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [roleTarget, setRoleTarget] = useState<User | null>(null);

  const setStatus = async (user: User, isActive: boolean) => {
    try {
      await api.patch(`/users/${user.id}/status`, { is_active: isActive });
      message.success(isActive ? 'Hesap aktifleştirildi.' : 'Hesap pasife alındı; kullanıcı giriş yapamaz.');
      actionRef.current?.reload();
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const columns: ProColumns<User>[] = [
    { title: 'Arama', dataIndex: 'keyword', hideInTable: true, fieldProps: { placeholder: 'Ad veya e-posta' } },
    { title: 'Ad Soyad', dataIndex: 'full_name', search: false, width: 200 },
    { title: 'E-posta', dataIndex: 'email', search: false, width: 240, ellipsis: true },
    {
      title: 'Rol',
      dataIndex: 'role',
      valueType: 'select',
      width: 140,
      fieldProps: { placeholder: 'Tümü' },
      valueEnum: Object.fromEntries(Object.entries(roleLabels).map(([key, label]) => [key, { text: label }])),
      render: (_, row) => <RoleTag role={row.role} />,
    },
    {
      title: 'Durum',
      dataIndex: 'is_active',
      valueType: 'select',
      width: 100,
      fieldProps: { placeholder: 'Tümü' },
      valueEnum: { true: { text: 'Aktif' }, false: { text: 'Pasif' } },
      render: (_, row) => <ActiveTag active={row.is_active} />,
    },
    {
      title: 'Kayıt Tarihi',
      dataIndex: 'created_at',
      search: false,
      width: 120,
      render: (_, row) => formatDate(row.created_at),
    },
    {
      title: 'Son Giriş',
      dataIndex: 'last_login_at',
      search: false,
      width: 150,
      render: (_, row) => formatDateTime(row.last_login_at),
    },
    {
      title: 'İşlemler',
      valueType: 'option',
      fixed: 'right',
      width: 170,
      render: (_, row) => {
        const self = row.id === me?.id;
        const roleLink = self ? (
          <Tooltip key="role" title={SELF_HINT}>
            <span style={{ color: '#9CA3AF', cursor: 'not-allowed' }}>Rol Ata</span>
          </Tooltip>
        ) : (
          <a key="role" onClick={() => setRoleTarget(row)}>
            Rol Ata
          </a>
        );
        const statusLink = self ? (
          <Tooltip key="status" title={SELF_HINT}>
            <span style={{ color: '#9CA3AF', cursor: 'not-allowed' }}>Pasife Al</span>
          </Tooltip>
        ) : row.is_active ? (
          <Popconfirm
            key="status"
            title="Hesap pasife alınsın mı?"
            description="Kullanıcı giriş yapamaz."
            okText="Pasife Al"
            cancelText="Vazgeç"
            okButtonProps={{ danger: true }}
            onConfirm={() => setStatus(row, false)}
          >
            <a style={{ color: '#DC2626' }}>Pasife Al</a>
          </Popconfirm>
        ) : (
          <a key="status" onClick={() => setStatus(row, true)}>
            Aktifleştir
          </a>
        );
        return [roleLink, statusLink];
      },
    },
  ];

  return (
    <PageContainer title="Kullanıcılar">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Yeni personel önce kayıt formundan hesap açar; ardından buradan Yönetici ya da Depo Personeli rolü atanır."
      />
      <ProTable<User, UserFilters>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        scroll={{ x: 1100 }}
        search={{ labelWidth: 'auto', searchText: 'Ara', resetText: 'Temizle' }}
        options={{ reload: true, density: false, setting: false }}
        pagination={tablePagination}
        locale={{ emptyText: 'Kullanıcı bulunamadı.' }}
        request={async (params) => {
          const { data } = await api.get<Page<User>>('/users', {
            params: {
              page: params.current,
              page_size: params.pageSize,
              search: params.keyword || undefined,
              role: params.role,
              is_active: params.is_active,
            },
          });
          return { data: data.items, total: data.total, success: true };
        }}
      />

      <ModalForm<{ role: UserRole }>
        title={roleTarget ? `Rol Ata · ${roleTarget.full_name}` : 'Rol Ata'}
        open={roleTarget !== null}
        width={440}
        modalProps={{ destroyOnHidden: true, onCancel: () => setRoleTarget(null) }}
        submitter={{ searchConfig: { submitText: 'Kaydet', resetText: 'İptal' } }}
        initialValues={{ role: roleTarget?.role }}
        onFinish={async ({ role }) => {
          if (!roleTarget) return false;
          try {
            await api.patch(`/users/${roleTarget.id}/role`, { role });
            message.success('Rol güncellendi.');
            setRoleTarget(null);
            actionRef.current?.reload();
            return true;
          } catch (err) {
            message.error(errorMessage(err));
            return false;
          }
        }}
      >
        <ProFormRadio.Group
          name="role"
          label="Rol"
          rules={[{ required: true, message: 'Rol seçin.' }]}
          fieldProps={{ style: { display: 'flex', flexDirection: 'column', gap: 8 } }}
          options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))}
        />
        <Alert type="info" showIcon message="Müşteri rolüne alınan kullanıcı için müşteri kaydı oluşturulur." />
      </ModalForm>
    </PageContainer>
  );
}
