import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import { UserMenu } from './UserMenu';

const auth: AuthContextValue = {
  user: {
    id: 1,
    full_name: 'ilkay Yılmaz',
    email: 'yonetici@example.com',
    role: 'admin',
    is_active: true,
    created_at: '2026-11-01T10:00:00Z',
    last_login_at: null,
    customer: null,
  },
  isLoading: false,
  sessionExpired: false,
  signedOut: false,
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));

function renderMenu() {
  return renderRoutes(
    [
      { path: '/', element: <UserMenu /> },
      { path: '/profile/password', element: <p>Şifre sayfası</p> },
    ],
    '/',
  );
}

describe('UserMenu', () => {
  it('shows the user with a Turkish upper-case initial and role', () => {
    renderMenu();

    expect(screen.getByText('İ')).toBeInTheDocument();
    expect(screen.getByText('ilkay Yılmaz')).toBeInTheDocument();
    expect(screen.getByText('Yönetici')).toBeInTheDocument();
  });

  it('opens the password page from the menu', async () => {
    const { router } = renderMenu();

    fireEvent.click(screen.getByText('ilkay Yılmaz'));
    fireEvent.click(await screen.findByText('Şifre Değiştir'));

    await waitFor(() => expect(router.state.location.pathname).toBe('/profile/password'));
  });

  it('signs out from the menu', async () => {
    renderMenu();

    fireEvent.click(screen.getByText('ilkay Yılmaz'));
    fireEvent.click(await screen.findByText('Çıkış Yap'));

    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});
