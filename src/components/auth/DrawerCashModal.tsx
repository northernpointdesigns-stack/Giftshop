import React, { useState } from 'react';
import {
  X,
  Banknote,
  Landmark,
  ArrowDownToLine,
  ArrowUpFromLine,
  Vault,
  CheckCircle2,
  History,
} from 'lucide-react';
import { posDb } from '../../services/db';
import { StoreSettings, StaffUser, CashDrawerEventType } from '../../types/pos';

interface DrawerCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStaff: StaffUser;
  settings: StoreSettings;
  onChanged: () => void;
}

const MOVEMENT_OPTIONS: {
  type: CashDrawerEventType;
  label: string;
  hint: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  {
    type: 'paid_out',
    label: 'Cash Banked',
    hint: 'Cash taken out of the till and banked / moved to the safe',
    icon: <Landmark className="w-4 h-4" />,
    accent: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
  },
  {
    type: 'cash_drop',
    label: 'Cash Drop',
    hint: 'Cash dropped into the back-office safe to keep the till light',
    icon: <Vault className="w-4 h-4" />,
    accent: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  },
  {
    type: 'paid_in',
    label: 'Cash Paid In',
    hint: 'Extra cash added to the drawer (e.g. change top-up)',
    icon: <ArrowDownToLine className="w-4 h-4" />,
    accent: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  },
];

/**
 * Staff-accessible cash drawer movement logger.
 * Lets any signed-in staff member declare money moved out of (or into) the
 * till during the day — e.g. cash banked at the bank or moved to the safe —
 * so the End-of-Day counted cash balances against the expected figure.
 */
export const DrawerCashModal: React.FC<DrawerCashModalProps> = ({
  isOpen,
  onClose,
  currentStaff,
  settings,
  onChanged,
}) => {
  const activeSession = posDb.getActiveEODSession();
  const currencySymbol = settings.primaryCurrencySymbol || '$';
;

  const [movementType, setMovementType] = useState<CashDrawerEventType>('paid_out');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const parsedAmount = parseFloat(amount);
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0 && reason.trim().length > 0;

  const todaysLogs = activeSession ? posDb.getDrawerLogs(activeSession.id) : [];
  const movements = todaysLogs.filter(
    (l) => l.eventType === 'paid_out' || l.eventType === 'paid_in' || l.eventType === 'cash_drop'
  );
  const totalBanked = movements
    .filter((l) => l.eventType === 'paid_out')
    .reduce((acc, cur) => acc + (cur.amount || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !activeSession) return;

    posDb.recordCashAdjustment(
      movementType,
      Number(parsedAmount.toFixed(2)),
      currentStaff.name,
      reason.trim()
    );

    setSuccessMsg(
      `${MOVEMENT_OPTIONS.find((m) => m.type === movementType)?.label}: ${currencySymbol}${parsedAmount.toFixed(2)} recorded under your name.`
    );
    setAmount('');
    setReason('');
    onChanged();
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-y-auto">
      <div className="w-full max-w-lg bg-[#161B22] border border-[#1E293B] rounded-2xl shadow-2xl relative z-10 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[#1E293B]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Banknote className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Cash Drawer Movements</h2>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Banked cash or moved money must be noted here so the day balances when you close shop.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!activeSession ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No open trading session. The opening float must be declared before drawer movements can be recorded.
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              {/* Live expected drawer */}
              <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Expected Cash Right Now</span>
                <span className="text-lg font-black font-mono text-white">
                  {currencySymbol}{activeSession.expectedCash.toFixed(2)}
                </span>
              </div>
              {successMsg && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-600 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Movement type selector */}
              <div className="grid grid-cols-3 gap-2">
                {MOVEMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setMovementType(opt.type)}
                    title={opt.hint}
                    className={`p-2.5 rounded-xl border font-bold text-[11px] transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                      movementType === opt.type
                        ? opt.accent
                        : 'bg-[#0F1115] border-[#1E293B] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 -mt-2">
                {MOVEMENT_OPTIONS.find((m) => m.type === movementType)?.hint}
              </p>

              {/* Movement form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Amount ({currencySymbol}):
                  </label>
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-lg font-mono font-bold text-white text-center focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Note (required):
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Cash banked at ABC Bank 10:30am deposit slip #4821"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isValid}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowUpFromLine className="w-4 h-4" />
                  Record Movement Under {currentStaff.name}
                </button>
              </form>

              {/* Today's movements list */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Today's Movements ({movements.length})
                  </span>
                  {totalBanked > 0 && (
                    <span className="text-[10px] font-mono text-cyan-300 font-bold">
                      Total banked: {currencySymbol}{totalBanked.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="max-h-44 overflow-y-auto scrollbar-thin space-y-1.5">
                  {movements.length === 0 ? (
                    <p className="text-[11px] text-slate-600 italic py-2 text-center">
                      No drawer movements recorded yet today.
                    </p>
                  ) : (
                    [...movements].reverse().map((log) => (
                      <div
                        key={log.id}
                        className="bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-slate-200 truncate">
                            {log.eventType === 'paid_out'
                              ? '🏦 Cash Banked'
                              : log.eventType === 'cash_drop'
                              ? 'Vault Cash Drop'
                              : '⬇️ Cash Paid In'}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {log.reason} • {log.staffName} •{' '}
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-black font-mono shrink-0 ${
                            log.eventType === 'paid_in' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {log.eventType === 'paid_in' ? '+' : '-'}
                          {currencySymbol}
                          {(log.amount || 0).toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
