import { useCallback, useSyncExternalStore } from 'react';
import type { CatalogProduct } from '@/api/shop';
import { useAuth } from '@/auth/useAuth';
import { cartStore, type CartLine } from './cartStore';

const EMPTY: CartLine[] = [];

/** Oturumdaki müşterinin sepeti (karar 8: tarayıcıda tutulur, siparişte sunucuda doğrulanır). */
export function useCart() {
  const { user } = useAuth();
  const userId = user?.id;
  const lines = useSyncExternalStore(cartStore.subscribe, () => (userId ? cartStore.get(userId) : EMPTY));

  const add = useCallback(
    (product: CatalogProduct, quantity = 1) => userId && cartStore.add(userId, product, quantity),
    [userId],
  );
  const setQuantity = useCallback(
    (productId: number, quantity: number) => userId && cartStore.setQuantity(userId, productId, quantity),
    [userId],
  );
  const refresh = useCallback((product: CatalogProduct) => userId && cartStore.refresh(userId, product), [userId]);
  const remove = useCallback((productId: number) => userId && cartStore.remove(userId, productId), [userId]);
  const clear = useCallback(() => userId && cartStore.clear(userId), [userId]);

  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0);

  return { lines, count, total, add, setQuantity, refresh, remove, clear };
}
