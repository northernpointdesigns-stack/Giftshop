import React, { useState } from 'react';
import {
  TrendingUp,
  PieChart,
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

interface FinancialReportsProps {
  transactions: Transaction[];
  inventory: InventoryItem[];
  vendors: Vendor[];
}

export const FinancialReports: React.FC<FinancialReportsProps> = ({
  transactions,
}) => {
  const [cycle, setCycle] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('today');

  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 13.50;

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

  filteredTx.forEach((tx) => {
    grossSales += tx.subtotal;
    totalVatCollected += tx.vatTotal || tx.tax || 0;
    totalDiscountsGiven += tx.discount;

    tx.items.forEach((item) => {
      const brandName = item.brand || 'Ocean Seychelles';

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

  // Peak shopping hour calculation for this cycle
  const hourlyCountMap: Record<number, { revenue: number; txCount: number }> = {};
  filteredTx.forEach((tx) => {
    const h = new Date(tx.timestamp).getHours();
    if (!hourlyCountMap[h]) hourlyCountMap[h] = { revenue: 0, txCount: 0 };
    hourlyCountMap[h].revenue += tx.subtotal;
    hourlyCountMap[h].txCount += 1;
  });
  let peakHourNum = 14;
  let peakHourRevenue = 0;
  let peakHourTx = 0;
  Object.entries(hourlyCountMap).forEach(([h, data]) => {
    if (data.revenue > peakHourRevenue) {
      peakHourRevenue = data.revenue;
      peakHourTx = data.txCount;
      peakHourNum = Number(h);
    }
  });

  // Ocean Seychelles Mug Line Comparison (Luxury vs Normal)
  let luxuryMugUnits = 0;
  let luxuryMugRevenue = 0;
  let normalMugUnits = 0;
  let normalMugRevenue = 0;

  const oceanItems = brandMap['Ocean Seychelles']?.items || {};
  Object.entries(oceanItems).forEach(([itemName, data]) => {
    if (itemName.toLowerCase().includes('mug')) {
      if (data.line.toLowerCase().includes('luxury') || itemName.toLowerCase().includes('luxury')) {
        luxuryMugUnits += data.qty;
        luxuryMugRevenue += data.revenue;
      } else {
        normalMugUnits += data.qty;
        normalMugRevenue += data.revenue;
      }
    }
  });

  // Ocean Seychelles T-Shirt breakdown by Target/Size
  let kidsTshirtQty = 0;
  let adultsTshirtQty = 0;
  let womenTshirtQty = 0;

  Object.entries(oceanItems).forEach(([itemName, data]) => {
    if (itemName.toLowerCase().includes('t-shirt') || itemName.toLowerCase().includes('tee')) {
      const sizeLower = (data.size + ' ' + itemName).toLowerCase();
      if (sizeLower.includes('kid') || sizeLower.includes('child')) {
        kidsTshirtQty += data.qty;
      } else if (sizeLower.includes('women') || sizeLower.includes('lady')) {
        womenTshirtQty += data.qty;
      } else {
        adultsTshirtQty += data.qty;
      }
    }
  });

  // Export CSV Report for Selected Cycle
  const handleExportCsv = () => {
    let csvStr = `Cycle Financial Performance Report (${cycle.toUpperCase()})\n`;
    csvStr += `Generated At,${new Date().toLocaleString()}\n`;
    csvStr += `Exchange Rate Used,1 ${secondaryCode} = ${primarySymbol} ${exchangeRate.toFixed(2)}\n\n`;

    csvStr += `Financial Metric,Amount in Base (${primaryCode}),Amount in Preferred (${secondaryCode})\n`;
    csvStr += `Net Sales Subtotal,${grossSales.toFixed(2)},${(grossSales / exchangeRate).toFixed(2)}\n`;
    csvStr += `VAT Tax Collected (15%),${totalVatCollected.toFixed(2)},${(totalVatCollected / exchangeRate).toFixed(2)}\n`;
    csvStr += `Grand Total Revenue (Incl. VAT),${grandTotalWithVat.toFixed(2)},${(grandTotalWithVat / exchangeRate).toFixed(2)}\n`;
    csvStr += `Wholesale Cost of Goods (COGS),${wholesaleCostOfGoods.toFixed(2)},${(wholesaleCostOfGoods / exchangeRate).toFixed(2)}\n`;
    csvStr += `Consignment Depositor Payouts,${consignmentVendorPayouts.toFixed(2)},${(consignmentVendorPayouts / exchangeRate).toFixed(2)}\n`;
    csvStr += `House Net Profit,${totalHouseProfit.toFixed(2)},${(totalHouseProfit / exchangeRate).toFixed(2)}\n\n`;

    csvStr += `Brand Performance\n`;
    csvStr += `Brand,Units Sold,Gross Revenue (${primaryCode}),Gross Revenue (${secondaryCode}),VAT Tax (${primaryCode}),VAT Tax (${secondaryCode})\n`;
    Object.entries(brandMap).forEach(([bName, data]) => {
      csvStr += `"${bName}",${data.units},${data.gross.toFixed(2)},${(data.gross / exchangeRate).toFixed(2)},${data.vat.toFixed(2)},${(data.vat / exchangeRate).toFixed(2)}\n`;
    });
    csvStr += `\n`;

    csvStr += `Category Performance\n`;
    csvStr += `Category,Units Sold,Revenue (${primaryCode}),Revenue (${secondaryCode})\n`;
    Object.entries(categorySalesMap).forEach(([catName, stats]) => {
      csvStr += `"${catName}",${stats.units},${stats.revenue.toFixed(2)},${(stats.revenue / exchangeRate).toFixed(2)}\n`;
    });

    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Seychelles_Financial_Report_${cycle}_${Date.now()}.csv`);
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
              {secondarySymbol}{(grossSales / exchangeRate).toFixed(2)} {secondaryCode}
            </div>
          )}
          <div className="text-[11px] text-slate-500 mt-0.5">
            {filteredTx.length} Completed Transactions
          </div>
        </div>

        <div className="bg-[#161B22] border border-cyan-500/40 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-cyan-300 font-semibold uppercase tracking-wider flex items-center gap-1">
            <Percent className="w-3.5 h-3.5" /> VAT Tax Collected (15%)
          </div>
          <div className="text-2xl font-black font-mono text-cyan-400 my-1">
            {primarySymbol} {totalVatCollected.toFixed(2)}
          </div>
          {settings.allowPaymentInSecondary !== false && (
            <div className="text-[11px] font-mono font-bold text-slate-400">
              {secondarySymbol}{(totalVatCollected / exchangeRate).toFixed(2)} {secondaryCode}
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
              {secondarySymbol}{(totalHouseProfit / exchangeRate).toFixed(2)} {secondaryCode}
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
              {secondarySymbol}{(grandTotalWithVat / exchangeRate).toFixed(2)} {secondaryCode}
            </div>
          )}
          <div className="text-[11px] text-slate-500 mt-0.5">Includes Net Sales + VAT</div>
        </div>
      </div>

      {/* Peak Shopping Hour Quick Highlight Banner */}
      {filteredTx.length > 0 && (
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

      {/* Brand Performance Cards Grid */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
          <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" /> Brand Performance Matrix ({cycle.toUpperCase()})
          </h3>
          <span className="text-xs text-slate-400">
            Automated tracking by brand line (Ocean Seychelles, Souvenir Boutique)
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
                        {secondarySymbol}{(data.gross / exchangeRate).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">VAT (15%)</div>
                  <div className="text-base font-bold text-cyan-400">
                    {primarySymbol} {data.vat.toFixed(2)}
                    {settings.allowPaymentInSecondary !== false && (
                      <span className="block text-[10px] text-slate-400 font-medium">
                        {secondarySymbol}{(data.vat / exchangeRate).toFixed(2)}
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

      {/* Special Variant Breakdown: Ocean Seychelles T-Shirts & Luxury vs Normal Mugs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ocean Seychelles T-Shirt Designs by Target / Size */}
        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
            <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
              <Shirt className="w-4 h-4 text-emerald-400" /> Ocean Seychelles T-Shirts Variant Matrix
            </h3>
            <span className="text-[10px] text-slate-400">9 Designs Across Targets</span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Kids T-Shirts</div>
              <div className="text-xl font-bold font-mono text-emerald-400 my-1">{kidsTshirtQty}</div>
              <div className="text-[10px] text-slate-500">Units Sold</div>
            </div>

            <div className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Women T-Shirts</div>
              <div className="text-xl font-bold font-mono text-emerald-400 my-1">{womenTshirtQty}</div>
              <div className="text-[10px] text-slate-500">Units Sold</div>
            </div>

            <div className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Adults T-Shirts</div>
              <div className="text-xl font-bold font-mono text-emerald-400 my-1">{adultsTshirtQty}</div>
              <div className="text-[10px] text-slate-500">Units Sold</div>
            </div>
          </div>
        </div>

        {/* Ocean Seychelles Mug Line Comparison (Luxury vs Normal) */}
        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
            <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
              <Coffee className="w-4 h-4 text-cyan-400" /> Ocean Seychelles Ceramic Mug Line Comparison
            </h3>
            <span className="text-[10px] text-slate-400">Luxury Line vs Normal Line</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0F1115] border border-amber-500/30 p-3 rounded-xl text-left">
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30">
                Luxury Gold Rim Line
              </span>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-2">
                {primarySymbol} {luxuryMugRevenue.toFixed(2)}
              </div>
              {settings.allowPaymentInSecondary !== false && (
                <div className="text-[10px] font-mono font-bold text-cyan-400">
                  {secondarySymbol}{(luxuryMugRevenue / exchangeRate).toFixed(2)} {secondaryCode}
                </div>
              )}
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">{luxuryMugUnits} mugs sold ({primarySymbol} 18.00/ea)</div>
            </div>

            <div className="bg-[#0F1115] border border-blue-500/30 p-3 rounded-xl text-left">
              <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/30">
                Normal Standard Line
              </span>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-2">
                {primarySymbol} {normalMugRevenue.toFixed(2)}
              </div>
              {settings.allowPaymentInSecondary !== false && (
                <div className="text-[10px] font-mono font-bold text-cyan-400">
                  {secondarySymbol}{(normalMugRevenue / exchangeRate).toFixed(2)} {secondaryCode}
                </div>
              )}
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">{normalMugUnits} mugs sold ({primarySymbol} 12.00/ea)</div>
            </div>
          </div>
        </div>
      </div>

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
                {settings.allowPaymentInSecondary !== false && ` (${secondarySymbol}${(wholesaleGrossSales / exchangeRate).toFixed(2)} ${secondaryCode})`}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Less: Wholesale Cost of Goods (COGS):</span>
              <span className="text-rose-400">
                -{primarySymbol} {wholesaleCostOfGoods.toFixed(2)}
                {settings.allowPaymentInSecondary !== false && ` (-${secondarySymbol}${(wholesaleCostOfGoods / exchangeRate).toFixed(2)} ${secondaryCode})`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-sm text-emerald-400 pt-2 border-t border-[#1E293B]">
              <span>NET WHOLESALE PROFIT:</span>
              <span>
                {primarySymbol} {wholesaleNetProfit.toFixed(2)}
                {settings.allowPaymentInSecondary !== false && ` (${secondarySymbol}${(wholesaleNetProfit / exchangeRate).toFixed(2)} ${secondaryCode})`}
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
                {settings.allowPaymentInSecondary !== false && ` (${secondarySymbol}${(consignmentGrossSales / exchangeRate).toFixed(2)} ${secondaryCode})`}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Less: Owed to Depositors (Artisans):</span>
              <span className="text-amber-400">
                -{primarySymbol} {consignmentVendorPayouts.toFixed(2)}
                {settings.allowPaymentInSecondary !== false && ` (-${secondarySymbol}${(consignmentVendorPayouts / exchangeRate).toFixed(2)} ${secondaryCode})`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-sm text-emerald-400 pt-2 border-t border-[#1E293B]">
              <span>HOUSE COMMISSION RETAINED:</span>
              <span>
                {primarySymbol} {consignmentHouseCommissions.toFixed(2)}
                {settings.allowPaymentInSecondary !== false && ` (${secondarySymbol}${(consignmentHouseCommissions / exchangeRate).toFixed(2)} ${secondaryCode})`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Performance Breakdown */}
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
                  {secondarySymbol}{(stats.revenue / exchangeRate).toFixed(2)} {secondaryCode}
                </div>
              )}
              <div className="text-[10px] text-slate-500">{stats.units} items sold</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
