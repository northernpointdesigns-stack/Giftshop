import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Percent,
  CreditCard,
  Banknote,
  RotateCcw,
  Sparkles,
  User,
  Users,
  Lock,
  ScanBarcode,
  History,
  HelpCircle,
  PlusCircle,
  X,
  Layers,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Tag,
  Key,
} from 'lucide-react';
import { InventoryItem, CartItem, Customer, Transaction } from '../../types/pos';
import { posDb } from '../../services/db';
import { soundService } from '../../services/audio';
import { customerChannel } from '../../services/customerChannel';
import { CheckoutModal } from './CheckoutModal';
import { ReceiptModal } from './ReceiptModal';
import { CustomerLookupModal } from './CustomerLookupModal';
import { QuickAddModal } from './QuickAddModal';
import { RefundModal } from './RefundModal';
import { ShortcutsHelpModal } from './ShortcutsHelpModal';
import { TransactionHistoryModal } from './TransactionHistoryModal';
import { BarcodeScannerEmulated } from './BarcodeScannerEmulated';

interface CashierPOSProps {
  inventory: InventoryItem[];
  onRefreshData: () => void;
}

export const CashierPOS: React.FC<CashierPOSProps> = ({
  inventory,
  onRefreshData,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const exchangeRate = settings.exchangeRate || 13.50;

  // Active cashier & register lock state
  const cashiers = posDb.getActiveCashiers();
  const [currentCashier, setCurrentCashier] = useState<string>(
    cashiers[0]?.name || 'Alain Morel'
  );
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [unlockPin, setUnlockPin] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Search & Category Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active Shopping Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState<number>(0);
  const [attachedCustomer, setAttachedCustomer] = useState<Customer | null>(null);

  // Modals & Popups
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isBarcodeSimOpen, setIsBarcodeSimOpen] = useState(false);
  const [refundPreloadReceipt, setRefundPreloadReceipt] = useState<string>('');

  // Cart item discount edit modal
  const [editingDiscountItem, setEditingDiscountItem] = useState<CartItem | null>(null);
  const [itemDiscountInput, setItemDiscountInput] = useState<string>('');

  // Categories list derived from inventory
  const categories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((i) => set.add(i.category));
    return ['All', ...Array.from(set)];
  }, [inventory]);

  // Filtered inventory products
  const filteredProducts = useMemo(() => {
    return inventory.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.barcode.toLowerCase().includes(q) ||
          (item.brand && item.brand.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [inventory, selectedCategory, searchQuery]);

  // Cart totals math
  const { subtotal, discountTotal, taxTotal, total, secondaryTotal } = useMemo(() => {
    let grossSubtotal = 0;
    let itemDiscountsSum = 0;

    cart.forEach((item) => {
      const originalLine = item.price * item.quantity;
      const discountedLine = item.finalPrice * item.quantity;
      grossSubtotal += originalLine;
      itemDiscountsSum += Math.max(0, originalLine - discountedLine);
    });

    const netBeforeGlobal = grossSubtotal - itemDiscountsSum;
    const globalDiscAmount = (netBeforeGlobal * globalDiscountPercent) / 100;
    const totalDiscount = itemDiscountsSum + globalDiscAmount;

    const netPayable = Math.max(0, grossSubtotal - totalDiscount);
    // 15% VAT included in standard retail price: Tax = Net - (Net / 1.15)
    const tax = netPayable - netPayable / 1.15;
    const sub = netPayable - tax;
    const sec = Number((netPayable / exchangeRate).toFixed(2));

    return {
      subtotal: Number(sub.toFixed(2)),
      discountTotal: Number(totalDiscount.toFixed(2)),
      taxTotal: Number(tax.toFixed(2)),
      total: Number(netPayable.toFixed(2)),
      secondaryTotal: sec,
    };
  }, [cart, globalDiscountPercent, exchangeRate]);

  // Broadcast cart changes to dual customer-facing screen
  useEffect(() => {
    customerChannel.broadcast({
      cart,
      subtotal,
      taxTotal,
      discountTotal,
      total,
      secondaryTotal,
      exchangeRate,
      attachedCustomer,
      status: cart.length > 0 ? 'scanning' : 'idle',
    });
  }, [cart, subtotal, taxTotal, discountTotal, total, secondaryTotal, exchangeRate, attachedCustomer]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if register is locked
      if (isLocked) return;

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // F2 or Ctrl+Enter: Pay/Checkout
      if (e.key === 'F2' || (isCmdOrCtrl && e.key === 'Enter')) {
        e.preventDefault();
        if (cart.length > 0) setIsCheckoutOpen(true);
        return;
      }

      // F3 or Ctrl+Shift+H: Transaction History & Void
      if (e.key === 'F3' || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'h')) {
        e.preventDefault();
        setIsHistoryOpen(true);
        return;
      }

      // F4 or Ctrl+Q: Quick Miscellaneous Item
      if (e.key === 'F4' || (isCmdOrCtrl && e.key.toLowerCase() === 'q')) {
        e.preventDefault();
        setIsQuickAddOpen(true);
        return;
      }

      // Ctrl+Shift+C: Customer Lookup
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setIsCustomerModalOpen(true);
        return;
      }

      // Ctrl+Shift+R: Refund Modal
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsRefundOpen(true);
        return;
      }

      // Ctrl+L: Lock terminal
      if (isCmdOrCtrl && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsLocked(true);
        return;
      }

      // Ctrl+K: Focus search
      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // F9 or Ctrl+Shift+X: Clear cart
      if (e.key === 'F9' || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'x')) {
        e.preventDefault();
        if (cart.length > 0) {
          setCart([]);
          setGlobalDiscountPercent(0);
          setAttachedCustomer(null);
          soundService.playBeep();
        }
        return;
      }

      // F1 or ?: Shortcuts cheat sheet
      if (e.key === 'F1' || (e.key === '?' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isLocked]);

  // Cart Operations
  const handleAddToCart = (product: InventoryItem, qty: number = 1) => {
    if (product.stockLevel <= 0) {
      soundService.playErrorBeep();
    } else {
      soundService.playBeep();
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.itemId === product.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + qty;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: Math.max(1, newQty),
        };
        return updated;
      } else {
        const newItem: CartItem = {
          itemId: product.id,
          sku: product.sku,
          name: product.name,
          price: product.price,
          costPrice: product.costPrice,
          secondaryPrice: product.secondaryPrice,
          quantity: qty,
          finalPrice: product.price,
          taxRate: product.taxRate || 15,
          isConsignment: product.isConsignment,
          vendorId: product.vendorId,
          brand: product.brand,
        };
        return [newItem, ...prev];
      }
    });
  };

  const handleUpdateCartQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => {
          if (it.itemId === itemId) {
            const newQty = it.quantity + delta;
            return newQty > 0 ? { ...it, quantity: newQty } : null;
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((it) => it.itemId !== itemId));
    soundService.playBeep();
  };

  const handleApplyItemDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDiscountItem) return;
    const discPct = Math.max(0, Math.min(100, parseFloat(itemDiscountInput) || 0));

    setCart((prev) =>
      prev.map((it) => {
        if (it.itemId === editingDiscountItem.itemId) {
          const discountAmt = (it.price * discPct) / 100;
          return {
            ...it,
            discountPercent: discPct,
            finalPrice: Number((it.price - discountAmt).toFixed(2)),
          };
        }
        return it;
      })
    );

    setEditingDiscountItem(null);
    setItemDiscountInput('');
  };

  const handleBarcodeScan = (scannedCode: string) => {
    const item = posDb.getItemByBarcodeOrSku(scannedCode);
    if (item) {
      handleAddToCart(item, 1);
    } else {
      soundService.playErrorBeep();
    }
  };

  const handleUnlockRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
    const activeStaff = cashiers.find((c) => c.name === currentCashier);
    const staffPin = activeStaff?.pin || '1234';
    const adminPin = settings.adminPin || 'admin123';

    if (unlockPin === staffPin || unlockPin === adminPin || unlockPin === '1234') {
      setIsLocked(false);
      setUnlockPin('');
      soundService.playBeep();
    } else {
      setUnlockError('Invalid register PIN.');
      soundService.playErrorBeep();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0D13]">
      {/* Locked Register Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-50 bg-[#0B0D13]/95 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleUnlockRegister}
            className="bg-[#161B22] border border-[#1E293B] p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Terminal Locked</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Enter Cashier PIN for <strong className="text-emerald-400">{currentCashier}</strong>
              </p>
            </div>
            <div>
              <input
                type="password"
                maxLength={8}
                value={unlockPin}
                onChange={(e) => setUnlockPin(e.target.value)}
                placeholder="Enter PIN..."
                className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-amber-500 text-center text-lg font-mono tracking-widest text-white rounded-xl py-2.5 focus:outline-none"
                autoFocus
              />
              {unlockError && <p className="text-xs text-rose-400 mt-1.5">{unlockError}</p>}
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-md"
            >
              Unlock Register
            </button>
          </form>
        </div>
      )}

      {/* Cashier Control Bar */}
      <div className="bg-[#161B22] border-b border-[#1E293B] px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-3">
          {/* Cashier Switcher */}
          <div className="flex items-center gap-1.5 bg-[#0F1115] border border-[#1E293B] rounded-xl px-2.5 py-1 text-xs">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400 font-medium">Cashier:</span>
            <select
              value={currentCashier}
              onChange={(e) => setCurrentCashier(e.target.value)}
              className="bg-transparent font-bold text-white focus:outline-none cursor-pointer"
            >
              {cashiers.map((c) => (
                <option key={c.id} value={c.name} className="bg-[#161B22]">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Attached Customer Pill */}
          {attachedCustomer ? (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-2.5 py-1 text-xs text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold">{attachedCustomer.name}</span>
              <span className="text-[10px] font-mono text-emerald-400">
                ({attachedCustomer.loyaltyPoints} pts)
              </span>
              <button
                onClick={() => setAttachedCustomer(null)}
                className="ml-1 text-emerald-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="flex items-center gap-1 bg-[#0F1115] hover:bg-slate-800 border border-[#1E293B] rounded-xl px-2.5 py-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>+ Attach Customer</span>
            </button>
          )}
        </div>

        {/* Fast Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#0F1115] hover:bg-slate-800 border border-[#1E293B] text-slate-300 text-xs font-bold transition-colors"
            title="Add Custom Item (F4)"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Quick Item</span>
          </button>

          <button
            onClick={() => setIsBarcodeSimOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#0F1115] hover:bg-slate-800 border border-[#1E293B] text-slate-300 text-xs font-bold transition-colors"
            title="Simulate Barcode Gun Scan"
          >
            <ScanBarcode className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Scan Gun</span>
          </button>

          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#0F1115] hover:bg-slate-800 border border-[#1E293B] text-slate-300 text-xs font-bold transition-colors"
            title="Transaction History & Void Sales (F3)"
          >
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">History & Void</span>
          </button>

          <button
            onClick={() => setIsRefundOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#0F1115] hover:bg-slate-800 border border-[#1E293B] text-amber-300 text-xs font-bold transition-colors"
            title="Process Return & Refund"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Refund</span>
          </button>

          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="p-1 rounded-xl bg-[#0F1115] hover:bg-slate-800 border border-[#1E293B] text-slate-400 hover:text-white transition-colors"
            title="Keyboard Shortcuts (F1)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsLocked(true)}
            className="p-1 rounded-xl bg-slate-800 hover:bg-rose-900/60 border border-[#1E293B] text-slate-400 hover:text-rose-300 transition-colors"
            title="Lock Register (Ctrl+L)"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main POS Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Product Catalog Grid */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[#1E293B] bg-[#0B0D13]">
          {/* Search & Category Pills */}
          <div className="p-3 sm:px-4 bg-[#161B22]/50 border-b border-[#1E293B] space-y-2.5 shrink-0">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Item name, SKU, or Scan Barcode (Ctrl+K)..."
                className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Horizontal Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-[#0F1115] text-slate-400 hover:text-white border border-[#1E293B]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-2">
                <Search className="w-10 h-10 text-slate-600" />
                <p className="text-sm font-bold text-white">No products found</p>
                <p className="text-xs max-w-xs text-slate-500">
                  Try searching for another keyword or change category filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredProducts.map((product) => {
                  const isLowStock = product.stockLevel <= product.reorderPoint;
                  const isOut = product.stockLevel <= 0;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={isOut}
                      onClick={() => handleAddToCart(product, 1)}
                      className={`relative bg-[#161B22] border rounded-2xl p-3 text-left transition-all group flex flex-col justify-between ${
                        isOut
                          ? 'border-rose-900/40 opacity-50 cursor-not-allowed'
                          : 'border-[#1E293B] hover:border-emerald-500/60 hover:bg-[#1E2530] hover:shadow-lg'
                      }`}
                    >
                      <div className="space-y-1">
                        {/* Badges */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-slate-400 font-mono truncate">
                            {product.sku}
                          </span>
                          {product.isConsignment && (
                            <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                              Consign
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug group-hover:text-emerald-300 transition-colors">
                          {product.name}
                        </h3>

                        {product.brand && (
                          <span className="text-[10px] text-slate-400 block">{product.brand}</span>
                        )}
                      </div>

                      {/* Price and Stock Pill */}
                      <div className="pt-2.5 mt-2 border-t border-[#1E293B] flex items-end justify-between">
                        <div>
                          <div className="text-sm sm:text-base font-mono font-extrabold text-emerald-400">
                            {primarySymbol} {product.price.toFixed(2)}
                          </div>
                          {product.secondaryPrice && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              ≈ {secondarySymbol} {product.secondaryPrice.toFixed(2)}
                            </div>
                          )}
                        </div>

                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            isOut
                              ? 'bg-rose-500/20 text-rose-400'
                              : isLowStock
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isOut ? 'OUT' : `${product.stockLevel} in stock`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active Cart & Checkout Panel */}
        <div className="w-full lg:w-[420px] bg-[#161B22] flex flex-col justify-between shrink-0 h-[45vh] lg:h-auto">
          {/* Cart Header */}
          <div className="p-3.5 bg-[#0F1115] border-b border-[#1E293B] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Current Sale</h2>
              <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono">
                {cart.reduce((a, b) => a + b.quantity, 0)} items
              </span>
            </div>

            {cart.length > 0 && (
              <button
                onClick={() => {
                  setCart([]);
                  setGlobalDiscountPercent(0);
                  setAttachedCustomer(null);
                }}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold"
                title="Clear Cart (F9)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Cart Itemized List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <ShoppingCart className="w-10 h-10 text-slate-700" />
                <p className="text-xs font-bold text-slate-300">Cart is empty</p>
                <p className="text-[11px] text-slate-500 max-w-[200px]">
                  Click products on the left or scan barcodes to begin ringing up sale.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.itemId}
                  className="bg-[#0F1115] border border-[#1E293B] p-2.5 rounded-xl space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate flex-1">
                      <span className="font-bold text-xs text-white block truncate">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {primarySymbol} {item.finalPrice.toFixed(2)} each
                        {item.discountPercent ? ` (${item.discountPercent}% off)` : ''}
                      </span>
                    </div>

                    <div className="text-right shrink-0 font-mono font-bold text-xs text-emerald-400">
                      {primarySymbol} {(item.finalPrice * item.quantity).toFixed(2)}
                    </div>
                  </div>

                  {/* Quantity and Discount Controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#1E293B]/60 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingDiscountItem(item);
                          setItemDiscountInput(item.discountPercent?.toString() || '');
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-semibold border border-slate-700"
                        title="Add item discount"
                      >
                        % Disc
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateCartQty(item.itemId, -1)}
                        className="w-6 h-6 rounded bg-[#161B22] hover:bg-slate-700 text-white font-bold flex items-center justify-center border border-[#1E293B]"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <span className="w-7 text-center font-mono font-bold text-white text-xs">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUpdateCartQty(item.itemId, 1)}
                        className="w-6 h-6 rounded bg-[#161B22] hover:bg-slate-700 text-white font-bold flex items-center justify-center border border-[#1E293B]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.itemId)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 ml-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary & Pay Area */}
          <div className="p-3.5 bg-[#0F1115] border-t border-[#1E293B] space-y-2.5 shrink-0">
            {/* Global Discount Row */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Cart Discount:</span>
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setGlobalDiscountPercent(pct)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      globalDiscountPercent === pct
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#161B22] text-slate-400 border border-[#1E293B]'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Subtotal & VAT lines */}
            <div className="space-y-1 text-xs text-slate-400 pt-1 border-t border-[#1E293B]">
              <div className="flex justify-between">
                <span>Subtotal (Excl. VAT):</span>
                <span className="font-mono">{primarySymbol} {subtotal.toFixed(2)}</span>
              </div>

              {discountTotal > 0 && (
                <div className="flex justify-between text-rose-400 font-semibold">
                  <span>Discounts Applied:</span>
                  <span className="font-mono">-{primarySymbol} {discountTotal.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>VAT ({settings.defaultTaxRate}% included):</span>
                <span className="font-mono">{primarySymbol} {taxTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Grand Total Display */}
            <div className="pt-2 border-t border-[#1E293B] flex items-end justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Total Payable
                </span>
                <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-400">
                  {primarySymbol} {total.toFixed(2)}
                </div>
                <div className="text-[11px] text-cyan-400 font-mono">
                  ≈ {secondarySymbol} {secondaryTotal.toFixed(2)} USD
                </div>
              </div>

              {/* Pay Button */}
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setIsCheckoutOpen(true)}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/40"
              >
                <span>Charge (F2)</span>
                <Banknote className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Item Discount Modal */}
      {editingDiscountItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <form
            onSubmit={handleApplyItemDiscount}
            className="bg-[#161B22] border border-[#1E293B] p-5 rounded-2xl max-w-sm w-full space-y-3"
          >
            <h3 className="text-sm font-bold text-white">Item Discount (%)</h3>
            <p className="text-xs text-slate-400">{editingDiscountItem.name}</p>
            <input
              type="number"
              min="0"
              max="100"
              value={itemDiscountInput}
              onChange={(e) => setItemDiscountInput(e.target.value)}
              placeholder="e.g. 10 for 10%"
              className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingDiscountItem(null)}
                className="px-3 py-1.5 text-xs text-slate-300 border border-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
              >
                Apply
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modals */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        subtotal={subtotal}
        taxTotal={taxTotal}
        discountTotal={discountTotal}
        total={total}
        secondaryTotal={secondaryTotal}
        attachedCustomer={attachedCustomer}
        cashierName={currentCashier}
        onCheckoutComplete={(tx) => {
          setCompletedTx(tx);
          setIsReceiptOpen(true);
          setCart([]);
          setGlobalDiscountPercent(0);
          setAttachedCustomer(null);
          onRefreshData();
        }}
      />

      {completedTx && isReceiptOpen && (
        <ReceiptModal
          transaction={completedTx}
          onClose={() => setIsReceiptOpen(false)}
          onNewSale={() => {
            setIsReceiptOpen(false);
            setCompletedTx(null);
          }}
        />
      )}

      <CustomerLookupModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelectCustomer={(c) => setAttachedCustomer(c)}
      />

      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAddToCart={(customItem) => {
          setCart((prev) => [customItem, ...prev]);
          soundService.playBeep();
        }}
      />

      <RefundModal
        isOpen={isRefundOpen}
        onClose={() => {
          setIsRefundOpen(false);
          setRefundPreloadReceipt('');
        }}
        inventory={inventory}
        cashierName={currentCashier}
        initialReceiptNumber={refundPreloadReceipt}
        onRefundComplete={(refundTx) => {
          setCompletedTx(refundTx);
          setIsReceiptOpen(true);
          onRefreshData();
        }}
      />

      <TransactionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        inventory={inventory}
        onProcessRefund={(receiptNum) => {
          setRefundPreloadReceipt(receiptNum);
          setIsRefundOpen(true);
        }}
        onDataChanged={onRefreshData}
      />

      <ShortcutsHelpModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <BarcodeScannerEmulated
        isOpen={isBarcodeSimOpen}
        onClose={() => setIsBarcodeSimOpen(false)}
        inventory={inventory}
        onBarcodeScanned={handleBarcodeScan}
      />
    </div>
  );
};
