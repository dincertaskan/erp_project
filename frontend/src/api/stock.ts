import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { StockSummary } from './types';

export const STOCK_KEY = ['stock'] as const;

/** Menü rozeti ve özet şeridi; stok değişince birlikte yenilenir */
export function useCriticalCount(enabled = true) {
  return useQuery({
    queryKey: [...STOCK_KEY, 'critical-count'],
    queryFn: async () => (await api.get<{ count: number }>('/stock/critical/count')).data.count,
    enabled,
    staleTime: 30 * 1000,
    // Başka kullanıcıların işlemleri de rozete yansısın.
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useStockSummary() {
  return useQuery({
    queryKey: [...STOCK_KEY, 'summary'],
    queryFn: async () => (await api.get<StockSummary>('/stock/summary')).data,
    staleTime: 30 * 1000,
  });
}

/** Stok değiştiren her işlemden sonra: özet, rozet ve ürün detayları yenilenir */
export function invalidateStock(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: STOCK_KEY });
  void queryClient.invalidateQueries({ queryKey: ['products'] });
}

/** 409 INSUFFICIENT_STOCK ayrıntısındaki güncel stok; beklenen biçimde değilse undefined */
export function availableFromDetails(details: unknown): number | undefined {
  if (!Array.isArray(details)) return undefined;
  const first: unknown = details[0];
  if (typeof first !== 'object' || first === null || !('available' in first)) return undefined;
  const { available } = first;
  return typeof available === 'number' && Number.isFinite(available) ? available : undefined;
}
