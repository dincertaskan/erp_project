import { Bell } from 'lucide-react';

export default function Header({ pendingOrderCount = 0 }) {
  const userName = localStorage.getItem('user_name') || 'Dinçer Taşkan';

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex justify-between items-center shrink-0">
      <h2 className="text-lg font-bold text-gray-800">Hoş Geldiniz</h2>
      
      <div className="flex items-center gap-4">
        {/* BİLDİRİM ZİLİ VE CANLI BİLDİRİM ROZETİ */}
        <div className="relative">
          <button 
            className="p-2 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-gray-50 transition cursor-pointer relative"
            title="Bildirimler"
          >
            <Bell size={20} />
            {pendingOrderCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {pendingOrderCount}
              </span>
            )}
          </button>
        </div>

        {/* KULLANICI PROFİL ALANI */}
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
            {userName.charAt(0)}
          </div>
          <span className="text-xs font-semibold text-gray-700">{userName}</span>
        </div>
      </div>
    </header>
  );
}