import { useEffect } from 'react';

export const APP_NAME = 'Akıllı ERP';

/** Sekme başlığını sayfaya göre ayarlar: "Ürünler · Akıllı ERP". Sayfadan çıkınca önceki başlık geri gelir. */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
