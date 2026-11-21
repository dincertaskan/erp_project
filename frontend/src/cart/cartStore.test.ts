import { vi } from 'vitest';
import type { CatalogProduct } from '@/api/shop';
import { cartStore } from './cartStore';

const USER = 9;

const mouse: CatalogProduct = {
  id: 7,
  sku: 'ELK-0001',
  name: 'Kablosuz Mouse',
  description: null,
  category: { id: 1, name: 'Elektronik', color: '#6366F1' },
  sale_price: '100.00',
  image_url: null,
  availability: 'in_stock',
  available_qty: 5,
};

const keyboard: CatalogProduct = { ...mouse, id: 8, sku: 'ELK-0002', name: 'Klavye', sale_price: '250.00' };

beforeEach(() => {
  vi.restoreAllMocks();
  cartStore.clearAll();
});

describe('cartStore', () => {
  it('starts empty and stores the product snapshot on first add', () => {
    expect(cartStore.get(USER)).toEqual([]);

    cartStore.add(USER, mouse, 2);

    expect(cartStore.get(USER)).toEqual([
      {
        productId: 7,
        name: 'Kablosuz Mouse',
        sku: 'ELK-0001',
        imageUrl: null,
        price: '100.00',
        availableQty: 5,
        quantity: 2,
      },
    ]);
    expect(JSON.parse(localStorage.getItem(`erp.cart.${USER}`) ?? '[]')).toHaveLength(1);
  });

  it('caps the first add at the available quantity', () => {
    cartStore.add(USER, mouse, 50);

    expect(cartStore.get(USER)[0].quantity).toBe(5);
  });

  it('keeps separate lines for different products in insertion order', () => {
    cartStore.add(USER, mouse, 1);
    cartStore.add(USER, keyboard, 1);
    cartStore.add(USER, mouse, 1);

    expect(cartStore.get(USER).map((line) => [line.productId, line.quantity])).toEqual([
      [7, 2],
      [8, 1],
    ]);
  });

  it('changes only the quantity of the given product', () => {
    cartStore.add(USER, mouse, 1);
    cartStore.add(USER, keyboard, 1);

    cartStore.setQuantity(USER, 8, 4);

    expect(cartStore.get(USER).map((line) => line.quantity)).toEqual([1, 4]);
  });

  it('ignores quantity changes for products that are not in the cart', () => {
    cartStore.add(USER, mouse, 1);

    cartStore.setQuantity(USER, 999, 3);

    expect(cartStore.get(USER)).toMatchObject([{ productId: 7, quantity: 1 }]);
  });

  it('refreshes price and stock from the server and clamps the quantity', () => {
    cartStore.add(USER, mouse, 4);

    cartStore.refresh(USER, { ...mouse, name: 'Mouse v2', sale_price: '120.00', available_qty: 2 });

    expect(cartStore.get(USER)[0]).toMatchObject({ name: 'Mouse v2', price: '120.00', availableQty: 2, quantity: 2 });
  });

  it('never refreshes a line below one item even when stock ran out', () => {
    cartStore.add(USER, mouse, 3);

    cartStore.refresh(USER, { ...mouse, available_qty: 0 });

    expect(cartStore.get(USER)[0]).toMatchObject({ availableQty: 0, quantity: 1 });
  });

  it('removes a single product and deletes the storage key when the cart becomes empty', () => {
    cartStore.add(USER, mouse, 1);
    cartStore.add(USER, keyboard, 1);

    cartStore.remove(USER, 7);
    expect(cartStore.get(USER).map((line) => line.productId)).toEqual([8]);

    cartStore.remove(USER, 8);
    expect(cartStore.get(USER)).toEqual([]);
    expect(localStorage.getItem(`erp.cart.${USER}`)).toBeNull();
  });

  it('clears only the given user', () => {
    cartStore.add(USER, mouse, 1);
    cartStore.add(10, mouse, 1);

    cartStore.clear(USER);

    expect(cartStore.get(USER)).toEqual([]);
    expect(cartStore.get(10)).toHaveLength(1);
  });

  it('leaves unrelated storage keys alone on sign-out', () => {
    localStorage.setItem('erp.token', 'abc');
    cartStore.add(USER, mouse, 1);

    cartStore.clearAll();

    expect(localStorage.getItem('erp.token')).toBe('abc');
    expect(cartStore.get(USER)).toEqual([]);
  });

  it('treats corrupt stored data as an empty cart', () => {
    localStorage.setItem(`erp.cart.${USER}`, '{bozuk');

    expect(cartStore.get(USER)).toEqual([]);
  });

  it('returns the same array while storage is unchanged so React does not re-render', () => {
    cartStore.add(USER, mouse, 1);

    const first = cartStore.get(USER);

    expect(cartStore.get(USER)).toBe(first);
    cartStore.setQuantity(USER, 7, 2);
    expect(cartStore.get(USER)).not.toBe(first);
  });

  it('keeps the cart in memory when storage is not available', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

    cartStore.add(USER, mouse, 2);

    expect(cartStore.get(USER)).toMatchObject([{ productId: 7, quantity: 2 }]);
  });

  it('notifies subscribers on changes and on cart updates from other tabs', () => {
    const listener = vi.fn();
    const unsubscribe = cartStore.subscribe(listener);

    cartStore.add(USER, mouse, 1);
    expect(listener).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent('storage', { key: `erp.cart.${USER}` }));
    expect(listener).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new StorageEvent('storage', { key: 'erp.token' }));
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    cartStore.add(USER, mouse, 1);
    window.dispatchEvent(new StorageEvent('storage', { key: `erp.cart.${USER}` }));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
