import { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  Package, Clock, CheckCircle2, XCircle, Truck, 
  Eye, Loader2, RefreshCw, Calendar, CreditCard, FileText, X, Search, Filter, ArrowUpDown, RotateCcw
} from 'lucide-react';

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `http://localhost:8000${cleanPath}`;
};

export default function CustomerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  // ARAMA VE DETAYLI FİLTRELEME STATE'LERİ
  const [searchCode, setSearchCode] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [sortAmount, setSortAmount] = useState(''); // 'asc' | 'desc'

  const userName = localStorage.getItem('user_name') || 'Müşteri';

  // SİPARİŞLERİ ÇEKME
  const fetchMyOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders');
      const allOrders = Array.isArray(res.data) ? res.data : [];
      
      // Sadece giriş yapan müşterinin kendi siparişleri süzülür
      const myOrders = allOrders.filter(o => o.customer_name === userName);
      setOrders(myOrders);
    } catch (err) {
      console.error("Siparişler çekilemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyOrders();
  }, [userName]);

  // FİLTRELERİ SIFIRLAMA
  const handleResetFilters = () => {
    setSearchCode('');
    setSelectedStatus('');
    setSelectedPayment('');
    setFilterDate('');
    setSortAmount('');
  };

  // SİPARİŞ İPTAL ETME
  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Bu siparişi iptal etmek istediğinizden emin misiniz?")) return;

    setCancellingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { order_status: "İptal" });
      
      alert("Siparişiniz başarıyla iptal edildi ve stok iade edildi.");
      fetchMyOrders();
      if (isModalOpen) setIsModalOpen(false);
    } catch (err) {
      console.error("Sipariş iptal edilemedi:", err);
      const errorMsg = err.response?.data?.detail || "Sipariş iptal edilirken bir hata oluştu.";
      alert(errorMsg);
    } finally {
      setCancellingId(null);
    }
  };

  // DURUM ROSETTİ
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Onay Bekliyor':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
            <Clock size={12} /> Onay Bekliyor
          </span>
        );
      case 'Hazırlanıyor':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
            <Package size={12} /> Hazırlanıyor
          </span>
        );
      case 'Kargolandı':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
            <Truck size={12} /> Kargolandı
          </span>
        );
      case 'Tamamlandı':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
            <CheckCircle2 size={12} /> Tamamlandı
          </span>
        );
      case 'İptal':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1">
            <XCircle size={12} /> İptal Edildi
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-700 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  // ÇOKLU FİLTRELEME VE SIRALAMA MANTIĞI
  const filteredOrders = orders
    .filter((order) => {
      const cleanCode = order.order_code ? order.order_code.replace(/^#+/, '') : '';
      const searchLower = searchCode.toLowerCase().trim();

      // 1. Kod Arama
      const matchesCode = cleanCode.toLowerCase().includes(searchLower);

      // 2. Durum Filtresi
      const matchesStatus = selectedStatus ? order.order_status === selectedStatus : true;

      // 3. Ödeme Yöntemi Filtresi
      const matchesPayment = selectedPayment ? order.payment_method === selectedPayment : true;

      // 4. Tarih Filtresi (YYYY-MM-DD eşleşmesi)
      let matchesDate = true;
      if (filterDate && order.created_at) {
        const orderDateFormatted = new Date(order.created_at).toISOString().split('T')[0];
        matchesDate = orderDateFormatted === filterDate;
      }

      return matchesCode && matchesStatus && matchesPayment && matchesDate;
    })
    .sort((a, b) => {
      // 5. Tutara Göre Sıralama
      if (sortAmount === 'asc') return Number(a.total_price) - Number(b.total_price);
      if (sortAmount === 'desc') return Number(b.total_price) - Number(a.total_price);
      return 0;
    });

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* BAŞLIK & YENİLE */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            Siparişlerim
          </h1>
        </div>
      </div>

      {/* DETAYLI ARAMA VE FİLTRELEME BARI */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          
          {/* 1. Sipariş Kodu Arama */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Sipariş kodu ara..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-indigo-500"
            />
          </div>

          {/* 2. Sipariş Durumu */}
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
            <Filter size={14} className="text-gray-500 shrink-0" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer w-full"
            >
              <option value="">Tüm Durumlar</option>
              <option value="Onay Bekliyor">Onay Bekliyor</option>
              <option value="Hazırlanıyor">Hazırlanıyor</option>
              <option value="Kargolandı">Kargolandı</option>
              <option value="Tamamlandı">Tamamlandı</option>
              <option value="İptal">İptal Edildi</option>
            </select>
          </div>

          {/* 3. Ödeme Yöntemi */}
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
            <CreditCard size={14} className="text-gray-500 shrink-0" />
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
              className="bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer w-full"
            >
              <option value="">Tüm Ödemeler</option>
              <option value="Kredi Kartı">Kredi Kartı</option>
              <option value="Nakit">Nakit</option>
              <option value="Havale/EFT">Havale/EFT</option>
            </select>
          </div>

          {/* 4. Tarih Seçimi */}
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
            <Calendar size={14} className="text-gray-500 shrink-0" />
            <input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer w-full text-xs"
            />
          </div>

          {/* 5. Tutar Sıralama */}
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
            <ArrowUpDown size={14} className="text-gray-500 shrink-0" />
            <select
              value={sortAmount}
              onChange={(e) => setSortAmount(e.target.value)}
              className="bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer w-full"
            >
              <option value="">Tutar: Hepsi</option>
              <option value="asc">Tutar: Artan</option>
              <option value="desc">Tutar: Azalan</option>
            </select>
          </div>

        </div>

        {/* Filtreleri Temizle Butonu (Aktif filtre varsa görünür) */}
        {(searchCode || selectedStatus || selectedPayment || filterDate || sortAmount) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleResetFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 bg-indigo-50 px-3 py-1 rounded-lg transition cursor-pointer"
            >
              <RotateCcw size={12} /> Filtreleri Temizle
            </button>
          </div>
        )}
      </div>

      {/* SİPARİŞ MÜŞTERİ TABLOSU */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-indigo-600">
          <Loader2 size={36} className="animate-spin" />
          <p className="text-xs font-semibold text-gray-500">Siparişleriniz Yükleniyor...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 text-xs">
          Arama kriterlerinize uygun sipariş bulunamadı.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Sipariş Kodu</th>
                  <th className="py-3.5 px-5">Tarih</th>
                  <th className="py-3.5 px-5">Ödeme Yöntemi</th>
                  <th className="py-3.5 px-5 text-center">Durum</th>
                  <th className="py-3.5 px-5 text-center">Toplam Tutar</th>
                  <th className="py-3.5 px-5 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {filteredOrders.map((order) => {
                  const cleanCode = order.order_code ? order.order_code.replace(/^#+/, '') : '';

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition">
                      {/* Sipariş Kodu */}
                      <td className="py-4 px-5 font-extrabold text-indigo-600">
                        #{cleanCode}
                      </td>

                      {/* Tarih */}
                      <td className="py-4 px-5 text-gray-500 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-gray-400" />
                          {order.created_at ? new Date(order.created_at).toLocaleDateString('tr-TR') : '-'}
                        </span>
                      </td>

                      {/* Ödeme Yöntemi */}
                      <td className="py-4 px-5 text-gray-500 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <CreditCard size={13} className="text-gray-400" />
                          {order.payment_method}
                        </span>
                      </td>

                      {/* Durum Badge */}
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        {getStatusBadge(order.order_status)}
                      </td>

                      {/* Toplam Tutar */}
                      <td className="py-4 px-5 text-center font-extrabold text-gray-900 whitespace-nowrap">
                        ₺{Number(order.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>

                      {/* İşlem Butonları */}
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                            title="Detay İncele"
                          >
                            <Eye size={14} />
                            <span>Detay</span>
                          </button>

                          {order.order_status === 'Onay Bekliyor' && (
                            <button 
                              disabled={cancellingId === order.id}
                              onClick={() => handleCancelOrder(order.id)}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                            >
                              {cancellingId === order.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                'İptal Et'
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SİPARİŞ DETAY MODAL (POP-UP) */}
      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <Package size={16} className="text-indigo-600" /> Sipariş Detayı
                </h3>
                <span className="text-[11px] text-gray-400 mt-0.5 block">
                  Tarih: {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString('tr-TR') : '-'}
                </span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-600">Sipariş Durumu:</span>
                {getStatusBadge(selectedOrder.order_status)}
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Sipariş Edilen Ürünler</h4>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden bg-white">
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((item, idx) => {
                      // Ürün görselini güvenli bir şekilde buluyoruz
                      const itemImg = item.product?.image_url || item.image_url;

                      return (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 p-1">
                              {itemImg ? (
                                <img 
                                  src={getImageUrl(itemImg)} 
                                  alt={item.product?.name || "Ürün Görseli"} 
                                  className="max-h-full max-w-full object-contain"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="text-[10px] text-gray-400 font-bold">ERP</span>
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-gray-800 block">
                                {item.product?.name || item.product_name || `Ürün #${item.product_id}`}
                              </span>
                              <span className="text-gray-400 text-[11px]">
                                {item.quantity} Adet x ₺{Number(item.unit_price).toLocaleString('tr-TR')}
                              </span>
                            </div>
                          </div>
                          <span className="font-extrabold text-indigo-600">
                            ₺{Number(item.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-gray-400 text-xs">Ürün detay bilgisi bulunamadı.</div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                <span className="font-bold text-gray-600">Ödenen Toplam Tutar:</span>
                <span className="text-lg font-extrabold text-indigo-600">
                  ₺{Number(selectedOrder.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}