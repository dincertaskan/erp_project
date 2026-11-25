import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Testing Library, globals açık olduğunda her testten sonra DOM'u kendisi temizler.
afterEach(() => {
  localStorage.clear();
});

// ProLayout menüsü daralma durumunu 400 ms'lik bir zamanlayıcıyla günceller. Dosya bitmeden bu
// zamanlayıcıların çalışmasını beklemezsek jsdom kapandıktan sonra "window is not defined" hatası verir.
afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 450));
});

// Ant Design bileşenlerinin jsdom'da ihtiyaç duyduğu tarayıcı API'leri
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
