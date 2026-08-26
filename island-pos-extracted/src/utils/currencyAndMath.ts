import { InventoryItem } from '../types/pos';

export interface CurrencyPreset {
  code: string;
  symbol: string;
  name: string;
  country: string;
  defaultRateToSCR: number; // reference baseline
  symbolPosition: 'before' | 'after';
  decimals: number;
}

export const INTERNATIONAL_CURRENCIES: CurrencyPreset[] = [
  { code: 'SCR', symbol: 'SR', name: 'Seychelles Rupee', country: 'Seychelles', defaultRateToSCR: 1.0, symbolPosition: 'before', decimals: 2 },
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'United States', defaultRateToSCR: 13.50, symbolPosition: 'before', decimals: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', country: 'European Union', defaultRateToSCR: 14.65, symbolPosition: 'before', decimals: 2 },
  { code: 'GBP', symbol: '£', name: 'British Pound', country: 'United Kingdom', defaultRateToSCR: 17.20, symbolPosition: 'before', decimals: 2 },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', country: 'South Africa', defaultRateToSCR: 0.74, symbolPosition: 'before', decimals: 2 },
  { code: 'MUR', symbol: 'Rs', name: 'Mauritian Rupee', country: 'Mauritius', defaultRateToSCR: 0.29, symbolPosition: 'before', decimals: 2 },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', country: 'United Arab Emirates', defaultRateToSCR: 3.68, symbolPosition: 'before', decimals: 2 },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', country: 'Saudi Arabia', defaultRateToSCR: 3.60, symbolPosition: 'before', decimals: 2 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', country: 'Australia', defaultRateToSCR: 8.85, symbolPosition: 'before', decimals: 2 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', country: 'Canada', defaultRateToSCR: 9.85, symbolPosition: 'before', decimals: 2 },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', country: 'Switzerland', defaultRateToSCR: 15.10, symbolPosition: 'before', decimals: 2 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', country: 'Japan', defaultRateToSCR: 0.088, symbolPosition: 'before', decimals: 0 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', country: 'China', defaultRateToSCR: 1.86, symbolPosition: 'before', decimals: 2 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', country: 'India', defaultRateToSCR: 0.16, symbolPosition: 'before', decimals: 2 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', country: 'Singapore', defaultRateToSCR: 10.10, symbolPosition: 'before', decimals: 2 },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', country: 'New Zealand', defaultRateToSCR: 8.20, symbolPosition: 'before', decimals: 2 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', country: 'Brazil', defaultRateToSCR: 2.45, symbolPosition: 'before', decimals: 2 },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', country: 'Thailand', defaultRateToSCR: 0.38, symbolPosition: 'before', decimals: 2 },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', country: 'Kenya', defaultRateToSCR: 0.10, symbolPosition: 'before', decimals: 2 },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', country: 'Nigeria', defaultRateToSCR: 0.009, symbolPosition: 'before', decimals: 2 },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', country: 'Ghana', defaultRateToSCR: 0.88, symbolPosition: 'before', decimals: 2 },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal', country: 'Qatar', defaultRateToSCR: 3.71, symbolPosition: 'before', decimals: 2 },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', country: 'Kuwait', defaultRateToSCR: 44.10, symbolPosition: 'before', decimals: 3 },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', country: 'Oman', defaultRateToSCR: 35.10, symbolPosition: 'before', decimals: 3 },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar', country: 'Bahrain', defaultRateToSCR: 35.80, symbolPosition: 'before', decimals: 3 },
];

export interface CartCalculationLine {
  item: InventoryItem;
  quantity: number;
  isDamaged?: boolean;
  damageDiscountPercent?: number;
  resolvedPrice?: number;
  priceListName?: string;
  priceListType?: string;
}

export interface CalculatedCartTotals {
  rawSubtotal: number;
  itemDiscountTotal: number;
  afterItemSubtotal: number;
  discountAmount: number;
  discountType: 'amount' | 'percent';
  discountValue: number;
  netSubtotal: number;
  vatTotal: number;
  roundedVat: number;
  grandTotal: number;
  // Secondary Currency Equivalent Totals
  secondarySubtotal: number;
  secondaryTax: number;
  secondaryTotal: number;
  secondaryDiscount: number;
  secondaryItemDiscount: number;
  exchangeRate: number;
}

/** Round monetary values using decimal-half-up behaviour, avoiding binary
 * floating-point cases such as 301.50 × 15% becoming 45.22. */
export const roundMoney = (amount: number): number =>
  Math.round((amount + Number.EPSILON * 100) * 100) / 100;

/**
 * Single source of truth for POS and Customer Display math.
 * Applies damaged good percentage markdowns first per item,
 * then applies order-level discount, proportional VAT on net subtotal,
 * and exact secondary currency equivalents with zero cent disparities.
 */
export function calculateCartTotals(
  cart: CartCalculationLine[],
  discountType: 'amount' | 'percent' = 'amount',
  discountValue: number = 0,
  defaultVatRate: number = 0.15,
  exchangeRate: number = 1,
  vatInclusive: boolean = false
): CalculatedCartTotals {
  const rate = exchangeRate > 0 ? exchangeRate : 1;

  const getLineBasePrice = (c: CartCalculationLine) =>
    c.resolvedPrice !== undefined && c.resolvedPrice !== null ? c.resolvedPrice : c.item.retailPrice;

  // 1. Raw gross subtotal with resolved tier price
  const rawSubtotal = roundMoney(
    cart.reduce((acc, c) => acc + getLineBasePrice(c) * c.quantity, 0)
  );

  // 2. Per-item damaged markdowns
  const itemDiscountTotal = roundMoney(
    cart.reduce((acc, c) => {
      const basePrice = getLineBasePrice(c);
      const pct = c.isDamaged ? (c.damageDiscountPercent ?? 50) : 0;
      return acc + (basePrice * c.quantity * pct) / 100;
    }, 0)
  );

  const afterItemSubtotal = Math.max(0, roundMoney(rawSubtotal - itemDiscountTotal));

  // 3. Order-level discount (percentage or fixed amount)
  const requestedDiscount =
    discountType === 'percent'
      ? roundMoney((afterItemSubtotal * (discountValue || 0)) / 100)
      : roundMoney(discountValue || 0);

  const discountAmount = Math.max(0, Math.min(requestedDiscount, afterItemSubtotal));
  const netSubtotal = Math.max(0, roundMoney(afterItemSubtotal - discountAmount));

  // 4. VAT calculation: proportional against net subtotal per line item's VAT rate.
  // Exclusive mode (default): prices are NET of tax -> VAT is added on top.
  // Inclusive mode: shelf prices already CONTAIN the tax -> VAT is extracted from the gross amount.
  const vatTotalRaw = cart.reduce((acc, c) => {
    const itemVatRate = c.item.vatRate ?? defaultVatRate;
    const basePrice = getLineBasePrice(c);
    const lineDamagePct = c.isDamaged ? (c.damageDiscountPercent ?? 50) : 0;
    const lineDamagedTotal = basePrice * c.quantity * (1 - lineDamagePct / 100);
    const itemDiscountRatio = afterItemSubtotal > 0 ? netSubtotal / afterItemSubtotal : 1;
    const effectiveItemTotal = lineDamagedTotal * itemDiscountRatio;
    if (vatInclusive) {
      return acc + (effectiveItemTotal - effectiveItemTotal / (1 + itemVatRate));
    }
    return acc + effectiveItemTotal * itemVatRate;
  }, 0);

  const roundedVat = roundMoney(vatTotalRaw);
  // In inclusive mode the customer pays exactly the discounted shelf price, so the
  // displayed "Subtotal (Net)" is the gross-after-discount minus the embedded VAT.
  const taxableSubtotal = vatInclusive
    ? Math.max(0, roundMoney(netSubtotal - roundedVat))
    : netSubtotal;
  const grandTotal = roundMoney(taxableSubtotal + roundedVat);

  // 5. Secondary currency conversion math (Guarantees Subtotal + Tax = Total)
  const secondarySubtotal = Number((taxableSubtotal / rate).toFixed(2));
  const secondaryTotal = Number((grandTotal / rate).toFixed(2));
  // Guarantee exact sum parity for secondary display
  const secondaryTax = Number((secondaryTotal - secondarySubtotal).toFixed(2));
  const secondaryDiscount = Number((discountAmount / rate).toFixed(2));
  const secondaryItemDiscount = Number((itemDiscountTotal / rate).toFixed(2));

  return {
    rawSubtotal,
    itemDiscountTotal,
    afterItemSubtotal,
    discountAmount,
    discountType,
    discountValue,
    netSubtotal: taxableSubtotal,
    vatTotal: roundedVat,
    roundedVat,
    grandTotal,
    secondarySubtotal,
    secondaryTax,
    secondaryTotal,
    secondaryDiscount,
    secondaryItemDiscount,
    exchangeRate: rate,
  };
}

/**
 * Computes the VAT amount for a single line total.
 * Exclusive mode (default): amount is NET of tax -> VAT = amount * rate.
 * Inclusive mode: amount is GROSS (tax already inside) -> VAT = amount - amount / (1 + rate).
 */
export function computeVatAmount(amount: number, rate: number, vatInclusive: boolean): number {
  if (vatInclusive && rate > -1) {
    const gross = Math.abs(amount);
    const vat = gross - gross / (1 + rate);
    return Number((amount < 0 ? -vat : vat).toFixed(2));
  }
  return Number((amount * rate).toFixed(2));
}
/**
 * Order verification math for the checkout/payment screen.
 *
 * Critical invariant: VAT is NEVER a discount. When VAT-inclusive pricing is
 * enabled the shelf prices already contain the tax, so the embedded VAT must
 * not be reported as money "saved". Only real reductions — damaged-goods
 * markdowns and manual order discounts — count as discounts/savings.
 */
export interface OrderVerificationInput {
  /** Tagged-price total (resolved price × quantity, before any reduction). */
  shelfValue: number;
  /** Damaged-goods markdown total (a real discount). */
  markdowns: number;
  /** Manual order-level discount (a real discount). */
  manualDiscount: number;
  /** Actual VAT amount for the cart (from calculateCartTotals). */
  vat: number;
  /** Grand total the customer pays (net + VAT in BOTH modes). */
  total: number;
  /** Whether VAT-inclusive pricing is enabled in settings. */
  vatInclusive: boolean;
  /** Fallback rate used only when the total carries no VAT at all. */
  defaultVatRate?: number;
  /** Add the tourist VAT refund estimate into Total Savings (tax-free option ticked). */
  includeTouristRefund?: boolean;
}

export interface OrderVerification {
  /** Real money off shelf prices (markdowns + manual discount). */
  totalDiscount: number;
  /** VAT ÷ net — the effective rate across the cart. */
  effectiveVatRate: number;
  /** 90% of VAT — estimate shown only when tourist tax-free export is ticked. */
  touristRefundEstimate: number;
  /** Same as totalDiscount — savings can only come from real reductions. */
  totalSavings: number;
  /** totalSavings as a percent of the shelf value (0–100). */
  savingsPercent: number;
  /** Convenience flag: any real discount present? */
  hasDiscounts: boolean;
}

export function computeOrderVerification(input: OrderVerificationInput): OrderVerification {
  const totalDiscount = roundMoney(Math.max(0, (input.markdowns || 0) + (input.manualDiscount || 0)));

  // net + VAT = total holds in both exclusive and inclusive modes.
  const net = Math.max(0, roundMoney(input.total - input.vat));
  const fallback =
    input.defaultVatRate && input.defaultVatRate > 0 ? input.defaultVatRate : 0.15;
  const effectiveVatRate = net > 0.005 ? Math.max(0, input.vat) / net : fallback;

  const touristRefundEstimate =
    input.vat > 0 ? computeTouristRefund(input.vat).netRefundAmount : 0;

  // Total savings = real reductions, plus the tourist VAT refund estimate when
  // the tax-free export option is chosen (money the customer gets back).
  const totalSavings = roundMoney(
    totalDiscount + (input.includeTouristRefund ? touristRefundEstimate : 0)
  );
  const savingsPercent =
    input.shelfValue > 0
      ? Math.min(100, Math.round((totalSavings / input.shelfValue) * 100))
      : 0;

  return {
    totalDiscount,
    effectiveVatRate,
    touristRefundEstimate,
    totalSavings,
    savingsPercent,
    hasDiscounts: totalDiscount > 0.005,
  };
}

/**
 * Tourist VAT tax-free export refund math — the SINGLE source of truth.
 * Both the checkout estimate and the Tax-Free Export certificate use this,
 * so the cashier's quoted figure and the printed payout can never drift
 * (not even by one cent).
 *
 * Refund = VAT actually paid, minus a processing fee (default 10%).
 */
export interface TouristRefund {
  /** The VAT amount the refund is calculated from. */
  grossVat: number;
  /** Processing fee retained (feePercent of the VAT). */
  adminFeeAmount: number;
  /** What the tourist actually receives. */
  netRefundAmount: number;
}

export function computeTouristRefund(vat: number, feePercent: number = 10): TouristRefund {
  const grossVat = Math.max(0, roundMoney(vat || 0));
  const adminFeeAmount = Number((grossVat * (feePercent / 100)).toFixed(2));
  const netRefundAmount = Number((grossVat - adminFeeAmount).toFixed(2));
  return { grossVat, adminFeeAmount, netRefundAmount };
}

/**
 * Safely resolves the VAT amount of a transaction for refund purposes.
 * - Prefers the stored vatTotal/tax (exact, from calculateCartTotals).
 * - A stored 0 is respected (zero-VAT sale → zero refund, never invented).
 * - Legacy records with neither field fall back to computing from the
 *   gross total with the store's configured rate, correctly extracting
 *   the embedded VAT when VAT-inclusive pricing is enabled.
 */
export function resolveTransactionVat(
  transaction: { vatTotal?: number; tax?: number; total: number },
  defaultVatRate: number,
  vatInclusive: boolean
): number {
  if (typeof transaction.vatTotal === 'number') return transaction.vatTotal;
  if (typeof transaction.tax === 'number') return transaction.tax;
  return computeVatAmount(transaction.total, defaultVatRate, vatInclusive);
}

/**
 * Formats a currency amount with symbol and code
 */
export function formatMoney(
  amount: number,
  symbol: string = 'SR',
  code?: string,
  decimals: number = 2
): string {
  const isNegative = amount < 0;
  const absFormatted = Math.abs(amount).toFixed(decimals);
  const prefix = isNegative ? '-' : '';
  if (code) {
    return `${prefix}${symbol} ${absFormatted} ${code}`;
  }
  return `${prefix}${symbol} ${absFormatted}`;
}

export function formatCurrency(
  amount: number,
  currencyCode: string = 'SCR',
  symbol: string = 'SR'
): string {
  return `${symbol} ${amount.toFixed(2)} ${currencyCode}`;
}

export interface EquivalentCurrency {
  code: string;
  symbol: string;
  rate: number;
  amount: number;
  formatted: string;
  label: string;
  color: string;
  isPrimary?: boolean;
  isSecondary?: boolean;
  isThird?: boolean;
}

/**
 * Single source of truth for Local (Primary), Secondary, and 3rd Currency equivalents.
 * Ensures Cashier POS, Checkout Modal, and Customer Display render identical multi-currency grand totals.
 */
export function getMultiCurrencyEquivalents(
  totalInPrimary: number,
  settings: {
    primaryCurrency?: string;
    primaryCurrencySymbol?: string;
    secondaryCurrency?: string;
    secondaryCurrencySymbol?: string;
    exchangeRate?: number;
    customerDisplayCurrencies?: { code: string; symbol: string; rate: number; enabled?: boolean }[];
  }
): EquivalentCurrency[] {
  const pCode = settings.primaryCurrency || 'USD';
  const pSymbol = settings.primaryCurrencySymbol || '$';
;

  const sCode = settings.secondaryCurrency || 'USD';
  const sSymbol = settings.secondaryCurrencySymbol || '$';
  const sRate = settings.exchangeRate && settings.exchangeRate > 0 ? settings.exchangeRate : 1;

  const primaryAmt = Number((totalInPrimary || 0).toFixed(2));
  const secondaryAmt = Number(((totalInPrimary || 0) / sRate).toFixed(2));

  const result: EquivalentCurrency[] = [
    {
      code: pCode,
      symbol: pSymbol,
      rate: 1.0,
      amount: primaryAmt,
      formatted: `${pSymbol} ${primaryAmt.toFixed(2)} ${pCode}`,
      label: 'Local Currency (Primary)',
      color: 'emerald',
      isPrimary: true,
    },
    {
      code: sCode,
      symbol: sSymbol,
      rate: sRate,
      amount: secondaryAmt,
      formatted: `${sSymbol} ${secondaryAmt.toFixed(2)} ${sCode}`,
      label: 'Secondary Currency',
      color: 'cyan',
      isSecondary: true,
    },
  ];

  // Extra reference currencies (3rd / 4th) appear ONLY when the shop
  // configures them — no fabricated defaults for unconfigured slots.
  const configured = settings.customerDisplayCurrencies || [];
  const enabledExtras = configured.filter(
    (c) => c.enabled !== false && c.code && c.code !== pCode && c.rate > 0
  );

  if (enabledExtras.length > 0) {
    enabledExtras.forEach((c, idx) => {
      const amt = Number(((totalInPrimary || 0) / c.rate).toFixed(2));
      result.push({
        code: c.code,
        symbol: c.symbol || c.code,
        rate: c.rate,
        amount: amt,
        formatted: `${c.symbol || c.code} ${amt.toFixed(2)} ${c.code}`,
        label: idx === 0 ? '3rd Currency' : `${idx + 3}rd Currency`,
        color: idx === 0 ? 'purple' : 'amber',
        isThird: idx === 0,
      });
    });
  }

  return result;
}
