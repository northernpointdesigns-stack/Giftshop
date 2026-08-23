import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Package,
  Users2,
  Receipt,
  Tv,
  FileCheck2,
  Settings,
  Bell,
  SunMedium,
  CircleDollarSign,
  Lock,
  Layers,
  ChevronRight,
  Download,
  Laptop,
  WifiOff,
} from 'lucide-react';
import { posDb } from '../services/db';
import { InventoryItem } from '../types/pos';
import { installService, InstallState } from '../services/installService';

export type NavTab =
  | 'pos'
  | 'inventory'
  | 'vendors'
  | 'reports'
  | 'financials'
  | 'consignment_reports'
  | 'forecast'
  | 'customer_display'
  | 'digital_receipts'
  | 'admin';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  inventory: InventoryItem[];
  onOpenLowStock: () => void;
  onOpenDesktopInstall: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  inventory,
  onOpenLowStock,
  onOpenDesktopInstall,
}) => {
  const settings = posDb.getSettings();
  const activeSession = posDb.getActiveEODSession();
  const [installState, setInstallState] = useState<InstallState>(installService.getState());

  useEffect(() => {
    const unsub = installService.subscribe((state) => {
      setInstallState(state);
    });
    return () => unsub();
  }, []);

  const lowStockCount = inventory.filter(
    (item) => item.stockLevel <= item.reorderPoint
  ).length;

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'pos', label: 'Cashier POS', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory Catalog', icon: <Package className="w-4 h-4" /> },
    { id: 'vendors', label: 'Consignment Vendors', icon: <Users2 className="w-4 h-4" /> },
    { id: 'reports', label: 'EOD & Cash Drawer', icon: <Receipt className="w-4 h-4" /> },
    { id: 'financials', label: 'P&L Reports', icon: <FileCheck2 className="w-4 h-4" /> },
    { id: 'customer_display', label: 'Customer Screen', icon: <Tv className="w-4 h-4" /> },
    { id: 'admin', label: 'Store Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-[#0F1115] border-b border-[#1E293B] sticky top-0 z-40 px-3 sm:px-6 py-2.5 select-none no-print">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-950/40 font-black text-base tracking-tighter">
            SC
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-extrabold text-white tracking-tight leading-none">
              {settings.storeName || 'Seychelles Ocean Retail'}
            </h1>
            <span className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase mt-0.5 block">
              Victoria Mahé • SCR & USD Multi-Tender
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action / Status Zone */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Offline Warning if disconnected */}
          {!installState.isOnline && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-600/50 text-amber-300 text-[11px] font-bold">
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden sm:inline">Offline Mode</span>
            </div>
          )}

          {/* Desktop Install App Button */}
          <button
            onClick={onOpenDesktopInstall}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer ${
              installState.isInstalled
                ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400/40 shadow-emerald-950/50'
            }`}
            title="Install Ocean POS on Mac or Windows Desktop"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {installState.isInstalled ? 'Desktop Mode' : 'Install App'}
            </span>
          </button>

          {/* Active Shift Indicator */}
          {activeSession ? (
            <button
              onClick={() => setActiveTab('reports')}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-[11px] font-mono font-bold"
              title="Click to manage shift reconciliation"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>SHIFT #{activeSession.id.slice(-6)}</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('reports')}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-600/40 text-rose-300 text-[11px] font-mono font-bold"
            >
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>DRAWER CLOSED</span>
            </button>
          )}

          {/* Low Stock Alert Button */}
          {lowStockCount > 0 && (
            <button
              onClick={onOpenLowStock}
              className="relative p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors"
              title={`${lowStockCount} items at or below reorder threshold`}
            >
              <Bell className="w-4 h-4 animate-bounce" />
              <span className="hidden sm:inline font-mono">{lowStockCount}</span>
            </button>
          )}

          {/* Currency Pill */}
          <div className="hidden md:flex items-center gap-1 bg-[#161B22] border border-[#1E293B] px-2.5 py-1 rounded-xl text-[11px] font-mono text-slate-300">
            <span className="text-emerald-400 font-bold">1 USD</span>
            <span className="text-slate-500">=</span>
            <span className="text-white font-bold">{settings.exchangeRate.toFixed(2)} SCR</span>
          </div>
        </div>
      </div>
    </header>
  );
};
