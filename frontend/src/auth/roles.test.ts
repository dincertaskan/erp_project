import { canAccess, landingPath } from './roles';

describe('canAccess', () => {
  it('matches each area to its roles', () => {
    expect(canAccess('/orders/new', 'warehouse')).toBe(false);
    expect(canAccess('/orders/41', 'warehouse')).toBe(true);
    expect(canAccess('/orders?status=pending', 'admin')).toBe(true);
    expect(canAccess('/shop/cart', 'admin')).toBe(false);
    expect(canAccess('/stock', 'customer')).toBe(false);
    expect(canAccess('/profile', 'customer')).toBe(true);
    expect(canAccess('/reportsx', 'warehouse')).toBe(true);
  });
});

describe('landingPath', () => {
  it('keeps a redirect the role can open', () => {
    expect(landingPath('/orders/41', 'warehouse')).toBe('/orders/41');
    expect(landingPath('/shop/orders/3', 'customer')).toBe('/shop/orders/3');
  });

  it("falls back to the role's home for pages the role cannot open", () => {
    expect(landingPath('/users', 'warehouse')).toBe('/stock');
    expect(landingPath('/dashboard', 'customer')).toBe('/shop');
    expect(landingPath('/shop', 'admin')).toBe('/dashboard');
  });

  it('ignores unsafe or missing redirects', () => {
    expect(landingPath('//example.org', 'admin')).toBe('/dashboard');
    expect(landingPath(null, 'customer')).toBe('/shop');
  });
});
