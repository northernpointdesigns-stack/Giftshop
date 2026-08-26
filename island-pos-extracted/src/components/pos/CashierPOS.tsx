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
  LayoutGrid,
  Zap,
  Globe,
  Lock,
  FileText,
  Monitor,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Customer, InventoryItem, Transaction, StaffUser } from '../../types/pos';
import { posDb } from '../../services/db';
import { soundService } from '../../services/audio';
import { offlineSyncEngine, OfflineSyncStatus } from '../../services/offlineSyncEngine';
import { WifiOff, RefreshCw } from 'lucide-react';
import { customerChannel } from '../../services/customerChannel';
import { calculateCartTotals, getMultiCurrencyEquivalents } from '../../utils/currencyAndMath';
import { BarcodeScannerEmulated } from './BarcodeScannerEmulated';
import { CheckoutModal } from './CheckoutModal';
import { DiscountModal } from './DiscountModal';
import { ReceiptModal } from './ReceiptModal';
import { RefundModal } from './RefundModal';
import { CustomerLookupModal } from './CustomerLookupModal';
import { ReceiptLookupModal } from '../receipts/ReceiptLookupModal';
import { ManagerPinGateModal } from '../auth/ManagerPinGateModal';
import { RegisterSnapshot, loadRegisterSnapshot, saveRegisterSnapshot } from '../../services/registerSnapshot';

interface CashierPOSProps {
  inventory: InventoryItem[];
  onRefreshData: () => void;
  currentStaff?: StaffUser | null;
  activeRegisterId: string;
  onSwitchRegister: (id: string) => void;
  activePriceListId: string;
  onSwitchPriceList: (id: string) => void;
  viewMode: 'grid' | 'quick';
  onChangeViewMode: (mode: 'grid' | 'quick') => void;
  activeCurrencyView: string;
  onSwitchCurrencyView: (currency: string) => void;
  isRefundModalOpen: boolean;
  setIsRefundModalOpen: (open: boolean) => void;
  priceNoticeMsg: string | null;
}

interface CartItem {
  item: InventoryItem;
  quantity: number;
  isDamaged: boolean;
  damageDiscountPercent: number; // whole number, e.g. 50 => 50% off this line
  resolvedPrice?: number;
  priceListName?: string;
  priceListType?: string;
}

export const CashierPOS: React.FC<CashierPOSProps> = ({
  inventory,
  onRefreshData,
  currentStaff,
  activeRegisterId,
  onSwitchRegister,
  activePriceListId,
  onSwitchPriceList,
  viewMode,
  onChangeViewMode,
  activeCurrencyView,
  onSwitchCurrencyView,
  isRefundModalOpen,
  setIsRefundModalOpen,
  priceNoticeMsg,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || '$';
;
  const primaryCode = settings.primaryCurrency || 'USD';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 1;

  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Durable working basket: restored from the per-register snapshot so the
  // register survives navigating to other tabs (settings, inventory, reports)
  // and even an app crash. Lines are validated against live inventory.
  const [initialSnapshot] = useState<RegisterSnapshot | null>(() =>
    loadRegisterSnapshot(activeRegisterId, inventory)
  );
  const [cart, setCart] = useState<CartItem[]>(initialSnapshot?.cart ?? []);

  // Synchronize cart item unit prices when the active pricing tier list changes
  useEffect(() => {
    setCart((prevCart) =>
      prevCart.map((c) => {
        const resolved = posDb.resolveItemPrice(c.item, activePriceListId);
        return {
          ...c,
          resolvedPrice: resolved.unitPrice,
          priceListName: resolved.priceListName,
          priceListType: resolved.priceListType,
        };
      })
    );
  }, [activePriceListId]);
  
  // Real-time Cart Activity Ticker & Error-Prevention Tracking
  interface LastCartActivity {
    itemId: string;
    itemName: string;
    brand?: string;
    quantity: number;
    unitPrice: number;
    action: 'added' | 'incremented' | 'decremented' | 'removed';
    timestamp: number;
    isDoubleScan?: boolean;
  }

  // Real-time Quick Add Feed Mini-List (Last 5 Added/Scanned Items)
  interface QuickAddMiniItem {
    id: string;
    itemId: string;
    name: string;
    brand?: string;
    sku: string;
    size?: string;
    variant?: string;
    unitPrice: number;
    quantity: number;
    timestamp: number;
    imageUrl?: string;
  }

  const [lastActivity, setLastActivity] = useState<LastCartActivity | null>(null);
  const [quickAddHistory, setQuickAddHistory] = useState<QuickAddMiniItem[]>([]);
  const [isQuickAddExpanded, setIsQuickAddExpanded] = useState<boolean>(false);
  const [isAdvancedControlsOpen, setIsAdvancedControlsOpen] = useState<boolean>(false);
  const cartContainerRef = useRef<HTMLDivElement>(null);
  const lastScanTimeRef = useRef<{ itemId: string; time: number }>({ itemId: '', time: 0 });

  // Order-level discount: entered either as a fixed amount or a percentage of the subtotal
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>(
    initialSnapshot?.discountType ?? 'amount'
  );
  const [discountValue, setDiscountValue] = useState<number>(initialSnapshot?.discountValue ?? 0);
  const [heldCart, setHeldCart] = useState<CartItem[] | null>(initialSnapshot?.heldCart ?? null);

  // Attached Customer State
  const [attachedCustomer, setAttachedCustomer] = useState<Customer | null>(
    initialSnapshot?.attachedCustomer ?? null
  );

  // --- Basket persistence -----------------------------------------------
  // Declared BEFORE the register-switch effect so that, on the render where
  // the register changes, the outgoing basket is written under its OWN
  // register key before the incoming one is loaded.
  const snapshotRegisterRef = useRef(activeRegisterId);

  useEffect(() => {
    saveRegisterSnapshot(snapshotRegisterRef.current, {
      cart,
      discountType,
      discountValue,
      heldCart,
      attachedCustomer,
      savedAt: Date.now(),
    });
  }, [cart, discountType, discountValue, heldCart, attachedCustomer]);

  // Switching registers swaps to that register's own saved basket.
  useEffect(() => {
    if (snapshotRegisterRef.current === activeRegisterId) return;
    snapshotRegisterRef.current = activeRegisterId;
    const snap = loadRegisterSnapshot(activeRegisterId, inventory);
    setCart(snap?.cart ?? []);
    setDiscountType(snap?.discountType ?? 'amount');
    setDiscountValue(snap?.discountValue ?? 0);
    setHeldCart(snap?.heldCart ?? null);
    setAttachedCustomer(snap?.attachedCustomer ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRegisterId]);

  // Offline Service Worker Sync Status
  const [offlineStatus, setOfflineStatus] = useState<OfflineSyncStatus>(offlineSyncEngine.getStatus());

  useEffect(() => {
    const unsub = offlineSyncEngine.subscribe((s) => {
      setOfflineStatus(s);
    });
    return () => unsub();
  }, []);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState<boolean>(false);
  const [isCustomerLookupOpen, setIsCustomerLookupOpen] = useState<boolean>(false);
  const [isReceiptLookupOpen, setIsReceiptLookupOpen] = useState<boolean>(false);
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
    ...Array.from(new Set(inventory.map((i) => i.brand || 'Unbranded'))),
  ];

  const vatRate = posDb.getVatRate();

  const getCategoryCount = (catName: string) => {
    if (catName === 'All') return inventory.length;
    return inventory.filter((i) => i.category === catName).length;
  };

  // Filtered inventory items (real-time filtering across name, SKU, size, variant, brand, category)
  const filteredInventory = inventory.filter((item) => {
    const itemBrand = item.brand || 'Unbranded';
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
    // Manual fallback: also match by vendor/supplier name
    const vendorName = posDb.getVendorById(item.vendorId)?.name?.toLowerCase() || '';
    const matchesVendor = query ? vendorName.includes(query) : false;

    return (
      matchesBrand &&
      matchesCategory &&
      (matchesName ||
        matchesSku ||
        matchesCategoryText ||
        matchesBrandText ||
        matchesSize ||
        matchesVariant ||
        matchesLine ||
        matchesVendor)
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
        return;
      }
      soundService.playErrorBeep();
    }
  };

  // Manager Security Gate State
  const [managerGateModal, setManagerGateModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onSuccess: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onSuccess: () => {},
  });

  // Calculate cart totals using centralized precision math utility
  const totals = calculateCartTotals(cart, discountType, discountValue, vatRate, exchangeRate, settings.vatInclusive === true);
  const {
    rawSubtotal,
    itemDiscountTotal,
    afterItemSubtotal,
    discountAmount,
    netSubtotal,
    roundedVat,
    grandTotal,
    secondarySubtotal,
    secondaryTax,
    secondaryTotal,
    secondaryDiscount,
    secondaryItemDiscount,
  } = totals;

  // Active view currency helper
  const isViewingSecondary = activeCurrencyView === (settings.secondaryCurrency || 'USD');
  const activeCurrencyRate = isViewingSecondary
    ? exchangeRate
    : (settings.customerDisplayCurrencies?.find((c) => c.code === activeCurrencyView)?.rate || 1.0);
  const activeCurrencySymbol = isViewingSecondary
    ? secondarySymbol
    : (settings.customerDisplayCurrencies?.find((c) => c.code === activeCurrencyView)?.symbol || primarySymbol);

  // Sync Customer Display
  useEffect(() => {
    const lastCartLine = cart.length > 0 ? cart[cart.length - 1] : undefined;
    const currentReg = (settings.registers || []).find((r) => r.id === activeRegisterId);
    const currentPL = (settings.priceLists || []).find((l) => l.id === activePriceListId);

    customerChannel.updateState({
      cartItems: cart.map((c) => {
        const baseUnitPrice = c.resolvedPrice !== undefined && c.resolvedPrice !== null ? c.resolvedPrice : c.item.retailPrice;
        const effectiveUnitPrice = c.isDamaged
          ? baseUnitPrice * (1 - c.damageDiscountPercent / 100)
          : baseUnitPrice;
        return {
          id: c.item.id,
          name: c.item.name,
          brand: c.item.brand,
          quantity: c.quantity,
          unitPrice: effectiveUnitPrice,
          totalPrice: Number((effectiveUnitPrice * c.quantity).toFixed(2)),
          secondaryUnitPrice: Number((effectiveUnitPrice / exchangeRate).toFixed(2)),
          secondaryTotalPrice: Number(((effectiveUnitPrice * c.quantity) / exchangeRate).toFixed(2)),
          priceListName: c.priceListName,
          priceListType: c.priceListType,
        };
      }),
      subtotal: netSubtotal,
      discount: discountAmount,
      discountType,
      discountValue,
      itemDiscountTotal,
      tax: roundedVat,
      total: grandTotal,
      isCheckingOut: isCheckoutOpen,
      displayCurrency: isViewingSecondary ? 'secondary' : 'primary',
      primaryCurrency: primaryCode,
      primarySymbol: primarySymbol,
      secondaryCurrency: secondaryCode,
      secondarySymbol: secondarySymbol,
      exchangeRate: exchangeRate,
      secondarySubtotal,
      secondaryDiscount,
      secondaryItemDiscount,
      secondaryTax,
      secondaryTotal,
      stationName: currentReg?.name || 'Main Station',
      priceTierName: currentPL ? `${currentPL.name}${currentPL.discountPercentage ? ` (-${currentPL.discountPercentage}%)` : ''}` : undefined,
      lastScannedItem: lastCartLine
        ? {
            name: lastCartLine.item.name,
            brand: lastCartLine.item.brand,
            price: lastCartLine.resolvedPrice ?? lastCartLine.item.retailPrice,
            stockRemaining: lastCartLine.item.stockLevel,
          }
        : undefined,
    });
  }, [
    cart,
    netSubtotal,
    discountAmount,
    discountType,
    discountValue,
    itemDiscountTotal,
    roundedVat,
    grandTotal,
    secondarySubtotal,
    secondaryDiscount,
    secondaryItemDiscount,
    secondaryTax,
    secondaryTotal,
    isCheckoutOpen,
    isViewingSecondary,
    primaryCode,
    primarySymbol,
    secondaryCode,
    secondarySymbol,
    exchangeRate,
    activeRegisterId,
    activePriceListId,
    settings.registers,
    settings.priceLists,
  ]);

  // Auto-scroll Cart Tape to newest item addition/modification
  useEffect(() => {
    if (lastActivity && cartContainerRef.current) {
      cartContainerRef.current.scrollTo({
        top: cartContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [lastActivity, cart.length]);

  // Cart Handlers
  const handleAddToCart = (item: InventoryItem) => {
    if (item.stockLevel <= 0) {
      soundService.playErrorBeep();
      return;
    }
    const resolved = posDb.resolveItemPrice(item, activePriceListId);
    const now = Date.now();
    const isQuickRepeat = lastScanTimeRef.current.itemId === item.id && (now - lastScanTimeRef.current.time) < 2500;
    lastScanTimeRef.current = { itemId: item.id, time: now };

    soundService.playBeep();

    const existing = cart.find((c) => c.item.id === item.id && c.resolvedPrice === resolved.unitPrice);
    const actionType: 'added' | 'incremented' = existing ? 'incremented' : 'added';
    const updatedQty = existing ? Math.min(item.stockLevel, existing.quantity + 1) : 1;

    setCart((prevCart) => {
      if (existing) {
        return prevCart.map((c) =>
          c.item.id === item.id && c.resolvedPrice === resolved.unitPrice
            ? { ...c, quantity: updatedQty }
            : c
        );
      }
      return [
        ...prevCart,
        {
          item,
          quantity: 1,
          isDamaged: false,
          damageDiscountPercent: 50,
          resolvedPrice: resolved.unitPrice,
          priceListName: resolved.priceListName,
          priceListType: resolved.priceListType,
        },
      ];
    });

    setLastActivity({
      itemId: item.id,
      itemName: item.name,
      brand: item.brand,
      quantity: updatedQty,
      unitPrice: resolved.unitPrice,
      action: actionType,
      timestamp: now,
      isDoubleScan: isQuickRepeat && actionType === 'incremented',
    });

    // Update Quick Add Panel Mini-List (Last 5 Items)
    setQuickAddHistory((prev) => {
      const newEntry: QuickAddMiniItem = {
        id: `${item.id}-${now}`,
        itemId: item.id,
        name: item.name,
        brand: item.brand,
        sku: item.sku,
        size: item.size,
        variant: item.variant,
        unitPrice: resolved.unitPrice,
        quantity: updatedQty,
        timestamp: now,
        imageUrl: item.imageUrl,
      };
      const filtered = prev.filter((entry) => entry.itemId !== item.id);
      return [newEntry, ...filtered].slice(0, 5);
    });
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    let targetItemName = '';
    let targetUnitPrice = 0;
    let targetBrand = '';
    let finalQty = 0;

    setCart((prevCart) => {
      return prevCart
        .map((c) => {
          if (c.item.id === itemId) {
            targetItemName = c.item.name;
            targetBrand = c.item.brand || '';
            targetUnitPrice = c.resolvedPrice ?? c.item.retailPrice;
            const newQty = c.quantity + delta;
            if (newQty <= 0) {
              finalQty = 0;
              return null;
            }
            finalQty = Math.min(c.item.stockLevel, newQty);
            return { ...c, quantity: finalQty };
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });

    if (targetItemName) {
      const now = Date.now();
      if (delta > 0) soundService.playBeep();
      else soundService.playErrorBeep();

      setLastActivity({
        itemId,
        itemName: targetItemName,
        brand: targetBrand,
        quantity: finalQty,
        unitPrice: targetUnitPrice,
        action: finalQty === 0 ? 'removed' : delta > 0 ? 'incremented' : 'decremented',
        timestamp: now,
      });

      // Update Quick Add Panel Mini-List
      setQuickAddHistory((prev) => {
        return prev
          .map((entry) => {
            if (entry.itemId === itemId) {
              if (finalQty <= 0) return null;
              return { ...entry, quantity: finalQty, timestamp: now };
            }
            return entry;
          })
          .filter((e): e is QuickAddMiniItem => e !== null);
      });
    }
  };

  const handleRemoveFromCart = (itemId: string) => {
    const target = cart.find((c) => c.item.id === itemId);
    if (target) {
      soundService.playErrorBeep();
      setLastActivity({
        itemId,
        itemName: target.item.name,
        brand: target.item.brand,
        quantity: 0,
        unitPrice: target.resolvedPrice ?? target.item.retailPrice,
        action: 'removed',
        timestamp: Date.now(),
      });
    }
    setCart((prevCart) => prevCart.filter((c) => c.item.id !== itemId));
    setQuickAddHistory((prev) => prev.filter((entry) => entry.itemId !== itemId));
  };

  // Security Gated Action Handlers
  const handleOpenDiscount = () => {
    const isAllowed = settings.cashierAccess?.discounts ?? true;
    if (isAllowed) {
      setIsDiscountModalOpen(true);
    } else {
      setManagerGateModal({
        isOpen: true,
        title: 'Order Discount Authorization',
        description: 'Manager or Shift Lead approval required to apply order-level discounts.',
        onSuccess: () => {
          setManagerGateModal((prev) => ({ ...prev, isOpen: false }));
          setIsDiscountModalOpen(true);
        },
      });
    }
  };

  const handleOpenRefund = () => {
    const isAllowed = settings.cashierAccess?.refunds ?? false;
    if (isAllowed) {
      setIsRefundModalOpen(true);
    } else {
      setManagerGateModal({
        isOpen: true,
        title: 'Customer Refund Authorization',
        description: 'Manager or Shift Lead approval required to initiate product returns and refunds.',
        onSuccess: () => {
          setManagerGateModal((prev) => ({ ...prev, isOpen: false }));
          setIsRefundModalOpen(true);
        },
      });
    }
  };

  const handleToggleDamaged = (itemId: string) => {
    const isAllowed = settings.cashierAccess?.damaged_markdowns ?? true;
    const currentItem = cart.find((c) => c.item.id === itemId);
    const willEnable = currentItem ? !currentItem.isDamaged : true;

    if (!willEnable || isAllowed) {
      setCart((prevCart) =>
        prevCart.map((c) => (c.item.id === itemId ? { ...c, isDamaged: !c.isDamaged } : c))
      );
    } else {
      setManagerGateModal({
        isOpen: true,
        title: 'Damaged Goods Markdown Approval',
        description: 'Manager or Shift Lead approval required to mark down damaged inventory.',
        onSuccess: () => {
          setManagerGateModal((prev) => ({ ...prev, isOpen: false }));
          setCart((prevCart) =>
            prevCart.map((c) => (c.item.id === itemId ? { ...c, isDamaged: true } : c))
          );
        },
      });
    }
  };

  const handleSetDamagePercent = (itemId: string, pct: number) => {
    setCart((prevCart) =>
      prevCart.map((c) =>
        c.item.id === itemId
          ? { ...c, damageDiscountPercent: Math.min(100, Math.max(0, pct || 0)) }
          : c
      )
    );
  };

  const handleScanSku = (sku: string) => {
    if (!sku.trim()) return;
    const item = inventory.find(
      (i) => i.sku.toLowerCase() === sku.toLowerCase() || i.id.toLowerCase() === sku.toLowerCase()
    );
    if (item) {
      handleAddToCart(item);
    }
  };

  const handleClearCart = () => {
    setCart([]);
    setQuickAddHistory([]);
    setDiscountValue(0);
    setDiscountType('amount');
  };

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    setHeldCart(cart);
    setCart([]);
    setDiscountValue(0);
    setDiscountType('amount');
  };

  const handleRecallCart = () => {
    if (!heldCart) return;
    setCart(heldCart);
    setHeldCart(null);
  };

  return (
    <div className="space-y-4">
      {/* Offline Mode Alert Banner */}
      {!offlineStatus.effectiveOnline && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl flex items-center justify-between text-xs text-amber-300 font-medium">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Offline Mode Active:</strong> Internet connection lost or simulated offline. Transactions will continue to process and save locally, auto-syncing when reconnected.
            </span>
          </div>
          {offlineStatus.unsyncedCount > 0 && (
            <span className="font-mono bg-amber-500/20 px-2.5 py-1 rounded-lg font-bold shrink-0 text-amber-200">
              {offlineStatus.unsyncedCount} Pending Sync
            </span>
          )}
        </div>
      )}

      {/* Hardware Barcode Scanner Emulated Top Bar (Runs silently with floating absolute toasts) */}
      <BarcodeScannerEmulated inventory={inventory} onScanSku={handleScanSku} hideVisual={true} />

      {/* Main Terminal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start w-full min-w-0">
        {/* Left Column: Real-time Search Catalog & Category Tabs (7 cols lg, 8 cols xl) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3 w-full min-w-0">
          {/* Real-time Search & Filter Control Panel */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-3 sm:p-3.5 space-y-3 shadow-md w-full min-w-0 overflow-hidden">
            {/* Top Row: Search Input with Real-time Match Indicator & Shortcuts */}
            <div className="flex flex-wrap items-center gap-2 w-full min-w-0">
              <div className="relative flex-1 min-w-[220px] w-full sm:w-auto">
                <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search item name, SKU barcode, size, or design (Press / to focus)..."
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl pl-10 pr-16 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium placeholder-slate-500"
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

              {/* Customer Lookup & Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setIsCustomerLookupOpen(true)}
                  className={`px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-all shadow-sm ${
                    attachedCustomer
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-emerald-950/20'
                      : 'bg-[#1F2937]/50 hover:bg-slate-800 text-slate-300 border border-[#374151]'
                  }`}
                  title="Lookup customer purchase history & loyalty points"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="max-w-[130px] truncate">{attachedCustomer ? attachedCustomer.name : 'Customer Lookup'}</span>
                </button>

                <button
                  onClick={() => setIsReceiptLookupOpen(true)}
                  className="bg-[#1F2937]/50 hover:bg-slate-800 text-slate-300 border border-[#374151] px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-all shadow-sm"
                  title="Search receipts, verify calculation integrity, and print thermal or A4 receipts"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Receipts</span>
                </button>

                {(selectedBrand !== 'All' || selectedCategory !== 'All' || searchQuery !== '') && (
                  <button
                    onClick={() => {
                      setSelectedBrand('All');
                      setSelectedCategory('All');
                      setSearchQuery('');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-all"
                    title="Reset all search queries and active category filters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Dynamic Pricing Tier or Station Notice banner (if set) */}
            {priceNoticeMsg && (
              <div className="bg-[#0F1115] border border-cyan-500/30 text-cyan-300 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-2 mb-1 animate-in slide-in-from-top duration-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                <span>{priceNoticeMsg}</span>
              </div>
            )}

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
          ) : viewMode === 'quick' ? (
            /* Touch/Scan-first compact rows */
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {filteredInventory.map((item) => {
                const vendor = posDb.getVendorById(item.vendorId);
                const resolved = posDb.resolveItemPrice(item, activePriceListId);
                const hasTierDiscount = resolved.unitPrice !== item.retailPrice;

                return (
                  <button
                    key={item.id}
                    disabled={item.stockLevel === 0}
                    onClick={() => handleAddToCart(item)}
                    className="w-full bg-[#161B22] border border-[#1E293B] hover:border-emerald-500/80 rounded-xl p-2.5 flex items-center gap-3 text-left transition-all active:scale-[0.99] disabled:opacity-50 touch-manipulation select-none"
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover shrink-0 border border-[#1E293B]" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#0F1115] border border-[#1E293B] flex items-center justify-center text-slate-600 text-xs font-black shrink-0">
                        {item.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-sm font-semibold text-[#E2E8F0] truncate">{item.name}</span>
                        {hasTierDiscount && (
                          <span className="text-[9px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.2 rounded font-mono shrink-0">
                            {resolved.priceListName}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {item.brand || 'Ocean'} • {vendor?.name || 'House Stock'} • SKU: {item.sku}
                        {item.stockLevel <= item.minStockThreshold && (
                          <span className="text-amber-400"> • Only {item.stockLevel} left</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-emerald-400 text-sm">
                        {primarySymbol} {resolved.unitPrice.toFixed(2)}
                      </div>
                      {hasTierDiscount && (
                        <div className="text-[10px] text-slate-500 font-mono line-through">
                          {primarySymbol} {item.retailPrice.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredInventory.map((item) => {
                const vendor = posDb.getVendorById(item.vendorId);
                const isLowStock = item.stockLevel <= item.minStockThreshold;
                const isOutOfStock = item.stockLevel === 0;
                const resolved = posDb.resolveItemPrice(item, activePriceListId);
                const hasTierDiscount = resolved.unitPrice !== item.retailPrice;

                return (
                  <button
                    key={item.id}
                    disabled={isOutOfStock}
                    onClick={() => handleAddToCart(item)}
                    className={`group relative text-left bg-[#161B22] border rounded-2xl p-2.5 flex flex-col justify-between transition-all hover:border-emerald-500/80 hover:shadow-md touch-manipulation select-none ${
                      isOutOfStock
                        ? 'opacity-40 border-[#1E293B] cursor-not-allowed'
                        : isLowStock
                        ? 'border-amber-500/30'
                        : 'border-[#1E293B]'
                    }`}
                  >
                    <div>
                      {/* Top Image or Placeholder */}
                      <div className="relative w-full h-24 rounded-xl overflow-hidden bg-[#0F1115] mb-2 border border-[#1E293B]">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
                            {item.name.slice(0, 2)}
                          </div>
                        )}

                        {/* Soft, modern stock status pill absolute over image */}
                        <div className="absolute top-1.5 right-1.5">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md shadow-xs ${
                              isOutOfStock
                                ? 'bg-rose-500 text-white'
                                : isLowStock
                                ? 'bg-amber-500 text-[#0F1115]'
                                : 'bg-[#0F1115]/80 text-slate-300 backdrop-blur-xs border border-[#1E293B]'
                            }`}
                          >
                            {isOutOfStock ? 'Out of stock' : `${item.stockLevel} left`}
                          </span>
                        </div>
                      </div>

                      {/* Brand name and SKU - compact */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5 font-medium px-0.5">
                        <span className="truncate">{item.brand || 'Unbranded'}</span>
                        {item.size && <span className="font-mono text-[9px] text-slate-400 bg-slate-800 px-1 py-0.2 rounded">{item.size}</span>}
                      </div>

                      <h3 className="font-semibold text-xs text-[#E2E8F0] line-clamp-2 px-0.5 leading-snug group-hover:text-emerald-400 transition-colors">
                        {item.name}
                      </h3>
                    </div>

                    {/* Simple Bottom Price Row */}
                    <div className="mt-2.5 pt-1.5 border-t border-[#1E293B]/60 flex items-center justify-between px-0.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400">
                          {primarySymbol} {resolved.unitPrice.toFixed(2)}
                        </span>
                        {hasTierDiscount && (
                          <span className="text-[10px] text-slate-500 font-mono line-through">
                            {primarySymbol} {item.retailPrice.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {hasTierDiscount && (
                        <span className="text-[8px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-800/40 px-1.5 py-0.2 rounded font-mono">
                          {resolved.priceListName}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
      </div>

        {/* Right Column: Live Register Tape Cart (5 cols lg, 4 cols xl) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-[#161B22] border border-[#1E293B] rounded-xl p-4 flex flex-col justify-between shadow-xl min-h-[580px] w-full min-w-0">
          <div>
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h2 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
                    Live Register Tape
                    {cart.length > 0 && (
                      <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        {cart.length} {cart.length === 1 ? 'line' : 'lines'} • {cart.reduce((sum, c) => sum + c.quantity, 0)} units
                      </span>
                    )}
                  </h2>
                </div>
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

            {/* REAL-TIME SCANNER / ACTION ACTIVITY TICKER & INSTANT UNDO BANNER */}
            {lastActivity && (Date.now() - lastActivity.timestamp < 6000) && (
              <div
                className={`mt-2.5 p-2.5 rounded-xl border flex items-center justify-between gap-2 shadow-lg transition-all animate-in fade-in slide-in-from-top-1 ${
                  lastActivity.isDoubleScan
                    ? 'bg-amber-950/90 border-amber-500/80 text-amber-200 ring-2 ring-amber-500/40'
                    : lastActivity.action === 'removed'
                    ? 'bg-rose-950/90 border-rose-500/70 text-rose-200'
                    : 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200 ring-1 ring-emerald-500/30'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      lastActivity.isDoubleScan
                        ? 'bg-amber-500/20 text-amber-300'
                        : lastActivity.action === 'removed'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {lastActivity.isDoubleScan ? (
                      <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
                    ) : lastActivity.action === 'removed' ? (
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Plus className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      <span className="font-bold uppercase tracking-wider text-[10px]">
                        {lastActivity.isDoubleScan
                          ? '⚡ Quick Scan (+1)'
                          : lastActivity.action === 'removed'
                          ? 'Item Removed'
                          : lastActivity.action === 'incremented'
                          ? 'Qty Increased'
                          : '⚡ Just Added'}
                      </span>
                      <span className="font-bold truncate text-[#E2E8F0]">{lastActivity.itemName}</span>
                    </div>
                    <div className="text-[10px] opacity-90 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {lastActivity.action !== 'removed' && (
                        <span>
                          Current Qty: <strong className="text-white">{lastActivity.quantity}</strong> • {primarySymbol} {lastActivity.unitPrice.toFixed(2)} ea
                        </span>
                      )}
                      {lastActivity.isDoubleScan && (
                        <span className="text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.2 rounded">
                          Double-scan detected!
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Direct Instant Undo (-1) Button */}
                {lastActivity.action !== 'removed' && (
                  <button
                    onClick={() => {
                      handleUpdateQuantity(lastActivity.itemId, -1);
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center gap-1 shrink-0 active:scale-95 shadow-sm"
                    title="Instantly undo last addition / decrease quantity by 1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Undo (-1)</span>
                  </button>
                )}
              </div>
            )}

            {/* REAL-TIME QUICK ADD PANEL (LAST 5 ADDED/SCANNED ITEMS MINI-LIST) */}
            <div className="mt-2.5 bg-[#0F1115] border border-[#1E293B] rounded-xl p-2.5 shadow-inner">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#1E293B]">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-[#E2E8F0] tracking-tight">Quick Add Panel</span>
                  <span className="text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded-full">
                    Last 5 Scanned
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {quickAddHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQuickAddHistory([])}
                      className="text-[10px] text-slate-500 hover:text-rose-400 font-semibold transition-colors"
                      title="Clear Quick Add History feed"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsQuickAddExpanded(!isQuickAddExpanded)}
                    className="text-slate-400 hover:text-slate-200 p-0.5 transition-colors"
                    title={isQuickAddExpanded ? 'Collapse Quick Add Panel' : 'Expand Quick Add Panel'}
                  >
                    {isQuickAddExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {isQuickAddExpanded && (
                <div className="mt-2 space-y-1.5">
                  {quickAddHistory.length === 0 ? (
                    <div className="py-2 text-center text-[11px] text-slate-500 font-medium">
                      ⚡ Quick Add Mini-List Empty. Scanned items will appear here in real-time.
                    </div>
                  ) : (
                    quickAddHistory.map((qItem, idx) => {
                      const isLatest = idx === 0;
                      return (
                        <div
                          key={qItem.id}
                          className={`p-2 rounded-lg border flex items-center justify-between gap-2 text-xs transition-all ${
                            isLatest
                              ? 'bg-emerald-950/60 border-emerald-500/70 ring-1 ring-emerald-500/30 shadow-xs'
                              : 'bg-[#161B22] border-[#1E293B]'
                          }`}
                        >
                          {/* Rank & Product Info */}
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={`text-[9px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                isLatest
                                  ? 'bg-emerald-500 text-slate-950 font-black'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              #{idx + 1}
                            </span>

                            {qItem.imageUrl ? (
                              <img
                                src={qItem.imageUrl}
                                alt={qItem.name}
                                className="w-7 h-7 rounded-md object-cover shrink-0 border border-[#1E293B]"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-md bg-[#0F1115] border border-[#1E293B] flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">
                                {qItem.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1 truncate">
                                <span className="font-bold text-[#E2E8F0] truncate text-[11px]">{qItem.name}</span>
                                {qItem.brand && (
                                  <span className="text-[9px] text-slate-400 truncate shrink-0">({qItem.brand})</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                <span>SKU: {qItem.sku}</span>
                                {qItem.size && <span>• {qItem.size}</span>}
                              </div>
                            </div>
                          </div>

                          {/* Price & Quantity Adjust Controls */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right font-mono">
                              <div className="font-bold text-emerald-400 text-xs">
                                {primarySymbol} {(qItem.unitPrice * qItem.quantity).toFixed(2)}
                              </div>
                              <div className="text-[9px] text-slate-500">
                                {primarySymbol} {qItem.unitPrice.toFixed(2)} ea
                              </div>
                            </div>

                            <div className="flex items-center gap-1 bg-[#0F1115] border border-[#1E293B] rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(qItem.itemId, -1)}
                                className="w-5 h-5 rounded hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                title="Decrease quantity by 1"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-5 text-center text-xs font-bold font-mono text-white">
                                {qItem.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const inv = inventory.find((i) => i.id === qItem.itemId);
                                  if (inv) handleAddToCart(inv);
                                }}
                                className="w-5 h-5 rounded hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-emerald-400 transition-colors"
                                title="Quick add 1 more"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div ref={cartContainerRef} className="my-3 space-y-2.5 max-h-[300px] overflow-y-auto pr-1 scroll-smooth">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-medium text-slate-400">Register Tape Empty</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Scan items or tap product cards to add to sale
                  </p>
                </div>
              ) : (
                cart.map((cartLine) => {
                  const { item, quantity, isDamaged, damageDiscountPercent, resolvedPrice, priceListName } = cartLine;
                  const basePrice = resolvedPrice !== undefined ? resolvedPrice : item.retailPrice;
                  const vendor = posDb.getVendorById(item.vendorId);
                  const isConsignment = vendor?.supplierType === 'consignment';
                  const effectiveUnitPrice = isDamaged
                    ? basePrice * (1 - damageDiscountPercent / 100)
                    : basePrice;
                  const isRecentlyModified = lastActivity?.itemId === item.id && (Date.now() - lastActivity.timestamp < 3500);

                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        isRecentlyModified
                          ? 'bg-emerald-950/70 border-emerald-500 ring-2 ring-emerald-500/50 shadow-md shadow-emerald-950/50'
                          : 'bg-[#0F1115] border-[#1E293B] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 shrink-0">
                            {item.brand || 'Ocean'}
                          </span>
                          <span className="font-bold text-xs text-[#E2E8F0] truncate">
                            {item.name}
                          </span>
                          {priceListName && (
                            <span className="font-bold text-[9px] text-cyan-300 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/30">
                              {priceListName}
                            </span>
                          )}
                          {isRecentlyModified && (
                            <span className="font-bold text-[9px] text-emerald-300 bg-emerald-500/30 border border-emerald-400/50 px-1.5 py-0.2 rounded-full animate-pulse">
                              ⚡ RECENT
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{primarySymbol} {basePrice.toFixed(2)} ea</span>
                          {settings.allowPaymentInSecondary !== false && (
                            <span className="text-cyan-400">({secondarySymbol}{(basePrice / exchangeRate).toFixed(2)} {secondaryCode})</span>
                          )}
                          <span className="text-slate-600">•</span>
                          <span className="text-cyan-400">{Math.round((item.vatRate ?? 0.15) * 100)}% VAT{settings.vatInclusive ? ' incl.' : ''}</span>
                          {isConsignment && (
                            <span className="text-amber-400 font-semibold">(Deposit)</span>
                          )}
                        </div>

                        {/* Damaged Goods Discount Control */}
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleToggleDamaged(item.id)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                              isDamaged
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
                            }`}
                            title={isDamaged ? 'Remove damaged discount' : 'Mark as damaged to apply a discount'}
                          >
                            {isDamaged ? `⚠ DAMAGED −${damageDiscountPercent}%` : '⚠ Mark Damaged'}
                          </button>
                          {isDamaged && (
                            <>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={damageDiscountPercent}
                                onChange={(e) =>
                                  handleSetDamagePercent(item.id, parseInt(e.target.value, 10) || 0)
                                }
                                className="w-12 bg-[#161B22] border border-amber-500/40 rounded px-1 py-0.5 text-right text-[10px] text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                              />
                              <span className="text-[9px] text-amber-400 font-bold">% OFF</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Qty Controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors touch-manipulation select-none"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono text-xs font-bold w-5 text-center text-[#E2E8F0]">
                          {quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors touch-manipulation select-none"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        <div className="text-right w-16 font-mono text-xs font-bold text-emerald-400">
                          {primarySymbol} {(effectiveUnitPrice * quantity).toFixed(2)}
                          {isDamaged && (
                            <span className="block text-[9px] text-amber-400 line-through opacity-70">
                              {primarySymbol} {(basePrice * quantity).toFixed(2)}
                            </span>
                          )}
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
            {/* Order-Level Discount Control: Percentage or Fixed Amount */}
            {cart.length > 0 && (
              <div className="flex justify-between items-center text-xs pb-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-amber-400" /> Order Discount
                </span>
                <button
                  type="button"
                  onClick={handleOpenDiscount}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  {discountValue > 0 ? (
                    discountType === 'percent' ? `Edit (${discountValue}%)` : `Edit (${primarySymbol}${discountValue.toFixed(2)})`
                  ) : 'Add Discount'}
                </button>
              </div>
            )}

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Net Subtotal</span>
                <span className="font-mono">{primarySymbol} {netSubtotal.toFixed(2)}</span>
              </div>
              {itemDiscountTotal > 0 && (
                <div className="flex justify-between text-amber-500/90">
                  <span>Damaged Item Discounts</span>
                  <span className="font-mono">-{primarySymbol} {itemDiscountTotal.toFixed(2)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>
                    Order Discount{discountType === 'percent' ? ` (${discountValue || 0}%)` : ''}
                  </span>
                  <span className="font-mono">-{primarySymbol} {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-cyan-400 font-semibold">
                <span className="flex items-center gap-1">
                  <Percent className="w-3 h-3" /> VAT ({( (cart[0]?.item.vatRate ?? settings.defaultVatRate ?? 0.15) * 100 ).toFixed(0)}%) {settings.vatInclusive ? '— Included' : 'Tax'}
                </span>
                <span className="font-mono">{settings.vatInclusive ? 'incl. ' : '+'}{primarySymbol} {roundedVat.toFixed(2)}</span>
              </div>
              {(() => {
                const multiEqs = getMultiCurrencyEquivalents(grandTotal, settings);
                return (
                  <div className="pt-1.5 border-t border-[#1E293B] space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-sm text-[#E2E8F0]">Grand Total</span>
                      <span className="font-mono text-emerald-400 font-bold text-lg">
                        {primarySymbol} {grandTotal.toFixed(2)} <span className="text-xs font-bold text-emerald-500">{primaryCode}</span>
                      </span>
                    </div>

                    <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-2 text-[11px] flex flex-wrap items-center justify-center gap-2">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
                        <Globe className="w-3 h-3 text-cyan-400 shrink-0" /> Equivalents:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 font-mono">
                        {multiEqs.filter((c) => !c.isPrimary).map((c) => (
                          <span key={c.code} className="text-[10px] font-bold text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-900/40">
                            {c.symbol} {c.amount.toFixed(2)} {c.code}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
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
          itemMarkdowns={itemDiscountTotal}
          discountType={discountType}
          discountValue={discountValue}
          total={grandTotal}
          attachedCustomer={attachedCustomer}
          registerInfo={{
            registerId: activeRegisterId,
            registerName: (settings.registers || []).find((r) => r.id === activeRegisterId)?.name || 'Main Counter',
            priceListId: activePriceListId,
            priceListName: (settings.priceLists || []).find((p) => p.id === activePriceListId)?.name || 'Standard Retail',
          }}
          currentStaff={currentStaff}
          onClose={() => setIsCheckoutOpen(false)}
          onCompleteTransaction={(tx) => {
            setIsCheckoutOpen(false);
            setCart([]);
            setDiscountValue(0);
            setDiscountType('amount');
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
            if (cust.priceListId) {
              onSwitchPriceList(cust.priceListId);
            }
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
          currentStaff={currentStaff}
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

      {/* Receipt Lookup & Discrepancy Auditor Modal */}
      {isReceiptLookupOpen && (
        <ReceiptLookupModal
          inventory={inventory}
          initialReceiptNumber=""
          onClose={() => setIsReceiptLookupOpen(false)}
          onInitiateRefund={(receiptNum) => {
            setIsReceiptLookupOpen(false);
            setRefundSearchQuery(receiptNum);
            setIsRefundModalOpen(true);
          }}
        />
      )}

      {/* Discount Modal */}
      {isDiscountModalOpen && (
        <DiscountModal
          initialType={discountType}
          initialValue={discountValue}
          primarySymbol={primarySymbol}
          onApply={(type, value) => {
            setDiscountType(type);
            setDiscountValue(value);
            setIsDiscountModalOpen(false);
          }}
          onClose={() => setIsDiscountModalOpen(false)}
        />
      )}

      {/* Manager / Supervisor Security Gate Modal */}
      {managerGateModal.isOpen && (
        <ManagerPinGateModal
          title={managerGateModal.title}
          actionDescription={managerGateModal.description}
          onAuthorized={() => {
            managerGateModal.onSuccess();
          }}
          onClose={() => setManagerGateModal((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
};
