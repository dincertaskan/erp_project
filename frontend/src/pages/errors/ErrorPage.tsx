import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { homePathByRole } from '@/auth/roles';
import { useAuth } from '@/auth/useAuth';
import { colors } from '@/theme';
import { usePageTitle } from '@/hooks/usePageTitle';

const content = {
  403: {
    title: 'Erişim yetkiniz yok',
    subTitle:
      'Bu sayfayı görüntülemek için yetkiniz bulunmuyor. Bir yanlışlık olduğunu düşünüyorsanız yöneticiyle iletişime geçin.',
  },
  404: {
    title: 'Sayfa bulunamadı',
    subTitle: 'Aradığınız sayfa taşınmış ya da kaldırılmış olabilir.',
  },
} as const;

/** E-05 Hata sayfaları (403 ve 404) */
export function ErrorPage({ status }: { status: 403 | 404 }) {
  usePageTitle(content[status].title);
  const { user } = useAuth();
  const navigate = useNavigate();
  const home = user ? homePathByRole[user.role] : '/login';

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
        icon={<span style={{ fontSize: 72, fontWeight: 700, lineHeight: 1, color: colors.primary }}>{status}</span>}
        title={content[status].title}
        subTitle={content[status].subTitle}
        extra={[
          <Button key="back" onClick={() => navigate(-1)}>
            Geri Dön
          </Button>,
          <Button key="home" type="primary" onClick={() => navigate(home, { replace: true })}>
            {user ? 'Ana Sayfaya Dön' : 'Giriş Yap'}
          </Button>,
        ]}
      />
    </div>
  );
}
