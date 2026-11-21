import { adminNavigation, navigationForRole, selectedMenuKey, type NavItem } from './navigation';

const paths = (items: NavItem[]): string[] =>
  items.flatMap((item) => [item.path, ...(item.children ? paths(item.children) : [])]);

describe('navigationForRole', () => {
  it('shows every module to admins', () => {
    expect(paths(navigationForRole(adminNavigation, 'admin'))).toEqual(
      expect.arrayContaining(['/dashboard', '/categories', '/customers', '/reports', '/users', '/stock/critical']),
    );
  });

  it('limits warehouse staff to products, stock and orders', () => {
    expect(paths(navigationForRole(adminNavigation, 'warehouse'))).toEqual([
      '/products',
      '/stock-menu',
      '/stock',
      '/stock/movements',
      '/stock/critical',
      '/orders',
    ]);
  });
});

describe('selectedMenuKey', () => {
  it('picks the longest matching menu path', () => {
    expect(selectedMenuKey(adminNavigation, '/stock/movements')).toBe('/stock/movements');
    expect(selectedMenuKey(adminNavigation, '/stock')).toBe('/stock');
    expect(selectedMenuKey(adminNavigation, '/products/12')).toBe('/products');
    expect(selectedMenuKey(adminNavigation, '/profile')).toBeUndefined();
  });
});
