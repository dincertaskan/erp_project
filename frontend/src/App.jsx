import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Layout from './component/Layout';
import Orders from './pages/Orders';
import CustomerDashboard from './pages/CustomerDashboard';
import Customers from './pages/Customers';
import CustomerProducts from './pages/CustomerProducts';
import Cart from './pages/Cart';
import CustomerOrders from './pages/CustomerOrders';

// Rol Kontrollü Korumalı Rota Bileşeni
const ProtectedRoute = ({ children, allowedRole = 'admin' }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('user_role') || 'admin';

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (userRole !== allowedRole) {
    // Admin harici kullanıcı yetkisiz bir URL'e girmeye çalışırsa müşteri portalına atar
    return <Navigate to={userRole === 'admin' ? "/dashboard" : "/portal/anasayfa"} replace />;
  }

  return children;
};

export default function App() {
  const userRole = localStorage.getItem('user_role') || 'admin';

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

        {/* ADMIN ROTALARI */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute allowedRole="admin">
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/products" 
          element={
            <ProtectedRoute allowedRole="admin">
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <Products />
              </Layout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/products/:id" 
          element={
            <ProtectedRoute allowedRole="admin">
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <ProductDetail />
              </Layout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/inventory" 
          element={
            <ProtectedRoute allowedRole="admin">
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <Inventory />
              </Layout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/orders" 
          element={
            <ProtectedRoute allowedRole="admin">
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <Orders />
              </Layout>
            </ProtectedRoute>
          } 
        />

        {/* MÜŞTERİ ROTALARI */}
        <Route 
          path="/portal/anasayfa" 
          element={
            <ProtectedRoute allowedRole="customer">
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <CustomerDashboard />
              </Layout>
            </ProtectedRoute>
          } 
        />

        <Route
          path="/portal/urunler"
          element={
            <ProtectedRoute allowedRole="customer">
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <CustomerProducts />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/portal/sepet"
          element={
            <ProtectedRoute allowedRole="customer">
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <Cart />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/portal/siparisler"
          element={
            <ProtectedRoute allowedRole="customer">
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <CustomerOrders />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ORTAK KULLANILABİLİR ROTALAR */}
        <Route 
          path="/profile" 
          element={
            <Layout notifications={notifications} setNotifications={setNotifications}>
              <Profile />
            </Layout>
          } 
        />

        <Route 
          path="/notifications" 
          element={
            <Layout notifications={notifications} setNotifications={setNotifications}>
              <Notifications notifications={notifications} setNotifications={setNotifications} />
            </Layout>
          } 
        />

        {/* ROL BAZLI JOKER YÖNLENDİRME */}
        <Route 
          path="*" 
          element={
            <Navigate to={userRole === 'admin' ? "/dashboard" : "/portal/anasayfa"} replace />
          } 
        />

        <Route 
          path="/customers" 
          element={
            <ProtectedRoute allowedRole="admin">
              <Layout notifications={notifications} setNotifications={setNotifications}>
                <Customers />
              </Layout>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}