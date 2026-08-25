import React, { useMemo, useState } from 'react';
import {
  Download,
  Printer,
  CalendarRange,
  BarChart3,
  Package,
  Layers,
  CreditCard,
  Receipt,
  Users,
  ClipboardCheck,
  Boxes,
} from 'lucide-react';
import { posDb } from '../../services/db';
import { Transaction, InventoryItem, Vendor } from '../../types/pos';

interface ReportDownloadsProps {
  transactions: Transaction[];
  inventory: InventoryItem[];
  vendors: Vendor[];
}

type Row = (string | number)[];

/** Escape a single CSV cell */
const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (headers: string[], rows: Row[]): string =>
  [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');

const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const stamp = () => new Date().toISOString().split('T')[0];

/** Open a clean printable table in a popup window */
const printTable = (title: string, headers: string[], rows: Row[]) => {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  const html = `<html><head><title>${title}</title>
    <style>
      body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;padding:24px;color:#111}
      h1{font-size:18px;margin:0 0 4px}
      .meta{font-size:11px;color:#555;margin-bottom:16px}
      table{border-collapse:collapse;width:100%;font-size:12px}
      th{background:#f0f0f0;text-align:left;padding:6px 8px;border:1px solid #ccc}
      td{padding:5px 8px;border:1px solid #ddd}
      tr:nth-child(even) td{background:#fafafa}
    </style></head><body>
    <h1>${title}</h1>
    <div class="meta">Generated ${new Date().toLocaleString()}</div>
    <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${String(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>
    </body></html>`;
  win.document.write(html);
  win.document.close();
};

export const ReportDownloads: React.FC<ReportDownloadsProps> = ({ transactions }) => {
  const settings = posDb.getSettings();
  const symbol = settings.primaryCurrencySymbol || 'SR';
  const code = settings.primaryCurrency || 'SCR';

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Transactions within the selected range (sales only, refunds excluded)
  const rangedTx = useMemo(
    () =>
      transactions.filter((t) => {
        const ts = new Date(t.timestamp).toISOString().split('T')[0];
        return ts >= dateFrom && ts <= dateTo && !t.isRefund;
      }),
    [transactions, dateFrom, dateTo]
  );

  const eodSessions = posDb.getEODSessions();

  // ---------------- REPORT BUILDERS ----------------

  const buildSalesByDay = (): { headers: string[]; rows: Row[]; title: string } => {
    const map = new Map<string, { count: number; subtotal: number; discount: number; vat: number; total: number }>();
    rangedTx.forEach((t) => {
      const day = new Date(t.timestamp).toISOString().split('T')[0];
      const e = map.get(day) || { count: 0, subtotal: 0, discount: 0, vat: 0, total: 0 };
      e.count += 1;
      e.subtotal += t.subtotal || 0;
      e.discount += t.discount || 0;
      e.vat += t.vatTotal || t.tax || 0;
      e.total += t.total || 0;
      map.set(day, e);
    });
    const rows: Row[] = [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, e]) => [
        day,
        e.count,
        e.subtotal.toFixed(2),
        e.discount.toFixed(2),
        e.vat.toFixed(2),
        e.total.toFixed(2),
      ]);
    rows.push([
      'TOTAL',
      rangedTx.length,
      rangedTx.reduce((a, t) => a + (t.subtotal || 0), 0).toFixed(2),
      rangedTx.reduce((a, t) => a + (t.discount || 0), 0).toFixed(2),
      rangedTx.reduce((a, t) => a + (t.vatTotal || t.tax || 0), 0).toFixed(2),
      rangedTx.reduce((a, t) => a + (t.total || 0), 0).toFixed(2),
    ]);
    return {
      title: 'Sales Summary by Day',
      headers: ['Date', 'Receipts', `Net Sales (${code})`, `Discounts (${code})`, `VAT (${code})`, `Gross Total (${code})`],
      rows,
    };
  };

  const buildSalesByItem = (): { headers: string[]; rows: Row[]; title: string } => {
    const map = new Map<string, { name: string; sku: string; cat: string; qty: number; revenue: number; vat: number }>();
    rangedTx.forEach((t) =>
      t.items.forEach((i) => {
        const key = i.itemId || i.sku;
        const e = map.get(key) || { name: i.name, sku: i.sku, cat: i.category, qty: 0, revenue: 0, vat: 0 };
        e.qty += i.quantity;
        e.revenue += i.totalPrice || 0;
        e.vat += i.vatAmount || 0;
        map.set(key, e);
      })
    );
    const rows: Row[] = [...map.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .map((e) => [e.name, e.sku, e.cat, e.qty, e.revenue.toFixed(2), e.vat.toFixed(2)]);
    return {
      title: 'Sales by Item',
      headers: ['Item', 'SKU / Barcode', 'Category', 'Qty Sold', `Revenue (${code})`, `VAT (${code})`],
      rows,
    };
  };

  const buildSalesByCategory = (): { headers: string[]; rows: Row[]; title: string } => {
    const map = new Map<string, { qty: number; revenue: number }>();
    rangedTx.forEach((t) =>
      t.items.forEach((i) => {
        const e = map.get(i.category) || { qty: 0, revenue: 0 };
        e.qty += i.quantity;
        e.revenue += i.totalPrice || 0;
        map.set(i.category, e);
      })
    );
    const rows: Row[] = [...map.entries()]
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .map(([cat, e]) => [cat, e.qty, e.revenue.toFixed(2)]);
    return { title: 'Sales by Category', headers: ['Category', 'Units Sold', `Revenue (${code})`], rows };
  };



  const buildPayments = (): { headers: string[]; rows: Row[]; title: string } => {
    const totals: Record<string, { count: number; amount: number }> = {};
    const bump = (m: string, amt: number) => {
      totals[m] = totals[m] || { count: 0, amount: 0 };
      totals[m].count += 1;
      totals[m].amount += amt;
    };
    rangedTx.forEach((t) => {
      if (t.splitPayments && t.splitPayments.length > 0) {
        t.splitPayments.forEach((p) => bump(p.method, p.amountInPrimary || 0));
      } else {
        bump(t.paymentMethod, t.total || 0);
      }
    });
    const labels: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      split: 'Split Payment',
      gift_card: 'Gift Card',
    };
    const rows: Row[] = Object.entries(totals).map(([m, e]) => [labels[m] || m, e.count, e.amount.toFixed(2)]);
    rows.push(['TOTAL', rangedTx.length, rangedTx.reduce((a, t) => a + (t.total || 0), 0).toFixed(2)]);
    return { title: 'Payments Report', headers: ['Payment Method', 'Transactions', `Amount (${code})`], rows };
  };

  const buildTaxes = (): { headers: string[]; rows: Row[]; title: string } => {
    const map = new Map<number, { net: number; vat: number }>();
    rangedTx.forEach((t) =>
      t.items.forEach((i) => {
        const rate = i.vatRate ?? settings.defaultVatRate ?? 0.15;
        const e = map.get(rate) || { net: 0, vat: 0 };
        e.net += (i.totalPrice || 0) - (i.vatAmount || 0);
        e.vat += i.vatAmount || 0;
        map.set(rate, e);
      })
    );
    const rows: Row[] = [...map.entries()].map(([rate, e]) => [
      `${(rate * 100).toFixed(1)}%`,
      e.net.toFixed(2),
      e.vat.toFixed(2),
      (e.net + e.vat).toFixed(2),
    ]);
    rows.push([
      'TOTAL',
      rangedTx.reduce((a, t) => a + (t.subtotal || 0), 0).toFixed(2),
      rangedTx.reduce((a, t) => a + (t.vatTotal || t.tax || 0), 0).toFixed(2),
      rangedTx.reduce((a, t) => a + (t.subtotal || 0) + (t.vatTotal || t.tax || 0), 0).toFixed(2),
    ]);
    return {
      title: 'Taxes (VAT) Report',
      headers: ['Tax Rate', `Net (${code})`, `VAT (${code})`, `Gross (${code})`],
      rows,
    };
  };

  const buildVendorPayouts = (): { headers: string[]; rows: Row[]; title: string } => {
    const map = new Map<string, { name: string; type: string; qty: number; gross: number; payout: number; house: number }>();
    rangedTx.forEach((t) =>
      t.items.forEach((i) => {
        const key = i.vendorId || i.vendorName;
        const e =
          map.get(key) ||
          { name: i.vendorName || 'Unknown Vendor', type: i.supplierType || '-', qty: 0, gross: 0, payout: 0, house: 0 };
        e.qty += i.quantity;
        e.gross += i.totalPrice || 0;
        e.payout += i.vendorPayoutAmount || 0;
        e.house += i.houseProfitAmount || 0;
        map.set(key, e);
      })
    );
    const rows: Row[] = [...map.values()]
      .sort((a, b) => b.gross - a.gross)
      .map((e) => [e.name, e.type, e.qty, e.gross.toFixed(2), e.payout.toFixed(2), e.house.toFixed(2)]);
    return {
      title: 'Vendor Payouts & House Cut',
      headers: ['Vendor', 'Type', 'Units Sold', `Gross Sales (${code})`, `Vendor Payout (${code})`, `House Kept (${code})`],
      rows,
    };
  };

  const buildZReadings = (): { headers: string[]; rows: Row[]; title: string } => {
    const rows: Row[] = eodSessions
      .filter((s) => s.date >= dateFrom && s.date <= dateTo)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((s) => [
        s.date,
        s.status === 'closed' ? (s.closedAt ? new Date(s.closedAt).toLocaleTimeString() : '-') : 'OPEN',
        (s.startingFloat || 0).toFixed(2),
        (s.cashSales || 0).toFixed(2),
        (s.cardSales || 0).toFixed(2),
        ((s.paidInTotal || 0) - (s.paidOutTotal || 0) - (s.cashDropTotal || 0)).toFixed(2),
        (s.expectedCash || 0).toFixed(2),
        s.actualCash !== undefined ? s.actualCash.toFixed(2) : '-',
        s.cashDifference !== undefined ? `${s.cashDifference >= 0 ? '+' : ''}${s.cashDifference.toFixed(2)}` : '-',
        s.closedBy || '-',
      ]);
    return {
      title: 'Z-Readings (Shift Close History)',
      headers: [
        'Date',
        'Closed At',
        `Float (${code})`,
        `Cash Sales (${code})`,
        `Card Sales (${code})`,
        `Adjustments (${code})`,
        `Expected (${code})`,
        `Counted (${code})`,
        `Variance (${code})`,
        'Closed By',
      ],
      rows,
    };
  };

  const buildInventory = (): { headers: string[]; rows: Row[]; title: string } => {
    const rows: Row[] = posDb.getInventory().map((i) => [
      i.sku,
      i.name,
      i.category,
      i.stockLevel,
      i.minStockThreshold,
      i.costBasis.toFixed(2),
      i.retailPrice.toFixed(2),
      (i.stockLevel * i.costBasis).toFixed(2),
      (i.stockLevel * i.retailPrice).toFixed(2),
    ]);
    return {
      title: 'Inventory / Stock on Hand',
      headers: [
        'SKU',
        'Item',
        'Category',
        'In Stock',
        'Min Level',
        `Cost (${code})`,
        `Price (${code})`,
        `Stock Value at Cost (${code})`,
        `Stock Value at Retail (${code})`,
      ],
      rows,
    };
  };

  // ---------------- UI MODEL ----------------

  const reports = [
    { id: 'by-day', icon: <BarChart3 className="w-5 h-5 text-emerald-400" />, name: 'Sales Summary by Day', desc: 'Daily receipts, discounts, VAT and gross totals', build: buildSalesByDay },
    { id: 'by-item', icon: <Package className="w-5 h-5 text-cyan-400" />, name: 'Sales by Item', desc: 'Every product: quantity sold, revenue and VAT', build: buildSalesByItem },
    { id: 'by-cat', icon: <Layers className="w-5 h-5 text-purple-400" />, name: 'Sales by Category', desc: 'Revenue grouped by product category', build: buildSalesByCategory },
    { id: 'payments', icon: <CreditCard className="w-5 h-5 text-amber-400" />, name: 'Payments Report', desc: 'Cash vs card vs split takings', build: buildPayments },
    { id: 'taxes', icon: <Receipt className="w-5 h-5 text-rose-400" />, name: 'Taxes (VAT) Report', desc: 'Net, VAT and gross per tax rate', build: buildTaxes },
    { id: 'vendors', icon: <Users className="w-5 h-5 text-blue-400" />, name: 'Vendor Payouts & House Cut', desc: 'What each vendor is owed and what the house kept', build: buildVendorPayouts },
    { id: 'z-readings', icon: <ClipboardCheck className="w-5 h-5 text-lime-400" />, name: 'Z-Readings (Shift History)', desc: 'Every drawer close: float, expected, counted, variance', build: buildZReadings },
    { id: 'inventory', icon: <Boxes className="w-5 h-5 text-orange-400" />, name: 'Inventory / Stock on Hand', desc: 'Current stock levels and valuation', build: buildInventory },
  ];

  const handleDownload = (build: () => { headers: string[]; rows: Row[]; title: string }) => {
    const { headers, rows, title } = build();
    downloadCsv(`${title.replace(/[^a-zA-Z0-9]+/g, '_')}_${stamp()}.csv`, toCsv(headers, rows));
  };

  const handlePrint = (build: () => { headers: string[]; rows: Row[]; title: string }) => {
    const { headers, rows, title } = build();
    printTable(`${title} (${dateFrom} to ${dateTo})`, headers, rows);
  };

  const setPreset = (days: number | 'all') => {
    if (days === 'all') {
      setDateFrom('2000-01-01');
      setDateTo(new Date().toISOString().split('T')[0]);
      return;
    }
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-4">
      {/* Header + date range */}
      <div className="bg-[#161B22] border border-[#1E293B] p-4 rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-emerald-400" /> Download Reports Center
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Aronium-style back-office exports — pick a period, download or print any report individually
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
            />
            <span className="text-slate-500 text-xs">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
            />
            <div className="flex bg-[#0F1115] p-1 rounded-lg border border-[#1E293B] text-[11px] font-semibold">
              <button onClick={() => setPreset(0)} className="px-2.5 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Today</button>
              <button onClick={() => setPreset(6)} className="px-2.5 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">7d</button>
              <button onClick={() => setPreset(new Date().getDate() - 1)} className="px-2.5 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">This Month</button>
              <button onClick={() => setPreset('all')} className="px-2.5 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">All Time</button>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 mt-2 font-mono">
          {rangedTx.length} sales receipt(s) in range • {symbol}{' '}
          {rangedTx.reduce((a, t) => a + (t.total || 0), 0).toFixed(2)} gross
        </p>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {reports.map((r) => (
          <div
            key={r.id}
            className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-emerald-500/40 transition-colors"
          >
            <div className="flex items-start gap-2.5">
              {r.icon}
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-[#E2E8F0]">{r.name}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{r.desc}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownload(r.build)}
                className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={() => handlePrint(r.build)}
                className="flex-1 bg-[#0F1115] hover:bg-slate-800 text-slate-300 border border-[#1E293B] px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <Printer className="w-3 h-3 text-cyan-400" /> Print
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


