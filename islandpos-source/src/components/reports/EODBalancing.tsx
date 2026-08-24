import React, { useState } from 'react';
import {
  Banknote,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  History,
  PlusCircle,
  MinusCircle,
  Vault,
  KeyRound,
  Search,
  Download,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { posDb } from '../../services/db';
import { CashDrawerLog, CashDrawerEventType } from '../../types/pos';

interface EODBalancingProps {
  onRefreshData: () => void;
}

export const EODBalancing: React.FC<EODBalancingProps> = ({ onRefreshData }) => {
  const activeSession = posDb.getActiveEODSession();
  const allSessions = posDb.getEODSessions();
  const activeCashiers = posDb.getActiveCashiers();

  // Open Drawer Form State
  const [openFloatInput, setOpenFloatInput] = useState('200.00');
  const [openStaffInput, setOpenStaffInput] = useState('Jane Doe');

  // Close Drawer Form State
  const [actualCashInput, setActualCashInput] = useState('');
  const [closedByInput, setClosedByInput] = useState('Jane Doe');
  const [closeNotesInput, setCloseNotesInput] = useState('');

  // Cash Adjustment Modal State
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjType, setAdjType] = useState<CashDrawerEventType>('paid_in');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjStaff, setAdjStaff] = useState('Jane Doe');
  const [adjReason, setAdjReason] = useState('');

  // Cash Drawer History Filters
  const [logFilter, setLogFilter] = useState<'all' | 'shift' | 'adjustments' | 'drops' | 'manual'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  const drawerLogs = posDb.getDrawerLogs();

  const actualCashNum = parseFloat(actualCashInput) || 0;
  const expectedCashNum = activeSession ? activeSession.expectedCash : 0;
  const cashDifference = actualCashNum - expectedCashNum;

  const handleOpenDrawer = (e: React.FormEvent) => {
    e.preventDefault();
    const floatNum = parseFloat(openFloatInput) || 200;
    posDb.openEODSession(floatNum, 'Drawer float initialized.', openStaffInput);
    onRefreshData();
  };

  const handleCloseDrawer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    if (
      confirm(
        `Close Cash Drawer? Expected cash is $${expectedCashNum.toFixed(2)}, Actual counted is $${actualCashNum.toFixed(2)}.`
      )
    ) {
      posDb.closeEODSession(actualCashNum, closedByInput, closeNotesInput);
      setActualCashInput('');
      setCloseNotesInput('');
      onRefreshData();
    }
  };

  const handleOpenAdjustmentModal = (type: CashDrawerEventType) => {
    setAdjType(type);
    setAdjAmount(type === 'manual_open' ? '0.00' : '');
    setAdjReason('');
    setIsAdjustmentModalOpen(true);
  };

  const handleSubmitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(adjAmount) || 0;

    if (adjType !== 'manual_open' && amt <= 0) {
      alert('Please enter a valid positive dollar amount for this cash adjustment.');
      return;
    }

    if (!adjReason.trim()) {
      alert('Please enter a short reason/note for this cash drawer entry.');
      return;
    }

    posDb.recordCashAdjustment(
      adjType as 'paid_in' | 'paid_out' | 'cash_drop' | 'manual_open',
      amt,
      adjStaff,
      adjReason.trim()
    );

    setIsAdjustmentModalOpen(false);
    setAdjAmount('');
    setAdjReason('');
    onRefreshData();
  };

  // Filter drawer history logs
  const filteredLogs = drawerLogs.filter((log) => {
    // Filter by tab
    let matchesTab = true;
    if (logFilter === 'shift') {
      matchesTab = log.eventType === 'open' || log.eventType === 'close';
    } else if (logFilter === 'adjustments') {
      matchesTab = log.eventType === 'paid_in' || log.eventType === 'paid_out';
    } else if (logFilter === 'drops') {
      matchesTab = log.eventType === 'cash_drop';
    } else if (logFilter === 'manual') {
      matchesTab = log.eventType === 'manual_open';
    }

    // Filter by search query
    const q = logSearchQuery.trim().toLowerCase();
    let matchesSearch = true;
    if (q) {
      matchesSearch =
        log.staffName.toLowerCase().includes(q) ||
        log.reason.toLowerCase().includes(q) ||
        log.eventType.toLowerCase().includes(q) ||
        (log.sessionId && log.sessionId.toLowerCase().includes(q));
    }

    return matchesTab && matchesSearch;
  });

  // Calculate stats summary from logs
  const totalPaidIn = drawerLogs
    .filter((l) => l.eventType === 'paid_in')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const totalPaidOut = drawerLogs
    .filter((l) => l.eventType === 'paid_out')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const totalCashDrops = drawerLogs
    .filter((l) => l.eventType === 'cash_drop')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Export CSV of Drawer Logs
  const handleExportCsv = () => {
    const headers = ['ID', 'Timestamp', 'Event Type', 'Staff Member', 'Amount ($)', 'Drawer Float After ($)', 'Reason / Notes'];
    const rows = filteredLogs.map((l) => [
      l.id,
      new Date(l.timestamp).toLocaleString(),
      l.eventType.toUpperCase(),
      `"${l.staffName}"`,
      l.amount !== undefined ? l.amount.toFixed(2) : '0.00',
      l.currentFloatAfter !== undefined ? l.currentFloatAfter.toFixed(2) : 'N/A',
      `"${l.reason.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cash_drawer_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getEventBadge = (type: CashDrawerEventType) => {
    switch (type) {
      case 'open':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            SHIFT OPEN
          </span>
        );
      case 'close':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold bg-slate-700 text-slate-300 border border-slate-600">
            SHIFT CLOSE
          </span>
        );
      case 'paid_in':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            PAID IN (+)
          </span>
        );
      case 'paid_out':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            PAID OUT (-)
          </span>
        );
      case 'cash_drop':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            SAFE DROP (-)
          </span>
        );
      case 'manual_open':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            NO-SALE OPEN
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161B22] border border-[#1E293B] p-4 rounded-2xl shadow-md">
        <div>
          <h2 className="text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-400" /> End-of-Day Drawer Balancing & Reconciliation
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Balancing starting float, expected cash sales, manual paid ins/outs, safe drops, and audit history
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSession ? (
            <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-bold">
              <Unlock className="w-4 h-4 text-emerald-400" /> Shift Register Open
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-rose-500/10 text-rose-300 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-bold">
              <Lock className="w-4 h-4 text-rose-400" /> Shift Register Closed
            </span>
          )}
        </div>
      </div>

      {/* Active Session Balancing Card & Toolbar */}
      {activeSession ? (
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E293B] pb-4">
            <div>
              <h3 className="font-bold text-base text-[#E2E8F0]">
                Current Shift Cash Drawer Session
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Opened at {new Date(activeSession.openedAt).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Active Session ID:</span>
              <span className="font-mono text-xs font-bold text-slate-200 ml-1">
                {activeSession.id}
              </span>
            </div>
          </div>

          {/* Session Math Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 font-mono text-xs">
            <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
              <div className="text-[10px] text-slate-500 uppercase">Starting Float</div>
              <div className="text-base font-bold text-[#E2E8F0] mt-0.5">
                ${activeSession.startingFloat.toFixed(2)}
              </div>
            </div>

            <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
              <div className="text-[10px] text-emerald-500 uppercase">+ Cash Sales</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">
                +${activeSession.cashSales.toFixed(2)}
              </div>
            </div>

            <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
              <div className="text-[10px] text-blue-400 uppercase">+ Paid In</div>
              <div className="text-base font-bold text-blue-400 mt-0.5">
                +${(activeSession.paidInTotal || 0).toFixed(2)}
              </div>
            </div>

            <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
              <div className="text-[10px] text-amber-400 uppercase">- Paid Out</div>
              <div className="text-base font-bold text-amber-400 mt-0.5">
                -${(activeSession.paidOutTotal || 0).toFixed(2)}
              </div>
            </div>

            <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
              <div className="text-[10px] text-purple-400 uppercase">- Cash Drop</div>
              <div className="text-base font-bold text-purple-400 mt-0.5">
                -${(activeSession.cashDropTotal || 0).toFixed(2)}
              </div>
            </div>

            <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
              <div className="text-[10px] text-slate-500 uppercase">Card (Terminal)</div>
              <div className="text-base font-bold text-cyan-400 mt-0.5">
                ${activeSession.cardSales.toFixed(2)}
              </div>
            </div>

            <div className="bg-[#0F1115] p-3 rounded-xl border border-emerald-500/50 shadow-xs col-span-2 sm:col-span-1">
              <div className="text-[10px] text-emerald-400 uppercase font-bold">
                Expected Cash
              </div>
              <div className="text-lg font-black text-emerald-400 mt-0.5">
                ${activeSession.expectedCash.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Manual Cash Adjustments Action Toolbar */}
          <div className="bg-[#0F1115] p-4 rounded-xl border border-[#1E293B] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-400" /> Live Drawer Adjustments & Cash Drop Actions
              </h4>
              <span className="text-[11px] text-slate-500 hidden sm:inline">Record non-sale drawer entries</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenAdjustmentModal('paid_in')}
                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Cash Paid In (+)</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAdjustmentModal('paid_out')}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <MinusCircle className="w-4 h-4" />
                <span>Cash Paid Out (-)</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAdjustmentModal('cash_drop')}
                className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Vault className="w-4 h-4" />
                <span>Safe Cash Drop (-)</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAdjustmentModal('manual_open')}
                className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <KeyRound className="w-4 h-4" />
                <span>No-Sale Kick Drawer</span>
              </button>
            </div>
          </div>

          {/* Close Shift Reconciliation Form */}
          <form onSubmit={handleCloseDrawer} className="bg-[#0F1115] p-5 rounded-xl border border-[#1E293B] space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Perform End of Shift Drawer Count
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Actual Cash Counted in Drawer ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  placeholder="Count physical bills + coins in drawer..."
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-lg font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cashier / Supervisor Signature
                </label>
                <select
                  value={closedByInput}
                  onChange={(e) => setClosedByInput(e.target.value)}
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-medium"
                >
                  {activeCashiers.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.role.replace('_', ' ')})
                    </option>
                  ))}
                  <option value="Maya Cashier">Maya Cashier (Standard)</option>
                </select>
              </div>
            </div>

            {/* Live Cash Variance Calculation */}
            {actualCashInput !== '' && (
              <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                cashDifference === 0
                  ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                  : cashDifference > 0
                  ? 'bg-blue-950/50 border-blue-800 text-blue-300'
                  : 'bg-rose-950/50 border-rose-800 text-rose-300'
              }`}>
                <span className="font-semibold flex items-center gap-1.5">
                  {cashDifference === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  )}
                  Drawer Variance / Disparity:
                </span>
                <span className="font-mono font-bold text-sm">
                  {cashDifference === 0
                    ? 'Perfect Balance ($0.00)'
                    : cashDifference > 0
                    ? `Over +$${cashDifference.toFixed(2)}`
                    : `Short -$${Math.abs(cashDifference).toFixed(2)}`}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                EOD Shift Notes / Disparity Reason
              </label>
              <input
                type="text"
                value={closeNotesInput}
                onChange={(e) => setCloseNotesInput(e.target.value)}
                placeholder="e.g. Clean drawer close, $0 variance."
                className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-rose-600 hover:bg-rose-500 text-white py-3 px-4 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Close Shift & Seal Cash Drawer</span>
            </button>
          </form>
        </div>
      ) : (
        /* Open Shift Drawer Form */
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 shadow-xl max-w-md mx-auto space-y-4 text-center">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
            <Unlock className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-[#E2E8F0]">
            Open New Register Shift
          </h3>
          <p className="text-xs text-slate-400">
            Enter starting cash float to open drawer for sales
          </p>

          <form onSubmit={handleOpenDrawer} className="space-y-3 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Starting Cash Float ($)
              </label>
              <input
                type="number"
                step="5.00"
                min="0"
                value={openFloatInput}
                onChange={(e) => setOpenFloatInput(e.target.value)}
                className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-base font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Opening Cashier / Supervisor
              </label>
              <select
                value={openStaffInput}
                onChange={(e) => setOpenStaffInput(e.target.value)}
                className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-medium"
              >
                {activeCashiers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-4 rounded-xl font-bold text-xs transition-all shadow-md"
            >
              Start Shift Session
            </button>
          </form>
        </div>
      )}

      {/* NEW: Cash Drawer History & Audit Trail Section */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
          <div>
            <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 uppercase tracking-wider">
              <History className="w-4 h-4 text-emerald-400" /> Cash Drawer History & Audit Log
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive audit trail tracking open/close drawer events, cash drops, paid ins, and paid outs
            </p>
          </div>

          <button
            onClick={handleExportCsv}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
            title="Export filtered cash drawer logs to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Audit Stats Metric Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
            <span className="text-[10px] text-slate-500 uppercase">Total Audit Entries</span>
            <p className="text-base font-bold text-[#E2E8F0] mt-0.5">{drawerLogs.length} Events</p>
          </div>
          <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
            <span className="text-[10px] text-blue-400 uppercase">Total Paid In</span>
            <p className="text-base font-bold text-blue-400 mt-0.5">+${totalPaidIn.toFixed(2)}</p>
          </div>
          <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
            <span className="text-[10px] text-amber-400 uppercase">Total Paid Out</span>
            <p className="text-base font-bold text-amber-400 mt-0.5">-${totalPaidOut.toFixed(2)}</p>
          </div>
          <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
            <span className="text-[10px] text-purple-400 uppercase">Total Safe Drops</span>
            <p className="text-base font-bold text-purple-400 mt-0.5">-${totalCashDrops.toFixed(2)}</p>
          </div>
        </div>

        {/* Filter Tabs & Search Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
            <button
              onClick={() => setLogFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                logFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-[#0F1115] text-slate-400 hover:text-slate-200 border border-[#1E293B]'
              }`}
            >
              All Events ({drawerLogs.length})
            </button>
            <button
              onClick={() => setLogFilter('shift')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                logFilter === 'shift'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-[#0F1115] text-slate-400 hover:text-slate-200 border border-[#1E293B]'
              }`}
            >
              Open/Close Shift
            </button>
            <button
              onClick={() => setLogFilter('adjustments')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                logFilter === 'adjustments'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-[#0F1115] text-slate-400 hover:text-slate-200 border border-[#1E293B]'
              }`}
            >
              Paid In / Out
            </button>
            <button
              onClick={() => setLogFilter('drops')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                logFilter === 'drops'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-[#0F1115] text-slate-400 hover:text-slate-200 border border-[#1E293B]'
              }`}
            >
              Safe Drops
            </button>
            <button
              onClick={() => setLogFilter('manual')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                logFilter === 'manual'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-[#0F1115] text-slate-400 hover:text-slate-200 border border-[#1E293B]'
              }`}
            >
              No-Sale Open
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              placeholder="Search staff or reason..."
              className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none"
            />
          </div>
        </div>

        {/* Drawer Audit History Table */}
        <div className="overflow-x-auto rounded-xl border border-[#1E293B]">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0F1115] text-slate-400 font-semibold border-b border-[#1E293B]">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Event Type</th>
                <th className="p-3">Staff Member</th>
                <th className="p-3 text-right">Adjustment Amount</th>
                <th className="p-3 text-right">Drawer Float After</th>
                <th className="p-3">Reason / Audit Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] bg-[#161B22]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                    No cash drawer logs match your current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isPositive = log.eventType === 'paid_in' || log.eventType === 'open';
                  const isNegative = log.eventType === 'paid_out' || log.eventType === 'cash_drop';

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {getEventBadge(log.eventType)}
                      </td>
                      <td className="p-3 font-semibold text-[#E2E8F0] whitespace-nowrap">
                        {log.staffName}
                      </td>
                      <td
                        className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                          isPositive
                            ? 'text-emerald-400'
                            : isNegative
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {log.eventType === 'manual_open'
                          ? '$0.00'
                          : log.amount !== undefined
                          ? `${isPositive ? '+' : isNegative ? '-' : ''}$${log.amount.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="p-3 text-right font-mono font-medium text-slate-300 whitespace-nowrap">
                        {log.currentFloatAfter !== undefined
                          ? `$${log.currentFloatAfter.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="p-3 text-slate-300 max-w-xs truncate" title={log.reason}>
                        {log.reason}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical EOD Shift Log Table */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <History className="w-4 h-4 text-emerald-400" /> Historical EOD Shift Balances
        </h3>

        <div className="overflow-x-auto rounded-xl border border-[#1E293B]">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0F1115] text-slate-400 font-semibold border-b border-[#1E293B]">
              <tr>
                <th className="p-3">Session Date</th>
                <th className="p-3">Opened</th>
                <th className="p-3 text-right">Starting Float</th>
                <th className="p-3 text-right">Cash Sales</th>
                <th className="p-3 text-right">Adjustments</th>
                <th className="p-3 text-right">Expected Cash</th>
                <th className="p-3 text-right">Actual Count</th>
                <th className="p-3 text-right">Disparity</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] bg-[#161B22]">
              {allSessions.map((s) => {
                const adjSum = (s.paidInTotal || 0) - (s.paidOutTotal || 0) - (s.cashDropTotal || 0);
                return (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-[#E2E8F0]">{s.date}</td>
                    <td className="p-3 text-slate-400">
                      {new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 text-right font-mono">${s.startingFloat.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono text-emerald-400">
                      +${s.cashSales.toFixed(2)}
                    </td>
                    <td
                      className={`p-3 text-right font-mono ${
                        adjSum < 0 ? 'text-amber-400' : adjSum > 0 ? 'text-blue-400' : 'text-slate-500'
                      }`}
                    >
                      {adjSum === 0 ? '$0.00' : `${adjSum > 0 ? '+' : ''}$${adjSum.toFixed(2)}`}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">${s.expectedCash.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono">
                      {s.actualCash !== undefined ? `$${s.actualCash.toFixed(2)}` : '—'}
                    </td>
                    <td
                      className={`p-3 text-right font-mono font-bold ${
                        (s.cashDifference || 0) < 0
                          ? 'text-rose-400'
                          : (s.cashDifference || 0) > 0
                          ? 'text-blue-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {s.cashDifference !== undefined
                        ? `${s.cashDifference >= 0 ? '+' : ''}$${s.cashDifference.toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold ${
                          s.status === 'open'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Cash Adjustment Modal */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F1115]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-400" />
                <span>
                  {adjType === 'paid_in' && 'Record Cash Paid In (+)'}
                  {adjType === 'paid_out' && 'Record Cash Paid Out (-)'}
                  {adjType === 'cash_drop' && 'Record Safe Cash Drop (-)'}
                  {adjType === 'manual_open' && 'Record No-Sale Manual Drawer Opening'}
                </span>
              </h3>
              <button
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Adjustment Type
                </label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as CashDrawerEventType)}
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="paid_in">Paid In (+) - Add Petty Cash / Float Top-up</option>
                  <option value="paid_out">Paid Out (-) - Cash Store Expense or Vendor Payment</option>
                  <option value="cash_drop">Safe Cash Drop (-) - Transfer Cash to Safe</option>
                  <option value="manual_open">No-Sale Open Drawer ($0.00 audit check)</option>
                </select>
              </div>

              {adjType !== 'manual_open' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cash Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-base font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Staff Member / Authorizer
                </label>
                <select
                  value={adjStaff}
                  onChange={(e) => setAdjStaff(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-medium"
                >
                  {activeCashiers.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason / Audit Description <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder={
                    adjType === 'paid_in'
                      ? 'e.g. Added $50 petty change float'
                      : adjType === 'paid_out'
                      ? 'e.g. Purchased $15 receipt paper rolls'
                      : adjType === 'cash_drop'
                      ? 'e.g. $200 safe transfer mid-shift'
                      : 'e.g. Checked cash drawer mechanism'
                  }
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
