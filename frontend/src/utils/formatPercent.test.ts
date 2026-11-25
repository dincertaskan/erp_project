import { formatPercent } from './format';

describe('formatPercent', () => {
  it('puts the percent sign first with a Turkish decimal comma', () => {
    expect(formatPercent(12.5)).toBe('%12,5');
    expect(formatPercent(40)).toBe('%40');
    expect(formatPercent(16.666)).toBe('%16,7');
  });

  it('keeps the sign of negative values in front', () => {
    expect(formatPercent(-20)).toBe('-%20');
  });

  it('shows a dash for missing values', () => {
    expect(formatPercent(null)).toBe('–');
    expect(formatPercent(undefined)).toBe('–');
    expect(formatPercent(Number.NaN)).toBe('–');
  });
});
