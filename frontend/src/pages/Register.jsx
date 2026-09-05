import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { UserPlus } from 'lucide-react';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleRegister} className="bg-white p-8 rounded-xl shadow-md w-96 flex flex-col gap-4">
        <div className="flex items-center gap-2 justify-center text-indigo-600 font-bold text-2xl mb-2">
          <UserPlus size={28} /> Kayıt Ol
        </div>

        {error && (
          <div className="bg-red-100 text-red-600 p-2.5 rounded-lg text-sm text-center font-medium border border-red-200 break-words">
            {error}
          </div>
        )}

        <input 
          type="text" 
          placeholder="Ad Soyad" 
          value={fullName} 
          onChange={(e) => setFullName(e.target.value)} 
          required 
          className="border p-2.5 rounded-lg focus:outline-indigo-500 text-sm" 
        />
        <input 
          type="email" 
          placeholder="E-posta Adresi" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
          className="border p-2.5 rounded-lg focus:outline-indigo-500 text-sm" 
        />
        <input 
          type="password" 
          placeholder="Şifre" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
          className="border p-2.5 rounded-lg focus:outline-indigo-500 text-sm" 
        />
        <button 
          type="submit" 
          className="bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition shadow-sm"
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