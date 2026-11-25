import { Button, Result } from 'antd';
import { useRouteError } from 'react-router-dom';
import { colors } from '@/theme';
import { usePageTitle } from '@/hooks/usePageTitle';

/** Sayfa yüklenemediğinde (ör. sürüm güncellendikten sonra eski parça istenirse) gösterilir. */
export function RouteError() {
  usePageTitle('Sayfa yüklenemedi');
  const error = useRouteError();
  const chunkFailed =
    error instanceof TypeError && /dynamically imported module|Importing a module script/i.test(error.message);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.pageBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Result
        status="error"
        title="Sayfa yüklenemedi"
        subTitle={
          chunkFailed
            ? 'Uygulama güncellenmiş olabilir. Sayfayı yenileyip tekrar deneyin.'
            : 'Beklenmeyen bir hata oluştu. Sayfayı yenileyip tekrar deneyin.'
        }
        extra={
          <Button type="primary" onClick={() => window.location.reload()}>
            Sayfayı Yenile
          </Button>
        }
      />
    </div>
  );
}
