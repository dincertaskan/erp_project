import { fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { api } from '@/api/client';
import type { AuthContextValue } from '@/auth/context';
import { renderRoutes } from '@/test/render';
import { StockMovementModal, type MovementProduct } from './StockMovementModal';

const auth: AuthContextValue = {
  user: null,
  isLoading: false,
  sessionExpired: false,
  signedOut: false,
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));

const product: MovementProduct = {
  id: 7,
  name: 'Kablosuz Mouse',
  sku: 'ELK-0001',
  stock: 12,
  min_stock: 10,
  image_url: null,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('StockMovementModal limits', () => {
  it('rejects quantities above the API limit of 1.000.000', async () => {
    const post = vi.spyOn(api, 'post');
    renderRoutes([{ path: '/', element: <StockMovementModal product={product} onClose={vi.fn()} /> }], '/');

    fireEvent.change(screen.getByLabelText('Miktar'), { target: { value: '1000001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByText('Miktar en fazla 1.000.000 olabilir.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('uses "Vazgeç" for closing without saving', () => {
    const onClose = vi.fn();
    renderRoutes([{ path: '/', element: <StockMovementModal product={product} onClose={onClose} /> }], '/');

    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));

    expect(onClose).toHaveBeenCalled();
  });
});
