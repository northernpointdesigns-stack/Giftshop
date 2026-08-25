import React, { useState } from 'react';
import {
  Store,
  Banknote,
  ArrowRight,
  Wallet,
  CalendarDays,
} from 'lucide-react';
import { posDb } from '../../services/db';

interface OpeningFloatGateProps {
  storeName: string;
  storeTagline?: string;
  cashierName: string;
  currencySymbol: string;
  onConfirmed: () => void;
}

/**
 * Welcome screen shown right after cashier sign-in.
 * The cashier MUST declare the opening cash float for the day before
 * the register becomes usable — this creates the EOD session record.
 */
export const OpeningFloatGate: React.FC<OpeningFloatGateProps> = ({
  storeName,
  storeTagline,
  cashierName,
  currencySymbol,
  onConfirmed,
}) => {
  const [floatAmount, setFloatAmount] = useState('');
  const parsed = parseFloat(floatAmount);
  const isValid = !isNaN(parsed) && parsed >= 0 && floatAmount.trim() !== '';

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    // Creates the EOD session + drawer audit log via db layer
    posDb.openEODSession(
      Number(parsed.toFixed(2)),
      `Day opened by ${cashierName}`,
      cashierName
    );
    onConfirmed();
  };

  const quickAmounts = [100, 200, 500];

  return (
    <main className="min-h-screen bg-[#0F1115] text-[#E2E8F0] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Welcome header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Store className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mt-4 tracking-tight">
            Welcome to {storeName}
          </h1>
          {storeTagline && (
            <p className="text-sm text-slate-400 mt-1">{storeTagline}</p>
          )}
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-400">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{today}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-[#0F1115] border border-[#1E293B] text-xs font-semibold text-emerald-300">
            Signed in: {cashierName}
          </div>
        </div>

        {/* Cash float form */}
        <form onSubmit={handleConfirm} className="space-y-4">
          <div className="rounded-xl bg-[#0F1115] border border-[#1E293B] p-4">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
              <Wallet className="w-4 h-4 text-amber-400" />
              Opening Cash Float — Required
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              Count the cash in your drawer and enter the total below. The day cannot start without a declared float.
            </p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-amber-400">
                {currencySymbol}
              </span>
              <input
                autoFocus
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={floatAmount}
                onChange={(e) => setFloatAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl pl-12 pr-4 py-3.5 text-2xl font-mono font-bold text-white text-center focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Quick-select amounts */}
            <div className="flex items-center justify-center gap-2 mt-3">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setFloatAmount(String(amt))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    floatAmount === String(amt)
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-[#161B22] text-slate-400 border border-[#1E293B] hover:text-slate-200'
                  }`}
                >
                  {currencySymbol}{amt}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!isValid}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Banknote className="w-4 h-4" />
            Declare Float & Open Register
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-slate-500 text-center mt-5">
          Your float declaration is recorded in the cash drawer audit log with your name.
        </p>
      </div>
    </main>
  );
};