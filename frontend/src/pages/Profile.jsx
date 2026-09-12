import { useState, useRef, useEffect } from 'react';
import { Mail, ShieldCheck, Camera, Loader2 } from 'lucide-react';
import api from '../api/axios';

export default function Profile() {
  const userName = localStorage.getItem('user_name') || 'Kullanıcı';
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Sayfa açıldığında veritabanındaki avatar yolunu çekme
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const res = await api.get(`/auth/me?user_name=${userName}`);
        if (res.data.avatar_url) {
          setAvatarUrl(`http://localhost:8000${res.data.avatar_url}`);
        }
      } catch (err) {
        console.error("Profil resmi veritabanından alınamadı:", err);
      }
    };
    fetchUserProfile();
  }, [userName]);

  // Resim seçilince backend'e kaydetme
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await api.post(`/auth/upload-avatar?user_name=${userName}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const fullAvatarUrl = `http://localhost:8000${res.data.avatar_url}`;
      setAvatarUrl(fullAvatarUrl);

      // Navbar'ı anlık günceller
      window.dispatchEvent(new CustomEvent('profile_avatar_updated', { detail: fullAvatarUrl }));
    } catch (err) {
      console.error("Avatar yükleme hatası:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Profil Detayları</h1>
        <p className="text-sm text-gray-500">Hesap bilgilerinizi ve yetkilerinizi inceleyin.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-6">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />

        <div className="flex items-center gap-6 border-b border-gray-100 pb-6">
          <div 
            className="relative group cursor-pointer shrink-0" 
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-20 h-20 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-2xl overflow-hidden border-2 border-indigo-50 shadow-xs">
              {uploading ? (
                <Loader2 size={24} className="animate-spin text-indigo-600" />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Profil Fotoğrafı" className="w-full h-full object-cover" />
              ) : (
                <span>{userName.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition duration-200">
              <Camera size={22} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div>
              <h2 className="text-lg font-bold text-gray-800">{userName}</h2>
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-semibold inline-block mt-1">
                Sistem Yöneticisi
              </span>
            </div>

            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer block pt-1"
            >
              Fotoğraf Değiştir
            </button>
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