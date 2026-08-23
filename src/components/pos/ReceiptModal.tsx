import React, { useRef } from 'react';
import {
  Printer,
  X,
  Share2,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  QrCode,
  Smartphone,
  Copy,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Transaction } from '../../types/pos';
import { posDb } from '../../services/db';

interface ReceiptModalProps {
  transaction: Transaction;
  onClose: () => void;
  onNewSale?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  onClose,
  onNewSale,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';

  const [copied, setCopied] = React.useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyReceiptUrl = () => {
    const url = `${window.location.origin}/receipt?id=${transaction.receiptNumber}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 my-auto">
        {/* Header (Screen only) */}
        <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Receipt #{transaction.receiptNumber}</h2>
              <p className="text-[11px] text-slate-400">
                {transaction.isRefund ? 'Customer Refund Voucher' : 'Thermal Checkout Receipt'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls Bar */}
        <div className="bg-[#0F1115]/50 border-b border-[#1E293B] p-3 flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Thermal (Ctrl+P)</span>
            </button>

            <button
              onClick={handleCopyReceiptUrl}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-[#1E293B] transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied Link!' : 'Copy E-Receipt'}</span>
            </button>
          </div>

          {onNewSale && (
            <button
              onClick={() => {
                onClose();
                onNewSale();
              }}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 transition-all"
            >
              <span>+ Start New Sale</span>
            </button>
          )}
        </div>

        {/* Receipt Paper Area */}
        <div className="p-4 sm:p-6 bg-slate-900/60 overflow-y-auto max-h-[65vh] flex justify-center">
          <div
            ref={receiptRef}
            className={`bg-white text-black p-5 sm:p-6 rounded-lg shadow-xl font-mono text-xs w-full ${
              settings.thermalPrinterWidth === '58mm' ? 'max-w-[280px] text-[11px]' : 'max-w-[340px]'
            } select-text`}
            style={{ fontFamily: "'JetBrains Mono', Courier, monospace" }}
          >
            {/* Store Branding Header */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
              <h3 className="font-extrabold text-sm sm:text-base uppercase tracking-tight text-black">
                {settings.storeName}
              </h3>
              <p className="text-[10px] text-slate-600">{settings.storeAddress}</p>
              <p className="text-[10px] text-slate-600">Tel: {settings.storePhone}</p>
              {settings.taxRegistrationNumber && (
                <p className="text-[10px] font-bold text-slate-700">
                  VAT/TIN: {settings.taxRegistrationNumber}
                </p>
              )}
            </div>

            {/* Refund or Void Alert Banner */}
            {transaction.isVoided && (
              <div className="my-2 bg-rose-600 text-white text-center font-bold text-xs py-1.5 px-2 uppercase tracking-wider rounded">
                *** VOIDED TRANSACTION ***
              </div>
            )}
            {transaction.isRefund && (
              <div className="my-2 bg-amber-600 text-white text-center font-bold text-xs py-1.5 px-2 uppercase tracking-wider rounded">
                *** REFUND RECEIPT ***
              </div>
            )}

            {/* Receipt Metadata */}
            <div className="py-2.5 text-[10px] space-y-1 border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span>Receipt No:</span>
                <span className="font-bold">{transaction.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{new Date(transaction.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{transaction.cashierName}</span>
              </div>
              {transaction.customerName && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{transaction.customerName}</span>
                </div>
              )}
              {transaction.voidedBy && (
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>Voided By:</span>
                  <span>{transaction.voidedBy} ({transaction.voidReason})</span>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="py-3 border-b border-dashed border-slate-400 space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-700 uppercase">
                <span>Item</span>
                <span>Qty x Price</span>
                <span className="text-right">Total</span>
              </div>

              {transaction.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-bold flex justify-between">
                    <span className="truncate max-w-[180px]">{item.name}</span>
                    <span>{primarySymbol} {(item.finalPrice * item.quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>SKU: {item.sku}</span>
                    <span>
                      {item.quantity} x {primarySymbol} {item.finalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Section */}
            <div className="py-3 space-y-1 border-b border-dashed border-slate-400">
              <div className="flex justify-between text-[11px]">
                <span>Subtotal (Excl. VAT):</span>
                <span>{primarySymbol} {transaction.subtotal.toFixed(2)}</span>
              </div>

              {transaction.discountTotal > 0 && (
                <div className="flex justify-between text-[11px] text-rose-600">
                  <span>Discounts Applied:</span>
                  <span>-{primarySymbol} {transaction.discountTotal.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-[11px]">
                <span>VAT ({settings.defaultTaxRate}%):</span>
                <span>{primarySymbol} {transaction.taxTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-sm sm:text-base font-extrabold pt-1.5 border-t border-slate-300">
                <span>TOTAL:</span>
                <span>{primarySymbol} {transaction.total.toFixed(2)}</span>
              </div>

              {transaction.secondaryTotal && (
                <div className="flex justify-between text-[11px] text-slate-700 font-semibold">
                  <span>USD Equivalent:</span>
                  <span>{secondarySymbol} {transaction.secondaryTotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Payment Tender Details */}
            <div className="py-2.5 text-[10px] space-y-1 border-b border-dashed border-slate-400">
              <div className="flex justify-between font-bold uppercase">
                <span>Payment Method:</span>
                <span>{transaction.paymentMethod}</span>
              </div>
              {transaction.cashTendered !== undefined && (
                <div className="flex justify-between">
                  <span>Cash Tendered:</span>
                  <span>
                    {transaction.cashTenderedCurrency === 'USD' ? secondarySymbol : primarySymbol}{' '}
                    {transaction.cashTendered.toFixed(2)}
                  </span>
                </div>
              )}
              {transaction.changeDue !== undefined && transaction.changeDue > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Change Given:</span>
                  <span>{primarySymbol} {transaction.changeDue.toFixed(2)}</span>
                </div>
              )}
              {transaction.loyaltyPointsEarned ? (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Loyalty Points Earned:</span>
                  <span>+{transaction.loyaltyPointsEarned} pts</span>
                </div>
              ) : null}
            </div>

            {/* Barcode & Footer Message */}
            <div className="pt-4 text-center space-y-2">
              <div className="flex flex-col items-center justify-center">
                {/* SVG Barcode emulation */}
                <div className="tracking-[3px] font-mono text-[9px] font-bold text-slate-800">
                  ||||| | |||| ||| ||||| || ||||
                </div>
                <span className="text-[9px] text-slate-600 font-mono">
                  *{transaction.receiptNumber}*
                </span>
              </div>
              <p className="text-[10px] text-slate-700 italic">{settings.receiptFooterMsg}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
