import { useEffect, useState } from 'react';

/** Değer `delay` ms boyunca değişmeden kalınca güncellenir (arama ve doğrulama isteklerini azaltmak için). */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
