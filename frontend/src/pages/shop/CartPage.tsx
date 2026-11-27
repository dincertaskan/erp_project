import { DeleteOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Popconfirm,
  Radio,
  Row,
  Space,
  Typography,
} from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api, errorMessage } from '@/api/client';
import type { CartIssue, CartValidation, MyOrderDetail } from '@/api/shop';
import { useAuth } from '@/auth/useAuth';
import type { CartLine } from '@/cart/cartStore';
import { useCart } from '@/cart/useCart';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePageTitle } from '@/hooks/usePageTitle';
import { colors } from '@/theme';
import { formatCurrency } from '@/utils/format';
import { paymentMethodLabels, type PaymentMethod } from '@/utils/labels';
import { ProductImage } from './ShopProductCard';

interface CheckoutForm {
  payment_method: PaymentMethod;
  shipping_address: string;
  note?: string;
}

const toItems = (lines: CartLine[]) =>
  lines.map((line) => ({ product_id: line.productId, quantity: line.quantity, expected_price: line.price }));

/** E-32 Sepet: sepet tarayıcıda durur; açılışta ve siparişte sunucuda doğrulanır (UC-07 4a). */
export function CartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { lines, total, setQuantity, refresh, remove, clear } = useCart();
  const [form] = Form.useForm<CheckoutForm>();
  const savedAddress = [user?.customer?.address, user?.customer?.city].filter(Boolean).join(', ');

  usePageTitle('Sepetim');
  // Adet değişirken her tuşta istek atılmaz; doğrulama 400 ms bekledikten sonra yapılır.
  const items = toItems(lines);
  const itemsKey = JSON.stringify(items);
  const validatedKey = useDebouncedValue(itemsKey, 400);
  const awaitingValidation = itemsKey !== validatedKey;

  const validation = useQuery({
    queryKey: ['cart', 'validate', validatedKey],
    queryFn: async () =>
      (await api.post<CartValidation>('/me/cart/validate', { items: JSON.parse(validatedKey) as typeof items })).data,
    enabled: lines.length > 0 && validatedKey !== '[]',
    placeholderData: (previous) => previous,
  });
  const issues = new Map<number, CartIssue>((validation.data?.issues ?? []).map((issue) => [issue.product_id, issue]));
  const blocked = issues.size > 0;
  const productsById = new Map((validation.data?.products ?? []).map((product) => [product.id, product]));
  // Satışta olmayan ya da stoğu tükenen satırlar alınamaz; güncellemede sepetten çıkarılır.
  const unbuyable = (line: CartLine) => {
    const issue = issues.get(line.productId);
    if (!issue) return false;
    const available = productsById.get(line.productId)?.available_qty ?? issue.available_qty ?? 0;
    return issue.issue === 'not_available' || available <= 0;
  };
  const removable = lines.filter(unbuyable);

  const acceptChanges = () => {
    for (const line of lines) {
      const product = productsById.get(line.productId);
      if (unbuyable(line)) remove(line.productId);
      else if (product) refresh(product);
    }
  };

  const placeOrder = useMutation({
    mutationFn: async (values: CheckoutForm) =>
      (await api.post<MyOrderDetail>('/me/orders', { ...values, note: values.note || null, items: toItems(lines) }))
        .data,
    onSuccess: (order) => {
      clear();
      navigate(`/shop/orders/${order.id}?new=1`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'CART_CHANGED') void validation.refetch();
      message.error(errorMessage(err));
    },
  });

  if (lines.length === 0) {
    return (
      <Card>
        <Empty description="Sepetiniz boş">
          <Button type="primary" onClick={() => navigate('/shop')}>
            Alışverişe Başla
          </Button>
        </Empty>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Sepetim
        </Typography.Title>
        <Popconfirm title="Sepet boşaltılsın mı?" okText="Boşalt" cancelText="Vazgeç" onConfirm={clear}>
          <Button>Sepeti Boşalt</Button>
        </Popconfirm>
      </Space>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          {blocked ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Sepetinizdeki bazı ürünler değişti."
              description={
                removable.length > 0
                  ? `İşaretli satırları kontrol edin. Güncellediğinizde satışta olmayan ya da stoğu tükenen ${removable.length} ürün sepetten çıkarılacak, diğerleri güncel fiyat ve stokla yenilenecek.`
                  : 'İşaretli satırları kontrol edin. Güncel fiyat ve stokla devam etmek için güncelleyin.'
              }
              action={
                <Button size="small" onClick={acceptChanges}>
                  Güncelle
                </Button>
              }
            />
          ) : null}
          <Card styles={{ body: { padding: 0 } }}>
            <List
              dataSource={lines}
              renderItem={(line) => {
                const issue = issues.get(line.productId);
                const unavailable = issue?.issue === 'not_available';
                return (
                  <List.Item
                    style={{
                      padding: 16,
                      border: unavailable ? `1px solid #FCA5A5` : undefined,
                      background: unavailable ? '#FEF2F2' : undefined,
                    }}
                    actions={[
                      <Button
                        key="remove"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label={`${line.name} sepetten çıkar`}
                        onClick={() => remove(line.productId)}
                      />,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <div style={{ width: 64, borderRadius: 6, overflow: 'hidden' }}>
                          <ProductImage src={line.imageUrl} alt={line.name} height={64} />
                        </div>
                      }
                      title={<Link to={`/shop/products/${line.productId}`}>{line.name}</Link>}
                      description={
                        <Space direction="vertical" size={4}>
                          <Typography.Text type="secondary">{formatCurrency(line.price)} / adet</Typography.Text>
                          {issue ? (
                            <Typography.Text type={unavailable ? 'danger' : 'warning'}>{issue.message}</Typography.Text>
                          ) : null}
                        </Space>
                      }
                    />
                    <Space size={16}>
                      <InputNumber
                        min={1}
                        max={Math.max(line.availableQty, 1)}
                        precision={0}
                        value={line.quantity}
                        disabled={unavailable}
                        onChange={(value) => setQuantity(line.productId, Math.max(1, value ?? 1))}
                        aria-label={`${line.name} adedi`}
                      />
                      <Typography.Text strong style={{ minWidth: 100, textAlign: 'right', display: 'inline-block' }}>
                        {formatCurrency(Number(line.price) * line.quantity)}
                      </Typography.Text>
                    </Space>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Sipariş Özeti" style={{ position: 'sticky', top: 80 }}>
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              initialValues={{ shipping_address: savedAddress }}
              onFinish={(values) => placeOrder.mutate(values)}
            >
              <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 16 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Typography.Text>Ara toplam</Typography.Text>
                  <Typography.Text>{formatCurrency(total)}</Typography.Text>
                </Space>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Typography.Text>Kargo</Typography.Text>
                  <Typography.Text>Ücretsiz</Typography.Text>
                </Space>
                <Space
                  style={{
                    width: '100%',
                    justifyContent: 'space-between',
                    borderTop: `1px solid ${colors.border}`,
                    paddingTop: 8,
                  }}
                >
                  <Typography.Text strong>Genel toplam</Typography.Text>
                  <Typography.Text strong style={{ fontSize: 18 }}>
                    {formatCurrency(total)}
                  </Typography.Text>
                </Space>
              </Space>
              <Form.Item
                name="payment_method"
                label="Ödeme Yöntemi"
                extra="Demo: gerçek ödeme alınmaz."
                rules={[{ required: true, message: 'Ödeme yöntemi seçin.' }]}
              >
                <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <Radio key={value} value={value}>
                      {label}
                    </Radio>
                  ))}
                </Radio.Group>
              </Form.Item>
              <Form.Item
                name="shipping_address"
                label="Teslimat Adresi"
                rules={[
                  { required: true, whitespace: true, message: 'Teslimat adresi zorunludur.' },
                  { min: 5, message: 'Adres en az 5 karakter olmalıdır.' },
                  { max: 1000, message: 'Adres en fazla 1000 karakter olabilir.' },
                ]}
              >
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item name="note" label="Not (isteğe bağlı)" rules={[{ max: 1000, message: 'Not çok uzun.' }]}>
                <Input.TextArea rows={2} />
              </Form.Item>
              <Button
                type="primary"
                size="large"
                block
                htmlType="submit"
                loading={placeOrder.isPending}
                disabled={blocked || awaitingValidation || validation.isFetching}
              >
                Siparişi Tamamla
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
