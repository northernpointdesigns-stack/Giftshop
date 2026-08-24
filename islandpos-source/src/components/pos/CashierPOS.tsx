import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Tag,
  ArrowRight,
  Package,
  Layers,
  PauseCircle,
  PlayCircle,
  Percent,
  Search,
  X,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  UserCheck,
  Users,
  Award,
} from 'lucide-react';
import { Customer, InventoryItem, Transaction } from '../../types/pos';
import { posDb } from '../../services/db';
import { soundService } from '../../services/audio';
import { customerChannel } from '../../services/customerChannel';
import { BarcodeScannerEmulated } from './BarcodeScannerEmulated';
import { CheckoutModal } from './CheckoutModal';
import { ReceiptModal } from './ReceiptModal';
import { RefundModal } from './RefundModal';
import { CustomerLookupModal } from './CustomerLookupModal';

interface CashierPOSProps {
  inventory: InventoryItem[];
  onRefreshData: () => void;
}

interface CartItem {
  item: InventoryItem;
  quantity: number;
}

export const CashierPOS: React.FC<CashierPOSProps> = ({
  inventory,
  onRefreshData,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 13.50;

  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [heldCart, setHeldCart] = useState<CartItem[] | null>(null);

  // Attached Customer State
  const [attachedCustomer, setAttachedCustomer] = useState<Customer | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState<boolean>(false);
  const [isCustomerLookupOpen, setIsCustomerLookupOpen] = useState<boolean>(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [refundSearchQuery, setRefundSearchQuery] = useState<string>('');

  // Keyboard shortcut listener for quick search focus (Press '/' or 'Ctrl+K')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'SELECT';
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dynamic Categories from DB + Inventory
  const dbCategories: string[] = posDb.getCategories().map((c) => c.name);
  const inventoryCategories: string[] = inventory.map((i) => i.category);
  const allCategoryNames: string[] = Array.from(new Set<string>([...dbCategories, ...inventoryCategories]));
  const categories: string[] = ['All', ...allCategoryNames];

  const brands = [
    'All',
    ...Array.from(new Set(inventory.map((i) => i.brand || 'Ocean Seychelles'))),
  ];

  const vatRate = posDb.getVatRate();

  const getCategoryCount = (catName: string) => {
    if (catName === 'All') return inventory.length;
    return inventory.filter((i) => i.category === catName).length;
  };

  // Filtered inventory items (real-time filtering across name, SKU, size, variant, brand, category)
  const filteredInventory = inventory.filter((item) => {
    const itemBrand = item.brand || 'Ocean Seychelles';
    const matchesBrand = selectedBrand === 'All' || itemBrand === selectedBrand;
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    
    const query = searchQuery.trim().toLowerCase();
    if (!query) return matchesBrand && matchesCategory;

    const matchesName = item.name.toLowerCase().includes(query);
    const matchesSku = item.sku.toLowerCase().includes(query);
    const matchesCategoryText = item.category.toLowerCase().includes(query);
    const matchesBrandText = itemBrand.toLowerCase().includes(query);
    const matchesSize = item.size ? item.size.toLowerCase().includes(query) : false;
    const matchesVariant = item.variant ? item.variant.toLowerCase().includes(query) : false;
    const matchesLine = item.productLine ? item.productLine.toLowerCase().includes(query) : false;

    return (
      matchesBrand &&
      matchesCategory &&
      (matchesName ||
        matchesSku ||
        matchesCategoryText ||
        matchesBrandText ||
        matchesSize ||
        matchesVariant ||
        matchesLine)
    );
  });

  // Handle Enter key in Search Bar to quickly add exact SKU or top search result
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const exactSkuMatch = inventory.find(
        (i) => i.sku.toLowerCase() === searchQuery.trim().toLowerCase()
      );
      if (exactSkuMatch && exactSkuMatch.stockLevel > 0) {
        soundService.playBeep();
        handleAddToCart(exactSkuMatch);
        setSearchQuery('');
        return;
      }
      if (filteredInventory.length === 1 && filteredInventory[0].stockLevel > 0) {
        soundService.playBeep();
        handleAddToCart(filteredInventory[0]);
        setSearchQuery('');
      }
    }
  };

  // Sync Customer Secondary Display
  useEffect(() => {
    const netSubtotal = Math.max(
      0,
      cart.reduce((acc, c) => acc + c.item.retailPrice * c.quantity, 0) - discountAmount
    );
    
    // Calculate total VAT
    const tax = Math.max(
      0,
      Number(
        cart
          .reduce(
            (acc, c) =>
              acc + c.item.retailPrice * c.quantity * (c.item.vatRate ?? vatRate),
            0
          )
          .toFixed(2)
      )
    );
    const total = Math.max(0, Number((netSubtotal + tax).toFixed(2)));
    const secondarySubtotal = Number((netSubtotal / exchangeRate).toFixed(2));
    const secondaryTax = Number((tax / exchangeRate).toFixed(2));

    const lastItem = cart.length > 0 ? cart[cart.length - 1].item : undefined;

    customerChannel.updateState({
      cartItems: cart.map((c) => ({
        id: c.item.id,
        name: c.item.name,
        brand: c.item.brand,
        quantity: c.quantity,
        unitPrice: c.item.retailPrice,
        totalPrice: c.item.retailPrice * c.quantity,
        secondaryUnitPrice: c.item.retailPriceSecondary || (c.item.retailPrice / exchangeRate),
        secondaryTotalPrice: (c.item.retailPriceSecondary || (c.item.retailPrice / exchangeRate)) * c.quantity,
      })),
      subtotal: netSubtotal,
      tax,
      total,
      isCheckingOut: isCheckoutOpen,
      displayCurrency: settings.defaultCurrencyMode === 'secondary' ? 'secondary' : 'primary',
      secondarySubtotal,
      secondaryTax,
      secondaryTotal: Number((secondarySubtotal + secondaryTax).toFixed(2)),
      lastScannedItem: lastItem
        ? {
            name: lastItem.name,
            brand: lastItem.brand,
            price: lastItem.retailPrice,
            stockRemaining: lastItem.stockLevel,
          }
        : undefined,
    });
  }, [cart, discountAmount, isCheckoutOpen, vatRate, settings.defaultCurrencyMode, exchangeRate]);

  // Cart Handlers
  const handleAddToCart = (item: InventoryItem) => {
    if (item.stockLevel <= 0) return;

    setCart((prevCart) => {
      const existing = prevCart.find((c) => c.item.id === item.id);
      if (existing) {
        return prevCart.map((c) =>
          c.item.id === item.id
            ? { ...c, quantity: Math.min(item.stockLevel, c.quantity + 1) }
            : c
        );
      }
      return [...prevCart, { item, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((c) => {
          if (c.item.id === itemId) {
            const newQty = c.quantity + delta;
            if (newQty <= 0) return null;
            return { ...c, quantity: Math.min(c.item.stockLevel, newQty) };
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart((prevCart) => prevCart.filter((c) => c.item.id !== itemId));
  };

  const handleScanSku = (sku: string) => {
    const item = inventory.find(
      (i) => i.sku.toLowerCase() === sku.toLowerCase() || i.id.toLowerCase() === sku.toLowerCase()
    );
    if (item) {
      handleAddToCart(item);
    }
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscountAmount(0);
  };

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    setHeldCart(cart);
    setCart([]);
    setDiscountAmount(0);
  };

  const handleRecallCart = () => {
    if (!heldCart) return;
    setCart(heldCart);
    setHeldCart(null);
  };

  // Math totals
  const rawSubtotal = cart.reduce(
    (acc, c) => acc + c.item.retailPrice * c.quantity,
    0
  );
  const netSubtotal = Math.max(0, rawSubtotal - discountAmount);
  
  // Calculate per-item VAT
  const vatTotal = cart.reduce((acc, c) => {
    const itemVatRate = c.item.vatRate ?? vatRate;
    const itemPriceAfterDiscountRatio = rawSubtotal > 0 ? netSubtotal / rawSubtotal : 1;
    const effectiveItemTotal = c.item.retailPrice * c.quantity * itemPriceAfterDiscountRatio;
    return acc + effectiveItemTotal * itemVatRate;
  }, 0);

  const roundedVat = Number(vatTotal.toFixed(2));
  const grandTotal = Number((netSubtotal + roundedVat).toFixed(2));

  return (
    <div className="space-y-4">
      {/* Hardware Barcode Scanner Emulated Top Bar */}
      <BarcodeScannerEmulated inventory={inventory} onScanSku={handleScanSku} />

      {/* Main Terminal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Real-time Search Catalog & Category Tabs (7 cols lg) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          {/* Real-time Search & Filter Control Panel */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-3.5 space-y-3 shadow-md">
            {/* Top Row: Search Input with Real-time Match Indicator & Shortcuts */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search item name, SKU barcode, size, or design (Press / to focus)..."
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl pl-10 pr-20 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium placeholder-slate-500"
                />
                <div className="absolute right-2 top-1.5 flex items-center gap-1">
                  {searchQuery ? (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Clear search text"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <kbd className="hidden sm:inline-block bg-[#161B22] text-slate-400 border border-[#1E293B] px-1.5 py-0.5 rounded text-[10px] font-mono">
                      {'/'}
                    </kbd>
                  )}
                </div>
              </div>

              {/* Customer Lookup & Process Refund Buttons */}
              <button
                onClick={() => setIsCustomerLookupOpen(true)}
                className={`w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-sm ${
                  attachedCustomer
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-emerald-950/20'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
                title="Lookup customer purchase history & loyalty points"
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>{attachedCustomer ? attachedCustomer.name : 'Customer Lookup'}</span>
              </button>

              <button
                onClick={() => setIsRefundModalOpen(true)}
                className="w-full sm:w-auto bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-sm"
                title="Process Customer Refund & Return"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Process Refund</span>
              </button>

              {(selectedBrand !== 'All' || selectedCategory !== 'All' || searchQuery !== '') && (
                <button
                  onClick={() => {
                    setSelectedBrand('All');
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 transition-all"
                  title="Reset all search queries and active category filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Category Filter Pills Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Filter className="w-3.5 h-3.5 text-emerald-400" /> Category Tabs
                </span>
                <span className="text-emerald-400 font-mono text-[10px] normal-case font-semibold">
                  {filteredInventory.length} of {inventory.length} items
                </span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => {
                  const count = getCategoryCount(cat);
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-[#0F1115] text-slate-300 hover:bg-slate-800 border border-[#1E293B]'
                      }`}
                    >
                      <span>{cat}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          isSelected
                            ? 'bg-emerald-800 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Brand Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 scrollbar-none border-t border-[#1E293B]">
                <span className="text-[10px] font-bold text-slate-500 shrink-0 uppercase tracking-wider pl-1">
                  Brand:
                </span>
                {brands.map((b) => (
                  <button
                    key={b}
                    onClick={() => setSelectedBrand(b)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                      selectedBrand === b
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-[#0F1115] text-slate-400 hover:bg-slate-800 border border-[#1E293B]'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Product Cards Grid or Empty Search State */}
          {filteredInventory.length === 0 ? (
            <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-8 text-center space-y-3 my-2 shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-400 mx-auto flex items-center justify-center">
                <Search className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-[#E2E8F0]">No items found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No inventory item matched &quot;{searchQuery || selectedCategory}&quot; in category &quot;{selectedCategory}&quot;. Try searching by SKU barcode, item name, or brand.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setSelectedBrand('All');
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Show All Inventory Items</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredInventory.map((item) => {
                const vendor = posDb.getVendorById(item.vendorId);
                const isConsignment = vendor?.supplierType === 'consignment';
                const isLowStock = item.stockLevel <= item.minStockThreshold;
                const isOutOfStock = item.stockLevel === 0;

                return (
                  <button
                    key={item.id}
                    disabled={isOutOfStock}
                    onClick={() => handleAddToCart(item)}
                    className={`group relative text-left bg-[#161B22] border rounded-xl p-3 flex flex-col justify-between transition-all hover:border-emerald-500/80 hover:shadow-md ${
                      isOutOfStock
                        ? 'opacity-50 border-[#1E293B] cursor-not-allowed'
                        : isLowStock
                        ? 'border-amber-500/40 bg-[#161B22]'
                        : 'border-[#1E293B]'
                    }`}
                  >
                  <div>
                    {/* Top Image or Placeholder */}
                    {item.imageUrl ? (
                      <div className="w-full h-24 rounded-lg overflow-hidden bg-[#0F1115] mb-2 border border-[#1E293B]">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-20 rounded-lg bg-[#0F1115] border border-[#1E293B] flex items-center justify-center text-slate-600 mb-2">
                        <Package className="w-8 h-8" />
                      </div>
                    )}

                    {/* Brand Badge & SKU */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 truncate max-w-[110px]">
                        {item.brand || 'Ocean Seychelles'}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                          isConsignment
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                        }`}
                      >
                        {isConsignment ? 'Deposit' : 'Direct'}
                      </span>
                    </div>

                    <h3 className="font-semibold text-xs text-[#E2E8F0] line-clamp-2 group-hover:text-emerald-400 transition-colors">
                      {item.name}
                    </h3>

                    {/* Line & Size Sub-tag */}
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                      <span>{item.productLine || 'Normal Line'}</span>
                      {item.size && <span>• {item.size}</span>}
                    </div>
                  </div>

                  {/* Price, VAT % & Stock */}
                  <div className="mt-3 pt-2 border-t border-[#1E293B] flex items-end justify-between">
                    <div>
                      <span className="text-xs font-bold font-mono text-emerald-400">
                        {primarySymbol} {item.retailPrice.toFixed(2)}
                      </span>
                      {settings.allowPaymentInSecondary !== false && (
                        <span className="block text-[10px] text-cyan-400 font-mono font-medium">
                          {secondarySymbol}{(item.retailPriceSecondary || (item.retailPrice / exchangeRate)).toFixed(2)} {secondaryCode}
                        </span>
                      )}
                      <span className="block text-[9px] text-slate-500 font-mono mt-0.5">
                        +{Math.round((item.vatRate ?? 0.15) * 100)}% VAT
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isOutOfStock
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : isLowStock
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          : 'bg-[#0F1115] text-slate-300 border border-[#1E293B]'
                      }`}
                    >
                      {isOutOfStock ? '0 left' : `${item.stockLevel} left`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

        {/* Right Column: Live Register Tape Cart (5 cols lg) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-[#161B22] border border-[#1E293B] rounded-xl p-4 flex flex-col justify-between shadow-xl min-h-[580px]">
          <div>
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
                <h2 className="font-bold text-sm text-[#E2E8F0]">Live Register Tape</h2>
              </div>

              <div className="flex items-center gap-1.5">
                {heldCart ? (
                  <button
                    onClick={handleRecallCart}
                    className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-1 rounded text-[11px] font-medium hover:bg-amber-500/30 transition-colors"
                    title="Recall Held Order"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Recall Order</span>
                  </button>
                ) : (
                  cart.length > 0 && (
                    <button
                      onClick={handleHoldCart}
                      className="flex items-center gap-1 bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded text-[11px] font-medium hover:bg-slate-700 transition-colors"
                      title="Hold Cart"
                    >
                      <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Hold</span>
                    </button>
                  )
                )}

                {cart.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                    title="Clear Cart"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Attached Customer Badge */}
            {attachedCustomer ? (
              <div className="mt-2.5 bg-emerald-950/60 border border-emerald-600/40 rounded-xl p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-white block truncate">{attachedCustomer.name}</span>
                    <span className="text-[10px] text-amber-300 font-mono font-bold flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-400" />
                      {attachedCustomer.membershipTier} • {attachedCustomer.loyaltyPoints} pts
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setAttachedCustomer(null)}
                  className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                  title="Detach Customer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsCustomerLookupOpen(true)}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <UserCheck className="w-3.5 h-3.5" /> + Attach Customer
                </button>
              </div>
            )}

            {/* Cart Items List */}
            <div className="my-3 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-medium text-slate-400">Register Tape Empty</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Scan items or tap product cards to add to sale
                  </p>
                </div>
              ) : (
                cart.map(({ item, quantity }) => {
                  const vendor = posDb.getVendorById(item.vendorId);
                  const isConsignment = vendor?.supplierType === 'consignment';

                  return (
                    <div
                      key={item.id}
                      className="bg-[#0F1115] p-2.5 rounded-lg border border-[#1E293B] flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[10px] text-emerald-300 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20 shrink-0">
                            {item.brand || 'Ocean'}
                          </span>
                          <span className="font-medium text-xs text-[#E2E8F0] truncate">
                            {item.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{primarySymbol} {item.retailPrice.toFixed(2)} ea</span>
                          {settings.allowPaymentInSecondary !== false && (
                            <span className="text-cyan-400">({secondarySymbol}{(item.retailPriceSecondary || (item.retailPrice / exchangeRate)).toFixed(2)} {secondaryCode})</span>
                          )}
                          <span className="text-slate-600">•</span>
                          <span className="text-cyan-400">{Math.round((item.vatRate ?? 0.15) * 100)}% VAT</span>
                          {isConsignment && (
                            <span className="text-amber-400 font-semibold">(Deposit)</span>
                          )}
                        </div>
                      </div>

                      {/* Qty Controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono text-xs font-bold w-5 text-center text-[#E2E8F0]">
                          {quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        <div className="text-right w-16 font-mono text-xs font-bold text-emerald-400">
                          {primarySymbol} {(item.retailPrice * quantity).toFixed(2)}
                        </div>

                        <button
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cart Bottom Summary & Checkout */}
          <div className="pt-3 border-t border-[#1E293B] space-y-2">
            {/* Inline Discount Control */}
            {cart.length > 0 && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-amber-400" /> Custom Discount ({primarySymbol}):
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-20 bg-[#0F1115] border border-[#1E293B] rounded px-2 py-1 text-right text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Net Subtotal</span>
                <span className="font-mono">{primarySymbol} {netSubtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Discount</span>
                  <span className="font-mono">-{primarySymbol} {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-cyan-400 font-semibold">
                <span className="flex items-center gap-1">
                  <Percent className="w-3 h-3" /> VAT Tax Breakdown ({( (cart[0]?.item.vatRate ?? settings.defaultVatRate ?? 0.15) * 100 ).toFixed(0)}%)
                </span>
                <span className="font-mono">+{primarySymbol} {roundedVat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base text-[#E2E8F0] pt-1 border-t border-[#1E293B] items-start">
                <div>
                  <span>Grand Total</span>
                  {settings.allowPaymentInSecondary !== false && (
                    <span className="block text-[10px] text-cyan-400 font-mono font-medium mt-0.5">
                      Or equivalent: {secondarySymbol}{
                        (
                          cart.reduce((sum, c) => {
                            const unitSec = c.item.retailPriceSecondary && c.item.retailPriceSecondary > 0
                              ? c.item.retailPriceSecondary
                              : (c.item.retailPrice / exchangeRate);
                            return sum + (unitSec * c.quantity);
                          }, 0) + (roundedVat / exchangeRate) - (discountAmount / exchangeRate)
                        ).toFixed(2)
                      } {secondaryCode}
                    </span>
                  )}
                </div>
                <span className="font-mono text-emerald-400 text-lg">{primarySymbol} {grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              disabled={cart.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <span>Pay Total {primarySymbol} {grandTotal.toFixed(2)}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Payment Modal */}
      {isCheckoutOpen && (
        <CheckoutModal
          cart={cart}
          subtotal={netSubtotal}
          tax={roundedVat}
          discount={discountAmount}
          total={grandTotal}
          attachedCustomer={attachedCustomer}
          onClose={() => setIsCheckoutOpen(false)}
          onCompleteTransaction={(tx) => {
            setIsCheckoutOpen(false);
            setCart([]);
            setDiscountAmount(0);
            setCompletedTransaction(tx);
            onRefreshData();
          }}
        />
      )}

      {/* Completed Receipt Modal */}
      {completedTransaction && (
        <ReceiptModal
          transaction={completedTransaction}
          onClose={() => setCompletedTransaction(null)}
          onNewSale={() => setCompletedTransaction(null)}
        />
      )}

      {/* Customer Lookup & Transaction History Modal */}
      {isCustomerLookupOpen && (
        <CustomerLookupModal
          inventory={inventory}
          onClose={() => setIsCustomerLookupOpen(false)}
          onSelectCustomerForCart={(cust) => {
            setAttachedCustomer(cust);
          }}
          onAddToCartItem={(item) => {
            handleAddToCart(item);
          }}
          onProcessRefundForReceipt={(receiptNum) => {
            setRefundSearchQuery(receiptNum);
            setIsRefundModalOpen(true);
          }}
        />
      )}

      {/* Process Refund Modal */}
      {isRefundModalOpen && (
        <RefundModal
          inventory={inventory}
          initialReceiptNumber={refundSearchQuery}
          onClose={() => {
            setIsRefundModalOpen(false);
            setRefundSearchQuery('');
          }}
          onCompleteRefund={(refundTx) => {
            setIsRefundModalOpen(false);
            setRefundSearchQuery('');
            setCompletedTransaction(refundTx);
            onRefreshData();
          }}
        />
      )}
    </div>
  );
};
