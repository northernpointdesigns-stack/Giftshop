import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  CreditCard,
  DollarSign,
  Gift,
  Plane,
  CheckCircle2,
  Sparkles,
  UserCheck,
  Award,
  ChevronDown,
  RefreshCw,
  Globe,
  Split,
  Plus,
  Trash2,
  Banknote,
  ArrowRight,
  Info,
  Tag,
  Percent,
  PiggyBank,
  ShieldCheck,
  Calculator,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Customer, InventoryItem, PaymentMethod, SplitPaymentLine, Transaction, StaffUser } from '../../types/pos';
import { posDb } from '../../services/db';
import { soundService } from '../../services/audio';
import { customerChannel } from '../../services/customerChannel';
import { computeOrderVerification, getMultiCurrencyEquivalents } from '../../utils/currencyAndMath';

interface CheckoutModalProps {
  cart: {
    item: InventoryItem;
    quantity: number;
    isDamaged?: boolean;
    damageDiscountPercent?: number;
    resolvedPrice?: number;
    priceListName?: string;
    priceListType?: string;
  }[];
  subtotal: number;
  tax: number;
  discount: number;
  /** Damaged-goods markdown total (from calculateCartTotals.itemDiscountTotal). */
  itemMarkdowns?: number;
  discountType?: 'amount' | 'percent';
  discountValue?: number;
  total: number;
  attachedCustomer?: Customer | null;
  registerInfo?: {
    registerId?: string;
    registerName?: string;
    priceListId?: string;
    priceListName?: string;
  };
  currentStaff?: StaffUser | null;
  onClose: () => void;
  onCompleteTransaction: (transaction: Transaction) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  cart,
  subtotal,
  tax,
  discount,
  itemMarkdowns = 0,
  discountType = 'amount',
  discountValue,
  total,
  attachedCustomer: initialCustomer,
  registerInfo,
  currentStaff,
  onClose,
  onCompleteTransaction,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashGivenInput, setCashGivenInput] = useState<string>('');
  const isAdmin = currentStaff?.role === 'admin';
  const [cashierName, setCashierName] = useState(() => currentStaff?.name || 'Authorized Cashier');
  const [isProcessing, setIsProcessing] = useState(false);

  // Store Settings for Currency
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || '$';
;
  const primaryCode = settings.primaryCurrency || 'USD';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 1;
  const allowSecondaryPayment = settings.allowPaymentInSecondary !== false;

  const [checkoutCurrency, setCheckoutCurrency] = useState<'primary' | 'secondary'>(
    () => (settings.defaultCurrencyMode === 'secondary' ? 'secondary' : 'primary')
  );

  // --- Floating window: drag by the header, resize by the corner grip -----
  // Geometry persists per device; null = default centered layout.
  const GEOM_KEY = 'giftshop:checkout-window';
  interface WinGeom { x: number; y: number; w: number; h: number }
  const clampGeom = (g: WinGeom): WinGeom => {
    const minW = 620, minH = 440;
    const w = Math.min(Math.max(g.w, minW), Math.max(minW, window.innerWidth - 16));
    const h = Math.min(Math.max(g.h, minH), Math.max(minH, window.innerHeight - 12));
    const x = Math.min(Math.max(g.x, 8), Math.max(8, window.innerWidth - w - 8));
    const y = Math.min(Math.max(g.y, 6), Math.max(6, window.innerHeight - h - 6));
    return { x, y, w, h };
  };
  const [geom, setGeom] = useState<WinGeom | null>(() => {
    try {
      const raw = localStorage.getItem(GEOM_KEY);
      if (!raw) return null;
      const g = JSON.parse(raw);
      if (typeof g?.x !== 'number' || typeof g?.y !== 'number' || typeof g?.w !== 'number' || typeof g?.h !== 'number') return null;
      return clampGeom(g as WinGeom);
    } catch { return null; }
  });
  const winDragRef = useRef<{ mode: 'move' | 'resize'; px: number; py: number; orig: WinGeom } | null>(null);

  const startWindowDrag = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const base: WinGeom =
      geom ?? (() => {
        const w = Math.min(1152, vw - 32);
        const h = Math.min(vh - 24, Math.max(440, Math.round(vh * 0.94)));
        return { w, h, x: Math.max(8, Math.round((vw - w) / 2)), y: Math.max(6, Math.round((vh - h) / 2)) };
      })();
    winDragRef.current = { mode, px: e.clientX, py: e.clientY, orig: base };
    setGeom(base);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onWindowPointerMove = (e: React.PointerEvent) => {
    const d = winDragRef.current;
    if (!d) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    setGeom(
      d.mode === 'move'
        ? clampGeom({ ...d.orig, x: d.orig.x + dx, y: d.orig.y + dy })
        : clampGeom({ ...d.orig, w: d.orig.w + dx, h: d.orig.h + dy })
    );
  };
  const endWindowDrag = () => {
    if (!winDragRef.current) return;
    winDragRef.current = null;
    setGeom((g) => {
      if (g) { try { localStorage.setItem(GEOM_KEY, JSON.stringify(g)); } catch { /* ignore */ } }
      return g;
    });
  };
  const resetWindow = () => {
    winDragRef.current = null;
    setGeom(null);
    try { localStorage.removeItem(GEOM_KEY); } catch { /* ignore */ }
  };

  // Split Payment & Currency Mixing State
  const [splitLines, setSplitLines] = useState<SplitPaymentLine[]>([]);
  const [splitMethod, setSplitMethod] = useState<'cash' | 'card' | 'gift_card'>('cash');
  const [splitCurrencyChoice, setSplitCurrencyChoice] = useState<'primary' | 'secondary' | 'EUR' | 'GBP' | 'custom'>('secondary');
  const [splitCustomCode, setSplitCustomCode] = useState('EUR');
  const [splitCustomSymbol, setSplitCustomSymbol] = useState('€');
  const [splitCustomRate, setSplitCustomRate] = useState('14.60');
  const [splitAmountInput, setSplitAmountInput] = useState<string>('');
  const [splitRef, setSplitRef] = useState<string>('');

  // Multi-Currency Math
  const totalSec = Number((total / exchangeRate).toFixed(2));
  const subtotalSec = Number(((total - tax + discount) / exchangeRate).toFixed(2));
  const discountSec = Number((discount / exchangeRate).toFixed(2));
  const taxSec = Number((tax / exchangeRate).toFixed(2));

  // Active pricing based on checkout selection
  const activeTotal = checkoutCurrency === 'primary' ? total : totalSec;
  const activeSymbol = checkoutCurrency === 'primary' ? primarySymbol : secondarySymbol;
  const activeCode = checkoutCurrency === 'primary' ? primaryCode : secondaryCode;

  // Selected Customer state for checkout
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialCustomer || null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const allCustomers = posDb.getCustomers();

  // Gift Receipt & Tourist Tax-Free State
  const [isGiftReceiptNeeded, setIsGiftReceiptNeeded] = useState(false);
  const [isTaxFreeNeeded, setIsTaxFreeNeeded] = useState(false);
  const [tfTravelerName, setTfTravelerName] = useState(initialCustomer?.name || '');
  const [tfPassportNumber, setTfPassportNumber] = useState('');
  const [tfPassportCountry, setTfPassportCountry] = useState('France');
  const [tfFlightNumber, setTfFlightNumber] = useState('EK706 (Emirates)');

  const cashGivenNumber = parseFloat(cashGivenInput) || 0;
  const changeDue = Math.max(0, cashGivenNumber - activeTotal);
  const isCashInsufficient = paymentMethod === 'cash' && cashGivenNumber < activeTotal;

  // Change details in opposite currency if secondary is chosen
  const changeDueOpposite =
    checkoutCurrency === 'secondary' ? changeDue * exchangeRate : changeDue / exchangeRate;

  // Computed totals for Split Payments
  const totalPaidInPrimary = Number(
    splitLines.reduce((acc, l) => acc + l.amountInPrimary, 0).toFixed(2)
  );
  const splitRemainingDuePrimary = Math.max(0, Number((total - totalPaidInPrimary).toFixed(2)));
  const splitChangeDuePrimary = Math.max(0, Number((totalPaidInPrimary - total).toFixed(2)));
  const isSplitInsufficient = paymentMethod === 'split' && totalPaidInPrimary < total - 0.01;

  // Dynamic Calculations for Order Summary & Verification Block
  // -------------------------------------------------------------------
  // `subtotal` is the NET subtotal and `tax` the ACTUAL VAT — both come
  // straight from calculateCartTotals in CashierPOS. When VAT-inclusive
  // pricing is enabled, the shelf prices ALREADY contain VAT, so the
  // embedded VAT must never be reported as a discount or a "saving".
  // Only real reductions (markdowns + manual discounts) count.
  const vatInclusive = settings.vatInclusive === true;
  const shelfValue = Number(
    cart
      .reduce((sum, c) => sum + (c.resolvedPrice ?? c.item.retailPrice) * c.quantity, 0)
      .toFixed(2)
  );
  const verification = computeOrderVerification({
    shelfValue,
    markdowns: itemMarkdowns,
    manualDiscount: discount,
    vat: tax,
    total,
    vatInclusive,
    defaultVatRate: settings.defaultVatRate,
    includeTouristRefund: isTaxFreeNeeded,
    touristFeePercent: settings.taxFreeAdminFeePercent ?? 10,
  });
  const { totalDiscount: totalDiscountApplied, effectiveVatRate } = verification;

  // Get active currency details for line entry
  const getActiveSplitCurrencyDetails = () => {
    if (splitCurrencyChoice === 'primary') {
      return { code: primaryCode, symbol: primarySymbol, rate: 1.0, label: `${primaryCode} (${primarySymbol})` };
    } else if (splitCurrencyChoice === 'secondary') {
      return { code: secondaryCode, symbol: secondarySymbol, rate: exchangeRate, label: `${secondaryCode} (${secondarySymbol})` };
    } else if (splitCurrencyChoice === 'EUR') {
      return { code: 'EUR', symbol: '€', rate: 14.60, label: 'EUR (€)' };
    } else if (splitCurrencyChoice === 'GBP') {
      return { code: 'GBP', symbol: '£', rate: 17.20, label: 'GBP (£)' };
    } else {
      const rate = parseFloat(splitCustomRate) || 1.0;
      return {
        code: (splitCustomCode || 'FOREIGN').toUpperCase(),
        symbol: splitCustomSymbol || '$',
        rate,
        label: `${splitCustomCode} (${splitCustomSymbol})`,
      };
    }
  };

  // Sync default amount when currency or remaining balance changes
  useEffect(() => {
    if (paymentMethod === 'split') {
      const curr = getActiveSplitCurrencyDetails();
      if (splitRemainingDuePrimary > 0) {
        const suggestedNative = Number((splitRemainingDuePrimary / curr.rate).toFixed(2));
        setSplitAmountInput(suggestedNative.toString());
      } else {
        setSplitAmountInput('');
      }
    }
  }, [splitCurrencyChoice, splitRemainingDuePrimary, paymentMethod, splitCustomRate]);

  // Sync customer display
  useEffect(() => {
    if (paymentMethod === 'split') {
      customerChannel.updateState({
        ...customerChannel.getCurrentState(),
        displayCurrency: checkoutCurrency,
        splitPaymentsPreview: splitLines.map((l) => ({
          method: l.method,
          currencyCode: l.currencyCode,
          currencySymbol: l.currencySymbol,
          amountTendered: l.amountTendered,
          amountInPrimary: l.amountInPrimary,
        })),
        splitTotalPaidSoFar: totalPaidInPrimary,
        splitRemainingDue: splitRemainingDuePrimary,
      });
    } else {
      customerChannel.updateState({
        ...customerChannel.getCurrentState(),
        displayCurrency: checkoutCurrency,
        splitPaymentsPreview: undefined,
        splitTotalPaidSoFar: undefined,
        splitRemainingDue: undefined,
      });
    }
  }, [checkoutCurrency, paymentMethod, splitLines, totalPaidInPrimary, splitRemainingDuePrimary]);

  const handleQuickCash = (amount: number) => {
    setCashGivenInput(amount.toString());
  };

  const handleExactCash = () => {
    setCashGivenInput(activeTotal.toFixed(2));
  };

  const handleAddSplitLine = () => {
    const curr = getActiveSplitCurrencyDetails();
    const tendered = parseFloat(splitAmountInput);
    if (isNaN(tendered) || tendered <= 0) return;

    const amountInPrimary = Number((tendered * curr.rate).toFixed(2));
    const newLine: SplitPaymentLine = {
      id: `SPLIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      method: splitMethod,
      currencyCode: curr.code,
      currencySymbol: curr.symbol,
      amountTendered: tendered,
      exchangeRate: curr.rate,
      amountInPrimary,
      reference: splitRef.trim() || undefined,
      note: `${splitMethod === 'cash' ? 'Cash' : splitMethod === 'card' ? 'Credit/Debit Card' : 'Gift Card'} (${curr.code})`,
    };

    setSplitLines((prev) => [...prev, newLine]);
    setSplitAmountInput('');
    setSplitRef('');
  };

  const handleRemoveSplitLine = (id: string) => {
    setSplitLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleQuickAddRemaining = (method: 'card' | 'cash', currencyChoice: 'primary' | 'secondary') => {
    const curr =
      currencyChoice === 'primary'
        ? { code: primaryCode, symbol: primarySymbol, rate: 1.0 }
        : { code: secondaryCode, symbol: secondarySymbol, rate: exchangeRate };

    const remainingNative = Number((splitRemainingDuePrimary / curr.rate).toFixed(2));
    if (remainingNative <= 0) return;

    const newLine: SplitPaymentLine = {
      id: `SPLIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      method,
      currencyCode: curr.code,
      currencySymbol: curr.symbol,
      amountTendered: remainingNative,
      exchangeRate: curr.rate,
      amountInPrimary: Number((remainingNative * curr.rate).toFixed(2)),
      note: `${method === 'card' ? 'Local Credit Card' : 'Local Cash'} (${curr.code})`,
    };

    setSplitLines((prev) => [...prev, newLine]);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (paymentMethod === 'cash' && isCashInsufficient) {
      soundService.playErrorBeep();
      return;
    }

    if (paymentMethod === 'split' && isSplitInsufficient) {
      soundService.playErrorBeep();
      return;
    }

    setIsProcessing(true);
    soundService.playChaChing();

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'],
      });
    } catch {
      // ignore
    }

    try {
      const primaryCashGiven =
        paymentMethod === 'split'
          ? totalPaidInPrimary
          : checkoutCurrency === 'primary'
          ? cashGivenNumber
          : (paymentMethod === 'cash' ? cashGivenNumber * exchangeRate : undefined);

      const secondaryCashGiven =
        paymentMethod === 'split'
          ? undefined
          : checkoutCurrency === 'secondary'
          ? cashGivenNumber
          : undefined;

      const secondaryChangeDue =
        paymentMethod === 'split'
          ? (splitChangeDuePrimary > 0 ? Number((splitChangeDuePrimary / exchangeRate).toFixed(2)) : undefined)
          : checkoutCurrency === 'secondary'
          ? changeDue
          : undefined;

      const tx = posDb.recordTransaction(
        cart,
        paymentMethod,
        cashierName,
        primaryCashGiven,
        discount,
        selectedCustomer
          ? {
              id: selectedCustomer.id,
              name: selectedCustomer.name,
              phone: selectedCustomer.phone,
              email: selectedCustomer.email,
            }
          : undefined,
        paymentMethod === 'split' ? 'mixed' : checkoutCurrency,
        secondaryCashGiven,
        secondaryChangeDue,
        totalSec,
        {
          type: discountType === 'percent' ? ('percent' as const) : ('amount' as const),
          value: discountValue ?? 0,
        },
        paymentMethod === 'split' ? splitLines : undefined,
        registerInfo
      );

      if (isGiftReceiptNeeded) {
        tx.isGiftReceipt = true;
      }

      if (isTaxFreeNeeded) {
        const vatTotal = tx.vatTotal || tx.tax || tx.total * 0.15;
        const adminFeeAmount = Number((vatTotal * 0.10).toFixed(2));
        tx.taxFreeDetails = {
          certificateRef: `TF-${tx.receiptNumber.replace(/^[A-Z]+-?/, '')}`,
          travelerName: tfTravelerName.trim() || selectedCustomer?.name || 'Valued Tourist',
          passportNumber: tfPassportNumber.trim() || 'N/A',
          passportCountry: tfPassportCountry,
          flightNumber: tfFlightNumber.trim() || undefined,
          adminFeeAmount,
          netRefundAmount: Number((vatTotal - adminFeeAmount).toFixed(2)),
          issuedAt: new Date().toISOString(),
        };
      }

      // Persist updated transaction options to database
      posDb.updateTransaction(tx);

      setIsProcessing(false);
      onCompleteTransaction(tx);
    } catch (error) {
      setIsProcessing(false);
      soundService.playErrorBeep();
      alert(`Unable to complete this sale. ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1115]/80 flex items-center justify-center p-2 sm:p-4"
      onPointerMove={onWindowPointerMove}
      onPointerUp={endWindowDrag}
      onPointerCancel={endWindowDrag}
    >
      <div
        className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-6xl w-full text-[#E2E8F0] shadow-2xl relative max-h-[94vh] flex flex-col overflow-hidden"
        style={
          geom
            ? { position: 'fixed', left: geom.x, top: geom.y, width: geom.w, height: geom.h, maxWidth: 'none', maxHeight: 'none' }
            : undefined
        }
      >
        {/* Header (compact) — drag to move, double-click to reset position */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-[#1E293B] shrink-0 cursor-move select-none touch-none"
          onPointerDown={startWindowDrag('move')}
          onDoubleClick={resetWindow}
          title="Drag to move — double-click to reset"
        >
          <div>
            <h2 className="text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" /> Complete Sale
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Details &amp; options on the left — tender payment on the right
            </p>
          </div>
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resize grip (bottom-right corner) */}
        <div
          onPointerDown={startWindowDrag('resize')}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize touch-none z-10"
          title="Drag to resize"
        >
          <svg viewBox="0 0 20 20" className="w-full h-full text-slate-500">
            <path d="M19 7 L7 19 M19 12 L12 19 M19 17 L17 19" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>

        <form onSubmit={handleSubmitPayment} className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* LEFT COLUMN — order details, savings summary, receipt & tourist options */}
          <div className="flex-1 min-w-0 lg:overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* Order Summary Pill */}
        {(() => {
          const multiEqs = getMultiCurrencyEquivalents(total, settings);
          return (
            <div className="my-4 bg-[#0F1115] p-4 rounded-xl border border-[#1E293B] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-semibold">Grand Total Due</div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {checkoutCurrency === 'primary'
                      ? `${primarySymbol} ${total.toFixed(2)} ${primaryCode}`
                      : `${secondarySymbol}${totalSec.toFixed(2)} ${secondaryCode}`}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    {checkoutCurrency === 'primary' ? (
                      <>
                        Subtotal: {primarySymbol} {subtotal.toFixed(2)} | Tax: {primarySymbol} {tax.toFixed(2)}{' '}
                        {discount > 0 ? `| Disc: -${primarySymbol} ${discount.toFixed(2)}` : ''}
                      </>
                    ) : (
                      <>
                        Subtotal: {secondarySymbol}{subtotalSec.toFixed(2)} | Tax: {secondarySymbol}{taxSec.toFixed(2)}{' '}
                        {discount > 0 ? `| Disc: -${secondarySymbol}${discountSec.toFixed(2)}` : ''}
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Items Count</div>
                  <div className="text-base font-bold text-[#E2E8F0]">
                    {cart.reduce((sum, c) => sum + c.quantity, 0)} Units
                  </div>
                </div>
              </div>

              {/* Multi-Currency Equivalents Row */}
              <div className="pt-2 border-t border-[#1E293B]">
                <div className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Globe className="w-3 h-3 text-cyan-400" /> Equivalent Multi-Currency Totals:
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    1 {secondaryCode} = {primarySymbol} {exchangeRate.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {multiEqs.map((c) => (
                    <div
                      key={c.code}
                      className={`bg-[#161B22] border rounded-lg p-2 ${
                        c.isPrimary
                          ? 'border-emerald-500/40'
                          : c.isSecondary
                          ? 'border-cyan-500/40'
                          : 'border-purple-500/40'
                      }`}
                    >
                      <div
                        className={`text-[9px] font-bold uppercase truncate ${
                          c.isPrimary ? 'text-emerald-400' : c.isSecondary ? 'text-cyan-400' : 'text-purple-400'
                        }`}
                      >
                        {c.code} ({c.label.split(' ')[0]})
                      </div>
                      <div className="text-xs font-mono font-bold text-white mt-0.5 truncate">
                        {c.symbol} {c.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Customer Attachment Section */}
        <div className="mb-4 bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-300">Customer Link:</span>
              {selectedCustomer ? (
                <span className="font-bold text-white flex items-center gap-1.5">
                  {selectedCustomer.name}
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                    +{Math.floor(total)} pts
                  </span>
                </span>
              ) : (
                <span className="text-slate-500 italic">No customer attached (Walk-in)</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowCustomerPicker(!showCustomerPicker)}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
            >
              {selectedCustomer ? 'Change' : 'Attach Customer'} <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {showCustomerPicker && (
            <div className="mt-3 pt-3 border-t border-[#1E293B] space-y-2">
              <div className="text-[11px] text-slate-400 font-semibold mb-1">
                Select Customer for Loyalty Points:
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setShowCustomerPicker(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    !selectedCustomer ? 'bg-emerald-600/20 text-emerald-300 font-bold' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Guest / Anonymous Walk-in Customer
                </button>
                {allCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setShowCustomerPicker(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      selectedCustomer?.id === c.id
                        ? 'bg-emerald-600/20 text-emerald-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>
                      {c.name} ({c.phone})
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-0.5">
                      <Award className="w-3 h-3" /> {c.loyaltyPoints} pts
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

          {/* Specialized Transaction Options: Gift Receipt & Tourist VAT Tax-Free Export */}
          <div className="p-3 bg-[#161B22] border border-[#1E293B] rounded-xl space-y-3">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between border-b border-[#1E293B] pb-1.5">
              <span>Receipt &amp; Tourist Relief Options</span>
              <span className="text-[9px] text-slate-500 font-normal">Optional</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Gift Receipt Toggle */}
              <label
                className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                  isGiftReceiptNeeded
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-[#0F1115] border-[#1E293B] text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isGiftReceiptNeeded}
                  onChange={(e) => setIsGiftReceiptNeeded(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500/20"
                />
                <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="leading-tight">
                  <div>Gift Receipt Voucher</div>
                  <div className="text-[9.5px] font-normal text-slate-500">Suppress prices on receipt</div>
                </div>
              </label>

              {/* Tourist VAT Tax-Free Export Toggle */}
              <label
                className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                  isTaxFreeNeeded
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                    : 'bg-[#0F1115] border-[#1E293B] text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isTaxFreeNeeded}
                  onChange={(e) => setIsTaxFreeNeeded(e.target.checked)}
                  className="rounded border-slate-700 text-blue-500 focus:ring-blue-500/20"
                />
                <Plane className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="leading-tight">
                  <div>VAT Tax-Free Export</div>
                  <div className="text-[9.5px] font-normal text-slate-500">International tourist refund</div>
                </div>
              </label>
            </div>

            {/* Expanded Tourist Details form when Tax-Free is enabled */}
            {isTaxFreeNeeded && (
              <div className="p-2.5 bg-blue-950/20 border border-blue-500/30 rounded-lg space-y-2 text-xs">
                <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1">
                  <Plane className="w-3 h-3 text-blue-400" /> Traveler Export Customs Details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9.5px] text-slate-400 mb-0.5">Traveler Name</label>
                    <input
                      type="text"
                      value={tfTravelerName}
                      onChange={(e) => setTfTravelerName(e.target.value)}
                      placeholder="Passport full name"
                      className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-slate-400 mb-0.5">Passport Number *</label>
                    <input
                      type="text"
                      value={tfPassportNumber}
                      onChange={(e) => setTfPassportNumber(e.target.value)}
                      placeholder="e.g. 12AB34567"
                      className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-slate-400 mb-0.5">Country of Residence</label>
                    <input
                      type="text"
                      value={tfPassportCountry}
                      onChange={(e) => setTfPassportCountry(e.target.value)}
                      placeholder="e.g. Germany, UK, UAE"
                      className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-slate-400 mb-0.5">Flight / Cruise Departure</label>
                    <input
                      type="text"
                      value={tfFlightNumber}
                      onChange={(e) => setTfFlightNumber(e.target.value)}
                      placeholder="e.g. EK706"
                      className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* DYNAMIC DISCOUNTS & TAX SAVINGS VERIFICATION SUMMARY BLOCK */}
          <div className="p-3.5 bg-[#0F1115] border border-emerald-500/30 rounded-xl space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-[#E2E8F0] uppercase tracking-wider">
                  Discounts &amp; Tax Savings Summary
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Cashier Verification
              </span>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* 1. Total Discount Applied (real reductions only) */}
              <div className="bg-[#161B22] p-2.5 rounded-lg border border-[#1E293B] space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-amber-400" /> Total Discount:
                  </span>
                  {verification.hasDiscounts && (
                    <span className="text-amber-400 font-bold font-mono">
                      -{primarySymbol} {verification.totalDiscount.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className={`text-base font-black font-mono ${verification.hasDiscounts ? 'text-amber-400' : 'text-slate-500'}`}>
                  {primarySymbol} {verification.totalDiscount.toFixed(2)}
                </div>
                <div className="text-[9.5px] text-slate-500 space-y-0.5 font-mono">
                  {itemMarkdowns > 0 && (
                    <div className="truncate">• Damaged/Markdown: {primarySymbol} {itemMarkdowns.toFixed(2)}</div>
                  )}
                  {discount > 0 && (
                    <div className="truncate">
                      • Manual Disc ({discountType === 'percent' ? `${discountValue}%` : 'Fixed'}): {primarySymbol} {discount.toFixed(2)}
                    </div>
                  )}
                  {!verification.hasDiscounts && (
                    <div className="text-slate-600 italic">No discounts applied</div>
                  )}
                </div>
              </div>
              {/* 2. VAT — the actual tax in this sale (never a "saving") */}
              <div className="bg-[#161B22] p-2.5 rounded-lg border border-[#1E293B] space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3 text-cyan-400" /> VAT / Tax:
                  </span>
                  <span className="text-cyan-400 font-bold font-mono">
                    {parseFloat((effectiveVatRate * 100).toFixed(1))}% Rate
                  </span>
                </div>
                <div className="text-base font-black font-mono text-cyan-400">
                  {primarySymbol} {tax.toFixed(2)}
                </div>
                <div className="text-[9.5px] text-slate-500 space-y-0.5 font-mono">
                  <div className="truncate">
                    {vatInclusive
                      ? `• Included in shelf prices`
                      : `• Added on top of prices`}
                  </div>
                  {isTaxFreeNeeded && tax > 0 && (
                    <div className="truncate text-blue-300 font-semibold">
                      ✈️ Gross refund: {primarySymbol} {verification.touristGrossVat.toFixed(2)}
                      {' '}− {verification.touristFeePercent}% fee ({primarySymbol} {verification.touristFeeAmount.toFixed(2)})
                    </div>
                  )}
                </div>
              </div>
              {/* 3. Total Savings — discounts plus tourist refund when opted in */}
              <div className="bg-[#161B22] p-2.5 rounded-lg border border-[#1E293B] space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <PiggyBank className="w-3 h-3 text-emerald-400" /> Total Savings:
                  </span>
                  {verification.totalSavings > 0 && (
                    <span className="text-emerald-400 font-bold font-mono bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      {verification.savingsPercent}% Saved
                    </span>
                  )}
                </div>
                <div className={`text-base font-black font-mono ${verification.totalSavings > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {primarySymbol} {verification.totalSavings.toFixed(2)}
                </div>
                <div className="text-[9.5px] text-slate-500 space-y-0.5 font-mono">
                  {verification.hasDiscounts && (
                    <div className="truncate">• Discounts: {primarySymbol} {verification.totalDiscount.toFixed(2)}</div>
                  )}
                  {isTaxFreeNeeded && verification.touristRefundEstimate > 0 && (
                    <div className="truncate text-blue-300 font-semibold">
                      • ✈️ Tourist refund: {primarySymbol} {verification.touristRefundEstimate.toFixed(2)} (after {verification.touristFeePercent}% fee)
                    </div>
                  )}
                  {verification.totalSavings === 0 && (
                    <div className="text-slate-600 italic">Tagged prices paid — no savings</div>
                  )}
                </div>
              </div>
            </div>

            {/* Cashier Final Amount Verification Bar */}
            <div className="p-2.5 bg-slate-900/80 border border-slate-700/60 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>Tagged Price Value:</span>
                    <span className={`font-mono ${verification.hasDiscounts ? 'text-slate-400 line-through' : 'text-white'}`}>
                      {primarySymbol} {shelfValue.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isTaxFreeNeeded && verification.touristRefundEstimate > 0
                      ? 'Tourist refund is claimed after departure — full amount due at the till'
                      : verification.hasDiscounts
                      ? 'Verify final amount with customer before tendering register'
                      : 'No discounts — customer pays the tagged prices'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Final Payable Amount</div>
                <div className="text-base font-black text-emerald-400 font-mono">
                  {primarySymbol} {total.toFixed(2)} {primaryCode}
                </div>
              </div>
            </div>
          </div>
          {/* Active Cashier Signed-In Account (Locked to Session for Cashiers, Selectable for Admins) */}
          {isAdmin ? (
            <div className="bg-[#0F1115] border border-amber-500/40 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin Cashier Selection Override</span>
                </label>
                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono font-bold">ADMIN PERMISSION</span>
              </div>
              <select
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
              >
                {posDb.getActiveCashiers().map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="bg-[#0F1115] border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <span>Authenticated Cashier Account</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono font-bold">LOCKED</span>
                  </div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                    <span>{cashierName}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded border border-slate-700">
                      {(currentStaff?.role || 'cashier').replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 text-right font-mono hidden sm:block">
                <div>Session: ACTIVE</div>
                <div>ID: {currentStaff?.id || 'AUTH-SESSION'}</div>
              </div>
            </div>
          )}
          </div>

          {/* RIGHT COLUMN — payment rail: total, tender, process */}
          <div className="w-full lg:w-[360px] xl:w-[400px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#1E293B] bg-[#0F1115] p-4 flex flex-col gap-3 lg:overflow-y-auto">
            {/* Checkout Currency Switcher (For Single Tender Mode) */}
            {allowSecondaryPayment && paymentMethod !== 'split' && (
              <div className="flex items-center justify-between p-2.5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
                <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" /> Pay and Tender in:
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutCurrency('primary');
                      setCashGivenInput('');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      checkoutCurrency === 'primary'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {primaryCode} ({primarySymbol})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutCurrency('secondary');
                      setCashGivenInput('');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      checkoutCurrency === 'secondary'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {secondaryCode} ({secondarySymbol})
                  </button>
                </div>
              </div>
            )}

          {/* Payment Method Selector Grid */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select Payment Method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <DollarSign className="w-5 h-5 mb-1 text-emerald-400" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                  paymentMethod === 'card'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-5 h-5 mb-1 text-blue-400" />
                <span>Credit / Debit</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('split')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                  paymentMethod === 'split'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm font-bold'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Split className="w-5 h-5 mb-1 text-amber-400" />
                <span>Split / Currency Mix</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('gift_card')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                  paymentMethod === 'gift_card'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Gift className="w-5 h-5 mb-1 text-purple-400" />
                <span>Gift Card</span>
              </button>
            </div>
          </div>

          {/* Cash Details Panel */}
          {paymentMethod === 'cash' && (
            <div className="space-y-3 bg-[#0F1115] p-3.5 rounded-xl border border-[#1E293B]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  Cash Received ({activeSymbol} {activeCode})
                </label>
                <button
                  type="button"
                  onClick={handleExactCash}
                  className="text-xs text-emerald-400 hover:underline font-medium"
                >
                  Exact ({activeSymbol} {activeTotal.toFixed(2)})
                </button>
              </div>

              <input
                type="number"
                step="0.01"
                min="0"
                value={cashGivenInput}
                onChange={(e) => setCashGivenInput(e.target.value)}
                placeholder="0.00"
                autoFocus
                className={`w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-lg font-mono font-bold focus:outline-none ${
                  checkoutCurrency === 'primary' ? 'text-emerald-400 focus:border-emerald-500' : 'text-cyan-400 focus:border-cyan-500'
                }`}
              />

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {(checkoutCurrency === 'primary' ? [50, 100, 200, 500] : [5, 10, 20, 50, 100]).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickCash(amt)}
                    className="flex-1 bg-slate-800/60 hover:bg-slate-800 text-slate-200 border border-slate-700/60 py-1.5 px-2 rounded-lg text-xs font-semibold font-mono transition-colors"
                  >
                    {activeSymbol}
                    {amt}
                  </button>
                ))}
              </div>

              {/* Change Due Output */}
              <div className="pt-2 border-t border-[#1E293B] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Change Due to Customer ({activeSymbol}):</span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      isCashInsufficient
                        ? 'text-rose-400'
                        : checkoutCurrency === 'primary'
                        ? 'text-emerald-400'
                        : 'text-cyan-400'
                    }`}
                  >
                    {isCashInsufficient ? 'Insufficient Cash' : `${activeSymbol} ${changeDue.toFixed(2)}`}
                  </span>
                </div>

                {!isCashInsufficient && changeDue > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-800/10 px-2 py-1 rounded">
                    <span>Change equivalent in {checkoutCurrency === 'primary' ? secondaryCode : primaryCode}:</span>
                    <span className="font-mono font-bold text-slate-300">
                      {checkoutCurrency === 'primary'
                        ? `${secondarySymbol}${changeDueOpposite.toFixed(2)}`
                        : `${primarySymbol} ${changeDueOpposite.toFixed(2)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SPLIT PAYMENTS & CURRENCY MIXING PANEL */}
          {paymentMethod === 'split' && (
            <div className="space-y-4 bg-[#0F1115] p-4 rounded-xl border border-amber-500/30">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2.5">
                <div>
                  <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Split className="w-4 h-4 text-amber-400" /> Split Tender &amp; Currency Mix Panel
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Take partial payment in foreign cash (e.g. USD / EUR) and settle remainder on a local card or cash.
                  </p>
                </div>
              </div>

              {/* Live Tally Header */}
              <div className="grid grid-cols-3 gap-2 bg-[#161B22] p-3 rounded-xl border border-[#1E293B] text-center font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-sans font-semibold">Total Order</span>
                  <span className="text-sm font-bold text-white">
                    {primarySymbol} {total.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-sans font-semibold">Paid So Far</span>
                  <span className="text-sm font-bold text-cyan-400">
                    {primarySymbol} {totalPaidInPrimary.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-sans font-semibold">
                    {splitRemainingDuePrimary > 0 ? 'Remaining Due' : 'Change Due'}
                  </span>
                  <span
                    className={`text-sm font-black ${
                      splitRemainingDuePrimary > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {splitRemainingDuePrimary > 0
                      ? `${primarySymbol} ${splitRemainingDuePrimary.toFixed(2)}`
                      : `${primarySymbol} ${splitChangeDuePrimary.toFixed(2)}`}
                  </span>
                </div>
              </div>

              {/* Added Split Payment Lines List */}
              {splitLines.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-300">Tendered Payment Lines ({splitLines.length}):</div>
                  <div className="space-y-1.5">
                    {splitLines.map((line, idx) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between bg-[#161B22] border border-[#1E293B] p-2.5 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>
                                {line.method === 'cash' ? '💵 Cash' : line.method === 'card' ? '💳 Credit/Debit' : '🎁 Gift Card'} ({line.currencyCode})
                              </span>
                              {line.reference && (
                                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                                  Ref: {line.reference}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Tendered {line.currencySymbol}
                              {line.amountTendered.toFixed(2)} @ {line.exchangeRate.toFixed(2)} rate = {primarySymbol}{' '}
                              {line.amountInPrimary.toFixed(2)} {primaryCode}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSplitLine(line.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                          title="Remove this payment line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Auto-Fill Action Helper Buttons */}
              {splitRemainingDuePrimary > 0 && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                  <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Quick Settle Remainder ({primarySymbol} {splitRemainingDuePrimary.toFixed(2)}):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickAddRemaining('card', 'primary')}
                      className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Settle Remainder on Local Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickAddRemaining('cash', 'primary')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Settle Remainder in Local Cash</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Manual Split Line Entry Form */}
              <div className="p-3 bg-[#161B22] border border-[#1E293B] rounded-xl space-y-3">
                <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" /> Add Custom Partial Payment Line:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Payment Method */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Method</label>
                    <select
                      value={splitMethod}
                      onChange={(e) => setSplitMethod(e.target.value as any)}
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      <option value="cash">💵 Cash</option>
                      <option value="card">💳 Credit / Debit Card</option>
                      <option value="gift_card">🎁 Gift Card</option>
                    </select>
                  </div>

                  {/* Currency Selection */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Currency Tendered</label>
                    <select
                      value={splitCurrencyChoice}
                      onChange={(e) => setSplitCurrencyChoice(e.target.value as any)}
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      <option value="secondary">
                        {secondaryCode} ({secondarySymbol}) - Rate: {exchangeRate.toFixed(2)}
                      </option>
                      <option value="primary">
                        {primaryCode} ({primarySymbol}) - Base (1.00)
                      </option>
                      <option value="EUR">EUR (€) - Foreign Rate (14.60)</option>
                      <option value="GBP">GBP (£) - Foreign Rate (17.20)</option>
                      <option value="custom">Custom Foreign Currency…</option>
                    </select>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                      Amount in {getActiveSplitCurrencyDetails().code}
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                        {getActiveSplitCurrencyDetails().symbol}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={splitAmountInput}
                        onChange={(e) => setSplitAmountInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg pl-7 pr-2 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Currency Config row if selected */}
                {splitCurrencyChoice === 'custom' && (
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#1E293B]">
                    <div>
                      <label className="block text-[9px] text-slate-400">Currency Code</label>
                      <input
                        type="text"
                        placeholder="AUD, CAD..."
                        value={splitCustomCode}
                        onChange={(e) => setSplitCustomCode(e.target.value)}
                        className="w-full bg-[#0F1115] border border-[#1E293B] rounded p-1.5 text-xs text-white uppercase font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400">Symbol</label>
                      <input
                        type="text"
                        placeholder="$, ¥, A$..."
                        value={splitCustomSymbol}
                        onChange={(e) => setSplitCustomSymbol(e.target.value)}
                        className="w-full bg-[#0F1115] border border-[#1E293B] rounded p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400">Exchange Rate ({primaryCode})</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 0.92"
                        value={splitCustomRate}
                        onChange={(e) => setSplitCustomRate(e.target.value)}
                        className="w-full bg-[#0F1115] border border-[#1E293B] rounded p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Card Ref or Line Note */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Approval / Terminal Ref Code or Note (Optional)"
                    value={splitRef}
                    onChange={(e) => setSplitRef(e.target.value)}
                    className="flex-1 bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddSplitLine}
                    disabled={!splitAmountInput || parseFloat(splitAmountInput) <= 0}
                    className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Line</span>
                  </button>
                </div>

                {/* Conversion Preview note */}
                {splitAmountInput && parseFloat(splitAmountInput) > 0 && (
                  <div className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" />
                    <span>
                      {getActiveSplitCurrencyDetails().symbol}
                      {parseFloat(splitAmountInput).toFixed(2)} {getActiveSplitCurrencyDetails().code} equals{' '}
                      <strong>
                        {primarySymbol}{' '}
                        {(parseFloat(splitAmountInput) * getActiveSplitCurrencyDetails().rate).toFixed(2)}{' '}
                        {primaryCode}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={
                isProcessing ||
                (paymentMethod === 'cash' && isCashInsufficient) ||
                (paymentMethod === 'split' && isSplitInsufficient)
              }
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <span>Processing Register...</span>
              ) : isSplitInsufficient ? (
                <span>Remaining Due: {primarySymbol} {splitRemainingDuePrimary.toFixed(2)} (Add Payment Line)</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    {paymentMethod === 'split'
                      ? 'Process Sale with Split Payments'
                      : 'Process Sale & Print Receipt'}
                  </span>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </>
              )}
            </button>
          </div>
          </div>
        </form>
      </div>
    </div>
  );
};
