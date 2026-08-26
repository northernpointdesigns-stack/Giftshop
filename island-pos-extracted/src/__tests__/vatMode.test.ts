import { describe, it, expect } from 'vitest';
import type { InventoryItem } from '../types/pos';
import { calculateCartTotals, computeOrderVerification, computeTouristRefund, resolveTransactionVat } from '../utils/currencyAndMath';

const item = {
  id: 'i1',
  name: 'Mug',
  sku: 'S1',
  category: 'Mugs',
  retailPrice: 100,
  costBasis: 40,
  stockLevel: 10,
  vatRate: 0.15,
} as unknown as InventoryItem;
const cart = [{ item, quantity: 2 }];

describe('VAT modes', () => {
  it('exclusive adds VAT on top (default behaviour unchanged)', () => {
    const t = calculateCartTotals(cart, 'amount', 0, 0.15, 13.5);
    expect(t.netSubtotal).toBe(200);
    expect(t.vatTotal).toBe(30);
    expect(t.grandTotal).toBe(230);
  });

  it('inclusive extracts VAT so customer pays exactly the tagged price', () => {
    const t = calculateCartTotals(cart, 'amount', 0, 0.15, 13.5, true);
    expect(t.netSubtotal).toBeCloseTo(173.91, 2);
    expect(t.vatTotal).toBeCloseTo(26.09, 2);
    expect(t.grandTotal).toBe(200); // shelf price
    expect(t.secondarySubtotal + t.secondaryTax).toBeCloseTo(200 / 13.5, 1);
  });

  it('inclusive with order discount still totals the discounted shelf price', () => {
    const t = calculateCartTotals(cart, 'percent', 10, 0.15, 13.5, true);
    expect(t.grandTotal).toBe(180); // 10% off tagged 200
    expect(t.netSubtotal + t.vatTotal).toBeCloseTo(t.grandTotal, 2);
  });
});

describe('computeOrderVerification — checkout summary math', () => {
  it('REGRESSION: VAT-inclusive sale with no discounts reports zero discount/savings (no phantom SR 32.61, no fake SR 287.50)', () => {
    // The exact scenario from the field report: SR 250 payable, VAT-inclusive 15%.
    // Embedded VAT = 250 - 250/1.15 = 32.61 — old code reported it as a discount.
    const v = computeOrderVerification({
      shelfValue: 250,
      markdowns: 0,
      manualDiscount: 0,
      vat: 32.61,
      total: 250,
      vatInclusive: true,
      defaultVatRate: 0.15,
    });
    expect(v.totalDiscount).toBe(0);
    expect(v.totalSavings).toBe(0);
    expect(v.hasDiscounts).toBe(false);
    expect(v.savingsPercent).toBe(0);
    expect(v.effectiveVatRate).toBeCloseTo(0.15, 2);
  });

  it('exclusive mode with a real manual discount counts only the actual discount', () => {
    // Shelf 200 net, 10 off, VAT 15% added -> total 218.50, VAT 28.50
    const v = computeOrderVerification({
      shelfValue: 200,
      markdowns: 0,
      manualDiscount: 10,
      vat: 28.5,
      total: 218.5,
      vatInclusive: false,
      defaultVatRate: 0.15,
    });
    expect(v.totalDiscount).toBe(10);
    expect(v.totalSavings).toBe(10);
    expect(v.hasDiscounts).toBe(true);
    expect(v.savingsPercent).toBe(5);
    expect(v.effectiveVatRate).toBeCloseTo(0.15, 2);
  });

  it('damaged-goods markdown counts as a real discount in inclusive mode', () => {
    // Shelf 100, 50% damaged markdown -> pays 50 (VAT-inclusive), embedded VAT 6.52
    const v = computeOrderVerification({
      shelfValue: 100,
      markdowns: 50,
      manualDiscount: 0,
      vat: 6.52,
      total: 50,
      vatInclusive: true,
      defaultVatRate: 0.15,
    });
    expect(v.totalDiscount).toBe(50);
    expect(v.savingsPercent).toBe(50);
    expect(v.effectiveVatRate).toBeCloseTo(0.15, 2);
  });

  it('tourist refund estimate is 90% of the actual VAT', () => {
    const v = computeOrderVerification({
      shelfValue: 250,
      markdowns: 0,
      manualDiscount: 0,
      vat: 32.61,
      total: 250,
      vatInclusive: true,
      defaultVatRate: 0.15,
    });
    expect(v.touristRefundEstimate).toBeCloseTo(29.35, 2);
  });

  it('reports the truthful 0% when the sale genuinely carries no VAT', () => {
    const v = computeOrderVerification({
      shelfValue: 100,
      markdowns: 0,
      manualDiscount: 0,
      vat: 0,
      total: 100,
      vatInclusive: false,
      defaultVatRate: 0.15,
    });
    expect(v.effectiveVatRate).toBe(0); // nothing charged — display 0%, not the default
  });

  it('falls back to the default rate only in the degenerate empty-total case', () => {
    const v = computeOrderVerification({
      shelfValue: 0,
      markdowns: 0,
      manualDiscount: 0,
      vat: 0,
      total: 0,
      vatInclusive: false,
      defaultVatRate: 0.15,
    });
    expect(v.effectiveVatRate).toBeCloseTo(0.15, 2);
  });
});

describe('computeTouristRefund / resolveTransactionVat — tourist VAT math', () => {
  it('deducts the admin fee from the actual VAT (default 10%)', () => {
    const r = computeTouristRefund(32.61);
    expect(r.adminFeeAmount).toBe(3.26);
    expect(r.netRefundAmount).toBe(29.35);
  });

  it('supports a custom fee percentage', () => {
    const r = computeTouristRefund(30, 20);
    expect(r.adminFeeAmount).toBe(6);
    expect(r.netRefundAmount).toBe(24);
  });

  it('never returns a refund from zero VAT', () => {
    const r = computeTouristRefund(0);
    expect(r.grossVat).toBe(0);
    expect(r.netRefundAmount).toBe(0);
  });

  it('REGRESSION: respects a stored VAT of exactly 0 (no invented refund on VAT-exempt sales)', () => {
    const vat = resolveTransactionVat({ vatTotal: 0, tax: 0, total: 250 }, 0.15, true);
    expect(vat).toBe(0); // old code fell through to gross*0.15 = 37.50 phantom refund
  });

  it('REGRESSION: legacy record without stored VAT extracts embedded VAT in inclusive mode', () => {
    // gross 250 VAT-inclusive @15% -> embedded VAT is 32.61, NOT 250*0.15=37.50
    const vat = resolveTransactionVat({ total: 250 }, 0.15, true);
    expect(vat).toBeCloseTo(32.61, 2);
  });

  it('legacy record without stored VAT adds VAT in exclusive mode', () => {
    const vat = resolveTransactionVat({ total: 250 }, 0.15, false);
    expect(vat).toBeCloseTo(37.5, 2);
  });

  it('checkout estimate matches the certificate payout to the cent', () => {
    // The estimate quoted at checkout must equal what the certificate prints.
    const paidVat = 32.61;
    const estimate = computeTouristRefund(paidVat).netRefundAmount;
    const certificate = computeTouristRefund(paidVat, 10).netRefundAmount;
    expect(estimate).toBe(certificate);
  });
});
