import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { CurrentUser } from '@/api/types';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import { ChangePasswordPage } from './ChangePasswordPage';
import { ProfilePage } from './ProfilePage';

const auth: AuthContextValue = {
  user: null,
  isLoading: false,
  sessionExpired: false,
  signedOut: false,
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));

const baseUser: CurrentUser = {
  id: 1,
  full_name: 'Elif Yılmaz',
  email: 'yonetici@example.com',
  role: 'admin',
  is_active: true,
  created_at: '2026-10-02T09:00:00Z',
  last_login_at: null,
  customer: null,
};

const routes = [
  { path: '/profile', element: <ProfilePage /> },
  { path: '/profile/password', element: <ChangePasswordPage /> },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ProfilePage', () => {
  it('shows only the name field for staff accounts', () => {
    auth.user = baseUser;
    renderRoutes(routes, '/profile');

    expect(screen.getByLabelText('Ad Soyad')).toHaveValue('Elif Yılmaz');
    expect(screen.queryByLabelText('Telefon')).not.toBeInTheDocument();
  });

  it('lets customers edit contact details and sends empty fields as null', async () => {
    auth.user = {
      ...baseUser,
      role: 'customer',
      customer: { id: 5, phone: '0532 555 01 23', company_name: null, address: null, city: 'İstanbul' },
    };
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: auth.user });
    renderRoutes(routes, '/profile');

    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/auth/me', {
        full_name: 'Elif Yılmaz',
        phone: null,
        company_name: null,
        city: 'İstanbul',
        address: null,
      }),
    );
  });
});

describe('ChangePasswordPage', () => {
  it('shows a wrong current password under that field', async () => {
    auth.user = baseUser;
    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError(400, 'INVALID_PASSWORD', 'Mevcut şifre hatalı.', [
        { field: 'current_password', message: 'Mevcut şifre hatalı.' },
      ]),
    );
    renderRoutes(routes, '/profile/password');

    fireEvent.change(screen.getByLabelText('Mevcut Şifre'), { target: { value: 'Eski1234' } });
    fireEvent.change(screen.getByLabelText('Yeni Şifre'), { target: { value: 'Yeni1234' } });
    fireEvent.change(screen.getByLabelText('Yeni Şifre Tekrarı'), { target: { value: 'Yeni1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi Güncelle' }));

    const fieldError = await screen.findByText('Mevcut şifre hatalı.');
    expect(fieldError.closest('.ant-form-item')).toHaveTextContent('Mevcut Şifre');
  });
});
