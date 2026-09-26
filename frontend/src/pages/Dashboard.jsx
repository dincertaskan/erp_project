import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { 
  Package, DollarSign, Users, AlertTriangle, Loader2, ArrowRight 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-indigo-600">
        <Loader2 size={40} className="animate-spin" />
        <p className="text-sm font-semibold text-gray-600">PostgreSQL Verileri Yükleniyor...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center text-sm font-medium">
        {error || "Veriler yüklenemedi."}
      </div>
    );
  }

  const revenueValue = data.monthly_revenue ?? data.monthly_sales_total ?? 0;

  // Grafikte tek bir nokta kalmaması için 12 aylık omurga oluşturulup gelen ciro verisi oturtuluyor
  const monthNames = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Ekim", "Kas", "Ara"];
  const salesMap = new Map((data.sales_data || []).map(item => [item.month, item.ciro]));

  const salesChartData = monthNames.map(month => ({
    month,
    ciro: salesMap.has(month) ? salesMap.get(month) : 0
  }));

  const categoryChartData = data.category_data || [];
  const criticalStockList = data.critical_stock || [];

  return (
    <div className="space-y-6 pb-8">
      {/* BAŞLIK */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Genel Bakış</h1>
      </div>

      {/* KPI ÖZET KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOPLAM STOK */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">TOPLAM STOK</span>
            <p className="text-2xl font-extrabold text-gray-800 mt-1">{data.total_stock ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Package size={20} />
          </div>
        </div>

        {/* AYLIK CİRO */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">AYLIK CİRO</span>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">
              ₺{Number(revenueValue).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>

        {/* AKTİF MÜŞTERİ */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">AKTİF MÜŞTERİ</span>
            <p className="text-2xl font-extrabold text-gray-800 mt-1">{data.active_customers ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        {/* KRİTİK STOK */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">KRİTİK STOK</span>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{data.critical_stock_count ?? 0} Ürün</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* GRAFİKLER ALANI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CİRO PERFORMANSI */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-800">Ciro Performansı</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCiro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(val) => `₺${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip 
                  formatter={(val) => [`₺${Number(val).toLocaleString('tr-TR')}`, 'Ciro']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', borderColor: '#e2e8f0', fontSize: '12px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="ciro" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCiro)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* STOK DAĞILIMI */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-800">Stok Dağılımı</h2>
            <p className="text-xs text-gray-400">Kategorilere göre ürün miktarı</p>
          </div>
          <div className="h-60 w-full flex items-center justify-center">
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [`${val} Adet`, 'Miktar']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-gray-400">Kategori verisi bulunamadı.</div>
            )}
          </div>
        </div>

      </div>

      {/* TEDARİK GEREKEN ÜRÜNLER (DÜZELTİLEN TAM GENİŞLİK TABLO KARTI) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-4 w-full">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Tedarik Gereken Ürünler
          </h2>
          <Link to="/inventory" className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
            Tümünü Gör <ArrowRight size={14} />
          </Link>
        </div>

        {criticalStockList.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            Harika! Kritik stok seviyesinde ürün bulunmamaktadır.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-3">ÜRÜN ADI</th>
                  <th className="p-3">KATEGORİ</th>
                  <th className="p-3 text-center">KALAN STOK</th>
                  <th className="p-3 text-center">MIN. STOK</th>
                  <th className="p-3 text-center">DURUM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {criticalStockList.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition">
                    <td className="p-3 font-semibold text-gray-800">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.name} 
                            className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0"
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/32?text=Ürün'; }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Package size={16} />
                          </div>
                        )}
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-500">{item.category}</td>
                    <td className="p-3 text-center font-bold text-amber-600">{item.stock} Adet</td>
                    <td className="p-3 text-center text-gray-500">{item.min_stock} Adet</td>
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-[11px] font-bold">
                        Kritik Stok
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}