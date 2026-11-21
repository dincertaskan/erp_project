import dayjs from 'dayjs';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  formatWithMonthName,
} from './format';
import { getStockStatus } from './labels';

describe('formatCurrency', () => {
  it('formats amounts as "1.250,00 ₺"', () => {
    expect(formatCurrency(1250)).toBe('1.250,00 ₺');
    expect(formatCurrency('14990')).toBe('14.990,00 ₺');
    expect(formatCurrency(0.5)).toBe('0,50 ₺');
  });

  it('shows a dash for missing values', () => {
    expect(formatCurrency(null)).toBe('–');
    expect(formatCurrency('abc')).toBe('–');
  });
});

describe('date and number formatting', () => {
  it('uses DD.MM.YYYY HH:mm', () => {
    expect(formatDateTime('2026-11-12T14:30:00')).toBe('12.11.2026 14:30');
    expect(formatDate('2026-11-12T14:30:00')).toBe('12.11.2026');
  });

  it('groups thousands with dots', () => {
    expect(formatNumber(12500)).toBe('12.500');
  });
});

describe('getStockStatus', () => {
  it('treats stock below the minimum as critical', () => {
    expect(getStockStatus(4, 5)).toBe('critical');
    expect(getStockStatus(5, 5)).toBe('sufficient');
    expect(getStockStatus(0, 5)).toBe('out_of_stock');
  });
});

describe('locale-sensitive formats', () => {
  it('stay Turkish even if another library switches the global dayjs locale', () => {
    dayjs.locale('en');
    expect(formatWithMonthName('2026-11-21', 'D MMM')).toBe('21 Kas');
    expect(formatRelative(dayjs().subtract(5, 'minute').toDate())).toBe('5 dakika önce');
  });
});
