import React, { useState } from 'react';
import { posDb } from '../../services/db';
import { X, Vault, PlusCircle, MinusCircle, Wallet } from 'lucide-react';
import { CashDrawerEventType } from '../../types/pos';

interface CashDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffName: string;
}

export const CashDrawerModal: React.FC<CashDrawerModalProps> = ({
  isOpen,
  onClose,
  staffName,
}) => {
  const [eventType, setEventType] = useState<CashDrawerEventType>('paid_out');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!isNaN(val) && val > 0 && reason.trim()) {
      posDb.recordDrawerLog({
        eventType,
        amount: val,
        staffName,
        reason: reason.trim(),
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            Cash Drawer Entry (Petty Cash)
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-xs text-slate-400">
          Record any cash added to or removed from the float for store expenses (snacks, stationary, change top-ups). This will balance your end of day totals.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setEventType('paid_out')}
              className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                eventType === 'paid_out'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                  : 'bg-[#0F1115] border-[#1E293B] text-slate-400 hover:bg-slate-800'
              }`}
            >
              <MinusCircle className="w-6 h-6" />
              <span className="text-xs font-bold uppercase tracking-wider">Paid Out (-)</span>
            </button>

            <button
              type="button"
              onClick={() => setEventType('paid_in')}
              className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                eventType === 'paid_in'
                  ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                  : 'bg-[#0F1115] border-[#1E293B] text-slate-400 hover:bg-slate-800'
              }`}
            >
              <PlusCircle className="w-6 h-6" />
              <span className="text-xs font-bold uppercase tracking-wider">Paid In (+)</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Amount (Cash)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="0.00"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Reason / Description</label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="e.g., Emergency stationary, snacks..."
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2"
            >
              <Vault className="w-4 h-4" />
              Save Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
