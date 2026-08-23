import React, { useState } from 'react';
import {
  RotateCcw,
  X,
  Search,
  AlertTriangle,
  CheckCircle2,
  Package,
  Receipt,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { Transaction, InventoryItem, CartItem } from '../../types/pos';
import { posDb } from '../../services/db';
import { soundService } from '../../services/audio';

interface RefundModalProps {
  inventory: InventoryItem[];
  cashierName: string;
  initialReceiptNumber?: string;
  isOpen: boolean;
  onClose: () => void;
  onRefundComplete: (refundTx: Transaction) => void;
}

export const RefundModal: React.FC<RefundModalProps> = ({
  inventory,
  cashierName,
  initialReceiptNumber = '',
  isOpen,
  onClose,
  onRefundComplete,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';

  const [receiptQuery, setReceiptQuery] = useState(initialReceiptNumber);
  const [foundTx, setFoundTx] = useState<Transaction | null>(() => {
    if (initialReceiptNumber) {
      return posDb.getTransactionByIdOrReceipt(initialReceiptNumber) || null;
    }
    return null;
  });

  const [selectedItems, setSelectedItems] = useState<{ [itemId: string]: number }>({});
  const [refundReason, setRefundReason] = useState('Customer Return / Defect');
  const [refundTender, setRefundTender] = useState<'cash' | 'card'>('cash');
  const [restockToInventory, setRestockToInventory] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearchReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!receiptQuery.trim()) return;

    const tx = posDb.getTransactionByIdOrReceipt(receiptQuery.trim());
    if (!tx) {
      setErrorMsg('Receipt not found. Please double check the receipt number.');
      setFoundTx(null);
      soundService.playErrorBeep();
      return;
    }

    if (tx.isVoided) {
      setErrorMsg('This receipt was already voided and cannot be refunded.');
      setFoundTx(null);
      soundService.playErrorBeep();
      return;
    }

    setFoundTx(tx);
    // Pre-select all items with original quantities
    const initialSelection: { [itemId: string]: number } = {};
    tx.items.forEach((item) => {
      initialSelection[item.itemId] = item.quantity;
    });
    setSelectedItems(initialSelection);
    setRefundTender(tx.paymentMethod === 'card' ? 'card' : 'cash');
  };

  const handleQtyChange = (itemId: string, maxQty: number, val: number) => {
    const clamped = Math.max(0, Math.min(maxQty, val));
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: clamped,
    }));
  };

  // Calculate refund totals based on selected items
  const itemsToRefund: CartItem[] = [];
  let refundTotal = 0;

  if (foundTx) {
    foundTx.items.forEach((it) => {
      const qty = selectedItems[it.itemId] || 0;
      if (qty > 0) {
        const lineTotal = it.finalPrice * qty;
        refundTotal += lineTotal;
        itemsToRefund.push({
          ...it,
          quantity: qty,
        });
      }
    });
  }

  const handleProcessRefund = () => {
    if (!foundTx || itemsToRefund.length === 0 || refundTotal <= 0) {
      setErrorMsg('Select at least one item quantity to refund.');
      return;
    }

    const exchangeRate = foundTx.exchangeRateUsed || 13.50;

    const refundTxData: Omit<Transaction, 'id' | 'receiptNumber' | 'timestamp'> = {
      items: itemsToRefund,
      subtotal: Number((refundTotal / 1.15).toFixed(2)),
      discountTotal: 0,
      taxTotal: Number((refundTotal - refundTotal / 1.15).toFixed(2)),
      total: Number(refundTotal.toFixed(2)),
      secondaryTotal: Number((refundTotal / exchangeRate).toFixed(2)),
      exchangeRateUsed: exchangeRate,
      paymentMethod: refundTender,
      cashierName,
      isRefund: true,
      refundReason,
      originalReceiptNumber: foundTx.receiptNumber,
      originalTransactionId: foundTx.id,
      restocked: restockToInventory,
      customerId: foundTx.customerId,
      customerName: foundTx.customerName,
      customerPhone: foundTx.customerPhone,
    };

    try {
      const newRefundTx = posDb.recordTransaction(refundTxData);
      soundService.playSuccessChime();
      onRefundComplete(newRefundTx);
      onClose();
    } catch {
      setErrorMsg('Failed to record refund.');
      soundService.playErrorBeep();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-[#161B22] border border-amber-500/40 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0 my-auto">
        {/* Header */}
        <div className="bg-amber-950/40 border-b border-amber-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Process Item Return & Refund</h2>
              <p className="text-xs text-amber-200/80">Issue partial or full refund against verified receipt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Receipt Lookup Bar */}
          <form onSubmit={handleSearchReceipt} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400">
              Find Original Receipt Number
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={receiptQuery}
                  onChange={(e) => setReceiptQuery(e.target.value)}
                  placeholder="e.g. REC-20260823-0001"
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shrink-0"
              >
                Lookup
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Found Receipt Details & Item Select */}
          {foundTx && (
            <div className="space-y-4 pt-2 border-t border-[#1E293B]">
              <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-mono font-bold text-cyan-400 text-sm">
                    {foundTx.receiptNumber}
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    {new Date(foundTx.timestamp).toLocaleString()} • {foundTx.cashierName}
                  </div>
                  {foundTx.customerName && (
                    <div className="text-emerald-400 text-[11px] mt-0.5">
                      Customer: {foundTx.customerName}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Original Tender</span>
                  <span className="font-bold text-white uppercase">{foundTx.paymentMethod}</span>
                  <div className="font-mono font-bold text-emerald-400">
                    {primarySymbol} {foundTx.total.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Items to return */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Select Quantities to Return
                </label>
                <div className="space-y-2">
                  {foundTx.items.map((it) => {
                    const selectedQty = selectedItems[it.itemId] || 0;
                    return (
                      <div
                        key={it.itemId}
                        className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="truncate flex-1">
                          <span className="font-bold text-white block truncate">{it.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            SKU: {it.sku} • {primarySymbol} {it.finalPrice.toFixed(2)} each (Bought:{' '}
                            {it.quantity})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-400 text-[11px]">Return Qty:</span>
                          <div className="flex items-center gap-1 bg-[#161B22] border border-[#1E293B] rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleQtyChange(it.itemId, it.quantity, selectedQty - 1)}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-mono font-bold text-white">
                              {selectedQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQtyChange(it.itemId, it.quantity, selectedQty + 1)}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Refund Tender & Restock Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Refund Payout Method
                  </label>
                  <select
                    value={refundTender}
                    onChange={(e) => setRefundTender(e.target.value as any)}
                    className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="cash">Cash from Drawer</option>
                    <option value="card">Reverse Card / Credit Voucher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Reason for Return
                  </label>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="restockCheck"
                  checked={restockToInventory}
                  onChange={(e) => setRestockToInventory(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <label htmlFor="restockCheck" className="text-xs text-slate-300 cursor-pointer">
                  Restock returned items back to on-hand inventory catalog
                </label>
              </div>

              {/* Refund Total Summary Banner */}
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase">
                  Total Refund Payable to Customer:
                </span>
                <div className="font-mono font-extrabold text-xl text-amber-400">
                  {primarySymbol} {refundTotal.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#0F1115] border-t border-[#1E293B] p-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!foundTx || refundTotal <= 0}
            onClick={handleProcessRefund}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm & Issue Refund</span>
          </button>
        </div>
      </div>
    </div>
  );
};
