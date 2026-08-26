import React from 'react';
import {
  Menu,
  AlertTriangle,
  Monitor,
} from 'lucide-react';
import { posDb } from '../services/db';
import { OfflineStatusPill } from './offline/OfflineStatusPill';

interface TopHeaderProps {
  activeTab: 'pos' | 'inventory' | 'vendors' | 'payouts' | 'reports' | 'invoices' | 'admin';
  lowStockCount: number;
  onOpenLowStockModal: () => void;
  onOpenCustomerDisplay: () => void;
  onRefreshData?: () => void;
  isAdminLoggedIn: boolean;
  currentStaffName?: string;
  onOpenSidebarMobile: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  lowStockCount,
  onOpenLowStockModal,
  onOpenCustomerDisplay,
  onRefreshData,
  isAdminLoggedIn,
  currentStaffName,
  onOpenSidebarMobile,
}) => {
  const settings = posDb.getSettings();

  // Mapping from tab to beautiful human-readable title
  const registerLabel = settings.customRegisterLabel || 'Register';
  const inventoryLabel = settings.customInventoryLabel || 'Inventory';
  const vendorsLabel = settings.customVendorsLabel || 'Vendors';
  const payoutsLabel = settings.customPayoutsLabel || 'Payouts';
  const reportsLabel = settings.customReportsLabel || 'Reports';

  const tabTitles = {
    pos: `${registerLabel} Station`,
    inventory: `${inventoryLabel} Catalog`,
    vendors: `${vendorsLabel} Profiles`,
    payouts: `${payoutsLabel} Settlement`,
    invoices: 'Invoice & Orders Control',
    reports: `${reportsLabel} Dashboard`,
    admin: 'System Settings & Whitelabeling'
  };

  const activeTitle = tabTitles[activeTab] || 'POS Station';

  return (
    <header className="sticky top-0 z-30 bg-[#161B22] border-b border-[#1E293B] px-4 py-3 text-white flex items-center justify-between shadow-md">
      {/* Left side: Mobile Hamburger & View title */}
      <div className="flex items-center gap-3">
        {/* Hamburger Menu - visible on mobile/tablet */}
        <button
          onClick={onOpenSidebarMobile}
          className="lg:hidden p-1.5 rounded-xl bg-slate-900 border border-[#1E293B] text-slate-300 hover:text-white transition-colors active:scale-95"
          title="Open Navigation Drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Dynamic Title */}
        <div className="flex flex-col min-w-0">
          <h2 className="text-sm sm:text-base font-black tracking-wide text-white uppercase leading-tight truncate">
            {activeTitle}
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
              Terminal {settings.activeRegisterId || 'REG-01'} · Live Connected
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Actions, Offline, Alerts — minimal so staff focus on the register */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Offline Pill */}
        <OfflineStatusPill onRefreshData={onRefreshData} />

        {/* Always visible beside connection status; this replaces the tiny
            sidebar-only control so mouse users can reliably find it. */}
        <button
          onClick={onOpenCustomerDisplay}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
          title="Open the customer-facing secondary display"
        >
          <Monitor className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Dual Display</span>
          <span className="sm:hidden">Display</span>
        </button>

        {/* Low Stock Alerts */}
        {lowStockCount > 0 && (
          <button
            onClick={onOpenLowStockModal}
            className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all active:scale-95"
            title="Low Stock Alerts"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span className="hidden sm:inline">{lowStockCount} Stock Alerts</span>
            <span className="sm:hidden">{lowStockCount}</span>
          </button>
        )}

      </div>
    </header>
  );
};
