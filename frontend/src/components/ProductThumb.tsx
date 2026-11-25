import { PictureOutlined } from '@ant-design/icons';
import { Avatar } from 'antd';
import type { Product } from '@/api/types';
import { colors } from '@/theme';

/** Ürün görseli; yoksa yer tutucu ikon */
export function ProductThumb({ product, size = 40 }: { product: Pick<Product, 'image_url' | 'name'>; size?: number }) {
  return (
    <Avatar
      shape="square"
      size={size}
      src={product.image_url ?? undefined}
      icon={<PictureOutlined />}
      alt={product.name}
      style={{ background: colors.pageBg, color: colors.textMuted, flexShrink: 0 }}
    />
  );
}
