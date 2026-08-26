import React, { useState } from 'react';
import {
  X,
  Lock,
  Printer,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Coins,
  ArrowRight,
  Sparkles,
  ClipboardList,
  Banknote,
  PlusCircle,
  MinusCircle,
  Vault,
  KeyRound,
} from 'lucide-react';
import { posDb } from '../../services/db';
import { resolveStoreName } from '../../services/brand';
import { EODSession, StoreSettings, StaffUser, Transaction, CashDrawerEventType } from '../../types/pos';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStaff: StaffUser;
  settings: StoreSettings;
  onSessionClosed: () => void;
  onRefreshData?: () => void;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  isOpen,
  onClose,
  currentStaff,
  settings,
  onSessionClosed,
  onRefreshData,
}) => {
  const activeSession = posDb.getActiveEODSession();
  const currencySymbol = settings.primaryCurrencySymbol || '$';
;

  const [actualCash, setActualCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [step, setStep] = useState<'input' | 'report'>('input');
  const [isSaved, setIsSaved] = useState(false);

  // Live drawer adjustments — ported from the old Reports → EOD "current shift" card so
  // cashiers/admins can record a last-minute paid-in/paid-out/cash-drop right before
  // declaring the counted cash, without leaving the closing flow.
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjType, setAdjType] = useState<CashDrawerEventType>('paid_in');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');

  if (!isOpen || !activeSession) return null;

  const expectedCash = activeSession.expectedCash;
  const actualCashNum = parseFloat(actualCash);
  const isValidCash = !isNaN(actualCashNum) && actualCashNum >= 0 && actualCash.trim() !== '';

  const variance = isValidCash ? actualCashNum - expectedCash : 0;

  // --- END-OF-DAY LOG AGGREGATION --------------------------------------
  // All completed (non-refund) transactions captured during this session.
  const sessionTransactions: Transaction[] = posDb
    .getTransactions()
    .filter((t) => {
      const ts = new Date(t.timestamp).getTime();
      const start = new Date(activeSession.openedAt).getTime();
      const end = activeSession.closedAt ? new Date(activeSession.closedAt).getTime() : Date.now();
      return ts >= start && ts <= end && !t.isRefund;
    });

  // Sales by Item
  const salesByItem = new Map<string, { name: string; sku: string; qty: number; total: number }>();
  // Sales by Vendor (consignment & wholesale suppliers)
  const salesByVendor = new Map<string, { name: string; qty: number; total: number; payout: number }>();
  // House vs Consignment split
  let houseSalesTotal = 0;
  let houseUnits = 0;
  let consignmentSalesTotal = 0;
  let consignmentUnits = 0;
  let houseCommissionTotal = 0;
  // Sales by Cashier
  const salesByCashier = new Map<string, { txCount: number; total: number }>();

  sessionTransactions.forEach((tx) => {
    tx.items.forEach((it) => {
      const iEntry = salesByItem.get(it.itemId) || { name: it.name, sku: it.sku, qty: 0, total: 0 };
      iEntry.qty += it.quantity;
      iEntry.total += it.totalPrice;
      salesByItem.set(it.itemId, iEntry);

      const vKey = it.vendorId || it.vendorName;
      const vEntry = salesByVendor.get(vKey) || { name: it.vendorName, qty: 0, total: 0, payout: 0 };
      vEntry.qty += it.quantity;
      vEntry.total += it.totalPrice;
      vEntry.payout += it.vendorPayoutAmount || 0;
      salesByVendor.set(vKey, vEntry);

      if (it.supplierType === 'consignment') {
        consignmentSalesTotal += it.totalPrice;
        consignmentUnits += it.quantity;
        houseCommissionTotal += it.houseProfitAmount || 0;
      } else {
        houseSalesTotal += it.totalPrice;
        houseUnits += it.quantity;
      }
    });

    const cEntry = salesByCashier.get(tx.cashierName) || { txCount: 0, total: 0 };
    cEntry.txCount += 1;
    cEntry.total += tx.total;
    salesByCashier.set(tx.cashierName, cEntry);
  });

  const topItems = Array.from(salesByItem.values()).sort((a, b) => b.total - a.total);
  const vendorRows = Array.from(salesByVendor.values()).sort((a, b) => b.total - a.total);
  const cashierRows = Array.from(salesByCashier.entries()).sort((a, b) => b[1].total - a[1].total);

  // Drawer movements recorded during this session (banked cash etc.)
  const sessionMovements = posDb
    .getDrawerLogs(activeSession.id)
    .filter(
      (l) =>
        l.eventType === 'paid_out' || l.eventType === 'paid_in' || l.eventType === 'cash_drop'
    );
  // ---------------------------------------------------------------------

  const handleCalculateAndProceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCash) return;
    setStep('report');
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
      currentStaff.name,
      adjReason.trim()
    );

    setIsAdjustmentModalOpen(false);
    setAdjAmount('');
    setAdjReason('');
    onRefreshData?.();
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleFinalizeAndClose = () => {
    if (!isValidCash) return;
    
    // Close the EOD session in the database
    posDb.closeEODSession(actualCashNum, currentStaff.name, closingNotes);
    
    // Set local saved flag
    setIsSaved(true);
    
    // Force end-of-day backup if required in settings
    const s = posDb.getSettings();
    if (s.requireBackupOnDayClose !== false) {
      // Create and download JSON backup immediately so data is permanently safe!
      try {
        const dateStr = new Date().toISOString().split('T')[0];
        const jsonDump = posDb.exportBackup();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonDump, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `boutique-pos-backup-${dateStr}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        posDb.markBackupDone();
      } catch (err) {
        console.error("Auto EOD backup download failed:", err);
      }
    }

    // Call callback to log out cashier and lock the register
    onSessionClosed();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-y-auto">
      {/* Printable Area: This container is styled as thermal receipt upon window.print() */}
      <div className="hidden">
        <div className="thermal-receipt p-6 bg-white text-black font-mono text-sm leading-relaxed max-w-[80mm] mx-auto">
          <div className="text-center space-y-1 mb-4 border-b border-dashed border-black pb-4">
            <h1 className="text-lg font-black uppercase tracking-tight">{resolveStoreName(settings)}</h1>
            {settings.receiptHeaderSubtitle && <p className="text-xs">{settings.receiptHeaderSubtitle}</p>}
            <p className="text-xs font-bold uppercase mt-2">*** DAILY EOD SESSION REPORT ***</p>
          </div>

          <div className="space-y-1.5 text-xs mb-4">
            <div><strong>Session ID:</strong> {activeSession.id}</div>
            <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
            <div><strong>Opened At:</strong> {new Date(activeSession.openedAt).toLocaleTimeString()}</div>
            <div><strong>Closed At:</strong> {new Date().toLocaleTimeString()}</div>
            <div><strong>Shift Cashier:</strong> {currentStaff.name}</div>
            <div><strong>Session Status:</strong> CLOSED &amp; AUDITED</div>
          </div>

          <div className="border-t border-b border-dashed border-black py-3 my-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span>STARTING FLOAT:</span>
              <span className="font-bold">{currencySymbol}{activeSession.startingFloat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>(+) CASH SALES:</span>
              <span>{currencySymbol}{activeSession.cashSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>(+) CARD SALES:</span>
              <span>{currencySymbol}{activeSession.cardSales.toFixed(2)}</span>
            </div>
            {activeSession.paidInTotal !== undefined && activeSession.paidInTotal > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>(+) PAID IN ADJS:</span>
                <span>+{currencySymbol}{activeSession.paidInTotal.toFixed(2)}</span>
              </div>
            )}
            {activeSession.paidOutTotal !== undefined && activeSession.paidOutTotal > 0 && (
              <div className="flex justify-between text-rose-700">
                <span>(-) PAID OUT ADJS:</span>
                <span>-{currencySymbol}{activeSession.paidOutTotal.toFixed(2)}</span>
              </div>
            )}
            {activeSession.cashDropTotal !== undefined && activeSession.cashDropTotal > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>(-) CASH DROPS:</span>
                <span>-{currencySymbol}{activeSession.cashDropTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-dashed border-black pt-1.5 mt-1">
              <span>EXPECTED DRAWER CASH:</span>
              <span>{currencySymbol}{expectedCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-black text-sm pt-1">
              <span>ACTUAL DECLARED CASH:</span>
              <span>{currencySymbol}{actualCashNum.toFixed(2)}</span>
            </div>
            <div className={`flex justify-between font-bold border-t border-dashed border-black pt-1.5 mt-1 ${variance < 0 ? 'text-rose-700' : variance > 0 ? 'text-emerald-700' : ''}`}>
              <span>DRAWER VARIANCE (DIFF):</span>
              <span>{variance >= 0 ? '+' : ''}{variance.toFixed(2)}</span>
            </div>
          </div>

          {/* ===== SALES BY CASHIER ===== */}
          {cashierRows.length > 0 && (
            <div className="border-t border-dashed border-black pt-2 mt-2 text-xs">
              <div className="font-bold text-center mb-1">*** SALES BY CASHIER ***</div>
              <div className="flex justify-between font-semibold"><span>Cashier</span><span>Sales • Txns</span></div>
              {cashierRows.map(([name, row]) => (
                <div key={name} className="flex justify-between">
                  <span className="truncate max-w-[55%]">{name}</span>
                  <span>{currencySymbol}{row.total.toFixed(2)} • {row.txCount}</span>
                </div>
              ))}
            </div>
          )}

          {/* ===== SALES BY HOUSE VS CONSIGNMENT ===== */}
          <div className="border-t border-dashed border-black pt-2 mt-2 text-xs">
            <div className="font-bold text-center mb-1">*** SALES BY HOUSE ***</div>
            <div className="flex justify-between"><span>House Own-Stock Sales</span><span>{currencySymbol}{houseSalesTotal.toFixed(2)} ({houseUnits}u)</span></div>
            <div className="flex justify-between"><span>Consignment Vendor Sales</span><span>{currencySymbol}{consignmentSalesTotal.toFixed(2)} ({consignmentUnits}u)</span></div>
            <div className="flex justify-between font-bold"><span>House Commission Retained</span><span>{currencySymbol}{houseCommissionTotal.toFixed(2)}</span></div>
          </div>

          {/* ===== SALES BY VENDOR ===== */}
          {vendorRows.length > 0 && (
            <div className="border-t border-dashed border-black pt-2 mt-2 text-xs">
              <div className="font-bold text-center mb-1">*** SALES BY VENDOR ***</div>
              <div className="flex justify-between font-semibold"><span>Vendor</span><span>Sales • Payout Due</span></div>
              {vendorRows.slice(0, 20).map((v) => (
                <div key={v.name + v.total} className="flex justify-between">
                  <span className="truncate max-w-[55%]">{v.name}</span>
                  <span>{currencySymbol}{v.total.toFixed(2)} • owe {currencySymbol}{v.payout.toFixed(2)}</span>
                </div>
              ))}
              {vendorRows.length > 20 && (
                <div className="italic">+ {vendorRows.length - 20} more vendors…</div>
              )}
            </div>
          )}

          {/* ===== SALES BY ITEM ===== */}
          {topItems.length > 0 && (
            <div className="border-t border-dashed border-black pt-2 mt-2 text-xs">
              <div className="font-bold text-center mb-1">*** SALES BY ITEM ***</div>
              <div className="flex justify-between font-semibold"><span>Item</span><span>Qty × Amount</span></div>
              {topItems.slice(0, 30).map((it) => (
                <div key={it.sku + it.name} className="flex justify-between">
                  <span className="truncate max-w-[60%]">{it.name}</span>
                  <span>{it.qty} × {currencySymbol}{it.total.toFixed(2)}</span>
                </div>
              ))}
              {topItems.length > 30 && (
                <div className="italic">+ {topItems.length - 30} more items…</div>
              )}
            </div>
          )}

          {/* ===== DRAWER MOVEMENTS (BANKED / DROPS) ===== */}
          {sessionMovements.length > 0 && (
            <div className="border-t border-dashed border-black pt-2 mt-2 text-xs">
              <div className="font-bold text-center mb-1">*** DRAWER MOVEMENTS ***</div>
              {sessionMovements.map((log) => (
                <div key={log.id} className="flex justify-between">
                  <span className="truncate max-w-[65%]">
                    {log.eventType === 'paid_out' ? 'BANKED: ' : log.eventType === 'cash_drop' ? 'DROP: ' : 'PAID IN: '}
                    {log.reason} ({log.staffName})
                  </span>
                  <span>
                    {log.eventType === 'paid_in' ? '+' : '-'}
                    {currencySymbol}{(log.amount || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {closingNotes.trim() && (
            <div className="text-xs mb-6 border-b border-dashed border-black pb-4">
              <span className="font-bold block">Cashier Closing Notes:</span>
              <p className="italic leading-relaxed mt-1">"{closingNotes}"</p>
            </div>
          )}

          <div className="text-center text-[10px] space-y-6 pt-6">
            <div className="flex justify-between gap-4">
              <div className="w-1/2 border-t border-black pt-1">Cashier Signature</div>
              <div className="w-1/2 border-t border-black pt-1">Manager Signature</div>
            </div>
            <div className="font-bold mt-4">EOD Session successfully logged in register logs.</div>
          </div>
        </div>
      </div>

      {/* Screen Interface */}
      <div className="w-full max-w-xl bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {step === 'input' ? (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Coins className="w-6 h-6 text-rose-400" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] bg-rose-950/50 border border-rose-800/40 text-rose-300 font-bold px-2 py-0.5 rounded-full">
                  Locked Shop Closing Workflow
                </span>
                <h2 className="text-lg font-black text-white">Declare Drawer Close &amp; Count Cash</h2>
                <p className="text-xs text-slate-400">
                  Before closing down the software, you must count all paper currency and coins in the cash drawer and input the total.
                </p>
              </div>
            </div>

            {/* Session Cash Breakdown Grid — ported from Reports → EOD (that page is now history/audit only) */}
            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-400" /> Current Shift Cash Drawer Breakdown
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[10px] text-slate-500 uppercase">Starting Float</div>
                  <div className="text-base font-bold text-[#E2E8F0] mt-0.5">
                    {currencySymbol}{activeSession.startingFloat.toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[10px] text-emerald-500 uppercase">+ Cash Sales</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">
                    +{currencySymbol}{activeSession.cashSales.toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[10px] text-blue-400 uppercase">+ Paid In</div>
                  <div className="text-base font-bold text-blue-400 mt-0.5">
                    +{currencySymbol}{(activeSession.paidInTotal || 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[10px] text-amber-400 uppercase">- Paid Out</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5">
                    -{currencySymbol}{(activeSession.paidOutTotal || 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[10px] text-purple-400 uppercase">- Cash Drop</div>
                  <div className="text-base font-bold text-purple-400 mt-0.5">
                    -{currencySymbol}{(activeSession.cashDropTotal || 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[10px] text-slate-500 uppercase">Card (Terminal)</div>
                  <div className="text-base font-bold text-cyan-400 mt-0.5">
                    {currencySymbol}{activeSession.cardSales.toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#161B22] p-3 rounded-xl border border-emerald-500/50 shadow-xs col-span-2">
                  <div className="text-[10px] text-emerald-400 uppercase font-bold">Expected Cash</div>
                  <div className="text-lg font-black text-emerald-400 mt-0.5">
                    {currencySymbol}{activeSession.expectedCash.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Drawer Adjustments & Cash Drop Actions — last corrections before counting */}
            <div className="bg-[#0F1115] p-4 rounded-xl border border-[#1E293B] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-400" /> Live Drawer Adjustments
                </h4>
                <span className="text-[11px] text-slate-500 hidden sm:inline">Record non-sale entries before counting</span>
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

            <form onSubmit={handleCalculateAndProceed} className="space-y-4">
              <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4.5 space-y-3">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                  Total Counted Cash in Drawer:
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-rose-400">
                    {currencySymbol}
                  </span>
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl pl-12 pr-4 py-4 text-3xl font-mono font-bold text-white text-center focus:outline-none focus:border-rose-500 placeholder-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="text-slate-300 font-bold flex items-center gap-1">
                  <ClipboardList className="w-3.5 h-3.5 text-slate-400" /> Optional closing notes / variance reasons:
                </label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Explain any cash discrepancy (e.g. 'shortage in 20 SR bill' or 'payout shift details')..."
                  rows={2}
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 leading-relaxed resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!isValidCash}
                className="w-full bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                <span>Calculate Audits &amp; Review Daily Report</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-start gap-4 border-b border-[#1E293B] pb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] bg-emerald-950/50 border border-emerald-800/40 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                  Step 2 of 2: Session Summary Ready
                </span>
                <h2 className="text-lg font-black text-white">Daily EOD Shift Report Summary</h2>
                <p className="text-xs text-slate-400">
                  Please review the calculations below. You are required to print this report and lock the drawer.
                </p>
              </div>
            </div>

            {/* Simulated Receipt Preview on screen */}
            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4.5 font-mono text-[11px] text-slate-300 space-y-3 shadow-inner max-h-72 overflow-y-auto scrollbar-thin">
              <div className="text-center border-b border-dashed border-slate-800 pb-3">
                <span className="font-bold text-white block uppercase">{resolveStoreName(settings)}</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">*** INTERNAL AUDIT RECORD ***</span>
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 border-b border-dashed border-slate-800 pb-3">
                <div>Shift Cashier:</div>
                <div className="text-right text-white font-bold">{currentStaff.name}</div>
                <div>Session ID:</div>
                <div className="text-right text-white font-mono">{activeSession.id}</div>
                <div>Opening Float:</div>
                <div className="text-right text-white font-mono">{currencySymbol}{activeSession.startingFloat.toFixed(2)}</div>
                <div>Net Cash Sales:</div>
                <div className="text-right text-emerald-400 font-mono">+{currencySymbol}{activeSession.cashSales.toFixed(2)}</div>
                <div>Net Card Sales:</div>
                <div className="text-right text-cyan-400 font-mono">+{currencySymbol}{activeSession.cardSales.toFixed(2)}</div>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-800 pb-3 font-semibold">
                <div className="flex justify-between">
                  <span>Expected Cash in Drawer:</span>
                  <span className="text-white font-mono">{currencySymbol}{expectedCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-xs pt-0.5">
                  <span>Declared Counted Cash:</span>
                  <span className="text-rose-300 font-mono">{currencySymbol}{actualCashNum.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center bg-[#161B22] border border-[#1E293B] p-2 rounded-lg">
                <span className="font-bold text-slate-400">Discrepancy (Variance):</span>
                <span className={`font-black text-sm font-mono ${variance < 0 ? 'text-rose-400' : variance > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {variance > 0 ? '+' : ''}{variance.toFixed(2)} {variance === 0 ? '• Perfect Match' : variance < 0 ? '• SHORT' : '• OVER'}
                </span>
              </div>

              {variance !== 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-2.5 rounded-lg flex items-start gap-2 text-[10px] leading-relaxed">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    A cash discrepancy of <strong>{currencySymbol}{Math.abs(variance).toFixed(2)}</strong> has been detected and flagged in the supervisor audit logs.
                  </span>
                </div>
              )}

              {/* Condensed EOD log breakdown preview */}
              <div className="space-y-1.5 pt-1">
                <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Sales by Cashier</div>
                {cashierRows.map(([name, row]) => (
                  <div key={name} className="flex justify-between">
                    <div>{name} <span className="text-slate-600">({row.txCount} txns)</span></div>
                    <div className="text-white font-mono">{currencySymbol}{row.total.toFixed(2)}</div>
                  </div>
                ))}

                <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500 pt-2">Sales by House vs Vendors</div>
                <div className="flex justify-between"><div>House Own-Stock Sales</div><div className="font-mono">{currencySymbol}{houseSalesTotal.toFixed(2)}</div></div>
                <div className="flex justify-between"><div>Consignment Vendor Sales</div><div className="font-mono">{currencySymbol}{consignmentSalesTotal.toFixed(2)}</div></div>
                <div className="flex justify-between"><div>House Commission Retained</div><div className="text-emerald-400 font-mono">{currencySymbol}{houseCommissionTotal.toFixed(2)}</div></div>

                {vendorRows.length > 0 && (
                  <>
                    <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500 pt-2">Top Vendors</div>
                    {vendorRows.slice(0, 5).map((v) => (
                      <div key={v.name + v.total} className="flex justify-between">
                        <div className="truncate max-w-[60%]">{v.name}</div>
                        <div className="font-mono">{currencySymbol}{v.total.toFixed(2)} <span className="text-slate-600">owe {currencySymbol}{v.payout.toFixed(2)}</span></div>
                      </div>
                    ))}
                  </>
                )}

                {topItems.length > 0 && (
                  <>
                    <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500 pt-2">Top Items ({topItems.length} total)</div>
                    {topItems.slice(0, 8).map((it) => (
                      <div key={it.sku + it.name} className="flex justify-between">
                        <div className="truncate max-w-[65%]">{it.name}</div>
                        <div className="font-mono">{it.qty} × {currencySymbol}{it.total.toFixed(2)}</div>
                      </div>
                    ))}
                  </>
                )}

                {sessionMovements.length > 0 && (
                  <>
                    <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500 pt-2">Drawer Movements ({sessionMovements.length})</div>
                    <div className="flex justify-between">
                      <div>Total cash banked / dropped out</div>
                      <div className="text-cyan-400 font-mono">
                        -{currencySymbol}
                        {sessionMovements
                          .filter((l) => l.eventType !== 'paid_in')
                          .reduce((acc, cur) => acc + (cur.amount || 0), 0)
                          .toFixed(2)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Print and Save triggers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 print:hidden">
              <button
                type="button"
                onClick={handlePrintReport}
                className="bg-[#1E293B] hover:bg-[#2D3748] text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700/60 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-cyan-400" />
                <span>Print Daily Report Receipt</span>
              </button>

              <button
                type="button"
                onClick={handleFinalizeAndClose}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-md shadow-emerald-950/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Close Shop &amp; Sign Out</span>
              </button>
            </div>
            
            <p className="text-[10px] text-slate-500 text-center font-semibold uppercase tracking-wider pt-1.5">
              ⚠️ Warning: Clicking "Close Shop &amp; Sign Out" locks the terminal. A new starting float will be required.
            </p>
          </div>
        )}
      </div>

      {/* Live Drawer Adjustment Modal — ported from Reports → EOD */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-[60] bg-[#0F1115]/80 flex items-center justify-center p-4">
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
                    Cash Amount ({currencySymbol})
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
                <div className="w-full bg-[#0F1115] border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-white font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{currentStaff.name}</span>
                  </div>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono font-bold">
                    AUTHENTICATED
                  </span>
                </div>
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
