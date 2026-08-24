import React, { useEffect, useRef } from 'react';
import { X, Printer, Check, ShoppingBag } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { Transaction } from '../../types/pos';
import { posDb } from '../../services/db';

interface ReceiptModalProps {
  transaction: Transaction;
  onClose: () => void;
  onNewSale: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  onClose,
  onNewSale,
}) => {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 13.50;

  useEffect(() => {
    if (barcodeRef.current && transaction) {
      try {
        JsBarcode(barcodeRef.current, transaction.receiptNumber, {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 5,
        });
      } catch {
        // ignore barcode render error
      }
    }
  }, [transaction]);

  // Auto-print: fire the print dialog as soon as the receipt renders,
  // if the admin enabled "print automatically at checkout".
  const autoPrintFired = useRef(false);
  useEffect(() => {
    if (settings.autoPrintReceipt && !autoPrintFired.current) {
      autoPrintFired.current = true;
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-md w-full p-6 text-[#E2E8F0] shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header Actions */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1E293B] print:hidden">
          <div className={`flex items-center gap-2 font-semibold text-sm ${transaction.isRefund ? 'text-rose-400' : 'text-emerald-400'}`}>
            <Check className="w-4 h-4" /> {transaction.isRefund ? 'Refund / Return Processed' : 'Transaction Complete'}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Card */}
        <div className="my-4 p-6 bg-white text-slate-900 rounded-xl font-mono text-xs shadow-inner printable-receipt">
          {/* Store Logo Header */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300 space-y-1">
            {transaction.isRefund && (
              <div className="mb-2 inline-block bg-rose-100 text-rose-800 border border-rose-300 px-3 py-1 rounded font-sans font-bold text-xs uppercase tracking-wider">
                *** REFUND CREDIT MEMO ***
              </div>
            )}

            {/* Custom Logo Image */}
            {settings.receiptLogoUrl && (
              <div className="flex justify-center mb-2">
                <img
                  src={settings.receiptLogoUrl}
                  alt="Receipt Logo"
                  className="max-h-16 max-w-[180px] object-contain mx-auto filter grayscale contrast-125"
                />
              </div>
            )}

            <div className="font-bold text-base uppercase tracking-wider">
              {settings.storeName || 'Seychelles Island Boutique'}
            </div>

            {settings.receiptHeaderSubtitle && (
              <div className="text-[10px] text-slate-700 font-semibold">
                {settings.receiptHeaderSubtitle}
              </div>
            )}

            {settings.receiptHeaderLines && settings.receiptHeaderLines.length > 0 && (
              <div className="space-y-0.5 text-[10px] text-slate-500">
                {settings.receiptHeaderLines.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
            )}

            {settings.taxRegistrationNumber && (
              <div className="text-[9px] text-slate-500 font-bold mt-0.5">
                Tax Reg ID: {settings.taxRegistrationNumber}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">{transaction.isRefund ? 'Refund Voucher #:' : 'Receipt #:'}</span>
              <span className="font-bold">{transaction.receiptNumber}</span>
            </div>
            {transaction.originalReceiptNumber && (
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-500">Original Receipt:</span>
                <span>{transaction.originalReceiptNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Date/Time:</span>
              <span>{new Date(transaction.timestamp).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cashier:</span>
              <span>{transaction.cashierName}</span>
            </div>
            {transaction.customerName && (
              <div className="flex justify-between font-bold text-slate-800">
                <span className="text-slate-500 font-normal">Customer:</span>
                <span>{transaction.customerName} {transaction.customerPhone ? `(${transaction.customerPhone})` : ''}</span>
              </div>
            )}
            {transaction.loyaltyPointsEarned && transaction.loyaltyPointsEarned > 0 && (
              <div className="flex justify-between text-emerald-700 font-sans font-bold">
                <span>Loyalty Points Earned:</span>
                <span>+{transaction.loyaltyPointsEarned} pts</span>
              </div>
            )}
            {transaction.isRefund && transaction.refundReason && (
              <div className="flex justify-between text-rose-700 font-sans font-semibold pt-1 border-t border-slate-200">
                <span>Reason:</span>
                <span className="text-right truncate max-w-[180px]">{transaction.refundReason}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="py-3 border-b border-dashed border-slate-300">
            <div className="font-bold uppercase text-[10px] text-slate-500 mb-2 flex justify-between">
              <span>{transaction.isRefund ? 'Returned Item Description' : 'Item & Brand Description'}</span>
              <span>Total</span>
            </div>
            <div className="space-y-2">
              {transaction.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between font-semibold">
                    <span className="truncate pr-2">
                      [{item.brand || 'Ocean'}] {item.name}
                    </span>
                    <span className={item.totalPrice < 0 ? 'text-rose-700 font-bold' : ''}>
                      {primarySymbol} {item.totalPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>
                      {item.quantity} x {primarySymbol} {item.unitPrice.toFixed(2)}{' '}
                      {item.size ? `(${item.size})` : ''}
                    </span>
                    <span className="text-[9px] uppercase tracking-tight text-slate-500">
                      VAT {( (item.vatRate || 0.15) * 100 ).toFixed(0)}%: {primarySymbol} {item.vatAmount?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals & VAT Breakdown */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-right">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal (Net):</span>
              <span>{primarySymbol} {transaction.subtotal.toFixed(2)}</span>
            </div>
            {transaction.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span>-{primarySymbol} {transaction.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-700 font-semibold">
              <span>VAT Tax Amount:</span>
              <span>{primarySymbol} {(transaction.vatTotal || transaction.tax || 0).toFixed(2)}</span>
            </div>
            <div className={`flex justify-between font-bold text-sm pt-1 border-t border-slate-300 ${transaction.isRefund ? 'text-rose-700 font-sans' : 'text-slate-900'}`}>
              <span>{transaction.isRefund ? 'TOTAL REFUNDED:' : 'TOTAL PAID:'}</span>
              <span>{primarySymbol} {transaction.total.toFixed(2)}</span>
            </div>

            {/* SECONDARY CURRENCY TOTAL SECTION */}
            {transaction.currencyUsed === 'secondary' && transaction.secondaryTotal && (
              <div className="pt-1.5 text-[11px] text-cyan-800 font-bold border-t border-dotted border-slate-300 space-y-0.5">
                <div className="flex justify-between">
                  <span>In Paid Currency ({secondaryCode}):</span>
                  <span>{secondarySymbol}{transaction.secondaryTotal.toFixed(2)}</span>
                </div>
                <div className="text-[9px] text-slate-500 text-right">
                  Rate: 1 {secondaryCode} = {primarySymbol} {(transaction.exchangeRateUsed || exchangeRate).toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {/* Payment Detail */}
          <div className="py-2.5 border-b border-dashed border-slate-300 text-slate-600 space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span className="capitalize">{transaction.isRefund ? 'Refunded via' : 'Paid via'} {transaction.paymentMethod}:</span>
              <span className="font-bold text-slate-900">
                {transaction.currencyUsed === 'secondary' && transaction.secondaryTotal
                  ? `${secondarySymbol}${transaction.secondaryTotal.toFixed(2)} ${secondaryCode}`
                  : `${primarySymbol} ${Math.abs(transaction.total).toFixed(2)} ${primaryCode}`}
              </span>
            </div>
            {transaction.paymentMethod === 'cash' && transaction.cashGiven !== undefined && (
              <div className="flex justify-between text-slate-500">
                <span>Cash Tendered:</span>
                <span>
                  {transaction.currencyUsed === 'secondary' && transaction.cashGivenSecondary !== undefined
                    ? `${secondarySymbol}${transaction.cashGivenSecondary.toFixed(2)} ${secondaryCode}`
                    : `${primarySymbol} ${transaction.cashGiven.toFixed(2)} ${primaryCode}`}
                </span>
              </div>
            )}
            {transaction.paymentMethod === 'cash' && transaction.changeDue !== undefined && transaction.changeDue > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Change Due:</span>
                <span>
                  {transaction.currencyUsed === 'secondary' && transaction.changeDueSecondary !== undefined
                    ? `${secondarySymbol}${transaction.changeDueSecondary.toFixed(2)} ${secondaryCode}`
                    : `${primarySymbol} ${transaction.changeDue.toFixed(2)} ${primaryCode}`}
                </span>
              </div>
            )}
            {/* If paid in USD cash, show change was given back in local SCR */}
            {transaction.currencyUsed === 'secondary' && transaction.paymentMethod === 'cash' && transaction.changeDueSecondary !== undefined && transaction.changeDueSecondary > 0 && (
              <div className="flex justify-between text-slate-500 italic text-[10px]">
                <span>Change Back in {primaryCode}:</span>
                <span>{primarySymbol} {(transaction.changeDueSecondary * (transaction.exchangeRateUsed || exchangeRate)).toFixed(2)}</span>
              </div>
            )}
            {transaction.restocked && (
              <div className="text-[10px] text-emerald-700 font-sans font-semibold pt-1">
                ✓ Items added back into inventory stock levels
              </div>
            )}
          </div>

          {/* Barcode & Footer */}
          <div className="pt-3 text-center space-y-4">
            <svg ref={barcodeRef} className="mx-auto max-w-full"></svg>

            {/* Dynamic Customer Receipt QR Code */}
            <div className="border-t border-b border-dashed border-slate-300 py-3.5 space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-800">
                Scan to View Digital Invoice & Leave Feedback
              </div>
              <div className="flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                    `${window.location.origin}${window.location.pathname}?receipt=${transaction.receiptNumber}`
                  )}`}
                  alt="Receipt QR Code"
                  className="w-28 h-28 border border-slate-200 p-1 bg-white inline-block"
                />
              </div>
              <div className="text-[8px] text-slate-500 font-mono break-all max-w-[240px] mx-auto">
                {window.location.origin}{window.location.pathname}?receipt={transaction.receiptNumber}
              </div>
            </div>

            {settings.receiptFooterMessage && (
              <div className="text-[11px] text-slate-800 font-sans font-bold">
                {settings.receiptFooterMessage}
              </div>
            )}

            {settings.receiptFooterPolicy && (
              <div className="text-[9.5px] text-slate-600 font-sans italic border-t border-slate-200 pt-1.5">
                {settings.receiptFooterPolicy}
              </div>
            )}

            {settings.receiptFooterLines && settings.receiptFooterLines.length > 0 && (
              <div className="text-[9px] text-slate-500 font-mono space-y-0.5">
                {settings.receiptFooterLines.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={() => {
              onClose();
              onNewSale();
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Next Sale</span>
          </button>
        </div>
      </div>
    </div>
  );
};
