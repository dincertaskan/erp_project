import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { vi } from 'vitest';
import { api, ApiError, AUTH_EXPIRED_EVENT, errorMessage, tokenStorage } from './client';

const originalAdapter = api.defaults.adapter;
let lastConfig: InternalAxiosRequestConfig | null = null;

/** Gerçek ağ yerine verilen durum koduyla yanıt veren axios bağdaştırıcısı */
function respondWith(status: number, data: unknown = {}) {
  const adapter: AxiosAdapter = async (config) => {
    lastConfig = config;
    const response = { data, status, statusText: '', headers: {}, config };
    if (status >= 400) throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response);
    return response;
  };
  api.defaults.adapter = adapter;
}

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (err) {
    return err as ApiError;
  }
  throw new Error('istek başarısız olmalıydı');
}

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  lastConfig = null;
});

describe('api client', () => {
  it('sends the stored token as a bearer header', async () => {
    tokenStorage.set('abc123');
    respondWith(200, { ok: true });

    const { data } = await api.get('/auth/me');

    expect(data).toEqual({ ok: true });
    expect(lastConfig?.headers.Authorization).toBe('Bearer abc123');
    expect(lastConfig?.baseURL).toBe('/api');
  });

  it('sends no authorization header without a token', async () => {
    respondWith(200);

    await api.get('/shop/products');

    expect(lastConfig?.headers.Authorization).toBeUndefined();
  });

  it('turns the backend error body into an ApiError', async () => {
    respondWith(409, { code: 'INSUFFICIENT_STOCK', message: 'Stok yetersiz.', details: [{ product_id: 7 }] });

    const error = await caught(api.post('/orders/1/approve'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'INSUFFICIENT_STOCK', message: 'Stok yetersiz.' });
    expect(error.details).toEqual([{ product_id: 7 }]);
  });

  it('falls back to a generic Turkish message when the body is empty', async () => {
    respondWith(502, null);

    const error = await caught(api.get('/health'));

    expect(error).toMatchObject({ status: 502, code: 'ERROR', message: 'İşlem sırasında bir hata oluştu.' });
  });

  it('reports a network failure without a response', async () => {
    api.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config);
    };

    const error = await caught(api.get('/health'));

    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR', message: 'Sunucuya ulaşılamıyor.' });
  });

  it('ends the session when a signed-in request gets 401', async () => {
    tokenStorage.set('expired');
    const onExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    respondWith(401, { code: 'UNAUTHORIZED', message: 'Oturum süresi doldu.' });

    await caught(api.get('/auth/me'));

    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    expect(tokenStorage.get()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('does not treat a failed login (401 without token) as an expired session', async () => {
    const onExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    respondWith(401, { code: 'INVALID_CREDENTIALS', message: 'E-posta veya şifre hatalı.' });

    const error = await caught(api.post('/auth/login', {}));

    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    expect(error.message).toBe('E-posta veya şifre hatalı.');
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe('ApiError', () => {
  it('exposes field errors only when details is a list', () => {
    const fields = [{ field: 'email', message: 'Geçersiz e-posta.' }];

    expect(new ApiError(422, 'VALIDATION_ERROR', 'Hata', fields).fieldErrors).toEqual(fields);
    expect(new ApiError(422, 'VALIDATION_ERROR', 'Hata', { email: 'x' }).fieldErrors).toEqual([]);
    expect(new ApiError(422, 'VALIDATION_ERROR', 'Hata').fieldErrors).toEqual([]);
  });
});

describe('errorMessage', () => {
  it('uses the API message and hides unexpected errors', () => {
    expect(errorMessage(new ApiError(400, 'X', 'Kategori adı kullanılıyor.'))).toBe('Kategori adı kullanılıyor.');
    expect(errorMessage(new Error('TypeError: x is undefined'))).toBe('İşlem sırasında bir hata oluştu.');
  });
});
