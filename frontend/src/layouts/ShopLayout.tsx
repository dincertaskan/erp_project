import { ShoppingCartOutlined } from '@ant-design/icons';
import { Badge, Layout, Menu, Typography } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useCart } from '@/cart/useCart';
import { colors } from '@/theme';
import { LogoMark } from './Logo';
import { UserMenu } from './UserMenu';

const navItems = [
  { key: '/shop', label: <Link to="/shop">Ürünler</Link> },
  { key: '/shop/orders', label: <Link to="/shop/orders">Siparişlerim</Link> },
];

/** Müşteri arayüzü: sol menü yok, mağaza tipi üst çubuk */
export function ShopLayout() {
  const location = useLocation();
  const { count: cartCount } = useCart();
  const { pathname } = location;
  // Sepet ve profil menüde olmadığı için hiçbir öğe seçili görünmez.
  const selected = pathname.startsWith('/shop/orders')
    ? ['/shop/orders']
    : pathname === '/shop' || pathname.startsWith('/shop/products')
      ? ['/shop']
      : [];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* İç boşluk ve aralıklar styles.css'te: sm altında daralır */}
      <Layout.Header
        className="shop-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          height: 56,
          lineHeight: '56px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Link to="/shop" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoMark />
          <Typography.Text strong>Akıllı ERP</Typography.Text>
        </Link>
        <Menu
          mode="horizontal"
          selectedKeys={selected}
          items={navItems}
          style={{ flex: 1, borderBottom: 'none', minWidth: 0 }}
        />
        <div className="shop-header-actions">
          <Link to="/shop/cart" aria-label="Sepet">
            <Badge count={cartCount} size="small">
              <ShoppingCartOutlined style={{ fontSize: 20, color: colors.text }} />
            </Badge>
          </Link>
          <UserMenu />
        </div>
      </Layout.Header>
      <Layout.Content style={{ padding: 24, width: '100%', maxWidth: 1200, margin: '0 auto' }}>
        <Outlet />
      </Layout.Content>
      <Layout.Footer style={{ textAlign: 'center', color: colors.textSubtle }}>
        Akıllı ERP · Demo mağaza · Veriler Olist açık veri setinden alınmıştır
      </Layout.Footer>
    </Layout>
  );
}
