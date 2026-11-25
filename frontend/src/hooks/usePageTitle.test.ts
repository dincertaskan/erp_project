import { renderHook } from '@testing-library/react';
import { APP_NAME, usePageTitle } from './usePageTitle';

describe('usePageTitle', () => {
  beforeEach(() => {
    document.title = APP_NAME;
  });

  it('sets the page name before the app name', () => {
    renderHook(() => usePageTitle('Ürünler'));

    expect(document.title).toBe('Ürünler · Akıllı ERP');
  });

  it('follows title changes and restores the previous title on unmount', () => {
    const { rerender, unmount } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: 'Ürün Detayı' },
    });
    rerender({ title: 'Kablosuz Mouse' });
    expect(document.title).toBe('Kablosuz Mouse · Akıllı ERP');

    unmount();
    expect(document.title).toBe(APP_NAME);
  });

  it('falls back to the app name for an empty title', () => {
    renderHook(() => usePageTitle(''));

    expect(document.title).toBe(APP_NAME);
  });
});
