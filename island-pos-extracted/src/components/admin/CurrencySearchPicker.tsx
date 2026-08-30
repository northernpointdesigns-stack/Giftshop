import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Globe, DollarSign } from 'lucide-react';

export interface CurrencyItem {
  code: string;
  name: string;
  symbol: string;
  flag?: string;
}

export const WORLD_CURRENCIES: CurrencyItem[] = [
  { code: 'SCR', name: 'Seychelles Rupee', symbol: 'SR', flag: '🇸🇨' },
  { code: 'USD', name: 'United States Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£', flag: '🇬🇧' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'AED', name: 'United Arab Emirates Dirham', symbol: 'AED', flag: '🇦🇪' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'AU$', flag: '🇦🇺' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'MUR', name: 'Mauritian Rupee', symbol: 'Rs', flag: '🇲🇺' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD', flag: '🇲🇦' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', flag: '🇪🇬' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'dkr', flag: '🇩🇰' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', flag: '🇲🇽' },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', flag: '🇮🇱' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', flag: '🇵🇭' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', flag: '🇷🇺' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SR', flag: '🇸🇦' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QR', flag: '🇶🇦' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD', flag: '🇰🇼' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD', flag: '🇧🇭' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR', flag: '🇴🇲' },
];

interface CurrencySearchPickerProps {
  label?: string;
  selectedCode: string;
  selectedSymbol: string;
  onSelectCurrency: (code: string, symbol: string) => void;
  className?: string;
}

export const CurrencySearchPicker: React.FC<CurrencySearchPickerProps> = ({
  label,
  selectedCode,
  selectedSymbol,
  onSelectCurrency,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredCurrencies = WORLD_CURRENCIES.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.symbol.toLowerCase().includes(q)
    );
  });

  const activeItem = WORLD_CURRENCIES.find((c) => c.code === selectedCode);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, filteredCurrencies.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredCurrencies.length) % Math.max(1, filteredCurrencies.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCurrencies[highlightedIndex]) {
        const item = filteredCurrencies[highlightedIndex];
        onSelectCurrency(item.code, item.symbol);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#0F1115] hover:bg-[#161B22] border border-[#1E293B] hover:border-emerald-500/50 rounded-xl px-3 py-2 text-xs font-bold text-white flex items-center justify-between transition-all"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="text-sm">{activeItem?.flag || '🌐'}</span>
          <span className="font-mono text-emerald-400">{selectedCode || 'Select'}</span>
          <span className="text-slate-400 text-[11px]">({selectedSymbol || ''})</span>
          {activeItem && (
            <span className="text-slate-400 text-[10px] truncate hidden sm:inline">
              - {activeItem.name}
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Search Dropdown Overlay */}
      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-[#161B22] border border-[#1E293B] rounded-xl shadow-2xl overflow-hidden max-h-72 flex flex-col">
          {/* Search Header */}
          <div className="p-2 border-b border-[#1E293B] bg-[#0F1115]/80 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search currency (e.g. USD, Euro, SR, Rand)..."
              className="w-full bg-transparent text-xs text-white focus:outline-none placeholder:text-slate-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white text-[10px] px-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Currencies Scrollable List */}
          <div className="overflow-y-auto p-1 divide-y divide-[#1E293B]/40">
            {filteredCurrencies.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No matching currency found for "{searchQuery}".
                <div className="text-[10px] text-slate-500 mt-1">
                  You can type custom codes directly in the inputs beside this picker.
                </div>
              </div>
            ) : (
              filteredCurrencies.map((item, idx) => {
                const isSelected = item.code === selectedCode;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => {
                      onSelectCurrency(item.code, item.symbol);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                        : isHighlighted
                        ? 'bg-slate-800 text-white font-medium'
                        : 'hover:bg-slate-800/80 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-base leading-none">{item.flag || '🌐'}</span>
                      <div className="truncate">
                        <span className="font-mono font-bold text-white">{item.code}</span>
                        <span className="text-slate-400 ml-1.5 font-semibold text-[11px]">({item.symbol})</span>
                        <span className="text-slate-400 text-[10px] ml-2 font-normal hidden sm:inline truncate">
                          {item.name}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
