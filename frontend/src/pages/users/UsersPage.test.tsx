import { screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '@/api/client';
import type { User } from '@/api/types';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import { UsersPage } from './UsersPage';

const me: User = {
  id: 1,
  full_name: 'Elif Yılmaz',
  email: 'yonetici@example.com',
  role: 'admin',
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  last_login_at: '2026-11-21T09:00:00Z',
};
const staff: User = { ...me, id: 2, full_name: 'Ayşe Kaya', email: 'depo@example.com', role: 'warehouse' };

const auth: AuthContextValue = {
  user: { ...me, customer: null },
  isLoading: false,
  sessionExpired: false,
  signedOut: false,
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));

describe('UsersPage', () => {
  it('lists users and blocks actions on the signed-in admin', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [me, staff], total: 2, page: 1, page_size: 20 } });
    renderRoutes([{ path: '/users', element: <UsersPage /> }], '/users');

    const ownRow = (await screen.findByText('yonetici@example.com')).closest('tr') as HTMLElement;
    const staffRow = screen.getByText('depo@example.com').closest('tr') as HTMLElement;

    expect(within(ownRow).queryByRole('link', { name: 'Rol Ata' })).not.toBeInTheDocument();
    expect(within(ownRow).getByText('Rol Ata')).toHaveStyle({ cursor: 'not-allowed' });
    expect(within(staffRow).getByText('Depo Personeli')).toBeInTheDocument();
    expect(within(staffRow).getByText('Pasife Al').tagName).toBe('A');
  });
});
