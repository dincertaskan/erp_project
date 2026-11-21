import dayjs, { type Dayjs } from 'dayjs';
import { api } from '@/api/client';

export type DateRange = [Dayjs, Dayjs];

export const rangePresets: { label: string; value: DateRange }[] = [
  { label: 'Bu ay', value: [dayjs().startOf('month'), dayjs()] },
  {
    label: 'Geçen ay',
    value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
  },
  { label: 'Son 3 ay', value: [dayjs().subtract(3, 'month').startOf('day'), dayjs()] },
  { label: 'Bu yıl', value: [dayjs().startOf('year'), dayjs()] },
];

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
