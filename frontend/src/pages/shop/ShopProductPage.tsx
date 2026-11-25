import { ShoppingCartOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { App, Breadcrumb, Button, Card, Col, InputNumber, Result, Row, Space, Spin, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, errorMessage } from '@/api/client';
import type { CatalogProductDetail } from '@/api/shop';
import { useCart } from '@/cart/useCart';
import { CategoryTag } from '@/components/CategoryTag';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatCurrency } from '@/utils/format';
import { AvailabilityText, ProductImage, ShopProductCard } from './ShopProductCard';

/** E-31 Ürün Detayı (müşteri) */
export function ShopProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { add, lines } = useCart();
  const [quantity, setQuantity] = useState(1);

  const {
    data: product,
    error,
    isPending,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['catalog', 'product', id],
    queryFn: async () => (await api.get<CatalogProductDetail>(`/catalog/products/${id}`)).data,
  });
  usePageTitle(product?.name ?? 'Ürün');

  if (isPending) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Result
        status={notFound ? '404' : 'error'}
        title={notFound ? 'Bu ürün artık satışta değil.' : 'Ürün yüklenemedi'}
        subTitle={notFound ? undefined : errorMessage(error)}
        extra={
          <Space>
            {notFound ? null : (
              <Button type="primary" onClick={() => void refetch()} loading={isFetching}>
                Tekrar Dene
              </Button>
            )}
            <Button onClick={() => navigate('/shop')}>Kataloğa Dön</Button>
          </Space>
        }
      />
    );
  }

  const inCart = lines.find((line) => line.productId === product.id)?.quantity ?? 0;
  const remaining = Math.max(product.available_qty - inCart, 0);
  const outOfStock = product.availability === 'out_of_stock';

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Breadcrumb
        items={[{ title: <Link to="/shop">Ürünler</Link> }, { title: product.category.name }, { title: product.name }]}
      />
      <Card>
        <Row gutter={[32, 24]}>
          <Col xs={24} md={10}>
            <div style={{ borderRadius: 8, overflow: 'hidden' }}>
              <ProductImage src={product.image_url} alt={product.name} height={320} />
            </div>
          </Col>
          <Col xs={24} md={14}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <CategoryTag category={product.category} />
              <Typography.Title level={3} style={{ margin: 0 }}>
                {product.name}
              </Typography.Title>
              <Typography.Text type="secondary">SKU: {product.sku}</Typography.Text>
              <Typography.Text strong style={{ fontSize: 26 }}>
                {formatCurrency(product.sale_price)}
              </Typography.Text>
              <AvailabilityText product={product} />
              {product.description ? <Typography.Paragraph>{product.description}</Typography.Paragraph> : null}
              <Space wrap>
                <InputNumber
                  min={1}
                  max={Math.max(remaining, 1)}
                  precision={0}
                  value={quantity}
                  disabled={outOfStock || remaining === 0}
                  onChange={(value) => setQuantity(value ?? 1)}
                  aria-label="Adet"
                />
                <Button
                  type="primary"
                  size="large"
                  icon={<ShoppingCartOutlined />}
                  disabled={outOfStock || remaining === 0}
                  onClick={() => {
                    add(product, Math.min(quantity, remaining));
                    message.success('Sepete eklendi.');
                    setQuantity(1);
                  }}
                >
                  {outOfStock ? 'Stokta Yok' : 'Sepete Ekle'}
                </Button>
                <Link to="/shop/cart">Sepete Git</Link>
              </Space>
              {inCart > 0 ? <Typography.Text type="secondary">Sepetinizde {inCart} adet var.</Typography.Text> : null}
            </Space>
          </Col>
        </Row>
      </Card>

      {product.related.length > 0 ? (
        <div>
          <Typography.Title level={5}>Aynı kategoriden ürünler</Typography.Title>
          <Row gutter={[16, 16]}>
            {product.related.map((related) => (
              <Col key={related.id} xs={24} sm={12} lg={6}>
                <ShopProductCard product={related} />
              </Col>
            ))}
          </Row>
        </div>
      ) : null}
    </Space>
  );
}
