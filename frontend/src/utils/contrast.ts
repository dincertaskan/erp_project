/** WCAG 2.x renk kontrastı yardımcıları (yalnızca #RGB / #RRGGBB biçimi) */

type Rgb = [number, number, number];

/** WCAG AA: normal boyutlu metin için en düşük kontrast oranı */
export const AA_TEXT_RATIO = 4.5;

export function parseHex(color: string): Rgb | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Göreli parlaklık (0 = siyah, 1 = beyaz) */
export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** `color` ile `target` arasında karışım; amount 0 → color, 1 → target */
export function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  return color.map((v, i) => v + (target[i] - v) * amount) as Rgb;
}

/**
 * Metin rengini, verilen zeminde en az `minRatio` kontrasta ulaşana kadar siyaha doğru koyulaştırır.
 * Zaten yeterliyse renk değişmez; çözümlenemeyen renk olduğu gibi döner.
 */
export function readableTextColor(color: string, background: string, minRatio = AA_TEXT_RATIO): string {
  const fg = parseHex(color);
  const bg = parseHex(background);
  if (!fg || !bg) return color;
  if (contrastRatio(fg, bg) >= minRatio) return color;
  const black: Rgb = [0, 0, 0];
  for (let step = 1; step <= 20; step++) {
    // Yuvarlanmış (gerçekte kullanılacak) renk ölçülür.
    const candidate = parseHex(toHex(mix(fg, black, step / 20)))!;
    if (contrastRatio(candidate, bg) >= minRatio) return toHex(candidate);
  }
  return toHex(black);
}

/** Yarı saydam rengin beyaz zemin üzerindeki görünen hali (ör. kategori etiketi zemini) */
export function tintOnWhite(color: string, alpha: number): string {
  const rgb = parseHex(color);
  return rgb ? toHex(mix([255, 255, 255], rgb, alpha)) : color;
}
