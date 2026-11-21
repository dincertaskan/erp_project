import { ProLayout } from '@ant-design/pro-components';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { layoutToken } from '@/theme';
import { LogoMark } from './Logo';
import { UserMenu } from './UserMenu';
import { adminNavigation, navigationForRole } from './navigation';

/** Yönetici ve depo personeli için sol menülü düzen */
export function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return null;

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
      route={{ path: '/', routes: navigationForRole(adminNavigation, user.role) }}
      menuItemRender={(item, dom) => (item.path ? <Link to={item.path}>{dom}</Link> : dom)}
      actionsRender={() => [<UserMenu key="user" />]}
      menu={{ defaultOpenAll: true }}
      contentStyle={{ padding: 24 }}
    >
      <Outlet />
    </ProLayout>
  );
}
