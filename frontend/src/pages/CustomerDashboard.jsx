import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { 
  ShoppingBag, ArrowRight, Sparkles, ShoppingCart, 
  Loader2, CheckCircle2, Clock, Star, Tag 
} from 'lucide-react';

export default function CustomerHome() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const userName = localStorage.getItem('user_name') || 'Müşteri';

  useEffect(() => {
    const fetchHomeData = async () => {
      setLoading(true);
      try {
        const [prodRes, ordersRes] = await Promise.all([
          api.get('/inventory/products'),
          api.get('/orders').catch(() => ({ data: [] }))
        ]);

        // Aktif ve stokta olan ürünleri öne çıkarıyoruz
        const activeProds = (prodRes.data || []).filter(p => p.is_active && p.stock > 0);
        setFeaturedProducts(activeProds.slice(0, 6)); // İlk 6 ürünü vitrine koy

        // Kullanıcının kendi siparişleri (İsme göre süzme)
        const myOrd = (ordersRes.data || []).filter(o => o.customer_name === userName);
        setMyOrders(myOrd);
      } catch (err) {
        console.error("Anasayfa verileri çekilemedi:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, [userName]);

  const activeOrdersCount = myOrders.filter(o => o.order_status !== 'Tamamlandı' && o.order_status !== 'İptal').length;
  const completedOrdersCount = myOrders.filter(o => o.order_status === 'Tamamlandı').length;

  return (
    <div className="space-y-8 pb-10 w-full">
      {/* KAMPANYA & HOŞ GELDİN BANNERI */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-indigo-100 border border-white/20">
            <Sparkles size={14} className="text-amber-300" /> Özel Müşteri Portalı
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Hoş Geldin, {userName} 
          </h1>
          <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed">
            Sistemdeki en güncel ürünleri keşfedin, sepetinizi oluşturun ve siparişlerinizi anlık olarak takip edin.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button 
              onClick={() => navigate('/portal/urunler')}
              className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-md flex items-center gap-2 cursor-pointer"
            >
              Ürün Kataloğunu İncele <ArrowRight size={16} />
            </button>
            <button 
              onClick={() => navigate('/portal/orders')}
              className="bg-indigo-500/30 hover:bg-indigo-500/40 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition border border-white/20 cursor-pointer"
            >
              Siparişlerimi Takip Et
            </button>
          </div>
        </div>

        {/* Dekoratif Arka Plan İkonu */}
        <ShoppingBag className="absolute -right-6 -bottom-8 w-64 h-64 text-white/5 pointer-events-none rotate-12" />
      </div>

      {/* MÜŞTERİ HIZLI İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div 
          onClick={() => navigate('/portal/orders')}
          className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:border-indigo-300 transition cursor-pointer flex items-center justify-between group"
        >
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">DEVAM EDEN SİPARİŞLER</span>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{activeOrdersCount} Sipariş</p>
            <span className="text-[11px] text-gray-400 mt-1 block">Onayda / Hazırlanıyor</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition">
            <Clock size={22} />
          </div>
        </div>

        <div 
          onClick={() => navigate('/portal/orders')}
          className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:border-indigo-300 transition cursor-pointer flex items-center justify-between group"
        >
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TAMAMLANAN SİPARİŞLER</span>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{completedOrdersCount} Sipariş</p>
            <span className="text-[11px] text-gray-400 mt-1 block">Teslim Edildi</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div 
          onClick={() => navigate('/portal/urunler')}
          className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:border-indigo-300 transition cursor-pointer flex items-center justify-between group"
        >
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">MAĞAZA</span>
            <p className="text-2xl font-extrabold text-indigo-600 mt-1">Tüm Ürünler</p>
            <span className="text-[11px] text-gray-400 mt-1 block">Kataloğu Görüntüle</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition">
            <Tag size={22} />
          </div>
        </div>
      </div>

      {/* ÖNE ÇIKAN ÜRÜNLER VİTRİNİ */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Star size={18} className="text-amber-500 fill-amber-500" /> Öne Çıkan Ürünler
            </h2>
            <p className="text-xs text-gray-500">En çok tercih edilen ve stokta olan popüler ürünler.</p>
          </div>
          <button 
            onClick={() => navigate('/portal/urunler')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            Tümünü Gör <ArrowRight size={14} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-indigo-600">
            <Loader2 size={32} className="animate-spin" />
            <p className="text-xs font-semibold text-gray-500">Ürün Vitrini Yükleniyor...</p>
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-xs">
            Henüz satılacak aktif ürün bulunmuyor.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredProducts.map((product) => (
              <div 
                key={product.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden hover:shadow-md transition flex flex-col justify-between group"
              >
                <div className="p-4 space-y-3">
                  {/* ÜRÜN GÖRSELİ */}
                  <div className="h-40 w-full bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center relative border border-gray-100">
                    {product.image_url ? (
                      <img 
                        src={`http://localhost:8000${product.image_url}`} 
                        alt={product.name} 
                        className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="text-gray-300 font-extrabold text-2xl">ERP</div>
                    )}
                    <span className="absolute top-2 right-2 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                      Stokta Var ({product.stock})
                    </span>
                  </div>

                  {/* ÜRÜN BİLGİSİ */}
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm truncate">{product.name}</h3>
                    <p className="text-xs text-gray-400 line-clamp-2 mt-1">
                      {product.description || 'Kaliteli ve güvenilir ürün standartları.'}
                    </p>
                  </div>
                </div>

                {/* FİYAT VE BUTON */}
                <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block">SATIŞ FİYATI</span>
                    <span className="text-base font-extrabold text-indigo-600">
                      ₺{Number(product.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button 
                    onClick={() => navigate('/portal/urunler')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <ShoppingCart size={15} />
                    <span>İncele</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}