import React, { useState, useMemo } from 'react';
import {
  Flame,
  Calendar,
  Clock,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  Layers,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  X,
  FileText,
  CreditCard,
  Banknote,
  Users,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Transaction, InventoryItem, Vendor } from '../../types/pos';
import { posDb } from '../../services/db';

interface SalesHeatmapProps {
  transactions: Transaction[];
  inventory: InventoryItem[];
  vendors: Vendor[];
  onRefreshData: () => void;
}

type ViewMode = 'heatmap' | 'calendar' | 'hourly' | 'dayOfWeek';
type MetricType = 'revenue' | 'transactions' | 'units' | 'avgTicket';
type TimeframeType = 'last7days' | 'last14days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'last90days' | 'allTime' | 'custom';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const SalesHeatmap: React.FC<SalesHeatmapProps> = ({
  transactions,
  inventory,
  onRefreshData,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || '$';
;
  const primaryCode = settings.primaryCurrency || 'USD';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 1;

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
  const [metric, setMetric] = useState<MetricType>('revenue');
  const [timeframe, setTimeframe] = useState<TimeframeType>('last30days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  
  // Calendar month state
  const [currentCalendarDate, setCurrentCalendarDate] = useState(() => new Date());
  
  // Hours range toggle (Trading 08:00-21:00 vs Full 24h)
  const [hoursMode, setHoursMode] = useState<'trading' | 'full'>('trading');
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  // Selected cell for detailed drawer
  const [selectedCell, setSelectedCell] = useState<{
    dayName: string;
    dayIndex: number;
    hour: number;
    formattedHour: string;
    revenue: number;
    txCount: number;
    units: number;
    avgTicket: number;
    txList: Transaction[];
  } | null>(null);

  // Selected calendar day for detailed drawer
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<{
    dateStr: string;
    displayDate: string;
    revenue: number;
    txCount: number;
    units: number;
    avgTicket: number;
    peakHour: string;
    txList: Transaction[];
  } | null>(null);

  // Generating Demo Data Toast
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const notify = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Extract unique categories and brands for filter drop-downs
  const categories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [inventory]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((i) => {
      if (i.brand) set.add(i.brand);
    });
    return Array.from(set);
  }, [inventory]);

  // Determine hours array
  const displayedHours = useMemo(() => {
    if (hoursMode === 'trading') {
      // 08:00 to 21:00 (14 hours)
      return Array.from({ length: 14 }, (_, i) => i + 8);
    }
    // 00:00 to 23:00 (24 hours)
    return Array.from({ length: 24 }, (_, i) => i);
  }, [hoursMode]);

  // Filter transactions based on active timeframe and segmentation
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    
    return transactions.filter((tx) => {
      // Filter out refunds for sales heatmap
      if (tx.isRefund) return false;

      const txDate = new Date(tx.timestamp);

      // Timeframe check
      if (timeframe === 'last7days') {
        const cutoff = new Date(now.getTime() - 7 * 86400000);
        if (txDate < cutoff) return false;
      } else if (timeframe === 'last14days') {
        const cutoff = new Date(now.getTime() - 14 * 86400000);
        if (txDate < cutoff) return false;
      } else if (timeframe === 'last30days') {
        const cutoff = new Date(now.getTime() - 30 * 86400000);
        if (txDate < cutoff) return false;
      } else if (timeframe === 'thisMonth') {
        if (txDate.getMonth() !== now.getMonth() || txDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (timeframe === 'lastMonth') {
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        if (txDate.getMonth() !== prevMonth || txDate.getFullYear() !== prevYear) {
          return false;
        }
      } else if (timeframe === 'last90days') {
        const cutoff = new Date(now.getTime() - 90 * 86400000);
        if (txDate < cutoff) return false;
      } else if (timeframe === 'custom') {
        if (customStart) {
          const start = new Date(customStart);
          start.setHours(0, 0, 0, 0);
          if (txDate < start) return false;
        }
        if (customEnd) {
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
      }

      // Payment Method Filter
      if (paymentFilter !== 'all' && tx.paymentMethod !== paymentFilter) {
        return false;
      }

      // Category / Brand filters (match if any item in transaction matches)
      if (categoryFilter !== 'all') {
        const hasCategory = tx.items.some((item) => item.category === categoryFilter);
        if (!hasCategory) return false;
      }

      if (brandFilter !== 'all') {
        const hasBrand = tx.items.some((item) => (item.brand || 'Unbranded') === brandFilter);
        if (!hasBrand) return false;
      }

      return true;
    });
  }, [transactions, timeframe, customStart, customEnd, paymentFilter, categoryFilter, brandFilter]);

  // Build the 7 Days x 24 Hours Grid Matrix
  const matrixData = useMemo(() => {
    // 7 rows (Mon=0, Tue=1, ..., Sun=6), each has 24 columns
    const grid: {
      revenue: number;
      txCount: number;
      units: number;
      txList: Transaction[];
    }[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({
        revenue: 0,
        txCount: 0,
        units: 0,
        txList: [],
      }))
    );

    filteredTransactions.forEach((tx) => {
      const date = new Date(tx.timestamp);
      // JS getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
      // Convert to Mon=0 ... Sun=6
      const jsDay = date.getDay();
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
      const hour = date.getHours();

      // If category or brand filter is active, only sum the matching items revenue/units
      let txRevenue = tx.subtotal;
      let txUnits = tx.items.reduce((sum, item) => sum + item.quantity, 0);

      if (categoryFilter !== 'all' || brandFilter !== 'all') {
        const matchingItems = tx.items.filter((item) => {
          if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
          if (brandFilter !== 'all' && (item.brand || 'Unbranded') !== brandFilter) return false;
          return true;
        });
        txRevenue = matchingItems.reduce((sum, i) => sum + i.totalPrice, 0);
        txUnits = matchingItems.reduce((sum, i) => sum + i.quantity, 0);
      }

      if (grid[dayIdx] && grid[dayIdx][hour]) {
        grid[dayIdx][hour].revenue += txRevenue;
        grid[dayIdx][hour].txCount += 1;
        grid[dayIdx][hour].units += txUnits;
        grid[dayIdx][hour].txList.push(tx);
      }
    });

    // Compute maximums for color scaling
    let maxRevenue = 0;
    let maxTransactions = 0;
    let maxUnits = 0;
    let maxAvgTicket = 0;

    let peakSlot = {
      dayIdx: 0,
      hour: 12,
      revenue: 0,
      txCount: 0,
      units: 0,
      avgTicket: 0,
    };

    grid.forEach((dayRow, dayIdx) => {
      dayRow.forEach((cell, hour) => {
        if (cell.revenue > maxRevenue) maxRevenue = cell.revenue;
        if (cell.txCount > maxTransactions) maxTransactions = cell.txCount;
        if (cell.units > maxUnits) maxUnits = cell.units;
        const avg = cell.txCount > 0 ? cell.revenue / cell.txCount : 0;
        if (avg > maxAvgTicket) maxAvgTicket = avg;

        if (cell.revenue > peakSlot.revenue) {
          peakSlot = {
            dayIdx,
            hour,
            revenue: cell.revenue,
            txCount: cell.txCount,
            units: cell.units,
            avgTicket: avg,
          };
        }
      });
    });

    // Day totals (sum along each day row)
    const dayTotals = grid.map((dayRow) => {
      const rev = dayRow.reduce((sum, c) => sum + c.revenue, 0);
      const tx = dayRow.reduce((sum, c) => sum + c.txCount, 0);
      const units = dayRow.reduce((sum, c) => sum + c.units, 0);
      return { revenue: rev, txCount: tx, units, avgTicket: tx > 0 ? rev / tx : 0 };
    });

    // Hour totals (sum along each hour column)
    const hourTotals = Array.from({ length: 24 }, (_, hour) => {
      let rev = 0;
      let tx = 0;
      let units = 0;
      grid.forEach((dayRow) => {
        rev += dayRow[hour].revenue;
        tx += dayRow[hour].txCount;
        units += dayRow[hour].units;
      });
      return { hour, revenue: rev, txCount: tx, units, avgTicket: tx > 0 ? rev / tx : 0 };
    });

    const totalRevenue = dayTotals.reduce((sum, d) => sum + d.revenue, 0);
    const totalTxCount = dayTotals.reduce((sum, d) => sum + d.txCount, 0);
    const totalUnits = dayTotals.reduce((sum, d) => sum + d.units, 0);
    const overallAvgTicket = totalTxCount > 0 ? totalRevenue / totalTxCount : 0;

    return {
      grid,
      maxRevenue,
      maxTransactions,
      maxUnits,
      maxAvgTicket,
      peakSlot,
      dayTotals,
      hourTotals,
      totalRevenue,
      totalTxCount,
      totalUnits,
      overallAvgTicket,
    };
  }, [filteredTransactions, categoryFilter, brandFilter]);

  // Overall Peak Insights Calculations
  const peakInsights = useMemo(() => {
    const { hourTotals, dayTotals, peakSlot, totalRevenue } = matrixData;

    // 1. Top Busiest Hour Overall
    const sortedHours = [...hourTotals].sort((a, b) => b.revenue - a.revenue);
    const topHour = sortedHours[0] || { hour: 14, revenue: 0, txCount: 0 };

    // 2. Top Shopping Day Overall
    let topDayIdx = 0;
    let maxDayRev = 0;
    dayTotals.forEach((d, idx) => {
      if (d.revenue > maxDayRev) {
        maxDayRev = d.revenue;
        topDayIdx = idx;
      }
    });
    const topDayName = DAYS_OF_WEEK[topDayIdx] || 'Saturday';
    const topDayShare = totalRevenue > 0 ? (maxDayRev / totalRevenue) * 100 : 0;

    // 3. Peak 3-Hour Rolling Window
    let maxWindowRev = 0;
    let peakStartHour = 13;
    for (let h = 8; h <= 20; h++) {
      const windowRev =
        (hourTotals[h]?.revenue || 0) +
        (hourTotals[h + 1]?.revenue || 0) +
        (hourTotals[h + 2]?.revenue || 0);
      if (windowRev > maxWindowRev) {
        maxWindowRev = windowRev;
        peakStartHour = h;
      }
    }
    const peakWindowStr = `${String(peakStartHour).padStart(2, '0')}:00 – ${String(
      peakStartHour + 3
    ).padStart(2, '0')}:00`;
    const peakWindowShare = totalRevenue > 0 ? (maxWindowRev / totalRevenue) * 100 : 0;

    // 4. Highest Average Ticket Hour
    const sortedByAov = [...hourTotals].filter((h) => h.txCount >= 2).sort((a, b) => b.avgTicket - a.avgTicket);
    const topAovHour = sortedByAov[0] || topHour;

    return {
      topHour,
      topDayName,
      topDayShare,
      peakWindowStr,
      peakWindowShare,
      topAovHour,
      peakSlot,
    };
  }, [matrixData]);

  // Helper to format hour string: e.g. 14 -> "14:00" or "2 PM"
  const formatHourLabel = (h: number) => {
    return `${String(h).padStart(2, '0')}:00`;
  };

  // Get cell metric value
  const getCellValue = (cell: { revenue: number; txCount: number; units: number }) => {
    if (metric === 'revenue') return cell.revenue;
    if (metric === 'transactions') return cell.txCount;
    if (metric === 'units') return cell.units;
    if (metric === 'avgTicket') return cell.txCount > 0 ? cell.revenue / cell.txCount : 0;
    return 0;
  };

  // Get Max metric value for matrix scaling
  const getMatrixMax = () => {
    if (metric === 'revenue') return matrixData.maxRevenue;
    if (metric === 'transactions') return matrixData.maxTransactions;
    if (metric === 'units') return matrixData.maxUnits;
    if (metric === 'avgTicket') return matrixData.maxAvgTicket;
    return 1;
  };

  // Get cell color intensity class
  const getCellColor = (val: number, max: number, isPeak: boolean) => {
    if (val <= 0 || max <= 0) {
      return 'bg-[#0F1115] text-slate-500 border-[#1E293B] hover:border-slate-600';
    }

    const ratio = val / max;

    if (isPeak && ratio >= 0.8) {
      return 'bg-gradient-to-br from-emerald-500 to-teal-400 text-slate-950 font-black border-amber-300 shadow-md shadow-emerald-500/20 ring-1 ring-amber-400';
    }

    if (ratio > 0.75) {
      return 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-sm';
    }
    if (ratio > 0.5) {
      return 'bg-emerald-600/85 text-white font-semibold border-emerald-500/60';
    }
    if (ratio > 0.25) {
      return 'bg-emerald-800/70 text-emerald-100 border-emerald-700/50';
    }
    return 'bg-emerald-950/60 text-emerald-300 border-emerald-900/40 hover:border-emerald-700';
  };

  // Format metric value for cell display
  const formatCellText = (val: number) => {
    if (val === 0) return '—';
    if (metric === 'revenue') {
      if (val >= 10000) return `${(val / 1000).toFixed(1)}k`;
      return Math.round(val).toString();
    }
    if (metric === 'transactions') return `${val}`;
    if (metric === 'units') return `${val}`;
    if (metric === 'avgTicket') {
      if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
      return Math.round(val).toString();
    }
    return val.toString();
  };

  // Calendar Heatmap Data (Days of selected month)
  const calendarData = useMemo(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const numDays = lastDay.getDate();
    // Monday as first day of week: Sunday=6, Mon=0, Tue=1...
    const startDayIndex = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    // Group transactions by YYYY-MM-DD
    const dayMap: Record<string, { revenue: number; txCount: number; units: number; txList: Transaction[] }> = {};

    filteredTransactions.forEach((tx) => {
      const d = new Date(tx.timestamp);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!dayMap[dateKey]) {
          dayMap[dateKey] = { revenue: 0, txCount: 0, units: 0, txList: [] };
        }
        dayMap[dateKey].revenue += tx.subtotal;
        dayMap[dateKey].txCount += 1;
        dayMap[dateKey].units += tx.items.reduce((s, i) => s + i.quantity, 0);
        dayMap[dateKey].txList.push(tx);
      }
    });

    let maxDayVal = 0;
    const days = [];

    for (let day = 1; day <= numDays; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const data = dayMap[dateKey] || { revenue: 0, txCount: 0, units: 0, txList: [] };
      const avg = data.txCount > 0 ? data.revenue / data.txCount : 0;

      let val = data.revenue;
      if (metric === 'transactions') val = data.txCount;
      if (metric === 'units') val = data.units;
      if (metric === 'avgTicket') val = avg;

      if (val > maxDayVal) maxDayVal = val;

      // Find peak hour of this day
      const hourCounts: Record<number, number> = {};
      data.txList.forEach((t) => {
        const h = new Date(t.timestamp).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + t.subtotal;
      });
      let peakH = 14;
      let peakHRev = 0;
      Object.entries(hourCounts).forEach(([h, r]) => {
        if (r > peakHRev) {
          peakHRev = r;
          peakH = Number(h);
        }
      });

      days.push({
        day,
        dateKey,
        data,
        val,
        avg,
        peakHour: data.txCount > 0 ? formatHourLabel(peakH) : '—',
      });
    }

    return {
      year,
      month,
      monthName: firstDay.toLocaleString('default', { month: 'long', year: 'numeric' }),
      startDayIndex,
      numDays,
      days,
      maxDayVal,
    };
  }, [currentCalendarDate, filteredTransactions, metric]);

  // Export Heatmap Matrix to CSV
  const handleExportCsv = () => {
    const { grid, hourTotals, dayTotals } = matrixData;
    let csv = `Sales Heatmap & Peak Shopping Hours Analysis\n`;
    csv += `Export Date,${new Date().toLocaleString()}\n`;
    csv += `Metric,${metric.toUpperCase()}\n`;
    csv += `Timeframe,${timeframe}\n`;
    csv += `Primary Currency,${primaryCode} (${primarySymbol})\n\n`;

    // Header row: Day, 08:00, 09:00 ... Total
    const hours = displayedHours;
    csv += `Day of Week,` + hours.map((h) => formatHourLabel(h)).join(',') + `,Total Revenue (${primaryCode}),Total Transactions,Avg Ticket (${primaryCode})\n`;

    // Data rows
    DAYS_OF_WEEK.forEach((dayName, dayIdx) => {
      const rowVals = hours.map((h) => {
        const cell = grid[dayIdx][h];
        if (metric === 'revenue') return cell.revenue.toFixed(2);
        if (metric === 'transactions') return cell.txCount;
        if (metric === 'units') return cell.units;
        if (metric === 'avgTicket') return (cell.txCount > 0 ? cell.revenue / cell.txCount : 0).toFixed(2);
        return 0;
      });
      const dTot = dayTotals[dayIdx];
      csv += `"${dayName}",` + rowVals.join(',') + `,${dTot.revenue.toFixed(2)},${dTot.txCount},${dTot.avgTicket.toFixed(2)}\n`;
    });

    // Summary row
    csv += `\nHourly Totals,` + hours.map((h) => hourTotals[h].revenue.toFixed(2)).join(',') + `\n`;
    csv += `Hourly Transactions,` + hours.map((h) => hourTotals[h].txCount).join(',') + `\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Sales_Heatmap_${metric}_${timeframe}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Heatmap CSV exported successfully.');
  };

  // Seed sample tourist / cruise ship transactions for realistic visualization demo
  const handleGenerateSampleData = () => {
    const existing = posDb.getInventory();
    if (existing.length === 0) {
      notify('Please add some items to inventory first before generating sample transactions.');
      return;
    }

    const cashiers = posDb.getActiveCashiers();
    const staffName = cashiers[0]?.name || 'Senior Cashier';
    const now = new Date();

    // Create 45 sample transactions across the last 14 days with authentic peak distribution
    let createdCount = 0;
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const targetDate = new Date(now.getTime() - dayOffset * 86400000);
      const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
      const isCruiseDay = targetDate.getDay() === 2 || targetDate.getDay() === 5; // Tue / Fri cruise docking

      // Number of sales on this day
      const dailyCount = isWeekend ? 5 : isCruiseDay ? 4 : 2;

      for (let s = 0; s < dailyCount; s++) {
        // Weighted hours: concentrated around 10:00 - 16:00
        let hour = 10;
        if (s % 3 === 0) hour = 14; // Peak afternoon
        else if (s % 3 === 1) hour = 11; // Morning rush
        else if (s % 3 === 2) hour = 16; // Late afternoon

        const minute = Math.floor(Math.random() * 55);
        targetDate.setHours(hour, minute, 0, 0);

        // Pick 1 to 3 items
        const item1 = existing[Math.floor(Math.random() * existing.length)];
        const item2 = existing[Math.floor(Math.random() * existing.length)];
        const qty1 = Math.floor(Math.random() * 2) + 1;
        const qty2 = item1.id !== item2.id ? 1 : 0;

        const cartItems = [
          {
            item: item1,
            quantity: qty1,
            effectivePrice: item1.retailPrice,
            isDamaged: false,
            damageDiscountPercent: 0,
          },
        ];
        if (qty2 > 0) {
          cartItems.push({
            item: item2,
            quantity: qty2,
            effectivePrice: item2.retailPrice,
            isDamaged: false,
            damageDiscountPercent: 0,
          });
        }

        const subtotal = cartItems.reduce((acc, ci) => acc + ci.item.retailPrice * ci.quantity, 0);
        const vat = subtotal * (settings.defaultVatRate ?? 0.15);
        const total = subtotal + vat;

        const sampleTxItems = cartItems.map((ci) => {
          const item = ci.item;
          const vendor = posDb.getVendorById(item.vendorId);
          const isConsignment = vendor?.supplierType === 'consignment';
          const lineTotal = item.retailPrice * ci.quantity;
          const vatRate = item.vatRate ?? (settings.defaultVatRate ?? 0.15);
          const vatAmt = Number((lineTotal * vatRate).toFixed(2));
          const costBasis = item.costBasis || 0;

          let vendorPayout = 0;
          let houseProfit = 0;

          if (isConsignment && vendor) {
            vendorPayout = lineTotal * (1 - vendor.consignmentCutRate);
            houseProfit = lineTotal * vendor.consignmentCutRate;
          } else {
            vendorPayout = costBasis * ci.quantity;
            houseProfit = lineTotal - (costBasis * ci.quantity);
          }

          return {
            itemId: item.id,
            name: item.name,
            sku: item.sku,
            brand: item.brand || vendor?.brandName || 'Unbranded',
            category: item.category,
            productLine: item.productLine || 'Unclassified Line',
            size: item.size || 'One Size',
            quantity: ci.quantity,
            unitPrice: item.retailPrice,
            totalPrice: lineTotal,
            vatRate,
            vatAmount: vatAmt,
            vendorId: item.vendorId || 'VEND-1',
            vendorName: vendor?.name || 'Unknown Vendor',
            supplierType: isConsignment ? ('consignment' as const) : ('wholesale' as const),
            costBasis,
            vendorPayoutAmount: Number(vendorPayout.toFixed(2)),
            houseProfitAmount: Number(houseProfit.toFixed(2)),
          };
        });

        const txObj: Transaction = {
          id: `TX-SAMPLE-${Date.now()}-${dayOffset}-${s}`,
          receiptNumber: `IP-${String(Date.now()).slice(-5)}-${dayOffset}${s}`,
          timestamp: targetDate.toISOString(),
          cashierName: staffName,
          subtotal: Number(subtotal.toFixed(2)),
          vatTotal: Number(vat.toFixed(2)),
          tax: Number(vat.toFixed(2)),
          discount: 0,
          total: Number(total.toFixed(2)),
          paymentMethod: s % 2 === 0 ? 'card' : 'cash',
          currencyUsed: 'primary',
          items: sampleTxItems,
        };

        posDb.addRawTransactions([txObj]);
        createdCount++;
      }
    }

    onRefreshData();
    notify(`Generated ${createdCount} realistic demo transactions across recent peak windows!`);
  };

  const matrixMax = getMatrixMax();

  return (
    <div className="space-y-4">
      {/* Toast Notice */}
      {actionNotice && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl flex items-center justify-between text-xs font-semibold animate-fadeIn shadow-lg">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {actionNotice}
          </span>
          <button onClick={() => setActionNotice(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & Visual Controls */}
      <div className="bg-[#161B22] border border-[#1E293B] p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
                  Sales Heatmap & Peak Shopping Hours
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visual traffic density across days and operating hours to optimize cashier staffing and restocking
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto">
            {/* View Mode Switcher */}
            <div className="flex bg-[#0F1115] p-1 rounded-xl border border-[#1E293B] text-xs font-semibold">
              <button
                onClick={() => setViewMode('heatmap')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'heatmap'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Weekly Day × Hour Heatmap Matrix"
              >
                <Clock className="w-3.5 h-3.5" /> Day × Hour Matrix
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'calendar'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Monthly Calendar Heatmap"
              >
                <Calendar className="w-3.5 h-3.5" /> Monthly Calendar
              </button>
              <button
                onClick={() => setViewMode('hourly')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'hourly'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Aggregate Hourly Traffic Curve"
              >
                <TrendingUp className="w-3.5 h-3.5" /> Hourly Velocity
              </button>
              <button
                onClick={() => setViewMode('dayOfWeek')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'dayOfWeek'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Day of the Week Aggregate Sales"
              >
                <Layers className="w-3.5 h-3.5" /> Day Breakdown
              </button>
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleExportCsv}
              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
              title="Download CSV report of peak shopping hours"
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

        {/* Filters and Metric Selector Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-[#1E293B]">
          {/* Metric Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Heatmap Intensity Metric
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#0F1115] p-1 rounded-xl border border-[#1E293B] text-xs font-semibold">
              <button
                onClick={() => setMetric('revenue')}
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                  metric === 'revenue' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <DollarSign className="w-3 h-3" /> Gross Sales
              </button>
              <button
                onClick={() => setMetric('transactions')}
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                  metric === 'transactions' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShoppingCart className="w-3 h-3" /> Orders Count
              </button>
              <button
                onClick={() => setMetric('units')}
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                  metric === 'units' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Package className="w-3 h-3" /> Units Sold
              </button>
              <button
                onClick={() => setMetric('avgTicket')}
                className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                  metric === 'avgTicket' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3 h-3" /> Avg Basket
              </button>
            </div>
          </div>

          {/* Timeframe Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Historical Timeframe
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as TimeframeType)}
              className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-semibold text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
            >
              <option value="last7days">Last 7 Days (Recent Week)</option>
              <option value="last14days">Last 14 Days</option>
              <option value="last30days">Last 30 Days (Recommended)</option>
              <option value="thisMonth">This Calendar Month</option>
              <option value="lastMonth">Last Calendar Month</option>
              <option value="last90days">Last Quarter (90 Days)</option>
              <option value="allTime">All Recorded History</option>
              <option value="custom">Custom Date Range...</option>
            </select>

            {timeframe === 'custom' && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-1 text-[11px] text-[#E2E8F0] w-1/2"
                />
                <span className="text-slate-500 text-xs">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-1 text-[11px] text-[#E2E8F0] w-1/2"
                />
              </div>
            )}
          </div>

          {/* Category / Brand Segmentation */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Catalog Category & Brand
            </label>
            <div className="flex gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-1/2 bg-[#0F1115] border border-[#1E293B] rounded-xl px-2.5 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 truncate"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-1/2 bg-[#0F1115] border border-[#1E293B] rounded-xl px-2.5 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 truncate"
              >
                <option value="all">All Brands</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Operating Hours Toggle & Quick Sample Seed */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Hours Window & Actions
            </label>
            <div className="flex items-center gap-2">
              <div className="flex bg-[#0F1115] p-1 rounded-xl border border-[#1E293B] text-xs font-semibold flex-1">
                <button
                  onClick={() => setHoursMode('trading')}
                  className={`flex-1 py-1 rounded-lg transition-all ${
                    hoursMode === 'trading' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Trading Store Hours (08:00 - 21:00)"
                >
                  Store (8am-9pm)
                </button>
                <button
                  onClick={() => setHoursMode('full')}
                  className={`flex-1 py-1 rounded-lg transition-all ${
                    hoursMode === 'full' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Complete 24 Hours Day (00:00 - 23:00)"
                >
                  24 Hours
                </button>
              </div>

              {filteredTransactions.length === 0 && (
                <button
                  onClick={handleGenerateSampleData}
                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow-xs"
                  title="Populate realistic tourist shopping demo patterns"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Demo Data
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Peak Analytics Insights KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Busiest Hour */}
        <div className="bg-[#161B22] border border-amber-500/40 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Busiest Shopping Hour
            </span>
            <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
              Peak Slot
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-white my-1.5">
            {formatHourLabel(peakInsights.topHour.hour)} – {formatHourLabel(peakInsights.topHour.hour + 1)}
          </div>
          <div className="text-xs text-slate-300 font-mono flex items-center justify-between">
            <span>
              {primarySymbol} {peakInsights.topHour.revenue.toFixed(2)}
            </span>
            <span className="text-slate-400 font-sans">
              {peakInsights.topHour.txCount} total orders
            </span>
          </div>
        </div>

        {/* Card 2: Peak Shopping Day */}
        <div className="bg-[#161B22] border border-emerald-500/40 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Top Weekly Day
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
              {peakInsights.topDayShare.toFixed(1)}% of Sales
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 my-1.5">
            {peakInsights.topDayName}
          </div>
          <div className="text-xs text-slate-400">
            Generates highest weekly foot traffic & revenue volume
          </div>
        </div>

        {/* Card 3: Golden 3-Hour Traffic Window */}
        <div className="bg-[#161B22] border border-cyan-500/40 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-cyan-400" /> Peak Traffic Surge
            </span>
            <span className="text-[10px] bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded font-mono font-bold">
              {peakInsights.peakWindowShare.toFixed(0)}% Volume
            </span>
          </div>
          <div className="text-xl font-black font-mono text-cyan-400 my-1.5">
            {peakInsights.peakWindowStr}
          </div>
          <div className="text-xs text-slate-400">
            Afternoon tourist & cruise arrival shopping window
          </div>
        </div>

        {/* Card 4: Highest Average Basket Size (AOV) */}
        <div className="bg-[#161B22] border border-purple-500/40 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Highest Basket (AOV)
            </span>
            <span className="text-[10px] bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded font-mono font-bold">
              {formatHourLabel(peakInsights.topAovHour.hour)}
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-purple-300 my-1.5">
            {primarySymbol} {peakInsights.topAovHour.avgTicket.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400">
            Average customer spend per transaction during this hour
          </div>
        </div>
      </div>

      {/* Staffing Advisory Banner */}
      <div className="bg-[#161B22] border border-[#1E293B] p-4 rounded-xl flex items-start gap-3 shadow-xs">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
          <Users className="w-4 h-4" />
        </div>
        <div className="text-xs space-y-1">
          <div className="font-bold text-slate-200 flex items-center gap-2">
            <span>Actionable Cashier Staffing Recommendation</span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.2 rounded font-mono">
              Live AI Analysis
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Concentration of customer transactions peaks between{' '}
            <strong className="text-amber-300 font-mono">{peakInsights.peakWindowStr}</strong>, particularly on{' '}
            <strong className="text-emerald-300">{peakInsights.topDayName}s</strong> and Fridays. To minimize checkout queue wait times, ensure at least 2 cashier stations are actively manned during this window and pre-restock top selling apparel sizes prior to 13:00.
          </p>
        </div>
      </div>

      {/* MAIN VIEW 1: WEEKLY DAY x HOUR HEATMAP MATRIX */}
      {viewMode === 'heatmap' && (
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#1E293B] gap-2">
            <div>
              <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
                <Flame className="w-4 h-4 text-emerald-400" /> Weekly Day × Hour Traffic Heatmap
              </h3>
              <p className="text-xs text-slate-400">
                Click any cell to inspect all sales transactions, items sold, and cashier details for that specific time window
              </p>
            </div>

            {/* Heatmap Legend */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 self-start sm:self-auto">
              <span className="text-[10px] uppercase font-bold tracking-wider mr-1">Intensity:</span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="w-3.5 h-3.5 rounded bg-[#0F1115] border border-[#1E293B] inline-block"></span> 0
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="w-3.5 h-3.5 rounded bg-emerald-950/70 border border-emerald-900/40 inline-block"></span> Low
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="w-3.5 h-3.5 rounded bg-emerald-800/70 border border-emerald-700/50 inline-block"></span> Med
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="w-3.5 h-3.5 rounded bg-emerald-600 border border-emerald-500 inline-block"></span> High
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="w-3.5 h-3.5 rounded bg-emerald-400 border border-emerald-300 inline-block"></span> Peak
              </span>
            </div>
          </div>

          {/* Matrix Grid Container with Horizontal Scroll */}
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[760px]">
              {/* Header Row: Hour labels */}
              <div className="grid grid-cols-[100px_repeat(14,1fr)_110px] gap-1.5 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center"
                   style={{ gridTemplateColumns: `100px repeat(${displayedHours.length}, minmax(42px, 1fr)) 110px` }}>
                <div className="text-left pl-2">Day</div>
                {displayedHours.map((h) => (
                  <div key={h} className="font-mono truncate">
                    {formatHourLabel(h)}
                  </div>
                ))}
                <div className="text-right pr-2">Day Total</div>
              </div>

              {/* Matrix Rows: Monday through Sunday */}
              <div className="space-y-1.5">
                {DAYS_OF_WEEK.map((dayName, dayIdx) => {
                  const dayRow = matrixData.grid[dayIdx];
                  const dayTot = matrixData.dayTotals[dayIdx];
                  const isTopDay = dayName === peakInsights.topDayName;

                  return (
                    <div
                      key={dayName}
                      className="grid gap-1.5 items-center"
                      style={{ gridTemplateColumns: `100px repeat(${displayedHours.length}, minmax(42px, 1fr)) 110px` }}
                    >
                      {/* Day Label */}
                      <div className="flex items-center gap-1.5 pl-2">
                        <span
                          className={`text-xs font-bold ${
                            isTopDay ? 'text-emerald-400 font-extrabold' : 'text-slate-300'
                          }`}
                        >
                          {SHORT_DAYS[dayIdx]}
                        </span>
                        {isTopDay && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Top Weekly Day" />
                        )}
                      </div>

                      {/* Hour Cells */}
                      {displayedHours.map((hour) => {
                        const cell = dayRow[hour];
                        const val = getCellValue(cell);
                        const isPeak =
                          matrixData.peakSlot.dayIdx === dayIdx && matrixData.peakSlot.hour === hour && val > 0;
                        const colorClass = getCellColor(val, matrixMax, isPeak);

                        return (
                          <button
                            key={hour}
                            type="button"
                            onClick={() => {
                              setSelectedCell({
                                dayName,
                                dayIndex: dayIdx,
                                hour,
                                formattedHour: `${formatHourLabel(hour)} – ${formatHourLabel(hour + 1)}`,
                                revenue: cell.revenue,
                                txCount: cell.txCount,
                                units: cell.units,
                                avgTicket: cell.txCount > 0 ? cell.revenue / cell.txCount : 0,
                                txList: cell.txList,
                              });
                            }}
                            className={`h-11 rounded-xl border flex flex-col items-center justify-center p-1 transition-all duration-150 relative group cursor-pointer ${colorClass}`}
                            title={`${dayName} at ${formatHourLabel(hour)}: ${
                              metric === 'revenue'
                                ? `${primarySymbol} ${cell.revenue.toFixed(2)} (${cell.txCount} orders)`
                                : `${cell.txCount} orders, ${cell.units} units`
                            }`}
                          >
                            {isPeak && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-[#161B22]" />
                            )}
                            <span className="text-[11px] font-mono font-bold leading-tight truncate w-full text-center">
                              {formatCellText(val)}
                            </span>
                            {val > 0 && metric === 'revenue' && (
                              <span className="text-[9px] opacity-75 font-mono leading-none truncate">
                                {cell.txCount}tx
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* Day Total Summary */}
                      <div className="text-right pr-2 font-mono">
                        <div className="text-xs font-bold text-[#E2E8F0]">
                          {primarySymbol} {dayTot.revenue >= 1000 ? `${(dayTot.revenue / 1000).toFixed(1)}k` : dayTot.revenue.toFixed(0)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {dayTot.txCount} orders
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Summary Row: Hourly Totals */}
              <div
                className="grid gap-1.5 items-center pt-3 mt-3 border-t border-[#1E293B]"
                style={{ gridTemplateColumns: `100px repeat(${displayedHours.length}, minmax(42px, 1fr)) 110px` }}
              >
                <div className="text-xs font-bold text-slate-400 pl-2">Hour Total</div>
                {displayedHours.map((h) => {
                  const hTot = matrixData.hourTotals[h];
                  const isTopH = peakInsights.topHour.hour === h;
                  return (
                    <div key={h} className="text-center font-mono py-1">
                      <div
                        className={`text-[11px] font-bold truncate ${
                          isTopH ? 'text-amber-400' : 'text-slate-300'
                        }`}
                      >
                        {hTot.revenue >= 1000 ? `${(hTot.revenue / 1000).toFixed(1)}k` : Math.round(hTot.revenue)}
                      </div>
                      <div className="text-[9px] text-slate-500">{hTot.txCount}tx</div>
                    </div>
                  );
                })}
                <div className="text-right pr-2 font-mono">
                  <div className="text-xs font-bold text-emerald-400">
                    {primarySymbol} {matrixData.totalRevenue.toFixed(0)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold">
                    {matrixData.totalTxCount} Total
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEW 2: MONTHLY CALENDAR HEATMAP */}
      {viewMode === 'calendar' && (
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
            <div>
              <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" /> Monthly Day-by-Day Sales Calendar
              </h3>
              <p className="text-xs text-slate-400">
                Identify which specific days of the month generated peak revenue and customer volume
              </p>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const d = new Date(currentCalendarDate);
                  d.setMonth(d.getMonth() - 1);
                  setCurrentCalendarDate(d);
                }}
                className="p-1.5 rounded-lg bg-[#0F1115] border border-[#1E293B] text-slate-400 hover:text-white"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-[#E2E8F0] font-mono px-2">
                {calendarData.monthName}
              </span>
              <button
                onClick={() => {
                  const d = new Date(currentCalendarDate);
                  d.setMonth(d.getMonth() + 1);
                  setCurrentCalendarDate(d);
                }}
                className="p-1.5 rounded-lg bg-[#0F1115] border border-[#1E293B] text-slate-400 hover:text-white"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="space-y-2">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider pb-1">
              {SHORT_DAYS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-2">
              {/* Empty leading padding days */}
              {Array.from({ length: calendarData.startDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="h-24 bg-[#0F1115]/40 rounded-xl border border-transparent" />
              ))}

              {/* Active Month Days */}
              {calendarData.days.map(({ day, dateKey, data, val, avg, peakHour }) => {
                const colorClass = getCellColor(val, calendarData.maxDayVal, val === calendarData.maxDayVal && val > 0);

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => {
                      setSelectedCalendarDay({
                        dateStr: dateKey,
                        displayDate: `${new Date(dateKey).toLocaleDateString('default', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}`,
                        revenue: data.revenue,
                        txCount: data.txCount,
                        units: data.units,
                        avgTicket: avg,
                        peakHour,
                        txList: data.txList,
                      });
                    }}
                    className={`h-24 rounded-xl border p-2 flex flex-col justify-between text-left transition-all hover:scale-[1.02] cursor-pointer ${colorClass}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold font-mono">{day}</span>
                      {data.txCount > 0 && (
                        <span className="text-[9px] font-mono opacity-80">
                          {data.txCount} orders
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      {data.revenue > 0 ? (
                        <>
                          <div className="text-xs font-bold font-mono truncate">
                            {primarySymbol} {data.revenue.toFixed(0)}
                          </div>
                          <div className="text-[9px] opacity-75 font-mono truncate">
                            Peak: {peakHour}
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] text-slate-500 italic">No sales</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEW 3: HOURLY VELOCITY DISTRIBUTION CURVE */}
      {viewMode === 'hourly' && (
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
            <div>
              <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" /> Aggregate Hourly Sales & Foot Traffic Distribution
              </h3>
              <p className="text-xs text-slate-400">
                Hourly transaction volume across all selected dates, showing morning and afternoon surge curves
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              Total {matrixData.totalTxCount} Orders / {primarySymbol} {matrixData.totalRevenue.toFixed(2)}
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {displayedHours.map((h) => {
              const hTot = matrixData.hourTotals[h];
              const maxHourRev = Math.max(...matrixData.hourTotals.map((x) => x.revenue), 1);
              const pct = (hTot.revenue / maxHourRev) * 100;
              const isPeak = peakInsights.topHour.hour === h;

              return (
                <div key={h} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className={`w-14 font-bold ${isPeak ? 'text-amber-400' : 'text-slate-300'}`}>
                        {formatHourLabel(h)}
                      </span>
                      {isPeak && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-sans font-bold">
                          ★ Peak Hour
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">{hTot.txCount} transactions</span>
                      <span className="font-bold text-emerald-400 w-24 text-right">
                        {primarySymbol} {hTot.revenue.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="h-3.5 bg-[#0F1115] rounded-full overflow-hidden border border-[#1E293B] relative">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isPeak
                          ? 'bg-gradient-to-r from-amber-500 to-emerald-400'
                          : pct > 50
                          ? 'bg-emerald-500'
                          : 'bg-emerald-700/80'
                      }`}
                      style={{ width: `${Math.max(pct, hTot.revenue > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MAIN VIEW 4: DAY OF WEEK DISTRIBUTION */}
      {viewMode === 'dayOfWeek' && (
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
            <div>
              <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" /> Day of Week Sales & Customer Volume Breakdown
              </h3>
              <p className="text-xs text-slate-400">
                Compare business performance across each day from Monday to Sunday
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              Peak Day: {peakInsights.topDayName}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {DAYS_OF_WEEK.map((dayName, dayIdx) => {
              const dTot = matrixData.dayTotals[dayIdx];
              const maxDayRev = Math.max(...matrixData.dayTotals.map((x) => x.revenue), 1);
              const pct = (dTot.revenue / maxDayRev) * 100;
              const share = matrixData.totalRevenue > 0 ? (dTot.revenue / matrixData.totalRevenue) * 100 : 0;
              const isTop = dayName === peakInsights.topDayName;

              return (
                <div
                  key={dayName}
                  className={`bg-[#0F1115] border rounded-xl p-4 space-y-3 ${
                    isTop ? 'border-emerald-500/50 ring-1 ring-emerald-500/30' : 'border-[#1E293B]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#E2E8F0]">{dayName}</span>
                      {isTop && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                          Top Sales Day
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      {share.toFixed(1)}% of sales
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Gross Sales</div>
                      <div className="text-sm font-bold text-emerald-400">
                        {primarySymbol} {dTot.revenue.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Orders</div>
                      <div className="text-sm font-bold text-cyan-400">
                        {dTot.txCount} tx
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Avg Basket</div>
                      <div className="text-sm font-bold text-purple-300">
                        {primarySymbol} {dTot.avgTicket.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Volume bar */}
                  <div className="h-2 bg-[#161B22] rounded-full overflow-hidden border border-[#1E293B]">
                    <div
                      className={`h-full rounded-full ${
                        isTop ? 'bg-emerald-400' : 'bg-emerald-600/70'
                      }`}
                      style={{ width: `${Math.max(pct, dTot.revenue > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL MODAL / DRAWER: Hourly Cell Inspection */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 bg-[#0F1115]/85 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-emerald-500/40 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1E293B] bg-[#0F1115]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {selectedCell.dayName} {selectedCell.formattedHour}
                  </h3>
                  <p className="text-[11px] text-slate-400">Time Window Detailed Transactions Breakdown</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Revenue</div>
                  <div className="text-lg font-black font-mono text-emerald-400 mt-1">
                    {primarySymbol} {selectedCell.revenue.toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Orders</div>
                  <div className="text-lg font-black font-mono text-cyan-400 mt-1">
                    {selectedCell.txCount} tx
                  </div>
                </div>
                <div className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Units Sold</div>
                  <div className="text-lg font-black font-mono text-amber-400 mt-1">
                    {selectedCell.units} items
                  </div>
                </div>
                <div className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Avg Basket</div>
                  <div className="text-lg font-black font-mono text-purple-300 mt-1">
                    {primarySymbol} {selectedCell.avgTicket.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Transactions Recorded in this Slot ({selectedCell.txList.length})
                </div>

                {selectedCell.txList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-[#0F1115] rounded-xl border border-[#1E293B]">
                    No transactions recorded during this specific hour.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {selectedCell.txList.map((tx) => (
                      <div
                        key={tx.id}
                        className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-200">
                              {tx.receiptNumber}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                              {new Date(tx.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Cashier: {tx.cashierName}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {tx.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                          </div>
                        </div>

                        <div className="text-right font-mono shrink-0">
                          <div className="font-bold text-emerald-400 text-sm">
                            {primarySymbol} {tx.total.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase">
                            {tx.paymentMethod}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1E293B] bg-[#0F1115] flex justify-end">
              <button
                onClick={() => setSelectedCell(null)}
                className="py-2 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL / DRAWER: Monthly Calendar Day Inspection */}
      {selectedCalendarDay && (
        <div className="fixed inset-0 z-50 bg-[#0F1115]/85 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-emerald-500/40 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1E293B] bg-[#0F1115]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedCalendarDay.displayDate}</h3>
                  <p className="text-[11px] text-slate-400">Daily Sales & Transactions Breakdown</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCalendarDay(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Day Revenue</div>
                  <div className="text-lg font-black font-mono text-emerald-400 mt-1">
                    {primarySymbol} {selectedCalendarDay.revenue.toFixed(2)}
                  </div>
                </div>
                <div className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Orders</div>
                  <div className="text-lg font-black font-mono text-cyan-400 mt-1">
                    {selectedCalendarDay.txCount} tx
                  </div>
                </div>
                <div className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Peak Shopping Hour</div>
                  <div className="text-lg font-black font-mono text-amber-400 mt-1">
                    {selectedCalendarDay.peakHour}
                  </div>
                </div>
                <div className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Avg Basket</div>
                  <div className="text-lg font-black font-mono text-purple-300 mt-1">
                    {primarySymbol} {selectedCalendarDay.avgTicket.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Transactions on this Date ({selectedCalendarDay.txList.length})
                </div>

                {selectedCalendarDay.txList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-[#0F1115] rounded-xl border border-[#1E293B]">
                    No transactions recorded on this date.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {selectedCalendarDay.txList.map((tx) => (
                      <div
                        key={tx.id}
                        className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-200">
                              {tx.receiptNumber}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                              {new Date(tx.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Cashier: {tx.cashierName}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {tx.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                          </div>
                        </div>

                        <div className="text-right font-mono shrink-0">
                          <div className="font-bold text-emerald-400 text-sm">
                            {primarySymbol} {tx.total.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase">
                            {tx.paymentMethod}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1E293B] bg-[#0F1115] flex justify-end">
              <button
                onClick={() => setSelectedCalendarDay(null)}
                className="py-2 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
