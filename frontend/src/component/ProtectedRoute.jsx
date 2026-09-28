import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRole = 'admin' }) {
  // LocalStorage veya Auth context üzerinden token ve kullanıcı rolünü alıyoruz
  const token = localStorage.getItem('token') || 'demo_token';
  const userRole = localStorage.getItem('user_role') || 'admin';

  // Oturum açılmamışsa Login sayfasına yönlendir
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Kullanıcı rolü izin verilen rol ile eşleşmiyorsa ana sayfaya/portal sayfasına yönlendir
  if (userRole !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}