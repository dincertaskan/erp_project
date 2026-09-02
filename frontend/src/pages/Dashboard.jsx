import { useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-sm flex items-center justify-between border">
        <div className="flex items-center gap-3 text-indigo-600 font-bold text-xl">
          <LayoutDashboard size={28} /> ERP Yönetim Paneli
        </div>
        <button 
          onClick={handleLogout} 
          className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition text-sm font-semibold"
        >
          <LogOut size={18} /> Çıkış Yap
        </button>
      </div>
    </div>
  );
}