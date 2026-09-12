import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { 
  Search, AlertTriangle, RefreshCw, CheckCircle2, 
  Loader2, Edit3, History, X 
} from 'lucide-react';
import SearchableSelect from '../component/SearchableSelect';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modallar için State'ler
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productLogs, setProductLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Giriş yapan kullanıcı bilgisi
  const loggedUser = localStorage.getItem('user_name') || 'Dinçer Taşkan';

  // Durum Seçenekleri (SearchableSelect ile %100 Birebir Eşleşen ID Yapısı)
  const statusOptions = [
    { id: '', name: 'Tüm Durumlar' },
    { id: 'critical', name: 'Kritik Stok' },
    { id: 'normal', name: 'Yeterli Stok' }
  ];

  // Stok Düzenleme Form State
  const [adjustForm, setAdjustForm] = useState({
    action_type: 'ARTTIR',
    quantity: 1,
    description: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (selectedCategory) queryParams.append('category_id', selectedCategory);
      if (statusFilter) queryParams.append('status_filter', statusFilter);

      const [prodRes, catRes] = await Promise.all([
        api.get(`/inventory/products?${queryParams.toString()}`),
        api.get('/dashboard/categories')
      ]);

      setProducts(prodRes.data);
      setCategories(catRes.data);
    } catch (err) {
      console.error("Stok verileri alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedCategory, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInventory();
  };

  const handleOpenAdjustModal = (product) => {
    setSelectedProduct(product);
    setAdjustForm({ action_type: 'ARTTIR', quantity: 1, description: '' });
    setFormError('');
    setIsAdjustModalOpen(true);
  };

  const handleSaveStockAdjustment = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      await api.post(`/inventory/products/${selectedProduct.id}/adjust-stock`, {
        user_name: loggedUser,
        action_type: adjustForm.action_type,
        quantity: parseInt(adjustForm.quantity),
        description: adjustForm.description
      });

      setIsAdjustModalOpen(false);
      fetchInventory();
    } catch (err) {
      setFormError(err.response?.data?.detail || "İşlem sırasında hata oluştu.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenLogsModal = async (product) => {
    setSelectedProduct(product);
    setIsLogsModalOpen(true);
    setLoadingLogs(true);
    try {
      const res = await api.get(`/inventory/products/${product.id}/logs`);
      setProductLogs(res.data);
    } catch (err) {
      console.error("Loglar çekilemedi:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* BAŞLIK */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Stok Yönetimi</h1>
        </div>
      </div>

      {/* ARAMA VE FİLTRELEME BARI */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün adı ile arayın..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:outline-indigo-500"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* Kategori Filtresi */}
          <div className="w-48">
            <SearchableSelect 
              options={[{ id: '', name: 'Tüm Kategoriler' }, ...categories]}
              selectedValue={selectedCategory}
              onSelect={(catId) => setSelectedCategory(catId)}
              placeholder="Kategoriye Göre Filtrele"
              type="category"
            />
          </div>

          {/* DURUM FİLTRESİ (Tasarımı Birebir Aynı, Seçili Metni Gösteren Yapı) */}
          <div className="w-48">
            <SearchableSelect 
              options={statusOptions}
              selectedValue={statusFilter}
              onSelect={(status) => setStatusFilter(status)}
              placeholder="Duruma Göre Filtrele"
              type="category"
            />
          </div>

          <button 
            onClick={() => { setSearch(''); setSelectedCategory(''); setStatusFilter(''); fetchInventory(); }}
            className="p-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition cursor-pointer"
            title="Sıfırla & Yenile"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* TABLO LİSTESİ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-indigo-600">
            <Loader2 size={36} className="animate-spin" />
            <p className="text-xs font-semibold text-gray-500">Stok Verileri Yükleniyor...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-xs">
            Aramanıza uygun ürün bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4 text-center w-[80px]">ÜRÜN ID</th>
                  <th className="p-4 text-left">ÜRÜN ADI</th>
                  <th className="p-4 text-center w-[130px]">KATEGORİ</th>
                  <th className="p-4 text-center w-[110px]">MEVCUT STOK</th>
                  <th className="p-4 text-center w-[130px]">MIN. STOK SINIRI</th>
                  <th className="p-4 text-center w-[140px]">DURUM</th>
                  <th className="p-4 text-center w-[220px]">İŞLEMLER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition">
                    <td className="p-4 text-center font-bold text-indigo-600 hover:underline">
                      <Link to={`/inventory/${p.id}`}>#{p.id}</Link>
                    </td>

                    <td className="p-4 text-left font-semibold text-gray-800">
                      <p className="line-clamp-2 leading-relaxed" title={p.name}>
                        {p.name}
                      </p>
                    </td>

                    <td className="p-4 text-center text-gray-500 truncate">{p.category_name}</td>
                    <td className="p-4 text-center font-extrabold text-gray-800 whitespace-nowrap">{p.stock} Adet</td>
                    <td className="p-4 text-center text-gray-500 whitespace-nowrap">{p.min_stock} Adet</td>

                    <td className="p-4 text-center whitespace-nowrap">
                      {p.is_critical ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-[11px] font-bold">
                          <AlertTriangle size={12} /> Kritik Stok
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] font-bold">
                          <CheckCircle2 size={12} /> Yeterli Stok
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleOpenAdjustModal(p)}
                          className="flex items-center gap-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          <Edit3 size={14} /> Stok Düzenle
                        </button>
                        <button 
                          onClick={() => handleOpenLogsModal(p)}
                          className="flex items-center gap-1 bg-gray-100 text-gray-700 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          <History size={14} /> Notlar
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

      {/* POP-UP 1: STOK DÜZENLEME MODALI */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg h-[480px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-gray-800 text-base">Stok Düzenle: {selectedProduct?.name}</h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStockAdjustment} className="p-6 flex-1 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                {formError && <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs font-medium">{formError}</div>}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">İşlemi Yapan Personel</label>
                  <input 
                    type="text" 
                    readOnly 
                    value={loggedUser}
                    className="w-full bg-gray-200/70 border border-gray-300 text-gray-700 p-2.5 rounded-lg text-xs font-semibold cursor-not-allowed outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">İşlem Türü</label>
                    <select 
                      value={adjustForm.action_type}
                      onChange={e => setAdjustForm({...adjustForm, action_type: e.target.value})}
                      className="w-full border border-gray-300 p-2.5 rounded-lg text-xs font-semibold focus:outline-indigo-500 bg-white"
                    >
                      <option value="ARTTIR"> Stok Arttır</option>
                      <option value="AZALT"> Stok Azalt</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Miktar</label>
                    <input 
                      type="number" 
                      required 
                      min="1"
                      value={adjustForm.quantity}
                      onChange={e => setAdjustForm({...adjustForm, quantity: e.target.value})}
                      className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Açıklama</label>
                  <textarea 
                    rows="6"
                    value={adjustForm.description}
                    onChange={e => setAdjustForm({...adjustForm, description: e.target.value})}
                    placeholder="Örn: Tedarikçiden teslim alındı veya sayım eksiği tespit edildi."
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500"
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 shrink-0">
                <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer">
                  İptal
                </button>
                <button type="submit" disabled={formSubmitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer">
                  {formSubmitting ? "İşleniyor..." : "İşlemi Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP 2: NOTLAR / LOGLAR MODALI */}
      {isLogsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg h-[480px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                <History size={18} className="text-indigo-600" /> Notlar: {selectedProduct?.name}
              </h3>
              <button onClick={() => setIsLogsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {loadingLogs ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-indigo-600">
                  <Loader2 size={28} className="animate-spin" />
                  <p className="text-xs text-gray-500">Loglar yükleniyor...</p>
                </div>
              ) : productLogs.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400">
                  Bu ürüne ait henüz stok hareketi bulunmamaktadır.
                </div>
              ) : (
                <div className="space-y-3">
                  {productLogs.map((log) => (
                    <div key={log.id} className="p-3 border border-gray-100 bg-gray-50/50 rounded-lg flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-xs">{log.user_name}</span>
                          <span className="text-[10px] text-gray-400">{log.created_at}</span>
                        </div>
                        <p className="text-xs text-gray-600 italic">"{log.description}"</p>
                      </div>

                      <span className={`px-2 py-1 rounded text-[10px] font-extrabold flex items-center gap-1 ${
                        log.action_type === 'ARTTIR' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {log.action_type === 'ARTTIR' ? '+' : '-'}{log.quantity} Adet
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end shrink-0">
              <button onClick={() => setIsLogsModalOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 cursor-pointer">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}