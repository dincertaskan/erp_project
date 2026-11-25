import { Tag } from 'antd';
import type { CategoryRef } from '@/api/types';
import { categoryTagColors } from '@/utils/categoryColors';

/** Kategori adını kendi rengiyle gösterir (açık zemin, renkli yazı) */
export function CategoryTag({ category }: { category: Pick<CategoryRef, 'name' | 'color'> }) {
  return (
    <Tag bordered style={{ ...categoryTagColors(category.color), marginInlineEnd: 0 }}>
      {category.name}
    </Tag>
  );
}

export function ColorDot({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color }}
    />
  );
}
