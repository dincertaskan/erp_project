import { PictureOutlined } from '@ant-design/icons';
import { Avatar } from 'antd';
import type { Product } from '@/api/types';

/** Ürün görseli; yoksa yer tutucu ikon */
export function ProductThumb({ product, size = 40 }: { product: Pick<Product, 'image_url' | 'name'>; size?: number }) {
  return (
    <Avatar
      shape="square"
      size={size}
      src={product.image_url ?? undefined}
      icon={<PictureOutlined />}
      alt={product.name}
      style={{ background: '#F3F4F6', color: '#9CA3AF', flexShrink: 0 }}
    />
  );
}
