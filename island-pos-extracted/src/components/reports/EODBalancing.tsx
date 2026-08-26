import React, { useState } from 'react';
import { Banknote, FileSpreadsheet, History, Lock, Search, Unlock } from 'lucide-react';
import { posDb } from '../../services/db';
import type { CashDrawerEventType } from '../../types/pos';

export const EODBalancing: React.FC = () => {

  // History/audit-only — live cash count / adjustments moved to CloseShiftModal.
  const allSessions = posDb.getEODSessions();
  const activeSession = posDb.getActiveEODSession();

  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';

  // Cash Drawer History Filters
  const [logFilter, setLogFilter] = useState<'all' | 'shift' | 'adjustments' | 'drops' | 'manual'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  const drawerLogs = posDb.getDrawerLogs();

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

  // Export CSV of Drawer Logs
  const handleExportCsv = () => {
    const headers = ['ID', 'Timestamp', 'Event Type', 'Staff Member', `Amount (${primarySymbol})`, `Drawer Float After (${primarySymbol})`, 'Reason / Notes'];
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
            <Banknote className="w-5 h-5 text-emerald-400" /> Cash Drawer History &amp; Audit Trail
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Historical record of every drawer session, adjustment, and safe drop. Live shift balancing, drawer
            adjustments, and closing now happen in the Close Shop popup (Sidebar &rarr; Close Shop).
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

      {/* Cash Drawer History & Audit Trail Section */}
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
          </div>
          <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
            <span className="text-[10px] text-amber-400 uppercase">Total Paid Out</span>
          </div>
          <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
            <span className="text-[10px] text-purple-400 uppercase">Total Safe Drops</span>
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
                          ? `${primarySymbol} 0.00`
                          : log.amount !== undefined
                          ? `${isPositive ? '+' : isNegative ? '-' : ''}${primarySymbol}${log.amount.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="p-3 text-right font-mono font-medium text-slate-300 whitespace-nowrap">
                        {log.currentFloatAfter !== undefined
                          ? `${primarySymbol}${log.currentFloatAfter.toFixed(2)}`
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
                    <td className="p-3 text-right font-mono">{primarySymbol} {s.startingFloat.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono text-emerald-400">
                      +{primarySymbol}{s.cashSales.toFixed(2)}
                    </td>
                    <td
                      className={`p-3 text-right font-mono ${
                        adjSum < 0 ? 'text-amber-400' : adjSum > 0 ? 'text-blue-400' : 'text-slate-500'
                      }`}
                    >
                      {adjSum === 0 ? `${primarySymbol} 0.00` : `${adjSum > 0 ? '+' : ''}${primarySymbol}${adjSum.toFixed(2)}`}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">{primarySymbol} {s.expectedCash.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono">
                      {s.actualCash !== undefined ? `${primarySymbol}${s.actualCash.toFixed(2)}` : '—'}
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
                        ? `${s.cashDifference >= 0 ? '+' : ''}${primarySymbol}${s.cashDifference.toFixed(2)}`
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
    </div>
  );
};
