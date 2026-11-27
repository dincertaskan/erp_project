import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { api, AUTH_EXPIRED_EVENT, tokenStorage } from '@/api/client';
import type { CatalogProduct } from '@/api/shop';
import type { CurrentUser } from '@/api/types';
import { cartStore } from '@/cart/cartStore';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

const admin: CurrentUser = {
  id: 1,
  full_name: 'Elif Yılmaz',
  email: 'yonetici@example.com',
  role: 'admin',
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  last_login_at: null,
  customer: null,
};

function Probe() {
  const { user, isLoading, sessionExpired, signedOut, login, logout } = useAuth();
  return (
    <div>
      <p>kullanıcı: {isLoading ? 'yükleniyor' : (user?.full_name ?? 'yok')}</p>
      <p>süre doldu: {String(sessionExpired)}</p>
      <p>çıkış: {String(signedOut)}</p>
      <button onClick={() => void login('yonetici@example.com', 'Demo1234')}>giriş</button>
      <button onClick={() => void logout()}>çıkış yap</button>
    </div>
  );
}

function renderProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('AuthProvider', () => {
  it('has no user and does not call the API without a token', () => {
    const get = vi.spyOn(api, 'get');

    renderProvider();

    expect(screen.getByText('kullanıcı: yok')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('loads the current user when a token is stored', async () => {
    tokenStorage.set('abc');
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: admin });

    renderProvider();

    expect(screen.getByText('kullanıcı: yükleniyor')).toBeInTheDocument();
    expect(await screen.findByText('kullanıcı: Elif Yılmaz')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/auth/me');
  });

  it('stores the token on login and uses the returned user without another request', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { access_token: 'new-token', token_type: 'bearer', user: admin },
    });
    const get = vi.spyOn(api, 'get');
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'giriş' }));

    expect(await screen.findByText('kullanıcı: Elif Yılmaz')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'yonetici@example.com', password: 'Demo1234' });
    expect(tokenStorage.get()).toBe('new-token');
    expect(get).not.toHaveBeenCalled();
  });

  it('clears the token and every cart on logout', async () => {
    tokenStorage.set('abc');
    vi.spyOn(api, 'get').mockResolvedValue({ data: admin });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: null });
    cartStore.add(9, { id: 7, sale_price: '1.00', available_qty: 1 } as CatalogProduct, 1);
    renderProvider();
    await screen.findByText('kullanıcı: Elif Yılmaz');

    fireEvent.click(screen.getByRole('button', { name: 'çıkış yap' }));

    expect(await screen.findByText('kullanıcı: yok')).toBeInTheDocument();
    expect(screen.getByText('çıkış: true')).toBeInTheDocument();
    expect(screen.getByText('süre doldu: false')).toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
    expect(cartStore.get(9)).toEqual([]);
    expect(post).toHaveBeenCalledWith('/auth/logout');
  });

  it('still signs out locally when the server cannot be reached', async () => {
    tokenStorage.set('abc');
    vi.spyOn(api, 'get').mockResolvedValue({ data: admin });
    vi.spyOn(api, 'post').mockRejectedValue(new Error('ağ hatası'));
    renderProvider();
    await screen.findByText('kullanıcı: Elif Yılmaz');

    fireEvent.click(screen.getByRole('button', { name: 'çıkış yap' }));

    expect(await screen.findByText('kullanıcı: yok')).toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
  });

  it('reports a sign-out, not an expired session, when the token was already revoked', async () => {
    tokenStorage.set('abc');
    vi.spyOn(api, 'get').mockResolvedValue({ data: admin });
    // İstemci katmanı 401'de süre doldu olayını yayar; çıkış bunu kullanıcının kendi çıkışı olarak sonlandırır.
    vi.spyOn(api, 'post').mockImplementation(async () => {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      throw new Error('401');
    });
    renderProvider();
    await screen.findByText('kullanıcı: Elif Yılmaz');

    fireEvent.click(screen.getByRole('button', { name: 'çıkış yap' }));

    expect(await screen.findByText('çıkış: true')).toBeInTheDocument();
    expect(screen.getByText('süre doldu: false')).toBeInTheDocument();
  });

  it('signs the user out and flags the session as expired on the expiry event', async () => {
    tokenStorage.set('abc');
    vi.spyOn(api, 'get').mockResolvedValue({ data: admin });
    renderProvider();
    await screen.findByText('kullanıcı: Elif Yılmaz');

    act(() => {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    });

    await waitFor(() => expect(screen.getByText('kullanıcı: yok')).toBeInTheDocument());
    expect(screen.getByText('süre doldu: true')).toBeInTheDocument();
    expect(screen.getByText('çıkış: false')).toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
  });
});

describe('useAuth', () => {
  it('fails loudly outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow('useAuth, AuthProvider içinde kullanılmalıdır.');
  });
});
