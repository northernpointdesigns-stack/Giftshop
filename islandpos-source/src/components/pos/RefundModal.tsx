import React, { useState } from 'react';
import {
  RotateCcw,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Plus,
  Minus,
  Trash2,
  Check,
  Receipt,
  Building2,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { InventoryItem, Transaction, PaymentMethod } from '../../types/pos';
import { posDb } from '../../services/db';

interface RefundModalProps {
  inventory: InventoryItem[];
  initialReceiptNumber?: string;
  onClose: () => void;
  onCompleteRefund: (refundTx: Transaction) => void;
}

interface ReturnItemSelection {
  item: InventoryItem;
  quantity: number;
  returnPrice: number;
  originalUnitPrice?: number;
}

export const RefundModal: React.FC<RefundModalProps> = ({
  inventory,
  initialReceiptNumber = '',
  onClose,
  onCompleteRefund,
}) => {
  const [activeTab, setActiveTab] = useState<'receipt_lookup' | 'manual_catalog'>('receipt_lookup');
  
  // Receipt Lookup Search State
  const [receiptSearchQuery, setReceiptSearchQuery] = useState(initialReceiptNumber);
  const [selectedOriginalTx, setSelectedOriginalTx] = useState<Transaction | null>(() => {
    if (initialReceiptNumber) {
      return posDb.getTransactionByReceiptNumber(initialReceiptNumber) || null;
    }
    return null;
  });

  // Selected Return Items List
  const [returnItems, setReturnItems] = useState<ReturnItemSelection[]>([]);

  // Manual Catalog Search State
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');

  // Reason & Restock Settings State
  const [refundReason, setRefundReason] = useState('');
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>('');
  const [restockInventory, setRestockInventory] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashierName, setCashierName] = useState('Jane Doe');
  const [errorMessage, setErrorMessage] = useState('');

  const PRESET_REASONS = [
    'Defective / Damaged Item',
    'Size / Fit Exchange',
    'Customer Changed Mind',
    'Wrong Item Scanned',
    'Receipt Verified Return',
    'Quality Dissatisfaction',
  ];

  const recentTransactions = posDb
    .getTransactions()
    .filter((tx) => !tx.isRefund)
    .slice(0, 10);

  // Search transaction by receipt number or ID
  const handleSearchReceipt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!receiptSearchQuery.trim()) return;

    const found = posDb.getTransactionByReceiptNumber(receiptSearchQuery.trim());
    if (found) {
      handleSelectOriginalTx(found);
      setErrorMessage('');
    } else {
      setErrorMessage(`No completed sale receipt found matching "${receiptSearchQuery}".`);
    }
  };

  const handleSelectOriginalTx = (tx: Transaction) => {
    setSelectedOriginalTx(tx);
    // Auto-populate return items from original transaction
    const initialReturns: ReturnItemSelection[] = tx.items.map((txItem) => {
      const invItem = inventory.find((i) => i.id === txItem.itemId) || {
        id: txItem.itemId,
        name: txItem.name,
        brand: txItem.brand,
        category: txItem.category,
        productLine: txItem.productLine,
        size: txItem.size,
        variant: txItem.variant,
        sku: txItem.sku,
        stockLevel: 0,
        minStockThreshold: 5,
        retailPrice: txItem.unitPrice,
        costBasis: txItem.costBasis,
        vatRate: txItem.vatRate,
        vendorId: txItem.vendorId,
        createdAt: new Date().toISOString(),
      };

      return {
        item: invItem,
        quantity: Math.abs(txItem.quantity),
        returnPrice: txItem.unitPrice,
        originalUnitPrice: txItem.unitPrice,
      };
    });

    setReturnItems(initialReturns);
  };

  const handleAddManualItem = (invItem: InventoryItem) => {
    setReturnItems((prev) => {
      const existing = prev.find((r) => r.item.id === invItem.id);
      if (existing) {
        return prev.map((r) =>
          r.item.id === invItem.id ? { ...r, quantity: r.quantity + 1 } : r
        );
      }
      return [
        ...prev,
        {
          item: invItem,
          quantity: 1,
          returnPrice: invItem.retailPrice,
          originalUnitPrice: invItem.retailPrice,
        },
      ];
    });
  };

  const handleUpdateItemQty = (itemId: string, delta: number) => {
    setReturnItems((prev) =>
      prev
        .map((r) => {
          if (r.item.id === itemId) {
            const newQty = r.quantity + delta;
            if (newQty <= 0) return null;
            return { ...r, quantity: newQty };
          }
          return r;
        })
        .filter(Boolean) as ReturnItemSelection[]
    );
  };

  const handleRemoveReturnItem = (itemId: string) => {
    setReturnItems((prev) => prev.filter((r) => r.item.id !== itemId));
  };

  const handlePresetReasonClick = (reason: string) => {
    setSelectedPresetReason(reason);
    setRefundReason(reason);
  };

  // Math Calculations for Refund
  const subtotalRefund = returnItems.reduce(
    (sum, r) => sum + r.returnPrice * r.quantity,
    0
  );

  const vatRateDefault = posDb.getVatRate();
  const vatRefundTotal = returnItems.reduce((sum, r) => {
    const rate = r.item.vatRate ?? vatRateDefault;
    return sum + r.returnPrice * r.quantity * rate;
  }, 0);

  const totalRefundAmount = subtotalRefund + vatRefundTotal;

  const totalUnitsToRestock = returnItems.reduce((sum, r) => sum + r.quantity, 0);

  const effectiveReason = refundReason.trim() || selectedPresetReason;

  const handleSubmitRefund = (e: React.FormEvent) => {
    e.preventDefault();

    if (returnItems.length === 0) {
      setErrorMessage('Please select at least one item to return.');
      return;
    }

    if (!effectiveReason) {
      setErrorMessage('Please select or enter a reason for this return/refund.');
      return;
    }

    const itemsPayload = returnItems.map((r) => ({
      item: r.item,
      quantity: r.quantity,
      unitPrice: r.returnPrice,
    }));

    const refundTx = posDb.recordRefundTransaction(
      itemsPayload,
      paymentMethod,
      cashierName,
      effectiveReason,
      restockInventory,
      selectedOriginalTx?.receiptNumber,
      selectedOriginalTx?.id
    );

    onCompleteRefund(refundTx);
  };

  const filteredCatalogItems = inventory.filter((item) => {
    if (!catalogSearchQuery.trim()) return true;
    const q = catalogSearchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      (item.brand && item.brand.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-4xl w-full p-5 text-[#E2E8F0] shadow-2xl relative max-h-[92vh] flex flex-col justify-between my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#1E293B] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E2E8F0] flex items-center gap-2">
                Process Customer Refund & Item Return
              </h2>
              <p className="text-xs text-slate-400">
                Generate negative credit transaction, restore item stock level, and log cash drawer return
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 my-4 overflow-y-auto flex-1 pr-1">
          
          {/* Left Panel: Item Selection & Lookup (7 cols lg) */}
          <div className="lg:col-span-7 space-y-3.5">
            
            {/* Mode Tabs */}
            <div className="flex items-center gap-2 bg-[#0F1115] p-1 rounded-xl border border-[#1E293B]">
              <button
                type="button"
                onClick={() => setActiveTab('receipt_lookup')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'receipt_lookup'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Find Past Sale Receipt</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('manual_catalog')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'manual_catalog'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Manual Item Search</span>
              </button>
            </div>

            {/* Tab 1: Receipt Lookup */}
            {activeTab === 'receipt_lookup' && (
              <div className="space-y-3">
                <form onSubmit={handleSearchReceipt} className="relative">
                  <Search className="w-4 h-4 text-rose-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={receiptSearchQuery}
                    onChange={(e) => setReceiptSearchQuery(e.target.value)}
                    placeholder="Enter receipt # (e.g. INV-20260821-123)..."
                    className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-rose-500 rounded-xl pl-9 pr-24 py-2 text-xs text-[#E2E8F0] focus:outline-none font-mono"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1 bg-rose-600 hover:bg-rose-500 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all"
                  >
                    Lookup
                  </button>
                </form>

                {selectedOriginalTx ? (
                  <div className="bg-[#0F1115] p-3 rounded-xl border border-rose-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs border-b border-[#1E293B] pb-2">
                      <div>
                        <span className="font-bold text-rose-300 font-mono">
                          Receipt: {selectedOriginalTx.receiptNumber}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {new Date(selectedOriginalTx.timestamp).toLocaleString()} • Cashier: {selectedOriginalTx.cashierName}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedOriginalTx(null)}
                        className="text-[10px] text-slate-400 hover:text-rose-400 underline"
                      >
                        Change Receipt
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      Original Purchased Items (Adjust quantities to return):
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B] space-y-2 max-h-[220px] overflow-y-auto">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Select Recent Sale to Refund:
                    </span>
                    <div className="space-y-1.5">
                      {recentTransactions.map((tx) => (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => handleSelectOriginalTx(tx)}
                          className="w-full text-left p-2 rounded-lg bg-[#161B22] hover:bg-slate-800/80 border border-[#1E293B] transition-colors flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold font-mono text-emerald-300">
                              {tx.receiptNumber}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(tx.timestamp).toLocaleTimeString()} • {tx.items.length} items
                            </div>
                          </div>
                          <div className="text-right font-mono font-bold text-slate-200">
                            ${tx.total.toFixed(2)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Manual Catalog Search */}
            {activeTab === 'manual_catalog' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={catalogSearchQuery}
                  onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  placeholder="Quick search item name, brand, or SKU..."
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-rose-500"
                />

                <div className="bg-[#0F1115] p-2 rounded-xl border border-[#1E293B] max-h-[200px] overflow-y-auto space-y-1">
                  {filteredCatalogItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded-lg bg-[#161B22] border border-[#1E293B] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{item.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          SKU: {item.sku} • Retail: ${item.retailPrice.toFixed(2)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddManualItem(item)}
                        className="bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <Plus className="w-3 h-3" /> Add to Return
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Items to Refund List */}
            <div className="bg-[#0F1115] p-3.5 rounded-xl border border-[#1E293B] space-y-2 max-h-[220px] flex flex-col">
              <span className="text-xs font-bold text-slate-300 flex items-center justify-between shrink-0">
                <span>Items Selected for Refund ({returnItems.length})</span>
                <span className="text-rose-400 font-mono text-[11px]">
                  Subtotal: -${subtotalRefund.toFixed(2)}
                </span>
              </span>

              <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                {returnItems.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No items selected for return. Pick a receipt above or add items from search.
                  </div>
                ) : (
                  returnItems.map(({ item, quantity, returnPrice }) => (
                    <div
                      key={item.id}
                      className="bg-[#161B22] p-2.5 rounded-lg border border-[#1E293B] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-rose-200 truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Refund Unit Price: ${returnPrice.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 bg-[#0F1115] px-1.5 py-0.5 rounded border border-[#1E293B]">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(item.id, -1)}
                            className="p-0.5 text-slate-400 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-bold w-5 text-center text-rose-400">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(item.id, 1)}
                            className="p-0.5 text-slate-400 hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-mono font-bold text-rose-400 w-16 text-right">
                          -${(returnPrice * quantity).toFixed(2)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveReturnItem(item.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Refund Reason, Restock Toggle & Summary (5 cols lg) */}
          <div className="lg:col-span-5 bg-[#0F1115] p-4 rounded-xl border border-[#1E293B] flex flex-col justify-between space-y-3">
            
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block border-b border-[#1E293B] pb-2">
                Return Reason & Refund Method
              </span>

              {/* Preset Reason Quick Pills */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Select Return Reason:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => handlePresetReasonClick(reason)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                        selectedPresetReason === reason
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-[#161B22] text-slate-300 hover:bg-slate-800 border border-[#1E293B]'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Reason Text Field */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Reason Note / Explanation (Required):
                </label>
                <input
                  type="text"
                  required
                  value={refundReason}
                  onChange={(e) => {
                    setRefundReason(e.target.value);
                    setSelectedPresetReason('');
                  }}
                  placeholder="e.g. Customer returned defective shirt, size exchange..."
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Inventory Restock Checkbox Option */}
              <div className="p-2.5 bg-[#161B22] rounded-xl border border-[#1E293B] space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restockInventory}
                    onChange={(e) => setRestockInventory(e.target.checked)}
                    className="rounded border-[#1E293B] text-emerald-500 focus:ring-0 accent-emerald-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-200">
                    Restock items into Inventory Stock
                  </span>
                </label>
                <p className="text-[10px] text-slate-400 pl-6">
                  {restockInventory ? (
                    <span className="text-emerald-400 font-semibold">
                      ✓ Will automatically add +{totalUnitsToRestock} unit(s) back to current inventory stock level upon refund submission.
                    </span>
                  ) : (
                    <span className="text-amber-400">
                      ⚠️ Items will NOT be restored to inventory stock (use for write-offs or destroyed goods).
                    </span>
                  )}
                </p>
              </div>

              {/* Refund Payment Method */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Refund Tender / Payment Method:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                        : 'bg-[#161B22] text-slate-400 border-[#1E293B] hover:text-slate-200'
                    }`}
                  >
                    <span>Cash Drawer Return</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      paymentMethod === 'card'
                        ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                        : 'bg-[#161B22] text-slate-400 border-[#1E293B] hover:text-slate-200'
                    }`}
                  >
                    <span>Card / Electronic Refund</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Refund Math Summary Box */}
            <div className="bg-[#161B22] p-3 rounded-xl border border-rose-500/30 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Net Subtotal Refund:</span>
                <span className="font-mono text-rose-300">-${subtotalRefund.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>VAT Tax Refunded:</span>
                <span className="font-mono text-cyan-300">-${vatRefundTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1.5 border-t border-[#1E293B] text-rose-400">
                <span>TOTAL REFUND TO CUSTOMER:</span>
                <span className="font-mono text-base">-${totalRefundAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmitRefund}
                disabled={returnItems.length === 0 || !effectiveReason}
                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Process Refund (-${totalRefundAmount.toFixed(2)})</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
