import { Store, ShoppingBag, CheckCircle2 } from 'lucide-react';

export default function CustomerPortal() {
  const userName = localStorage.getItem('user_name') || 'Müşteri';

  return (
    <div className="space-y-6 pb-8">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-xs">
        <h1 className="text-xl font-bold">Hoş Geldiniz, {userName} 👋</h1>
        <p className="text-xs text-indigo-100 mt-1">
          Müşteri Portalındasınız. Buradan ürünleri inceleyebilir ve siparişlerinizi takip edebilirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Store size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Ürün Kataloğu</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">Satıştaki Ürünleri İncele</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShoppingBag size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Siparişlerim</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">Sipariş Takibi</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Hesap Türü</p>
            <p className="text-sm font-bold text-emerald-600 mt-0.5">Onaylı Müşteri Hesabı</p>
          </div>
        </div>
      </div>
    </div>
  );
}