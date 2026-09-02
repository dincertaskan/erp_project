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
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Giriş başarısız.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-md w-96 flex flex-col gap-4">
        <div className="flex items-center gap-2 justify-center text-indigo-600 font-bold text-2xl mb-2">
          <LogIn size={28} /> Giriş Yap
        </div>
        {error && <div className="bg-red-100 text-red-600 p-2 rounded text-sm text-center">{error}</div>}
        <input 
          type="email" 
          placeholder="E-posta Adresi" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
          className="border p-2 rounded focus:outline-indigo-500" 
        />
        <input 
          type="password" 
          placeholder="Şifre" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
          className="border p-2 rounded focus:outline-indigo-500" 
        />
        <button type="submit" className="bg-indigo-600 text-white p-2 rounded font-semibold hover:bg-indigo-700 transition">
          Giriş Yap
        </button>
        <p className="text-xs text-center text-gray-500 mt-2">
          Hesabın yok mu? <Link to="/register" className="text-indigo-600 font-semibold hover:underline">Kayıt Ol</Link>
        </p>
      </form>
    </div>
  );
}