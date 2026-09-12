import { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  Package, DollarSign, Users, AlertTriangle, Plus, 
  ShoppingCart, ArrowUpRight, Loader2, X 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import SearchableSelect from '../component/SearchableSelect';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal Durumları
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);

  // Form Seçenekleri
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  // Ürün Ekleme Form State
  const [productForm, setProductForm] = useState({
    name: '',
    category_id: '',
    stock: '',
    min_stock: '5',
    price: ''
  });

  // Sipariş Oluşturma Form State
  const [saleForm, setSaleForm] = useState({
    product_id: '',
    quantity: '1'
  });

  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchDashboardStats = async () => {
    try {
      const res = await api.get('/dashboard/stats');
      setData(res.data);
    } catch (err) {
      console.error("PostgreSQL Dashboard Verileri Alınamadı:", err);
      setError("Veriler PostgreSQL veritabanından çekilirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  // Modal Açma Fonksiyonları
  const handleOpenProductModal = async () => {
    setFormError('');
    try {
      const res = await api.get('/dashboard/categories');
      setCategories(res.data);
      if (res.data.length > 0) {
        setProductForm(prev => ({ ...prev, category_id: res.data[0].id }));
      }
      setIsProductModalOpen(true);
    } catch (err) {
      alert("Kategoriler yüklenirken hata oluştu.");
    }
  };

  const handleOpenSaleModal = async () => {
    setFormError('');
    try {
      const res = await api.get('/dashboard/products');
      setProducts(res.data);
      if (res.data.length > 0) {
        setSaleForm(prev => ({ ...prev, product_id: res.data[0].id }));
      }
      setIsSaleModalOpen(true);
    } catch (err) {
      alert("Ürünler yüklenirken hata oluştu.");
    }
  };

  // Ürün Kaydetme İşlemi
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      await api.post('/dashboard/products', {
        name: productForm.name,
        category_id: parseInt(productForm.category_id),
        stock: parseInt(productForm.stock),
        min_stock: parseInt(productForm.min_stock),
        price: parseFloat(productForm.price)
      });

      setIsProductModalOpen(false);
      setProductForm({ name: '', category_id: '', stock: '', min_stock: '5', price: '' });
      fetchDashboardStats();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Ürün eklenirken bir hata oluştu.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Sipariş Kaydetme İşlemi
  const handleCreateSale = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      await api.post('/dashboard/sales', {
        product_id: parseInt(saleForm.product_id),
        quantity: parseInt(saleForm.quantity)
      });

      setIsSaleModalOpen(false);
      setSaleForm({ product_id: '', quantity: '1' });
      fetchDashboardStats();
    } catch (err) {
      setFormError(err.response?.data?.detail || "Sipariş oluşturulurken bir hata oluştu.");
    } finally {
      setFormSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-indigo-600">
        <Loader2 size={40} className="animate-spin" />
        <p className="text-sm font-semibold text-gray-600">PostgreSQL Verileri Yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center text-sm font-medium">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* BAŞLIK VE POP-UP BUTONLARI */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Genel Bakış</h1>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleOpenProductModal}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus size={16} /> Ürün Ekle
          </button>
          <button 
            onClick={handleOpenSaleModal}
            className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs transition cursor-pointer"
          >
            <ShoppingCart size={16} className="text-indigo-600" /> Sipariş Oluştur
          </button>
        </div>
      </div>

      {/* KPI İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Toplam Stok</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">{data?.total_stock?.toLocaleString()}</h3>
            <br />
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Package size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Aylık Ciro</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">{data?.monthly_sales_total?.toLocaleString()}</h3>
            <br />
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Aktif Müşteri</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">{data?.active_customers}</h3>
            <br />
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Kritik Stok</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{data?.critical_stock_count} Ürün</h3>
            <br />
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* GRAFİKLER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ciro Performansı (Area Chart) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-gray-800">Ciro Performansı</h2>
            </div>
          </div>
          
          <div className="h-64">
            {!data?.sales_data || data.sales_data.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-gray-400">
                Henüz satış kaydı bulunmamaktadır.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={data.sales_data.map(item => ({ ...item, ciro: Number(item.ciro) }))} 
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCiro" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  
                  {/* YENİLENEN SAYISAL ODAKLI Y-EKSENİ */}
                  <YAxis 
                    type="number"
                    domain={[0, 'auto']}
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                  />
                  
                  <Tooltip 
                    formatter={(value) => [`₺${Number(value).toLocaleString('tr-TR')}`, 'Ciro']} 
                  />
                  <Area type="monotone" dataKey="ciro" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCiro)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-gray-800">Stok Dağılımı</h2>
            <p className="text-xs text-gray-400">Kategorilere göre ürün miktarı</p>
          </div>

          <div className="h-48 flex items-center justify-center">
            {!data?.category_data || data.category_data.length === 0 ? (
              <div className="text-xs text-gray-400">Kategori verisi bulunamadı.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.category_data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                    {data.category_data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} Adet`, 'Miktar']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
            {data?.category_data?.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                <span className="text-xs text-gray-600 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KRİTİK STOK TABLOSU (Hizalama & Çoklu Satır İyileştirmesi Yapıldı) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={18} />
            <h2 className="text-base font-bold text-gray-800">Tedarik Gereken Ürünler</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          {!data?.critical_stock || data.critical_stock.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              Kritik seviyede ürün bulunmamaktadır. Tüm stoklar yeterli!
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="pb-3 w-1/2">Ürün Adı</th>
                  <th className="pb-3 w-1/6">Kategori</th>
                  <th className="pb-3 w-1/6 text-center">Kalan Stok</th>
                  <th className="pb-3 w-1/6 text-center">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {data.critical_stock.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="py-3 pr-4 font-medium text-gray-800">
                      <p className="line-clamp-2 leading-relaxed" title={item.name}>
                        {item.name}
                      </p>
                    </td>
                    <td className="py-3 text-gray-500 truncate">{item.category}</td>
                    <td className="py-3 font-bold text-amber-600 text-center whitespace-nowrap">{item.stock} Adet</td>
                    <td className="py-3 text-center whitespace-nowrap">
                      <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-semibold text-[12px] inline-block">
                        Kritik Seviye (Min: {item.min_stock})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* POP-UP 1: YENİ ÜRÜN EKLE MODAL (Sabit h-[460px] Boyutu) */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg h-[460px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-gray-800 text-base">Yeni Ürün Ekle</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 flex-1 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                {formError && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs font-medium">{formError}</div>}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ürün Adı</label>
                  <input 
                    type="text" required value={productForm.name}
                    onChange={e => setProductForm({...productForm, name: e.target.value})}
                    placeholder="Örn: Kablosuz Klavye" 
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Kategori</label>
                  <SearchableSelect 
                    options={categories}
                    selectedValue={productForm.category_id}
                    onSelect={(catId) => setProductForm({...productForm, category_id: catId})}
                    placeholder="Kategori ara veya seç..."
                    type="category"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Stok Miktarı</label>
                    <input 
                      type="number" required min="0" value={productForm.stock}
                      onChange={e => setProductForm({...productForm, stock: e.target.value})}
                      placeholder="100" 
                      className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Minimum Stok (Sınır)</label>
                    <input 
                      type="number" required min="1" value={productForm.min_stock}
                      onChange={e => setProductForm({...productForm, min_stock: e.target.value})}
                      placeholder="5" 
                      className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Birim Fiyat (₺)</label>
                  <input 
                    type="number" step="0.01" required value={productForm.price}
                    onChange={e => setProductForm({...productForm, price: e.target.value})}
                    placeholder="1250.00" 
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500" 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4 shrink-0">
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer">
                  İptal
                </button>
                <button type="submit" disabled={formSubmitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer">
                  {formSubmitting ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP 2: YENİ SİPARİŞ OLUŞTUR MODAL (Sabit h-[460px] Boyutuyla EŞİTLENDİ) */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg h-[460px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-gray-800 text-base">Yeni Sipariş Oluştur</h3>
              <button onClick={() => setIsSaleModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSale} className="p-6 flex-1 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                {formError && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs font-medium">{formError}</div>}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Satılacak Ürün</label>
                  <SearchableSelect 
                    options={products}
                    selectedValue={saleForm.product_id}
                    onSelect={(prodId) => setSaleForm({...saleForm, product_id: prodId})}
                    placeholder="Ürün adı yazarak arayın..."
                    type="product"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Satış Adedi</label>
                  <input 
                    type="number" required min="1" value={saleForm.quantity}
                    onChange={e => setSaleForm({...saleForm, quantity: e.target.value})}
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500" 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 shrink-0">
                <button type="button" onClick={() => setIsSaleModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer">
                  İptal
                </button>
                <button type="submit" disabled={formSubmitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer">
                  {formSubmitting ? "Sipariş İşleniyor..." : "Sipariş Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}