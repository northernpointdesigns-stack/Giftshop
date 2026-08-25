import React from 'react';
import {
  TrendingUp,
  Package,
  Users,
  AlertOctagon,
  ShoppingBag,
  Coins,
  ShieldCheck
} from 'lucide-react';
import { Transaction, InventoryItem, Vendor } from '../types/pos';
import { posDb } from '../services/db';

interface MetricOverviewProps {
  transactions: Transaction[];
  inventory: InventoryItem[];
  vendors: Vendor[];
  onOpenLowStockModal: () => void;
  activeTab: string;
}

export const MetricOverview: React.FC<MetricOverviewProps> = ({
  transactions,
  inventory,
  vendors,
  onOpenLowStockModal,
  activeTab
}) => {
  const settings = posDb.getSettings();
  const currencySymbol = settings.primaryCurrencySymbol || 'SR';

  // 1. Calculate Today's Sales
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTransactions = transactions.filter(
    (t) => t.timestamp.startsWith(todayStr) && !t.isRefund
  );
  const todaySalesTotal = todayTransactions.reduce((acc, t) => acc + t.total, 0);

  // 2. Calculate Total Sales
  const totalSalesTotal = transactions
    .filter((t) => !t.isRefund)
    .reduce((acc, t) => acc + t.total, 0);

  // 3. Count Low Stock Alerts
  const lowStockCount = inventory.filter((i) => i.stockLevel <= i.minStockThreshold).length;

  // 4. Count Active Products
  const totalItemsCount = inventory.length;

  // Render metrics specifically on relevant tabs to look clean and purposeful
  if (!['pos', 'reports', 'inventory'].includes(activeTab)) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {/* Metric 1: Today Sales */}
      <div className="bg-[#161B22] border border-[#1E293B] hover:border-slate-700/80 p-3 sm:p-4 rounded-xl shadow-xs transition-all duration-200">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">
              Today Sales
            </span>
            <h3 className="text-sm sm:text-base md:text-lg font-black font-mono text-emerald-400">
              {currencySymbol} {todaySalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
            <TrendingUp className="w-4 h-4 sm:w-5 h-5" />
          </div>
        </div>
        <p className="text-[9px] text-slate-500 mt-2 font-medium leading-tight">
          {todayTransactions.length} completed tickets today
        </p>
      </div>

      {/* Metric 2: Total Sales */}
      <div className="bg-[#161B22] border border-[#1E293B] hover:border-slate-700/80 p-3 sm:p-4 rounded-xl shadow-xs transition-all duration-200">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">
              Total Volume
            </span>
            <h3 className="text-sm sm:text-base md:text-lg font-black font-mono text-cyan-400">
              {currencySymbol} {totalSalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="p-2.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl">
            <Coins className="w-4 h-4 sm:w-5 h-5" />
          </div>
        </div>
        <p className="text-[9px] text-slate-500 mt-2 font-medium leading-tight">
          Lifetime gross billing records
        </p>
      </div>

      {/* Metric 3: Total Products */}
      <div className="bg-[#161B22] border border-[#1E293B] hover:border-slate-700/80 p-3 sm:p-4 rounded-xl shadow-xs transition-all duration-200">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">
              Total Products
            </span>
            <h3 className="text-sm sm:text-base md:text-lg font-black font-mono text-blue-400">
              {totalItemsCount} Active
            </h3>
          </div>
          <div className="p-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
            <Package className="w-4 h-4 sm:w-5 h-5" />
          </div>
        </div>
        <p className="text-[9px] text-slate-500 mt-2 font-medium leading-tight">
          Spread across {vendors.length} vendors
        </p>
      </div>

      {/* Metric 4: Low Stock Warnings */}
      <div
        onClick={lowStockCount > 0 ? onOpenLowStockModal : undefined}
        className={`bg-[#161B22] border p-3 sm:p-4 rounded-xl shadow-xs transition-all duration-200 select-none ${
          lowStockCount > 0
            ? 'border-red-500/30 hover:border-red-500/50 cursor-pointer'
            : 'border-[#1E293B] hover:border-slate-700/80'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">
              Low Stock Warnings
            </span>
            <h3 className={`text-sm sm:text-base md:text-lg font-black font-mono ${
              lowStockCount > 0 ? 'text-red-400 animate-pulse' : 'text-slate-400'
            }`}>
              {lowStockCount} Alert{lowStockCount === 1 ? '' : 's'}
            </h3>
          </div>
          <div className={`p-2.5 rounded-xl border ${
            lowStockCount > 0
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
          }`}>
            <AlertOctagon className="w-4 h-4 sm:w-5 h-5" />
          </div>
        </div>
        <p className="text-[9px] text-slate-500 mt-2 font-medium leading-tight">
          {lowStockCount > 0 ? 'Tap to view and restock now' : 'All stock levels healthy'}
        </p>
      </div>
    </div>
  );
};
