import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { 
  ArrowLeft, Package, Tag, AlertTriangle, 
  CheckCircle2, Loader2, Trash2 
} from 'lucide-react';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProductDetail = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/inventory/products/${id}`);
        setProduct(res.data);
      } catch (err) {
        console.error("Ürün detayı alınamadı:", err);
        setError("Ürün bulunamadı veya bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetail();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/inventory/products/${id}`);
      navigate('/products');
    } catch (err) {
      console.error("Silme hatası:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-indigo-600">
        <Loader2 size={40} className="animate-spin" />
        <p className="text-sm font-semibold text-gray-500">Ürün Detayları Yükleniyor...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-4">
        <Link to="/products" className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:underline">
          <ArrowLeft size={16} /> Kataloğa Dön
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center text-xs font-medium">
          {error || "Ürün verisi bulunamadı."}
        </div>
      </div>
    );
  }

  const isLoss = Number(product.unit_price) < Number(product.cost_price);
  const isCritical = product.stock <= product.min_stock;

  return (
    <div className="space-y-6 pb-8">
      {/* GERİ DÖNÜŞ VE İŞLEMLER BARI */}
      <div className="flex justify-between items-center">
        <Link 
          to="/products" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-indigo-600 transition"
        >
          <ArrowLeft size={16} /> Ürün Kataloğuna Dön
        </Link>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleDelete}
            className="flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            <Trash2 size={14} /> Ürünü Sil
          </button>
        </div>
      </div>

      {/* ÜRÜN DETAY KARTI */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-6 flex flex-col md:flex-row gap-8 items-center md:items-start">
          
          {/* SABİT 200x200 EŞİT STANDART GÖRSEL KUTUSU */}
          <div className="w-52 h-52 shrink-0 bg-white rounded-xl border border-gray-200 p-2 flex items-center justify-center overflow-hidden shadow-xs">
            {product.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name} 
                className="w-full h-full object-contain p-1"
                onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/200?text=Görsel+Yok'; }}
              />
            ) : (
              <div className="text-gray-400 flex flex-col items-center gap-2">
                <Package size={40} />
                <span className="text-xs font-medium">Ürün Görseli Yok</span>
              </div>
            )}
          </div>

          {/* DETAYLI BİLGİ ALANI */}
          <div className="flex-1 w-full space-y-6 flex flex-col justify-between self-stretch">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
                <Tag size={14} /> {product.category_name || "Kategorisiz"}
              </div>
              <h1 className="text-2xl font-bold text-gray-800">{product.name}</h1>
            </div>

            {/* İSTATİSTİK / FİYAT KUTULARI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-gray-100">
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Satış Fiyatı</span>
                <p className={`text-base font-bold mt-1 ${isLoss ? 'text-red-600' : 'text-emerald-600'}`}>
                  ${product.unit_price ? Number(product.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0.00'}
                </p>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Maliyet</span>
                <p className="text-base font-bold text-gray-700 mt-1">
                  ${product.cost_price ? Number(product.cost_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0.00'}
                </p>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Mevcut Stok</span>
                <p className="text-base font-bold text-gray-800 mt-1">
                  {product.stock} Adet
                </p>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Stok Durumu</span>
                <div className="mt-1">
                  {isCritical ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-bold text-xs">
                      <AlertTriangle size={13} /> Kritik
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs">
                      <CheckCircle2 size={13} /> Yeterli
                    </span>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}