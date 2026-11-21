import { Card, Grid, Typography } from 'antd';
import type { ReactNode } from 'react';
import { LogoMark } from '@/layouts/Logo';
import { colors } from '@/theme';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Kartın üstünde gösterilen bilgi (ör. oturum süresi doldu) */
  notice?: ReactNode;
}

/** Giriş ve kayıt ekranları: solda düz tanıtım paneli, sağda form kartı */
export function AuthLayout({ title, subtitle, children, notice }: AuthLayoutProps) {
  const screens = Grid.useBreakpoint();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: colors.pageBg }}>
      {screens.lg ? (
        <aside
          style={{
            width: '45%',
            background: colors.sider,
            color: '#FFFFFF',
            padding: 48,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LogoMark size={36} />
            <span style={{ fontSize: 20, fontWeight: 600 }}>Akıllı ERP</span>
          </div>
          <div style={{ maxWidth: 420 }}>
            <h2 style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 600, margin: '0 0 12px' }}>
              Sipariş, stok ve müşteri yönetimi tek yerde
            </h2>
            <p style={{ color: colors.siderText, fontSize: 15, margin: 0 }}>
              Ürünleri, stok hareketlerini ve siparişleri tek panelden takip edin.
            </p>
          </div>
          <span style={{ color: '#64748B', fontSize: 13 }}>© 2026 Akıllı ERP</span>
        </aside>
      ) : null}

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {notice}
          <Card styles={{ body: { padding: 32 } }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <LogoMark size={44} />
              <Typography.Title level={3} style={{ margin: '16px 0 4px' }}>
                {title}
              </Typography.Title>
              <Typography.Text type="secondary">{subtitle}</Typography.Text>
            </div>
            {children}
          </Card>
        </div>
      </main>
    </div>
  );
}
