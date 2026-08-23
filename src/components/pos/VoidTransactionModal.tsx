import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  ShieldAlert,
  KeyRound,
  RotateCcw,
  Package,
  Banknote,
  Lock,
} from 'lucide-react';
import { InventoryItem, Transaction } from '../../types/pos';
import { posDb } from '../../services/db';
import { soundService } from '../../services/audio';

interface VoidTransactionModalProps {
  transaction: Transaction;
  inventory: InventoryItem[];
  isOpen: boolean;
  onClose: () => void;
  onVoidSuccess: (voidedTx: Transaction) => void;
}

const PRESET_REASONS = [
  'Cashier ringing / barcode scanning error',
  'Customer changed mind / walkout before completing payment',
  'Duplicate charge / double entry',
  'Payment method failed / card declined after receipt generation',
  'Damaged / defective merchandise discovered at checkout',
  'Customer exchange / wrong item selected',
  'System test / training transaction',
  'Other administrative void (specify below)',
];

export const VoidTransactionModal: React.FC<VoidTransactionModalProps> = ({
  transaction,
  inventory,
  isOpen,
  onClose,
  onVoidSuccess,
}) => {
  const settings = posDb.getSettings();
  const staffUsers = posDb.getActiveCashiers();
  const activeSession = posDb.getActiveEODSession();

  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';

  const [selectedReason, setSelectedReason] = useState<string>(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [authorizedStaff, setAuthorizedStaff] = useState<string>(
    staffUsers[0]?.name || transaction.cashierName || 'Store Manager'
  );
  const [authPin, setAuthPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const finalReason =
    selectedReason === 'Other administrative void (specify below)'
      ? customReason.trim() || 'Administrative Void'
      : customReason.trim()
      ? `${selectedReason} - ${customReason.trim()}`
      : selectedReason;

  const isCash = transaction.paymentMethod === 'cash';

  // Calculate inventory restock preview
  const restockPreviews = transaction.items.map((item) => {
    const currentItem = inventory.find((inv) => inv.id === item.itemId || inv.sku === item.sku);
    const currentStock = currentItem ? currentItem.stockLevel : 0;
    const qtyChange = transaction.isRefund
      ? transaction.restocked
        ? -Math.abs(item.quantity)
        : 0
      : Math.abs(item.quantity);
    const newStock = Math.max(0, currentStock + qtyChange);

    return {
      itemId: item.itemId,
      name: item.name,
      sku: item.sku,
      brand: item.brand,
      qtyChange,
      currentStock,
      newStock,
    };
  });

  const handleConfirmVoid = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    const enteredPin = authPin.trim();
    const adminPin = settings.adminPin || 'admin123';
    const cashierPin = settings.cashierPin || '1234';

    const matchingStaff = staffUsers.find((s) => s.name === authorizedStaff);
    const isStaffPinMatch = matchingStaff && matchingStaff.pin === enteredPin;
    const isAdminPinMatch = enteredPin === adminPin;
    const isCashierPinMatch = enteredPin === cashierPin;

    if (settings.adminPin || settings.cashierPin || staffUsers.some((s) => s.pin)) {
      if (!enteredPin) {
        setPinError('Please enter supervisor or cashier PIN to authorize this void.');
        soundService.playErrorBeep();
        return;
      }
      if (!isStaffPinMatch && !isAdminPinMatch && !isCashierPinMatch) {
        setPinError('Invalid PIN entered. Authorization failed.');
        soundService.playErrorBeep();
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const res = posDb.voidTransaction(
        transaction.id,
        authorizedStaff,
        finalReason,
        authorizedStaff
      );

      if (!res.success || !res.transaction) {
        setPinError(res.error || 'Failed to void transaction.');
        soundService.playErrorBeep();
        setIsSubmitting(false);
        return;
      }

      soundService.playBeep();
      onVoidSuccess(res.transaction);
      onClose();
    } catch {
      setPinError('An unexpected error occurred while voiding the transaction.');
      soundService.playErrorBeep();
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-[#161B22] border border-rose-500/40 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0 my-auto">
        {/* Modal Header */}
        <div className="bg-rose-950/70 border-b border-rose-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-900/80 border border-rose-500/50 flex items-center justify-center text-rose-300">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Void Transaction</span>
                <span className="font-mono text-xs font-semibold bg-rose-900/80 text-rose-200 border border-rose-600/50 px-2 py-0.5 rounded">
                  {transaction.receiptNumber}
                </span>
              </h2>
              <p className="text-xs text-rose-200/80 mt-0.5">
                Permanently reverse inventory deductions & cash drawer balance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-rose-300 hover:text-white hover:bg-rose-900/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleConfirmVoid} className="p-5 space-y-4 text-xs text-slate-300 max-h-[80vh] overflow-y-auto">
          {/* Warning Banner */}
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-300">
                Are you sure you want to void Receipt #{transaction.receiptNumber}?
              </p>
              <p className="text-[11px] text-slate-300">
                This will automatically restore items to on-hand inventory, reverse{' '}
                <span className="font-mono font-bold text-white">
                  {primarySymbol} {transaction.total.toFixed(2)}
                </span>{' '}
                from today's drawer sales, and create a timestamped audit record in the EOD balancing log.
              </p>
            </div>
          </div>

          {/* Transaction Metadata Snapshot Card */}
          <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
              <span className="text-slate-400 font-medium">Transaction Time & Cashier:</span>
              <span className="font-semibold text-white">
                {new Date(transaction.timestamp).toLocaleString()} • {transaction.cashierName}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
              <span className="text-slate-400 font-medium">Payment Tendered:</span>
              <div className="text-right">
                <span className="font-bold uppercase text-white">{transaction.paymentMethod}</span>
                {isCash && (
                  <span className="text-emerald-400 text-[11px] block font-mono">
                    Expected Cash Drawer Impact: -{primarySymbol} {transaction.total.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Total Amount:</span>
              <div className="text-right font-mono font-bold text-sm text-emerald-400">
                {primarySymbol} {transaction.total.toFixed(2)}
                {transaction.secondaryTotal && (
                  <span className="text-cyan-400 text-[11px] block font-normal">
                    ≈ {secondarySymbol}{transaction.secondaryTotal.toFixed(2)} USD
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Reversal Effects Breakdown */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-200 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" /> Automatic Reversals Preview
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* 1. Cash Drawer Balance Reversal */}
              <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[11px]">
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  <span>Drawer Balance Effect</span>
                </div>
                {isCash ? (
                  <div className="space-y-0.5 pt-1">
                    <div className="font-mono font-bold text-rose-400 text-sm">
                      -{primarySymbol} {transaction.total.toFixed(2)}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Active Shift expected cash reduced from{' '}
                      <span className="font-mono text-white">
                        {primarySymbol} {activeSession ? activeSession.expectedCash.toFixed(2) : '0.00'}
                      </span>{' '}
                      to{' '}
                      <span className="font-mono text-emerald-400 font-bold">
                        {primarySymbol}{' '}
                        {activeSession
                          ? (activeSession.expectedCash - transaction.total).toFixed(2)
                          : '0.00'}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5 pt-1">
                    <div className="font-mono font-bold text-cyan-400 text-sm">
                      -{primarySymbol} {transaction.total.toFixed(2)} (Card)
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Card sales tally reversed. Cash float in physical drawer is unaffected.
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Audit Trail Log */}
              <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[11px]">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  <span>Shift Audit Log</span>
                </div>
                <div className="pt-1">
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                    VOID SALE LOGGED
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Recorded in End-of-Day reconciliation report under authorized user name.
                  </p>
                </div>
              </div>
            </div>

            {/* Inventory Restock Table */}
            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-slate-400 font-bold text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-400" /> Restocked Inventory Items
                </span>
                <span className="text-amber-400 font-mono text-[10px]">
                  {restockPreviews.length} line item(s)
                </span>
              </div>

              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {restockPreviews.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-[#161B22] p-2 rounded-lg border border-[#1E293B] text-[11px]"
                  >
                    <div className="truncate pr-2">
                      <span className="font-semibold text-white block truncate">{p.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {p.brand || 'Ocean'} • SKU: {p.sku}
                      </span>
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {p.qtyChange >= 0 ? `+${p.qtyChange}` : p.qtyChange} units
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        Stock: {p.currentStock} → <strong className="text-white">{p.newStock}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Void Reason Selector */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-bold">
              Reason for Void <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              {PRESET_REASONS.map((r, i) => (
                <option key={i} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <textarea
              rows={2}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Additional explanation or customer notes (optional)..."
              className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-rose-500 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Authorization & Security PIN Section */}
          <div className="bg-[#0F1115] border border-slate-700/60 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>Supervisor / Staff Authorization</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Authorizing User
                </label>
                <select
                  value={authorizedStaff}
                  onChange={(e) => setAuthorizedStaff(e.target.value)}
                  className="w-full bg-[#161B22] border border-[#1E293B] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name} ({u.role.toUpperCase()})
                    </option>
                  ))}
                  {!staffUsers.some((u) => u.name === transaction.cashierName) && (
                    <option value={transaction.cashierName}>
                      {transaction.cashierName} (Original Cashier)
                    </option>
                  )}
                  <option value="Store Manager">Store Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Security PIN <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  maxLength={8}
                  value={authPin}
                  onChange={(e) => {
                    setPinError(null);
                    setAuthPin(e.target.value);
                  }}
                  placeholder="Enter PIN (e.g. 1234 or admin123)"
                  className="w-full bg-[#161B22] border border-[#1E293B] focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>

            {pinError && (
              <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#1E293B]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold transition-all"
            >
              Cancel & Keep Sale
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900/50 text-white font-bold transition-all shadow-lg shadow-rose-950/40 flex items-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{isSubmitting ? 'Voiding Transaction...' : 'Confirm & Void Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
