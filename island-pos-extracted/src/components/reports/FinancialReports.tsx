import React, { useState } from 'react';
import {
  TrendingUp,
  PieChart,
  ChartLine,
  ChartPie,
  ChartColumn,
  List,
  DollarSign,
  Layers,
  Printer,
  Download,
  Calendar,
  Percent,
  Shirt,
  Coffee,
  Sparkles,
  Flame,
  Clock,
} from 'lucide-react';
import { Transaction, InventoryItem, Vendor } from '../../types/pos';
import { posDb } from '../../services/db';
import { AnimatedAreaChart, ChartPoint } from './charts/AnimatedAreaChart';
import { AnimatedDonut } from './charts/AnimatedDonut';
import { AnimatedBarChart } from './charts/AnimatedBarChart';

interface FinancialReportsProps {
  transactions: Transaction[];
  inventory: InventoryItem[];
  vendors: Vendor[];
}

export const FinancialReports: React.FC<FinancialReportsProps> = ({
  transactions,
}) => {
  const [cycle, setCycle] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('today');
  const [viewMode, setViewModeState] = useState<'numbers' | 'graphs' | 'pie'>(() => {
    try {
      const saved = localStorage.getItem('finreports.viewMode');
      return saved === 'graphs' || saved === 'pie' ? saved : 'numbers';
    } catch {
      return 'numbers';
    }
  });
  const setViewMode = (m: 'numbers' | 'graphs' | 'pie') => {
    setViewModeState(m);
    try {
      localStorage.setItem('finreports.viewMode', m);
    } catch {
      /* storage unavailable — view simply won't persist */
    }
  };

  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || '$';
;
  const primaryCode = settings.primaryCurrency || 'USD';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 1;

  // Filter transactions by selected report cycle
  const now = new Date();
  const filteredTx = transactions.filter((tx) => {
    const txDate = new Date(tx.timestamp);
    if (cycle === 'today') {
      return txDate.toDateString() === now.toDateString();
    }
    if (cycle === 'week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
      return txDate >= sevenDaysAgo;
    }
    if (cycle === 'month') {
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }
    if (cycle === 'year') {
      return txDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  // Calculate Key Metrics
  let grossSales = 0;
  let totalVatCollected = 0;
  let totalDiscountsGiven = 0;

  // Wholesale Owned Breakdown
  let wholesaleGrossSales = 0;
  let wholesaleCostOfGoods = 0;
  let wholesaleNetProfit = 0;

  // Consignment Deposit Breakdown
  let consignmentGrossSales = 0;
  let consignmentVendorPayouts = 0;
  let consignmentHouseCommissions = 0;

  // Brand sales map
  const brandMap: Record<
    string,
    { gross: number; vat: number; units: number; items: Record<string, { qty: number; revenue: number; line: string; size: string }> }
  > = {};

  // Category sales map
  const categorySalesMap: Record<string, { revenue: number; units: number }> = {};

  // Product line sales map (all brands, derived from transaction line items)
  const productLineMap: Record<string, { revenue: number; units: number }> = {};

  // Size / variant breakdown map (category + size)
  const sizeBreakdownMap: Record<
    string,
    { category: string; size: string; revenue: number; units: number }
  > = {};

  // Historical FX tracking: transaction totals converted at each sale's snapshot rate
  let historicalSecondaryTotal = 0;

  filteredTx.forEach((tx) => {
    grossSales += tx.subtotal;
    totalVatCollected += tx.vatTotal || tx.tax || 0;
    totalDiscountsGiven += tx.discount;

    // Use the exchange-rate snapshot locked at checkout when available,
    // falling back to the current settings rate for legacy transactions.
    const txRate = tx.exchangeRateUsed && tx.exchangeRateUsed > 0 ? tx.exchangeRateUsed : exchangeRate;
    historicalSecondaryTotal += tx.total / txRate;

    tx.items.forEach((item) => {
      const brandName = item.brand || 'Unbranded';

      // Brand Map
      if (!brandMap[brandName]) {
        brandMap[brandName] = { gross: 0, vat: 0, units: 0, items: {} };
      }
      brandMap[brandName].gross += item.totalPrice;
      brandMap[brandName].vat += item.vatAmount || 0;
      brandMap[brandName].units += item.quantity;

      if (!brandMap[brandName].items[item.name]) {
        brandMap[brandName].items[item.name] = {
          qty: 0,
          revenue: 0,
          line: item.productLine || 'Normal',
          size: item.size || 'One Size',
        };
      }
      brandMap[brandName].items[item.name].qty += item.quantity;
      brandMap[brandName].items[item.name].revenue += item.totalPrice;

      // Category Map
      if (!categorySalesMap[item.category]) {
        categorySalesMap[item.category] = { revenue: 0, units: 0 };
      }
      categorySalesMap[item.category].revenue += item.totalPrice;
      categorySalesMap[item.category].units += item.quantity;

      // Product Line Map
      const lineName = item.productLine || 'Unclassified Line';
      if (!productLineMap[lineName]) productLineMap[lineName] = { revenue: 0, units: 0 };
      productLineMap[lineName].revenue += item.totalPrice;
      productLineMap[lineName].units += item.quantity;

      // Size / Variant Map
      const sizeKey = `${item.category} · ${item.size || 'One Size'}`;
      if (!sizeBreakdownMap[sizeKey]) {
        sizeBreakdownMap[sizeKey] = {
          category: item.category,
          size: item.size || 'One Size',
          revenue: 0,
          units: 0,
        };
      }
      sizeBreakdownMap[sizeKey].revenue += item.totalPrice;
      sizeBreakdownMap[sizeKey].units += item.quantity;

      if (item.supplierType === 'consignment') {
        consignmentGrossSales += item.totalPrice;
        consignmentVendorPayouts += item.vendorPayoutAmount;
        consignmentHouseCommissions += item.houseProfitAmount;
      } else {
        wholesaleGrossSales += item.totalPrice;
        wholesaleCostOfGoods += item.vendorPayoutAmount;
        wholesaleNetProfit += item.houseProfitAmount;
      }
    });
  });

  const totalNetRevenue = grossSales;
  const totalHouseProfit = wholesaleNetProfit + consignmentHouseCommissions;
  const grandTotalWithVat = totalNetRevenue + totalVatCollected;

  // Blended exchange rate actually in effect at the time of the sales in this
  // cycle (falls back to the current settings rate when no snapshots exist).
  const fxRate = historicalSecondaryTotal > 0 ? grandTotalWithVat / historicalSecondaryTotal : exchangeRate;

  // Effective VAT rate actually collected this cycle (blended across line-item
  // rates), falling back to the configured default when there is no data.
  const vatBase = Math.max(grossSales - totalDiscountsGiven, 0);
  const effectiveVatPct =
    vatBase > 0 ? (totalVatCollected / vatBase) * 100 : (settings.defaultVatRate || 0) * 100;

  // Peak shopping hour calculation for this cycle
  const hourlyCountMap: Record<number, { revenue: number; txCount: number }> = {};
  filteredTx.forEach((tx) => {
    const h = new Date(tx.timestamp).getHours();
    if (!hourlyCountMap[h]) hourlyCountMap[h] = { revenue: 0, txCount: 0 };
    hourlyCountMap[h].revenue += tx.subtotal;
    hourlyCountMap[h].txCount += 1;
  });
  let peakHourNum = 0;
  let peakHourRevenue = 0;
  let peakHourTx = 0;
  Object.entries(hourlyCountMap).forEach(([h, data]) => {
    if (data.revenue > peakHourRevenue) {
      peakHourRevenue = data.revenue;
      peakHourTx = data.txCount;
      peakHourNum = Number(h);
    }
  });

  // Top product lines & size/variant buckets — fully derived from transaction data
  const topProductLines = Object.entries(productLineMap).sort((a, b) => b[1].revenue - a[1].revenue);
  const topSizeBuckets = Object.entries(sizeBreakdownMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 6);

  // ---- Live chart datasets (derived from the same filtered transactions) ----
  const money = (v: number) => `${primarySymbol} ${v.toFixed(2)}`;

  const revenueSeries: ChartPoint[] = (() => {
    const buckets = new Map<string, { t: number; v: number }>();
    filteredTx.forEach((tx) => {
      const d = new Date(tx.timestamp);
      const k =
        cycle === 'today'
          ? `${String(d.getHours()).padStart(2, '0')}:00`
          : cycle === 'year' || cycle === 'all'
            ? d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
            : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      const b = buckets.get(k) || { t: d.getTime(), v: 0 };
      b.v += tx.total;
      b.t = Math.min(b.t, d.getTime());
      buckets.set(k, b);
    });
    return Array.from(buckets.entries())
      .sort((a, b) => a[1].t - b[1].t)
      .map(([label, b]) => ({ label, value: b.v }));
  })();

  const brandSeries: ChartPoint[] = Object.entries(brandMap)
    .sort((a, b) => b[1].gross - a[1].gross)
    .slice(0, 6)
    .map(([name, d]) => ({ label: name, value: d.gross }));

  const categorySeries: ChartPoint[] = Object.entries(categorySalesMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 8)
    .map(([name, s]) => ({ label: name, value: s.revenue }));

  const productLineSeries: ChartPoint[] = topProductLines.map(([name, s]) => ({
    label: name,
    value: s.revenue,
  }));

  // Export CSV Report for Selected Cycle
  const handleExportCsv = () => {
    let csvStr = `Cycle Financial Performance Report (${cycle.toUpperCase()})\n`;
    csvStr += `Generated At,${new Date().toLocaleString()}\n`;
    csvStr += `Blended Exchange Rate (at time of sale),1 ${secondaryCode} = ${primarySymbol} ${fxRate.toFixed(2)}\n\n`;

    csvStr += `Financial Metric,Amount in Base (${primaryCode}),Amount in Preferred (${secondaryCode})\n`;
    csvStr += `Net Sales Subtotal,${grossSales.toFixed(2)},${(grossSales / fxRate).toFixed(2)}\n`;
    csvStr += `VAT Tax Collected (${effectiveVatPct.toFixed(1)}%),${totalVatCollected.toFixed(2)},${(totalVatCollected / fxRate).toFixed(2)}\n`;
    csvStr += `Grand Total Revenue (Incl. VAT),${grandTotalWithVat.toFixed(2)},${(grandTotalWithVat / fxRate).toFixed(2)}\n`;
    csvStr += `Wholesale Cost of Goods (COGS),${wholesaleCostOfGoods.toFixed(2)},${(wholesaleCostOfGoods / fxRate).toFixed(2)}\n`;
    csvStr += `Consignment Depositor Payouts,${consignmentVendorPayouts.toFixed(2)},${(consignmentVendorPayouts / fxRate).toFixed(2)}\n`;
    csvStr += `House Net Profit,${totalHouseProfit.toFixed(2)},${(totalHouseProfit / fxRate).toFixed(2)}\n\n`;

    csvStr += `Brand Performance\n`;
    csvStr += `Brand,Units Sold,Gross Revenue (${primaryCode}),Gross Revenue (${secondaryCode}),VAT Tax (${primaryCode}),VAT Tax (${secondaryCode})\n`;
    Object.entries(brandMap).forEach(([bName, data]) => {
      csvStr += `"${bName}",${data.units},${data.gross.toFixed(2)},${(data.gross / fxRate).toFixed(2)},${data.vat.toFixed(2)},${(data.vat / fxRate).toFixed(2)}\n`;
    });
    csvStr += `\n`;

    csvStr += `Category Performance\n`;
    csvStr += `Category,Units Sold,Revenue (${primaryCode}),Revenue (${secondaryCode})\n`;
    Object.entries(categorySalesMap).forEach(([catName, stats]) => {
      csvStr += `"${catName}",${stats.units},${stats.revenue.toFixed(2)},${(stats.revenue / fxRate).toFixed(2)}\n`;
    });

    csvStr += `\nProduct Line Performance\n`;
    csvStr += `Product Line,Units Sold,Revenue (${primaryCode}),Revenue (${secondaryCode}),Avg Price per Unit (${primaryCode})\n`;
    topProductLines.forEach(([lineName, stats]) => {
      const avgPrice = stats.units > 0 ? stats.revenue / stats.units : 0;
      csvStr += `"${lineName}",${stats.units},${stats.revenue.toFixed(2)},${(stats.revenue / fxRate).toFixed(2)},${avgPrice.toFixed(2)}\n`;
    });

    csvStr += `\nSize / Variant Breakdown\n`;
    csvStr += `Category,Size,Units Sold,Revenue (${primaryCode}),Revenue (${secondaryCode}),Avg Price per Unit (${primaryCode})\n`;
    Object.entries(sizeBreakdownMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .forEach(([key, stats]) => {
        const avgPrice = stats.units > 0 ? stats.revenue / stats.units : 0;
        csvStr += `"${stats.category}","${stats.size}",${stats.units},${stats.revenue.toFixed(2)},${(stats.revenue / fxRate).toFixed(2)},${avgPrice.toFixed(2)}\n`;
      });

    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Financial_Report_${cycle}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Cycle Selector Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161B22] border border-[#1E293B] p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" /> Executive Financial & Brand Audit
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated cycle performance (Daily EOD, Monthly, Yearly), VAT collection, and Brand matrix
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Cycle Toggles */}
          <div className="flex bg-[#0F1115] p-1 rounded-xl border border-[#1E293B] text-xs font-medium">
            <button
              onClick={() => setCycle('today')}
              className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                cycle === 'today' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3 h-3" /> Daily (EOD)
            </button>
            <button
              onClick={() => setCycle('week')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                cycle === 'week' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setCycle('month')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                cycle === 'month' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setCycle('year')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                cycle === 'year' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              This Year
            </button>
            <button
              onClick={() => setCycle('all')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                cycle === 'all' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Time
            </button>
          </div>

          {/* View Toggle: Numbers / Graphs / Pie */}
          <div
            className="flex bg-[#0F1115] p-1 rounded-xl border border-[#1E293B] text-xs font-medium"
            role="tablist"
            aria-label="Report view mode"
          >
            {([
              ['numbers', 'Numbers', List],
              ['graphs', 'Graphs', ChartLine],
              ['pie', 'Pie', ChartPie],
            ] as const).map(([mode, label, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                role="tab"
                aria-selected={viewMode === mode}
                className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  viewMode === mode ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3 h-3" /> {label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCsv}
            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
          </button>

          <button
            onClick={() => window.print()}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" /> Print
          </button>
        </div>
      </div>

      {/* Top Level KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Net Sales Subtotal ({cycle.toUpperCase()})
          </div>
          <div className="text-2xl font-black font-mono text-[#E2E8F0] my-1">
            {primarySymbol} {grossSales.toFixed(2)}
          </div>
          {settings.allowPaymentInSecondary !== false && (
            <div className="text-[11px] font-mono font-bold text-cyan-400">
              {secondarySymbol}{(grossSales / fxRate).toFixed(2)} {secondaryCode}
            </div>
          )}
          <div className="text-[11px] text-slate-500 mt-0.5">
            {filteredTx.length} Completed Transactions
          </div>
        </div>

        <div className="bg-[#161B22] border border-cyan-500/40 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-cyan-300 font-semibold uppercase tracking-wider flex items-center gap-1">
            <Percent className="w-3.5 h-3.5" /> VAT Tax Collected ({effectiveVatPct.toFixed(1)}%)
          </div>
          <div className="text-2xl font-black font-mono text-cyan-400 my-1">
            {primarySymbol} {totalVatCollected.toFixed(2)}
          </div>
          {settings.allowPaymentInSecondary !== false && (
            <div className="text-[11px] font-mono font-bold text-slate-400">
              {secondarySymbol}{(totalVatCollected / fxRate).toFixed(2)} {secondaryCode}
            </div>
          )}
          <div className="text-[11px] text-cyan-400/80 mt-0.5">
            Ready for Tax Authority Filing
          </div>
        </div>

        <div className="bg-[#161B22] border border-emerald-500/40 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-emerald-300 font-semibold uppercase tracking-wider">
            House Net Profit
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 my-1">
            {primarySymbol} {totalHouseProfit.toFixed(2)}
          </div>
          {settings.allowPaymentInSecondary !== false && (
            <div className="text-[11px] font-mono font-bold text-cyan-400">
              {secondarySymbol}{(totalHouseProfit / fxRate).toFixed(2)} {secondaryCode}
            </div>
          )}
          <div className="text-[11px] text-emerald-400/80 mt-0.5">
            Wholesale Profit + Consignment Retention
          </div>
        </div>

        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Gross Cash / Card Tendered
          </div>
          <div className="text-2xl font-black font-mono text-amber-400 my-1">
            {primarySymbol} {grandTotalWithVat.toFixed(2)}
          </div>
          {settings.allowPaymentInSecondary !== false && (
            <div className="text-[11px] font-mono font-bold text-cyan-400">
              {secondarySymbol}{(grandTotalWithVat / fxRate).toFixed(2)} {secondaryCode}
            </div>
          )}
          <div className="text-[11px] text-slate-500 mt-0.5">Includes Net Sales + VAT</div>
        </div>
      </div>

      {/* Peak Shopping Hour Quick Highlight Banner */}
      {filteredTx.length > 0 && peakHourRevenue > 0 && (
        <div className="bg-[#161B22] border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <span>Peak Shopping Window for this Cycle:</span>
                <span className="font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-[11px]">
                  {String(peakHourNum).padStart(2, '0')}:00 – {String(peakHourNum + 1).padStart(2, '0')}:00
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Generated {primarySymbol} {peakHourRevenue.toFixed(2)} across {peakHourTx} transactions during this cycle.
              </p>
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 self-end sm:self-auto">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Check Sales Heatmap tab for full day-by-hour matrix</span>
          </div>
        </div>
      )}

      {/* Live Chart Views — Graphs / Pie */}
      {viewMode === 'graphs' && (
        <div className="space-y-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-2 mb-4">
              <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
                <ChartLine className="w-4 h-4 text-emerald-400" /> Revenue Trend ({cycle.toUpperCase()})
              </h3>
              <span className="text-[10px] text-slate-400">Live — redraws with every sale</span>
            </div>
            {revenueSeries.length === 0 ? (
              <p className="text-xs text-slate-500 py-10 text-center">No sales recorded for this cycle yet.</p>
            ) : (
              <AnimatedAreaChart data={revenueSeries} formatValue={money} />
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
                <ChartColumn className="w-4 h-4 text-cyan-400" /> Top Brands by Revenue
              </h3>
              {brandSeries.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No sales recorded for this cycle yet.</p>
              ) : (
                <AnimatedBarChart data={brandSeries} color="#22d3ee" formatValue={money} />
              )}
            </div>
            <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
                <ChartColumn className="w-4 h-4 text-emerald-400" /> Top Product Lines
              </h3>
              {productLineSeries.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No sales recorded for this cycle yet.</p>
              ) : (
                <AnimatedBarChart data={productLineSeries} color="#34d399" formatValue={money} />
              )}
            </div>
          </div>
        </div>
      )}
      {viewMode === 'pie' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2 border-b border-[#1E293B] pb-2 mb-4">
              <ChartPie className="w-4 h-4 text-cyan-400" /> Brand Sales Share ({cycle.toUpperCase()})
            </h3>
            {brandSeries.length === 0 ? (
              <p className="text-xs text-slate-500 py-10 text-center">No sales recorded for this cycle yet.</p>
            ) : (
              <AnimatedDonut data={brandSeries} formatValue={money} centerLabel="Brand Total" />
            )}
          </div>
          <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2 border-b border-[#1E293B] pb-2 mb-4">
              <ChartPie className="w-4 h-4 text-emerald-400" /> Category Sales Share ({cycle.toUpperCase()})
            </h3>
            {categorySeries.length === 0 ? (
              <p className="text-xs text-slate-500 py-10 text-center">No sales recorded for this cycle yet.</p>
            ) : (
              <AnimatedDonut data={categorySeries} formatValue={money} centerLabel="Category Total" />
            )}
          </div>
        </div>
      )}

      {/* Brand Performance Cards Grid (Numbers view) */}
      {viewMode === 'numbers' && (
      <>
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
          <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" /> Brand Performance Matrix ({cycle.toUpperCase()})
          </h3>
          <span className="text-xs text-slate-400">
            Derived live from transaction line items — syncs automatically with your vendors & catalog
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(brandMap).map(([bName, data]) => (
            <div
              key={bName}
              className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-3 relative"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
                <span className="font-bold text-sm text-[#E2E8F0] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  {bName}
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
                  {data.units} units sold
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Gross Sales</div>
                  <div className="text-base font-bold text-emerald-400">
                    {primarySymbol} {data.gross.toFixed(2)}
                    {settings.allowPaymentInSecondary !== false && (
                      <span className="block text-[10px] text-cyan-400 font-medium">
                        {secondarySymbol}{(data.gross / fxRate).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">VAT Collected</div>
                  <div className="text-base font-bold text-cyan-400">
                    {primarySymbol} {data.vat.toFixed(2)}
                    {settings.allowPaymentInSecondary !== false && (
                      <span className="block text-[10px] text-slate-400 font-medium">
                        {secondarySymbol}{(data.vat / fxRate).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Item Top Sellers Preview */}
              <div className="pt-2 border-t border-[#1E293B] text-[11px] space-y-1">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Line Items Breakdown:</div>
                {Object.entries(data.items).slice(0, 3).map(([iName, iData]) => (
                  <div key={iName} className="flex justify-between text-slate-300">
                    <span className="truncate pr-2">{iName}</span>
                    <span className="font-mono text-slate-400 shrink-0">
                      {iData.qty}x ({primarySymbol} {iData.revenue.toFixed(2)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Line & Size/Variant Breakdown (fully data-driven) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product Line Performance */}
        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
            <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
              <Shirt className="w-4 h-4 text-emerald-400" /> Product Line Performance
            </h3>
            <span className="text-[10px] text-slate-400">All brands · by product line</span>
          </div>

          {topProductLines.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No sales recorded for this cycle yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {topProductLines.map(([lineName, stats]) => (
                <div
                  key={lineName}
                  className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#E2E8F0] truncate">{lineName}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {stats.units} units · avg {primarySymbol}{' '}
                      {(stats.units > 0 ? stats.revenue / stats.units : 0).toFixed(2)}/ea
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono text-emerald-400">
                      {primarySymbol} {stats.revenue.toFixed(2)}
                    </div>
                    {settings.allowPaymentInSecondary !== false && (
                      <div className="text-[10px] font-mono text-cyan-400">
                        {secondarySymbol}
                        {(stats.revenue / fxRate).toFixed(2)} {secondaryCode}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category & Size Variant Matrix */}
        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
            <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
              <Coffee className="w-4 h-4 text-cyan-400" /> Category & Size Variant Matrix
            </h3>
            <span className="text-[10px] text-slate-400">Top sellers this cycle</span>
          </div>

          {topSizeBuckets.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No sales recorded for this cycle yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {topSizeBuckets.map(([key, stats]) => (
                <div key={key} className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold truncate">
                    {stats.category}
                  </div>
                  <div className="text-xs font-bold text-[#E2E8F0] truncate">{stats.size}</div>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                    {primarySymbol} {stats.revenue.toFixed(2)}
                  </div>
                  {settings.allowPaymentInSecondary !== false && (
                    <div className="text-[10px] font-mono font-bold text-cyan-400">
                      {secondarySymbol}
                      {(stats.revenue / fxRate).toFixed(2)} {secondaryCode}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {stats.units} sold · avg {primarySymbol}{' '}
                    {(stats.units > 0 ? stats.revenue / stats.units : 0).toFixed(2)}/ea
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* P&L Split & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Wholesale Owned Inventory Profit Column */}
        <div className="bg-[#161B22] border border-blue-500/30 rounded-xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
            <h3 className="font-bold text-base text-[#E2E8F0] flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" /> Direct Wholesale Owned Goods P&L
            </h3>
            <span className="text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2.5 py-1 rounded-lg font-bold">
              Owned Stock
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono bg-[#0F1115] p-4 rounded-xl border border-[#1E293B]">
            <div className="flex justify-between text-slate-300">
              <span>Gross Retail Sales:</span>
              <span className="font-bold text-[#E2E8F0]">
                {primarySymbol} {wholesaleGrossSales.toFixed(2)}
                {settings.allowPaymentInSecondary !== false && ` (${secondarySymbol}${(wholesaleGrossSales / fxRate).toFixed(2)} ${secondaryCode})`}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Less: Wholesale Cost of Goods (COGS):</span>
              <span className="text-rose-400">
                -{primarySymbol} {wholesaleCostOfGoods.toFixed(2)}
                {settings.allowPaymentInSecondary !== false && ` (-${secondarySymbol}${(wholesaleCostOfGoods / fxRate).toFixed(2)} ${secondaryCode})`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-sm text-emerald-400 pt-2 border-t border-[#1E293B]">
              <span>NET WHOLESALE PROFIT:</span>
              <span>
                {primarySymbol} {wholesaleNetProfit.toFixed(2)}
                {settings.allowPaymentInSecondary !== false && ` (${secondarySymbol}${(wholesaleNetProfit / fxRate).toFixed(2)} ${secondaryCode})`}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Consignment Commission Retention Column */}
        <div className="bg-[#161B22] border border-amber-500/30 rounded-xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
            <h3 className="font-bold text-base text-[#E2E8F0] flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-400" /> Consignment / Deposit P&L
            </h3>
            <span className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-lg font-bold">
              Deposit Goods
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono bg-[#0F1115] p-4 rounded-xl border border-[#1E293B]">
            <div className="flex justify-between text-slate-300">
              <span>Gross Consignment Sales:</span>
              <span className="font-bold text-[#E2E8F0]">
                {primarySymbol} {consignmentGrossSales.toFixed(2)}
                {settings.allowPaymentInSecondary !== false && ` (${secondarySymbol}${(consignmentGrossSales / fxRate).toFixed(2)} ${secondaryCode})`}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Less: Owed to Depositors (Artisans):</span>
              <span className="text-amber-400">
                -{primarySymbol} {consignmentVendorPayouts.toFixed(2)}
                {settings.allowPaymentInSecondary !== false && ` (-${secondarySymbol}${(consignmentVendorPayouts / fxRate).toFixed(2)} ${secondaryCode})`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-sm text-emerald-400 pt-2 border-t border-[#1E293B]">
              <span>HOUSE COMMISSION RETAINED:</span>
              <span>
                {primarySymbol} {consignmentHouseCommissions.toFixed(2)}
                {settings.allowPaymentInSecondary !== false && ` (${secondarySymbol}${(consignmentHouseCommissions / fxRate).toFixed(2)} ${secondaryCode})`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Performance Breakdown (Numbers view) */}
      {viewMode === 'numbers' && (
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-cyan-400" /> Revenue & Volume by Group Category ({cycle.toUpperCase()})
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {Object.entries(categorySalesMap).map(([catName, stats]) => (
            <div
              key={catName}
              className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B] text-xs space-y-1"
            >
              <div className="text-slate-400 font-semibold truncate">{catName}</div>
              <div className="text-base font-bold font-mono text-emerald-400">
                {primarySymbol} {stats.revenue.toFixed(2)}
              </div>
              {settings.allowPaymentInSecondary !== false && (
                <div className="text-[10px] font-mono text-cyan-400 font-bold block mt-0.5">
                  {secondarySymbol}{(stats.revenue / fxRate).toFixed(2)} {secondaryCode}
                </div>
              )}
              <div className="text-[10px] text-slate-500">{stats.units} items sold</div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
};
