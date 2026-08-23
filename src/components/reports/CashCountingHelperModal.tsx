import React, { useState } from 'react';
import { Banknote, Coins, X, Calculator, CheckCircle2 } from 'lucide-react';
import { posDb } from '../../services/db';

interface CashCountingHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCount: (totalAmount: number) => void;
}

export const CashCountingHelperModal: React.FC<CashCountingHelperModalProps> = ({
  isOpen,
  onClose,
  onApplyCount,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';

  // Seychelles Banknotes & Coins
  const [denominations, setDenominations] = useState<{ [denom: number]: number }>({
    500: 0,
    100: 0,
    50: 0,
    25: 0,
    10: 0,
    5: 0,
    1: 0,
  });

  if (!isOpen) return null;

  const totalCalculated = Object.entries(denominations).reduce(
    (acc, [val, count]) => acc + parseFloat(val) * count,
    0
  );

  const handleCountChange = (denom: number, count: number) => {
    setDenominations((prev) => ({
      ...prev,
      [denom]: Math.max(0, count || 0),
    }));
  };

  const handleApply = () => {
    onApplyCount(totalCalculated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-0 my-auto">
        {/* Header */}
        <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Denomination Cash Counting Assistant</h2>
              <p className="text-[11px] text-slate-400">Count Seychelles Rupee (SCR) bills & coins</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Denominations List */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {[500, 100, 50, 25, 10, 5, 1].map((denom) => (
            <div
              key={denom}
              className="flex items-center justify-between bg-[#0F1115] p-2.5 rounded-xl border border-[#1E293B] text-xs"
            >
              <div className="flex items-center gap-2">
                {denom >= 25 ? (
                  <Banknote className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Coins className="w-4 h-4 text-amber-400" />
                )}
                <span className="font-bold font-mono text-white">
                  {primarySymbol} {denom} {denom >= 25 ? 'Banknote' : 'Coin'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[10px]">Qty:</span>
                <input
                  type="number"
                  min="0"
                  value={denominations[denom] || ''}
                  onChange={(e) => handleCountChange(denom, parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-16 bg-[#161B22] border border-[#1E293B] focus:border-emerald-500 rounded-lg px-2 py-1 text-center font-mono font-bold text-white focus:outline-none"
                />
                <span className="w-20 text-right font-mono font-bold text-emerald-400">
                  {primarySymbol} {((denominations[denom] || 0) * denom).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Calculated Total Bar */}
        <div className="bg-[#0F1115] border-t border-[#1E293B] p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Calculated Physical Cash:
            </span>
            <span className="text-xl font-mono font-extrabold text-emerald-400">
              {primarySymbol} {totalCalculated.toFixed(2)}
            </span>
          </div>

          <button
            onClick={handleApply}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Apply to Drawer Count</span>
          </button>
        </div>
      </div>
    </div>
  );
};
