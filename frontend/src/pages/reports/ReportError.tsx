import { Alert, Button } from 'antd';
import { errorMessage } from '@/api/client';

/** Rapor alınamadığında boş tablo ("kayıt yok") yerine hata ve tekrar deneme gösterilir. */
export function ReportError({ error, onRetry, retrying }: { error: unknown; onRetry: () => void; retrying?: boolean }) {
  return (
    <Alert
      type="error"
      showIcon
      message="Rapor yüklenemedi"
      description={errorMessage(error)}
      action={
        <Button size="small" onClick={onRetry} loading={retrying}>
          Tekrar Dene
        </Button>
      }
    />
  );
}
