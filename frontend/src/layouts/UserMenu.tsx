import { DownOutlined, KeyOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { roleLabels } from '@/utils/labels';

/** Ad ve soyadın baş harfleri (Türkçe büyük harfle): "ilkay Yılmaz" → "İY" */
function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((part) => part.charAt(0).toLocaleUpperCase('tr-TR')).join('');
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const onClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      // Giriş ekranına yönlendirmeyi RequireAuth yapar.
      void logout();
    } else {
      navigate(key);
    }
  };

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
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
      {/* Gerçek düğme: Tab ile odaklanır, Enter/Boşluk menüyü açar. Dar ekranda yalnızca baş harfler kalır. */}
      <Button type="text" aria-label="Kullanıcı menüsü" className="user-button">
        <span className="user-button__avatar" aria-hidden="true">
          {initials(user.full_name)}
        </span>
        <span className="user-button__text">
          <span className="user-button__name hide-below-sm">{user.full_name}</span>
          <span className="user-button__role hide-below-sm">{roleLabels[user.role]}</span>
        </span>
        <DownOutlined className="user-button__chevron" aria-hidden="true" />
      </Button>
    </Dropdown>
  );
}
