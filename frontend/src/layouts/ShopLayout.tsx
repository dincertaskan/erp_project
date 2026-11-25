import { ShoppingCartOutlined } from '@ant-design/icons';
import { Badge } from 'antd';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useCart } from '@/cart/useCart';
import { LoadingIndicator } from './LoadingIndicator';
import { Logo } from './Logo';
import { UserMenu } from './UserMenu';

/** Sayfa kaydırıldığında üst çubuğa yarı saydam zemin ve gölge verilir */
function useScrolled(offset = 4) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [offset]);
  return scrolled;
}

/** Müşteri arayüzü: sol menü yok, mağaza tipi üst çubuk */
export function ShopLayout() {
  const { pathname } = useLocation();
  const { count: cartCount } = useCart();
  const scrolled = useScrolled();
  // Sepet ve profil menüde olmadığı için hiçbir öğe seçili görünmez.
  const selected = pathname.startsWith('/shop/orders')
    ? '/shop/orders'
    : pathname === '/shop' || pathname.startsWith('/shop/products')
      ? '/shop'
      : undefined;
  const navItems = [
    { to: '/shop', label: 'Ürünler' },
    { to: '/shop/orders', label: 'Siparişlerim' },
  ];

  return (
    <div className="shop-shell">
      <LoadingIndicator />
      {/* İç boşluk ve aralıklar styles.css'te: sm altında daralır */}
      <header className={scrolled ? 'shop-header is-scrolled' : 'shop-header'}>
        <Link to="/shop" className="brand-link">
          <Logo variant="shop" />
        </Link>
        <nav aria-label="Mağaza menüsü" className="shop-nav">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="shop-nav__link"
              aria-current={selected === item.to ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="shop-header-actions">
          <Link to="/shop/cart" aria-label="Sepet" className="icon-link">
            <Badge count={cartCount} size="small">
              <ShoppingCartOutlined style={{ fontSize: 20 }} />
            </Badge>
          </Link>
          <UserMenu />
        </div>
      </header>
      <main className="shop-content">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <footer className="shop-footer">Akıllı ERP · Demo mağaza · Veriler Olist açık veri setinden alınmıştır</footer>
    </div>
  );
}
