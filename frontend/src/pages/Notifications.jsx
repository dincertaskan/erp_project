import { Bell, Check, Trash2 } from 'lucide-react';

export default function Notifications({ notifications, setNotifications }) {
  const handleMarkAsRead = (id) => {
    setNotifications(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bildirimler</h1>
          <p className="text-sm text-gray-500">Sistem güncellemeleri ve geçmiş bildirimleriniz.</p>
        </div>
        {notifications.length > 0 && (
          <button 
            onClick={handleClearAll}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition"
          >
            <Trash2 size={14} /> Tümünü Temizle
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 border border-gray-200 shadow-xs flex flex-col items-center gap-3">
          <Bell size={40} className="text-gray-300" />
          <p className="text-sm font-medium">Şu an hiç bildirim bulunmamaktadır.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 divide-y divide-gray-100">
          {notifications.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-800">{item.text}</p>
                <p className="text-xs text-gray-400">{item.date}</p>
              </div>
              <button 
                onClick={() => handleMarkAsRead(item.id)}
                title="Okundu olarak işaretle ve sil"
                className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
              >
                <Check size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}