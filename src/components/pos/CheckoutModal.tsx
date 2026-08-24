import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  Percent,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Sparkles,
  User,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { CartItem, Customer, Transaction } from '../../types/pos';
import { posDb } from '../../services/db';
import { soundService } from '../../services/audio';

interface CheckoutModalProps {
  cart: CartItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  secondaryTotal: number;
  attachedCustomer?: Customer | null;
  cashierName: string;
  isOpen: boolean;
  onClose: () => void;
  onCheckoutComplete: (tx: Transaction) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  cart,
  subtotal,
  taxTotal,
  discountTotal,
  total,
  secondaryTotal,
  attachedCustomer,
  cashierName,
  isOpen,
  onClose,
  onCheckoutComplete,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const exchangeRate = settings.exchangeRate || 13.50;

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash');
  // Payments are processed in the store's local currency. Other currencies
  // are shown on the customer display for reference only.
  const tenderCurrency = 'SCR';
  const [cashTenderedStr, setCashTenderedStr] = useState<string>('');
  const [cardAmountStr, setCardAmountStr] = useState<string>('');
  const [cashAmountStr, setCashAmountStr] = useState<string>('');
  const [redeemPoints, setRedeemPoints] = useState<boolean>(false);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState<number>(0);

  // Loyalty Points calculation: 100 points = 50 SCR discount
  useEffect(() => {
    if (redeemPoints && attachedCustomer && attachedCustomer.loyaltyPoints >= 100) {
      const maxDiscount = Math.floor(attachedCustomer.loyaltyPoints / 100) * 50;
      setLoyaltyDiscount(Math.min(maxDiscount, total));
    } else {
      setLoyaltyDiscount(0);
    }
  }, [redeemPoints, attachedCustomer, total]);

  const finalPayableTotal = Math.max(0, total - loyaltyDiscount);
  const finalPayableSecondary = Number((finalPayableTotal / exchangeRate).toFixed(2));

  // Initialize tender default
  useEffect(() => {
    setCashTenderedStr(finalPayableTotal.toFixed(2));
  }, [finalPayableTotal]);

  if (!isOpen) return null;

  const cashTenderedVal = parseFloat(cashTenderedStr) || 0;
  const cashTenderedInSCR = cashTenderedVal;

  const changeDueInSCR = Math.max(0, cashTenderedInSCR - finalPayableTotal);
  const isCashSufficient = cashTenderedInSCR >= finalPayableTotal - 0.01;

  // Preset bill buttons
  const cashPresetsSCR = [
    finalPayableTotal,
    Math.ceil(finalPayableTotal / 50) * 50,
    Math.ceil(finalPayableTotal / 100) * 100,
    Math.ceil(finalPayableTotal / 500) * 500,
    1000,
    2000,
  ].filter((val, idx, self) => val >= finalPayableTotal && self.indexOf(val) === idx).slice(0, 5);

  const handleProcessSale = () => {
    let finalTx: Omit<Transaction, 'id' | 'receiptNumber' | 'timestamp'>;

    const pointsToEarn = Math.floor(finalPayableTotal / 50); // 1 pt per 50 SCR
    const pointsToRedeem = redeemPoints && loyaltyDiscount > 0 ? (loyaltyDiscount / 50) * 100 : 0;

    if (paymentMethod === 'cash') {
      if (!isCashSufficient) {
        soundService.playErrorBeep();
        return;
      }
      finalTx = {
        items: cart,
        subtotal,
        discountTotal: discountTotal + loyaltyDiscount,
        taxTotal,
        total: finalPayableTotal,
        secondaryTotal: finalPayableSecondary,
        exchangeRateUsed: exchangeRate,
        paymentMethod: 'cash',
        cashTendered: cashTenderedVal,
        changeDue: Number(changeDueInSCR.toFixed(2)),
        cashTenderedCurrency: tenderCurrency,
        cashierName,
        customerId: attachedCustomer?.id,
        customerName: attachedCustomer?.name,
        customerPhone: attachedCustomer?.phone,
        loyaltyPointsEarned: pointsToEarn,
        loyaltyPointsRedeemed: pointsToRedeem,
        loyaltyDiscountApplied: loyaltyDiscount,
      };
    } else if (paymentMethod === 'card') {
      finalTx = {
        items: cart,
        subtotal,
        discountTotal: discountTotal + loyaltyDiscount,
        taxTotal,
        total: finalPayableTotal,
        secondaryTotal: finalPayableSecondary,
        exchangeRateUsed: exchangeRate,
        paymentMethod: 'card',
        cardAmount: finalPayableTotal,
        cashierName,
        customerId: attachedCustomer?.id,
        customerName: attachedCustomer?.name,
        customerPhone: attachedCustomer?.phone,
        loyaltyPointsEarned: pointsToEarn,
        loyaltyPointsRedeemed: pointsToRedeem,
        loyaltyDiscountApplied: loyaltyDiscount,
      };
    } else {
      // Split payment
      const splitCash = parseFloat(cashAmountStr) || 0;
      const splitCard = parseFloat(cardAmountStr) || 0;
      if (Math.abs(splitCash + splitCard - finalPayableTotal) > 0.5) {
        soundService.playErrorBeep();
        return;
      }
      finalTx = {
        items: cart,
        subtotal,
        discountTotal: discountTotal + loyaltyDiscount,
        taxTotal,
        total: finalPayableTotal,
        secondaryTotal: finalPayableSecondary,
        exchangeRateUsed: exchangeRate,
        paymentMethod: 'split',
        cashAmount: splitCash,
        cardAmount: splitCard,
        cashierName,
        customerId: attachedCustomer?.id,
        customerName: attachedCustomer?.name,
        customerPhone: attachedCustomer?.phone,
        loyaltyPointsEarned: pointsToEarn,
        loyaltyPointsRedeemed: pointsToRedeem,
        loyaltyDiscountApplied: loyaltyDiscount,
      };
    }

    try {
      const createdTx = posDb.recordTransaction(finalTx);
      soundService.playCashDrawerDing();
      onCheckoutComplete(createdTx);
      onClose();
    } catch {
      soundService.playErrorBeep();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0 my-auto">
        {/* Header */}
        <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Process Checkout Tender</h2>
              <p className="text-xs text-slate-400">
                {cart.length} items • Cashier: <strong className="text-slate-200">{cashierName}</strong>
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

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Payable Total Display Banner */}
          <div className="bg-[#0F1115] border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Amount Due
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400 mt-0.5">
                {primarySymbol} {finalPayableTotal.toFixed(2)}
              </div>
              <div className="text-xs text-cyan-400 font-mono mt-0.5">
                ≈ {secondarySymbol} {finalPayableSecondary.toFixed(2)} USD (Rate: {exchangeRate})
              </div>
            </div>

            {attachedCustomer && (
              <div className="text-right">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                  {attachedCustomer.membershipTier} Member
                </span>
                <div className="text-xs font-bold text-white mt-1">{attachedCustomer.name}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {attachedCustomer.loyaltyPoints} points available
                </div>
              </div>
            )}
          </div>

          {/* Loyalty Points Redemption Toggle */}
          {attachedCustomer && attachedCustomer.loyaltyPoints >= 100 && (
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold text-white">Redeem Loyalty Points Discount</span>
                  <p className="text-[11px] text-slate-400">
                    Use {Math.floor(attachedCustomer.loyaltyPoints / 100) * 100} points for{' '}
                    <span className="text-emerald-400 font-bold font-mono">
                      {primarySymbol}{' '}
                      {Math.min(Math.floor(attachedCustomer.loyaltyPoints / 100) * 50, total).toFixed(2)}{' '}
                      OFF
                    </span>
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={redeemPoints}
                onChange={(e) => setRedeemPoints(e.target.checked)}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          )}

          {/* Payment Method Selector Tabs */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                paymentMethod === 'cash'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/30'
                  : 'bg-[#0F1115] border-[#1E293B] text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Banknote className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-bold uppercase">Cash Tender</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                paymentMethod === 'card'
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950/30'
                  : 'bg-[#0F1115] border-[#1E293B] text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-5 h-5 text-cyan-400" />
              <span className="text-xs font-bold uppercase">Card / Terminal</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPaymentMethod('split');
                setCashAmountStr((finalPayableTotal / 2).toFixed(2));
                setCardAmountStr((finalPayableTotal / 2).toFixed(2));
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                paymentMethod === 'split'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-950/30'
                  : 'bg-[#0F1115] border-[#1E293B] text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Percent className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold uppercase">Split Tender</span>
            </button>
          </div>

          {/* Dynamic Tender Options */}
          {paymentMethod === 'cash' && (
            <div className="space-y-3 bg-[#0F1115] border border-[#1E293B] rounded-xl p-4">
               <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                 <span className="text-xs font-bold text-slate-300">Tender currency</span>
                 <span className="text-xs font-bold text-emerald-300">Seychelles Rupee (SCR)</span>
               </div>

              {/* Cash Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Cash Tendered ({tenderCurrency})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400 font-mono">
                     {primarySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={cashTenderedStr}
                    onChange={(e) => setCashTenderedStr(e.target.value)}
                    className="w-full bg-[#161B22] border border-[#1E293B] focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-lg font-mono font-bold text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Preset Quick Cash Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                 {cashPresetsSCR.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCashTenderedStr(preset.toFixed(2))}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono font-semibold text-slate-200 border border-slate-700 transition-colors"
                  >
                     {primarySymbol} {preset.toFixed(2)}
                  </button>
                ))}
              </div>

              {/* Change Due Breakdown */}
              <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Change Due to Customer:</span>
                <div className="text-right font-mono">
                  <div className="text-lg font-extrabold text-emerald-400">
                    {primarySymbol} {changeDueInSCR.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {paymentMethod === 'card' && (
            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 text-center space-y-2">
              <CreditCard className="w-8 h-8 text-cyan-400 mx-auto" />
              <div className="font-bold text-sm text-white">Present Card to POS Terminal</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Charge exact amount{' '}
                <strong className="text-white font-mono">
                  {primarySymbol} {finalPayableTotal.toFixed(2)}
                </strong>{' '}
                on card terminal. Tap "Complete Sale" once authorization receipt approves.
              </p>
            </div>
          )}

          {paymentMethod === 'split' && (
            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Cash Portion ({primarySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cashAmountStr}
                    onChange={(e) => {
                      setCashAmountStr(e.target.value);
                      const num = parseFloat(e.target.value) || 0;
                      setCardAmountStr(Math.max(0, finalPayableTotal - num).toFixed(2));
                    }}
                    className="w-full bg-[#161B22] border border-[#1E293B] focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Card Portion ({primarySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cardAmountStr}
                    onChange={(e) => {
                      setCardAmountStr(e.target.value);
                      const num = parseFloat(e.target.value) || 0;
                      setCashAmountStr(Math.max(0, finalPayableTotal - num).toFixed(2));
                    }}
                    className="w-full bg-[#161B22] border border-[#1E293B] focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-[#0F1115] border-t border-[#1E293B] p-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-all"
          >
            Cancel (Esc)
          </button>

          <button
            type="button"
            onClick={handleProcessSale}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/40"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Complete Sale & Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
};
