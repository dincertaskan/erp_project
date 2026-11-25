import { AxiosError, type AxiosAdapter } from 'axios';
import { api, ApiError } from './client';

const originalAdapter = api.defaults.adapter;

function respondWithBlob(status: number, body: Blob) {
  const adapter: AxiosAdapter = async (config) => {
    const response = { data: body, status, statusText: '', headers: {}, config };
    throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response);
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
});

describe('api client with file downloads', () => {
  it('reads the error body of a blob response', async () => {
    const body = { code: 'VALIDATION_ERROR', message: 'Tarih aralığı en fazla 1 yıl olabilir.', details: [] };
    respondWithBlob(422, new Blob([JSON.stringify(body)], { type: 'application/json' }));

    const error = await caught(api.get('/reports/sales', { responseType: 'blob' }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Tarih aralığı en fazla 1 yıl olabilir.',
    });
    expect(error.details).toEqual([]);
  });

  it('falls back to the generic message when the blob is not JSON', async () => {
    respondWithBlob(500, new Blob(['<html>Internal Server Error</html>'], { type: 'text/html' }));

    const error = await caught(api.get('/reports/sales', { responseType: 'blob' }));

    expect(error).toMatchObject({ status: 500, code: 'ERROR', message: 'İşlem sırasında bir hata oluştu.' });
  });
});
