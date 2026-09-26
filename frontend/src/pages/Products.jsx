import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { 
  Plus, Search, Edit3, Trash2, Package, 
  Loader2, X, RefreshCw, AlertCircle, Image as ImageIcon 
} from 'lucide-react';
import SearchableSelect from '../component/SearchableSelect';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [productForm, setProductForm] = useState({
    name: '',
    category_id: '',
    unit_price: '',
    cost_price: '',
    stock: '0',
    min_stock: '5',
    image_url: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (selectedCategory) queryParams.append('category_id', selectedCategory);

      const [prodRes, catRes] = await Promise.all([
        api.get(`/inventory/products?${queryParams.toString()}`),
        api.get('/dashboard/categories')
      ]);

      setProducts(prodRes.data);
      setCategories(catRes.data);
    } catch (err) {
      console.error("Ürünler yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleOpenAddModal = () => {
    setErrorMsg('');
    setEditingProduct(null);
    setProductForm({
      name: '',
      category_id: categories.length > 0 ? categories[0].id : '',
      unit_price: '',
      cost_price: '',
      stock: '0',
      min_stock: '5',
      image_url: '',
      description: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    setErrorMsg('');
    setEditingProduct(product);
    setProductForm({
      name: product.name || '',
      category_id: product.category_id || '',
      unit_price: product.unit_price || 0,
      cost_price: product.cost_price || 0,
      stock: '0',
      min_stock: '5',
      image_url: product.image_url || '',
      description: product.description || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!productForm.category_id) {
      setErrorMsg('Lütfen bir kategori seçin.');
      return;
    }

    const unitPrice = parseFloat(productForm.unit_price) || 0;
    const costPrice = parseFloat(productForm.cost_price) || 0;

    // FİYAT KONTROLÜ
    if (unitPrice < costPrice) {
      setErrorMsg('Satış fiyatı maliyet fiyatından düşük olamaz!');
      return;
    }

    setSubmitting(true);

    const payload = {
      name: productForm.name,
      category_id: parseInt(productForm.category_id),
      unit_price: unitPrice,
      cost_price: costPrice,
      image_url: productForm.image_url || null,
      description: productForm.description
    };

    if (!editingProduct) {
      payload.stock = parseInt(productForm.stock) || 0;
      payload.min_stock = parseInt(productForm.min_stock) || 5;
    }

    try {
      if (editingProduct) {
        await api.put(`/inventory/products/${editingProduct.id}`, payload);
      } else {
        await api.post('/inventory/products', payload);
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error("Kaydetme hatası:", err);
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setErrorMsg(detail[0]?.msg || "Girdiğiniz verileri kontrol edin.");
      } else {
        setErrorMsg(detail || "İşlem gerçekleştirilirken bir hata oluştu.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Bu ürünü kataloktan silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/inventory/products/${id}`);
      fetchProducts();
    } catch (err) {
      console.error("Silme hatası:", err);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* BAŞLIK VE YENİ ÜRÜN BUTONU */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Ürün Kataloğu</h1>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Plus size={16} /> Yeni Ürün Ekle
        </button>
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
          <div className="w-52">
            <SearchableSelect 
              options={[{ id: '', name: 'Tüm Kategoriler' }, ...categories]}
              selectedValue={selectedCategory}
              onSelect={(catId) => setSelectedCategory(catId)}
              placeholder="Kategoriye Göre Filtrele"
            />
          </div>
          <button 
            onClick={() => { setSearch(''); setSelectedCategory(''); fetchProducts(); }}
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition cursor-pointer"
            title="Yenile"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ÜRÜN TABLOSU */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-indigo-600">
            <Loader2 size={36} className="animate-spin" />
            <p className="text-xs font-semibold text-gray-500">Ürün Kataloğu Yükleniyor...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-xs">
            Kayıtlı ürün bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[850px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4 text-center w-[70px]">ID</th>
                  <th className="p-4 text-left">ÜRÜN ADI</th>
                  <th className="p-4 text-center w-[130px]">KATEGORİ</th>
                  <th className="p-4 text-center w-[110px]">SATIŞ FİYATI</th>
                  <th className="p-4 text-center w-[110px]">MALİYET</th>
                  <th className="p-4 text-center w-[100px]">MEVCUT STOK</th>
                  <th className="p-4 text-center w-[120px]">İŞLEMLER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {products.map((p) => {
                  const isLoss = Number(p.unit_price) < Number(p.cost_price);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition">
                      {/* DİNAMİK /products/:id LİNKİ */}
                      <td className="p-4 text-center font-bold text-indigo-600">
                        <Link 
                          to={`/products/${p.id}`}
                          className="hover:underline hover:text-indigo-800 transition cursor-pointer"
                        >
                          #{p.id}
                        </Link>
                      </td>

                      <td className="p-4 text-left font-semibold text-gray-800">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img 
                              src={p.image_url} 
                              alt={p.name} 
                              className="w-9 h-9 rounded-lg object-cover border border-gray-200 shrink-0" 
                              onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/36?text=Ürün'; }}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                              <Package size={18} />
                            </div>
                          )}
                          <span className="line-clamp-1">{p.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center text-gray-500 truncate">{p.category_name}</td>
                      <td className="p-4 text-center font-bold whitespace-nowrap">
                        <span className={isLoss ? 'text-red-600' : 'text-emerald-600'}>
                          ${p.unit_price ? Number(p.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0.00'}
                        </span>
                      </td>
                      <td className="p-4 text-center text-gray-500 whitespace-nowrap">
                        ${p.cost_price ? Number(p.cost_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0.00'}
                      </td>
                      <td className="p-4 text-center font-semibold text-gray-800">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] ${p.stock <= p.min_stock ? 'bg-amber-50 text-amber-700 font-bold' : 'bg-gray-100 text-gray-700'}`}>
                          {p.stock} Adet
                        </span>
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Sil"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* YENİ ÜRÜN / DÜZENLEME MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-base">
                {editingProduct ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ürün Adı</label>
                <input 
                  type="text" 
                  required 
                  value={productForm.name}
                  onChange={e => setProductForm({...productForm, name: e.target.value})}
                  placeholder="Örn: Kablosuz Mouse"
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Kategori</label>
                  <select 
                    required
                    value={productForm.category_id}
                    onChange={e => setProductForm({...productForm, category_id: e.target.value})}
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500 bg-white"
                  >
                    <option value="">Kategori Seçin</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <ImageIcon size={13} className="text-gray-400" /> Görsel URL
                  </label>
                  <input 
                    type="url" 
                    value={productForm.image_url}
                    onChange={e => setProductForm({...productForm, image_url: e.target.value})}
                    placeholder="https://..."
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Satış Fiyatı ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required 
                    min="0"
                    value={productForm.unit_price}
                    onChange={e => setProductForm({...productForm, unit_price: e.target.value})}
                    placeholder="0.00"
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500 font-bold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Maliyet ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={productForm.cost_price}
                    onChange={e => setProductForm({...productForm, cost_price: e.target.value})}
                    placeholder="0.00"
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500"
                  />
                </div>
              </div>

              {!editingProduct && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Başlangıç Stoku</label>
                    <input 
                      type="number" 
                      required 
                      min="0"
                      value={productForm.stock}
                      onChange={e => setProductForm({...productForm, stock: e.target.value})}
                      placeholder="0"
                      className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Kritik Stok Sınırı</label>
                    <input 
                      type="number" 
                      required 
                      min="1"
                      value={productForm.min_stock}
                      onChange={e => setProductForm({...productForm, min_stock: e.target.value})}
                      placeholder="5"
                      className="w-full border border-gray-300 p-2.5 rounded-lg text-xs focus:outline-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  İptal
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  <span>{submitting ? "Kaydediliyor..." : "Kaydet"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}