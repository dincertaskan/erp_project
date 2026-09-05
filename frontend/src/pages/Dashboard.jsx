export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Genel Bakış</h1>
        <p className="text-sm text-gray-500">Sistem özet bilgileri ve hızlı istatistikler.</p>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
        İçerik alanı hazır. Sıradaki adımda özet kartları ve grafikleri ekleyebiliriz.
      </div>
    </div>
  );
}