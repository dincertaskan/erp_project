import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'erp.token';
export const AUTH_EXPIRED_EVENT = 'erp:auth-expired';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export interface FieldError {
  field: string;
  message: string;
}

/** Arka ucun ortak hata biçimi: { code, message, details } */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get fieldErrors(): FieldError[] {
    return Array.isArray(this.details) ? (this.details as FieldError[]) : [];
  }
}

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ code?: string; message?: string; details?: unknown }>) => {
    if (!error.response) {
      return Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'Sunucuya ulaşılamıyor.'));
    }
    const { status, data, config } = error.response;
    const sentToken = Boolean(config.headers?.Authorization);
    if (status === 401 && sentToken) {
      tokenStorage.clear();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(
      new ApiError(status, data?.code ?? 'ERROR', data?.message ?? 'İşlem sırasında bir hata oluştu.', data?.details),
    );
  },
);

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'İşlem sırasında bir hata oluştu.';
}
