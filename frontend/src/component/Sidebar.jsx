import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Settings 
} from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();

  const menuItems = [
    { name: 'Ana Sayfa', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Stok Yönetimi', path: '/inventory', icon: Package },
    { name: 'Satış & Sipariş', path: '/sales', icon: ShoppingCart },
    { name: 'Müşteriler', path: '/customers', icon: Users },
    { name: 'Raporlar', path: '/reports', icon: TrendingUp },
    { name: 'Ayarlar', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen flex flex-col border-r border-slate-800">
      
      <div className="h-16 px-5 border-b border-slate-800 flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center text-white text-xs font-extrabold tracking-wider">
          ERP
        </div>
        <span className="text-sm font-bold text-white tracking-wide">
          Yönetim Paneli
        </span>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}