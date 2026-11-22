import { KeyOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Dropdown, Space, Typography } from 'antd';
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
      <Space style={{ cursor: 'pointer' }} size={8}>
        <Avatar size="small" style={{ backgroundColor: '#4F46E5' }}>
          {user.full_name.charAt(0).toLocaleUpperCase('tr-TR')}
        </Avatar>
        <Typography.Text>{user.full_name}</Typography.Text>
        <RoleTag role={user.role} />
      </Space>
    </Dropdown>
  );
}
