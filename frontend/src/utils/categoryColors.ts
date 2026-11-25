import { readableTextColor, tintOnWhite } from './contrast';

// Zemin: kategori rengi %8 (0x14) opaklıkla; kenarlık %25 (0x40).
export const CATEGORY_BACKGROUND_ALPHA = 0x14 / 255;

/** Kategori etiketi renkleri: açık renkler yazıda okunur olsun diye zeminde 4,5:1'e ulaşana kadar koyulaştırılır. */
export function categoryTagColors(color: string) {
  const background = tintOnWhite(color, CATEGORY_BACKGROUND_ALPHA);
  return {
    color: readableTextColor(color, background),
    background: `${color}14`,
    borderColor: `${color}40`,
  };
}
