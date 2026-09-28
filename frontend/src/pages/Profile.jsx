import { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  User, Mail, Shield, CheckCircle2, 
  Upload, Camera, Loader2, MapPin, Building2, Phone 
} from 'lucide-react';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const userName = localStorage.getItem('user_name') || 'Kullanıcı';
  const userRole = localStorage.getItem('user_role') || 'customer';

  // PROFİL BİLGİLERİNİ ÇEKME
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/auth/me?user_name=${encodeURIComponent(userName)}`);
      setProfile(res.data);
    } catch (err) {
      console.error("Profil bilgisi alınamadı:", err);
      setError("Profil bilgileri yüklenirken bir sorun oluştu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // PROFİL FOTOĞRAFI YÜKLEME
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await api.post(`/auth/upload-avatar?user_name=${encodeURIComponent(userName)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      alert('Profil fotoğrafınız başarıyla güncellendi.');
      fetchProfile();
    } catch (err) {
      alert(err.response?.data?.detail || 'Fotoğraf yüklenirken bir hata oluştu.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-indigo-600">
        <Loader2 size={36} className="animate-spin" />
        <p className="text-xs font-semibold text-gray-500">Profil Yükleniyor...</p>
      </div>
    );
  }

  return (
    /* max-w-4xl KALDIRILDI, w-full İLE BÖLGE TAMAMEN KAPLANDI */
    <div className="space-y-6 pb-8 w-full">
      {/* BAŞLIK */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          {userRole === 'admin' ? 'Profil Detayları' : 'Hesabım & Profil'}
        </h1>
      </div>

      {/* PROFİL KARTI */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-6 w-full">
        {/* ÜST KISIM (FOTOĞRAF & İSİM) */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-gray-100">
          <div className="relative group">
            {profile?.avatar_url ? (
              <img 
                src={`http://localhost:8000${profile.avatar_url}`} 
                alt={profile.full_name} 
                className="w-24 h-24 rounded-full object-cover border-4 border-indigo-50 shadow-xs"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-indigo-100 text-indigo-600 font-extrabold text-3xl flex items-center justify-center border-4 border-indigo-50">
                {profile?.full_name?.charAt(0).toUpperCase()}
              </div>
            )}

            <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full cursor-pointer shadow-md hover:bg-indigo-700 transition">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
          </div>

          <div className="text-center sm:text-left space-y-1.5 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-xl font-bold text-gray-800">{profile?.full_name}</h2>
              <span className={`self-center sm:self-auto text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                profile?.role === 'admin' 
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {profile?.role === 'admin' ? 'Sistem Yöneticisi' : 'Müşteri Hesabı'}
              </span>
            </div>

            <p className="text-xs text-gray-500 flex items-center justify-center sm:justify-start gap-1">
              <Mail size={14} className="text-gray-400" /> {profile?.email}
            </p>

            <label className="inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer pt-1">
              {uploading ? 'Fotoğraf Yükleniyor...' : 'Fotoğraf Değiştir'}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        {/* DETAY BİLGİ KARTLARI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 text-gray-600 flex items-center justify-center shrink-0">
              <Mail size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">E-POSTA / DURUM</span>
              <p className="text-xs font-bold text-gray-800 mt-0.5 flex items-center gap-1.5">
                {profile?.email} 
                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                  Aktif Kullanıcı
                </span>
              </p>
            </div>
          </div>

          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 text-gray-600 flex items-center justify-center shrink-0">
              <Shield size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ERİŞİM SEVİYESİ</span>
              <p className="text-xs font-bold text-gray-800 mt-0.5">
                {userRole === 'admin' ? 'Tam Yetkili (Admin)' : 'Standart Müşteri Yetkisi'}
              </p>
            </div>
          </div>
        </div>

        {/* MÜŞTERİ ROLÜNE ÖZEL EK BİLGİ ALANI */}
        {userRole === 'customer' && (
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Fatura & Adres Bilgileri</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white border border-gray-200 rounded-xl flex items-start gap-2.5">
                <MapPin size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-700 block">Teslimat Adresi</span>
                  <span className="text-gray-500">Varsayılan adres tanımlanmamış. Sipariş esnasında girilebilir.</span>
                </div>
              </div>

              <div className="p-3 bg-white border border-gray-200 rounded-xl flex items-start gap-2.5">
                <Building2 size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-700 block">Fatura Türü</span>
                  <span className="text-gray-500">Bireysel Müşteri Hesabı</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}