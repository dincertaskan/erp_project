import { ProConfigProvider, trTRIntl } from '@ant-design/pro-components';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import trTR from 'antd/locale/tr_TR';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/auth/AuthProvider';
import { theme } from '@/theme';

dayjs.locale('tr');

export function AppProviders({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={trTR} theme={theme}>
        {/* ProComponents dili antd'nin "tr" kodundan bulamıyor; Türkçe metinler açıkça verilir. */}
        <ProConfigProvider intl={trTRIntl}>
          <AntApp>
            <AuthProvider>{children}</AuthProvider>
          </AntApp>
        </ProConfigProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
