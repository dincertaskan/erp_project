import { PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormSwitch,
  ProFormText,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { useQueryClient } from '@tanstack/react-query';
import { App, Button, ColorPicker, Form, Popconfirm, Space, Typography } from 'antd';
import type { FormInstance } from 'antd';
import { useRef, useState } from 'react';
import { CATEGORIES_KEY } from '@/api/catalog';
import { api, errorMessage } from '@/api/client';
import type { Category } from '@/api/types';
import { ColorDot } from '@/components/CategoryTag';
import { ActiveTag } from '@/components/StatusTag';
import { applyServerErrors } from '@/utils/forms';
import { formatDate, formatNumber } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';

interface CategoryForm {
  name: string;
  color: string;
  is_active: boolean;
}

const DEFAULT_COLOR = '#4F46E5';

/** E-14 Kategoriler (yalnızca yönetici). Kategoriler silinmez, pasife alınır. */
export function CategoriesPage() {
  usePageTitle('Kategoriler');
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<FormInstance<CategoryForm>>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = () => {
    actionRef.current?.reload();
    void queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
  };

  const openModal = (category: Category | null) => {
    setEditing(category);
    setModalOpen(true);
  };

  const setStatus = async (category: Category, isActive: boolean) => {
    try {
      await api.patch(`/categories/${category.id}/status`, { is_active: isActive });
      message.success(isActive ? 'Kategori aktifleştirildi.' : 'Kategori pasife alındı.');
      refresh();
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const onFinish = async (values: CategoryForm) => {
    try {
      if (editing) await api.put(`/categories/${editing.id}`, values);
      else await api.post('/categories', values);
      message.success('Kategori kaydedildi.');
      refresh();
      return true;
    } catch (err) {
      const general = formRef.current ? applyServerErrors(formRef.current, err) : errorMessage(err);
      if (general) message.error(general);
      return false;
    }
  };

  const columns: ProColumns<Category>[] = [
    {
      title: 'Renk',
      dataIndex: 'color',
      width: 72,
      search: false,
      render: (_, row) => <ColorDot color={row.color} size={16} />,
    },
    { title: 'Kategori Adı', dataIndex: 'name' },
    {
      title: 'Ürün Sayısı',
      dataIndex: 'product_count',
      align: 'right',
      tooltip: 'Aktif ürünler',
      render: (_, row) => <span className="tabular-nums">{formatNumber(row.product_count)}</span>,
    },
    { title: 'Durum', dataIndex: 'is_active', render: (_, row) => <ActiveTag active={row.is_active} /> },
    { title: 'Oluşturma Tarihi', dataIndex: 'created_at', render: (_, row) => formatDate(row.created_at) },
    {
      title: 'İşlemler',
      valueType: 'option',
      width: 180,
      render: (_, row) => [
        <a key="edit" onClick={() => openModal(row)}>
          Düzenle
        </a>,
        row.is_active ? (
          <Popconfirm
            key="status"
            title="Kategori pasife alınsın mı?"
            description={
              row.product_count > 0
                ? `Bu kategoride ${row.product_count} aktif ürün var. Ürünleri müşteri kataloğunda görünmez olur.`
                : 'Pasif kategoriye yeni ürün eklenemez.'
            }
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
        ),
      ],
    },
  ];

  return (
    <PageContainer title="Kategoriler">
      <ProTable<Category, { keyword?: string }>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        pagination={false}
        options={{ search: { placeholder: 'Kategori ara', allowClear: true }, density: false, setting: false }}
        request={async (params) => {
          const { data } = await api.get<Category[]>('/categories', {
            params: { search: params.keyword || undefined },
          });
          return { data, success: true, total: data.length };
        }}
        locale={{ emptyText: 'Henüz kategori yok.' }}
        toolBarRender={() => [
          <Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
            Yeni Kategori
          </Button>,
        ]}
      />

      <ModalForm<CategoryForm>
        title={editing ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}
        open={modalOpen}
        formRef={formRef}
        width={480}
        modalProps={{ destroyOnHidden: true, onCancel: () => setModalOpen(false) }}
        submitter={{ searchConfig: { submitText: 'Kaydet', resetText: 'İptal' } }}
        initialValues={editing ?? { name: '', color: DEFAULT_COLOR, is_active: true }}
        onOpenChange={setModalOpen}
        onFinish={onFinish}
      >
        <ProFormText
          name="name"
          label="Kategori Adı"
          placeholder="Örn: Elektronik"
          rules={[
            { required: true, whitespace: true, message: 'Kategori adı zorunludur.' },
            { min: 2, message: 'Kategori adı en az 2 karakter olmalıdır.' },
            { max: 100, message: 'Kategori adı en fazla 100 karakter olabilir.' },
          ]}
        />
        <Form.Item
          name="color"
          label="Renk"
          getValueFromEvent={(color: { toHexString: () => string }) => color.toHexString().toUpperCase()}
          rules={[{ required: true, message: 'Renk zorunludur.' }]}
        >
          <ColorPicker
            disabledAlpha
            showText
            presets={[
              {
                label: 'Önerilen',
                colors: ['#4F46E5', '#2563EB', '#0E7490', '#10B981', '#D97706', '#EC4899', '#7C3AED', '#4B5563'],
              },
            ]}
          />
        </Form.Item>
        <ProFormSwitch name="is_active" label="Aktif" />
        {editing && editing.product_count > 0 ? (
          <Space>
            <Typography.Text type="secondary">Bu kategoride {editing.product_count} aktif ürün var.</Typography.Text>
          </Space>
        ) : null}
      </ModalForm>
    </PageContainer>
  );
}
