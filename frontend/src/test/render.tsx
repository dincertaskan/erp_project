import { ProConfigProvider, trTRIntl } from '@ant-design/pro-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { App as AntApp, ConfigProvider } from 'antd';
import trTR from 'antd/locale/tr_TR';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';

/** Sayfaları gerçek yönlendirici ve sağlayıcılarla test etmek için */
export function renderRoutes(routes: RouteObject[], initialEntry: string | { pathname: string; state?: unknown }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={trTR}>
        <ProConfigProvider intl={trTRIntl}>
          <AntApp>
            <RouterProvider router={router} />
          </AntApp>
        </ProConfigProvider>
      </ConfigProvider>
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}
