import type { CatalogProduct } from '@/api/shop';

/** Sepet satırı: ürünün sepete eklendiği andaki fiyatı da saklanır (sunucu değişikliği yakalar). */
export interface CartLine {
  productId: number;
  name: string;
  sku: string;
  imageUrl: string | null;
  price: string;
  availableQty: number;
  quantity: number;
}

const PREFIX = 'erp.cart.';
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; lines: CartLine[] }>();

const keyFor = (userId: number) => `${PREFIX}${userId}`;

function read(key: string): CartLine[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.lines;
  let lines: CartLine[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    // Bozuk ya da elle değiştirilmiş kayıt sepeti kilitlemesin: dizi değilse sepet boş sayılır.
    lines = Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    lines = [];
  }
  cache.set(key, { raw, lines });
  return lines;
}

function write(key: string, lines: CartLine[]) {
  try {
    if (lines.length) localStorage.setItem(key, JSON.stringify(lines));
    else localStorage.removeItem(key);
  } catch {
    // Depolama kapalıysa sepet bu oturumda bellekte kalır.
    cache.set(key, { raw: null, lines });
  }
  listeners.forEach((listener) => listener());
}

export const cartStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => event.key?.startsWith(PREFIX) && listener();
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  },

  get: (userId: number) => read(keyFor(userId)),

  add(userId: number, product: CatalogProduct, quantity: number) {
    const lines = read(keyFor(userId));
    const existing = lines.find((line) => line.productId === product.id);
    const next = existing
      ? lines.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: Math.min(line.quantity + quantity, product.available_qty) }
            : line,
        )
      : [
          ...lines,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            imageUrl: product.image_url,
            price: product.sale_price,
            availableQty: product.available_qty,
            quantity: Math.min(quantity, product.available_qty),
          },
        ];
    write(keyFor(userId), next);
  },

  setQuantity(userId: number, productId: number, quantity: number) {
    write(
      keyFor(userId),
      read(keyFor(userId)).map((line) => (line.productId === productId ? { ...line, quantity } : line)),
    );
  },

  /** Sunucudaki güncel fiyat ve stokla satırı yeniler (fiyat değişikliğini müşteri gördükten sonra). */
  refresh(userId: number, product: CatalogProduct) {
    write(
      keyFor(userId),
      read(keyFor(userId)).map((line) =>
        line.productId === product.id
          ? {
              ...line,
              name: product.name,
              price: product.sale_price,
              availableQty: product.available_qty,
              quantity: Math.max(1, Math.min(line.quantity, product.available_qty)),
            }
          : line,
      ),
    );
  },

  remove(userId: number, productId: number) {
    write(
      keyFor(userId),
      read(keyFor(userId)).filter((line) => line.productId !== productId),
    );
  },

  clear: (userId: number) => write(keyFor(userId), []),

  /** Çıkışta tüm sepetler silinir (ortak bilgisayarda bir sonraki kullanıcı görmesin). */
  clearAll() {
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(PREFIX))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // yok sayılır
    }
    cache.clear();
    listeners.forEach((listener) => listener());
  },
};
