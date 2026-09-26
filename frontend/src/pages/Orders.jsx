import { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  ShoppingBag, Clock, CheckCircle2, DollarSign, 
  Search, Plus, RefreshCw, Loader2, X, AlertCircle, Eye, FileText 
} from 'lucide-react';
import SearchableSelect from '../component/SearchableSelect';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtreler
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal State'leri
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Form State
  const [orderForm, setOrderForm] = useState({
    customer_name: '',
    product_id: '',
    quantity: 1,
    payment_method: 'Kredi Kartı',
    note: ''
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Veritabanından Veri Çekme İşlemi
  const fetchOrdersData = async () => {
    setLoading(true);
    try {
      const [prodRes, ordersRes, custRes] = await Promise.all([
        api.get('/inventory/products'),
        api.get('/orders').catch(() => ({ data: [] })),
        api.get('/customers').catch(() => ({ data: [] }))
      ]);

      setProducts(prodRes.data || []);
      setOrders(ordersRes.data || []);
      setCustomers(custRes.data || []);
    } catch (err) {
      console.error("Sipariş verileri alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersData();
  }, []);

  // SİPARİŞ DURUMU GÜNCELLEME İŞLEMİ (İptal ve Para İadesi Dahil)
  const handleStatusChange = async (orderId, newStatus) => {
    if (newStatus === 'İptal') {
      if (!window.confirm("Bu siparişi iptal etmek istediğinize emin misiniz? Satılan ürün stoka geri yüklenecek ve ödeme 'İade Edildi' olarak işaretlenecektir.")) {
        return;
      }
    }

    try {
      await api.patch(`/orders/${orderId}/status`, { order_status: newStatus });
      fetchOrdersData(); // Tüm tabloyu, ciro ve stokları güncel verilerle yenile
    } catch (err) {
      alert(err.response?.data?.detail || "Sipariş durumu güncellenirken bir hata oluştu.");
    }
  };

  // SearchableSelect için Formatlanmış Ürün Seçenekleri
  const formattedProductOptions = products.map(p => ({
    id: p.id,
    name: `${p.name} (Stok: ${p.stock} | ₺${Number(p.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })})`
  }));

  // SearchableSelect için Müşteri Seçenekleri
  const formattedCustomerOptions = [
    { id: 'Misafir Müşteri', name: 'Misafir Müşteri' },
    ...customers.map(c => ({ id: c.name || c.full_name, name: c.name || c.full_name }))
  ];

  // Seçilen Ürüne Göre Toplam Hesaplama
  const selectedProductObj = products.find(p => p.id === parseInt(orderForm.product_id));
  const calculatedTotal = selectedProductObj ? (selectedProductObj.unit_price * orderForm.quantity) : 0;

  // Yeni Sipariş Kaydetme
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!orderForm.product_id) {
      setFormError('Lütfen bir ürün seçiniz.');
      return;
    }

    if (selectedProductObj && selectedProductObj.stock < orderForm.quantity) {
      setFormError(`Yetersiz Stok! Mevcut stok: ${selectedProductObj.stock} Adet`);
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        customer_name: orderForm.customer_name || 'Misafir Müşteri',
        payment_method: orderForm.payment_method,
        note: orderForm.note,
        items: [
          {
            product_id: parseInt(orderForm.product_id),
            quantity: parseInt(orderForm.quantity)
          }
        ]
      };

      await api.post('/orders', payload);

      setIsNewOrderModalOpen(false);
      setOrderForm({ customer_name: '', product_id: '', quantity: 1, payment_method: 'Kredi Kartı', note: '' });
      fetchOrdersData();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Sipariş oluşturulurken bir hata oluştu.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // İstatistikler (Sadece İade Edilmeyen ve İptal Olmayan Siparişlerin Cirosu Hesaplanır)
  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter(o => o.order_status !== 'Tamamlandı' && o.order_status !== 'İptal').length;
  const completedOrdersCount = orders.filter(o => o.order_status === 'Tamamlandı').length;
  const totalRevenue = orders
    .filter(o => o.payment_status !== 'İade Edildi' && o.order_status !== 'İptal')
    .reduce((acc, o) => acc + (Number(o.total_price) || 0), 0);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.order_code?.toLowerCase().includes(search.toLowerCase()) || 
                          o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
                          o.product_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? o.order_status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-8">
      {/* BAŞLIK VE YENİ SİPARİŞ BUTONU */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Satış & Sipariş Yönetimi</h1>
        </div>
        <button
          onClick={() => setIsNewOrderModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Plus size={16} /> Yeni Sipariş Oluştur
        </button>
      </div>

      {/* KPI ÖZET İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOPLAM SİPARİŞ</span>
            <p className="text-2xl font-extrabold text-gray-800 mt-1">{totalOrdersCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShoppingBag size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BEKLEYEN SİPARİŞLER</span>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{pendingOrdersCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TAMAMLANAN</span>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{completedOrdersCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOPLAM SATIŞ CIROSU</span>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">
              ₺{totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* ARAMA VE FİLTRE BARI */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sipariş kodu, müşteri veya ürün ara..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:outline-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 p-2 rounded-lg text-xs font-semibold focus:outline-indigo-500 bg-white"
          >
            <option value="">Tüm Durumlar</option>
            <option value="Onay Bekliyor">Onay Bekliyor</option>
            <option value="Hazırlanıyor">Hazırlanıyor</option>
            <option value="Tamamlandı">Tamamlandı</option>
            <option value="İptal">İptal</option>
          </select>

          <button 
            onClick={() => { setSearch(''); setStatusFilter(''); fetchOrdersData(); }}
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition cursor-pointer"
            title="Yenile"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* SİPARİŞ LİSTESİ TABLOSU */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-indigo-600">
            <Loader2 size={36} className="animate-spin" />
            <p className="text-xs font-semibold text-gray-500">Siparişler Yükleniyor...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-xs">
            Kayıtlı sipariş bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[950px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4 text-center w-[110px]">SİPARİŞ NO</th>
                  <th className="p-4 text-left">MÜŞTERİ</th>
                  <th className="p-4 text-left">ÜRÜN</th>
                  <th className="p-4 text-center w-[90px]">MİKTAR</th>
                  <th className="p-4 text-center w-[120px]">TOPLAM TUTAR</th>
                  <th className="p-4 text-center w-[120px]">ÖDEME</th>
                  <th className="p-4 text-center w-[140px]">DURUM</th>
                  <th className="p-4 text-center w-[100px]">İŞLEMLER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/80 transition">
                    <td className="p-4 text-center font-bold text-indigo-600">{o.order_code}</td>
                    <td className="p-4 font-semibold text-gray-800">{o.customer_name}</td>
                    <td className="p-4 text-gray-600 truncate">{o.product_name}</td>
                    <td className="p-4 text-center font-bold">{o.quantity} Adet</td>
                    <td className="p-4 text-center font-bold text-emerald-600 whitespace-nowrap">
                      ₺{Number(o.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                        o.payment_status === 'Ödendi' ? 'bg-emerald-50 text-emerald-700' :
                        o.payment_status === 'İade Edildi' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {o.payment_status}
                      </span>
                    </td>

                    {/* DEĞİŞTİRİLEBİLİR DURUM SEÇİM ALANI */}
                    <td className="p-4 text-center">
                      <select
                        value={o.order_status}
                        disabled={o.order_status === 'İptal' || o.order_status === 'Tamamlandı'}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-indigo-500 ${
                          o.order_status === 'Tamamlandı' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 cursor-not-allowed' :
                          o.order_status === 'Hazırlanıyor' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 cursor-pointer' :
                          o.order_status === 'İptal' ? 'bg-red-50 text-red-700 border-red-200 cursor-not-allowed' :
                          'bg-amber-50 text-amber-700 border-amber-200 cursor-pointer'
                        }`}
                      >
                        <option value="Onay Bekliyor">Onay Bekliyor</option>
                        <option value="Hazırlanıyor">Hazırlanıyor</option>
                        <option value="Tamamlandı">Tamamlandı</option>
                        <option value="İptal">İptal Et & İade Et</option>
                      </select>
                    </td>

                    <td className="p-4 text-center">
                      <button 
                        onClick={() => { setSelectedOrder(o); setIsDetailModalOpen(true); }}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        title="Detay Göster"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* YENİ SİPARİŞ MODAL */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-base">Yeni Sipariş Oluştur</h3>
              <button onClick={() => setIsNewOrderModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Müşteri Seçin / Girin</label>
                <SearchableSelect 
                  options={formattedCustomerOptions}
                  selectedValue={orderForm.customer_name}
                  onSelect={(custName) => setOrderForm({...orderForm, customer_name: custName})}
                  placeholder="Müşteri Ara veya Seç..."
                  type="category"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Satılacak Ürün</label>
                <SearchableSelect 
                  options={formattedProductOptions}
                  selectedValue={orderForm.product_id}
                  onSelect={(prodId) => setOrderForm({...orderForm, product_id: prodId})}
                  placeholder="Ürün Ara veya Seç..."
                  type="category"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Adet</label>
                  <input 
                    type="number" 
                    min="1" 
                    required 
                    value={orderForm.quantity}
                    onChange={e => setOrderForm({...orderForm, quantity: Math.max(1, parseInt(e.target.value) || 1)})}
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ödeme Yöntemi</label>
                  <select 
                    value={orderForm.payment_method}
                    onChange={e => setOrderForm({...orderForm, payment_method: e.target.value})}
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500 bg-white"
                  >
                    <option value="Kredi Kartı">Kredi Kartı</option>
                    <option value="Havale/EFT">Havale/EFT</option>
                    <option value="Nakit">Nakit</option>
                  </select>
                </div>
              </div>

              <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100 flex justify-between items-center">
                <span className="text-xs font-semibold text-indigo-900">Hesaplanan Toplam:</span>
                <span className="text-lg font-extrabold text-indigo-600">
                  ₺{calculatedTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsNewOrderModalOpen(false)} 
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  İptal
                </button>
                <button 
                  type="submit" 
                  disabled={formSubmitting} 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2"
                >
                  {formSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Siparişi Tamamla</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SİPARİŞ DETAY MODAL */}
      {isDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <FileText size={16} className="text-indigo-600" /> Sipariş Detayı: {selectedOrder.order_code}
              </h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Müşteri:</span>
                <span className="font-bold text-gray-700">{selectedOrder.customer_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Ürün:</span>
                <span className="font-semibold text-gray-700">{selectedOrder.product_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Adet:</span>
                <span className="font-bold text-gray-700">{selectedOrder.quantity} Adet</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Toplam Tutar:</span>
                <span className="font-extrabold text-emerald-600">₺{Number(selectedOrder.total_price).toLocaleString('tr-TR')}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-400">Tarih:</span>
                <span className="text-gray-600">{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('tr-TR') : ''}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}