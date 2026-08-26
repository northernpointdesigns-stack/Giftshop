import { describe, it, expect } from 'vitest';
import { calculateCartTotals } from '../utils/currencyAndMath';
import type { InventoryItem } from '../types/pos';

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
