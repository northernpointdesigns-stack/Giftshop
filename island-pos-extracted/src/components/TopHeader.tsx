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

        {/* Compact quick header menu for mobile view details.
            Close Shop / Log Out live ONLY in the Sidebar's labeled pill buttons
            (reachable here via the hamburger above) — no duplicate icon-only
            triggers in the header, so there's exactly one obvious place for them. */}
        <div className="lg:hidden flex items-center gap-1.5">
          <button
            onClick={onOpenCustomerDisplay}
            className="p-1.5 rounded-xl bg-slate-900 border border-[#1E293B] text-slate-400 hover:text-emerald-400 transition-colors"
            title="Secondary Display Screen"
          >
            <Monitor className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
