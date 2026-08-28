import React, { useState, useMemo } from 'react';
import { Transaction, InventoryItem } from '../../types/pos';
import {
  Search,
  Calendar,
  FileText,
  RotateCcw,
  Printer,
  ShieldCheck,
  Building,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { posDb } from '../../services/db';
import { printThermalReceipt } from '../../utils/printThermalReceipt';
import { printStandardInvoice } from '../../utils/printStandardInvoice';
import { ReceiptLookupModal } from '../receipts/ReceiptLookupModal';
import { auditReceiptTransaction } from '../../services/receiptAuditEngine';

interface TransactionHistoryProps {
  transactions: Transaction[];
  onRefreshData: () => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  // Show only today's transactions by default. A store runs for years, so the
  // ledger must never dump the full history into the DOM — a cashier widens the
  // date range only when they actually need to inspect older days.
  // NOTE: must be the *local* calendar date so the default matches the local
  // date filter (a UTC key would exclude "today" around midnight / non-UTC zones).
  const todayKey = (() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  })();
  const [dateFrom, setDateFrom] = useState(todayKey);
  const [dateTo, setDateTo] = useState(todayKey);
  const [statusFilter, setStatusFilter] = useState<'all' | 'sales' | 'refunds' | 'flagged'>('all');
  const [auditingReceiptNumber, setAuditingReceiptNumber] = useState<string | null>(null);

  const settings = posDb.getSettings();
  const inventory = posDb.getInventory();
  const primarySymbol = settings.primaryCurrencySymbol || '$';
;
  const primaryCode = settings.primaryCurrency || 'USD';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';

  // Memoize audit results for all transactions to flag discrepancies
  const auditStatusMap = useMemo(() => {
    const map = new Map<string, 'passed' | 'warning' | 'discrepancy'>();
    transactions.forEach((tx) => {
      const report = auditReceiptTransaction(tx, inventory, settings);
      map.set(tx.id, report.status);
    });
    return map;
  }, [transactions, inventory, settings]);

  const flaggedCount = useMemo(() => {
    let count = 0;
    auditStatusMap.forEach((status) => {
      if (status !== 'passed') count++;
    });
    return count;
  }, [auditStatusMap]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      let matchesSearch = true;
      let matchesDate = true;
      let matchesStatus = true;

      // Status filter
      if (statusFilter === 'sales') {
        matchesStatus = !tx.isRefund;
      } else if (statusFilter === 'refunds') {
        matchesStatus = !!tx.isRefund;
      } else if (statusFilter === 'flagged') {
        matchesStatus = auditStatusMap.get(tx.id) !== 'passed';
      }

      // Search query matches Receipt ID, Customer Name, or Phone
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesReceipt = tx.receiptNumber.toLowerCase().includes(q);
        const matchesCustomer = tx.customerName?.toLowerCase().includes(q) || false;
        const matchesCashier = tx.cashierName.toLowerCase().includes(q);
        matchesSearch = matchesReceipt || matchesCustomer || matchesCashier;
      }

      // Date range filter
      if (dateFrom || dateTo) {
        const txDate = new Date(tx.timestamp);
        txDate.setHours(0, 0, 0, 0);

        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (txDate < fromDate) matchesDate = false;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(0, 0, 0, 0);
          if (txDate > toDate) matchesDate = false;
        }
      }

      return matchesStatus && matchesSearch && matchesDate;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transactions, statusFilter, searchQuery, dateFrom, dateTo, auditStatusMap]);

  // Even with a deliberately widened range, guard the DOM so a multi-year store
  // never renders thousands of rows at once (perf + readability).
  const MAX_RENDERED_ROWS = 500;
  const visibleTransactions = filteredTransactions.slice(0, MAX_RENDERED_ROWS);
  const capped = filteredTransactions.length > visibleTransactions.length;

  const handlePrintThermal = (e: React.MouseEvent, tx: Transaction) => {
    e.stopPropagation();
    printThermalReceipt(tx, settings, settings.thermalReceiptWidth || '80mm');
  };

  const handlePrintA4 = (e: React.MouseEvent, tx: Transaction) => {
    e.stopPropagation();
    printStandardInvoice(tx, settings);
  };

  return (
    <div className="space-y-4">
      {/* Header & Main Currency Declaration */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1E293B] pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-[#E2E8F0]">Transaction & Receipt Audit Ledger</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Register receipts by date — search, reprint, and integrity check. Sales live here; the security audit log is for exceptions (refunds, stock edits, PIN changes), not every sale.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-1 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" />
              <span>Main Currency: {primaryCode} ({primarySymbol})</span>
            </span>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search receipt # (e.g. IP-123456), customer, cashier..."
              className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#E2E8F0] placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {/* Status Segment Buttons */}
          <div className="flex items-center gap-1 bg-[#0F1115] p-1 rounded-xl border border-[#1E293B]">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setStatusFilter('sales')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'sales'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sales
            </button>
            <button
              onClick={() => setStatusFilter('refunds')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'refunds'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Refunds
            </button>
            <button
              onClick={() => setStatusFilter('flagged')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                statusFilter === 'flagged'
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Flagged ({flaggedCount})</span>
            </button>
          </div>

          {/* Date Picker Range */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-[#0F1115] border border-[#1E293B] rounded-xl pl-9 pr-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
              />
            </div>
            <span className="text-slate-500 text-xs">to</span>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-[#0F1115] border border-[#1E293B] rounded-xl pl-9 pr-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
              />
            </div>
            {(searchQuery || dateFrom || dateTo || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDateFrom(todayKey);
                  setDateTo(todayKey);
                  setStatusFilter('all');
                }}
                className="text-xs text-slate-400 hover:text-white px-2 py-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl overflow-hidden shadow-sm">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold">No transactions found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#E2E8F0]">
              <thead className="bg-[#0F1115] text-slate-400 uppercase text-[10px] font-bold border-b border-[#1E293B]">
                <tr>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Receipt Number</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Cashier</th>
                  <th className="p-3">Audit / Integrity</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3 text-right">Total ({primaryCode})</th>
                  <th className="p-3 text-center">Print & Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {visibleTransactions.map((tx) => {
                  const auditStatus = auditStatusMap.get(tx.id) || 'passed';

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setAuditingReceiptNumber(tx.receiptNumber)}
                      className="hover:bg-[#0F1115]/60 transition-colors cursor-pointer"
                    >
                      <td className="p-3 text-slate-300">
                        {new Date(tx.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="p-3 font-mono font-bold text-cyan-400">
                        <div className="flex items-center gap-1.5">
                          <span>{tx.receiptNumber}</span>
                          {tx.isOfflineProcessed && (
                            <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded text-[9px] font-mono" title="Processed in Service Worker Offline Mode">
                              ⚡ Offline
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-300">
                        {tx.customerName || <span className="text-slate-500 italic">Walk-in</span>}
                      </td>
                      <td className="p-3 text-slate-300">
                        {tx.cashierName}
                      </td>
                      <td className="p-3">
                        {tx.isRefund ? (
                          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center w-max gap-1">
                            <RotateCcw className="w-3 h-3" /> Refund
                          </span>
                        ) : auditStatus === 'passed' ? (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center w-max gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        ) : auditStatus === 'warning' ? (
                          <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center w-max gap-1">
                            <AlertTriangle className="w-3 h-3" /> Notice
                          </span>
                        ) : (
                          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center w-max gap-1">
                            <AlertTriangle className="w-3 h-3" /> Discrepancy
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 capitalize">
                        {tx.paymentMethod === 'split' || (tx.splitPayments && tx.splitPayments.length > 0) ? (
                          <div>
                            <span className="font-bold text-amber-400 text-xs flex items-center gap-1">
                              🔀 Split / Mixed
                            </span>
                            {tx.splitPayments && tx.splitPayments.length > 0 && (
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                                {tx.splitPayments.map((p) => `${p.currencySymbol}${p.amountTendered} ${p.currencyCode}`).join(' + ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {tx.paymentMethod}
                            {tx.currencyUsed === 'secondary' && tx.secondaryTotal && (
                              <span className="text-[10px] text-cyan-400 ml-1">
                                ({secondarySymbol}{tx.secondaryTotal.toFixed(2)})
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">
                        {primarySymbol} {tx.total.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAuditingReceiptNumber(tx.receiptNumber);
                            }}
                            className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                            title="Inspect Receipt & Discrepancy Breakdown"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handlePrintThermal(e, tx)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Print Thermal 80mm POS Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handlePrintA4(e, tx)}
                            className="p-1.5 rounded-lg bg-slate-800 text-emerald-400 hover:text-emerald-300 hover:bg-slate-700 transition-colors"
                            title="Print Standard A4 / Normal Printer Invoice"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {capped && (
              <div className="px-4 py-2.5 bg-amber-500/5 border-t border-[#1E293B] text-[11px] text-amber-300/90 flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 shrink-0" />
                Showing the {MAX_RENDERED_ROWS} most recent matching receipts. Narrow your date range to see earlier records.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Discrepancy Inspector Modal */}
      {auditingReceiptNumber && (
        <ReceiptLookupModal
          initialReceiptNumber={auditingReceiptNumber}
          inventory={inventory}
          onClose={() => setAuditingReceiptNumber(null)}
        />
      )}
    </div>
  );
};
