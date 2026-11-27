import { PictureOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { App, Button, Card, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { availabilityColor, availabilityText, type CatalogProduct } from '@/api/shop';
import { useCart } from '@/cart/useCart';
import { CategoryTag } from '@/components/CategoryTag';
import { colors } from '@/theme';
import { formatCurrency } from '@/utils/format';

/** Ürün görseli; adres yoksa ya da görsel yüklenemezse yer tutucu ikon gösterilir. */
export function ProductImage({ src, alt, height }: { src: string | null; alt: string; height: number }) {
  // Hangi adresin yüklenemediği tutulur; adres değişince görsel yeniden denenir.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return src && failedSrc !== src ? (
    <img
      src={src}
      alt={alt}
      height={height}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      style={{ width: '100%', height, objectFit: 'cover', display: 'block' }}
    />
  ) : (
    <div
      aria-hidden
      style={{
        height,
        background: colors.pageBg,
        color: colors.textMuted,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 32,
      }}
    >
      <PictureOutlined />
    </div>
  );
}

export function AvailabilityText({ product }: { product: Pick<CatalogProduct, 'availability' | 'available_qty'> }) {
  return (
    <Typography.Text style={{ color: availabilityColor[product.availability], fontSize: 13 }}>
      {availabilityText(product)}
    </Typography.Text>
  );
}

/** E-30 ürün kartı: tıklanınca detay açılır (klavyede ürün adı bağlantısıyla); stok yoksa sepete eklenemez. */
export function ShopProductCard({ product }: { product: CatalogProduct }) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { add, lines } = useCart();
  const inCart = lines.find((line) => line.productId === product.id)?.quantity ?? 0;
  const canAdd = product.availability !== 'out_of_stock' && inCart < product.available_qty;

  return (
    <Card
      hoverable
      styles={{ body: { padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 } }}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      cover={<ProductImage src={product.image_url} alt={product.name} height={180} />}
      onClick={() => navigate(`/shop/products/${product.id}`)}
    >
      <div>
        <CategoryTag category={product.category} />
      </div>
      <Typography.Paragraph strong ellipsis={{ rows: 2 }} style={{ margin: 0, minHeight: 44 }}>
        <Link
          to={`/shop/products/${product.id}`}
          className="shop-product-link"
          style={{ color: 'inherit' }}
          // Kartın kendi tıklaması da aynı sayfayı açar; iki kez yönlendirme olmasın.
          onClick={(event) => event.stopPropagation()}
        >
          {product.name}
        </Link>
      </Typography.Paragraph>
      <Typography.Text strong style={{ fontSize: 18 }}>
        {formatCurrency(product.sale_price)}
      </Typography.Text>
      <AvailabilityText product={product} />
      <Button
        type="primary"
        icon={<ShoppingCartOutlined />}
        disabled={!canAdd}
        style={{ marginTop: 'auto' }}
        onClick={(event) => {
          event.stopPropagation();
          add(product, 1);
          message.success('Sepete eklendi.');
        }}
      >
        {product.availability === 'out_of_stock' ? 'Stokta Yok' : canAdd ? 'Sepete Ekle' : 'Stok Sınırında'}
      </Button>
    </Card>
  );
}
