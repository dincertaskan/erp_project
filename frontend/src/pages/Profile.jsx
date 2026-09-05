import { User, Mail, ShieldCheck, Calendar } from 'lucide-react';

export default function Profile() {
  const userName = localStorage.getItem('user_name') || 'Kullanıcı';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Profil Detayları</h1>
        <p className="text-sm text-gray-500">Hesap bilgilerinizi ve yetkilerinizi inceleyin.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-6">
        <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-2xl">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">{userName}</h2>
            <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-semibold">
              Sistem Yöneticisi
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <Mail className="text-gray-400" size={20} />
            <div>
              <p className="text-xs text-gray-400">E-posta / Durum</p>
              <p className="text-sm font-medium text-gray-700">Aktif Kullanıcı</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <ShieldCheck className="text-emerald-500" size={20} />
            <div>
              <p className="text-xs text-gray-400">Erişim Seviyesi</p>
              <p className="text-sm font-medium text-gray-700">Tam Yetkili (Admin)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}