import dayjs, { type Dayjs } from 'dayjs';
import { api } from '@/api/client';

export type DateRange = [Dayjs, Dayjs];

/** Hazır tarih aralıkları; sayfa uzun süre açık kalsa da "bugün" her çizimde yeniden hesaplanır. */
export function getRangePresets(now: Dayjs = dayjs()): { label: string; value: DateRange }[] {
  const lastMonth = now.subtract(1, 'month');
  return [
    { label: 'Bu ay', value: [now.startOf('month'), now] },
    { label: 'Geçen ay', value: [lastMonth.startOf('month'), lastMonth.endOf('month')] },
    { label: 'Son 3 ay', value: [now.subtract(3, 'month').startOf('day'), now] },
    { label: 'Bu yıl', value: [now.startOf('year'), now] },
  ];
}

/** Varsayılan aralık: bu ay */
export const defaultRange = (): DateRange => getRangePresets()[0].value;

export const rangeParams = (range: DateRange) => ({
  from: range[0].format('YYYY-MM-DD'),
  to: range[1].format('YYYY-MM-DD'),
});

/** Raporu Excel olarak indirir; dosya adını sunucunun verdiği addan alır. */
export async function downloadReport(path: string, params: Record<string, unknown>, fallbackName: string) {
  const response = await api.get<Blob>(path, {
    params: { ...params, format: 'xlsx' },
    responseType: 'blob',
    paramsSerializer: { indexes: null },
  });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
