import { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  ShoppingBag, Clock, CheckCircle2, DollarSign, 
  Search, RefreshCw, Loader2, X, Eye, Printer 
} from 'lucide-react';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtreler
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // SİPARİŞ VERİLERİNİ ÇEKME (Sadece Siparişler)
  const fetchOrdersData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders');
      setOrders(res.data || []);
    } catch (err) {
      console.error("Sipariş verileri alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersData();
  }, []);

  // DURUM GÜNCELLEME VE İPTAL/İADE MANTIĞI
  const handleStatusChange = async (orderId, newStatus) => {
    if (newStatus === 'İptal') {
      if (!window.confirm("Bu siparişi iptal etmek istediğinize emin misiniz? Satılan ürün stoku geri yüklenecek ve ödeme 'İade Edildi' olarak işaretlenecektir.")) {
        return;
      }
    }

    try {
      await api.patch(`/orders/${orderId}/status`, { order_status: newStatus });
      fetchOrdersData();
    } catch (err) {
      alert(err.response?.data?.detail || "Sipariş durumu güncellenirken bir hata oluştu.");
    }
  };

  // FATURA YAZDIRMA / GÖRÜNTÜLEME
  const handlePrintInvoice = (order) => {
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Fatura - ${order.order_code}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; font-size: 14px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #6366f1; padding-bottom: 15px; }
            .title { font-size: 20px; font-weight: bold; color: #4f46e5; }
            .info-table { width: 100%; margin-top: 25px; border-collapse: collapse; }
            .info-table th, .info-table td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            .info-table th { background-color: #f8fafc; font-size: 12px; }
            .total { text-align: right; margin-top: 20px; font-size: 16px; font-weight: bold; color: #059669; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">ERP YÖNETİM SİSTEMİ - RESMİ FATURA</div>
              <p style="margin-top: 5px; color: #64748b;">Tarih: ${new Date(order.created_at || Date.now()).toLocaleDateString('tr-TR')}</p>
            </div>
            <div>
              <h3 style="margin:0;">Sipariş No: ${order.order_code}</h3>
            </div>
          </div>
          
          <div style="margin-top: 20px; line-height: 1.6;">
            <strong>Müşteri Adı:</strong> ${order.customer_name}<br/>
            <strong>Ödeme Yöntemi:</strong> ${order.payment_method}<br/>
            <strong>Ödeme Durumu:</strong> ${order.payment_status}
          </div>

          <table class="info-table">
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Miktar</th>
                <th>Birim Fiyat</th>
                <th>Toplam</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${order.product_name}</td>
                <td>${order.quantity} Adet</td>
                <td>$${(order.total_price / order.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                <td>$${Number(order.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <div class="total">
            Genel Toplam: $${Number(order.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // KPI HESAPLAMALARI
  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter(o => o.order_status !== 'Tamamlandı' && o.order_status !== 'İptal').length;
  const completedOrdersCount = orders.filter(o => o.order_status === 'Tamamlandı').length;
  const totalRevenue = orders
    .filter(o => o.payment_status !== 'İade Edildi' && o.order_status !== 'İptal')
    .reduce((acc, o) => acc + (Number(o.total_price) || 0), 0);

  // FİLTRELEME
  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.order_code?.toLowerCase().includes(search.toLowerCase()) || 
                          o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
                          o.product_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? o.order_status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-8">
      {/* BAŞLIK */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Sipariş Yönetimi</h1>
      </div>

      {/* KPI KARTLARI */}
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
              ${totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* FİLTRE BARI */}
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
            <option value="Kargolandı">Kargolandı</option>
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
            Henüz müşterilerden gelen bir sipariş bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[980px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4 text-center w-[110px]">SİPARİŞ NO</th>
                  <th className="p-4 text-left">MÜŞTERİ</th>
                  <th className="p-4 text-left">ÜRÜN</th>
                  <th className="p-4 text-center w-[90px]">MİKTAR</th>
                  <th className="p-4 text-center w-[120px]">TOPLAM TUTAR</th>
                  <th className="p-4 text-center w-[120px]">ÖDEME</th>
                  <th className="p-4 text-center w-[150px]">DURUM</th>
                  <th className="p-4 text-center w-[110px]">İŞLEMLER</th>
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
                      ${Number(o.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                        o.payment_status === 'Ödendi' ? 'bg-emerald-50 text-emerald-700' :
                        o.payment_status === 'İade Edildi' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {o.payment_status}
                      </span>
                    </td>

                    {/* ADMIN GÜNCELLEME MENÜSÜ */}
                    <td className="p-4 text-center">
                      <select
                        value={o.order_status}
                        disabled={o.order_status === 'İptal' || o.order_status === 'Tamamlandı'}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-indigo-500 ${
                          o.order_status === 'Tamamlandı' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 cursor-not-allowed' :
                          o.order_status === 'Kargolandı' ? 'bg-blue-50 text-blue-700 border-blue-200 cursor-pointer' :
                          o.order_status === 'Hazırlanıyor' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 cursor-pointer' :
                          o.order_status === 'İptal' ? 'bg-red-50 text-red-700 border-red-200 cursor-not-allowed' :
                          'bg-amber-50 text-amber-700 border-amber-200 cursor-pointer'
                        }`}
                      >
                        <option value="Onay Bekliyor">Onay Bekliyor</option>
                        <option value="Hazırlanıyor">Hazırlanıyor</option>
                        <option value="Kargolandı">Kargolandı</option>
                        <option value="Tamamlandı">Tamamlandı</option>
                        <option value="İptal">İptal Et & İade Et</option>
                      </select>
                    </td>

                    {/* İŞLEMLER (Detay Göster & Fatura Yazdır) */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => { setSelectedOrder(o); setIsDetailModalOpen(true); }}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                          title="Detay Göster"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => handlePrintInvoice(o)}
                          className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Fatura Yazdır"
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAY MODAL */}
      {isDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                Sipariş Detayı: {selectedOrder.order_code}
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
                <span className="font-extrabold text-emerald-600">${Number(selectedOrder.total_price).toLocaleString('tr-TR')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Ödeme Yöntemi:</span>
                <span className="font-semibold text-gray-700">{selectedOrder.payment_method}</span>
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