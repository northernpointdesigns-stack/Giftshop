import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, Check, ShoppingBag, FileText, ShieldCheck, Send, Plane, Gift } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { Transaction } from '../../types/pos';
import { posDb } from '../../services/db';
import { printThermalReceipt } from '../../utils/printThermalReceipt';
import { printStandardInvoice } from '../../utils/printStandardInvoice';
import { ReceiptLookupModal } from '../receipts/ReceiptLookupModal';
import { DigitalReceiptModal } from '../receipts/DigitalReceiptModal';
import { TaxFreeExportModal } from '../receipts/TaxFreeExportModal';

interface ReceiptModalProps {
  transaction: Transaction;
  onClose: () => void;
  onNewSale: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction: initialTransaction,
  onClose,
  onNewSale,
}) => {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [transaction, setTransaction] = useState<Transaction>(initialTransaction);
  const [isAuditorOpen, setIsAuditorOpen] = useState(false);
  const [isDigitalModalOpen, setIsDigitalModalOpen] = useState(false);
  const [isTaxFreeModalOpen, setIsTaxFreeModalOpen] = useState(false);
  const [isGiftView, setIsGiftView] = useState(!!initialTransaction.isGiftReceipt);

  const settings = posDb.getSettings();
  const inventory = posDb.getInventory();

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

  // Auto-print according to store preference if configured
  const autoPrintFired = useRef(false);
  useEffect(() => {
    if (settings.autoPrintReceipt && !autoPrintFired.current) {
      autoPrintFired.current = true;
      const t = setTimeout(() => {
        if (settings.receiptPrinterType === 'normal') {
          printStandardInvoice(transaction, settings, { isGiftReceipt: isGiftView });
        } else {
          printThermalReceipt(transaction, settings, settings.thermalReceiptWidth || '80mm', { isGiftReceipt: isGiftView });
        }
      }, 500);
      return () => clearTimeout(t);
    }
  }, []);

  const handlePrintThermal = () => {
    printThermalReceipt(transaction, settings, settings.thermalReceiptWidth || '80mm', { isGiftReceipt: isGiftView });
  };

  const handlePrintA4 = () => {
    printStandardInvoice(transaction, settings, { isGiftReceipt: isGiftView });
  };

  const logoUrl = settings.shopLogoUrl || settings.receiptLogoUrl || settings.brandLogoUrl;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-md w-full p-6 text-[#E2E8F0] shadow-2xl relative max-h-[92vh] overflow-y-auto">
          {/* Header Actions */}
          <div className="flex items-center justify-between pb-3 border-b border-[#1E293B] print:hidden">
            <div className={`flex items-center gap-2 font-semibold text-sm ${transaction.isRefund ? 'text-rose-400' : 'text-emerald-400'}`}>
              <Check className="w-4 h-4" /> {transaction.isRefund ? 'Refund / Return Processed' : 'Transaction Complete'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAuditorOpen(true)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-1 transition-colors"
                title="Audit transaction for math and price drift discrepancies"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Audit</span>
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Thermal Receipt Card Preview */}
          <div className="my-4 p-6 bg-white text-slate-900 rounded-xl font-mono text-xs shadow-inner printable-receipt">
            {/* Store Logo Header */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300 space-y-1">
              {transaction.isRefund && (
                <div className="mb-2 inline-block bg-rose-100 text-rose-800 border border-rose-300 px-3 py-1 rounded font-sans font-bold text-xs uppercase tracking-wider">
                  *** REFUND CREDIT MEMO ***
                </div>
              )}

              {/* Custom Logo Image */}
              {logoUrl && (
                <div className="flex justify-center mb-2">
                  <img
                    src={logoUrl}
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
                  Tax Reg ID / TIN: {settings.taxRegistrationNumber}
                </div>
              )}

              {/* PROMINENT MAIN STORE CURRENCY INDICATOR */}
              <div className="mt-2 py-1 px-2 border border-slate-800 bg-slate-50 text-[10px] font-bold text-slate-900 rounded tracking-tight">
                MAIN CURRENCY: {primaryCode} ({primarySymbol})
              </div>
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
              <div className="flex justify-between">
                <span className="text-slate-500">Terminal / Register:</span>
                <span className="font-semibold text-slate-700">{transaction.registerName || 'Main Boutique Counter'}</span>
              </div>
              {transaction.priceListName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Pricing Tier:</span>
                  <span className="font-semibold text-cyan-800">{transaction.priceListName}</span>
                </div>
              )}
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
                        {item.priceListName && (
                          <span className="ml-1 align-middle inline-block text-[8px] bg-cyan-100 text-cyan-800 border border-cyan-300 px-1 rounded font-bold uppercase tracking-wide">
                            {item.priceListName}
                          </span>
                        )}
                        {item.isDamaged && (
                          <span className="ml-1 align-middle inline-block text-[8px] bg-amber-100 text-amber-800 border border-amber-300 px-1 rounded font-bold uppercase tracking-wide">
                            Damaged −{item.damageDiscountPercent ?? 0}%
                          </span>
                        )}
                      </span>
                      <span className={item.totalPrice < 0 ? 'text-rose-700 font-bold' : ''}>
                        {primarySymbol} {item.totalPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>
                        {Math.abs(item.quantity)} x {primarySymbol} {item.unitPrice.toFixed(2)}{' '}
                        {item.size ? `(${item.size})` : ''}
                      </span>
                      <span className="text-[9px] uppercase tracking-tight text-slate-500">
                        VAT {( (item.vatRate || 0.15) * 100 ).toFixed(0)}%{settings.vatInclusive ? ' incl.' : ''}: {primarySymbol} {item.vatAmount?.toFixed(2) || '0.00'}
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
              {!!transaction.itemDiscountTotal && transaction.itemDiscountTotal > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Item Discounts (Damaged):</span>
                  <span>-{primarySymbol} {transaction.itemDiscountTotal.toFixed(2)}</span>
                </div>
              )}
              {transaction.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount{transaction.discountType === 'percent' ? ' (%)' : ''}:</span>
                  <span>-{primarySymbol} {transaction.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-700 font-semibold">
                <span>VAT Tax Amount{settings.vatInclusive ? ' (Included)' : ''}:</span>
                <span>{primarySymbol} {(transaction.vatTotal || transaction.tax || 0).toFixed(2)}</span>
              </div>
              <div className={`flex justify-between font-bold text-sm pt-1 border-t border-slate-300 ${transaction.isRefund ? 'text-rose-700 font-sans' : 'text-slate-900'}`}>
                <span>{transaction.isRefund ? 'TOTAL REFUNDED:' : 'TOTAL AMOUNT:'}</span>
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

              {transaction.splitPayments && transaction.splitPayments.length > 0 && (
                <div className="my-1 p-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] space-y-1">
                  <div className="font-bold text-slate-800 border-b border-slate-200 pb-0.5 flex justify-between">
                    <span>Split Payment Lines:</span>
                    <span>{transaction.splitPayments.length} Tendered</span>
                  </div>
                  {transaction.splitPayments.map((p, i) => (
                    <div key={i} className="flex justify-between text-slate-700">
                      <span>{p.method === 'cash' ? 'Cash' : p.method === 'card' ? 'Card' : 'Gift Card'} ({p.currencyCode}):</span>
                      <span className="font-mono font-bold">
                        {p.currencySymbol}{p.amountTendered.toFixed(2)} ({primarySymbol}{p.amountInPrimary.toFixed(2)})
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
              {transaction.currencyUsed === 'secondary' && transaction.paymentMethod === 'cash' && transaction.changeDueSecondary !== undefined && transaction.changeDueSecondary > 0 && (
                <div className="flex justify-between text-slate-500 italic text-[10px]">
                  <span>Change Back in {primaryCode}:</span>
                  <span>{primarySymbol} {(transaction.changeDueSecondary * (transaction.exchangeRateUsed || exchangeRate)).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Barcode & Footer */}
            <div className="pt-3 text-center space-y-3">
              <svg ref={barcodeRef} className="mx-auto max-w-full"></svg>

              {/* Dynamic Customer Receipt QR Code */}
              <div className="border-t border-b border-dashed border-slate-300 py-3 space-y-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-800">
                  Scan for Digital Receipt & Feedback
                </div>
                <div className="flex justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                      `${window.location.origin}${window.location.pathname}?receipt=${transaction.receiptNumber}`
                    )}`}
                    alt="Receipt QR Code"
                    className="w-24 h-24 border border-slate-200 p-1 bg-white inline-block"
                  />
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
            </div>
          </div>

          {/* Action Buttons: Digital Receipts, VAT Tax-Free, Gift Receipt & Printers */}
          <div className="space-y-2 pt-1 print:hidden">
            {/* Digital & Tourist Specialized Tools Row */}
            <div className={`grid ${settings.enableDigitalReceipts !== false ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5`}>
              {settings.enableDigitalReceipts !== false && (
                <button
                  onClick={() => setIsDigitalModalOpen(true)}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                  title="Send via WhatsApp or Email"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp/Email</span>
                </button>
              )}

              <button
                onClick={() => setIsTaxFreeModalOpen(true)}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors border ${
                  transaction.taxFreeDetails
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                    : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-blue-500/30'
                }`}
                title="Generate Tourist VAT Tax-Free Export Certificate"
              >
                <Plane className="w-3.5 h-3.5 text-blue-400" />
                <span>{transaction.taxFreeDetails ? 'VAT Tax-Free ✓' : 'VAT Tax-Free'}</span>
              </button>

              <button
                onClick={() => setIsGiftView((prev) => !prev)}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors border ${
                  isGiftView
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-inner'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Toggle price-suppressed Gift Receipt mode"
              >
                <Gift className="w-3.5 h-3.5 text-amber-400" />
                <span>{isGiftView ? 'Gift View ON' : 'Gift Receipt'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintThermal}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                title="Print 80mm / 58mm POS thermal tape"
              >
                <Printer className="w-4 h-4 text-cyan-400" />
                <span>Thermal ({isGiftView ? 'Gift 80mm' : '80mm'})</span>
              </button>

              <button
                onClick={handlePrintA4}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                title="Print A4 / Letter full invoice on standard normal printer"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>A4 Invoice ({isGiftView ? 'Gift A4' : 'Normal'})</span>
              </button>
            </div>

            <button
              onClick={() => {
                onClose();
                onNewSale();
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Next Sale</span>
            </button>
          </div>
        </div>
      </div>

      {/* Digital Receipt Modal */}
      {isDigitalModalOpen && (
        <DigitalReceiptModal
          transaction={transaction}
          onClose={() => setIsDigitalModalOpen(false)}
        />
      )}

      {/* Tourist VAT Tax-Free Export Modal */}
      {isTaxFreeModalOpen && (
        <TaxFreeExportModal
          transaction={transaction}
          onClose={() => setIsTaxFreeModalOpen(false)}
          onUpdateTransaction={(updatedTx) => setTransaction(updatedTx)}
        />
      )}

      {/* Discrepancy Auditor Modal */}
      {isAuditorOpen && (
        <ReceiptLookupModal
          initialReceiptNumber={transaction.receiptNumber}
          inventory={inventory}
          onClose={() => setIsAuditorOpen(false)}
        />
      )}
    </>
  );
};
