import { adminNavigation, navigationForRole, selectedMenuKey, type NavGroup } from './navigation';

const paths = (groups: NavGroup[]): string[] => groups.flatMap((group) => group.items.map((item) => item.path));

describe('navigationForRole', () => {
  it('shows every module to admins', () => {
    expect(paths(navigationForRole(adminNavigation, 'admin'))).toEqual(
      expect.arrayContaining(['/dashboard', '/categories', '/customers', '/reports', '/users', '/stock/critical']),
    );
  });

  it('limits warehouse staff to products, stock and orders', () => {
    expect(paths(navigationForRole(adminNavigation, 'warehouse'))).toEqual([
      '/products',
      '/stock',
      '/stock/movements',
      '/stock/critical',
      '/orders',
    ]);
  });

  it('hides groups left without items', () => {
    expect(navigationForRole(adminNavigation, 'warehouse').map((group) => group.key)).toEqual([
      'catalog',
      'stock',
      'sales',
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
