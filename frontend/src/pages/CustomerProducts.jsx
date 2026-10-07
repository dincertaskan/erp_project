import { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  Store, Search, ShoppingCart, Filter, Loader2, 
  CheckCircle2, Eye, RefreshCw, X, ArrowUpDown 
} from 'lucide-react';

// Resim URL'sini hatasız oluşturan güvenli yardımcı fonksiyon
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `http://localhost:8000${cleanPath}`;
};

export default function CustomerProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtreleme State'leri
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortOrder, setSortOrder] = useState('');

  // Modal State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [addedSuccessMsg, setAddedSuccessMsg] = useState('');

  // VERİLERİ ÇEKME
  const fetchPortalData = async () => {
    setLoading(true);
    try {
      const prodRes = await api.get('/inventory/products');
      const allProducts = Array.isArray(prodRes.data) ? prodRes.data : [];
      setProducts(allProducts);

      // Kategori endpoint'ini çağırıyoruz
      try {
        const catRes = await api.get('/inventory/categories');
        if (Array.isArray(catRes.data) && catRes.data.length > 0) {
          setCategories(catRes.data);
        } else {
          // Eğer kategoriler endpoint'i boş dönerse ürünlerin içindeki kategorilerden dinamik liste oluşturur
          extractCategoriesFromProducts(allProducts);
        }
      } catch (err) {
        // Hata durumunda ürün verilerinden kategorileri çıkarır
        extractCategoriesFromProducts(allProducts);
      }
    } catch (err) {
      console.error("Portal ürün verileri alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  // Ürünlerin içinden benzersiz kategori listesi çıkaran yedek fonksiyon
  const extractCategoriesFromProducts = (prods) => {
    const catMap = new Map();
    prods.forEach(p => {
      if (p.category_id) {
        catMap.set(String(p.category_id), {
          id: p.category_id,
          name: p.category_name || `Kategori ${p.category_id}`
        });
      }
    });
    setCategories(Array.from(catMap.values()));
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  // SEPETE EKLEME FONKSİYONU
  const handleAddToCart = (product, qtyToAdd = 1) => {
    if (product.stock < qtyToAdd) {
      alert(`Yetersiz Stok! Yalnızca ${product.stock} adet ekleyebilirsiniz.`);
      return;
    }

    const existingCart = JSON.parse(localStorage.getItem('cart_items') || '[]');
    const existingIndex = existingCart.findIndex(item => item.id === product.id);

    if (existingIndex > -1) {
      existingCart[existingIndex].quantity += qtyToAdd;
    } else {
      existingCart.push({
        id: product.id,
        name: product.name,
        unit_price: product.unit_price,
        image_url: product.image_url,
        quantity: qtyToAdd,
        stock: product.stock
      });
    }

    localStorage.setItem('cart_items', JSON.stringify(existingCart));

    setAddedSuccessMsg(`"${product.name}" sepete eklendi!`);
    setTimeout(() => setAddedSuccessMsg(''), 3000);

    if (isDetailModalOpen) {
      setIsDetailModalOpen(false);
    }
  };

  // FİLTRELEME & SIRALAMA MANTIĞI (GARANTİLİ KATEGORİ EŞLEŞTİRME)
  const filteredProducts = products
    .filter(p => {
      // Metin Arama
      const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
                            p.description?.toLowerCase().includes(search.toLowerCase());
      
      // Kategori Filtresi (Hem ID hem String Dönüşüm Garantili)
      const matchesCat = selectedCategory 
        ? String(p.category_id) === String(selectedCategory)
        : true;

      return matchesSearch && matchesCat;
    })
    .sort((a, b) => {
      if (sortOrder === 'price-asc') return Number(a.unit_price) - Number(b.unit_price);
      if (sortOrder === 'price-desc') return Number(b.unit_price) - Number(a.unit_price);
      return 0;
    });

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* BAŞLIK */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          Ürün Kataloğu & Mağaza
        </h1>
      </div>

      {/* BAŞARILI BİLDİRİM TOAST */}
      {addedSuccessMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-xl shadow-lg font-semibold text-xs flex items-center justify-between animate-in fade-in slide-in-from-top duration-300">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={18} /> {addedSuccessMsg}
          </span>
          <button onClick={() => setAddedSuccessMsg('')} className="hover:opacity-80 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ARAMA VE FİLTRELEME BARI */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-center">
        {/* Arama Kutusu */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün adı veya açıklama ara..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:outline-indigo-500"
          />
        </div>

        {/* Kategori ve Fiyat Sıralama Seçenekleri */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* KATEGORİ DROPDOWN */}
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
            <Filter size={14} className="text-gray-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="">Tüm Kategoriler</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
            <ArrowUpDown size={14} className="text-gray-500" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="bg-transparent font-medium text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="">Varsayılan Sıralama</option>
              <option value="price-asc">Fiyat: Düşükten Yükseğe</option>
              <option value="price-desc">Fiyat: Yüksekten Düşüğe</option>
            </select>
          </div>

          <button 
            onClick={() => { setSearch(''); setSelectedCategory(''); setSortOrder(''); fetchPortalData(); }}
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition cursor-pointer"
            title="Yenile"
          >
            <RefreshCw size={16} />
          </button>

        </div>
      </div>

      {/* ÜRÜN KARTLARI (TAM 3 SÜTUN) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-indigo-600">
          <Loader2 size={36} className="animate-spin" />
          <p className="text-xs font-semibold text-gray-500">Katalog Yükleniyor...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 text-xs">
          Aramanıza veya seçilen kategoriye uygun ürün bulunamadı.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div 
              key={product.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden hover:shadow-md transition flex flex-col justify-between group"
            >
              <div className="p-4 space-y-3">
                {/* Kart Resmi Kapsayıcısı */}
                <div 
                  onClick={() => { setSelectedProduct(product); setQuantity(1); setIsDetailModalOpen(true); }}
                  className="h-48 w-full bg-gray-50/80 rounded-xl overflow-hidden flex items-center justify-center relative border border-gray-100 cursor-pointer p-3"
                >
                  {product.image_url ? (
                    <img 
                      src={getImageUrl(product.image_url)} 
                      alt={product.name} 
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300"
                      onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="text-gray-300 font-extrabold text-2xl">ERP</div>
                  )}

                  {product.stock > 0 ? (
                    <span className="absolute top-2.5 right-2.5 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs z-10">
                      Stokta Var ({product.stock})
                    </span>
                  ) : (
                    <span className="absolute top-2.5 right-2.5 bg-red-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs z-10">
                      Stok Tükendi
                    </span>
                  )}
                </div>

                <div>
                    <br />
                  <h3 
                    onClick={() => { setSelectedProduct(product); setQuantity(1); setIsDetailModalOpen(true); }}
                    className="font-bold text-gray-800 text-sm truncate hover:text-indigo-600 transition cursor-pointer"
                  >
                    {product.name}
                  </h3>
                </div>
              </div>

              <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block">SATIŞ FİYATI</span>
                  <span className="text-base font-extrabold text-indigo-600">
                    ₺{Number(product.unit_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setSelectedProduct(product); setQuantity(1); setIsDetailModalOpen(true); }}
                    className="p-2 bg-white text-gray-600 hover:text-indigo-600 border border-gray-200 rounded-xl transition cursor-pointer"
                    title="İncele"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    disabled={product.stock <= 0}
                    onClick={() => handleAddToCart(product, 1)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                      product.stock > 0 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingCart size={15} />
                    <span>Ekle</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ÜRÜN DETAY MODAL */}
      {isDetailModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Store size={16} className="text-indigo-600" /> Ürün Detayı
              </h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="w-full sm:w-44 h-44 bg-gray-50 rounded-xl overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center p-2">
                  {selectedProduct.image_url ? (
                    <img 
                      src={getImageUrl(selectedProduct.image_url)} 
                      alt={selectedProduct.name} 
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="text-gray-300 font-extrabold text-2xl">ERP</div>
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <h2 className="text-lg font-bold text-gray-800">{selectedProduct.name}</h2>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {selectedProduct.description || 'Bu ürün için detaylı açıklama belirtilmemiş.'}
                  </p>
                  
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-gray-400 block">BİRİM FİYAT</span>
                    <span className="text-xl font-extrabold text-indigo-600">
                      ₺{Number(selectedProduct.unit_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Miktar Seçimi ve Sepete Ekle */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
                <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold transition cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-4 text-xs font-bold text-gray-800">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(Math.min(selectedProduct.stock, quantity + 1))}
                    className="px-3 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold transition cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <button
                  disabled={selectedProduct.stock <= 0}
                  onClick={() => handleAddToCart(selectedProduct, quantity)}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md ${
                    selectedProduct.stock > 0 
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ShoppingCart size={16} />
                  <span>Sepete Ekle (₺{(selectedProduct.unit_price * quantity).toLocaleString('tr-TR')})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}