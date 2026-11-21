import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import type { CustomerListItem, OrderDetail } from '@/api/orders';
import type { Page, Product } from '@/api/types';
import { applyServerErrors } from '@/utils/forms';
import { formatCurrency, formatNumber } from '@/utils/format';
import { paymentMethodLabels, type PaymentMethod } from '@/utils/labels';

interface Line {
  product: Product;
  quantity: number;
}

interface OrderForm {
  customer_id?: number;
  payment_method?: PaymentMethod;
  shipping_address?: string;
  note?: string;
}

function useRemoteOptions<T>(load: (search: string) => Promise<T[]>) {
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const search = async (value: string) => {
    setLoading(true);
    try {
      setOptions(await load(value));
    } finally {
      setLoading(false);
    }
  };
  return { options, loading, search };
}

const loadCustomers = async (search: string) =>
  (
    await api.get<Page<CustomerListItem>>('/customers', {
      params: { search: search || undefined, is_active: true, page_size: 20 },
    })
  ).data.items;

const loadProducts = async (search: string) =>
  (
    await api.get<Page<Product>>('/products', {
      params: { search: search || undefined, is_active: true, page_size: 20 },
    })
  ).data.items;

/** E-21 Yeni Sipariş: telefonla ya da e-postayla gelen siparişi müşteri adına girmek. Stok onayda kontrol edilir. */
export function NewOrderPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm<OrderForm>();
  const [lines, setLines] = useState<Line[]>([]);
  const [pickedProductId, setPickedProductId] = useState<number>();
  const [pickedQuantity, setPickedQuantity] = useState<number>(1);
  const [linesError, setLinesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const customers = useRemoteOptions(loadCustomers);
  const products = useRemoteOptions(loadProducts);

  const total = lines.reduce((sum, line) => sum + Number(line.product.sale_price) * line.quantity, 0);

  const onCustomerChange = (customerId: number) => {
    const customer = customers.options.find((c) => c.id === customerId);
    const address = [customer?.address, customer?.city].filter(Boolean).join(', ');
    // Kayıtlı adres varsayılan olarak gelir; değiştirilebilir.
    form.setFieldValue('shipping_address', address);
  };

  const addLine = () => {
    const product = products.options.find((p) => p.id === pickedProductId);
    if (!product || pickedQuantity < 1) return;
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + pickedQuantity } : line,
        );
      }
      return [...current, { product, quantity: pickedQuantity }];
    });
    setPickedProductId(undefined);
    setPickedQuantity(1);
    setLinesError(null);
  };

  const updateQuantity = (productId: number, quantity: number | null) =>
    setLines((current) =>
      current.map((line) => (line.product.id === productId ? { ...line, quantity: Math.max(1, quantity ?? 1) } : line)),
    );

  const onFinish = async (values: OrderForm) => {
    if (lines.length === 0) {
      setLinesError('Siparişe en az bir ürün ekleyin.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post<OrderDetail>('/orders', {
        customer_id: values.customer_id,
        payment_method: values.payment_method,
        shipping_address: values.shipping_address?.trim() || null,
        note: values.note?.trim() || null,
        items: lines.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
      });
      message.success(`Sipariş ${data.order_code} oluşturuldu.`);
      navigate(`/orders/${data.id}`);
    } catch (err) {
      const general = applyServerErrors(form, err);
      if (general) message.error(general);
      setSubmitting(false);
    }
  };

  return (
    <PageContainer title="Yeni Sipariş" onBack={() => navigate('/orders')}>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish}>
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Card title="Müşteri">
                <Form.Item
                  name="customer_id"
                  label="Müşteri"
                  rules={[{ required: true, message: 'Müşteri seçin.' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    showSearch
                    placeholder="Ad, e-posta veya firma ile arayın"
                    filterOption={false}
                    loading={customers.loading}
                    onSearch={(value) => void customers.search(value)}
                    onFocus={() => customers.options.length === 0 && void customers.search('')}
                    onChange={onCustomerChange}
                    notFoundContent="Müşteri bulunamadı"
                    options={customers.options.map((c) => ({
                      value: c.id,
                      label: `${c.full_name} · ${c.email}${c.company_name ? ` · ${c.company_name}` : ''}`,
                    }))}
                  />
                </Form.Item>
              </Card>

              <Card title="Ürünler">
                <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
                  <Select
                    showSearch
                    style={{ flex: 1 }}
                    placeholder="SKU veya ürün adı ile arayın"
                    filterOption={false}
                    value={pickedProductId}
                    loading={products.loading}
                    onSearch={(value) => void products.search(value)}
                    onFocus={() => products.options.length === 0 && void products.search('')}
                    onChange={setPickedProductId}
                    notFoundContent="Ürün bulunamadı"
                    options={products.options.map((p) => ({
                      value: p.id,
                      label: `${p.sku} · ${p.name} · Stok: ${formatNumber(p.stock)}`,
                    }))}
                  />
                  <InputNumber
                    min={1}
                    precision={0}
                    value={pickedQuantity}
                    onChange={(value) => setPickedQuantity(value ?? 1)}
                    style={{ width: 100 }}
                    aria-label="Adet"
                  />
                  <Button icon={<PlusOutlined />} onClick={addLine} disabled={!pickedProductId}>
                    Ekle
                  </Button>
                </Space.Compact>
                {linesError ? <Alert type="error" showIcon message={linesError} style={{ marginBottom: 16 }} /> : null}
                <Table<Line>
                  rowKey={(line) => line.product.id}
                  size="small"
                  pagination={false}
                  dataSource={lines}
                  locale={{ emptyText: 'Henüz ürün eklenmedi.' }}
                  scroll={{ x: 640 }}
                  columns={[
                    {
                      title: 'Ürün',
                      key: 'product',
                      render: (_, line) => (
                        <>
                          <Typography.Text type="secondary">{line.product.sku}</Typography.Text> {line.product.name}
                        </>
                      ),
                    },
                    {
                      title: 'Mevcut Stok',
                      key: 'stock',
                      align: 'right',
                      render: (_, line) => formatNumber(line.product.stock),
                    },
                    {
                      title: 'Birim Fiyat',
                      key: 'price',
                      align: 'right',
                      render: (_, line) => formatCurrency(line.product.sale_price),
                    },
                    {
                      title: 'Adet',
                      key: 'quantity',
                      width: 140,
                      render: (_, line) => (
                        <Space direction="vertical" size={0}>
                          <InputNumber
                            min={1}
                            precision={0}
                            value={line.quantity}
                            onChange={(value) => updateQuantity(line.product.id, value)}
                            aria-label={`${line.product.name} adedi`}
                          />
                          {line.quantity > line.product.stock ? (
                            <Typography.Text type="warning" style={{ fontSize: 12 }}>
                              Stokta {formatNumber(line.product.stock)} var
                            </Typography.Text>
                          ) : null}
                        </Space>
                      ),
                    },
                    {
                      title: 'Satır Toplamı',
                      key: 'line_total',
                      align: 'right',
                      render: (_, line) => formatCurrency(Number(line.product.sale_price) * line.quantity),
                    },
                    {
                      key: 'remove',
                      width: 48,
                      render: (_, line) => (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label={`${line.product.name} kaldır`}
                          onClick={() => setLines((current) => current.filter((l) => l.product.id !== line.product.id))}
                        />
                      ),
                    },
                  ]}
                />
              </Card>

              <Card title="Teslimat ve Ödeme">
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="payment_method"
                      label="Ödeme Yöntemi"
                      rules={[{ required: true, message: 'Ödeme yöntemi seçin.' }]}
                    >
                      <Select
                        placeholder="Seçin"
                        options={Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item
                      name="shipping_address"
                      label="Teslimat Adresi"
                      extra="Müşterinin kayıtlı adresi gelir; değiştirilebilir."
                      rules={[{ max: 1000, message: 'Adres en fazla 1000 karakter olabilir.' }]}
                    >
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item
                      name="note"
                      label="Not"
                      rules={[{ max: 1000, message: 'Not en fazla 1000 karakter olabilir.' }]}
                    >
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Space>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Özet" style={{ position: 'sticky', top: 80 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Kalem Sayısı">{lines.length}</Descriptions.Item>
                <Descriptions.Item label="Genel Toplam">
                  <Typography.Text strong>{formatCurrency(total)}</Typography.Text>
                </Descriptions.Item>
              </Descriptions>
              <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                Sipariş "Onay Bekliyor" durumunda oluşur; stok onay sırasında düşülür.
              </Typography.Paragraph>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button type="primary" htmlType="submit" block loading={submitting}>
                  Siparişi Oluştur
                </Button>
                <Button block onClick={() => navigate('/orders')}>
                  Vazgeç
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </PageContainer>
  );
}
