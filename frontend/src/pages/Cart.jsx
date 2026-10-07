import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { 
  ShoppingCart, Trash2, Plus, Minus, ArrowRight, 
  ShoppingBag, CheckCircle2, Loader2, ArrowLeft 
} from 'lucide-react';

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `http://localhost:8000${cleanPath}`;
};

export default function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const navigate = useNavigate();

  const userName = localStorage.getItem('user_name') || 'Müşteri';

  // Sepeti localStorage'dan yükle
  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem('cart_items') || '[]');
    setCartItems(savedCart);
  }, []);

  // Sepeti Güncelleme Yardımcısı
  const updateCart = (newItems) => {
    setCartItems(newItems);
    localStorage.setItem('cart_items', JSON.stringify(newItems));
  };

  // Miktar Artırma/Azaltma
  const handleQuantityChange = (id, delta) => {
    const updated = cartItems.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        if (newQty > item.stock) {
          alert(`Stok sınırına ulaştınız! Maksimum ${item.stock} adet ekleyebilirsiniz.`);
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean);

    updateCart(updated);
  };

  // Ürün Silme
  const handleRemoveItem = (id) => {
    const updated = cartItems.filter(item => item.id !== id);
    updateCart(updated);
  };

  // Sepeti Temizleme
  const handleClearCart = () => {
    if (window.confirm("Sepetinizdeki tüm ürünleri silmek istediğinize emin misiniz?")) {
      updateCart([]);
    }
  };

  // Toplam Tutar Hesaplama
  const subTotal = cartItems.reduce((acc, item) => acc + (Number(item.unit_price) * item.quantity), 0);

  // SİPARİŞİ TAMAMLAMA (Backend'e Gönderme)
  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    setLoading(true);
    try {
      // Backend Sipariş İsteği
      const orderPayload = {
        customer_name: userName,
        total_price: subTotal,
        payment_method: "Kredi Kartı",
        payment_status: "Ödendi",
        order_status: "Onay Bekliyor",
        note: "Müşteri Portalı üzerinden verilen sipariş.",
        items: cartItems.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity
        }))
      };

      await api.post('/orders', orderPayload);

      // Sepeti Temizle ve Başarı Sayfasını Göster
      updateCart([]);
      setOrderSuccess(true);
    } catch (err) {
      console.error("Sipariş verilemedi:", err);
      alert("Sipariş oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="bg-white rounded-3xl border border-gray-200 p-10 text-center max-w-lg mx-auto my-12 space-y-4 shadow-sm animate-in zoom-in duration-200">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 size={36} />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Siparişiniz Başarıyla Alındı!</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Siparişiniz sistemimize ulaştı. Sipariş durumunuzu <b>"Siparişlerim"</b> sekmesinden anlık olarak takip edebilirsiniz.
        </p>
        <div className="pt-4 flex justify-center gap-3">
          <button 
            onClick={() => navigate('/portal/orders')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-xs cursor-pointer"
          >
            Siparişlerime Git
          </button>
          <button 
            onClick={() => { setOrderSuccess(false); navigate('/portal/urunler'); }}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer"
          >
            Alışverişe Devam Et
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* BAŞLIK */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            Sepetim
          </h1>
        </div>

        {cartItems.length > 0 && (
          <button 
            onClick={handleClearCart}
            className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer bg-red-50 px-3 py-1.5 rounded-lg border border-red-100"
          >
            <Trash2 size={14} /> Sepeti Temizle
          </button>
        )}
      </div>

      {/* BOŞ SEPET GÖRÜNÜMÜ */}
      {cartItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center space-y-4 my-6">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto">
            <ShoppingBag size={32} />
          </div>
          <h3 className="text-base font-bold text-gray-800">Sepetiniz Şu Anda Boş</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Katalogdaki ürünleri inceleyip sepetinize ekleyerek alışverişe hemen başlayabilirsiniz.
          </p>
          <button 
            onClick={() => navigate('/portal/urunler')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-md inline-flex items-center gap-2 cursor-pointer"
          >
            Ürün Kataloğuna Git <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        /* DOLU SEPET - İKİ KOLONLU DÜZEN */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SOL: ÜRÜN LİSTESİ */}
          <div className="lg:col-span-2 space-y-3">
            {cartItems.map((item) => (
              <div 
                key={item.id} 
                className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 w-full sm:w-auto">
                  <div className="w-16 h-16 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden p-1">
                    {item.image_url ? (
                      <img 
                        src={getImageUrl(item.image_url)} 
                        alt={item.name} 
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-gray-300 font-bold text-xs">ERP</span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-800 text-sm">{item.name}</h3>
                    <span className="text-xs font-semibold text-indigo-600 block mt-0.5">
                      ₺{Number(item.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} / Adet
                    </span>
                  </div>
                </div>

                {/* MİKTAR VE SİLME */}
                <div className="flex items-center justify-between w-full sm:w-auto gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                    <button 
                      onClick={() => handleQuantityChange(item.id, -1)}
                      className="p-1.5 text-gray-600 hover:bg-gray-200 transition cursor-pointer"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-3 text-xs font-bold text-gray-800">{item.quantity}</span>
                    <button 
                      onClick={() => handleQuantityChange(item.id, 1)}
                      className="p-1.5 text-gray-600 hover:bg-gray-200 transition cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-gray-900 block">
                      ₺{(Number(item.unit_price) * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button 
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition cursor-pointer"
                    title="Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* SAĞ: SİPARİŞ ÖZETİ & ÖDEME */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs h-fit space-y-4">
            <h2 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-3">Sipariş Özeti</h2>
            
            <div className="space-y-2.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Ara Toplam:</span>
                <span className="font-semibold text-gray-800">
                  ₺{subTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Kargo Tutarı:</span>
                <span className="font-semibold text-emerald-600">Ücretsiz</span>
              </div>
              
              <div className="border-t border-gray-100 pt-3 flex justify-between items-center text-sm">
                <span className="font-bold text-gray-800">Genel Toplam:</span>
                <span className="font-extrabold text-indigo-600 text-lg">
                  ₺{subTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              disabled={loading}
              onClick={handleCheckout}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sipariş Alınıyor...
                </>
              ) : (
                <>
                  <span>Siparişi Tamamla</span> <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}