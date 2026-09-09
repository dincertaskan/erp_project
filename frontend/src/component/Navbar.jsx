import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, LogOut, Bell, Check, ExternalLink } from 'lucide-react';

export default function Navbar({ notifications, setNotifications }) {
  const navigate = useNavigate();
  const userName = localStorage.getItem('user_name') || 'Kullanıcı';

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Yeniden eskiye sıralama yapıyoruz
  const sortedNotifications = [...notifications].sort((a, b) => new Date(b.date) - new Date(a.date));
  const recentNotifications = sortedNotifications.slice(0, 5);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_name');
    navigate('/login');
  };

  const handleMarkAsRead = (id) => {
    setNotifications(prev => prev.filter(item => item.id !== id));
  };

  return (
    <nav className="h-16 bg-white border-b border-gray-200 px-8 flex justify-between items-center shrink-0 relative">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-gray-800">Hoş Geldiniz</h1>
      </div>
      
      <div className="flex items-center gap-4">
        
        {/* BİLDİRİMLER ALANI */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="relative text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition cursor-pointer"
          >
            <Bell size={20} />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg py-3 z-50">
              <div className="px-4 pb-2 border-b border-gray-100 flex justify-between items-center">
                <span className="font-bold text-sm text-gray-800">Bildirimler</span>
                <span className="text-xs text-gray-400">{notifications.length} Adet</span>
              </div>

              <div className="max-h-72 overflow-y-auto p-2">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    Şu an hiç bildirim bulunmamaktadır.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {recentNotifications.map((item) => (
                      <li key={item.id} className="text-xs text-gray-600 p-2.5 hover:bg-gray-50 rounded-lg flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-700">{item.text}</p>
                          <span className="text-[10px] text-gray-400">{item.date}</span>
                        </div>
                        <button 
                          onClick={() => handleMarkAsRead(item.id)}
                          title="Okundu olarak sil"
                          className="text-gray-400 hover:text-emerald-600 p-1 hover:bg-emerald-50 rounded transition"
                        >
                          <Check size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {notifications.length > 5 && (
                <div className="pt-2 px-2 border-t border-gray-100">
                  <Link 
                    to="/notifications" 
                    onClick={() => setShowNotifications(false)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 font-semibold rounded-lg transition"
                  >
                    Tüm Bildirimleri Gör ({notifications.length})
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-6 w-[1px] bg-gray-200"></div>

        {/* KULLANICI PROFİL ALANI */}
        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 text-gray-700 text-sm font-semibold bg-indigo-50/60 hover:bg-indigo-100/80 px-3.5 py-1.5 rounded-full transition cursor-pointer"
          >
            <div className="bg-indigo-100 p-1 rounded-full text-indigo-600">
              <User size={18} />
            </div>
            <span>{userName}</span>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-60 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-50">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-800 leading-tight">{userName}</p>
                <p className="text-xs text-gray-400">Sistem Yöneticisi</p>
              </div>

              <div className="pt-1">
                <Link 
                  to="/profile"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 font-medium rounded-lg transition"
                >
                  <span>Profili Gör</span>
                  <ExternalLink size={14} />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ÇIKIŞ YAP */}
        <button 
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer ml-1"
        >
          <LogOut size={16} />
          Çıkış Yap
        </button>

      </div>
    </nav>
  );
}