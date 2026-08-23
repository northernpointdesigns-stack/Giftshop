import React, { useState } from 'react';
import { Users2, DollarSign, CheckCircle2, Download, Printer, ArrowRight } from 'lucide-react';
import { posDb } from '../../services/db';

export const ConsignmentPayoutReport: React.FC = () => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';

  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const vendors = posDb.getVendors();
  const summary = posDb.getConsignmentSummary();

  const handleRecordPayout = (vendorId: string, amount: number) => {
    if (amount <= 0) return;
    if (window.confirm(`Mark ${primarySymbol} ${amount.toFixed(2)} as paid to this consignment partner?`)) {
      posDb.recordVendorPayout(vendorId, amount);
      window.location.reload();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0D13] p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Users2 className="w-6 h-6 text-cyan-400" />
              <span>Consignment Artisan Payouts & Commission Settlements</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Reconcile sold items on consignment, calculate store commission cuts, and disburse partner balances
            </p>
          </div>
        </div>

        {/* Total Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#161B22] p-4 rounded-2xl border border-[#1E293B]">
            <span className="text-[11px] text-slate-400 font-bold uppercase block">
              Total Consignment Sales
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-cyan-400 mt-1">
              {primarySymbol} {summary.totalSales.toFixed(2)}
            </div>
          </div>

          <div className="bg-[#161B22] p-4 rounded-2xl border border-[#1E293B]">
            <span className="text-[11px] text-slate-400 font-bold uppercase block">
              Total Store Commission Earned
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-400 mt-1">
              {primarySymbol} {summary.totalCommission.toFixed(2)}
            </div>
          </div>

          <div className="bg-[#161B22] p-4 rounded-2xl border border-[#1E293B]">
            <span className="text-[11px] text-slate-400 font-bold uppercase block">
              Outstanding Artisan Payouts
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-400 mt-1">
              {primarySymbol} {summary.totalOwed.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Vendors Settlement Table */}
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white">Vendor Statement & Payout Queue</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0F1115] text-slate-400 uppercase text-[10px] font-bold border-b border-[#1E293B]">
                <tr>
                  <th className="p-3">Consignment Partner</th>
                  <th className="p-3 text-center">Commission Fee</th>
                  <th className="p-3">Payment Terms</th>
                  <th className="p-3 text-right">Owed Balance</th>
                  <th className="p-3 text-right">Disbursed Total</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-slate-800/40">
                    <td className="p-3">
                      <div className="font-bold text-white">{vendor.name}</div>
                      <div className="text-[11px] text-slate-400">{vendor.contactPerson}</div>
                    </td>

                    <td className="p-3 text-center">
                      <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-mono font-bold">
                        {vendor.commissionRate}%
                      </span>
                    </td>

                    <td className="p-3 text-slate-400">{vendor.paymentTerms}</td>

                    <td className="p-3 text-right font-mono font-bold text-amber-400 text-sm">
                      {primarySymbol} {(vendor.totalOwed ?? 0).toFixed(2)}
                    </td>

                    <td className="p-3 text-right font-mono text-emerald-400">
                      {primarySymbol} {(vendor.totalPaid ?? 0).toFixed(2)}
                    </td>

                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleRecordPayout(vendor.id, vendor.totalOwed ?? 0)}
                        disabled={(vendor.totalOwed ?? 0) <= 0}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs transition-all shadow-md ml-auto"
                      >
                        Settle Payout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
