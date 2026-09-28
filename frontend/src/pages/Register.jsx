import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { UserPlus, Shield, User } from 'lucide-react';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin'); // Varsayılan olarak Admin veya Customer seçilebilir
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', {
        full_name: fullName,
        email,
        password,
        role // Backend'e rol bilgisi gönderiliyor
      });

      alert('Kayıt başarılı! Lütfen giriş yapınız.');
      navigate('/login');
    } catch (err) {
      console.error("Kayıt Detaylı Hata Yanıtı:", err.response);
      
      const serverDetail = err.response?.data?.detail;
      
      if (typeof serverDetail === 'string') {
        setError(serverDetail);
      } else if (Array.isArray(serverDetail)) {
        setError(serverDetail[0]?.msg || 'Form verileri geçersiz.');
      } else {
        setError(err.message || 'Sunucuyla iletişim kurulamadı.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <form onSubmit={handleRegister} className="bg-white p-8 rounded-xl shadow-md w-full max-w-md flex flex-col gap-4">
        <div className="flex items-center gap-2 justify-center text-indigo-600 font-bold text-2xl mb-2">
          <UserPlus size={28} /> Kayıt Ol
        </div>

        {error && (
          <div className="bg-red-100 text-red-600 p-2.5 rounded-lg text-sm text-center font-medium border border-red-200 break-words">
            {error}
          </div>
        )}

        {/* HESAP TÜRÜ / ROL SEÇİM ALANI */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hesap Türü Seçiniz</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('admin')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-bold transition cursor-pointer ${
                role === 'admin'
                  ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-xs'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Shield size={16} /> Admin (Yönetici)
            </button>

            <button
              type="button"
              onClick={() => setRole('customer')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-bold transition cursor-pointer ${
                role === 'customer'
                  ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-xs'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <User size={16} /> Müşteri
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Ad Soyad</label>
          <input 
            type="text" 
            placeholder="Örn: Ahmet Yılmaz" 
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)} 
            required 
            className="w-full border p-2.5 rounded-lg focus:outline-indigo-500 text-sm" 
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">E-posta Adresi</label>
          <input 
            type="email" 
            placeholder="ornek@firma.com" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            className="w-full border p-2.5 rounded-lg focus:outline-indigo-500 text-sm" 
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Şifre</label>
          <input 
            type="password" 
            placeholder="••••••••" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            className="w-full border p-2.5 rounded-lg focus:outline-indigo-500 text-sm" 
          />
        </div>

        <button 
          type="submit" 
          className="bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition shadow-sm cursor-pointer mt-2"
        >
          Hesap Oluştur
        </button>

        <p className="text-xs text-center text-gray-500 mt-2">
          Zaten hesabın var mı? <Link to="/login" className="text-indigo-600 font-semibold hover:underline">Giriş Yap</Link>
        </p>
      </form>
    </div>
  );
}