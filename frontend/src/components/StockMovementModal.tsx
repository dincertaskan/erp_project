import { useQueryClient } from '@tanstack/react-query';
import { Alert, App, Form, Input, InputNumber, Modal, Segmented, Space, Typography } from 'antd';
import { useState } from 'react';
import { ApiError, api, errorMessage } from '@/api/client';
import { availableFromDetails, invalidateStock } from '@/api/stock';
import type { Product, StockMovementResult } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { ProductThumb } from '@/components/ProductThumb';
import { formatNumber } from '@/utils/format';
import { getStockStatus } from '@/utils/labels';

export type ManualMovementType = 'in' | 'out';

/** Arka uçtaki tek işlem üst sınırı */
export const MAX_MOVEMENT_QUANTITY = 1_000_000;

export type MovementProduct = Pick<Product, 'id' | 'name' | 'sku' | 'stock' | 'min_stock' | 'image_url'>;

interface StockMovementModalProps {
  product: MovementProduct | null;
  initialType?: ManualMovementType;
  onClose: () => void;
  onSaved?: (result: StockMovementResult) => void;
}

interface MovementForm {
  movement_type: ManualMovementType;
  quantity?: number;
  description?: string;
}

/** E-16 Stok Girişi/Çıkışı. İşlemi yapan kişi oturumdan alınır; yetersiz stokta sunucu 409 döner. */
export function StockMovementModal({ product, initialType = 'in', ...rest }: StockMovementModalProps) {
  if (!product) return null;
  // Her açılışta form ve önizleme sıfırdan kurulur.
  return <MovementDialog key={`${product.id}-${initialType}`} product={product} initialType={initialType} {...rest} />;
}

function MovementDialog({
  product,
  initialType,
  onClose,
  onSaved,
}: Omit<StockMovementModalProps, 'product' | 'initialType'> & {
  product: MovementProduct;
  initialType: ManualMovementType;
}) {
  const { user } = useAuth();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<MovementForm>();
  const [saving, setSaving] = useState(false);
  // Sunucu farklı bir güncel stok bildirirse (başka bir işlem araya girdiyse) önizleme onunla hesaplanır.
  const [currentStock, setCurrentStock] = useState(product.stock);
  const type = Form.useWatch('movement_type', form) ?? initialType;
  const quantity = Form.useWatch('quantity', form) ?? 0;

  const newStock = type === 'in' ? currentStock + quantity : currentStock - quantity;
  // Kritik: 0 < stok < minimum; stok 0'a inerse ürün kritik değil, tükenmiş sayılır.
  const statusAfter =
    type === 'out' && quantity > 0 && newStock >= 0 ? getStockStatus(newStock, product.min_stock) : null;
  const warning =
    statusAfter === 'out_of_stock'
      ? 'İşlem sonrası ürün tükenecek.'
      : statusAfter === 'critical'
        ? 'İşlem sonrası ürün kritik stoka düşecek.'
        : null;

  const onFinish = async (values: MovementForm) => {
    setSaving(true);
    try {
      const { data } = await api.post<StockMovementResult>('/stock/movements', {
        product_id: product.id,
        movement_type: values.movement_type,
        quantity: values.quantity,
        description: values.description?.trim() || null,
      });
      message.success(`Stok güncellendi: ${formatNumber(data.product.stock)} adet`);
      invalidateStock(queryClient);
      onSaved?.(data);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INSUFFICIENT_STOCK') {
        const available = availableFromDetails(err.details);
        if (available !== undefined) setCurrentStock(available);
        form.setFields([{ name: 'quantity', errors: [err.message] }]);
      } else {
        message.error(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Stok İşlemi"
      width={480}
      okText="Kaydet"
      cancelText="Vazgeç"
      confirmLoading={saving}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Space align="start" size={12} style={{ marginBottom: 16 }}>
        <ProductThumb product={product} size={48} />
        <div>
          <Typography.Text strong>{product.name}</Typography.Text>
          <br />
          <Typography.Text type="secondary">
            {product.sku} · Mevcut stok: {formatNumber(currentStock)}
          </Typography.Text>
        </div>
      </Space>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onFinish}
        initialValues={{ movement_type: initialType }}
      >
        <Form.Item name="movement_type" label="İşlem Türü">
          <Segmented
            block
            options={[
              { label: 'Giriş', value: 'in' },
              { label: 'Çıkış', value: 'out' },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="quantity"
          label="Miktar"
          dependencies={['movement_type']}
          rules={[
            { required: true, message: 'Miktar zorunludur.' },
            { type: 'number', min: 1, message: 'Miktar 0’dan büyük olmalıdır.' },
            {
              type: 'number',
              max: MAX_MOVEMENT_QUANTITY,
              message: `Miktar en fazla ${formatNumber(MAX_MOVEMENT_QUANTITY)} olabilir.`,
            },
            {
              validator: (_, value?: number) =>
                type === 'out' && value && value > currentStock
                  ? Promise.reject(new Error(`Yetersiz stok. Mevcut: ${currentStock}.`))
                  : Promise.resolve(),
            },
          ]}
        >
          <InputNumber min={1} precision={0} style={{ width: '100%' }} autoFocus placeholder="0" />
        </Form.Item>
        <Form.Item
          name="description"
          dependencies={['movement_type']}
          label={type === 'out' ? 'Açıklama' : 'Açıklama (isteğe bağlı)'}
          rules={[
            { max: 500, message: 'Açıklama en fazla 500 karakter olabilir.' },
            {
              validator: (_, value?: string) =>
                type === 'out' && (value?.trim().length ?? 0) < 3
                  ? Promise.reject(new Error('Çıkış işlemlerinde açıklama zorunludur.'))
                  : Promise.resolve(),
            },
          ]}
        >
          <Input.TextArea
            rows={2}
            placeholder={type === 'out' ? 'Örn: Sayım farkı, fire' : 'Örn: Tedarikçi teslimatı – irsaliye 1024'}
          />
        </Form.Item>
      </Form>

      {quantity > 0 && newStock >= 0 ? (
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          Stok <strong>{formatNumber(currentStock)}</strong> → <strong>{formatNumber(newStock)}</strong> olacak.
        </Typography.Paragraph>
      ) : null}
      {warning ? <Alert type="warning" showIcon message={warning} style={{ marginBottom: 8 }} /> : null}
      <Typography.Text type="secondary">İşlemi yapan: {user?.full_name}</Typography.Text>
    </Modal>
  );
}
