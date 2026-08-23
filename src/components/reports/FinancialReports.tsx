import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  TrendingUp,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Download,
  Filter,
  BarChart3,
  Percent,
} from 'lucide-react';
import { Transaction } from '../../types/pos';
import { posDb } from '../../services/db';

export const FinancialReports: React.FC = () => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';

  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('30days');
  const transactions = posDb.getTransactions();

  const filteredTx = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx) => {
      const d = new Date(tx.timestamp);
      if (dateRange === 'today') {
        return d.toDateString() === now.toDateString();
      }
      if (dateRange === '7days') {
        return now.getTime() - d.getTime() <= 7 * 24 * 60 * 60 * 1000;
      }
      if (dateRange === '30days') {
        return now.getTime() - d.getTime() <= 30 * 24 * 60 * 60 * 1000;
      }
      return true;
    });
  }, [transactions, dateRange]);

  // Aggregate P&L
  const pnl = useMemo(() => {
    let grossSales = 0;
    let netSales = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalCostOfGoods = 0;
    let cashSales = 0;
    let cardSales = 0;
    let voidSales = 0;
    let refundSales = 0;

    filteredTx.forEach((tx) => {
      if (tx.isVoided) {
        voidSales += tx.total;
        return;
      }

      if (tx.isRefund) {
        refundSales += Math.abs(tx.total);
        grossSales -= Math.abs(tx.total);
        return;
      }

      grossSales += tx.total;
      totalTax += tx.taxTotal;
      totalDiscount += tx.discountTotal;

      if (tx.paymentMethod === 'cash') cashSales += tx.total;
      else cardSales += tx.total;

      // Estimate COGS
      tx.items.forEach((it) => {
        const cost = (it.costPrice || it.price * 0.6) * it.quantity;
        totalCostOfGoods += cost;
      });
    });

    netSales = grossSales - totalTax;
    const grossProfit = netSales - totalCostOfGoods;
    const profitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    return {
      grossSales,
      netSales,
      totalTax,
      totalDiscount,
      totalCostOfGoods,
      grossProfit,
      profitMargin,
      cashSales,
      cardSales,
      voidSales,
      refundSales,
      txCount: filteredTx.length,
    };
  }, [filteredTx]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0D13] p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <FileCheck2 className="w-6 h-6 text-emerald-400" />
              <span>Financial Profit & Loss (P&L) Reports</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Seychelles retail revenue statements, VAT fiscal obligations, COGS margins, and gross profit breakdown
            </p>
          </div>

          <div className="inline-flex bg-[#161B22] p-1 rounded-xl border border-[#1E293B]">
            <button
              onClick={() => setDateRange('today')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                dateRange === 'today' ? 'bg-emerald-600 text-white' : 'text-slate-400'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateRange('7days')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                dateRange === '7days' ? 'bg-emerald-600 text-white' : 'text-slate-400'
              }`}
            >
              Past 7 Days
            </button>
            <button
              onClick={() => setDateRange('30days')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                dateRange === '30days' ? 'bg-emerald-600 text-white' : 'text-slate-400'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setDateRange('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                dateRange === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#161B22] p-4 rounded-2xl border border-[#1E293B]">
            <span className="text-[11px] text-slate-400 font-bold uppercase block">Gross Sales</span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-400 mt-1">
              {primarySymbol} {pnl.grossSales.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-500 font-mono mt-1 block">
              {pnl.txCount} transactions
            </span>
          </div>

          <div className="bg-[#161B22] p-4 rounded-2xl border border-[#1E293B]">
            <span className="text-[11px] text-slate-400 font-bold uppercase block">Cost of Goods (COGS)</span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-200 mt-1">
              {primarySymbol} {pnl.totalCostOfGoods.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Inventory purchase cost</span>
          </div>

          <div className="bg-[#161B22] p-4 rounded-2xl border border-[#1E293B]">
            <span className="text-[11px] text-slate-400 font-bold uppercase block">Gross Profit</span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-cyan-400 mt-1">
              {primarySymbol} {pnl.grossProfit.toFixed(2)}
            </div>
            <span className="text-[11px] text-emerald-400 font-bold mt-1 block">
              {pnl.profitMargin.toFixed(1)}% Gross Margin
            </span>
          </div>

          <div className="bg-[#161B22] p-4 rounded-2xl border border-[#1E293B]">
            <span className="text-[11px] text-slate-400 font-bold uppercase block">Seychelles VAT (15%)</span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-400 mt-1">
              {primarySymbol} {pnl.totalTax.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Tax collected for SRC</span>
          </div>
        </div>

        {/* Detailed Statement Table */}
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" /> Income & Expense Statement Summary
          </h2>

          <div className="divide-y divide-[#1E293B] text-xs font-mono">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-300 font-sans">Gross Store Revenue</span>
              <span className="text-white font-bold">{primarySymbol} {pnl.grossSales.toFixed(2)}</span>
            </div>

            <div className="py-2.5 flex justify-between text-rose-400">
              <span className="text-slate-400 font-sans">Less: Returns & Refunds</span>
              <span>-{primarySymbol} {pnl.refundSales.toFixed(2)}</span>
            </div>

            <div className="py-2.5 flex justify-between text-rose-400">
              <span className="text-slate-400 font-sans">Less: Seychelles 15% VAT Collected</span>
              <span>-{primarySymbol} {pnl.totalTax.toFixed(2)}</span>
            </div>

            <div className="py-2.5 flex justify-between font-bold text-white bg-[#0F1115] px-3 rounded-lg">
              <span className="font-sans">Net Sales Revenue</span>
              <span className="text-emerald-400">{primarySymbol} {pnl.netSales.toFixed(2)}</span>
            </div>

            <div className="py-2.5 flex justify-between text-slate-300">
              <span className="text-slate-400 font-sans">Less: Cost of Goods Sold (Inventory Base)</span>
              <span className="text-rose-400">-{primarySymbol} {pnl.totalCostOfGoods.toFixed(2)}</span>
            </div>

            <div className="py-3 flex justify-between font-extrabold text-sm sm:text-base text-white bg-emerald-950/30 px-3 rounded-xl border border-emerald-500/30">
              <span className="font-sans">Total Gross Margin (Gross Profit)</span>
              <span className="text-emerald-400">{primarySymbol} {pnl.grossProfit.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
