import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Sliders,
  DollarSign,
  Package,
  ShoppingCart,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Percent,
  Layers,
  ChevronRight,
  Filter,
  Check,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { InventoryItem, Transaction, Vendor } from '../../types/pos';
import { posDb } from '../../services/db';

interface SalesForecastingProps {
  transactions: Transaction[];
  inventory: InventoryItem[];
  vendors: Vendor[];
  onRefreshData: () => void;
}

export const SalesForecasting: React.FC<SalesForecastingProps> = ({
  transactions,
  inventory,
  vendors,
  onRefreshData,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 13.50;

  // Configurations
  const [historicalDays, setHistoricalDays] = useState<7 | 14 | 30 | 90>(30);
  const [growthMultiplier, setGrowthMultiplier] = useState<number>(1.15); // Default 1.15x (15% growth spike)
  const [safetyBuffer, setSafetyBuffer] = useState<number>(0.20); // Default 20% safety stock buffer
  const [algorithm, setAlgorithm] = useState<'velocity' | 'recent_weighted' | 'seasonality'>('recent_weighted');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [reorderStatusFilter, setReorderStatusFilter] = useState<'all' | 'reorder' | 'sufficient'>('all');
  
  // Notification Toast
  const [toast, setToast] = useState<string | null>(null);

  // List unique categories and brands for filters
  const categories = useMemo(() => {
    const list = new Set(inventory.map((item) => item.category));
    return Array.from(list);
  }, [inventory]);

  const brands = useMemo(() => {
    const list = new Set(inventory.map((item) => item.brand || 'Ocean Seychelles'));
    return Array.from(list);
  }, [inventory]);

  // Forecast calculations per inventory item
  const forecastedItems = useMemo(() => {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - historicalDays * 24 * 60 * 60 * 1000);
    const recentCutoffDate = new Date(now.getTime() - Math.min(historicalDays, 7) * 24 * 60 * 60 * 1000);

    // Step 1: Calculate total quantities sold per item
    const salesCounts: Record<string, number> = {};
    const recentSalesCounts: Record<string, number> = {};

    transactions.forEach((tx) => {
      // Exclude refunds
      if (tx.isRefund) return;
      const txDate = new Date(tx.timestamp);

      if (txDate >= cutoffDate) {
        tx.items.forEach((item) => {
          salesCounts[item.itemId] = (salesCounts[item.itemId] || 0) + item.quantity;
        });
      }

      if (txDate >= recentCutoffDate) {
        tx.items.forEach((item) => {
          recentSalesCounts[item.itemId] = (recentSalesCounts[item.itemId] || 0) + item.quantity;
        });
      }
    });

    return inventory.map((item) => {
      const unitsSold = salesCounts[item.id] || 0;
      const recentUnitsSold = recentSalesCounts[item.id] || 0;

      // Base daily run rate
      const baseDailyRate = unitsSold / historicalDays;
      // Recent daily run rate (last 7 days)
      const recentDailyRate = recentUnitsSold / Math.min(historicalDays, 7);

      let adjustedDailyRate = baseDailyRate;

      // Apply algorithm
      if (algorithm === 'recent_weighted') {
        // 70% weight to recent 7 days, 30% weight to overall historical period
        adjustedDailyRate = (recentDailyRate * 0.7) + (baseDailyRate * 0.3);
      } else if (algorithm === 'seasonality') {
        // Boost rate by category-specific seasonal multiplier
        let seasonalMultiplier = 1.0;
        const catLower = item.category.toLowerCase();
        if (catLower.includes('t-shirt') || catLower.includes('clothing')) {
          seasonalMultiplier = 1.25; // high summer tourism demand
        } else if (catLower.includes('mug') || catLower.includes('souvenir')) {
          seasonalMultiplier = 1.15;
        } else if (catLower.includes('soap') || catLower.includes('artisan')) {
          seasonalMultiplier = 1.10;
        }
        adjustedDailyRate = baseDailyRate * seasonalMultiplier;
      }

      // Forecasted demand for the upcoming 30 days
      const forecasted30DayDemand = adjustedDailyRate * 30 * growthMultiplier;
      
      // Target Stock Level = Forecasted demand + Safety Buffer
      const targetStockLevel = Math.ceil(forecasted30DayDemand * (1 + safetyBuffer));

      // Suggested Order Quantity
      // Ensure we reorder at least to reach minStockThreshold if currently low
      let suggestedOrder = 0;
      if (item.stockLevel <= item.minStockThreshold) {
        // If below threshold, ensure we order enough to exceed threshold + target stock level
        suggestedOrder = Math.max(0, targetStockLevel + item.minStockThreshold - item.stockLevel);
      } else {
        suggestedOrder = Math.max(0, targetStockLevel - item.stockLevel);
      }

      // If suggested order is 0 but stock is below minStockThreshold, give an advisory reorder
      if (suggestedOrder === 0 && item.stockLevel <= item.minStockThreshold) {
        suggestedOrder = Math.max(0, (item.minStockThreshold * 2) - item.stockLevel);
      }

      // Days of inventory remaining
      const dailyVelocity = adjustedDailyRate || (item.minStockThreshold / 30) || 0.1;
      const daysRemaining = dailyVelocity > 0 ? Math.floor(item.stockLevel / dailyVelocity) : 999;

      const totalCostBasis = suggestedOrder * item.costBasis;
      const potentialRevenue = suggestedOrder * item.retailPrice;
      const potentialMargin = potentialRevenue - totalCostBasis;

      // Status
      let status: 'critical' | 'warn' | 'sufficient' = 'sufficient';
      if (item.stockLevel === 0 && suggestedOrder > 0) {
        status = 'critical';
      } else if (item.stockLevel <= item.minStockThreshold) {
        status = 'critical';
      } else if (daysRemaining <= 10 && suggestedOrder > 0) {
        status = 'warn';
      }

      return {
        ...item,
        unitsSold,
        dailyVelocity,
        forecasted30DayDemand,
        targetStockLevel,
        suggestedOrder,
        daysRemaining,
        totalCostBasis,
        potentialRevenue,
        potentialMargin,
        status,
      };
    });
  }, [inventory, transactions, historicalDays, growthMultiplier, safetyBuffer, algorithm]);

  // Filtered forecasts
  const filteredForecasts = useMemo(() => {
    return forecastedItems.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q));

      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesBrand = selectedBrand === 'all' || item.brand === selectedBrand;
      
      const matchesStatus =
        reorderStatusFilter === 'all' ||
        (reorderStatusFilter === 'reorder' && item.suggestedOrder > 0) ||
        (reorderStatusFilter === 'sufficient' && item.suggestedOrder === 0);

      return matchesSearch && matchesCategory && matchesBrand && matchesStatus;
    });
  }, [forecastedItems, searchQuery, selectedCategory, selectedBrand, reorderStatusFilter]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    let totalSuggestedOrderQty = 0;
    let totalProcurementCost = 0;
    let totalProjectedRevenue = 0;
    let criticalStockoutsCount = 0;

    forecastedItems.forEach((item) => {
      if (item.suggestedOrder > 0) {
        totalSuggestedOrderQty += item.suggestedOrder;
        totalProcurementCost += item.totalCostBasis;
        totalProjectedRevenue += item.potentialRevenue;
        if (item.stockLevel <= item.minStockThreshold) {
          criticalStockoutsCount++;
        }
      }
    });

    const totalProjectedProfit = totalProjectedRevenue - totalProcurementCost;
    const avgProfitMargin = totalProjectedRevenue > 0 ? (totalProjectedProfit / totalProjectedRevenue) * 100 : 0;

    return {
      totalSuggestedOrderQty,
      totalProcurementCost,
      totalProjectedRevenue,
      totalProjectedProfit,
      avgProfitMargin,
      criticalStockoutsCount,
    };
  }, [forecastedItems]);

  // Handle single item simulated restock
  const handleRestockItem = (itemId: string, qty: number) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;

    const updatedItem = {
      ...item,
      stockLevel: item.stockLevel + qty,
    };

    posDb.saveItem(updatedItem);
    onRefreshData();
    showToast(`Replenished ${qty} units of "${item.name}" directly to store inventory!`);
  };

  // Bulk restock all filtered items (persists directly in DB!)
  const handleBulkRestockFiltered = () => {
    const reorderItems = filteredForecasts.filter((i) => i.suggestedOrder > 0);
    if (reorderItems.length === 0) {
      alert('No items meet current re-order criteria to replenish.');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to approve & process restock for ${reorderItems.length} items? This will instantly increase physical stock levels in the database by their suggested quantities.`
      )
    ) {
      return;
    }

    let processedCount = 0;
    reorderItems.forEach((item) => {
      const origItem = inventory.find((i) => i.id === item.id);
      if (origItem) {
        posDb.saveItem({
          ...origItem,
          stockLevel: origItem.stockLevel + item.suggestedOrder,
        });
        processedCount++;
      }
    });

    onRefreshData();
    showToast(`Successfully processed physical replenishment for ${processedCount} items! Database is updated.`);
  };

  // Helper to trigger toast notifications
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Export Forecasting & Reorders to CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'SKU,Item Name,Category,Brand,Current Stock,Min Threshold,Days Remaining,Historical Units Sold,Daily Velocity,Projected 30D Demand,Safety Buffer %,Safety Stock Target,Suggested Re-order Qty,Unit Cost Basis,Total Re-order Cost,Supplier Type,Vendor\n';

    forecastedItems.forEach((item) => {
      const vendorName = vendors.find((v) => v.id === item.vendorId)?.name || 'Unknown';
      const supplierType = item.retailPrice === item.costBasis ? 'Consignment' : 'Wholesale';
      const cleanName = item.name.replace(/,/g, ' ');
      const cleanBrand = (item.brand || 'Seychelles').replace(/,/g, ' ');
      const cleanCategory = item.category.replace(/,/g, ' ');

      csvContent += `${item.sku},"${cleanName}","${cleanCategory}","${cleanBrand}",${item.stockLevel},${item.minStockThreshold},${item.daysRemaining === 999 ? '30+' : item.daysRemaining},${item.unitsSold},${item.dailyVelocity.toFixed(3)},${item.forecasted30DayDemand.toFixed(1)},${(safetyBuffer * 100).toFixed(0)}%,${item.targetStockLevel},${item.suggestedOrder},${item.costBasis.toFixed(2)},${item.totalCostBasis.toFixed(2)},${supplierType},"${vendorName}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Seychelles_Inventory_Forecasting_Report_${historicalDays}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Procurement forecasting advisory report exported successfully!');
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification Alert Banner */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#161B22] border border-emerald-500 text-emerald-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 transition-all animate-bounce max-w-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toast}</span>
        </div>
      )}

      {/* Control Banner */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1E293B]">
          <div>
            <h2 className="text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" /> Predictive Sales Forecasting & Demand Sensing
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Analyze historical run rates, configure safe-stock thresholds, and compute smart vendor re-order quantities for upcoming seasonal shifts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export Order Guide (CSV)</span>
            </button>

            <button
              onClick={handleBulkRestockFiltered}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
              title="Add suggested amounts to inventory on hand"
            >
              <Check className="w-4 h-4" />
              <span>Approve & Bulk Restock All</span>
            </button>
          </div>
        </div>

        {/* Dynamic Hyperparameters Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          
          {/* Slider 1: Historical Run-rate Window */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Historic Trend Horizon
            </label>
            <div className="flex bg-[#0F1115] p-1 rounded-xl border border-[#1E293B] text-xs">
              {([7, 14, 30, 90] as const).map((days) => (
                <button
                  key={days}
                  onClick={() => setHistoricalDays(days)}
                  className={`flex-1 py-1 rounded-lg font-semibold transition-all ${
                    historicalDays === days
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {days}D Velocity
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">Historical lookback span to calculate velocity</p>
          </div>

          {/* Slider 2: Forecasting Algorithms */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Forecasting Engine
            </label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as any)}
              className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-semibold text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
            >
              <option value="recent_weighted">Weighted (70% Recent / 30% Base)</option>
              <option value="velocity">Linear Run-Rate (Pure Average)</option>
              <option value="seasonality">Category Tourism Multiplier</option>
            </select>
            <p className="text-[10px] text-slate-500">Weightage strategy applied to daily run rates</p>
          </div>

          {/* Slider 3: Growth Multiplier */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Seasonal Growth Rate
              </span>
              <span className="font-mono font-bold text-emerald-400">{(growthMultiplier * 100 - 100).toFixed(0)}% Spike</span>
            </div>
            <div className="flex items-center gap-3 bg-[#0F1115] px-3 py-1.5 rounded-xl border border-[#1E293B]">
              <input
                type="range"
                min="0.8"
                max="2.0"
                step="0.05"
                value={growthMultiplier}
                onChange={(e) => setGrowthMultiplier(parseFloat(e.target.value))}
                className="flex-1 accent-emerald-500 cursor-pointer h-1 rounded-lg bg-slate-800"
              />
              <span className="text-xs font-mono font-bold text-slate-300 shrink-0">{growthMultiplier.toFixed(2)}x</span>
            </div>
            <p className="text-[10px] text-slate-500">Tourism / holiday spike factor for next 30 days</p>
          </div>

          {/* Slider 4: Safety Stock Buffer */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-purple-400" /> Safety Buffer Level
              </span>
              <span className="font-mono font-bold text-purple-400">{(safetyBuffer * 100).toFixed(0)}% Buffer</span>
            </div>
            <div className="flex items-center gap-3 bg-[#0F1115] px-3 py-1.5 rounded-xl border border-[#1E293B]">
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={safetyBuffer}
                onChange={(e) => setSafetyBuffer(parseFloat(e.target.value))}
                className="flex-1 accent-purple-500 cursor-pointer h-1 rounded-lg bg-slate-800"
              />
              <span className="text-xs font-mono font-bold text-slate-300 shrink-0">+{Math.ceil(safetyBuffer * 100)}%</span>
            </div>
            <p className="text-[10px] text-slate-500">Extra buffer inventory held to safeguard run outs</p>
          </div>

        </div>
      </div>

      {/* Aggregate KPI Dashboards cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        
        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Suggested Procurement Cost</span>
            <span className="text-xl font-black font-mono text-emerald-400 block mt-1">
              {primarySymbol} {aggregateStats.totalProcurementCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {settings.allowPaymentInSecondary !== false && (
              <span className="text-[11px] font-mono text-cyan-400 font-bold block mt-0.5">
                {secondarySymbol}{(aggregateStats.totalProcurementCost / exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {secondaryCode}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Required cash outlay to buy all recommended replenishment stock.</p>
        </div>

        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Projected Retail Value</span>
            <span className="text-xl font-black font-mono text-[#E2E8F0] block mt-1">
              {primarySymbol} {aggregateStats.totalProjectedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {settings.allowPaymentInSecondary !== false && (
              <span className="text-[11px] font-mono text-cyan-400 font-bold block mt-0.5">
                {secondarySymbol}{(aggregateStats.totalProjectedRevenue / exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {secondaryCode}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Estimated sales subtotal generated once replenishment sells out.</p>
        </div>

        <div className="bg-[#161B22] border border-emerald-500/30 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-emerald-400 uppercase font-black tracking-wider block">Projected Profits Retained</span>
            <span className="text-xl font-black font-mono text-emerald-400 block mt-1">
              {primarySymbol} {aggregateStats.totalProjectedProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {settings.allowPaymentInSecondary !== false && (
              <span className="text-[11px] font-mono text-cyan-400 font-bold block mt-0.5">
                {secondarySymbol}{(aggregateStats.totalProjectedProfit / exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {secondaryCode}
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-2">
            Average margin rate: <span className="text-emerald-400 font-mono font-bold">{aggregateStats.avgProfitMargin.toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Procured Units Count</span>
            <span className="text-xl font-bold font-mono text-cyan-400 block mt-1">{aggregateStats.totalSuggestedOrderQty} Units</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Total pieces suggested to order from direct/consignment vendors.</p>
        </div>

        <div className="bg-[#161B22] border border-rose-500/20 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-rose-300 uppercase font-black tracking-wider block">Stockouts Prevented</span>
            <span className="text-xl font-black font-mono text-rose-400 block mt-1">{aggregateStats.criticalStockoutsCount} Products</span>
          </div>
          <p className="text-[10px] text-rose-400/70 mt-2">Currently low/out of stock items that have forecasted sales next month.</p>
        </div>

      </div>

      {/* Grid Container for Table and Filters */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl shadow-sm overflow-hidden flex flex-col">
        
        {/* Search, Group, Filter Panel */}
        <div className="p-4 bg-[#111318] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search forecasted items by Name, SKU, or Brand..."
                className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl pl-10 pr-4 py-2 text-xs text-[#E2E8F0] placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Category Filter */}
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[#0F1115] border border-[#1E293B] text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Brand Filter */}
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="bg-[#0F1115] border border-[#1E293B] text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Status Recommendation Switcher */}
            <div className="flex bg-[#0F1115] p-1 rounded-lg border border-[#1E293B]">
              <button
                onClick={() => setReorderStatusFilter('all')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                  reorderStatusFilter === 'all'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setReorderStatusFilter('reorder')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                  reorderStatusFilter === 'reorder'
                    ? 'bg-amber-600/30 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Reorder Only
              </button>
              <button
                onClick={() => setReorderStatusFilter('sufficient')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                  reorderStatusFilter === 'sufficient'
                    ? 'bg-slate-700 text-slate-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sufficient Stock
              </button>
            </div>
          </div>

        </div>

        {/* Suggestion Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#111318] border-b border-[#1E293B] text-slate-400 uppercase text-[10px] font-bold font-mono">
                <th className="p-4">Item Details & Code</th>
                <th className="p-4 text-center">On Hand</th>
                <th className="p-4 text-center">{historicalDays}D Sold</th>
                <th className="p-4 text-center">Velocity / Day</th>
                <th className="p-4 text-center">Projected 30D</th>
                <th className="p-4 text-center">Target Level</th>
                <th className="p-4 text-center">Suggested Order</th>
                <th className="p-4 text-right">Cost basis</th>
                <th className="p-4 text-right">Procure Cost</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] bg-[#161B22]/50">
              {filteredForecasts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-semibold space-y-2">
                    <Package className="w-8 h-8 text-slate-600 mx-auto" />
                    <p>No forecasted items found matching specified filter filters.</p>
                  </td>
                </tr>
              ) : (
                filteredForecasts.map((item) => {
                  const vendor = vendors.find((v) => v.id === item.vendorId);
                  const isLow = item.stockLevel <= item.minStockThreshold;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#111318]/60 transition-colors ${
                        item.suggestedOrder > 0 ? 'bg-amber-500/[0.015]' : ''
                      }`}
                    >
                      {/* Name & Sku */}
                      <td className="p-4 min-w-[200px]">
                        <div className="font-bold text-[#E2E8F0] line-clamp-1">{item.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                          <span>SKU: {item.sku}</span>
                          <span>•</span>
                          <span className="text-slate-300">{item.brand || 'Ocean Seychelles'}</span>
                          <span>•</span>
                          <span className="text-slate-500 font-sans">{item.category}</span>
                        </div>
                      </td>

                      {/* Stock on Hand */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-xs border ${
                            isLow
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          }`}
                        >
                          {item.stockLevel}
                        </span>
                        <div className="text-[9px] text-slate-500 font-mono mt-1">Min: {item.minStockThreshold}</div>
                      </td>

                      {/* Sold history */}
                      <td className="p-4 text-center font-mono font-bold text-slate-300 text-xs">
                        {item.unitsSold} units
                      </td>

                      {/* Velocity / Day */}
                      <td className="p-4 text-center font-mono text-slate-400 whitespace-nowrap">
                        {item.dailyVelocity.toFixed(2)} / day
                      </td>

                      {/* 30 Day Projected demand */}
                      <td className="p-4 text-center font-mono font-bold text-cyan-300 whitespace-nowrap">
                        {item.forecasted30DayDemand.toFixed(1)}
                      </td>

                      {/* Target Level */}
                      <td className="p-4 text-center font-mono text-slate-400 whitespace-nowrap">
                        {item.targetStockLevel}
                      </td>

                      {/* Suggested Order */}
                      <td className="p-4 text-center whitespace-nowrap">
                        {item.suggestedOrder > 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="font-mono font-black text-xs text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                              +{item.suggestedOrder}
                            </span>
                            <span className="text-[8.5px] text-amber-500 font-semibold mt-1 uppercase">Reorder</span>
                          </div>
                        ) : (
                          <span className="font-mono text-slate-500">-</span>
                        )}
                      </td>

                      {/* Cost basis */}
                      <td className="p-4 text-right font-mono text-slate-400">
                        {primarySymbol} {item.costBasis.toFixed(2)}
                      </td>

                      {/* Net Procurement Cost */}
                      <td className="p-4 text-right font-mono font-bold text-[#E2E8F0]">
                        {item.suggestedOrder > 0 ? (
                          <span className="text-emerald-400 font-bold">{primarySymbol} {item.totalCostBasis.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-500">{primarySymbol} 0.00</span>
                        )}
                      </td>

                      {/* Instant Simulated Restock & Status Actions */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {item.suggestedOrder > 0 ? (
                            <button
                              onClick={() => handleRestockItem(item.id, item.suggestedOrder)}
                              className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                              title="Instantly process simulated stock replenishment for this quantity"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Restock</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestockItem(item.id, 10)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                              title="Restock default standard batch of 10 units"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+10</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info counts */}
        <div className="p-3 bg-[#111318] border-t border-[#1E293B] flex items-center justify-between text-[11px] text-slate-500">
          <span>Showing {filteredForecasts.length} out of {inventory.length} total products under prediction</span>
          <span>Predictions re-calculated live based on active cash register sales records</span>
        </div>

      </div>

    </div>
  );
};
