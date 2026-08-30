import { describe, expect, it, beforeEach } from 'vitest';
import { posDb } from '../../services/db';
import { seedStorage } from '../../test/fixtures';

/**
 * Spec-driven scenario tests — map 1:1 to the QA_RELEASE_GATE.md acceptance
 * criteria and assert the user/timestamp/action/reason shape of the audit log.
 */
const reseed = () => {
  seedStorage();
  localStorage.removeItem('island_pos_audit_log_v1');
  // @ts-expect-error — initDatabase is private; reload entry point for the singleton.
  posDb.initDatabase();
};

describe('SEC-004 — Audit records include user, timestamp, action, and reason', () => {
  beforeEach(() => reseed());

  it('stock adjustment audit entry carries all four required fields', () => {
    posDb.adjustStock('ITEM-MUG-L', -2, {
      user: 'Cynthia',
      reason: 'Damaged goods written off',
    });

    const [entry] = posDb.getAuditLog();
    expect(entry).toBeDefined();
    expect(entry.user).toBe('Cynthia');
    expect(entry.action).toBe('stock_adjust');
    expect(entry.reason).toBe('Damaged goods written off');
    // timestamp must be a parseable ISO string (i.e. a real recorded moment).
    expect(new Date(entry.timestamp).getTime()).not.toBeNaN();
  });

  it('refund audit entry carries all four required fields', () => {
        const item = posDb.getItemBySku('893100201'); // ITEM-MUG-L
    expect(item).toBeDefined();

    posDb.recordRefundTransaction(
      [{ item: item!, quantity: 1 }],
      'cash',
      'Bob',
      'Customer returned defective product'
    );

    const [entry] = posDb.getAuditLog();
    expect(entry).toBeDefined();
    expect(entry.user).toBe('Bob');
    expect(entry.action).toBe('refund');
    expect(entry.reason).toBe('Customer returned defective product');
    expect(new Date(entry.timestamp).getTime()).not.toBeNaN();
  });
});

describe('FIN-011 — Refund reverses stock and is auditable without duplicating stock log', () => {
  beforeEach(() => reseed());

  it('restocks exactly once and emits exactly one refund audit entry', () => {
    const item = posDb.getItemBySku('893100202'); // ITEM-MUG-N, stockLevel 2
    expect(item).toBeDefined();
    const stockBefore = item!.stockLevel;
    const auditBefore = posDb.getAuditLog().length;

    posDb.recordRefundTransaction(
      [{ item: item!, quantity: 1 }],
      'cash',
      'Bob',
      'Customer changed mind'
    );

    const stockAfter = posDb.getItemBySku('893100202')!.stockLevel;
    expect(stockAfter).toBe(stockBefore + 1);
    // Only the refund itself is logged, not the restock decrement.
    expect(posDb.getAuditLog().length).toBe(auditBefore + 1);
    expect(posDb.getAuditLog()[0].action).toBe('refund');
  });
});
