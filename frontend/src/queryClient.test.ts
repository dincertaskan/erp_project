import { ApiError } from '@/api/client';
import { createQueryClient } from './queryClient';

type RetryFn = (failureCount: number, error: unknown) => boolean;

const retry = createQueryClient().getDefaultOptions().queries?.retry as RetryFn;

describe('createQueryClient', () => {
  it('does not retry client errors', () => {
    expect(retry(0, new ApiError(404, 'NOT_FOUND', 'Bulunamadı.'))).toBe(false);
    expect(retry(0, new ApiError(403, 'FORBIDDEN', 'Yetkisiz.'))).toBe(false);
  });

  it('retries network and server errors once', () => {
    expect(retry(0, new ApiError(0, 'NETWORK_ERROR', 'Sunucuya ulaşılamıyor.'))).toBe(true);
    expect(retry(0, new ApiError(503, 'ERROR', 'Hata'))).toBe(true);
    expect(retry(1, new ApiError(503, 'ERROR', 'Hata'))).toBe(false);
    expect(retry(0, new Error('beklenmeyen'))).toBe(true);
  });

  it('does not refetch on window focus', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });
});
