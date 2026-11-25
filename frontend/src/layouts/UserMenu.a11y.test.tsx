import { fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import { navigationForRole, adminNavigation } from './navigation';
import { UserMenu } from './UserMenu';

const auth: AuthContextValue = {
  user: {
    id: 1,
    full_name: 'Elif Yılmaz',
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

describe('UserMenu keyboard access', () => {
  it('is a labelled button that can take focus', () => {
    renderRoutes([{ path: '/', element: <UserMenu /> }], '/');

    const trigger = screen.getByRole('button', { name: 'Kullanıcı menüsü' });
    trigger.focus();

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveTextContent('Elif Yılmaz');
  });

  it('opens the menu from the button', async () => {
    renderRoutes([{ path: '/', element: <UserMenu /> }], '/');

    fireEvent.click(screen.getByRole('button', { name: 'Kullanıcı menüsü' }));

    expect(await screen.findByText('Profilim')).toBeInTheDocument();
  });

  it('hides the name and role on narrow screens through a class', () => {
    renderRoutes([{ path: '/', element: <UserMenu /> }], '/');

    expect(screen.getByText('Elif Yılmaz')).toHaveClass('hide-below-sm');
    expect(screen.getByText('Yönetici').closest('.hide-below-sm')).not.toBeNull();
  });
});

describe('admin navigation wording', () => {
  it('uses the same name as the dashboard page title', () => {
    expect(navigationForRole(adminNavigation, 'admin')[0]).toMatchObject({ path: '/dashboard', name: 'Genel Bakış' });
  });
});
