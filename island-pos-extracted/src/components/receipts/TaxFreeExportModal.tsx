import React, { useState } from 'react';
import { X, Plane, FileText, Printer, CheckCircle2, ShieldCheck, DollarSign, Award } from 'lucide-react';
import { TaxFreeDetails, Transaction } from '../../types/pos';
import { posDb } from '../../services/db';
import { printStandardInvoice } from '../../utils/printStandardInvoice';
import { printThermalReceipt } from '../../utils/printThermalReceipt';

interface TaxFreeExportModalProps {
  transaction: Transaction;
  onClose: () => void;
  onUpdateTransaction?: (updatedTx: Transaction) => void;
}

const TOURIST_COUNTRIES = [
  'Germany',
  'United Kingdom',
  'France',
  'Italy',
  'Switzerland',
  'Austria',
  'United Arab Emirates',
  'South Africa',
  'United States',
  'Russia',
  'Israel',
  'India',
  'China',
  'Australia',
  'Reunion / France',
  'Mauritius',
  'Other International',
];

export const TaxFreeExportModal: React.FC<TaxFreeExportModalProps> = ({
  transaction,
  onClose,
  onUpdateTransaction,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';

  const existing = transaction.taxFreeDetails;

  const [travelerName, setTravelerName] = useState(
    existing?.travelerName || transaction.customerName || ''
  );
  const [passportNumber, setPassportNumber] = useState(
    existing?.passportNumber || ''
  );
  const [passportCountry, setPassportCountry] = useState(
    existing?.passportCountry || 'France'
  );
  const [flightNumber, setFlightNumber] = useState(
    existing?.flightNumber || 'EK706 (Emirates)'
  );
  const [departureDate, setDepartureDate] = useState(
    existing?.departureDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  );
  const [refundMethod, setRefundMethod] = useState<'credit_card' | 'airport_cash' | 'bank_transfer'>(
    existing?.refundMethod || 'credit_card'
  );
  const [adminFeePercent, setAdminFeePercent] = useState<number>(10); // 10% admin processing fee

  // VAT calculations
  const totalGross = transaction.total;
  const totalVat = transaction.vatTotal || transaction.tax || totalGross * 0.15;
  const adminFeeAmount = Number((totalVat * (adminFeePercent / 100)).toFixed(2));
  const netRefundAmount = Number((totalVat - adminFeeAmount).toFixed(2));

  const buildTaxFreeObject = (): TaxFreeDetails => {
    const certRef = existing?.certificateRef || `TF-${transaction.receiptNumber.replace(/^[A-Z]+-?/, '')}`;
    return {
      certificateRef: certRef,
      travelerName: travelerName.trim() || 'Valued Tourist',
      passportNumber: passportNumber.trim() || 'N/A',
      passportCountry,
      flightNumber: flightNumber.trim() || undefined,
      departureDate: departureDate || undefined,
      refundMethod,
      adminFeeAmount,
      netRefundAmount,
      issuedAt: new Date().toISOString(),
    };
  };

  const handleSaveAndPrintA4 = () => {
    const details = buildTaxFreeObject();
    const updatedTx: Transaction = {
      ...transaction,
      taxFreeDetails: details,
    };

    posDb.updateTransaction(updatedTx);
    if (onUpdateTransaction) onUpdateTransaction(updatedTx);

    printStandardInvoice(updatedTx, settings, { isTaxFreeExport: true });
  };

  const handleSaveAndPrintThermal = () => {
    const details = buildTaxFreeObject();
    const updatedTx: Transaction = {
      ...transaction,
      taxFreeDetails: details,
    };

    posDb.updateTransaction(updatedTx);
    if (onUpdateTransaction) onUpdateTransaction(updatedTx);

    printThermalReceipt(updatedTx, settings, settings.thermalReceiptWidth || '80mm', { isTaxFreeExport: true });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-xl w-full p-6 text-[#E2E8F0] shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Tourist VAT Tax-Free Export Certificate
              </h3>
              <p className="text-xs text-slate-400">
                Official customs tax relief documentation for international travelers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Inputs */}
        <div className="py-4 space-y-4">
          {/* Tax Relief Summary Box */}
          <div className="bg-[#0F1115] border border-blue-500/30 rounded-xl p-3.5 space-y-2">
            <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center justify-between">
              <span>VAT Tax Refund Calculation</span>
              <span className="font-mono text-slate-400">TIN: {settings.taxRegistrationNumber || 'SR-VAT-100293'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-[#161B22] p-2 rounded-lg border border-[#1E293B]">
                <div className="text-[10px] text-slate-400">Gross Export Sale</div>
                <div className="font-mono font-bold text-white mt-0.5">
                  {primarySymbol} {totalGross.toFixed(2)}
                </div>
              </div>
              <div className="bg-[#161B22] p-2 rounded-lg border border-[#1E293B]">
                <div className="text-[10px] text-slate-400">15% Included VAT</div>
                <div className="font-mono font-bold text-cyan-400 mt-0.5">
                  {primarySymbol} {totalVat.toFixed(2)}
                </div>
              </div>
              <div className="bg-[#161B22] p-2 rounded-lg border border-emerald-500/30">
                <div className="text-[10px] text-emerald-400 font-bold">Net Tourist Refund</div>
                <div className="font-mono font-bold text-emerald-300 text-sm mt-0.5">
                  {primarySymbol} {netRefundAmount.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Traveler Details Form */}
          <div className="space-y-3 bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl">
            <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>International Traveler Passport &amp; Departure Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                  Traveler Full Name *
                </label>
                <input
                  type="text"
                  value={travelerName}
                  onChange={(e) => setTravelerName(e.target.value)}
                  placeholder="As written on passport"
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                  Passport Number *
                </label>
                <input
                  type="text"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  placeholder="e.g. N12345678"
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                  Passport Issuing Country *
                </label>
                <select
                  value={passportCountry}
                  onChange={(e) => setPassportCountry(e.target.value)}
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {TOURIST_COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                  Flight / Vessel Number
                </label>
                <input
                  type="text"
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value)}
                  placeholder="e.g. EK706"
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                  Departure Date
                </label>
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                  Refund Method
                </label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as any)}
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="credit_card">💳 Credit Card Refund</option>
                  <option value="airport_cash">💵 Cash at Airport Counter</option>
                  <option value="bank_transfer">🏦 SWIFT / Bank Transfer</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAndPrintThermal}
              className="bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors border border-slate-700 flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Thermal Summary</span>
            </button>

            <button
              onClick={handleSaveAndPrintA4}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-md flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Print A4 Tax-Free Certificate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
