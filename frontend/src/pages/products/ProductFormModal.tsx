import {
  ModalForm,
  ProFormDependency,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, App, Col, Row } from 'antd';
import type { FormInstance } from 'antd';
import { useRef } from 'react';
import { toMoney, useCategories } from '@/api/catalog';
import { api, errorMessage } from '@/api/client';
import { invalidateStock } from '@/api/stock';
import type { Product } from '@/api/types';
import { applyServerErrors } from '@/utils/forms';

interface ProductForm {
  name: string;
  sku?: string;
  category_id?: number;
  sale_price?: number;
  cost_price?: number;
  initial_stock?: number;
  min_stock?: number;
  description?: string;
  image_url?: string;
  is_active: boolean;
}

interface ProductFormModalProps {
  open: boolean;
  /** Düzenlenecek ürün; yoksa yeni ürün eklenir */
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (product: Product) => void;
}

const moneyField = {
  min: 0,
  placeholder: '0,00',
  fieldProps: { precision: 2, decimalSeparator: ',', addonAfter: '₺', style: { width: '100%' } },
};

/** E-12 Ürün Ekle/Düzenle. Stok miktarı yalnızca eklemede girilir; sonrası stok işlemleriyle değişir. */
export function ProductFormModal({ open, product, onOpenChange, onSaved }: ProductFormModalProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const formRef = useRef<FormInstance<ProductForm>>(null);
  const skuTouched = useRef(false);
  const { data: categories = [] } = useCategories();
  const isEdit = product !== null;

  // Yeni atamada yalnızca aktif kategoriler; düzenlenen ürünün mevcut (pasif olabilen) kategorisi de listede kalır.
  const categoryOptions = categories
    .filter((c) => c.is_active || c.id === product?.category.id)
    .map((c) => ({ label: c.is_active ? c.name : `${c.name} (pasif)`, value: c.id }));

  const suggestSku = async (categoryId: number) => {
    if (isEdit || skuTouched.current) return;
    try {
      const { data } = await api.get<{ sku: string }>('/products/next-sku', { params: { category_id: categoryId } });
      if (!skuTouched.current) formRef.current?.setFieldValue('sku', data.sku);
    } catch {
      // Öneri alınamazsa SKU boş kalır; sunucu kaydederken yine üretir.
    }
  };

  const onFinish = async (values: ProductForm) => {
    const payload = {
      name: values.name,
      sku: values.sku || (isEdit ? product.sku : null),
      category_id: values.category_id,
      sale_price: toMoney(values.sale_price),
      cost_price: toMoney(values.cost_price),
      min_stock: values.min_stock ?? 0,
      description: values.description || null,
      image_url: values.image_url || null,
      is_active: values.is_active,
      ...(isEdit ? {} : { initial_stock: values.initial_stock ?? 0 }),
    };
    try {
      const { data } = isEdit
        ? await api.put<Product>(`/products/${product.id}`, payload)
        : await api.post<Product>('/products', payload);
      message.success('Ürün kaydedildi.');
      // Minimum stok, aktiflik ve başlangıç stoku kritik stok sayısını değiştirebilir.
      invalidateStock(queryClient);
      onSaved(data);
      return true;
    } catch (err) {
      const general = formRef.current ? applyServerErrors(formRef.current, err) : errorMessage(err);
      if (general) message.error(general);
      return false;
    }
  };

  const initialValues: ProductForm = product
    ? {
        name: product.name,
        sku: product.sku,
        category_id: product.category.id,
        sale_price: Number(product.sale_price),
        cost_price: Number(product.cost_price ?? 0),
        min_stock: product.min_stock,
        description: product.description ?? '',
        image_url: product.image_url ?? '',
        is_active: product.is_active,
      }
    : { name: '', is_active: true, initial_stock: 0, min_stock: 0 };

  return (
    <ModalForm<ProductForm>
      title={isEdit ? 'Ürünü Düzenle' : 'Yeni Ürün'}
      open={open}
      width={720}
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{
        destroyOnHidden: true,
        afterOpenChange: (visible) => {
          if (visible) skuTouched.current = false;
        },
      }}
      submitter={{ searchConfig: { submitText: 'Kaydet', resetText: 'İptal' } }}
      onOpenChange={onOpenChange}
      onFinish={onFinish}
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <ProFormText
            name="name"
            label="Ürün Adı"
            placeholder="Örn: Kablosuz Mouse"
            rules={[
              { required: true, whitespace: true, message: 'Ürün adı zorunludur.' },
              { min: 2, message: 'Ürün adı en az 2 karakter olmalıdır.' },
              { max: 200, message: 'Ürün adı en fazla 200 karakter olabilir.' },
            ]}
          />
        </Col>
        <Col xs={24} md={12}>
          <ProFormSelect
            name="category_id"
            label="Kategori"
            placeholder="Kategori seçin"
            options={categoryOptions}
            showSearch
            rules={[{ required: true, message: 'Kategori seçin.' }]}
            fieldProps={{ onChange: (value: number) => void suggestSku(value) }}
          />
        </Col>
        <Col xs={24} md={12}>
          <ProFormText
            name="sku"
            label="SKU (Ürün Kodu)"
            placeholder={isEdit ? undefined : 'Kategori seçilince önerilir'}
            extra={isEdit ? undefined : 'Boş bırakılırsa otomatik üretilir.'}
            normalize={(value: string) => value.toUpperCase()}
            fieldProps={{ onChange: () => (skuTouched.current = true) }}
            rules={[
              ...(isEdit ? [{ required: true, message: 'SKU zorunludur.' }] : []),
              {
                pattern: /^[A-Z0-9][A-Z0-9-]{1,63}$/,
                message: 'SKU yalnızca büyük harf, rakam ve tire içerebilir.',
              },
            ]}
          />
        </Col>
        <Col xs={24} md={12}>
          <ProFormSwitch name="is_active" label="Aktif" />
        </Col>
        <Col xs={24} md={12}>
          <ProFormDigit
            name="sale_price"
            label="Satış Fiyatı"
            {...moneyField}
            rules={[{ required: true, message: 'Satış fiyatı zorunludur.' }]}
          />
        </Col>
        <Col xs={24} md={12}>
          <ProFormDigit
            name="cost_price"
            label="Maliyet"
            {...moneyField}
            rules={[{ required: true, message: 'Maliyet zorunludur.' }]}
          />
        </Col>
        <ProFormDependency name={['sale_price', 'cost_price']}>
          {({ sale_price, cost_price }: Partial<ProductForm>) =>
            sale_price !== undefined && cost_price !== undefined && sale_price < cost_price ? (
              <Col span={24}>
                <Alert
                  type="warning"
                  showIcon
                  message="Satış fiyatı maliyetin altında (zararına satış)."
                  style={{ marginBottom: 16 }}
                />
              </Col>
            ) : null
          }
        </ProFormDependency>
        {isEdit ? null : (
          <Col xs={24} md={12}>
            <ProFormDigit
              name="initial_stock"
              label="Başlangıç Stoku"
              min={0}
              placeholder="0"
              fieldProps={{ precision: 0, style: { width: '100%' } }}
              extra="Stok girişi olarak kaydedilir."
            />
          </Col>
        )}
        <Col xs={24} md={12}>
          <ProFormDigit
            name="min_stock"
            label="Minimum Stok"
            min={0}
            placeholder="0"
            fieldProps={{ precision: 0, style: { width: '100%' } }}
            rules={[{ required: true, message: 'Minimum stok zorunludur.' }]}
          />
        </Col>
        <Col span={24}>
          <ProFormText
            name="image_url"
            label="Görsel Adresi"
            placeholder="https://..."
            rules={[
              { type: 'url', message: 'Geçerli bir adres girin.' },
              { max: 500, message: 'Adres en fazla 500 karakter olabilir.' },
            ]}
          />
        </Col>
        <Col span={24}>
          <ProFormTextArea
            name="description"
            label="Açıklama"
            placeholder=""
            fieldProps={{ rows: 3, maxLength: 2000, showCount: true }}
          />
        </Col>
      </Row>
    </ModalForm>
  );
}
