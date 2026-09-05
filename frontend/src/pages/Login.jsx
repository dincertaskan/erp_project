import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      
      localStorage.setItem('token', res.data.access_token);
      if (res.data.full_name) {
        localStorage.setItem('user_name', res.data.full_name);
      }

      navigate('/dashboard');
    } catch (err) {
      console.error("Giriş Hatası:", err.response);
      if (typeof err.response?.data?.detail === 'string') {
        setError(err.response.data.detail);
      } else if (Array.isArray(err.response?.data?.detail)) {
        setError(err.response.data.detail[0]?.msg || 'Giriş bilgileri geçersiz.');
      } else {
        setError('E-posta veya şifre hatalı.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-md w-96 flex flex-col gap-4">
        <div className="flex items-center gap-2 justify-center text-indigo-600 font-bold text-2xl mb-2">
          <LogIn size={28} /> Giriş Yap
        </div>
        
        {error && (
          <div className="bg-red-100 text-red-600 p-2.5 rounded-lg text-sm text-center font-medium border border-red-200">
            {error}
          </div>
        )}

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
          Giriş Yap
        </button>
        <p className="text-xs text-center text-gray-500 mt-2">
          Hesabın yok mu? <Link to="/register" className="text-indigo-600 font-semibold hover:underline">Kayıt Ol</Link>
        </p>
      </form>
    </div>
  );
}