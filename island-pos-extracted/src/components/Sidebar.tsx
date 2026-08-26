import React, { useState, useRef, useCallback } from 'react';
import {
  ShoppingBag,
  Package,
  Users,
  CreditCard,
  FileText,
  BarChart3,
  ShieldCheck,
  Lock,
  Search,
  LogOut,
  X,
  Menu,
  ChevronRight,
  ChevronDown,
  Database,
  AlertTriangle,
  SlidersHorizontal,
  Globe,
  Tag,
  RotateCcw,
  TrendingUp,
  AlertOctagon,
  Banknote,
  Coins,
  Clock
} from 'lucide-react';
import { posDb } from '../services/db';
import { Transaction, InventoryItem } from '../types/pos';

interface SidebarProps {
  activeTab: 'pos' | 'inventory' | 'vendors' | 'payouts' | 'reports' | 'invoices' | 'admin';
  setActiveTab: (tab: 'pos' | 'inventory' | 'vendors' | 'payouts' | 'reports' | 'invoices' | 'admin') => void;
  isAdminLoggedIn: boolean;
  currentStaffName?: string;
  onLogout: () => void;
  onCloseShift: () => void;
  onOpenDrawerCash?: () => void;
  cashierAccess: {
    pos: boolean;
    inventory: boolean;
    reports: boolean;
    settings: boolean;
    staff: boolean;
  };
  lowStockCount: number;
  onOpenLowStockModal: () => void;
  onOpenSqlInspector: () => void;
  onOpenQuickRecovery: () => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  
  // Terminal Configuration props
  activeRegisterId?: string;
  onSwitchRegister?: (id: string) => void;
  activePriceListId?: string;
  onSwitchPriceList?: (id: string) => void;
  viewMode?: 'grid' | 'quick';
  onChangeViewMode?: (mode: 'grid' | 'quick') => void;
  activeCurrencyView?: string;
  onSwitchCurrencyView?: (currency: string) => void;
  onOpenRefund?: () => void;
  transactions?: Transaction[];
  inventoryList?: InventoryItem[];
  vendorsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isAdminLoggedIn,
  currentStaffName,
  onLogout,
  onCloseShift,
  onOpenDrawerCash,
  cashierAccess,
  lowStockCount,
  onOpenLowStockModal,
  onOpenSqlInspector,
  onOpenQuickRecovery,
  isOpenMobile,
  setIsOpenMobile,
  activeRegisterId,
  onSwitchRegister,
  activePriceListId,
  onSwitchPriceList,
  viewMode,
  onChangeViewMode,
  activeCurrencyView,
  onSwitchCurrencyView,
  onOpenRefund,
  transactions = [],
  inventoryList = [],
  vendorsCount = 0,
}) => {
  const settings = posDb.getSettings();
  const [menuSearch, setMenuSearch] = useState('');
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const [isReportsExpanded, setIsReportsExpanded] = useState(false);

  // Resizable desktop sidebar width — persisted so each terminal remembers its own layout.
  const SIDEBAR_MIN_WIDTH = 200;
  const SIDEBAR_MAX_WIDTH = 420;
  const SIDEBAR_DEFAULT_WIDTH = 240;
  const SIDEBAR_WIDTH_STORAGE_KEY = 'pos_sidebar_width';

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = parseInt(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY) || '', 10);
      if (Number.isFinite(saved)) {
        return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, saved));
      }
    } catch {
      // localStorage unavailable (e.g. private mode) — fall back to default
    }
    return SIDEBAR_DEFAULT_WIDTH;
  });
  const isResizingRef = useRef(false);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isResizingRef.current) return;
      const nextWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, startWidth + (moveEvent.clientX - startX))
      );
      setSidebarWidth(nextWidth);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      isResizingRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      const finalWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, startWidth + (upEvent.clientX - startX))
      );
      try {
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(finalWidth));
      } catch {
        // ignore persistence failure — width still applies for this session
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [sidebarWidth]);

  const handleResizeReset = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    try {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(SIDEBAR_DEFAULT_WIDTH));
    } catch {
      // ignore
    }
  }, []);

  // Statistics Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTransactions = (transactions || []).filter(
    (t) => t.timestamp.startsWith(todayStr) && !t.isRefund
  );
  const todaySalesTotal = todayTransactions.reduce((acc, t) => acc + t.total, 0);

  const totalSalesTotal = (transactions || [])
    .filter((t) => !t.isRefund)
    .reduce((acc, t) => acc + t.total, 0);

  const totalItemsCount = (inventoryList || []).length;

  // Custom labels
  const registerLabel = settings.customRegisterLabel || 'Register';
  const inventoryLabel = settings.customInventoryLabel || 'Inventory';
  const vendorsLabel = settings.customVendorsLabel || 'Vendors';
  const payoutsLabel = settings.customPayoutsLabel || 'Payouts';
  const reportsLabel = settings.customReportsLabel || 'Reports';

  const appName = settings.posAppName || settings.storeName || 'GiftShop';
  const appShort = settings.posShortName || 'GS';
  const appVersion = settings.posVersion || 'v2.4.1';

  // Dynamic Theme Styling
  const selectedThemeColor = settings.customThemeColor || 'emerald';

  const themeColors = {
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/10',
    blue: 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/10',
    indigo: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/10',
    violet: 'bg-violet-600 text-white hover:bg-violet-500 shadow-violet-900/10',
    amber: 'bg-amber-500 text-[#0F1115] hover:bg-amber-400 shadow-amber-900/10',
    rose: 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-900/10',
    slate: 'bg-slate-600 text-white hover:bg-slate-500 shadow-slate-900/10',
  };

  const activeBgClass = themeColors[selectedThemeColor] || themeColors.emerald;

  const dotColors = {
    emerald: 'bg-emerald-400',
    blue: 'bg-blue-400',
    indigo: 'bg-indigo-400',
    violet: 'bg-violet-400',
    amber: 'bg-amber-400',
    rose: 'bg-rose-400',
    slate: 'bg-slate-300',
  };
  const activeDotClass = dotColors[selectedThemeColor] || 'bg-emerald-400';

  // Define sidebar menu configuration
  const menuItems = [
    {
      id: 'pos' as const,
      label: registerLabel,
      icon: ShoppingBag,
      allowed: cashierAccess.pos,
      description: 'POS Checkout Terminal',
      badge: null
    },
    {
      id: 'inventory' as const,
      label: inventoryLabel,
      icon: Package,
      allowed: isAdminLoggedIn || cashierAccess.inventory,
      description: 'Stock Catalog Control',
      badge: lowStockCount > 0 ? {
        text: String(lowStockCount),
        type: 'error' as const,
        action: onOpenLowStockModal
      } : null
    },
    {
      id: 'vendors' as const,
      label: vendorsLabel,
      icon: Users,
      allowed: isAdminLoggedIn,
      description: 'Vendors & Suppliers',
      badge: null
    },
    {
      id: 'payouts' as const,
      label: payoutsLabel,
      icon: CreditCard,
      allowed: isAdminLoggedIn,
      description: 'Consignor Payout Settlements',
      badge: null
    },
    {
      id: 'invoices' as const,
      label: 'Invoices',
      icon: FileText,
      allowed: isAdminLoggedIn,
      description: 'Invoice & Order Bills',
      badge: null
    },
    {
      id: 'reports' as const,
      label: reportsLabel,
      icon: BarChart3,
      allowed: isAdminLoggedIn || cashierAccess.reports,
      description: 'Financial Analytics & EOD',
      badge: null
    },
    {
      id: 'admin' as const,
      label: 'Admin Panel',
      icon: isAdminLoggedIn ? ShieldCheck : Lock,
      allowed: isAdminLoggedIn,
      description: 'Whitelabeling & Hardware Settings',
      badge: null
    }
  ];

  // Filter items based on the "Menu Search" feature (similar to RetailersPOS!)
  const filteredMenuItems = menuItems.filter(item => {
    if (!item.allowed) return false;
    if (!menuSearch) return true;
    return (
      item.label.toLowerCase().includes(menuSearch.toLowerCase()) ||
      item.description.toLowerCase().includes(menuSearch.toLowerCase())
    );
  });

  const handleSelectTab = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
    setIsOpenMobile(false);
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-[#11141A] text-slate-300 border-r border-[#1E293B]">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#1E293B]/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {settings.brandLogoUrl ? (
            <img src={settings.brandLogoUrl} alt="Store Logo" className="w-8 h-8 object-contain rounded-lg" />
          ) : (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shadow-md ${activeBgClass}`}>
              {appShort}
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-extrabold text-sm text-white tracking-wide uppercase leading-tight truncate max-w-[140px]">
              {appName}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold font-mono">
              Retail POS {appVersion}
            </span>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={() => setIsOpenMobile(false)}
          className="lg:hidden p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Menu Search Bar (matches RetailersPOS design exactly) */}
      <div className="px-4 py-3 border-b border-[#1E293B]/40">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search menus..."
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#0F1115] border border-[#1E293B] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin">
        {filteredMenuItems.length > 0 ? (
          filteredMenuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;

            return (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 select-none touch-manipulation group ${
                    isActive
                      ? `${activeBgClass} shadow-lg shadow-emerald-950/20 text-white font-extrabold`
                      : 'hover:bg-slate-800/40 hover:text-white text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <IconComponent className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`} />
                    <span className="truncate text-[12px] tracking-wide">{item.label}</span>
                  </div>

                  {/* Badge & Active Indicators */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.badge?.action) item.badge.action();
                        }}
                        className={`text-[9px] font-black font-mono px-2 py-0.5 rounded-full shadow-sm animate-pulse cursor-pointer ${
                          item.badge.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-slate-950'
                        }`}
                      >
                        {item.badge.text}
                      </span>
                    ) : isActive ? (
                      <span className={`w-1.5 h-1.5 rounded-full ${activeDotClass} shadow-md shadow-emerald-400/50`}></span>
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-500 group-hover:translate-x-0.5 transition-all" />
                    )}
                  </div>
                </button>
              </div>
            );
          })
        ) : (
          <div className="p-4 text-center text-xs text-slate-600">
            No active menu fits search
          </div>
        )}
      </div>

      {/* Cash Drawer Movements — available to all staff (banked cash / drops / paid-in) */}
      {onOpenDrawerCash && (
        <div className="px-3 pb-2">
          <button
            onClick={onOpenDrawerCash}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-cyan-300 hover:bg-cyan-950/20 border border-[#1E293B]/60 hover:border-cyan-500/30 transition-all"
            title="Record cash banked, drops & paid-in movements"
          >
            <Banknote className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="flex-1 text-left">Cash Drawer</span>
            <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Banked / Drops</span>
          </button>
        </div>
      )}

      {/* Collapsible Config & Reports Sidebar Modules */}
      <div className="border-t border-[#1E293B]/40 divide-y divide-[#1E293B]/30 bg-[#0F1115]/40">
        {/* Module 1: Terminal Setup Configuration */}
        <div className="px-4 py-2.5">
          <button
            onClick={() => setIsConfigExpanded(!isConfigExpanded)}
            className="w-full flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>⚙️ Terminal Setup</span>
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isConfigExpanded ? 'rotate-180' : ''}`} />
          </button>
          
          {isConfigExpanded && (
            <div className="mt-2.5 space-y-2.5 animate-in fade-in duration-200">
              {/* Register selector */}
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Station:</label>
                <select
                  value={activeRegisterId}
                  onChange={(e) => onSwitchRegister && onSwitchRegister(e.target.value)}
                  className="w-full bg-[#0B0D12] border border-[#1E293B] rounded-lg px-2 py-1 text-xs font-bold text-emerald-400 focus:outline-none"
                >
                  {(settings.registers || [
                    { id: 'REG-1', name: 'Main Retail Counter #1', location: 'Front Store', defaultPriceListId: 'retail', mode: 'retail' },
                    { id: 'REG-2', name: 'Wholesale & Trade Desk #2', location: 'Warehouse / B2B', defaultPriceListId: 'wholesale', mode: 'wholesale' }
                  ]).map((reg) => (
                    <option key={reg.id} value={reg.id} className="bg-[#161B22] text-white">
                      {reg.name} {reg.location ? `(${reg.location})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price list / Tier selector */}
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Price Tier:</label>
                <select
                  value={activePriceListId}
                  onChange={(e) => onSwitchPriceList && onSwitchPriceList(e.target.value)}
                  className="w-full bg-[#0B0D12] border border-[#1E293B] rounded-lg px-2 py-1 text-xs font-bold text-cyan-400 focus:outline-none"
                >
                  {(settings.priceLists || [
                    { id: 'retail', name: 'Standard Retail', discountPercentage: 0 },
                    { id: 'wholesale', name: 'Wholesale B2B', discountPercentage: 25 },
                    { id: 'vip', name: 'VIP & Staff', discountPercentage: 15 },
                  ]).map((pl) => (
                    <option key={pl.id} value={pl.id} className="bg-[#161B22] text-white">
                      {pl.name} {pl.discountPercentage ? `(-${pl.discountPercentage}%)` : '(Standard)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">View Mode:</label>
                <div className="grid grid-cols-2 bg-[#0B0D12] border border-[#1E293B] rounded-lg p-0.5 gap-0.5">
                  <button
                    onClick={() => onChangeViewMode && onChangeViewMode('grid')}
                    className={`py-1 rounded-md text-[10px] font-bold transition-all ${
                      viewMode === 'grid' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Grid View
                  </button>
                  <button
                    onClick={() => onChangeViewMode && onChangeViewMode('quick')}
                    className={`py-1 rounded-md text-[10px] font-bold transition-all ${
                      viewMode === 'quick' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Scan View
                  </button>
                </div>
              </div>

              {/* Multi-Currency Price View Selector */}
              {settings.allowPaymentInSecondary !== false && (
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Active Currency:</label>
                  <div className="flex flex-wrap bg-[#0B0D12] border border-[#1E293B] rounded-lg p-0.5 gap-0.5">
                    <button
                      onClick={() => onSwitchCurrencyView && onSwitchCurrencyView(settings.primaryCurrency || 'USD')}
                      className={`flex-1 py-1 rounded-md text-[10px] font-bold font-mono transition-all ${
                        activeCurrencyView === (settings.primaryCurrency || 'USD') ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {settings.primaryCurrency || 'USD'}
                    </button>
                    <button
                      onClick={() => onSwitchCurrencyView && onSwitchCurrencyView(settings.secondaryCurrency || 'USD')}
                      className={`flex-1 py-1 rounded-md text-[10px] font-bold font-mono transition-all ${
                        activeCurrencyView === (settings.secondaryCurrency || 'USD') ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {settings.secondaryCurrency || 'USD'}
                    </button>
                  </div>
                </div>
              )}

              {/* Refund Button */}
              <button
                onClick={onOpenRefund}
                className="w-full bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-300 py-1.5 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 mt-1"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Process Refund</span>
              </button>
            </div>
          )}
        </div>

        {/* Module 2: High-Level Sales & Live Reports Pinned Sidebar Widget */}
        <div className="px-4 py-2.5">
          <button
            onClick={() => setIsReportsExpanded(!isReportsExpanded)}
            className="w-full flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>📊 Live Sales & Reports</span>
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isReportsExpanded ? 'rotate-180' : ''}`} />
          </button>
          
          {isReportsExpanded && (
            <div className="mt-2.5 space-y-2 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 gap-1.5">
                {/* Metric 1: Today Sales */}
                <div className="bg-[#161B22]/60 border border-[#1E293B]/40 p-2 rounded-lg flex flex-col justify-between">
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Today Sales</span>
                  <span className="text-xs font-black font-mono text-emerald-400 mt-0.5">
                    {settings.primaryCurrencySymbol || '$'} {todaySalesTotal.toFixed(2)}
                  </span>
                  <span className="text-[7px] text-slate-500 font-medium truncate mt-0.5">
                    {todayTransactions.length} ticket{todayTransactions.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Metric 2: Total Volume */}
                <div className="bg-[#161B22]/60 border border-[#1E293B]/40 p-2 rounded-lg flex flex-col justify-between">
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Total Volume</span>
                  <span className="text-xs font-black font-mono text-cyan-400 mt-0.5">
                    {settings.primaryCurrencySymbol || '$'} {totalSalesTotal.toFixed(2)}
                  </span>
                  <span className="text-[7px] text-slate-500 font-medium truncate mt-0.5">
                    Gross Volume
                  </span>
                </div>

                {/* Metric 3: Active Products */}
                <div className="bg-[#161B22]/60 border border-[#1E293B]/40 p-2 rounded-lg flex flex-col justify-between">
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Total Products</span>
                  <span className="text-xs font-black font-mono text-blue-400 mt-0.5">
                    {totalItemsCount} Active
                  </span>
                  <span className="text-[7px] text-slate-500 font-medium truncate mt-0.5">
                    {vendorsCount} Vendors
                  </span>
                </div>

                {/* Metric 4: Low Stock Warnings */}
                <div
                  onClick={lowStockCount > 0 ? onOpenLowStockModal : undefined}
                  className={`p-2 rounded-lg flex flex-col justify-between border transition-all ${
                    lowStockCount > 0
                      ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40 cursor-pointer select-none'
                      : 'bg-[#161B22]/60 border-[#1E293B]/40'
                  }`}
                >
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Low Stock</span>
                  <span className={`text-xs font-black font-mono mt-0.5 ${lowStockCount > 0 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`}>
                    {lowStockCount} Alert{lowStockCount === 1 ? '' : 's'}
                  </span>
                  <span className="text-[7px] text-slate-500 font-medium truncate mt-0.5">
                    {lowStockCount > 0 ? 'View & restock' : 'Stock healthy'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Footer - User info / utilities / logout */}
      <div className="p-4 bg-[#0B0D12] border-t border-[#1E293B]/60 space-y-3">
        {/* Quick Database / Hardware status links — admin-only, sensitive recovery tooling */}
        {isAdminLoggedIn && (
          <button
            onClick={onOpenQuickRecovery}
            className="w-full py-2 px-3 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm mb-2"
            title="Quick Currency Setup & Data Recovery"
          >
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
            <span>Currency & Recovery</span>
          </button>
        )}

        <div className={isAdminLoggedIn ? "grid grid-cols-2 gap-1.5" : "block"}>
          {isAdminLoggedIn && (
            <button
              onClick={onOpenSqlInspector}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-[#1E293B] text-[10px] font-mono text-slate-400 hover:text-emerald-400 transition-colors flex items-center justify-center gap-1 w-full"
              title="Inspect Database Schema"
            >
              <Database className="w-3 h-3 text-emerald-500" />
              <span>SQLite</span>
            </button>
          )}
        </div>

        {/* User Account Bar */}
        {currentStaffName && (
          <div className="rounded-xl bg-[#11141A] border border-[#1E293B]/40 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-2.5 pt-2.5 pb-2">
              <div className="min-w-0 flex flex-col">
                <span className="text-[11px] font-bold text-white truncate">{currentStaffName}</span>
                <span className="text-[9px] text-slate-500 tracking-wider uppercase font-semibold">
                  {isAdminLoggedIn ? 'Admin Access' : 'Cashier'}
                </span>
              </div>
            </div>
            {/* Distinct, clearly-labeled actions — never guess which icon does what */}
            <div className="grid grid-cols-2 gap-1.5 px-2 pb-2">
              <button
                onClick={onCloseShift}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold transition-all active:scale-95"
                title="End of Day — count the drawer and close the shop"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Close Shop</span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-300 text-[11px] font-bold transition-all active:scale-95"
                title="Sign out of this account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (LG screen size and up) — width is user-resizable via the drag handle */}
      <aside
        className="hidden lg:block relative h-screen sticky top-0 shrink-0"
        style={{ width: sidebarWidth }}
      >
        <div className="h-full overflow-y-auto">{sidebarContent}</div>

        {/* Resize handle — drag to adjust, double-click to reset to default width */}
        <div
          onPointerDown={handleResizeStart}
          onDoubleClick={handleResizeReset}
          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize group z-10 touch-none"
          title="Drag to resize sidebar · double-click to reset"
        >
          <div className="h-full w-px mx-auto bg-[#1E293B] group-hover:bg-emerald-500/60 group-active:bg-emerald-400 transition-colors" />
        </div>
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setIsOpenMobile(false)}
            className="fixed inset-0 bg-black/60 transition-opacity duration-300"
          />
          {/* Drawer Body */}
          <div className="relative w-[240px] max-w-xs h-full flex flex-col animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
