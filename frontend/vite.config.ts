/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: true,
      proxy: {
        // Önyüz API'yi /api altından çağırır; geliştirme sunucusu istekleri arka uca iletir.
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
          changeOrigin: true,
          // Tarayıcının (ör. telefonun) adresi X-Forwarded-For ile iletilir; arka ucun IP bazlı kayıt sınırı
          // aksi halde tüm istemcileri geliştirme sunucusunun adresinden gelmiş sayar.
          xfwd: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      coverage: {
        provider: 'v8',
        reporter: ['text-summary', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
        // Mevcut kapsamın birkaç puan altında; kapsam düşerse npm run test:coverage hata verir.
        thresholds: { lines: 70, statements: 70, branches: 63, functions: 57 },
      },
    },
  };
});
