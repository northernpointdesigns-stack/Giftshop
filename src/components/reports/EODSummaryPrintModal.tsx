import React from 'react';
import { Printer, X, FileCheck2, ShieldCheck, Banknote } from 'lucide-react';
import { EODSession } from '../../types/pos';
import { posDb } from '../../services/db';

interface EODSummaryPrintModalProps {
  session: EODSession;
  isOpen: boolean;
  onClose: () => void;
}

export const EODSummaryPrintModal: React.FC<EODSummaryPrintModalProps> = ({
  session,
  isOpen,
  onClose,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isBalanced = Math.abs(session.cashDiscrepancy) < 0.5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 my-auto">
        {/* Header */}
        <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">EOD Z-Report Summary Print</h2>
              <p className="text-[11px] text-slate-400">Shift #{session.id.slice(-8)} Reconciliation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button */}
        <div className="bg-[#0F1115]/50 border-b border-[#1E293B] p-3 flex justify-end gap-2 no-print">
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Z-Report Thermal (Ctrl+P)</span>
          </button>
        </div>

        {/* Thermal Print View */}
        <div className="p-6 bg-slate-900 flex justify-center max-h-[65vh] overflow-y-auto">
          <div
            className="bg-white text-black p-6 rounded-lg shadow-xl font-mono text-xs w-full max-w-[340px] select-text"
            style={{ fontFamily: "'JetBrains Mono', Courier, monospace" }}
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-slate-400 space-y-1">
              <h3 className="font-extrabold text-sm uppercase">{settings.storeName}</h3>
              <p className="text-[10px] text-slate-600">{settings.storeAddress}</p>
              <div className="bg-black text-white py-1 px-2 font-bold text-xs uppercase tracking-wider mt-2 rounded">
                *** END OF DAY Z-REPORT ***
              </div>
            </div>

            {/* Session Info */}
            <div className="py-2.5 text-[10px] space-y-1 border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span>Shift ID:</span>
                <span className="font-bold">{session.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{session.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Opened At:</span>
                <span>{new Date(session.openedAt).toLocaleString()}</span>
              </div>
              {session.closedAt && (
                <div className="flex justify-between">
                  <span>Closed At:</span>
                  <span>{new Date(session.closedAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Sales Volume */}
            <div className="py-3 text-xs space-y-1 border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span>Total Transactions:</span>
                <span className="font-bold">{session.totalTransactions}</span>
              </div>
              <div className="flex justify-between font-bold text-sm">
                <span>Gross Sales:</span>
                <span>{primarySymbol} {session.totalSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-700">
                <span>- Card / Digital:</span>
                <span>{primarySymbol} {session.totalCardSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-700">
                <span>- Cash Sales:</span>
                <span>{primarySymbol} {session.totalCashSales.toFixed(2)}</span>
              </div>
              {session.totalRefunds > 0 && (
                <div className="flex justify-between text-[11px] text-rose-700">
                  <span>- Customer Returns:</span>
                  <span>-{primarySymbol} {session.totalRefunds.toFixed(2)}</span>
                </div>
              )}
              {session.totalVoids > 0 && (
                <div className="flex justify-between text-[11px] text-rose-700">
                  <span>- Voided Sales ({session.voidCount}):</span>
                  <span>-{primarySymbol} {session.totalVoids.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Cash Drawer Reconciliation */}
            <div className="py-3 text-xs space-y-1 border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span>Opening Float:</span>
                <span>{primarySymbol} {session.openingFloat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Expected Drawer Cash:</span>
                <span>{primarySymbol} {session.expectedCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Actual Counted Cash:</span>
                <span>{primarySymbol} {session.actualCountedCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold pt-1 border-t border-slate-300">
                <span>Over / Short Discrepancy:</span>
                <span
                  className={
                    isBalanced
                      ? 'text-emerald-700'
                      : session.cashDiscrepancy > 0
                      ? 'text-cyan-700'
                      : 'text-rose-700'
                  }
                >
                  {session.cashDiscrepancy > 0 ? '+' : ''}
                  {primarySymbol} {session.cashDiscrepancy.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Audit Signature */}
            <div className="pt-4 text-center space-y-3">
              <p className="text-[10px] text-slate-600">
                Verified and submitted by: {session.cashierName}
              </p>
              <div className="border-t border-slate-400 pt-1 text-[9px] text-slate-500">
                Cashier Signature: _______________________
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
