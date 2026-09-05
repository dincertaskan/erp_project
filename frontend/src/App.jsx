import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Layout from './component/Layout';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default function App() {
  // Örnek Test Bildirim Verileri (Tarihe göre yeniden eskiye sıralanacaktır)
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Sisteme yeni giriş tespit edildi.', date: '2026-09-05 10:30' },
    { id: 2, text: 'Stok seviyesi kritik sınırın altına düştü (Ürün #12).', date: '2026-09-05 11:15' },
    { id: 3, text: 'Yeni müşteri kaydı oluşturuldu.', date: '2026-09-04 14:20' },
    { id: 4, text: 'Haftalık satış raporu hazırlandı.', date: '2026-09-03 09:00' },
    { id: 5, text: 'Sistem yedeklemesi başarıyla tamamlandı.', date: '2026-09-02 18:45' },
    { id: 6, text: 'Eski veritabanı logları arşivlendi.', date: '2026-09-01 12:00' }
  ]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <Profile />
              </Layout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/notifications" 
          element={
            <ProtectedRoute>
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <Notifications notifications={notifications} setNotifications={setNotifications} />
              </Layout>
            </ProtectedRoute>
          } 
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}