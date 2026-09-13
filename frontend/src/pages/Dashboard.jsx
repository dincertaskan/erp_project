import { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  Package, DollarSign, Users, AlertTriangle, Loader2 
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center text-sm font-medium">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* BAŞLIK ALANI */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Genel Bakış</h1>
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

        {/* Stok Dağılımı (Pie Chart) */}
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

      {/* KRİTİK STOK TABLOSU */}
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
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.name} 
                            className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0" 
                            onError={(e) => { 
                              e.target.onerror = null; 
                              e.target.src = 'https://via.placeholder.com/32?text=Ürün'; 
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Package size={16} />
                          </div>
                        )}
                        <span className="line-clamp-2 leading-relaxed" title={item.name}>
                          {item.name}
                        </span>
                      </div>
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
    </div>
  );
}