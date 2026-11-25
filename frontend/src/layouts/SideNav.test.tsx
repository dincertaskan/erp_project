import { fireEvent, screen } from '@testing-library/react';
import { renderRoutes } from '@/test/render';
import { adminNavigation, navigationForRole } from './navigation';
import { SideNav } from './SideNav';

function renderNav(selectedKey?: string, criticalCount = 0) {
  return renderRoutes(
    [
      {
        path: '*',
        element: (
          <SideNav
            groups={navigationForRole(adminNavigation, 'admin')}
            selectedKey={selectedKey}
            criticalCount={criticalCount}
          />
        ),
      },
    ],
    '/',
  );
}

describe('SideNav', () => {
  it('marks only the selected item as the current page', () => {
    renderNav('/stock/movements');

    expect(screen.getByRole('link', { name: 'Stok Hareketleri' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Stok İşlemleri' })).not.toHaveAttribute('aria-current');
  });

  it('collapses and expands a group from its header button', () => {
    renderNav();
    const header = screen.getByRole('button', { name: 'Stok' });

    expect(header).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(header.getAttribute('aria-controls') ?? '')).toHaveAttribute('data-collapsed');
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the critical stock count next to its link', () => {
    renderNav(undefined, 7);

    expect(screen.getByRole('link', { name: /Kritik Stok/ })).toHaveTextContent('7');
  });
});
