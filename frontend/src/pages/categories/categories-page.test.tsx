import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { Category } from '@/api/types';
import { renderRoutes } from '@/test/render';
import { CategoriesPage } from './CategoriesPage';

const electronics: Category = {
  id: 1,
  name: 'Elektronik',
  color: '#6366F1',
  is_active: true,
  created_at: '2026-11-01T10:00:00Z',
  product_count: 12,
};

const garden: Category = {
  id: 2,
  name: 'Bahçe',
  color: '#10B981',
  is_active: false,
  created_at: '2026-11-02T10:00:00Z',
  product_count: 0,
};

function mockGet(categories: Category[] = [electronics, garden]) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/categories') return { data: categories };
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderRoutes([{ path: '/categories', element: <CategoriesPage /> }], '/categories');
}

async function rowOf(name: string) {
  return (await screen.findByText(name)).closest('tr') as HTMLElement;
}

async function openNewForm() {
  fireEvent.click(await screen.findByRole('button', { name: /Yeni Kategori/ }));
  return (await screen.findByRole('dialog')) as HTMLElement;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CategoriesPage list', () => {
  it('lists categories with product counts, status and the page title', async () => {
    mockGet();
    renderPage();

    const row = await rowOf('Elektronik');
    expect(within(row).getByText('12')).toBeInTheDocument();
    expect(within(row).getByText('Aktif')).toBeInTheDocument();
    expect(within(row).getByText('01.11.2026')).toBeInTheDocument();
    expect(within(await rowOf('Bahçe')).getByText('Pasif')).toBeInTheDocument();
    expect(document.title).toBe('Kategoriler · Akıllı ERP');
  });

  it('shows an empty state', async () => {
    mockGet([]);
    renderPage();

    expect(await screen.findByText('Henüz kategori yok.')).toBeInTheDocument();
  });

  it('explains that an empty category only stops new products', async () => {
    mockGet([{ ...electronics, product_count: 0 }]);
    renderPage();

    fireEvent.click(within(await rowOf('Elektronik')).getByRole('button', { name: 'Pasife Al' }));

    expect(await screen.findByText('Pasif kategoriye yeni ürün eklenemez.')).toBeInTheDocument();
  });

  it('deactivates after confirmation and reloads the list', async () => {
    const get = mockGet();
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
    renderPage();

    fireEvent.click(within(await rowOf('Elektronik')).getByRole('button', { name: 'Pasife Al' }));
    const popup = (await screen.findByText('Kategori pasife alınsın mı?')).closest('.ant-popover') as HTMLElement;
    fireEvent.click(within(popup).getByRole('button', { name: 'Pasife Al' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/categories/1/status', { is_active: false }));
    expect(await screen.findByText('Kategori pasife alındı.')).toBeInTheDocument();
    await waitFor(() => expect(get.mock.calls.filter(([url]) => url === '/categories').length).toBeGreaterThan(1));
  });

  it('activates an inactive category', async () => {
    mockGet();
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
    renderPage();

    fireEvent.click(within(await rowOf('Bahçe')).getByRole('button', { name: 'Aktifleştir' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/categories/2/status', { is_active: true }));
    expect(await screen.findByText('Kategori aktifleştirildi.')).toBeInTheDocument();
  });

  it('shows the server message when the status change fails', async () => {
    mockGet();
    vi.spyOn(api, 'patch').mockRejectedValue(new ApiError(500, 'ERROR', 'İşlem tamamlanamadı.'));
    renderPage();

    fireEvent.click(within(await rowOf('Bahçe')).getByRole('button', { name: 'Aktifleştir' }));

    expect(await screen.findByText('İşlem tamamlanamadı.')).toBeInTheDocument();
  });
});

describe('CategoriesPage form', () => {
  it('requires a name', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post');
    renderPage();

    const dialog = await openNewForm();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    expect(await within(dialog).findByText('Kategori adı zorunludur.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('enforces the name length limits', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post');
    renderPage();

    const dialog = await openNewForm();
    const name = within(dialog).getByLabelText('Kategori Adı');
    fireEvent.change(name, { target: { value: 'A' } });
    expect(await within(dialog).findByText('Kategori adı en az 2 karakter olmalıdır.')).toBeInTheDocument();

    fireEvent.change(name, { target: { value: 'x'.repeat(101) } });
    expect(await within(dialog).findByText('Kategori adı en fazla 100 karakter olabilir.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('creates a category with the default colour', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
    renderPage();

    const dialog = await openNewForm();
    expect(within(dialog).getByText('Yeni Kategori')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Kategori Adı'), { target: { value: 'Kırtasiye' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/categories', { name: 'Kırtasiye', color: '#2563EB', is_active: true }),
    );
    expect(await screen.findByText('Kategori kaydedildi.')).toBeInTheDocument();
  });

  it('edits an existing category with its values filled in', async () => {
    mockGet();
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: {} });
    renderPage();

    fireEvent.click(within(await rowOf('Elektronik')).getByRole('button', { name: 'Düzenle' }));
    const dialog = (await screen.findByRole('dialog')) as HTMLElement;

    expect(within(dialog).getByText('Kategoriyi Düzenle')).toBeInTheDocument();
    expect(within(dialog).getByText('Bu kategoride 12 aktif ürün var.')).toBeInTheDocument();
    const name = within(dialog).getByLabelText('Kategori Adı');
    expect(name).toHaveValue('Elektronik');
    fireEvent.change(name, { target: { value: 'Elektronik Ürünler' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/categories/1', expect.objectContaining({ name: 'Elektronik Ürünler' })),
    );
  });

  it('shows a taken name under the name field', async () => {
    mockGet();
    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError(409, 'CATEGORY_EXISTS', 'Bu adla bir kategori var.', [
        { field: 'name', message: 'Bu adla bir kategori var.' },
      ]),
    );
    renderPage();

    const dialog = await openNewForm();
    fireEvent.change(within(dialog).getByLabelText('Kategori Adı'), { target: { value: 'Elektronik' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    const error = await within(dialog).findByText('Bu adla bir kategori var.');
    expect(error.closest('.ant-form-item')).toHaveTextContent('Kategori Adı');
  });

  it('offers "Vazgeç" to leave without saving', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post');
    renderPage();

    const dialog = await openNewForm();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));

    expect(post).not.toHaveBeenCalled();
  });
});
