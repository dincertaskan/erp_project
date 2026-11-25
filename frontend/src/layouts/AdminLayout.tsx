import { MenuOutlined } from '@ant-design/icons';
import { Button, Drawer } from 'antd';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useCriticalCount } from '@/api/stock';
import { homePathByRole } from '@/auth/roles';
import { useAuth } from '@/auth/useAuth';
import { LoadingIndicator } from './LoadingIndicator';
import { Logo } from './Logo';
import { SideNav } from './SideNav';
import { UserMenu } from './UserMenu';
import { adminNavigation, navigationForRole, selectedMenuKey } from './navigation';

/** Yönetici ve depo personeli için üst çubuklu, gruplu sol menülü düzen */
export function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: criticalCount = 0 } = useCriticalCount(Boolean(user));
  if (!user) return null;
  const groups = navigationForRole(adminNavigation, user.role);
  const selectedKey = selectedMenuKey(groups, location.pathname);
  const nav = (onNavigate?: () => void) => (
    <SideNav groups={groups} selectedKey={selectedKey} criticalCount={criticalCount} onNavigate={onNavigate} />
  );

  return (
    <div className="app-shell">
      <LoadingIndicator />
      <header className="app-topbar">
        {/* lg altında yan menü gizlenir; aynı menü çekmecede açılır */}
        <Button
          type="text"
          className="app-topbar__menu-button"
          icon={<MenuOutlined />}
          aria-label="Menüyü aç"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        />
        <Link to={homePathByRole[user.role]} className="brand-link">
          <Logo />
        </Link>
        <div className="app-topbar__actions">
          <UserMenu />
        </div>
      </header>
      <div className="app-body">
        <aside className="app-sider">{nav()}</aside>
        <main className="app-content">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
      <Drawer
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={288}
        title={<Logo compact />}
        className="app-drawer"
        styles={{ body: { padding: 12 } }}
      >
        {nav(() => setDrawerOpen(false))}
      </Drawer>
    </div>
  );
}
