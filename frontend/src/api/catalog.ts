import { useQuery } from '@tanstack/react-query';
import type { SortOrder } from 'antd/es/table/interface';
import { api } from './client';
import type { Category } from './types';

export const CATEGORIES_KEY = ['categories'] as const;

/** Kategoriler az olduğu için tamamı tek istekte alınır */
export function useCategories(options: { activeOnly?: boolean } = {}) {
  return useQuery({
    queryKey: [...CATEGORIES_KEY, options.activeOnly ? 'active' : 'all'],
    queryFn: async () =>
      (await api.get<Category[]>('/categories', { params: options.activeOnly ? { is_active: true } : {} })).data,
    staleTime: 60 * 1000,
  });
}

/** ProTable sıralamasını API biçimine çevirir: { sale_price: 'descend' } -> "-sale_price" */
export function toSortParam(sort: Record<string, SortOrder>, fallback: string): string {
  const [field, order] = Object.entries(sort).find(([, value]) => value) ?? [];
  if (!field || !order) return fallback;
  return order === 'descend' ? `-${field}` : field;
}

/** Para alanları API'ye iki ondalıklı metin olarak gönderilir */
export const toMoney = (value: number | null | undefined) => (value ?? 0).toFixed(2);
