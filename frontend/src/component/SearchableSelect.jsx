import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

export default function SearchableSelect({ 
  options, 
  selectedValue, 
  onSelect, 
  placeholder = "Ara veya seç...",
  type = "product" 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.id === parseInt(selectedValue));

  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderLabel = (opt) => {
    if (!opt) return placeholder;
    if (type === 'category') {
      return opt.name;
    }
    return `${opt.name} (Stok: ${opt.stock} | ₺${opt.price})`;
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-gray-300 p-2.5 rounded-lg text-xs bg-white text-left flex justify-between items-center focus:outline-indigo-500 shadow-xs cursor-pointer"
      >
        <span className={selectedOption ? "text-gray-800 font-medium" : "text-gray-400"}>
          {renderLabel(selectedOption)}
        </span>
        <ChevronDown size={16} className="text-gray-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden animate-in fade-in duration-150">
          <div className="p-2 border-b border-gray-100 flex items-center gap-2 bg-gray-50 shrink-0">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Yazarak arayın..."
              className="w-full bg-transparent text-xs outline-none text-gray-700"
            />
          </div>

          <div className="overflow-y-auto max-h-52 p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-400">
                Sonuç bulunamadı.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === parseInt(selectedValue);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSelect(opt.id);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full text-left p-2.5 rounded-md text-xs flex justify-between items-center transition cursor-pointer ${
                      isSelected ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div>
                      <p className="font-medium">{opt.name}</p>
                      {type === 'product' && (
                        <span className="text-[10px] text-gray-400">Stok: {opt.stock} Adet | ₺{opt.price}</span>
                      )}
                    </div>
                    {isSelected && <Check size={14} className="text-indigo-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}