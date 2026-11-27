import dayjs from 'dayjs';
import { vi } from 'vitest';
import { getRangePresets, rangeParams } from './reportShared';

afterEach(() => {
  vi.useRealTimers();
});

describe('getRangePresets', () => {
  it('builds the ranges from the given day', () => {
    const presets = getRangePresets(dayjs('2026-03-15T10:00:00'));

    expect(presets.map((p) => [p.label, rangeParams(p.value)])).toEqual([
      ['Bu ay', { from: '2026-03-01', to: '2026-03-15' }],
      ['Geçen ay', { from: '2026-02-01', to: '2026-02-28' }],
      ['Son 3 ay', { from: '2025-12-15', to: '2026-03-15' }],
      ['Bu yıl', { from: '2026-01-01', to: '2026-03-15' }],
    ]);
  });

  it('uses the current day on every call', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-30T12:00:00'));
    expect(rangeParams(getRangePresets()[0].value).to).toBe('2026-11-30');

    vi.setSystemTime(new Date('2026-12-01T12:00:00'));
    expect(rangeParams(getRangePresets()[0].value)).toEqual({ from: '2026-12-01', to: '2026-12-01' });
  });
});
