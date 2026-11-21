import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export type Period = 'today' | 'week' | 'month';
export type Granularity = 'day' | 'month';

export interface DashboardSummary {
  today_sales: string;
  today_order_count: number;
  yesterday_sales: string;
  /** Ayın başından bugüne; geçen ayın aynı gün aralığıyla kıyaslanır */
  month_sales: string;
  prev_month_sales: string;
  pending_orders: number;
  critical_stock_count: number;
}

export interface TrendPoint {
  date: string;
  amount: string;
  order_count: number;
}

export interface TopProduct {
  product_id: number;
  sku: string;
  name: string;
  quantity: number;
  revenue: string;
}

export const DASHBOARD_KEY = ['dashboard'] as const;

export function useDashboardSummary() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'summary'],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary')).data,
  });
}

export function useSalesTrend(granularity: Granularity) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'trend', granularity],
    queryFn: async () => (await api.get<TrendPoint[]>('/dashboard/sales-trend', { params: { granularity } })).data,
  });
}

export function useTopProducts(period: Period) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'top', period],
    queryFn: async () =>
      (await api.get<TopProduct[]>('/dashboard/top-products', { params: { period, limit: 5 } })).data,
  });
}

/** Önceki döneme göre değişim yüzdesi; önceki dönem 0 ise karşılaştırma yapılmaz */
export function changePercent(current: string | number, previous: string | number): number | null {
  const prev = Number(previous);
  if (!prev) return null;
  return ((Number(current) - prev) / prev) * 100;
}
