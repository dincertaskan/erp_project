import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';
import type { CurrentUser } from '@/api/types';
import type { UserRole } from '@/utils/labels';
import { PublicOnly, RequireAuth } from './guards';
import { safeRedirect } from './roles';

const authState: { user: CurrentUser | null; isLoading: boolean; signedOut?: boolean } = {
  user: null,
  isLoading: false,
};

vi.mock('./useAuth', () => ({
  useAuth: () => authState,
}));

function userWithRole(role: UserRole): CurrentUser {
  return {
    id: 1,
    full_name: 'Test Kullanıcı',
    email: 'test@example.com',
    role,
    is_active: true,
    created_at: '2026-11-01T10:00:00Z',
    last_login_at: null,
    customer: null,
  };
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/users',
        element: (
          <RequireAuth roles={['admin']}>
            <p>Kullanıcılar sayfası</p>
          </RequireAuth>
        ),
      },
      { path: '/login', element: <p>Giriş sayfası</p> },
      { path: '/403', element: <p>Yetkisiz</p> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('RequireAuth', () => {
  it('sends visitors to the login page with a redirect back', () => {
    authState.user = null;

    const router = renderAt('/users');

    expect(screen.getByText('Giriş sayfası')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?redirect=%2Fusers');
  });

  it('does not add a redirect after the user signs out', () => {
    authState.user = null;
    authState.signedOut = true;

    const router = renderAt('/users');

    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('');
    authState.signedOut = false;
  });

  it('shows the 403 page when the role is not allowed', () => {
    authState.user = userWithRole('warehouse');

    renderAt('/users');

    expect(screen.getByText('Yetkisiz')).toBeInTheDocument();
  });

  it('renders the page for an allowed role', () => {
    authState.user = userWithRole('admin');

    renderAt('/users');

    expect(screen.getByText('Kullanıcılar sayfası')).toBeInTheDocument();
  });
});

describe('PublicOnly', () => {
  function renderLogin(path: string) {
    const router = createMemoryRouter(
      [
        {
          path: '/login',
          element: (
            <PublicOnly>
              <p>Giriş sayfası</p>
            </PublicOnly>
          ),
        },
        { path: '/orders', element: <p>Siparişler</p> },
        { path: '/dashboard', element: <p>Dashboard</p> },
      ],
      { initialEntries: [path] },
    );
    render(<RouterProvider router={router} />);
    return router;
  }

  it('returns a signed-in user to the page they asked for', () => {
    authState.user = userWithRole('admin');

    const router = renderLogin('/login?redirect=%2Forders');

    expect(router.state.location.pathname).toBe('/orders');
  });

  it('ignores redirects that leave the application', () => {
    authState.user = userWithRole('admin');

    const router = renderLogin('/login?redirect=%2F%2Fexample.org');

    expect(router.state.location.pathname).toBe('/dashboard');
  });
});

describe('safeRedirect', () => {
  it('only accepts in-app paths', () => {
    expect(safeRedirect('/orders/5?tab=items')).toBe('/orders/5?tab=items');
    expect(safeRedirect('https://example.org')).toBeNull();
    expect(safeRedirect('//example.org')).toBeNull();
    expect(safeRedirect('/login')).toBeNull();
    expect(safeRedirect(null)).toBeNull();
  });
});
