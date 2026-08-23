import React, { useState } from 'react';
import {
  Receipt,
  Play,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  Lock,
  Printer,
  History,
  TrendingUp,
  Banknote,
  CreditCard,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { EODSession } from '../../types/pos';
import { posDb } from '../../services/db';
import { CashCountingHelperModal } from './CashCountingHelperModal';
import { EODSummaryPrintModal } from './EODSummaryPrintModal';
import { soundService } from '../../services/audio';

interface EODBalancingProps {
  onRefresh: () => void;
}

export const EODBalancing: React.FC<EODBalancingProps> = ({ onRefresh }) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const cashiers = posDb.getActiveCashiers();

  const activeSession = posDb.getActiveEODSession();
  const pastSessions = posDb.getEODSessions().filter((s) => s.status === 'closed');

  // Start Shift Form
  const [openingFloatInput, setOpeningFloatInput] = useState('1500');
  const [selectedCashier, setSelectedCashier] = useState(cashiers[0]?.name || 'Alain Morel');

  // Close Shift Form
  const [actualCountedInput, setActualCountedInput] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  // Modals
  const [isCounterModalOpen, setIsCounterModalOpen] = useState(false);
  const [sessionToPrint, setSessionToPrint] = useState<EODSession | null>(null);

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    const floatVal = parseFloat(openingFloatInput) || 0;
    posDb.startEODSession(selectedCashier, floatVal);
    soundService.playSuccessChime();
    onRefresh();
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    const countedVal = parseFloat(actualCountedInput);
    if (isNaN(countedVal)) return;

    const closed = posDb.closeEODSession(activeSession.id, countedVal, closeNotes);
    soundService.playSuccessChime();
    setSessionToPrint(closed);
    setActualCountedInput('');
    setCloseNotes('');
    onRefresh();
  };

  // Re-calculate live stats for active session
  let liveCashDiscrepancy = 0;
  if (activeSession && actualCountedInput !== '') {
    const countedVal = parseFloat(actualCountedInput) || 0;
    liveCashDiscrepancy = countedVal - activeSession.expectedCash;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0D13] p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Receipt className="w-6 h-6 text-emerald-400" />
              <span>End-of-Day (EOD) Shift Balancing & Drawer Reconciliation</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Track opening cash floats, real-time tender tallies, over/short discrepancies, and print official Z-Reports
            </p>
          </div>
        </div>

        {/* Active Shift Management Card */}
        {activeSession ? (
          <div className="bg-[#161B22] border border-emerald-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">Active Register Shift</h2>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono">
                      #{activeSession.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Opened at {new Date(activeSession.openedAt).toLocaleTimeString()} by{' '}
                    <strong className="text-emerald-300">{activeSession.cashierName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCounterModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <Calculator className="w-4 h-4 text-emerald-400" />
                  <span>Denomination Calculator</span>
                </button>
              </div>
            </div>

            {/* Shift Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0F1115] p-3.5 rounded-xl border border-[#1E293B]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Opening Drawer Float
                </span>
                <span className="text-base sm:text-lg font-mono font-bold text-white mt-1 block">
                  {primarySymbol} {activeSession.openingFloat.toFixed(2)}
                </span>
              </div>

              <div className="bg-[#0F1115] p-3.5 rounded-xl border border-[#1E293B]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Net Cash Sales
                </span>
                <span className="text-base sm:text-lg font-mono font-bold text-emerald-400 mt-1 block">
                  +{primarySymbol} {activeSession.totalCashSales.toFixed(2)}
                </span>
              </div>

              <div className="bg-[#0F1115] p-3.5 rounded-xl border border-[#1E293B]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Digital / Card Sales
                </span>
                <span className="text-base sm:text-lg font-mono font-bold text-cyan-400 mt-1 block">
                  {primarySymbol} {activeSession.totalCardSales.toFixed(2)}
                </span>
              </div>

              <div className="bg-[#0F1115] p-3.5 rounded-xl border border-[#1E293B]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Expected Drawer Cash
                </span>
                <span className="text-base sm:text-lg font-mono font-extrabold text-amber-400 mt-1 block">
                  {primarySymbol} {activeSession.expectedCash.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Close Shift Form */}
            <form onSubmit={handleCloseShift} className="bg-[#0F1115] p-4 sm:p-5 rounded-xl border border-[#1E293B] space-y-4">
              <h3 className="text-sm font-bold text-white">Reconcile & Close Active Shift</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Actual Counted Physical Cash in Drawer ({primarySymbol}){' '}
                    <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={actualCountedInput}
                      onChange={(e) => setActualCountedInput(e.target.value)}
                      placeholder="e.g. 1500.00"
                      className="w-full bg-[#161B22] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2.5 text-base font-mono font-bold text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Shift Reconciliation Notes
                  </label>
                  <input
                    type="text"
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    placeholder="e.g. Float balanced, petty cash 50 SCR for tape"
                    className="w-full bg-[#161B22] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* Over / Short Warning Banner */}
              {actualCountedInput !== '' && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    Math.abs(liveCashDiscrepancy) < 0.5
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : liveCashDiscrepancy > 0
                      ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {Math.abs(liveCashDiscrepancy) < 0.5 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>
                      {Math.abs(liveCashDiscrepancy) < 0.5
                        ? 'Drawer Perfectly Balanced (Zero Variance)'
                        : liveCashDiscrepancy > 0
                        ? `Drawer is OVER by ${primarySymbol} ${liveCashDiscrepancy.toFixed(2)}`
                        : `Drawer is SHORT by ${primarySymbol} ${Math.abs(liveCashDiscrepancy).toFixed(2)}`}
                    </span>
                  </div>
                  <span className="font-mono font-bold">
                    Diff: {primarySymbol} {liveCashDiscrepancy.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={actualCountedInput === ''}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-rose-950/40"
                >
                  <Lock className="w-4 h-4" />
                  <span>Close Shift & Generate Z-Report</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Start New Shift Form */
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#1E293B]">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Play className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Start New Cashier Shift</h2>
                <p className="text-xs text-slate-400">Open cash drawer with morning initial float</p>
              </div>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Opening Cashier Staff
                  </label>
                  <select
                    value={selectedCashier}
                    onChange={(e) => setSelectedCashier(e.target.value)}
                    className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2.5 text-white"
                  >
                    {cashiers.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.role.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Opening Cash Float ({primarySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={openingFloatInput}
                    onChange={(e) => setOpeningFloatInput(e.target.value)}
                    className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2.5 font-mono font-bold text-emerald-400 text-base"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Open Drawer & Begin Shift</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Historical Z-Reports Table */}
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" /> Historical Reconciled Z-Reports
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0F1115] text-slate-400 uppercase text-[10px] font-bold border-b border-[#1E293B]">
                <tr>
                  <th className="p-3">Shift ID</th>
                  <th className="p-3">Cashier</th>
                  <th className="p-3">Closed Time</th>
                  <th className="p-3 text-right">Total Sales</th>
                  <th className="p-3 text-right">Counted Cash</th>
                  <th className="p-3 text-right">Discrepancy</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {pastSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-cyan-400">
                      {session.id}
                    </td>
                    <td className="p-3 font-semibold text-white">{session.cashierName}</td>
                    <td className="p-3 text-slate-400">
                      {session.closedAt ? new Date(session.closedAt).toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-400">
                      {primarySymbol} {session.totalSales.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono text-white">
                      {primarySymbol} {session.actualCountedCash.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      <span
                        className={
                          Math.abs(session.cashDiscrepancy) < 0.5
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }
                      >
                        {session.cashDiscrepancy > 0 ? '+' : ''}
                        {primarySymbol} {session.cashDiscrepancy.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSessionToPrint(session)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 flex items-center gap-1 ml-auto"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Z-Report</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals */}
        <CashCountingHelperModal
          isOpen={isCounterModalOpen}
          onClose={() => setIsCounterModalOpen(false)}
          onApplyCount={(amount) => setActualCountedInput(amount.toFixed(2))}
        />

        {sessionToPrint && (
          <EODSummaryPrintModal
            session={sessionToPrint}
            isOpen={Boolean(sessionToPrint)}
            onClose={() => setSessionToPrint(null)}
          />
        )}
      </div>
    </div>
  );
};
