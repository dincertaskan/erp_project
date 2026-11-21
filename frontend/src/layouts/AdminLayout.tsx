import { ProLayout } from '@ant-design/pro-components';
import { Badge } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useCriticalCount } from '@/api/stock';
import { useAuth } from '@/auth/useAuth';
import { layoutToken } from '@/theme';
import { LogoMark } from './Logo';
import { UserMenu } from './UserMenu';
import { adminNavigation, navigationForRole, selectedMenuKey } from './navigation';

/** Yönetici ve depo personeli için sol menülü düzen */
export function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const { data: criticalCount = 0 } = useCriticalCount(Boolean(user));
  if (!user) return null;
  const items = navigationForRole(adminNavigation, user.role);
  const selectedKey = selectedMenuKey(items, location.pathname);

  return (
    <ProLayout
      title="Akıllı ERP"
      logo={<LogoMark />}
      layout="mix"
      splitMenus={false}
      fixSiderbar
      fixedHeader
      siderWidth={208}
      token={layoutToken}
      location={{ pathname: location.pathname }}
      route={{ path: '/', routes: items }}
      // ProLayout yolları önek olarak eşler; seçili öğe ve breadcrumb sayfalar tarafından belirlenir.
      menuProps={{ selectedKeys: selectedKey ? [selectedKey] : [] }}
      breadcrumbRender={false}
      menuItemRender={(item, dom) => {
        if (!item.path) return dom;
        const badge = item.path === '/stock/critical' && criticalCount > 0;
        return (
          <Link to={item.path} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {dom}
            {badge ? <Badge count={criticalCount} size="small" title="Kritik stoktaki ürün sayısı" /> : null}
          </Link>
        );
      }}
      actionsRender={() => [<UserMenu key="user" />]}
      menu={{ defaultOpenAll: true }}
      contentStyle={{ padding: 24 }}
    >
      <Outlet />
    </ProLayout>
  );
}
