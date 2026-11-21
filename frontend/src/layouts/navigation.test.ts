import { adminNavigation, navigationForRole, type NavItem } from './navigation';

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
