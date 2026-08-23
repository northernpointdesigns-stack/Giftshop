import React, { useState, useMemo } from 'react';
import {
  History,
  X,
  Search,
  RotateCcw,
  Printer,
  ShieldAlert,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Layers,
  Banknote,
  CreditCard,
  User,
  ShoppingBag,
  Clock,
  ArrowUpDown,
  FileText,
} from 'lucide-react';
import { Transaction, InventoryItem } from '../../types/pos';
import { posDb } from '../../services/db';
import { VoidTransactionModal } from './VoidTransactionModal';
import { ReceiptModal } from './ReceiptModal';

interface TransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onProcessRefund?: (receiptNumber: string) => void;
  onDataChanged?: () => void;
}

export const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onProcessRefund,
  onDataChanged,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided' | 'refunds'>('all');
  const [sessionScope, setSessionScope] = useState<'current_session' | 'today' | 'all'>('current_session');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'card'>('all');

  // Selected for Voiding
  const [txToVoid, setTxToVoid] = useState<Transaction | null>(null);
  // Selected for Viewing / Printing Receipt
  const [txToPrint, setTxToPrint] = useState<Transaction | null>(null);
  // Toast notice
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeSession = posDb.getActiveEODSession();
  const allTransactions = posDb.getTransactions();

  // Filter transactions based on scope and search
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    return allTransactions.filter((tx) => {
      const txDate = new Date(tx.timestamp);

      // 1. Session scope filter
      if (sessionScope === 'current_session') {
        if (activeSession) {
          const sessionStart = new Date(activeSession.openedAt);
          if (txDate < sessionStart) return false;
        } else {
          // If no active session, default to today
          if (txDate.toDateString() !== todayStr) return false;
        }
      } else if (sessionScope === 'today') {
        if (txDate.toDateString() !== todayStr) return false;
      }

      // 2. Status filter
      if (statusFilter === 'completed') {
        if (tx.isVoided || tx.isRefund) return false;
      } else if (statusFilter === 'voided') {
        if (!tx.isVoided) return false;
      } else if (statusFilter === 'refunds') {
        if (!tx.isRefund) return false;
      }

      // 3. Payment filter
      if (paymentFilter !== 'all' && tx.paymentMethod !== paymentFilter) {
        return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesReceipt = tx.receiptNumber.toLowerCase().includes(q);
        const matchesCashier = tx.cashierName.toLowerCase().includes(q);
        const matchesCustomer =
          (tx.customerName && tx.customerName.toLowerCase().includes(q)) ||
          (tx.customerPhone && tx.customerPhone.toLowerCase().includes(q));
        const matchesReason =
          (tx.voidReason && tx.voidReason.toLowerCase().includes(q)) ||
          (tx.refundReason && tx.refundReason.toLowerCase().includes(q));
        const matchesItem = tx.items.some(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            it.sku.toLowerCase().includes(q) ||
            (it.brand && it.brand.toLowerCase().includes(q))
        );

        if (!matchesReceipt && !matchesCashier && !matchesCustomer && !matchesReason && !matchesItem) {
          return false;
        }
      }

      return true;
    });
  }, [allTransactions, sessionScope, statusFilter, paymentFilter, searchQuery, activeSession]);

  // Key KPI stats
  const stats = useMemo(() => {
    let completedCount = 0;
    let netSales = 0;
    let voidedCount = 0;
    let voidedAmount = 0;
    let refundCount = 0;
    let refundAmount = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.isVoided) {
        voidedCount++;
        voidedAmount += tx.total;
      } else if (tx.isRefund) {
        refundCount++;
        refundAmount += Math.abs(tx.total);
        netSales -= Math.abs(tx.total);
      } else {
        completedCount++;
        netSales += tx.total;
      }
    });

    return {
      total: filteredTransactions.length,
      completedCount,
      netSales,
      voidedCount,
      voidedAmount,
      refundCount,
      refundAmount,
    };
  }, [filteredTransactions]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleVoidSuccess = (voided: Transaction) => {
    showToast(`Transaction #${voided.receiptNumber} successfully voided. Stock & Drawer updated.`);
    if (onDataChanged) {
      onDataChanged();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">POS Transaction History</h2>
                {activeSession && (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Shift Active: #{activeSession.id}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit past receipts, inspect itemized tender, print customer copies, or void current session transactions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 px-4 py-2.5 text-xs font-bold flex items-center justify-between shrink-0 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Summary KPI Strip */}
        <div className="bg-[#0F1115]/50 border-b border-[#1E293B] px-4 sm:px-6 py-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400" /> Total Filtered
              </span>
              <div className="text-base font-extrabold text-white mt-1">
                {stats.total}{' '}
                <span className="text-xs font-normal text-slate-400">records</span>
              </div>
            </div>

            <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Net Sales Volume
              </span>
              <div className="text-base font-extrabold font-mono text-emerald-400 mt-1">
                {primarySymbol} {stats.netSales.toFixed(2)}
              </div>
            </div>

            <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-rose-400" /> Voided Orders
              </span>
              <div className="text-base font-extrabold font-mono text-rose-400 mt-1">
                {stats.voidedCount}{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({primarySymbol} {stats.voidedAmount.toFixed(2)})
                </span>
              </div>
            </div>

            <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <RotateCcw className="w-3 h-3 text-amber-400" /> Returns / Refunds
              </span>
              <div className="text-base font-extrabold font-mono text-amber-400 mt-1">
                {stats.refundCount}{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({primarySymbol} {stats.refundAmount.toFixed(2)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="p-4 sm:px-6 bg-[#161B22] border-b border-[#1E293B] space-y-3 shrink-0">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Receipt #, Item, Cashier, Customer..."
                className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Scope & Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
              {/* Session Scope Tabs */}
              <div className="inline-flex bg-[#0F1115] p-1 rounded-xl border border-[#1E293B]">
                <button
                  onClick={() => setSessionScope('current_session')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    sessionScope === 'current_session'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Current Shift
                </button>
                <button
                  onClick={() => setSessionScope('today')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    sessionScope === 'today'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setSessionScope('all')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    sessionScope === 'all'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Time
                </button>
              </div>

              {/* Status Filter */}
              <div className="inline-flex bg-[#0F1115] p-1 rounded-xl border border-[#1E293B]">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    statusFilter === 'all'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Status
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    statusFilter === 'completed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sales
                </button>
                <button
                  onClick={() => setStatusFilter('voided')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    statusFilter === 'voided'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Voided
                </button>
                <button
                  onClick={() => setStatusFilter('refunds')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    statusFilter === 'refunds'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Refunds
                </button>
              </div>

              {/* Payment Method Filter */}
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as any)}
                className="bg-[#0F1115] border border-[#1E293B] rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Tender</option>
                <option value="cash">Cash Only</option>
                <option value="card">Card Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:px-6">
          {filteredTransactions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-2">
              <History className="w-12 h-12 text-slate-600 mb-1" />
              <p className="text-sm font-bold text-white">No transactions found</p>
              <p className="text-xs max-w-sm text-slate-500">
                No receipts matched your filter criteria. Try adjusting the search query or changing the session scope filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#1E293B] bg-[#0F1115]">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#161B22] text-slate-400 uppercase text-[10px] font-bold border-b border-[#1E293B]">
                  <tr>
                    <th className="p-3">Receipt / Time</th>
                    <th className="p-3">Cashier & Customer</th>
                    <th className="p-3">Items Summary</th>
                    <th className="p-3 text-center">Tender</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {filteredTransactions.map((tx) => {
                    const isCash = tx.paymentMethod === 'cash';
                    const totalQty = tx.items.reduce((acc, curr) => acc + Math.abs(curr.quantity), 0);

                    return (
                      <tr
                        key={tx.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          tx.isVoided ? 'bg-rose-950/15 opacity-80' : ''
                        }`}
                      >
                        {/* Receipt & Timestamp */}
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-mono font-bold text-cyan-400 text-xs">
                            {tx.receiptNumber}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {new Date(tx.timestamp).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>

                        {/* Cashier & Customer */}
                        <td className="p-3">
                          <div className="font-semibold text-white truncate max-w-[140px]">
                            {tx.cashierName}
                          </div>
                          {tx.customerName ? (
                            <div className="text-[11px] text-emerald-400 truncate max-w-[140px]">
                              {tx.customerName} {tx.customerPhone ? `(${tx.customerPhone})` : ''}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500">Walk-in Guest</span>
                          )}
                        </td>

                        {/* Items Summary */}
                        <td className="p-3">
                          <div className="font-medium text-slate-200">
                            {totalQty} item{totalQty !== 1 ? 's' : ''}
                          </div>
                          <div
                            className="text-[11px] text-slate-400 truncate max-w-[200px]"
                            title={tx.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                          >
                            {tx.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                          </div>
                        </td>

                        {/* Tender Method */}
                        <td className="p-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isCash
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {isCash ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                            {tx.paymentMethod}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="p-3 text-right whitespace-nowrap font-mono">
                          <div
                            className={`font-bold text-xs ${
                              tx.isVoided
                                ? 'line-through text-slate-500'
                                : tx.isRefund
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {tx.isRefund ? '-' : ''}
                            {primarySymbol} {Math.abs(tx.total).toFixed(2)}
                          </div>
                          {tx.secondaryTotal && !tx.isVoided && (
                            <div className="text-[10px] text-slate-400">
                              ≈ {secondarySymbol}
                              {tx.secondaryTotal.toFixed(2)}
                            </div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="p-3 text-center whitespace-nowrap">
                          {tx.isVoided ? (
                            <div className="space-y-0.5">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-600/20 text-rose-300 border border-rose-500/40">
                                VOIDED
                              </span>
                              {tx.voidReason && (
                                <span
                                  className="block text-[9px] text-slate-400 truncate max-w-[120px]"
                                  title={tx.voidReason}
                                >
                                  {tx.voidReason}
                                </span>
                              )}
                            </div>
                          ) : tx.isRefund ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              REFUND
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              COMPLETED
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View / Print Receipt */}
                            <button
                              type="button"
                              onClick={() => setTxToPrint(tx)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-[#1E293B] transition-colors"
                              title="View & Print Full Receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* Void Transaction Button */}
                            {!tx.isVoided && (
                              <button
                                type="button"
                                onClick={() => setTxToVoid(tx)}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
                                title="Void this transaction and reverse drawer & inventory"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span>Void</span>
                              </button>
                            )}

                            {/* Process Refund Button */}
                            {!tx.isVoided && !tx.isRefund && onProcessRefund && (
                              <button
                                type="button"
                                onClick={() => {
                                  onProcessRefund(tx.receiptNumber);
                                  onClose();
                                }}
                                className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors"
                                title="Process partial or full return/refund for this receipt"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#0F1115] border-t border-[#1E293B] p-4 sm:px-6 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div>
            Showing <strong className="text-white">{filteredTransactions.length}</strong> of{' '}
            <strong className="text-white">{allTransactions.length}</strong> total receipts recorded.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition-colors"
          >
            Close History
          </button>
        </div>
      </div>

      {/* Void Modal Confirmation */}
      {txToVoid && (
        <VoidTransactionModal
          transaction={txToVoid}
          inventory={inventory}
          isOpen={Boolean(txToVoid)}
          onClose={() => setTxToVoid(null)}
          onVoidSuccess={(voided) => {
            handleVoidSuccess(voided);
            setTxToVoid(null);
          }}
        />
      )}

      {/* Receipt Modal */}
      {txToPrint && (
        <ReceiptModal
          transaction={txToPrint}
          onClose={() => setTxToPrint(null)}
          onNewSale={() => setTxToPrint(null)}
        />
      )}
    </div>
  );
};
