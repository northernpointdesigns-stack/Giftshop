import { Transaction, InventoryItem, StoreSettings } from '../types/pos';
import { posDb } from './db';

export interface AuditIssue {
  type: 'error' | 'warning' | 'info';
  category: 'math' | 'payment' | 'catalog' | 'refund' | 'consignment' | 'currency';
  title: string;
  description: string;
  suggestedAction?: string;
}

export interface ItemAuditResult {
  itemId: string;
  sku: string;
  name: string;
  brand?: string;
  quantity: number;
  paidUnitPrice: number;
  currentCatalogPrice?: number;
  priceDriftAmount?: number;
  priceDriftPercent?: number;
  isDamaged?: boolean;
  damageDiscountPercent?: number;
  lineTotal: number;
  vatRate: number;
  vatAmount: number;
  refundedQuantity: number;
  remainingQuantity: number;
  issues: AuditIssue[];
}

export interface ReceiptAuditReport {
  receiptNumber: string;
  transaction: Transaction;
  auditTimestamp: string;
  
  // Overall Verdict
  status: 'passed' | 'warning' | 'discrepancy';
  overallScore: number; // 0 - 100
  totalDiscrepancyAmount: number;
  summary: string;

  // Main Currency Declaration
  mainCurrencyCode: string;
  mainCurrencySymbol: string;
  settlementCurrencyCode: string;
  isSecondarySettlement: boolean;
  appliedExchangeRate?: number;

  // Math Verification
  recalculatedSubtotal: number;
  recalculatedVat: number;
  recalculatedDiscount: number;
  recalculatedTotal: number;
  mathDiscrepancy: number;

  // Payment Verification
  tenderExpectedChange: number;
  tenderRecordedChange: number;
  tenderDiscrepancy: number;

  // Return & Refund Ledger
  isRefunded: boolean;
  refundTransactions: Transaction[];
  totalRefundedAmount: number;
  remainingRefundableAmount: number;
  fullyRefunded: boolean;

  // Itemized Drift & Analysis
  itemAudits: ItemAuditResult[];
  issues: AuditIssue[];
}

export const auditReceiptTransaction = (
  tx: Transaction,
  inventory: InventoryItem[],
  settings?: StoreSettings
): ReceiptAuditReport => {
  const storeSettings = settings || posDb.getSettings();
  const primaryCode = storeSettings.primaryCurrency || 'SCR';
  const primarySymbol = storeSettings.primaryCurrencySymbol || 'SR';
  const secondaryCode = storeSettings.secondaryCurrency || 'USD';
  const secondarySymbol = storeSettings.secondaryCurrencySymbol || '$';
  const exchangeRate = storeSettings.exchangeRate || 13.50;

  const issues: AuditIssue[] = [];
  let totalDiscrepancyAmount = 0;

  // 1. Math Verification
  let computedSubtotal = 0;
  let computedItemDiscounts = 0;
  let computedVat = 0;

  tx.items.forEach((item) => {
    const rawLine = item.unitPrice * Math.abs(item.quantity);
    computedSubtotal += rawLine;
    if (item.discountAmount) {
      computedItemDiscounts += item.discountAmount;
    }
    if (item.vatAmount !== undefined) {
      computedVat += item.vatAmount;
    } else {
      const rate = item.vatRate ?? (storeSettings.defaultVatRate || 0.15);
      if (storeSettings.vatInclusive) {
        // Prices include VAT: extract the embedded tax portion
        computedVat += Math.abs(item.totalPrice) - Math.abs(item.totalPrice) / (1 + rate);
      } else {
        computedVat += (item.totalPrice * rate);
      }
    }
  });

  const orderDiscount = tx.discount || 0;
  const totalDiscounts = computedItemDiscounts + orderDiscount;
  const netSubtotal = computedSubtotal - totalDiscounts;
  // Exclusive mode: total = net subtotal + VAT on top.
  // Inclusive mode: line prices are gross, so the payable total IS the discounted sum.
  const computedTotal = storeSettings.vatInclusive
    ? Number(netSubtotal.toFixed(2))
    : Number((netSubtotal + computedVat).toFixed(2));
  const recordedTotal = Number(Math.abs(tx.total).toFixed(2));

  const mathDelta = Math.abs(computedTotal - recordedTotal);
  if (mathDelta > 0.02) {
    totalDiscrepancyAmount += mathDelta;
    issues.push({
      type: 'error',
      category: 'math',
      title: 'Arithmetic Total Mismatch',
      description: `Calculated total (${primarySymbol} ${computedTotal.toFixed(2)}) differs from recorded receipt total (${primarySymbol} ${recordedTotal.toFixed(2)}) by ${primarySymbol} ${mathDelta.toFixed(2)}.`,
      suggestedAction: 'Review line item discounts and VAT rate configuration.',
    });
  }

  // 2. Payment Tender & Change Verification
  let tenderExpectedChange = 0;
  let tenderRecordedChange = tx.changeDue || 0;
  let tenderDiscrepancy = 0;

  if (tx.splitPayments && tx.splitPayments.length > 0) {
    const totalSplitPaidPrimary = tx.splitPayments.reduce((acc, p) => acc + p.amountInPrimary, 0);
    if (totalSplitPaidPrimary < tx.total - 0.02) {
      const underpay = tx.total - totalSplitPaidPrimary;
      issues.push({
        type: 'error',
        category: 'payment',
        title: 'Insufficient Split Payment Tendered',
        description: `Split payment total (${primarySymbol} ${totalSplitPaidPrimary.toFixed(2)}) is less than total due (${primarySymbol} ${tx.total.toFixed(2)}). Underpayment of ${primarySymbol} ${underpay.toFixed(2)}.`,
        suggestedAction: 'Collect remaining balance or issue credit note.',
      });
      totalDiscrepancyAmount += underpay;
    }
  } else if (tx.paymentMethod === 'cash' && tx.cashGiven !== undefined) {
    tenderExpectedChange = Math.max(0, Number((tx.cashGiven - tx.total).toFixed(2)));
    tenderDiscrepancy = Math.abs(tenderExpectedChange - tenderRecordedChange);

    if (tx.cashGiven < tx.total) {
      issues.push({
        type: 'error',
        category: 'payment',
        title: 'Insufficient Cash Tendered',
        description: `Cash received (${primarySymbol} ${tx.cashGiven.toFixed(2)}) is less than total due (${primarySymbol} ${tx.total.toFixed(2)}). Underpayment of ${primarySymbol} ${(tx.total - tx.cashGiven).toFixed(2)}.`,
        suggestedAction: 'Verify if a split payment or manual discount was omitted.',
      });
      totalDiscrepancyAmount += (tx.total - tx.cashGiven);
    } else if (tenderDiscrepancy > 0.02) {
      issues.push({
        type: 'warning',
        category: 'payment',
        title: 'Change Due Calculation Variance',
        description: `Recorded change due (${primarySymbol} ${tenderRecordedChange.toFixed(2)}) does not match expected arithmetic change (${primarySymbol} ${tenderExpectedChange.toFixed(2)}).`,
        suggestedAction: 'Check drawer shift logs for cashier cash count balancing.',
      });
    }
  }

  // 3. Multi-Currency Settlement Verification
  const isSecondary = tx.currencyUsed === 'secondary' && !!tx.secondaryTotal;
  if (isSecondary && tx.secondaryTotal) {
    const rateUsed = tx.exchangeRateUsed || exchangeRate;
    const convertedFromSecondary = Number((tx.secondaryTotal * rateUsed).toFixed(2));
    const secondaryVariance = Math.abs(convertedFromSecondary - recordedTotal);
    if (secondaryVariance > 0.1) {
      issues.push({
        type: 'warning',
        category: 'currency',
        title: 'Foreign Exchange Rate Variance',
        description: `Foreign currency amount (${secondarySymbol} ${tx.secondaryTotal.toFixed(2)} ${secondaryCode}) at rate ${rateUsed} equates to ${primarySymbol} ${convertedFromSecondary.toFixed(2)}, differing from base total ${primarySymbol} ${recordedTotal.toFixed(2)} by ${primarySymbol} ${secondaryVariance.toFixed(2)}.`,
        suggestedAction: 'Verify exchange rate lock timestamp.',
      });
    }
  }

  // 4. Refund / Return History Lookup
  const allTx = posDb.getTransactions();
  const linkedRefunds = allTx.filter(
    (t) =>
      t.isRefund &&
      (t.originalReceiptNumber === tx.receiptNumber || t.originalTransactionId === tx.id)
  );

  let totalRefundedAmount = 0;
  const refundedQuantityMap: Record<string, number> = {};

  linkedRefunds.forEach((rTx) => {
    totalRefundedAmount += Math.abs(rTx.total);
    rTx.items.forEach((rItem) => {
      refundedQuantityMap[rItem.itemId] = (refundedQuantityMap[rItem.itemId] || 0) + Math.abs(rItem.quantity);
    });
  });

  const remainingRefundableAmount = Math.max(0, recordedTotal - totalRefundedAmount);
  const fullyRefunded = linkedRefunds.length > 0 && remainingRefundableAmount <= 0.01;

  if (totalRefundedAmount > recordedTotal + 0.02) {
    issues.push({
      type: 'error',
      category: 'refund',
      title: 'Excess Refund Discrepancy',
      description: `Total refunds processed against this receipt (${primarySymbol} ${totalRefundedAmount.toFixed(2)}) exceed the original sale total (${primarySymbol} ${recordedTotal.toFixed(2)}).`,
      suggestedAction: 'Investigate duplicate refund vouchers.',
    });
    totalDiscrepancyAmount += (totalRefundedAmount - recordedTotal);
  }

  // 5. Itemized Analysis & Catalog Price Drift
  const itemAudits: ItemAuditResult[] = tx.items.map((txItem) => {
    const itemIssues: AuditIssue[] = [];
    const invMatch = inventory.find((i) => i.id === txItem.itemId || i.sku === txItem.sku);
    const catalogPrice = invMatch ? invMatch.retailPrice : undefined;
    const paidPrice = txItem.unitPrice;
    
    let priceDriftAmount: number | undefined;
    let priceDriftPercent: number | undefined;

    if (catalogPrice !== undefined && Math.abs(catalogPrice - paidPrice) > 0.01) {
      priceDriftAmount = Number((catalogPrice - paidPrice).toFixed(2));
      priceDriftPercent = Number(((priceDriftAmount / paidPrice) * 100).toFixed(1));

      if (txItem.isDamaged) {
        itemIssues.push({
          type: 'info',
          category: 'catalog',
          title: 'Damaged Markdown Applied',
          description: `Item was discounted by ${txItem.damageDiscountPercent || 0}% from standard price of ${primarySymbol} ${catalogPrice.toFixed(2)}.`,
        });
      } else {
        itemIssues.push({
          type: 'info',
          category: 'catalog',
          title: 'Catalog Price Drift',
          description: `Current live inventory price is ${primarySymbol} ${catalogPrice.toFixed(2)} (difference of ${priceDriftAmount > 0 ? '+' : ''}${primarySymbol} ${priceDriftAmount.toFixed(2)} / ${priceDriftPercent}% since sale).`,
        });
      }
    }

    const refundedQty = refundedQuantityMap[txItem.itemId] || 0;
    const remainingQty = Math.max(0, Math.abs(txItem.quantity) - refundedQty);

    if (refundedQty > Math.abs(txItem.quantity)) {
      itemIssues.push({
        type: 'error',
        category: 'refund',
        title: 'Over-Refunded Quantity',
        description: `Returned ${refundedQty} units when only ${Math.abs(txItem.quantity)} were purchased.`,
      });
    }

    // Consignment check
    if (txItem.supplierType === 'consignment') {
      const payout = txItem.vendorPayoutAmount || 0;
      const profit = txItem.houseProfitAmount || 0;
      const splitSum = Number((payout + profit).toFixed(2));
      const lineTotal = Number(txItem.totalPrice.toFixed(2));
      if (Math.abs(splitSum - lineTotal) > 0.02) {
        itemIssues.push({
          type: 'warning',
          category: 'consignment',
          title: 'Consignment House/Vendor Split Drift',
          description: `Vendor payout (${primarySymbol} ${payout.toFixed(2)}) + House Commission (${primarySymbol} ${profit.toFixed(2)}) = ${primarySymbol} ${splitSum.toFixed(2)}, differing from Line Total ${primarySymbol} ${lineTotal.toFixed(2)}.`,
        });
      }
    }

    return {
      itemId: txItem.itemId,
      sku: txItem.sku,
      name: txItem.name,
      brand: txItem.brand,
      quantity: Math.abs(txItem.quantity),
      paidUnitPrice: paidPrice,
      currentCatalogPrice: catalogPrice,
      priceDriftAmount,
      priceDriftPercent,
      isDamaged: txItem.isDamaged,
      damageDiscountPercent: txItem.damageDiscountPercent,
      lineTotal: txItem.totalPrice,
      vatRate: txItem.vatRate ?? 0.15,
      vatAmount: txItem.vatAmount ?? 0,
      refundedQuantity: refundedQty,
      remainingQuantity: remainingQty,
      issues: itemIssues,
    };
  });

  // Calculate Overall Status & Score
  const errorCount = issues.filter((i) => i.type === 'error').length;
  const warningCount = issues.filter((i) => i.type === 'warning').length;

  let status: 'passed' | 'warning' | 'discrepancy' = 'passed';
  let score = 100;

  if (errorCount > 0) {
    status = 'discrepancy';
    score = Math.max(20, 100 - errorCount * 30 - warningCount * 10);
  } else if (warningCount > 0) {
    status = 'warning';
    score = Math.max(65, 100 - warningCount * 15);
  }

  let summary = 'Zero discrepancies found. All arithmetic, taxes, and tender balance perfectly with the store ledger.';
  if (status === 'discrepancy') {
    summary = `Discrepancy detected: ${errorCount} critical math/tender error(s) identified with total variance of ${primarySymbol} ${totalDiscrepancyAmount.toFixed(2)}.`;
  } else if (status === 'warning') {
    summary = `Audit completed with ${warningCount} advisory notice(s). General ledger and totals are consistent.`;
  }

  return {
    receiptNumber: tx.receiptNumber,
    transaction: tx,
    auditTimestamp: new Date().toISOString(),
    status,
    overallScore: score,
    totalDiscrepancyAmount,
    summary,
    mainCurrencyCode: primaryCode,
    mainCurrencySymbol: primarySymbol,
    settlementCurrencyCode: isSecondary ? secondaryCode : primaryCode,
    isSecondarySettlement: isSecondary,
    appliedExchangeRate: tx.exchangeRateUsed || exchangeRate,
    recalculatedSubtotal: computedSubtotal,
    recalculatedVat: computedVat,
    recalculatedDiscount: totalDiscounts,
    recalculatedTotal: computedTotal,
    mathDiscrepancy: mathDelta,
    tenderExpectedChange,
    tenderRecordedChange,
    tenderDiscrepancy,
    isRefunded: linkedRefunds.length > 0,
    refundTransactions: linkedRefunds,
    totalRefundedAmount,
    remainingRefundableAmount,
    fullyRefunded,
    itemAudits,
    issues,
  };
};
