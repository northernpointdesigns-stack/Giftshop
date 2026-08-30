/**
 * Scale & business-logic verification at ~8,000 SKUs.
 *
 * Timing asserts are generous upper bounds (CI machines vary); the printed
 * measurements are the real deliverable for the performance report.
 */
import { describe, it, expect } from 'vitest';
import { posDb } from '../services/db';
import type { InventoryItem } from '../types/pos';

const buildItems = (n: number): InventoryItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `PERF-${i}`,
    name: `Perf Product ${i} Widget${i % 3 === 0 ? ' Special' : ''}`,
    brand: i % 4 === 0 ? 'Unbranded' : `Brand-${i % 50}`,
    category: ['T-Shirts', 'Mugs', 'Bags', 'Souvenirs'][i % 4],
    productLine: `Line-${i % 20}`,
    size: ['S', 'M', 'L', 'One Size'][i % 4],
    variant: `V${i % 10}`,
    sku: `88000${String(i).padStart(6, '0')}`,
    barcode: `88000${String(i).padStart(6, '0')}`,
    stockLevel: (i % 40) + 1,
    minStockThreshold: 5,
    retailPrice: 10 + (i % 90),
    costBasis: 5 + (i % 40),
    vatRate: 0.15,
    vendorId: 'V-OCEAN',
    createdAt: new Date().toISOString(),
  })) as unknown as InventoryItem[];

describe('Scale: 8,000 SKU inventory', () => {
  const N = 8000;

  it('seeds, queries and transacts within interactive-time bounds', () => {
    const t0 = performance.now();
    posDb.saveBulkInventory(buildItems(N));
    const seedMs = performance.now() - t0;

    const t1 = performance.now();
    const all = posDb.getInventory();
    expect(all.length).toBe(N);
    const readMs = performance.now() - t1;

    // Name-substring scan (the POS grid filter path)
    const t2 = performance.now();
    const hits = all.filter((i) => i.name.includes('Special'));
    const searchMs = performance.now() - t2;
    expect(hits.length).toBe(Math.ceil(N / 3));

    // Barcode/SKU exact lookup
    const t3 = performance.now();
    for (let k = 0; k < 100; k++) {
      expect(posDb.getItemBySku(`88000${String(k * 7).padStart(6, '0')}`)).toBeTruthy();
    }
    const skuMs = performance.now() - t3;

    // Low-stock scan
    const t4 = performance.now();
    const low = posDb.getLowStockItems();
    const lowMs = performance.now() - t4;
    expect(low.length).toBeGreaterThan(0);

    console.log(
      `[PERF 8k] seed=${seedMs.toFixed(0)}ms read=${readMs.toFixed(0)}ms search=${searchMs.toFixed(1)}ms 100×skuLookup=${skuMs.toFixed(1)}ms lowStock=${lowMs.toFixed(1)}ms`
    );

    expect(seedMs).toBeLessThan(5000);
    expect(readMs).toBeLessThan(1000);
    expect(searchMs).toBeLessThan(500);
    expect(skuMs).toBeLessThan(2000);
    expect(lowMs).toBeLessThan(500);
  });

  it('checkout deducts stock exactly and never goes negative on oversell', () => {
    const target = posDb.getInventory().find((i) => i.id === 'PERF-1')!;
    const before = target.stockLevel;
    const buyQty = Math.min(3, before);

    const tx = posDb.recordTransaction(
      [{ item: target, quantity: buyQty }],
      'cash',
      'QA Bot',
      buyQty * 10
    );
    expect(tx.items[0].quantity).toBe(buyQty);
    expect(posDb.getItemBySku(target.sku)!.stockLevel).toBe(before - buyQty);

    // Oversell attempt: stock must floor at 0, never wrap negative
    const oversell = posDb.getInventory().find((i) => i.id === 'PERF-2')!;
    posDb.recordTransaction(
      [{ item: oversell, quantity: oversell.stockLevel + 999 }],
      'cash',
      'QA Bot',
      100
    );
    expect(posDb.getItemBySku(oversell.sku)!.stockLevel).toBe(0);
  });

  it('refund restocks inventory and mirrors the original amounts', () => {
    const item = posDb.getInventory().find((i) => i.id === 'PERF-3')!;
    const before = item.stockLevel;
    const sale = posDb.recordTransaction([{ item, quantity: 2 }], 'card', 'QA Bot', 100);
    const afterSale = posDb.getItemBySku(item.sku)!.stockLevel;
    expect(afterSale).toBe(before - 2);

    const refund = posDb.recordRefundTransaction(
      [{ item, quantity: 2 }],
      'cash',
      'QA Bot',
      'QA return',
      true,
      sale.receiptNumber,
      sale.id
    );
    expect(refund.isRefund).toBe(true);
    expect(refund.total).toBeCloseTo(-sale.total, 2);
    expect(posDb.getItemBySku(item.sku)!.stockLevel).toBe(before);
  });

  it('low-stock trigger fires after stock drops to the threshold', () => {
    const item = posDb.getInventory().find((i) => i.id === 'PERF-4')!;
    // Drive it down to exactly the threshold
    posDb.recordTransaction(
      [{ item, quantity: Math.max(0, item.stockLevel - item.minStockThreshold) }],
      'cash',
      'QA Bot',
      100
    );
    const low = posDb.getLowStockItems();
    expect(low.some((i) => i.id === item.id)).toBe(true);
  });
});
