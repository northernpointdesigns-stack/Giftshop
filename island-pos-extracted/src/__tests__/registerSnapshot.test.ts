import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadRegisterSnapshot,
  saveRegisterSnapshot,
  clearRegisterSnapshot,
} from '../services/registerSnapshot';
import type { InventoryItem } from '../types/pos';

const item = (id: string, price: number): InventoryItem =>
  ({ id, name: `Item ${id}`, sku: `SKU-${id}`, retailPrice: price }) as unknown as InventoryItem;

const line = (id: string, qty: number, extra: Record<string, unknown> = {}) => ({
  item: item(id, 10), // serialized plain object, as it arrives from JSON
  quantity: qty,
  isDamaged: false,
  damageDiscountPercent: 0,
  ...extra,
});

describe('registerSnapshot — durable register basket', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing saved for the register', () => {
    expect(loadRegisterSnapshot('REG-1', [])).toBeNull();
  });

  it('saves and restores the full basket state', () => {
    saveRegisterSnapshot('REG-1', {
      cart: [line('i1', 2, { resolvedPrice: 25 })],
      discountType: 'percent',
      discountValue: 10,
      heldCart: [line('i2', 1)],
      attachedCustomer: { id: 'C1', name: 'Tourist' } as any,
      savedAt: 123,
    });
    const snap = loadRegisterSnapshot('REG-1', [item('i1', 25), item('i2', 8)])!;
    expect(snap.cart).toHaveLength(1);
    expect(snap.cart[0].item.id).toBe('i1');
    expect(snap.cart[0].quantity).toBe(2);
    expect(snap.cart[0].resolvedPrice).toBe(25);
    expect(snap.discountType).toBe('percent');
    expect(snap.discountValue).toBe(10);
    expect(snap.heldCart).toHaveLength(1);
    expect(snap.attachedCustomer?.name).toBe('Tourist');
  });

  it('refreshes item data from live inventory (price/stock updates apply)', () => {
    saveRegisterSnapshot('REG-1', { cart: [line('i1', 1)], discountType: 'amount', discountValue: 0, heldCart: null, attachedCustomer: null, savedAt: 0 });
    const fresh = item('i1', 99);
    (fresh as any).stockLevel = 7;
    const snap = loadRegisterSnapshot('REG-1', [fresh])!;
    expect(snap.cart[0].item.retailPrice).toBe(99);
    expect((snap.cart[0].item as any).stockLevel).toBe(7);
  });

  it('keeps the stored item when the product is missing from inventory (never loses a scanned line)', () => {
    saveRegisterSnapshot('REG-1', { cart: [line('ghost', 3)], discountType: 'amount', discountValue: 0, heldCart: null, attachedCustomer: null, savedAt: 0 });
    const snap = loadRegisterSnapshot('REG-1', [])!; // inventory not loaded / product deleted
    expect(snap.cart).toHaveLength(1);
    expect(snap.cart[0].item.id).toBe('ghost');
    expect(snap.cart[0].quantity).toBe(3);
  });

  it('drops malformed entries and sanitizes bad quantities', () => {
    saveRegisterSnapshot('REG-1', {
      cart: [null, 'junk', { item: { id: 'i1' }, quantity: -5, isDamaged: 'yes', damageDiscountPercent: 300 }] as any,
      discountType: 'amount',
      discountValue: -50,
      heldCart: null,
      attachedCustomer: null,
      savedAt: 0,
    });
    const snap = loadRegisterSnapshot('REG-1', [item('i1', 10)])!;
    expect(snap.cart).toHaveLength(1);
    expect(snap.cart[0].quantity).toBe(1); // clamped
    expect(snap.cart[0].isDamaged).toBe(false);
    expect(snap.cart[0].damageDiscountPercent).toBe(100); // clamped
    expect(snap.discountValue).toBe(0);
  });

  it('survives corrupted JSON', () => {
    localStorage.setItem('giftshop:register-snapshot:REG-1', '{not json');
    expect(loadRegisterSnapshot('REG-1', [])).toBeNull();
  });

  it('keeps registers isolated from each other', () => {
    saveRegisterSnapshot('REG-1', { cart: [line('i1', 1)], discountType: 'amount', discountValue: 0, heldCart: null, attachedCustomer: null, savedAt: 0 });
    saveRegisterSnapshot('REG-2', { cart: [line('i2', 4)], discountType: 'amount', discountValue: 0, heldCart: null, attachedCustomer: null, savedAt: 0 });
    const inv = [item('i1', 10), item('i2', 5)];
    expect(loadRegisterSnapshot('REG-1', inv)!.cart[0].item.id).toBe('i1');
    expect(loadRegisterSnapshot('REG-2', inv)!.cart[0].item.id).toBe('i2');
    expect(loadRegisterSnapshot('REG-3', inv)).toBeNull();
  });

  it('clearRegisterSnapshot removes the basket', () => {
    saveRegisterSnapshot('REG-1', { cart: [line('i1', 1)], discountType: 'amount', discountValue: 0, heldCart: null, attachedCustomer: null, savedAt: 0 });
    clearRegisterSnapshot('REG-1');
    expect(loadRegisterSnapshot('REG-1', [])).toBeNull();
  });
});