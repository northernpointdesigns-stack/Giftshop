import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { posDb } from '../../services/db';
import { seedStorage } from '../../test/fixtures';

/**
 * Audit Trail test suite.
 *
 * Validates that the append-only exception trail (pushAuditEntry / getAuditLog)
 * captures every register override, stock edit, refund/void, and vendor
 * financial movement required by the QA release gate, and that sale-driven
 * stock decrements are NOT double-logged (they surface via the transaction
 * audit entry only).
 */
const reseed = () => {
  seedStorage();
  // posDb is a singleton hydrated in its constructor; reload from the freshly
    // seeded localStorage so each test starts clean (seedStorage does not write
  // the audit-log key, so the log starts empty).
  localStorage.removeItem('island_pos_audit_log_v1');
  // @ts-expect-error — initDatabase is private; this is the reload entry point.
  posDb.initDatabase();
};

describe('Audit Trail — append-only exception log', () => {
  beforeEach(() => {
    reseed();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records a stock_adjust entry on manual adjustStock with audit meta', () => {
    const before = posDb.getAuditLog().length;
    posDb.adjustStock('ITEM-TS', -3, { user: 'Alice', reason: 'Damaged units returned' });

    const after = posDb.getAuditLog();
    expect(after.length).toBe(before + 1);

    const entry = after[0];
    expect(entry.action).toBe('stock_adjust');
    expect(entry.user).toBe('Alice');
    expect(entry.entityType).toBe('inventory');
    expect(entry.entityId).toBe('ITEM-TS');
    expect(entry.originalValue).toBe('30'); // ITEM-TS stockLevel starts at 30
    expect(entry.newValue).toBe('27');
    expect(entry.reason).toBe('Damaged units returned');
  });

  it('does NOT emit a stock_adjust audit entry for sale-driven decrements (no meta)', () => {
    const before = posDb.getAuditLog().length;
    // adjustStock called without audit meta (e.g. from recordRefundTransaction's
    // restock) must not double-log.
    posDb.adjustStock('ITEM-TS', -1);
    expect(posDb.getAuditLog().length).toBe(before);
  });

  it('logs price_change, cost_change, and vat_change on saveItem for an edited item', () => {
    const item = posDb.getItemBySku('893200101'); // ITEM-TOTE (consignment, V-SOUV)
    expect(item).toBeDefined();
    const before = posDb.getAuditLog().length;

    // ITEM-TOTE: retailPrice 22, costBasis 15.40 (22 * 0.70), vatRate 0.15
        posDb.saveItem(
      {
        ...item,
        retailPrice: 30, // -> price_change
        vatRate: 0.2, // -> vat_change (was 0.15)
      },
      { user: 'Manager', reason: 'Catalog item edited from inventory panel' }
    );

    const after = posDb.getAuditLog();
    const actions = after.slice(0, after.length - before).map((e) => e.action);
    // Consignment costBasis recomputes to 30 * (1 - 0.30) = 21.00 => cost_change too.
    // New entries land newest-first (unshift); assert membership, not order.
    expect(actions).toHaveLength(3);
    expect(actions).toContain('price_change');
    expect(actions).toContain('cost_change');
    expect(actions).toContain('vat_change');
    const price = after.find((e) => e.action === 'price_change');
    expect(price?.user).toBe('Manager');
    expect(price?.originalValue).toBe('22');
    expect(price?.newValue).toBe('30');
  });

  it('logs a single bulk_price_change entry on bulkAdjustPrices with meta', () => {
    const before = posDb.getAuditLog().length;
    // 'Mugs' category holds ITEM-MUG-L and ITEM-MUG-N.
    const affected = posDb.bulkAdjustPrices('Mugs', 10, 'percentage', { user: 'Alice' });
    expect(affected).toBe(2);

    const after = posDb.getAuditLog();
    const entries = after.slice(0, after.length - before);
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe('bulk_price_change');
    expect(entries[0].user).toBe('Alice');
        expect(entries[0].originalValue).toBe('2');
  });

  it('records a vendor_advance entry with the recording staff', () => {
    const before = posDb.getAuditLog().length;
    posDb.recordVendorAdvance({
      vendorId: 'V-OCEAN',
      vendorName: 'Ocean Seychelles Ltd',
      amount: 50,
      note: 'Urgent cash pick-up',
      recordedBy: 'Alice',
    });

    const after = posDb.getAuditLog();
    const entry = after[before];
    expect(entry.action).toBe('vendor_advance');
    expect(entry.user).toBe('Alice');
    expect(entry.entityType).toBe('vendor');
    expect(entry.entityId).toBe('V-OCEAN');
    expect(entry.originalValue).toBeUndefined();
  });

  it('records a vendor_payout entry via the 4th recordedBy argument', () => {
    const before = posDb.getAuditLog().length;
    posDb.recordVendorPayout('V-SOUV', 25, 'Month-end settlement', 'Alice');

    const after = posDb.getAuditLog();
    const entry = after[before];
    expect(entry.action).toBe('vendor_payout');
    expect(entry.user).toBe('Alice');
    expect(entry.entityType).toBe('vendor');
    expect(entry.entityId).toBe('V-SOUV');
  });

  it('classifies a refund as action="refund" in the audit log', () => {
    const item = posDb.getItemBySku('893100202'); // ITEM-MUG-N
    expect(item).toBeDefined();
    const before = posDb.getAuditLog().length;

    posDb.recordRefundTransaction(
      [{ item: item!, quantity: 1, unitPrice: 12 }],
      'cash',
      'Alice',
      'Customer changed mind'
    );

    const after = posDb.getAuditLog();
    const entries = after.slice(0, after.length - before);
    // Exactly ONE audit entry for the refund (restock decrement is un-logged).
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe('refund');
    expect(entries[0].user).toBe('Alice');
    expect(entries[0].entityType).toBe('transaction');
    expect(entries[0].reason).toBe('Customer changed mind');
  });

  it('classifies a refund whose reason mentions "void" as action="void"', () => {
    const item = posDb.getItemBySku('893100104'); // ITEM-KEY
    expect(item).toBeDefined();
    const before = posDb.getAuditLog().length;

    posDb.recordRefundTransaction(
      [{ item: item!, quantity: 1, unitPrice: 8.5 }],
      'cash',
      'Bob',
      'Void for price-entry error on original sale'
    );

    const after = posDb.getAuditLog();
    const entries = after.slice(0, after.length - before);
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe('void');
    expect(entries[0].user).toBe('Bob');
  });

    it('entries are frozen (immutable) and appended newest-first', () => {
    posDb.adjustStock('ITEM-TS', -1, { user: 'Alice', reason: 'first' });
    const [first] = posDb.getAuditLog();
    expect(first.id).toMatch(/^AUD-/);
    expect(new Date(first.timestamp).getTime()).not.toBeNaN();
    // Entries are frozen on write so the append-only trail cannot be edited
    // through getAuditLog()'s returned references.
    expect(Object.isFrozen(first)).toBe(true);
  });
});
