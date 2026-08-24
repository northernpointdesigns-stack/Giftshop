import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  AlertTriangle,
  Database,
  ShieldCheck,
  Lock,
  ChevronDown,
  Menu,
} from 'lucide-react';
import { posDb } from '../services/db';

interface NavbarProps {
  activeTab: 'pos' | 'inventory' | 'vendors' | 'payouts' | 'reports' | 'invoices' | 'admin';
  setActiveTab: (tab: 'pos' | 'inventory' | 'vendors' | 'payouts' | 'reports' | 'invoices' | 'admin') => void;
  lowStockCount: number;
  onOpenLowStockModal: () => void;
  onOpenCustomerDisplay: () => void;
  onOpenSqlInspector: () => void;
  isAdminLoggedIn?: boolean;
  currentStaffName?: string;
  onLogout: () => void;
  cashierAccess?: {
    pos: boolean;
    inventory: boolean;
    reports: boolean;
    settings: boolean;
    staff: boolean;
  };
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  lowStockCount,
  onOpenLowStockModal,
  onOpenCustomerDisplay,
  onOpenSqlInspector,
  isAdminLoggedIn = false,
  currentStaffName,
  onLogout,
  cashierAccess = { pos: true, inventory: true, reports: true, settings: false, staff: false },
}) => {
  const settings = posDb.getSettings();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Custom label fallback configuration
  const registerLabel = settings.customRegisterLabel || 'Register';
  const inventoryLabel = settings.customInventoryLabel || 'Inventory';
  const vendorsLabel = settings.customVendorsLabel || 'Vendors';
  const payoutsLabel = settings.customPayoutsLabel || 'Payouts';
  const reportsLabel = settings.customReportsLabel || 'Reports';

  // Dynamic branding parameters (Option to remove/replace Island POS completely)
  const isBrandingRemoved = settings.removeIslandBranding;
  const appName = isBrandingRemoved 
    ? (settings.posAppName || settings.storeName || 'My Boutique POS')
    : (settings.posAppName || 'IslandPOS');
  const appShort = settings.posShortName || (isBrandingRemoved ? 'POS' : 'IP');
  const appVersion = settings.posVersion || 'v2.4.1';

  // Dynamic color palette setup
  const themeColors = {
    emerald: 'bg-emerald-500 text-[#0F1115] focus-visible:ring-emerald-500',
    blue: 'bg-blue-500 text-white focus-visible:ring-blue-500',
    indigo: 'bg-indigo-500 text-white focus-visible:ring-indigo-500',
    violet: 'bg-violet-500 text-white focus-visible:ring-violet-500',
    amber: 'bg-amber-500 text-[#0F1115] focus-visible:ring-amber-500',
    rose: 'bg-rose-500 text-white focus-visible:ring-rose-500',
    slate: 'bg-slate-500 text-white focus-visible:ring-slate-500',
  };

  const selectedThemeColor = settings.customThemeColor || 'emerald';
  const logoBadgeClass = themeColors[selectedThemeColor] || themeColors.emerald;

  // Active label highlight color mapping
  const textHighlightColors = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    indigo: 'text-indigo-400',
    violet: 'text-violet-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    slate: 'text-slate-300',
  };
  const activeTextClass = textHighlightColors[selectedThemeColor] || 'text-emerald-400';

  const adminButtonClasses = {
    emerald: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500/30 text-white',
    blue: 'bg-blue-600 hover:bg-blue-500 border-blue-500/30 text-white',
    indigo: 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500/30 text-white',
    violet: 'bg-violet-600 hover:bg-violet-500 border-violet-500/30 text-white',
    amber: 'bg-amber-600 hover:bg-amber-500 border-amber-500/30 text-[#0F1115]',
    rose: 'bg-rose-600 hover:bg-rose-500 border-rose-500/30 text-white',
    slate: 'bg-slate-600 hover:bg-slate-500 border-slate-500/30 text-white',
  };
  const activeAdminClass = adminButtonClasses[selectedThemeColor] || adminButtonClasses.emerald;

  const defaultAdminClass = {
    emerald: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30',
    blue: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/30',
    indigo: 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/30',
    violet: 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border-violet-500/30',
    amber: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/30',
    rose: 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/30',
    slate: 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 border-slate-500/30',
  };
  const inactiveAdminClass = defaultAdminClass[selectedThemeColor] || defaultAdminClass.emerald;

  // Handle click outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectTab = (tab: 'pos' | 'inventory' | 'vendors' | 'payouts' | 'reports' | 'invoices' | 'admin') => {
    const allowed = isAdminLoggedIn || (
      tab === 'pos' ? cashierAccess.pos :
      tab === 'inventory' ? cashierAccess.inventory :
      tab === 'reports' ? cashierAccess.reports :
      tab === 'admin' ? cashierAccess.settings || cashierAccess.staff :
      true
    );
    if (!allowed) return;
    setActiveTab(tab);
    setIsMoreOpen(false);
  };

  const moreTabsActive = ['payouts', 'reports', 'invoices', 'admin'].includes(activeTab);

  return (
    <header className="sticky top-0 z-40 bg-[#161B22] border-b border-[#1E293B] text-[#E2E8F0] px-4 py-3 shadow-md shrink-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Brand Title - Single text element */}
        <div className="flex items-center shrink-0 min-w-0">
          <span className="font-bold text-base sm:text-lg md:text-xl tracking-tight text-[#E2E8F0] font-sans flex items-center gap-2 truncate">
            {settings.brandLogoUrl ? (
              <img src={settings.brandLogoUrl} alt="Logo" className="w-7 h-7 object-contain rounded" />
            ) : (
              <span className={`w-7 h-7 rounded flex items-center justify-center font-black text-xs shrink-0 ${logoBadgeClass}`}>
                {appShort}
              </span>
            )}
            <span className="truncate">{appName}</span>
            <span className="text-slate-500 text-[10px] sm:text-xs font-normal font-mono hidden md:inline">{appVersion}</span>
          </span>
        </div>

        {/* Zone 2: Navigation Links - Single line, responsive to fit narrow layouts cleanly */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {/* Always visible on all screens */}
          {cashierAccess.pos && <button
            onClick={() => selectTab('pos')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'pos'
                ? `bg-slate-800/80 ${activeTextClass} border border-slate-700/60`
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {registerLabel}
          </button>}

          {(isAdminLoggedIn || cashierAccess.inventory) && <button
            onClick={() => selectTab('inventory')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'inventory'
                ? `bg-slate-800/80 ${activeTextClass} border border-slate-700/60`
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {inventoryLabel}
          </button>}

          {isAdminLoggedIn && <button
            onClick={() => selectTab('vendors')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'vendors'
                ? `bg-slate-800/80 ${activeTextClass} border border-slate-700/60`
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {vendorsLabel}
          </button>}

          {/* Large Screen Only: Payouts & Reports */}
          {isAdminLoggedIn && <button
            onClick={() => selectTab('payouts')}
            className={`hidden lg:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'payouts'
                ? `bg-slate-800/80 ${activeTextClass} border border-slate-700/60`
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {payoutsLabel}
          </button>}

          {/* Large Screen Only: Invoices (admin only) */}
          {isAdminLoggedIn && <button
            onClick={() => selectTab('invoices')}
            className={`hidden lg:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'invoices'
                ? `bg-slate-800/80 ${activeTextClass} border border-slate-700/60`
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Invoices
          </button>}

          {(isAdminLoggedIn || cashierAccess.reports) && <button
            onClick={() => selectTab('reports')}
            className={`hidden lg:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'reports'
                ? `bg-slate-800/80 ${activeTextClass} border border-slate-700/60`
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {reportsLabel}
          </button>}

          {/* Large Screen Only: Admin Button */}
          {isAdminLoggedIn && <button
            onClick={() => selectTab('admin')}
            className={`hidden lg:inline-flex px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 items-center gap-1.5 ${
              activeTab === 'admin'
                ? `${activeAdminClass} shadow-md`
                : inactiveAdminClass
            }`}
          >
            {isAdminLoggedIn ? <ShieldCheck className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>Admin</span>
          </button>}

          {/* Responsive Dropdown: visible below lg */}
          <div className="relative lg:hidden" ref={dropdownRef}>
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                moreTabsActive
                  ? `bg-slate-800/80 ${activeTextClass} border border-slate-700/60`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Menu className="w-3.5 h-3.5" />
              <span>More</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isMoreOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMoreOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#161B22] border border-[#1E293B] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1">
                {isAdminLoggedIn && <button
                  onClick={() => selectTab('payouts')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === 'payouts'
                      ? `bg-slate-800/80 ${activeTextClass} font-bold`
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  {payoutsLabel}
                </button>}
                {isAdminLoggedIn && <button
                  onClick={() => selectTab('invoices')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === 'invoices'
                      ? `bg-slate-800/80 ${activeTextClass} font-bold`
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  Invoices
                </button>}
                {(isAdminLoggedIn || cashierAccess.reports) && <button
                  onClick={() => selectTab('reports')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === 'reports'
                      ? `bg-slate-800/80 ${activeTextClass} font-bold`
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  {reportsLabel}
                </button>}
                <div className="h-px bg-[#1E293B] my-1" />
                <button
                  onClick={() => selectTab('admin')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'admin'
                      ? `${activeAdminClass} font-bold`
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  {isAdminLoggedIn ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                  <span>Admin Panel</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {lowStockCount > 0 && (
            <button
              onClick={onOpenLowStockModal}
              className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2 sm:px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all whitespace-nowrap"
              title="View Low Stock Inventory Alerts"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              <span className="hidden sm:inline">{lowStockCount} Alert{lowStockCount > 1 ? 's' : ''}</span>
              <span className="sm:hidden">{lowStockCount}</span>
            </button>
          )}

          <button
            onClick={onOpenSqlInspector}
            className="hidden xl:flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors whitespace-nowrap hover:bg-emerald-500/20"
            title="Inspect Database Schema & Seeds"
          >
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>SQLITE</span>
          </button>

          <button
            onClick={onOpenCustomerDisplay}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-xs whitespace-nowrap"
            title="Open Secondary Customer-Facing Display"
          >
            <Monitor className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Dual Display</span>
          </button>
          {currentStaffName && (
            <button
              onClick={onLogout}
              className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 px-2 py-1.5 rounded-lg transition-colors"
              title="Sign out this staff member"
            >
              <span className="max-w-24 truncate">{currentStaffName}</span>
              <span className="text-slate-600">·</span>
              <span>Sign out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
