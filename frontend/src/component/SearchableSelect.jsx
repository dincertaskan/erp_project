import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export default function SearchableSelect({ options = [], selectedValue, onSelect, placeholder = "Seçiniz..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Dışarı tıklanınca menüyü kapatma
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Seçili seçeneği bulma (string/number veya nesne kontrolü)
  const selectedOption = options.find(opt => String(opt.id) === String(selectedValue));

  // Arama filtresi
  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* SEÇİM KUTUSU (HEADER) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between border border-gray-200 px-3 py-2 rounded-xl text-xs font-normal bg-white text-gray-700 hover:border-gray-300 focus:outline-none shadow-xs cursor-pointer h-[38px] transition"
      >
        <span className={selectedOption && selectedOption.id !== '' ? "text-gray-800 font-semibold" : "text-gray-400"}>
          {selectedOption && selectedOption.id !== '' ? selectedOption.name : placeholder}
        </span>
        <ChevronDown size={15} className="text-gray-400" />
      </button>

      {/* AÇILIR MENÜ (DROPDOWN POPUP) */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg p-2 max-h-60 overflow-y-auto animate-in fade-in zoom-in duration-150">
          {/* Arama Kutusu */}
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Yazarak arayın..."
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs focus:outline-indigo-500"
            />
          </div>

          {/* Liste Elemanları */}
          <div className="space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-center text-xs text-gray-400">Sonuç bulunamadı</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelect(opt.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition cursor-pointer ${
                    String(selectedValue) === String(opt.id)
                      ? 'bg-indigo-50 text-indigo-600 font-bold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}