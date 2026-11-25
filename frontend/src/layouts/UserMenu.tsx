import { KeyOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Dropdown, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { RoleTag } from '@/components/StatusTag';

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const onClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      // Giriş ekranına yönlendirmeyi RequireAuth yapar.
      logout();
    } else {
      navigate(key);
    }
  };

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        onClick,
        items: [
          { key: '/profile', icon: <UserOutlined />, label: 'Profilim' },
          { key: '/profile/password', icon: <KeyOutlined />, label: 'Şifre Değiştir' },
          { type: 'divider' },
          { key: 'logout', icon: <LogoutOutlined />, label: 'Çıkış Yap', danger: true },
        ],
      }}
    >
      {/* Gerçek düğme: Tab ile odaklanır, Enter/Boşluk menüyü açar. Dar ekranda yalnızca baş harf kalır. */}
      <Button
        type="text"
        aria-label="Kullanıcı menüsü"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 'auto', padding: '4px 8px' }}
      >
        <Avatar size="small" style={{ backgroundColor: '#4F46E5' }}>
          {user.full_name.charAt(0).toLocaleUpperCase('tr-TR')}
        </Avatar>
        <Typography.Text className="hide-below-sm">{user.full_name}</Typography.Text>
        <span className="hide-below-sm">
          <RoleTag role={user.role} />
        </span>
      </Button>
    </Dropdown>
  );
}
