import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// ProComponents dayjs'in genel dilini kendi ayarına çekebiliyor; dile bağlı çıktılarda Türkçe açıkça verilir.
const tr = (value: string | Date) => dayjs(value).locale('tr');

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

/** "5 dakika önce" */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '–';
  return tr(value).fromNow();
}

/** Ay adı içeren biçimler: "21 Kas", "Kas 26" */
export function formatWithMonthName(value: string | Date, pattern: string): string {
  return tr(value).format(pattern);
}

const percentFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

/** 12.5 -> "%12,5" (Türkçede yüzde işareti sayıdan önce yazılır) */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  const sign = value < 0 ? '-' : '';
  return `${sign}%${percentFormat.format(Math.abs(value))}`;
}
