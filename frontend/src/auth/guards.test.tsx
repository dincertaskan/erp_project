import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';
import type { CurrentUser } from '@/api/types';
import type { UserRole } from '@/utils/labels';
import { RequireAuth } from './guards';

const authState: { user: CurrentUser | null; isLoading: boolean } = { user: null, isLoading: false };

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
