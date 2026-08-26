import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  Printer,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RotateCcw,
  Clock,
  User,
  CreditCard,
  Banknote,
  DollarSign,
  TrendingUp,
  Tag,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
  Building,
  Info,
} from 'lucide-react';
import { Transaction, InventoryItem, StoreSettings } from '../../types/pos';
import { posDb } from '../../services/db';
import { printThermalReceipt } from '../../utils/printThermalReceipt';
import { printStandardInvoice } from '../../utils/printStandardInvoice';
import { auditReceiptTransaction, ReceiptAuditReport } from '../../services/receiptAuditEngine';

interface ReceiptLookupModalProps {
  initialReceiptNumber?: string;
  inventory: InventoryItem[];
  onClose: () => void;
  onInitiateRefund?: (receiptNumber: string) => void;
}

export const ReceiptLookupModal: React.FC<ReceiptLookupModalProps> = ({
  initialReceiptNumber = '',
  inventory,
  onClose,
  onInitiateRefund,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 13.50;

  const [searchQuery, setSearchQuery] = useState<string>(initialReceiptNumber);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(() => {
    if (initialReceiptNumber) {
      return posDb.getTransactionByReceiptNumber(initialReceiptNumber) || null;
    }
    return null;
  });
  const [copiedReceipt, setCopiedReceipt] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'all' | 'flagged' | 'refunded'>('all');

  const allTransactions = useMemo(() => {
    return posDb.getTransactions().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, []);

  // Filter list of transactions for quick matching
  const matchingTransactions = useMemo(() => {
    let list = allTransactions;
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      list = list.filter((tx) => {
        const matchesReceipt = tx.receiptNumber.toLowerCase().includes(q);
        const matchesCustomer = tx.customerName?.toLowerCase().includes(q) || false;
        const matchesPhone = tx.customerPhone?.toLowerCase().includes(q) || false;
        const matchesCashier = tx.cashierName.toLowerCase().includes(q);
        const matchesItem = tx.items.some((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
        return matchesReceipt || matchesCustomer || matchesPhone || matchesCashier || matchesItem;
      });
    }

    if (filterMode === 'refunded') {
      list = list.filter((tx) => tx.isRefund || allTransactions.some((r) => r.isRefund && r.originalReceiptNumber === tx.receiptNumber));
    } else if (filterMode === 'flagged') {
      // Find transactions with math or tender warnings
      list = list.filter((tx) => {
        const report = auditReceiptTransaction(tx, inventory, settings);
        return report.status !== 'passed';
      });
    }

    return list.slice(0, 30);
  }, [allTransactions, searchQuery, filterMode, inventory, settings]);

  // If initial receipt was provided and no tx selected yet, select the first match
  useEffect(() => {
    if (initialReceiptNumber && !selectedTx) {
      const match = posDb.getTransactionByReceiptNumber(initialReceiptNumber);
      if (match) setSelectedTx(match);
    }
  }, [initialReceiptNumber, selectedTx]);

  // Generate audit report for selected transaction
  const auditReport: ReceiptAuditReport | null = useMemo(() => {
    if (!selectedTx) return null;
    return auditReceiptTransaction(selectedTx, inventory, settings);
  }, [selectedTx, inventory, settings]);

  const handleSelectTransaction = (tx: Transaction) => {
    setSelectedTx(tx);
    setSearchQuery(tx.receiptNumber);
  };

  const handlePrintThermal = () => {
    if (selectedTx) {
      printThermalReceipt(selectedTx, settings, settings.thermalReceiptWidth || '80mm');
    }
  };

  const handlePrintA4 = () => {
    if (selectedTx) {
      printStandardInvoice(selectedTx, settings);
    }
  };

  const handleCopySummary = () => {
    if (!selectedTx || !auditReport) return;
    const summaryText = `RECEIPT AUDIT: ${selectedTx.receiptNumber}
Date: ${new Date(selectedTx.timestamp).toLocaleString()}
Cashier: ${selectedTx.cashierName}
Main Currency: ${primaryCode} (${primarySymbol})
Total: ${primarySymbol} ${selectedTx.total.toFixed(2)}
Payment: ${selectedTx.paymentMethod}
Status: ${auditReport.status.toUpperCase()} (${auditReport.summary})
Items: ${selectedTx.items.map((i) => `${i.quantity}x ${i.name} [${primarySymbol}${i.unitPrice.toFixed(2)}]`).join(', ')}`;
    
    navigator.clipboard.writeText(summaryText);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col text-[#E2E8F0] shadow-2xl overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="p-4 bg-[#0F1115] border-b border-[#1E293B] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Receipt Lookup & Discrepancy Auditor</h2>
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                  Main Currency: {primaryCode}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Retrieve completed or refunded receipts, verify arithmetic integrity, audit price drift & print in Thermal or A4 format.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split Layout (Left: Search/List, Right: Audit & Receipt Inspector) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Left Column: Search & Transaction Selector */}
          <div className="w-full md:w-80 lg:w-96 border-r border-[#1E293B] flex flex-col bg-[#11161D] shrink-0">
            {/* Search Input Bar */}
            <div className="p-3 border-b border-[#1E293B] space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Receipt #, Customer, Phone, SKU..."
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl pl-9 pr-8 py-2 text-xs text-[#E2E8F0] placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Filters */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-lg transition-colors text-center ${
                    filterMode === 'all'
                      ? 'bg-slate-800 text-slate-100 border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({allTransactions.length})
                </button>
                <button
                  onClick={() => setFilterMode('flagged')}
                  className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-lg transition-colors text-center ${
                    filterMode === 'flagged'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Flagged Issues
                </button>
                <button
                  onClick={() => setFilterMode('refunded')}
                  className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-lg transition-colors text-center ${
                    filterMode === 'refunded'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Refunds
                </button>
              </div>
            </div>

            {/* List of Matching Receipts */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#1E293B]/60 p-1">
              {matchingTransactions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <FileText className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs">No matching receipts found.</p>
                  <p className="text-[10px] text-slate-600">Try entering a partial receipt number or clear your search query.</p>
                </div>
              ) : (
                matchingTransactions.map((tx) => {
                  const isSelected = selectedTx?.id === tx.id;
                  const itemQty = tx.items.reduce((sum, i) => sum + Math.abs(i.quantity), 0);

                  return (
                    <button
                      key={tx.id}
                      onClick={() => handleSelectTransaction(tx)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-emerald-500/10 border border-emerald-500/30 shadow-xs'
                          : 'hover:bg-[#161B22] border border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono font-bold text-xs text-cyan-400 truncate">
                            {tx.receiptNumber}
                          </span>
                          {tx.isRefund ? (
                            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase">
                              Refund
                            </span>
                          ) : (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase">
                              Sale
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-300 truncate">
                          {tx.customerName || <span className="text-slate-500 italic">Walk-in Customer</span>}
                        </div>

                        <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{new Date(tx.timestamp).toLocaleDateString()} {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>•</span>
                          <span>{itemQty} {itemQty === 1 ? 'item' : 'items'}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-xs text-slate-100">
                          {primarySymbol} {Math.abs(tx.total).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">
                          {tx.paymentMethod}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Deep Receipt Audit & Inspector */}
          <div className="flex-1 flex flex-col bg-[#161B22] overflow-y-auto">
            {selectedTx && auditReport ? (
              <div className="p-4 sm:p-6 space-y-5">
                
                {/* Top Action Bar (Dual Printer Options & Discrepancy Status) */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#0F1115] border border-[#1E293B] rounded-xl p-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Inspecting Receipt:</span>
                      <span className="font-mono font-bold text-sm text-cyan-400">{selectedTx.receiptNumber}</span>
                      {selectedTx.isRefund ? (
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                          REFUND VOUCHER
                        </span>
                      ) : (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                          SETTLED SALE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Issued on {new Date(selectedTx.timestamp).toLocaleString()} by cashier <strong className="text-slate-200">{selectedTx.cashierName}</strong>
                    </div>
                  </div>

                  {/* Dual Print Buttons & Quick Actions */}
                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      onClick={handlePrintThermal}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                      title="Print 80mm/58mm Thermal POS Tape"
                    >
                      <Printer className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Thermal (80mm)</span>
                    </button>

                    <button
                      onClick={handlePrintA4}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                      title="Print Full A4 / Letter Normal Printer Invoice"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Normal Printer (A4)</span>
                    </button>

                    {onInitiateRefund && !selectedTx.isRefund && !auditReport.fullyRefunded && (
                      <button
                        onClick={() => onInitiateRefund(selectedTx.receiptNumber)}
                        className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Process Return</span>
                      </button>
                    )}

                    <button
                      onClick={handleCopySummary}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
                      title="Copy Audit Summary"
                    >
                      {copiedReceipt ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* PROMINENT MAIN CURRENCY NOTIFICATION BANNER */}
                <div className="bg-[#0F1115] border border-cyan-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Building className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <span>Official Base Accounting Currency:</span>
                        <span className="font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                          {primaryCode} ({primarySymbol})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Effective VAT rate of{' '}
                        {selectedTx
                          ? (() => {
                              const base = Math.max((selectedTx.subtotal || 0) - (selectedTx.discount || 0), 0);
                              return base > 0
                                ? (((selectedTx.vatTotal || selectedTx.tax || 0) / base) * 100).toFixed(1)
                                : '15.0';
                            })()
                          : '15.0'}
                        % and all domestic tax audits are computed in <strong>{primaryCode}</strong>.
                        {auditReport.isSecondarySettlement && (
                          <span className="text-amber-300 ml-1">
                            (Settled in {secondaryCode} at locked rate of 1 {secondaryCode} = {primarySymbol} {auditReport.appliedExchangeRate?.toFixed(2)}).
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Base Net Total</span>
                    <span className="font-mono font-black text-base text-cyan-400">
                      {primarySymbol} {selectedTx.total.toFixed(2)} {primaryCode}
                    </span>
                  </div>
                </div>

                {/* DISCREPANCY AUDIT SCORE & VERDICT CARD */}
                <div
                  className={`rounded-xl p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    auditReport.status === 'passed'
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : auditReport.status === 'warning'
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : 'bg-rose-950/20 border-rose-500/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        auditReport.status === 'passed'
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : auditReport.status === 'warning'
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                          : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                      }`}
                    >
                      {auditReport.status === 'passed' ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : auditReport.status === 'warning' ? (
                        <AlertTriangle className="w-6 h-6" />
                      ) : (
                        <AlertOctagon className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-100">
                          {auditReport.status === 'passed'
                            ? 'Zero Discrepancies (Audit Passed 100%)'
                            : auditReport.status === 'warning'
                            ? 'Advisory Notice Detected'
                            : 'Discrepancy Detected in Ledger'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            auditReport.status === 'passed'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : auditReport.status === 'warning'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          Score: {auditReport.overallScore}/100
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{auditReport.summary}</p>
                    </div>
                  </div>

                  {auditReport.totalDiscrepancyAmount > 0 && (
                    <div className="text-right shrink-0 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-xl">
                      <span className="text-[10px] text-rose-300 uppercase font-bold block">Total Discrepancy Variance</span>
                      <span className="font-mono font-black text-sm text-rose-400">
                        {primarySymbol} {auditReport.totalDiscrepancyAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Detailed Issues List (if any) */}
                {auditReport.issues.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-400" /> Audit Findings & Reconciliations ({auditReport.issues.length})
                    </h3>
                    <div className="space-y-2">
                      {auditReport.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border text-xs flex items-start gap-3 ${
                            issue.type === 'error'
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                              : issue.type === 'warning'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                              : 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                          }`}
                        >
                          <div className="mt-0.5">
                            {issue.type === 'error' ? (
                              <AlertOctagon className="w-4 h-4 text-rose-400" />
                            ) : issue.type === 'warning' ? (
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Info className="w-4 h-4 text-blue-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold">{issue.title}</div>
                            <div className="text-[11px] opacity-90 mt-0.5">{issue.description}</div>
                            {issue.suggestedAction && (
                              <div className="text-[10px] opacity-75 mt-1 font-semibold">
                                Recommended Action: {issue.suggestedAction}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4-Card Arithmetic & Ledger Integrity Verification Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Card 1: Math Balance */}
                  <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3.5 space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                      <span>Math Balance</span>
                      {auditReport.mathDiscrepancy < 0.02 ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                      )}
                    </span>
                    <div className="font-mono text-sm font-bold text-slate-100">
                      {primarySymbol} {auditReport.recalculatedTotal.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Line items + VAT: {auditReport.mathDiscrepancy < 0.02 ? 'Perfect match (0.00 delta)' : `Variance: ${primarySymbol}${auditReport.mathDiscrepancy.toFixed(2)}`}
                    </div>
                  </div>

                  {/* Card 2: Tender & Change */}
                  <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3.5 space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                      <span>Tender & Change</span>
                      {auditReport.tenderDiscrepancy < 0.02 ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </span>
                    <div className="font-mono text-sm font-bold text-slate-100 capitalize">
                      {selectedTx.paymentMethod}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {selectedTx.paymentMethod === 'cash'
                        ? `Tendered: ${primarySymbol}${selectedTx.cashGiven?.toFixed(2) || '0.00'} • Change: ${primarySymbol}${selectedTx.changeDue?.toFixed(2) || '0.00'}`
                        : 'Electronic card settlement verified'}
                    </div>
                  </div>

                  {/* Card 3: Refund & Return Status */}
                  <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3.5 space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                      <span>Refund Status</span>
                      <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    </span>
                    <div className="font-mono text-sm font-bold text-slate-100">
                      {auditReport.isRefunded
                        ? `${primarySymbol} ${auditReport.totalRefundedAmount.toFixed(2)} Refunded`
                        : 'No Returns'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {auditReport.fullyRefunded
                        ? '100% Fully refunded'
                        : `Remaining eligible: ${primarySymbol} ${auditReport.remainingRefundableAmount.toFixed(2)}`}
                    </div>
                  </div>

                  {/* Card 4: Customer & Loyalty */}
                  <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3.5 space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                      <span>Customer & Loyalty</span>
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <div className="text-sm font-bold text-slate-100 truncate">
                      {selectedTx.customerName || 'Walk-in Customer'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {selectedTx.loyaltyPointsEarned ? `+${selectedTx.loyaltyPointsEarned} points earned` : 'Standard retail receipt'}
                    </div>
                  </div>
                </div>

                {/* ITEM-BY-ITEM AUDIT & CATALOG DRIFT TABLE */}
                <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl overflow-hidden shadow-sm space-y-0">
                  <div className="p-3 border-b border-[#1E293B] flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-cyan-400" /> Itemized Line Audit & Price Drift
                    </h3>
                    <span className="text-[10px] text-slate-400">
                      {auditReport.itemAudits.length} line {auditReport.itemAudits.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-[#E2E8F0]">
                      <thead className="bg-[#161B22] text-slate-400 uppercase text-[10px] font-bold border-b border-[#1E293B]">
                        <tr>
                          <th className="p-3">Item / SKU</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Paid Unit Price</th>
                          <th className="p-3 text-right">Catalog Price Today</th>
                          <th className="p-3 text-center">Price Drift</th>
                          <th className="p-3 text-right">VAT Amount</th>
                          <th className="p-3 text-right">Line Total ({primarySymbol})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]">
                        {auditReport.itemAudits.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-3">
                              <div className="font-semibold text-slate-200">{item.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                                {item.brand && <span className="text-slate-400">[{item.brand}]</span>}
                                <span>SKU: {item.sku}</span>
                                {item.isDamaged && (
                                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded text-[9px]">
                                    Damaged Markdown ({item.damageDiscountPercent}%)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-200">
                              {item.quantity}
                              {item.refundedQuantity > 0 && (
                                <span className="block text-[9px] text-rose-400">
                                  ({item.refundedQuantity} returned)
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-200">
                              {primarySymbol} {item.paidUnitPrice.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-400">
                              {item.currentCatalogPrice !== undefined
                                ? `${primarySymbol} ${item.currentCatalogPrice.toFixed(2)}`
                                : <span className="italic text-slate-600">Discontinued</span>}
                            </td>
                            <td className="p-3 text-center">
                              {item.priceDriftAmount !== undefined && Math.abs(item.priceDriftAmount) > 0.01 ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                    item.priceDriftAmount > 0
                                      ? 'bg-emerald-500/10 text-emerald-400'
                                      : 'bg-rose-500/10 text-rose-400'
                                  }`}
                                >
                                  {item.priceDriftAmount > 0 ? '+' : ''}{primarySymbol}{item.priceDriftAmount.toFixed(2)} ({item.priceDriftPercent}%)
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[10px] font-mono">0.00 (Unchanged)</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-400">
                              {primarySymbol} {item.vatAmount.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-100">
                              {primarySymbol} {item.lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-3">
                <FileText className="w-12 h-12 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-300">Select a Receipt to Audit</h3>
                <p className="text-xs max-w-sm text-slate-500">
                  Search by receipt number (e.g. <span className="font-mono text-cyan-400">IP-123456</span>) or pick from recent sales on the left to verify calculation math and view dual print options.
                </p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
