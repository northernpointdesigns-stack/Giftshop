import React, { useState } from 'react';
import {
  DollarSign,
  Users,
  CheckCircle2,
  Calendar,
  FileText,
  Printer,
  ChevronRight,
  Download,
  Search,
  ListFilter,
  Tag,
  Receipt,
} from 'lucide-react';
import { Vendor, ConsignmentPayoutRecord } from '../../types/pos';
import { posDb } from '../../services/db';

interface ConsignmentPayoutReportProps {
  vendors: Vendor[];
  onRefreshData: () => void;
}

export const ConsignmentPayoutReport: React.FC<ConsignmentPayoutReportProps> = ({
  vendors,
  onRefreshData,
}) => {
  const [selectedVendorId, setSelectedVendorId] = useState<string>('All');
  const [payoutNotes, setPayoutNotes] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'statements' | 'itemized'>('statements');
  const [itemizedSearchQuery, setItemizedSearchQuery] = useState<string>('');

  // Vendor advances (money given early against future sales balance)
  const [advancingVendor, setAdvancingVendor] = useState<{ id: string; name: string } | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');

  const handleGiveAdvance = () => {
    if (!advancingVendor) return;
    const amt = parseFloat(advanceAmount);
    if (isNaN(amt) || amt <= 0) return;
    posDb.recordVendorAdvance({
      vendorId: advancingVendor.id,
      vendorName: advancingVendor.name,
      amount: Number(amt.toFixed(2)),
      note: advanceNote || 'Advance against consignment balance',
      recordedBy: 'Admin',
    });
    setAdvancingVendor(null);
    setAdvanceAmount('');
    setAdvanceNote('');
    onRefreshData();
  };

  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || '$';
;
  const primaryCode = settings.primaryCurrency || 'USD';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 1;

  const consignmentVendors = vendors.filter((v) => v.supplierType === 'consignment');
  const payoutCalculations = posDb.calculateConsignmentPayouts(
    selectedVendorId === 'All' ? undefined : selectedVendorId
  );
  const payoutHistory = posDb.getPayoutRecords();
  const allAdvances = posDb.getVendorAdvances();

  const totalPayoutOwedAll = payoutCalculations.reduce((acc, c) => acc + c.vendorPayoutOwed, 0);
  const totalGrossSalesAll = payoutCalculations.reduce((acc, c) => acc + c.totalGrossSales, 0);
  const totalHouseCommissionAll = payoutCalculations.reduce(
    (acc, c) => acc + c.houseCommission,
    0
  );

  // Extract all sold consignment items (with date, receipt #, etc.)
  const soldItemsList: any[] = [];
  posDb.getTransactions().forEach((tx) => {
    tx.items.forEach((item) => {
      // Check if it's a consignment item
      const vendor = consignmentVendors.find((v) => v.id === item.vendorId);
      if (vendor) {
        if (selectedVendorId === 'All' || item.vendorId === selectedVendorId) {
          // If search query is entered, filter it
          const matchesSearch = !itemizedSearchQuery || 
            item.name.toLowerCase().includes(itemizedSearchQuery.toLowerCase()) ||
            (item.sku && item.sku.toLowerCase().includes(itemizedSearchQuery.toLowerCase())) ||
            item.vendorName.toLowerCase().includes(itemizedSearchQuery.toLowerCase()) ||
            tx.receiptNumber.toLowerCase().includes(itemizedSearchQuery.toLowerCase());

          if (matchesSearch) {
            soldItemsList.push({
              id: `${tx.id}-${item.itemId}-${item.size || ''}-${item.variant || ''}`,
              txId: tx.id,
              receiptNumber: tx.receiptNumber,
              timestamp: tx.timestamp,
              isRefund: tx.isRefund || false,
              itemId: item.itemId,
              name: item.name,
              brand: item.brand,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              vendorId: item.vendorId,
              vendorName: item.vendorName,
              vendorPayoutAmount: item.vendorPayoutAmount,
              houseProfitAmount: item.houseProfitAmount,
              consignmentCutRate: vendor.consignmentCutRate,
            });
          }
        }
      }
    });
  });

  const handleProcessPayout = (vendorId: string, amount: number, vendorName: string) => {
    if (amount <= 0) return;

    if (
      confirm(
        `Process consignment payout of ${primarySymbol} ${amount.toFixed(2)} to ${vendorName}? This marks period payout complete.`
      )
    ) {
      posDb.recordVendorPayout(vendorId, amount, payoutNotes || 'End of Period Consignment Settlement');
      setPayoutNotes('');
      onRefreshData();
    }
  };

  // Export CSV Report
  const handleExportCsv = () => {
    if (activeSubTab === 'statements') {
      let csvStr = `Consignment Payout Report\n`;
      csvStr += `Depositor Vendor Filter,${selectedVendorId === 'All' ? 'All' : consignmentVendors.find(v => v.id === selectedVendorId)?.name || selectedVendorId}\n`;
      csvStr += `Generated At,${new Date().toLocaleString()}\n\n`;

      // 1. Individual statement summary
      csvStr += `Depositor/Vendor Statement Summary\n`;
      csvStr += `Vendor Name,Contact Name,Payout Terms,Vendor Cut Rate %,Units Sold,Gross Sales (${primaryCode}),House Retention Cut (${primaryCode}),Net Payout Owed (${primaryCode}),Net Payout Owed (${secondaryCode})\n`;
      
      payoutCalculations.forEach(({ vendor, totalUnitsSold, totalGrossSales, vendorPayoutOwed, houseCommission }) => {
        const vendorCutRatePct = ((1 - vendor.consignmentCutRate) * 100).toFixed(0);
        const owedSec = (vendorPayoutOwed / exchangeRate).toFixed(2);
        csvStr += `"${vendor.name}","${vendor.contactName}","${vendor.payoutTerms}",${vendorCutRatePct}%,${totalUnitsSold},${totalGrossSales.toFixed(2)},${houseCommission.toFixed(2)},${vendorPayoutOwed.toFixed(2)},${owedSec}\n`;
      });
      
      csvStr += `\n`;

      // 2. Settlement log (history)
      if (payoutHistory.length > 0) {
        csvStr += `Processed Consignment Payout Settlement Log\n`;
        csvStr += `Reference #,Vendor,Settlement Date,Amount Paid (${primaryCode}),Amount Paid (${secondaryCode}),Status\n`;
        payoutHistory.forEach((rec) => {
          const amtSec = (rec.payoutAmount / exchangeRate).toFixed(2);
          csvStr += `"${rec.id}","${rec.vendorName}","${new Date(rec.paidAt || rec.periodEnd).toLocaleDateString()}",${rec.payoutAmount.toFixed(2)},${amtSec},"Paid Settled"\n`;
        });
      }

      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Consignment_Payouts_Report_${selectedVendorId}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Export Fully Itemized Bookkeeping CSV
      let csvStr = `Deposited Itemized Sales Report (Bookkeeping Ledger)\n`;
      csvStr += `Depositor Vendor Filter,${selectedVendorId === 'All' ? 'All' : consignmentVendors.find(v => v.id === selectedVendorId)?.name || selectedVendorId}\n`;
      csvStr += `Generated At,${new Date().toLocaleString()}\n\n`;

      csvStr += `Date Sold,Receipt #,Depositor,Product Name,SKU,Brand,Qty,Unit Price (${primaryCode}),Gross Total (${primaryCode}),House Cut Retention Pct,House Cut (${primaryCode}),Net Vendor Owed (${primaryCode}),Net Vendor Owed (${secondaryCode}),Status\n`;

      soldItemsList.forEach((item) => {
        const owedSec = (item.vendorPayoutAmount / exchangeRate).toFixed(2);
        const cutRatePct = `${(item.consignmentCutRate * 100).toFixed(0)}%`;
        const dateStr = new Date(item.timestamp).toLocaleString();
        csvStr += `"${dateStr}","${item.receiptNumber}","${item.vendorName}","${item.name}","${item.sku || ''}","${item.brand || ''}",${item.quantity},${item.unitPrice.toFixed(2)},${item.totalPrice.toFixed(2)},${cutRatePct},${item.houseProfitAmount.toFixed(2)},${item.vendorPayoutAmount.toFixed(2)},${owedSec},"${item.isRefund ? 'Refunded' : 'Completed Sale'}"\n`;
      });

      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Itemized_Deposited_Sales_${selectedVendorId}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161B22] border border-[#1E293B] p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" /> Consignment & Deposit Payout Report
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Calculates exact cash owed to depositors vs House Cut commission retention
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
            className="bg-[#0F1115] border border-[#1E293B] text-xs text-[#E2E8F0] rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 font-bold"
          >
            <option value="All">All Depositor Vendors</option>
            {consignmentVendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleExportCsv}
            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
            title="Export summary or ledger to CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 font-medium">Total Consignment Gross Sales</div>
          <div className="text-2xl font-black font-mono text-[#E2E8F0] my-1">
            {primarySymbol} {totalGrossSalesAll.toFixed(2)}
          </div>
          {settings.allowPaymentInSecondary !== false && (
            <div className="text-[10px] text-cyan-400 font-mono font-bold">
              {secondarySymbol}{(totalGrossSalesAll / exchangeRate).toFixed(2)} {secondaryCode}
            </div>
          )}
          <div className="text-[11px] text-slate-500 mt-0.5">Gross retail value sold across depositors</div>
        </div>

        <div className="bg-[#161B22] border border-amber-500/30 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-amber-300 font-semibold">Total Cash Owed to Depositors</div>
          <div className="text-2xl font-black font-mono text-amber-400 my-1">
            {primarySymbol} {totalPayoutOwedAll.toFixed(2)}
          </div>
          {settings.allowPaymentInSecondary !== false && (
            <div className="text-[10px] text-cyan-400 font-mono font-bold">
              {secondarySymbol}{(totalPayoutOwedAll / exchangeRate).toFixed(2)} {secondaryCode}
            </div>
          )}
          <div className="text-[11px] text-amber-400/80 mt-0.5">
            Net payout payable to consignment artisans
          </div>
        </div>

        <div className="bg-[#161B22] border border-emerald-500/30 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-emerald-300 font-semibold">House Commission Retention</div>
          <div className="text-2xl font-black font-mono text-emerald-400 my-1">
            {primarySymbol} {totalHouseCommissionAll.toFixed(2)}
          </div>
          {settings.allowPaymentInSecondary !== false && (
            <div className="text-[10px] text-cyan-400 font-mono font-bold">
              {secondarySymbol}{(totalHouseCommissionAll / exchangeRate).toFixed(2)} {secondaryCode}
            </div>
          )}
          <div className="text-[11px] text-emerald-400/80 mt-0.5">
            House cut profit retained from consignment
          </div>
        </div>
      </div>

      {/* Bookkeeping Tab Toggle */}
      <div className="border-b border-[#1E293B] flex items-center gap-1">
        <button
          onClick={() => setActiveSubTab('statements')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeSubTab === 'statements'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Settlement Statements</span>
        </button>
        <button
          onClick={() => setActiveSubTab('itemized')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeSubTab === 'itemized'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Itemized Bookkeeping Ledger ({soldItemsList.length})</span>
        </button>
      </div>

      {/* RENDER ACTIVE SUBTAB CONTENT */}
      {activeSubTab === 'statements' ? (
        <div className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#E2E8F0]">
              Individual Depositor Settlement Statements
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {payoutCalculations.map(({ vendor, totalUnitsSold, totalGrossSales, vendorPayoutOwed, houseCommission }) => {
                const vendorAdvances = allAdvances.filter((a) => a.vendorId === vendor.id);
                const totalAdvanced = vendorAdvances.reduce((s, a) => s + a.amount, 0);
                const balanceAfterAdvances = Math.max(0, vendorPayoutOwed - totalAdvanced);
                return (
                <div
                  key={vendor.id}
                  className="bg-[#161B22] border border-[#1E293B] rounded-xl p-5 shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-bold text-base text-[#E2E8F0]">{vendor.name}</h4>
                        <p className="text-xs text-slate-400">
                          Contact: {vendor.contactName} • Terms: {vendor.payoutTerms}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                        {((1 - vendor.consignmentCutRate) * 100).toFixed(0)}% Vendor Cut
                      </span>
                    </div>

                    <div className="my-3 p-3 bg-[#0F1115] rounded-xl border border-[#1E293B] space-y-2 text-xs font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span>Units Sold:</span>
                        <span className="text-slate-200">{totalUnitsSold} pcs</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Total Gross Retail Sales:</span>
                        <span className="text-slate-200">
                          {primarySymbol} {totalGrossSales.toFixed(2)}
                          {settings.allowPaymentInSecondary !== false && ` (${secondarySymbol}${(totalGrossSales / exchangeRate).toFixed(2)} ${secondaryCode})`}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>House Retention Cut ({ (vendor.consignmentCutRate * 100).toFixed(0) }%):</span>
                        <span className="text-rose-400">
                          -{primarySymbol} {houseCommission.toFixed(2)}
                          {settings.allowPaymentInSecondary !== false && ` (-${secondarySymbol}${(houseCommission / exchangeRate).toFixed(2)} ${secondaryCode})`}
                        </span>
                      </div>
                      {totalAdvanced > 0 && (
                        <div className="flex justify-between text-slate-400">
                          <span>Advances Given ({vendorAdvances.length}):</span>
                          <span className="text-orange-400">-{primarySymbol} {totalAdvanced.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-sm text-amber-400 pt-2 border-t border-[#1E293B]">
                        <span>BALANCE OWED TO VENDOR:</span>
                        <span>
                          {primarySymbol} {balanceAfterAdvances.toFixed(2)}
                          {settings.allowPaymentInSecondary !== false && ` (${secondarySymbol}${(balanceAfterAdvances / exchangeRate).toFixed(2)} ${secondaryCode})`}
                        </span>
                      </div>
                    </div>

                    {vendorAdvances.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {vendorAdvances.slice(0, 3).map((a) => (
                          <div key={a.id} className="flex items-center justify-between text-[10px] text-slate-500 font-mono bg-[#0F1115] rounded-lg px-2 py-1 border border-[#1E293B]">
                            <span>{new Date(a.date).toLocaleDateString()} — {a.note}</span>
                            <span className="text-orange-300">-{primarySymbol}{a.amount.toFixed(2)}</span>
                          </div>
                        ))}
                        {vendorAdvances.length > 3 && (
                          <p className="text-[10px] text-slate-600 pl-2">+ {vendorAdvances.length - 3} earlier advance(s)</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between gap-2 mt-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => window.print()}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Statement</span>
                      </button>
                      <button
                        onClick={() => setAdvancingVendor({ id: vendor.id, name: vendor.name })}
                        className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        + Give Advance
                      </button>
                    </div>

                    <button
                      disabled={balanceAfterAdvances <= 0}
                      onClick={() => handleProcessPayout(vendor.id, balanceAfterAdvances, vendor.name)}
                      className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Settle Balance</span>
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* Give Advance Modal */}
          {advancingVendor && (
            <div className="fixed inset-0 z-50 bg-[#0F1115]/80 flex items-center justify-center p-4">
              <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-sm w-full p-6 shadow-2xl">
                <h3 className="text-base font-bold text-[#E2E8F0]">Give Advance</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Record money given now to <strong className="text-slate-200">{advancingVendor.name}</strong>. It will be deducted from their consignment balance at settlement.
                </p>
                <div className="space-y-3">
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    placeholder={`Amount (${primarySymbol})`}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    value={advanceNote}
                    onChange={(e) => setAdvanceNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-cyan-500"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setAdvancingVendor(null)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGiveAdvance}
                      disabled={!(parseFloat(advanceAmount) > 0)}
                      className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-2.5 rounded-xl text-xs transition-colors"
                    >
                      Record Advance
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payout History Log Table */}
          {payoutHistory.length > 0 && (
            <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Processed Consignment Payout Settlement Log
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#0F1115] text-slate-400 font-semibold border-b border-[#1E293B]">
                    <tr>
                      <th className="p-3">Reference #</th>
                      <th className="p-3">Vendor</th>
                      <th className="p-3">Settlement Date</th>
                      <th className="p-3 text-right">Amount Paid</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {payoutHistory.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-800/50">
                        <td className="p-3 font-mono text-slate-400">{rec.id}</td>
                        <td className="p-3 font-semibold text-[#E2E8F0]">{rec.vendorName}</td>
                        <td className="p-3 text-slate-400">
                          {new Date(rec.paidAt || rec.periodEnd).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-400">
                          {primarySymbol} {rec.payoutAmount.toFixed(2)}
                          {settings.allowPaymentInSecondary !== false && (
                            <span className="block text-[10px] text-cyan-400">
                              {secondarySymbol}{(rec.payoutAmount / exchangeRate).toFixed(2)} {secondaryCode}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                            Paid Settled
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TAB: ITEMIZED BOOKKEEPING LEDGER */
        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E293B] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#E2E8F0]">Deposited Itemized Sales Ledger</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Verifiable bookkeeping record of each item sold belonging to depositors, including dates and receipt codes.
              </p>
            </div>

            {/* Quick search */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search ledger..."
                value={itemizedSearchQuery}
                onChange={(e) => setItemizedSearchQuery(e.target.value)}
                className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {soldItemsList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <ListFilter className="w-8 h-8 mx-auto text-slate-600" />
              <div className="text-xs font-bold text-slate-400">No Consignment Sales Registered</div>
              <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                Either no transactions containing depositor/consignment goods exist yet, or your search parameters do not match any sold items.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 min-w-[800px]">
                <thead className="bg-[#0F1115] text-slate-400 font-semibold border-b border-[#1E293B]">
                  <tr>
                    <th className="p-3">Date Sold</th>
                    <th className="p-3">Receipt #</th>
                    <th className="p-3">Depositor</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-3 text-right">Retail Total</th>
                    <th className="p-3 text-right">House Retention</th>
                    <th className="p-3 text-right font-bold text-amber-300">Net Owed</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {soldItemsList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400 font-mono text-[11px]">
                        {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 text-slate-300 font-mono text-[11px]">
                        {item.receiptNumber}
                      </td>
                      <td className="p-3 font-semibold text-[#E2E8F0]">
                        {item.vendorName}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-200">{item.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                          {item.brand && <span className="bg-slate-800 px-1 py-0.2 rounded text-[9px]">{item.brand}</span>}
                          {item.sku && <span>SKU: {item.sku}</span>}
                        </div>
                      </td>
                      <td className="p-2 text-center font-mono font-bold">
                        {item.isRefund ? (
                          <span className="text-rose-400">-{Math.abs(item.quantity)}</span>
                        ) : (
                          <span className="text-slate-200">{item.quantity}</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-200">
                        {item.isRefund ? '-' : ''}{primarySymbol} {Math.abs(item.totalPrice).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-400">
                        -{primarySymbol} {Math.abs(item.houseProfitAmount).toFixed(2)}
                        <span className="block text-[9px] text-slate-500">{(item.consignmentCutRate * 100).toFixed(0)}% Cut</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-amber-400 bg-amber-500/5">
                        {item.isRefund ? '-' : ''}{primarySymbol} {Math.abs(item.vendorPayoutAmount).toFixed(2)}
                        {settings.allowPaymentInSecondary !== false && (
                          <span className="block text-[9px] text-cyan-400">
                            {secondarySymbol}{(Math.abs(item.vendorPayoutAmount) / exchangeRate).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.isRefund ? (
                          <span className="bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded text-[9px] uppercase font-bold">
                            Refund
                          </span>
                        ) : (
                          <span className="bg-[#0F1115] text-slate-400 border border-slate-700/30 px-2 py-0.5 rounded text-[9px] uppercase font-bold">
                            Sold
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
