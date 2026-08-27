import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Users,
  Calendar,
  FileText,
  Printer,
  Download,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Search,
  ArrowRight,
} from 'lucide-react';
import { Vendor, VendorLedgerSnapshot } from '../../types/pos';
import { posDb } from '../../services/db';
import { formatMoney } from '../../utils/currencyAndMath';
import { printVendorPaymentReceipt } from '../../utils/printVendorPaymentReceipt';

interface VendorSettlementReportProps {
  vendors: Vendor[];
  onRefreshData: () => void;
}

export const VendorSettlementReport: React.FC<VendorSettlementReportProps> = ({
  vendors,
  onRefreshData,
}) => {
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 1;

  const money = (v: number) => formatMoney(v, primarySymbol, primaryCode);
  const moneySec = (v: number) => formatMoney(v, secondarySymbol, secondaryCode);

  // Build the ledger snapshot for the selected vendor (recomputed on filter
  // changes — this is a pure read over in-memory state).
  const ledger: VendorLedgerSnapshot | null = useMemo(() => {
    if (!selectedVendorId) return null;
    return posDb.getVendorLedger(
      selectedVendorId,
      dateFrom || undefined,
      dateTo || undefined
    );
  }, [selectedVendorId, dateFrom, dateTo]);

  const [searchTerm, setSearchTerm] = useState('');

  // Build a summary of all vendors for the directory/overview view
  const vendorSummaries = useMemo(() => {
    return vendors.map((v) => {
      const snap = posDb.getVendorLedger(v.id, dateFrom || undefined, dateTo || undefined);
      
      // Find last payout date
      let lastPayoutDate = '—';
      if (snap.settlements && snap.settlements.length > 0) {
        const sorted = [...snap.settlements].sort((a, b) => {
          const tA = a.paidAt ? Date.parse(a.paidAt) : 0;
          const tB = b.paidAt ? Date.parse(b.paidAt) : 0;
          return tB - tA;
        });
        if (sorted[0]?.paidAt) {
          lastPayoutDate = new Date(sorted[0].paidAt).toLocaleDateString();
        }
      }

      return {
        vendor: v,
        snapshot: snap,
        lastPayoutDate,
      };
    });
  }, [vendors, dateFrom, dateTo]);

  // Grand totals across all vendors
  const grandTotals = useMemo(() => {
    let totalOwed = 0;
    let totalPaid = 0;
    let totalAdvances = 0;
    let totalUnits = 0;

    vendorSummaries.forEach(({ snapshot }) => {
      totalOwed += snapshot.netOwing;
      totalPaid += snapshot.settledTotal;
      totalAdvances += snapshot.advanceTotal;
      totalUnits += snapshot.periodSales.totalUnits;
    });

    return {
      totalOwed,
      totalPaid,
      totalAdvances,
      totalUnits,
    };
  }, [vendorSummaries]);

  // Filtered summaries based on searchTerm
  const filteredSummaries = useMemo(() => {
    if (!searchTerm.trim()) return vendorSummaries;
    const term = searchTerm.toLowerCase().trim();
    return vendorSummaries.filter(
      (s) =>
        s.vendor.name.toLowerCase().includes(term) ||
        (s.vendor.brandName && s.vendor.brandName.toLowerCase().includes(term))
    );
  }, [vendorSummaries, searchTerm]);

  const handleMarkPaid = (snap: VendorLedgerSnapshot) => {
    if (!snap.vendor || snap.periodSales.vendorPayout <= 0) return;
    if (
      confirm(
        `Mark ${snap.vendor.name}'s period settlement of ${money(
          snap.periodSales.vendorPayout
        )} as paid?\n\nThis records a payout entry and zeroes the outstanding balance for the selected period.`
      )
    ) {
      posDb.recordVendorPayout(
        snap.vendor.id,
        snap.periodSales.vendorPayout,
        `Period settlement ${dateFrom ? `from ${dateFrom}` : ''} ${dateTo ? `to ${dateTo}` : ''}`
      );
      onRefreshData();
    }
  };

  const handleExportCsv = () => {
    if (!ledger || !ledger.vendor) return;
    const rows: string[] = [];
    rows.push('Vendor Settlement Ledger');
    rows.push(`Vendor,${ledger.vendor.name}`);
    rows.push(`Supplier Type,${ledger.vendor.supplierType}`);
    rows.push(`Period,${dateFrom || 'all-time'} to ${dateTo || 'all-time'}`);
    rows.push(`Generated At,${new Date().toLocaleString()}`);
    rows.push('');
    rows.push('Itemized Ledger');
    rows.push(
      'Date Sold,Receipt #,Product,SKU,Qty,Unit Price,Gross Total,VAT,House Cut,Vendor Payout,Status'
    );
    ledger.transactions.forEach((l) => {
      rows.push(
        [
          new Date(l.timestamp).toLocaleString(),
          l.receiptNumber,
          `"${l.name}"`,
          l.sku,
          l.quantity,
          l.unitPrice.toFixed(2),
          l.totalPrice.toFixed(2),
          l.vatAmount.toFixed(2),
          l.houseCut.toFixed(2),
          l.vendorPayout.toFixed(2),
          l.isRefund ? 'Refunded' : 'Sale',
        ].join(',')
      );
    });
    rows.push('');
    rows.push('Period Summary');
    rows.push(`Units Sold,${ledger.periodSales.totalUnits}`);
    rows.push(`Gross Sales,${money(ledger.periodSales.grossSales)}`);
    rows.push(`VAT,${money(ledger.periodSales.vat)}`);
    rows.push(`House Cut,${money(ledger.periodSales.houseCut)}`);
    rows.push(`Vendor Payout,${money(ledger.periodSales.vendorPayout)}`);
    rows.push('');
    rows.push('Settlement Movement');
    rows.push(`Advances Received,${money(ledger.advanceTotal)}`);
    rows.push(`Prior Settlements,${money(ledger.settledTotal)}`);
    rows.push(`Net Owing,${money(ledger.netOwing)}`);

    const csvStr = rows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Vendor_Ledger_${ledger.vendor.name}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
        document.body.removeChild(link);
  };

  const renderDashboardCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
        <div className="text-xs text-slate-400 font-medium">Total Balance Owed</div>
        <div className="text-2xl font-black font-mono text-amber-400 my-1">{money(grandTotals.totalOwed)}</div>
        <p className="text-[10px] text-slate-500">Unsettled vendor payout balance</p>
      </div>
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
        <div className="text-xs text-slate-400 font-medium">Total Settlements Paid</div>
        <div className="text-2xl font-black font-mono text-emerald-400 my-1">{money(grandTotals.totalPaid)}</div>
        <p className="text-[10px] text-slate-500">Disbursed payouts</p>
      </div>
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
        <div className="text-xs text-slate-400 font-medium">Total Advances Issued</div>
        <div className="text-2xl font-black font-mono text-sky-400 my-1">{money(grandTotals.totalAdvances)}</div>
        <p className="text-[10px] text-slate-500">Deducted on settlement</p>
      </div>
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
        <div className="text-xs text-slate-400 font-medium">Total Sales Volume</div>
        <div className="text-2xl font-black font-mono text-indigo-400 my-1">{grandTotals.totalUnits} <span className="text-xs text-slate-500 font-normal">units</span></div>
        <p className="text-[10px] text-slate-500">Items sold</p>
      </div>
    </div>
  );
  const renderDashboardTable = () => (
    <div className="bg-[#161B22] border border-[#1E293B] rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#E2E8F0]">All Vendors Directory & Balance Audit</h3>
          <p className="text-xs text-slate-400 mt-0.5">Dynamic balance sheets updated automatically.</p>
        </div>
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search vendor or brand..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#0F1115] border border-[#1E293B] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 w-full"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[#E2E8F0]">
          <thead className="bg-[#0F1115] text-slate-500 uppercase text-[10px] font-black border-b border-[#1E293B]">
            <tr>
              <th className="p-3">Vendor</th>
              <th className="p-3">Model</th>
              <th className="p-3 text-right">Units</th>
              <th className="p-3 text-right">Gross Sales</th>
              <th className="p-3 text-right">Advances</th>
              <th className="p-3 text-right">Paid</th>
              <th className="p-3 text-right">Net Owing</th>
              <th className="p-3">Last Paid</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {filteredSummaries.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold">No vendors found</p>
                </td>
              </tr>
            ) : (
              filteredSummaries.map(({ vendor: v, snapshot: snap, lastPayoutDate }) => (
                <tr key={v.id} className="hover:bg-slate-800/20 transition-all">
                  <td className="p-3">
                    <div className="font-bold text-slate-200">{v.name}</div>
                    {v.brandName && <div className="text-[10px] text-slate-400">Brand: {v.brandName}</div>}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${snap.isWholesale ? 'bg-cyan-500/10 text-cyan-300' : 'bg-amber-500/10 text-amber-300'}`}>{snap.isWholesale ? 'Wholesale' : 'Consignment'}</span>
                  </td>
                  <td className="p-3 text-right font-mono text-slate-300">{snap.periodSales.totalUnits}</td>
                  <td className="p-3 text-right font-mono text-slate-300">{money(snap.periodSales.grossSales)}</td>
                  <td className="p-3 text-right font-mono text-sky-300">{money(snap.advanceTotal)}</td>
                  <td className="p-3 text-right font-mono text-emerald-300">{money(snap.settledTotal)}</td>
                  <td className="p-3 text-right font-mono font-bold"><span className={snap.netOwing > 0 ? 'text-amber-400' : 'text-slate-400'}>{money(snap.netOwing)}</span></td>
                  <td className="p-3 text-slate-400 whitespace-nowrap">{lastPayoutDate}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button type="button" onClick={() => setSelectedVendorId(v.id)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition-all">
                        <span>View Ledger</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => printVendorPaymentReceipt(snap, settings)} className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors" title="Print Audit Statement">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );


  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161B22] border border-[#1E293B] p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" /> Vendor Settlement Ledger
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Per-vendor traceability from deposit through sale to settlement — for
            both consignment depositors and wholesale suppliers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={!ledger}
            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-40"
            title="Export ledger to CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              if (ledger) {
                printVendorPaymentReceipt(ledger, settings);
              }
            }}
            disabled={!ledger}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40"
            title="Print Full Vendor Audit Statement"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* Vendor + Date Controls */}
      <div className="flex flex-wrap items-end gap-3 bg-[#161B22] border border-[#1E293B] p-4 rounded-xl">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-slate-400 font-medium mb-1 block">Vendor</label>
          <select
            value={selectedVendorId}
            onChange={(e) => {
              setSelectedVendorId(e.target.value);
            }}
            className="bg-[#0F1115] border border-[#1E293B] text-xs text-[#E2E8F0] rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 w-full"
          >
            <option value="">Select a vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.supplierType})
              </option>
            ))}
          </select>
        </div>

        <div className="relative min-w-[130px]">
          <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-[#0F1115] border border-[#1E293B] rounded-xl pl-9 pr-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 w-full"
            placeholder="From"
          />
        </div>

        <div className="relative min-w-[130px]">
          <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-[#0F1115] border border-[#1E293B] rounded-xl pl-9 pr-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 w-full"
            placeholder="To"
          />
        </div>

        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
            className="text-xs text-slate-400 hover:text-white px-2 py-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* All-vendors directory dashboard when no single vendor selected */}
      {!ledger && (
        <div className="space-y-6">
          {renderDashboardCards()}
          {renderDashboardTable()}
        </div>
      )}

      {ledger && ledger.vendor && (
        <div className="space-y-4">
          {/* Vendor Header */}
          <div className="flex items-start justify-between gap-3 bg-[#161B22] border border-[#1E293B] rounded-xl p-4">
            <div>
              <h3 className="font-bold text-base text-[#E2E8F0]">{ledger.vendor.name}</h3>
              <p className="text-xs text-slate-400">
                Contact: {ledger.vendor.contactName} • Terms: {ledger.vendor.payoutTerms}
              </p>
              <p className="text-xs text-slate-400">
                Supplier type: {ledger.vendor.supplierType === 'consignment' ? 'Consignment (split rate applies)' : 'Wholesale (cost + margin)'}
              </p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg font-mono ${
                ledger.isWholesale
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
              }`}
            >
              {ledger.isWholesale ? 'Wholesale' : 'Consignment'}
            </span>
          </div>

          {/* Period Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
              <div className="text-xs text-slate-400 font-medium">Units Sold</div>
              <div className="text-2xl font-black font-mono text-[#E2E8F0] my-1">
                {ledger.periodSales.totalUnits}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Net of refunds</div>
            </div>

            <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
              <div className="text-xs text-slate-400 font-medium">Gross Sales</div>
              <div className="text-2xl font-black font-mono text-[#E2E8F0] my-1">
                {money(ledger.periodSales.grossSales)}
              </div>
              {settings.allowPaymentInSecondary !== false && (
                <div className="text-[11px] font-mono font-bold text-cyan-400">
                  {moneySec(ledger.periodSales.grossSales / exchangeRate)}
                </div>
              )}
              <div className="text-[11px] text-slate-500 mt-0.5">Including VAT</div>
            </div>

            <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
              <div className="text-xs text-slate-400 font-medium">House Cut</div>
              <div className="text-2xl font-black font-mono text-emerald-400 my-1">
                {money(ledger.periodSales.houseCut)}
              </div>
              {settings.allowPaymentInSecondary !== false && (
                <div className="text-[11px] font-mono font-bold text-cyan-400">
                  {moneySec(ledger.periodSales.houseCut / exchangeRate)}
                </div>
              )}
              <div className="text-[11px] text-emerald-400/80 mt-0.5">
                {ledger.isWholesale ? 'House profit (cost deducted)' : 'House retainment'}
              </div>
            </div>

            <div className="bg-[#161B22] border border-amber-500/30 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-amber-300 font-semibold">Net Owing</div>
              <div className="text-2xl font-black font-mono text-amber-400 my-1">
                {money(ledger.netOwing)}
              </div>
              {settings.allowPaymentInSecondary !== false && (
                <div className="text-[11px] font-mono font-bold text-cyan-400">
                  {moneySec(ledger.netOwing / exchangeRate)}
                </div>
              )}
              <div className="text-[11px] text-amber-400/80 mt-0.5">
                {money(ledger.periodSales.vendorPayout)} owed −
                {money(ledger.advanceTotal)} advances − {money(ledger.settledTotal)} settled
              </div>
                        </div>
          </div>

          {/* Settlement Movement */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3">
              <div className="text-xs text-slate-500">Advances to Vendor</div>
              <div className="text-right">
                <span className="font-mono text-sky-300">{money(ledger.advanceTotal)}</span>
                {ledger.advances.length > 0 && (
                  <span className="ml-2 text-xs text-slate-500 font-mono">
                    ({ledger.advances.length} record{ledger.advances.length > 1 ? 's' : ''})
                  </span>
                )}
              </div>
            </div>

            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3">
              <div className="text-xs text-slate-500">Prior Settlements</div>
              <div className="text-right">
                <span className="font-mono text-indigo-300">{money(ledger.settledTotal)}</span>
                {ledger.settlements.length > 0 && (
                  <span className="ml-2 text-xs text-slate-500 font-mono">
                    ({ledger.settlements.length} record{ledger.settlements.length > 1 ? 's' : ''})
                  </span>
                )}
              </div>
            </div>

            <div className="bg-[#161B22] border border-amber-500/30 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-amber-300 font-semibold">Action</div>
                <div className="text-xs text-slate-500">
                  Record payout to settle this period.
                </div>
              </div>
              <button
                onClick={() => handleMarkPaid(ledger)}
                disabled={ledger.periodSales.vendorPayout <= 0}
                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-40"
                title="Mark this period's payout as paid"
              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Mark Paid
              </button>
            </div>
          </div>

          {/* Itemized Ledger Table */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#E2E8F0]">
                <thead className="bg-[#0F1115] text-slate-400 uppercase text-[10px] font-black border-b border-[#1E293B]">
                  <tr>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Receipt #</th>
                    <th className="p-3">Product</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Unit</th>
                    <th className="p-3 text-right">Gross</th>
                    <th className="p-3 text-right">VAT</th>
                    <th className="p-3 text-right">House Cut</th>
                    <th className="p-3 text-right">Vendor Payout</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {ledger.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold">
                          No sales for this vendor in the selected period.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    ledger.transactions.map((l) => (
                      <tr
                        key={`${l.txId}-${l.sku}`}
                        className={l.isRefund ? 'bg-rose-900/10' : ''}
                      >
                        <td className="p-3 whitespace-nowrap text-slate-300">
                          {new Date(l.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3 font-mono">{l.receiptNumber}</td>
                        <td className="p-3">{l.name}</td>
                        <td className="p-3 font-mono text-slate-400">{l.sku}</td>
                        <td className={`p-3 text-right font-mono ${l.isRefund ? 'text-rose-300' : ''}`}>
                          {l.quantity}
                        </td>
                        <td className="p-3 text-right font-mono">{money(l.unitPrice)}</td>
                        <td className="p-3 text-right font-mono">{money(l.totalPrice)}</td>
                        <td className="p-3 text-right font-mono text-cyan-300">{money(l.vatAmount)}</td>
                        <td className="p-3 text-right font-mono">{money(l.houseCut)}</td>
                        <td className="p-3 text-right font-mono text-emerald-300">{money(l.vendorPayout)}</td>
                        <td className="p-3">
                          {l.isRefund ? (
                            <span className="inline-flex items-center gap-1 text-rose-300">
                              <AlertCircle className="w-3 h-3" /> Refund
                            </span>
                          ) : (
                            'Sale'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                                </tbody>
              </table>
            </div>
          </div>

          {/* Advances & Settlements history (when present) */}
          {ledger.advances.length > 0 && (
            <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
              <h4 className="text-sm font-bold text-sky-300 mb-2 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Advances Recorded
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#E2E8F0]">
                  <thead className="bg-[#0F1115] text-slate-500 uppercase text-[10px] font-black border-b border-[#1E293B]">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Reference</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2">Note</th>
                      <th className="p-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {ledger.advances.map((a) => (
                      <tr key={a.id}>
                        <td className="p-2 whitespace-nowrap text-slate-300">
                          {new Date(a.date).toLocaleDateString()}
                        </td>
                        <td className="p-2 font-mono">{a.id}</td>
                        <td className="p-2 text-right font-mono">{money(a.amount)}</td>
                        <td className="p-2 text-slate-400">{a.note || '—'}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => printVendorPaymentReceipt(ledger, settings, { advanceRecord: a })}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-semibold transition-all"
                            title="Print Advance Voucher"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Voucher</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ledger.settlements.length > 0 && (
            <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
              <h4 className="text-sm font-bold text-indigo-300 mb-2 flex items-center gap-1.5">
                <Receipt className="w-4 h-4" /> Settlement History
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#E2E8F0]">
                  <thead className="bg-[#0F1115] text-slate-500 uppercase text-[10px] font-black border-b border-[#1E293B]">
                    <tr>
                      <th className="p-2">Reference</th>
                      <th className="p-2">Paid At</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2">Notes</th>
                      <th className="p-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {ledger.settlements.map((s) => (
                      <tr key={s.id}>
                        <td className="p-2 font-mono">{s.id}</td>
                        <td className="p-2 whitespace-nowrap text-slate-300">
                          {s.paidAt ? new Date(s.paidAt).toLocaleString() : '—'}
                        </td>
                        <td className="p-2 text-right font-mono">{money(s.payoutAmount)}</td>
                        <td className="p-2 text-slate-400">{s.notes || '—'}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => printVendorPaymentReceipt(ledger, settings, { settlementRecord: s })}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold transition-all"
                            title="Print Payment Settlement Receipt"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};







