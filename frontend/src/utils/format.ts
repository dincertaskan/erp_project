import dayjs from 'dayjs';

const numberFormat = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integerFormat = new Intl.NumberFormat('tr-TR');

/** 1250 -> "1.250,00 ₺" */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '–';
  const amount = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(amount)) return '–';
  return `${numberFormat.format(amount)} ₺`;
}

/** 12500 -> "12.500" */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  return integerFormat.format(value);
}

/** ISO tarih -> "12.11.2026 14:30" */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '–';
  return dayjs(value).format('DD.MM.YYYY HH:mm');
}

/** ISO tarih -> "12.11.2026" */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '–';
  return dayjs(value).format('DD.MM.YYYY');
}
