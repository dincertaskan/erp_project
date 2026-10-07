import { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  Users, UserCheck, ShoppingBag, DollarSign, 
  Search, RefreshCw, Loader2, Eye, X, Mail, Calendar
} from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers');
      setCustomers(res.data || []);
    } catch (err) {
      console.error("Müşteri verileri çekilemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // KPI HESAPLAMALARI
  const totalCustomersCount = customers.length;
  const activeCustomersCount = customers.filter(c => c.is_active).length;
  const totalCustomerSpent = customers.reduce((acc, c) => acc + (c.total_spent || 0), 0);

  // FİLTRELEME
  const filteredCustomers = customers.filter(c => 
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-8">
      {/* BAŞLIK */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Müşteri Yönetimi</h1>
      </div>

      {/* KPI KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOPLAM MÜŞTERİ</span>
            <p className="text-2xl font-extrabold text-gray-800 mt-1">{totalCustomersCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">AKTİF HESAPLAR</span>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{activeCustomersCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOPLAM MÜŞTERİ HACMİ</span>
            <p className="text-2xl font-extrabold text-indigo-600 mt-1">
              ${totalCustomerSpent.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* ARAMA VE YENİLE BARI */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Müşteri adı veya e-posta ara..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:outline-indigo-500"
          />
        </div>

        <button 
          onClick={() => { setSearch(''); fetchCustomers(); }}
          className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition cursor-pointer"
          title="Yenile"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* MÜŞTERİ LİSTESİ TABLOSU */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-indigo-600">
            <Loader2 size={36} className="animate-spin" />
            <p className="text-xs font-semibold text-gray-500">Müşteriler Yükleniyor...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-xs">
            Kayıtlı müşteri bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[850px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4 text-left">MÜŞTERİ</th>
                  <th className="p-4 text-left">E-POSTA</th>
                  <th className="p-4 text-center w-[120px]">SİPARİŞ SAYISI</th>
                  <th className="p-4 text-center w-[140px]">TOPLAM HARCAMA</th>
                  <th className="p-4 text-center w-[120px]">DURUM</th>
                  <th className="p-4 text-center w-[100px]">İŞLEMLER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/80 transition">
                    <td className="p-4 font-bold text-gray-800 flex items-center gap-2.5">
                        {c.avatar_url ? (
                            <img 
                                src={`http://localhost:8000${c.avatar_url}`} 
                                alt={c.full_name} 
                                className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {c.full_name?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="truncate">{c.full_name}</span>
                    </td>
                    <td className="p-4 text-gray-600 truncate">{c.email}</td>
                    <td className="p-4 text-center font-bold">{c.total_orders} Sipariş</td>
                    <td className="p-4 text-center font-extrabold text-emerald-600 whitespace-nowrap">
                      ${Number(c.total_spent).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                        c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {c.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => { setSelectedCustomer(c); setIsDetailModalOpen(true); }}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        title="Cari Kart Detayı"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MÜŞTERİ DETAY MODAL */}
      {isDetailModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Users size={16} className="text-indigo-600" /> Müşteri Cari Kartı
              </h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                {selectedCustomer.avatar_url ? (
                    <img 
                        src={`http://localhost:8000${selectedCustomer.avatar_url}`} 
                        alt={selectedCustomer.full_name} 
                        className="w-12 h-12 rounded-full object-cover shrink-0 border-2 border-indigo-600"
                    />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-indigo-600 text-white font-bold text-lg flex items-center justify-center">
                        {selectedCustomer.full_name?.charAt(0).toUpperCase()}
                    </div>
                )}
                <div>
                    <h4 className="font-bold text-sm text-gray-800">{selectedCustomer.full_name}</h4>
                    <p className="text-gray-400 text-[11px] flex items-center gap-1 mt-0.5">
                    <Mail size={12} /> {selectedCustomer.email}
                    </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-400">Toplam Sipariş:</span>
                  <span className="font-bold text-gray-800">{selectedCustomer.total_orders} Adet</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-400">Toplam Harcama:</span>
                  <span className="font-extrabold text-emerald-600">
                    ${Number(selectedCustomer.total_spent).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Calendar size={12} /> Kayıt Tarihi:
                  </span>
                  <span className="text-gray-600">
                    {selectedCustomer.created_at ? new Date(selectedCustomer.created_at).toLocaleDateString('tr-TR') : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}