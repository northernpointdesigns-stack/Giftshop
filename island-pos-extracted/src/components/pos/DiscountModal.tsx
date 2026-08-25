import React, { useState } from 'react';
import { Tag, X, Percent, DollarSign } from 'lucide-react';

interface DiscountModalProps {
  initialType: 'amount' | 'percent';
  initialValue: number;
  primarySymbol: string;
  onApply: (type: 'amount' | 'percent', value: number) => void;
  onClose: () => void;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({
  initialType,
  initialValue,
  primarySymbol,
  onApply,
  onClose,
}) => {
  const [type, setType] = useState<'amount' | 'percent'>(initialType);
  const [value, setValue] = useState(initialValue.toString());

  const PRESETS = [5, 10, 15, 20, 25, 50, 100];

  const handleApply = () => {
    const val = parseFloat(value) || 0;
    onApply(type, val);
  };

  const handleClear = () => {
    onApply('amount', 0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#1E293B] bg-[#0F1115]">
          <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
            <Tag className="w-5 h-5" /> Order Discount
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 space-y-6">
          <div className="flex bg-[#0F1115] border border-[#1E293B] rounded-xl p-1">
            <button
              onClick={() => setType('percent')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                type === 'percent'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Percent className="w-4 h-4" /> Percentage (%)
            </button>
            <button
              onClick={() => setType('amount')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                type === 'amount'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <DollarSign className="w-4 h-4" /> Amount ({primarySymbol})
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {type === 'percent' ? 'Discount Percentage' : 'Discount Amount'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                {type === 'percent' ? '%' : primarySymbol}
              </span>
              <input
                type="number"
                min="0"
                max={type === 'percent' ? 100 : undefined}
                step={type === 'percent' ? '1' : '0.01'}
                value={value}
                onChange={(e) => {
                  let v = parseFloat(e.target.value);
                  if (isNaN(v)) {
                    setValue(e.target.value);
                    return;
                  }
                  if (type === 'percent') {
                    v = Math.min(100, Math.max(0, v));
                  } else {
                    v = Math.max(0, v);
                  }
                  setValue(v.toString());
                }}
                className="w-full bg-[#0F1115] border-2 border-[#1E293B] focus:border-amber-500 rounded-xl pl-12 pr-4 py-4 text-2xl text-amber-400 font-mono font-bold focus:outline-none transition-colors"
                placeholder="0"
                autoFocus
              />
            </div>
          </div>

          {type === 'percent' && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Quick Presets
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      setType('percent');
                      setValue(pct.toString());
                    }}
                    className={`py-3 rounded-xl font-bold font-mono text-sm transition-colors border ${
                      value === pct.toString() && type === 'percent'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-[#0F1115] text-slate-300 border-[#1E293B] hover:border-amber-500/50 hover:text-amber-400'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#1E293B] bg-[#161B22] flex gap-3">
          <button
            onClick={handleClear}
            className="px-4 py-3 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-3 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-500 transition-colors shadow-lg shadow-amber-900/20"
          >
            Apply Discount
          </button>
        </div>
      </div>
    </div>
  );
};
