import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

const auth: AuthContextValue = {
  user: null,
  isLoading: false,
  sessionExpired: false,
  signedOut: false,
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));

const routes = [
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
];

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  auth.sessionExpired = false;
  auth.login = vi.fn();
  vi.restoreAllMocks();
});

describe('LoginPage', () => {
  it('shows the server message when the credentials are wrong', async () => {
    auth.login = vi.fn().mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.'));
    renderRoutes(routes, '/login');

    type('E-posta', 'yonetici@example.com');
    type('Şifre', 'yanlis');
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }));

    expect(await screen.findByText('E-posta veya şifre hatalı.')).toBeInTheDocument();
    expect(auth.login).toHaveBeenCalledWith('yonetici@example.com', 'yanlis');
  });

  it('shows the throttle message for too many attempts', async () => {
    const message = 'Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin.';
    auth.login = vi.fn().mockRejectedValue(new ApiError(429, 'TOO_MANY_REQUESTS', message));
    renderRoutes(routes, '/login');

    type('E-posta', 'yonetici@example.com');
    type('Şifre', 'yanlis');
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('tells the user when the session has expired', () => {
    auth.sessionExpired = true;
    renderRoutes(routes, '/login');

    expect(screen.getByText('Oturumunuzun süresi doldu')).toBeInTheDocument();
  });

  it('validates the form before calling the server', async () => {
    renderRoutes(routes, '/login');

    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }));

    expect(await screen.findByText('E-posta zorunludur.')).toBeInTheDocument();
    expect(auth.login).not.toHaveBeenCalled();
  });
});

describe('RegisterPage', () => {
  function fillValidForm() {
    type('Ad Soyad', 'Deniz Ak');
    type('E-posta', 'Deniz@Example.com');
    type('Şifre', 'Demo1234');
    type('Şifre Tekrarı', 'Demo1234');
    fireEvent.click(screen.getByRole('checkbox'));
  }

  it('rejects mismatched passwords', async () => {
    const post = vi.spyOn(api, 'post');
    renderRoutes(routes, '/register');

    fillValidForm();
    type('Şifre Tekrarı', 'Demo12345');
    fireEvent.click(screen.getByRole('button', { name: 'Hesap Oluştur' }));

    expect(await screen.findByText('Şifreler eşleşmiyor.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows a taken e-mail under the e-mail field', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError(409, 'EMAIL_TAKEN', 'Bu e-posta adresi zaten kayıtlı.', [
        { field: 'email', message: 'Bu e-posta adresi zaten kayıtlı.' },
      ]),
    );
    renderRoutes(routes, '/register');

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Hesap Oluştur' }));

    const fieldError = await screen.findByText('Bu e-posta adresi zaten kayıtlı.');
    expect(fieldError.closest('.ant-form-item')).toHaveTextContent('E-posta');
    expect(screen.queryByRole('alert', { name: /zaten kayıtlı/ })).not.toBeInTheDocument();
  });

  it('sends the invite code and shows its error under the invite code field', async () => {
    const message = 'Davet kodu geçersiz ya da süresi dolmuş. Mağazadan yeni bir kod isteyin.';
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValue(new ApiError(400, 'INVALID_INVITE_CODE', message, [{ field: 'invite_code', message }]));
    renderRoutes(routes, '/register');

    fillValidForm();
    type('Davet kodu (isteğe bağlı)', ' abcde-fgh23 ');
    fireEvent.click(screen.getByRole('button', { name: 'Hesap Oluştur' }));

    const fieldError = await screen.findByText(message);
    expect(fieldError.closest('.ant-form-item')).toHaveTextContent('Davet kodu');
    expect(post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ invite_code: 'abcde-fgh23' }));
  });

  it('shows the missing invite code error under the empty invite code field', async () => {
    const message =
      'Bu e-posta adresine ait bir müşteri kaydı var. Hesabınızı bağlamak için mağazadan aldığınız davet kodunu girin.';
    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError(400, 'INVITE_CODE_REQUIRED', message, [{ field: 'invite_code', message }]),
    );
    renderRoutes(routes, '/register');

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Hesap Oluştur' }));

    const fieldError = await screen.findByText(message);
    expect(fieldError.closest('.ant-form-item')).toHaveTextContent('Davet kodu');
  });

  it('opens the login page with the e-mail filled in after registering', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
    const { router } = renderRoutes(routes, '/register');

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Hesap Oluştur' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(post).toHaveBeenCalledWith('/auth/register', {
      full_name: 'Deniz Ak',
      email: 'Deniz@Example.com',
      password: 'Demo1234',
      phone: null,
      invite_code: null,
    });
    expect(await screen.findByText('Hesabınız oluşturuldu')).toBeInTheDocument();
    expect(screen.getByLabelText('E-posta')).toHaveValue('deniz@example.com');
  });
});
