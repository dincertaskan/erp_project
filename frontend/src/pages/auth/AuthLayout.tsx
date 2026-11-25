import { Grid, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Logo } from '@/layouts/Logo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Kartın üstünde gösterilen bilgi (ör. oturum süresi doldu) */
  notice?: ReactNode;
}

/** Giriş ve kayıt ekranları: solda açık tanıtım paneli, ortada beyaz form kartı */
export function AuthLayout({ title, subtitle, children, notice }: AuthLayoutProps) {
  const screens = Grid.useBreakpoint();

  return (
    <div className="auth-shell">
      {screens.lg ? (
        <aside className="auth-aside">
          <span className="auth-aside__eyebrow">Akıllı ERP</span>
          <div style={{ maxWidth: 420 }}>
            <h2 className="auth-aside__title">Sipariş, stok ve müşteri yönetimi tek yerde</h2>
            <p className="auth-aside__text">Ürünleri, stok hareketlerini ve siparişleri tek panelden takip edin.</p>
          </div>
          <span className="auth-aside__footer">© 2026 Akıllı ERP</span>
        </aside>
      ) : null}

      <main className="auth-main">
        <div className="auth-column page-enter">
          {notice}
          <div className="auth-card">
            <div className="auth-card__head">
              <Logo />
              <Typography.Title level={3} className="auth-card__title">
                {title}
              </Typography.Title>
              <Typography.Text type="secondary">{subtitle}</Typography.Text>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
