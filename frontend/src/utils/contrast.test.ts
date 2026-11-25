import { contrastRatio, parseHex, readableTextColor, tintOnWhite } from './contrast';

const ratio = (a: string, b: string) => contrastRatio(parseHex(a)!, parseHex(b)!);

describe('contrast', () => {
  it('parses short and long hex colours', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('#4F46E5')).toEqual([79, 70, 229]);
    expect(parseHex('red')).toBeNull();
  });

  it('computes the WCAG contrast ratio', () => {
    expect(ratio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(ratio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(ratio('#6B7280', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#9CA3AF', '#FFFFFF')).toBeLessThan(4.5);
  });

  it('keeps colours that are already readable', () => {
    expect(readableTextColor('#4338CA', '#FFFFFF')).toBe('#4338CA');
  });

  it('darkens light colours until they reach 4.5:1', () => {
    const background = tintOnWhite('#10B981', 0x14 / 255);
    const text = readableTextColor('#10B981', background);

    expect(text).not.toBe('#10B981');
    expect(ratio(text, background)).toBeGreaterThanOrEqual(4.5);
    // Rengin tonu korunur: siyaha gitmeden durur
    expect(text).not.toBe('#000000');
  });

  it('handles very light colours such as yellow', () => {
    const background = tintOnWhite('#FDE047', 0x14 / 255);
    expect(ratio(readableTextColor('#FDE047', background), background)).toBeGreaterThanOrEqual(4.5);
  });

  it('returns unknown colour formats unchanged', () => {
    expect(readableTextColor('rgb(0, 0, 0)', '#FFFFFF')).toBe('rgb(0, 0, 0)');
    expect(tintOnWhite('transparent', 0.5)).toBe('transparent');
  });
});
