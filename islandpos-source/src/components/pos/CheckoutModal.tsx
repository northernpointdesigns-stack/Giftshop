import React, { useEffect, useState } from 'react';
import {
  X,
  CreditCard,
  DollarSign,
  Gift,
  CheckCircle2,
  Sparkles,
  UserCheck,
  Award,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Customer, InventoryItem, PaymentMethod, Transaction } from '../../types/pos';
import { posDb } from '../../services/db';
import { soundService } from '../../services/audio';
import { customerChannel } from '../../services/customerChannel';

interface CheckoutModalProps {
  cart: {
    item: InventoryItem;
    quantity: number;
    isDamaged?: boolean;
    damageDiscountPercent?: number;
  }[];
  subtotal: number;
  tax: number;
  discount: number;
  discountType?: 'amount' | 'percent';
  discountValue?: number;
  total: number;
  attachedCustomer?: Customer | null;
  onClose: () => void;
  onCompleteTransaction: (transaction: Transaction) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  cart,
  subtotal,
  tax,
  discount,
  discountType = 'amount',
  discountValue,
  total,
  attachedCustomer: initialCustomer,
  onClose,
  onCompleteTransaction,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashGivenInput, setCashGivenInput] = useState<string>('');
  const [cashierName, setCashierName] = useState<string>('Maya Cashier');
  const [isProcessing, setIsProcessing] = useState(false);

  // Store Settings for Currency
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 13.50;
  const allowSecondaryPayment = settings.allowPaymentInSecondary !== false;

  const [checkoutCurrency, setCheckoutCurrency] = useState<'primary' | 'secondary'>(() => settings.defaultCurrencyMode === 'secondary' ? 'secondary' : 'primary');

  useEffect(() => {
    // Keep the customer-facing window aligned with the cashier's active
    // tender currency while checkout is open.
    customerChannel.updateState({
      ...customerChannel.getCurrentState(),
      displayCurrency: checkoutCurrency,
    });
  }, [checkoutCurrency]);

  // Multi-Currency Math — always derived from the primary-currency totals at
  // the current admin-set exchange rate, so the cashier screen, checkout and
  // customer display always show identical converted amounts.
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

  const cashGivenNumber = parseFloat(cashGivenInput) || 0;
  const changeDue = Math.max(0, cashGivenNumber - activeTotal);
  const isCashInsufficient = paymentMethod === 'cash' && cashGivenNumber < activeTotal;

  // Change details in opposite currency if secondary is chosen
  const changeDueOpposite = checkoutCurrency === 'secondary'
    ? changeDue * exchangeRate
    : changeDue / exchangeRate;

  const handleQuickCash = (amount: number) => {
    setCashGivenInput(amount.toString());
  };

  const handleExactCash = () => {
    setCashGivenInput(activeTotal.toFixed(2));
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (paymentMethod === 'cash' && isCashInsufficient) {
      soundService.playErrorBeep();
      return;
    }

    setIsProcessing(true);

    // Play register chime
    soundService.playChaChing();

    // Trigger celebratory confetti
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
      // Convert secondary back to primary for base record if checkout was in
      // the secondary currency. Recording is synchronous, so delaying it
      // makes the register feel unresponsive and can invite duplicate clicks.
      const primaryCashGiven = checkoutCurrency === 'primary'
        ? cashGivenNumber
        : (paymentMethod === 'cash' ? cashGivenNumber * exchangeRate : undefined);

      const secondaryCashGiven = checkoutCurrency === 'secondary'
        ? cashGivenNumber
        : undefined;

      const secondaryChangeDue = checkoutCurrency === 'secondary'
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
        checkoutCurrency,
        secondaryCashGiven,
        secondaryChangeDue,
        totalSec,
        // Explicit ternary keeps the literal union even when prop typing degrades
        {
          type: discountType === 'percent' ? ('percent' as const) : ('amount' as const),
          value: discountValue ?? 0,
        }
      );
      setIsProcessing(false);
      onCompleteTransaction(tx);
    } catch (error) {
      setIsProcessing(false);
      soundService.playErrorBeep();
      alert(`Unable to complete this sale. ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-lg w-full p-6 text-[#E2E8F0] shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
          <div>
            <h2 className="text-xl font-bold text-[#E2E8F0] flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" /> Complete Sale
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select payment method & tender total amount
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Summary Pill */}
        <div className="my-4 bg-[#0F1115] p-4 rounded-xl border border-[#1E293B] flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Total Amount Due</div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {checkoutCurrency === 'primary' ? `${primarySymbol} ${total.toFixed(2)}` : `${secondarySymbol}${totalSec.toFixed(2)}`}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
              {checkoutCurrency === 'primary' ? (
                <>Subtotal: {primarySymbol} {subtotal.toFixed(2)} | Tax: {primarySymbol} {tax.toFixed(2)} {discount > 0 ? `| Disc: -${primarySymbol} ${discount.toFixed(2)}` : ''}</>
              ) : (
                <>Subtotal: {secondarySymbol}{subtotalSec.toFixed(2)} | Tax: {secondarySymbol}{taxSec.toFixed(2)} {discount > 0 ? `| Disc: -${secondarySymbol}${discountSec.toFixed(2)}` : ''}</>
              )}
            </div>
            {/* Show other currency reference */}
            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-slate-500">Converted Reference:</span>
              <span className="font-mono font-bold text-slate-300">
                {checkoutCurrency === 'primary' ? `${secondarySymbol}${totalSec.toFixed(2)} ${secondaryCode}` : `${primarySymbol} ${total.toFixed(2)} ${primaryCode}`}
              </span>
              <span className="text-[9px] text-slate-600">(1 {secondaryCode} = {primarySymbol} {exchangeRate.toFixed(2)})</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Items Count</div>
            <div className="text-lg font-bold text-[#E2E8F0]">
              {cart.reduce((sum, c) => sum + c.quantity, 0)} Units
            </div>
          </div>
        </div>

        {/* Checkout Currency Switcher */}
        {allowSecondaryPayment && (
          <div className="mb-4 flex items-center justify-between p-2.5 bg-slate-800/30 border border-slate-700/50 rounded-xl">
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
              <div className="text-[11px] text-slate-400 font-semibold mb-1">Select Customer for Loyalty Points:</div>
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
                      selectedCustomer?.id === c.id ? 'bg-emerald-600/20 text-emerald-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{c.name} ({c.phone})</span>
                    <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-0.5">
                      <Award className="w-3 h-3" /> {c.loyaltyPoints} pts
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmitPayment} className="space-y-4">
          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
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

          {/* Cash Details */}
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
                    {activeSymbol}{amt}
                  </button>
                ))}
              </div>

              {/* Change Due Output */}
              <div className="pt-2 border-t border-[#1E293B] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Change Due to Customer ({activeSymbol}):</span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      isCashInsufficient ? 'text-rose-400' : (checkoutCurrency === 'primary' ? 'text-emerald-400' : 'text-cyan-400')
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

          {/* Cashier Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Active Cashier Processing Sale
            </label>
            <select
              value={cashierName}
              onChange={(e) => setCashierName(e.target.value)}
              className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-medium"
            >
              {posDb.getActiveCashiers().map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} ({c.role.replace('_', ' ')})
                </option>
              ))}
              <option value="Maya Cashier">Maya Cashier (Standard)</option>
            </select>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isProcessing || (paymentMethod === 'cash' && isCashInsufficient)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <span>Processing Register...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Process Sale & Print Receipt</span>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
