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

const emptySnapshot = {
  cart: [],
  discountType: 'amount' as const,
  discountValue: 0,
  heldCarts: [],
  attachedCustomer: null,
  savedAt: 0,
};

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
      heldCarts: [
        {
          id: 'held-1',
          label: 'Customer A',
          lines: [line('i2', 1)],
          discountType: 'amount',
          discountValue: 5,
          attachedCustomerId: 'C1',
          attachedCustomerName: 'Tourist',
          heldAt: 5000,
        },
      ],
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
    expect(snap.heldCarts).toHaveLength(1);
    expect(snap.heldCarts[0].label).toBe('Customer A');
    expect(snap.heldCarts[0].lines).toHaveLength(1);
    expect(snap.heldCarts[0].lines[0].item.id).toBe('i2');
    expect(snap.heldCarts[0].attachedCustomerName).toBe('Tourist');
    expect(snap.heldCarts[0].heldAt).toBe(5000);
    expect(snap.attachedCustomer?.name).toBe('Tourist');
  });

  it('migrates a legacy single-slot heldCart into the heldCarts list', () => {
    localStorage.setItem(
      'giftshop:register-snapshot:REG-1',
      JSON.stringify({
        cart: [],
        discountType: 'amount',
        discountValue: 0,
        heldCart: [line('i9', 3)],
        attachedCustomer: null,
        savedAt: 987,
      })
    );
    const snap = loadRegisterSnapshot('REG-1', [item('i9', 12)])!;
    expect(snap.heldCarts).toHaveLength(1);
    expect(snap.heldCarts[0].label).toBe('Held Order');
    expect(snap.heldCarts[0].lines).toHaveLength(1);
    expect(snap.heldCarts[0].lines[0].item.id).toBe('i9');
    expect(snap.heldCarts[0].lines[0].quantity).toBe(3);
    expect(snap.heldCarts[0].lines[0].item.retailPrice).toBe(12); // refreshed from inventory
    expect(snap.heldCarts[0].heldAt).toBe(987);
  });

  it('refreshes item data from live inventory (price/stock updates apply)', () => {
    saveRegisterSnapshot('REG-1', { ...emptySnapshot, cart: [line('i1', 1)] });
    const fresh = item('i1', 99);
    (fresh as any).stockLevel = 7;
    const snap = loadRegisterSnapshot('REG-1', [fresh])!;
    expect(snap.cart[0].item.retailPrice).toBe(99);
    expect((snap.cart[0].item as any).stockLevel).toBe(7);
  });

  it('keeps the stored item when the product is missing from inventory (never loses a scanned line)', () => {
    saveRegisterSnapshot('REG-1', { ...emptySnapshot, cart: [line('ghost', 3)] });
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
      heldCarts: [],
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

  it('hydrates held carts defensively (sanitizes ids, labels, discounts and timestamps)', () => {
    localStorage.setItem(
      'giftshop:register-snapshot:REG-1',
      JSON.stringify({
        ...emptySnapshot,
        heldCarts: [
          null,
          'junk',
          {
            id: '',
            label: 5,
            lines: 'nope',
            discountType: 'percent',
            discountValue: -20,
            attachedCustomerId: 42,
            heldAt: 'bad',
          },
          { id: 'h-2', label: 'Customer B', lines: [line('i3', 2)] },
        ],
      })
    );
    const snap = loadRegisterSnapshot('REG-1', [item('i3', 4)])!;
    expect(snap.heldCarts).toHaveLength(1); // malformed entries skipped
    expect(snap.heldCarts[0].id).toBe('h-2');
    expect(snap.heldCarts[0].label).toBe('Customer B');
    expect(snap.heldCarts[0].lines[0].item.retailPrice).toBe(4);
    expect(snap.heldCarts[0].discountType).toBe('amount');
    expect(snap.heldCarts[0].discountValue).toBe(0);
    expect(snap.heldCarts[0].attachedCustomerId).toBeNull();
    expect(typeof snap.heldCarts[0].heldAt).toBe('number');
  });

  it('survives corrupted JSON', () => {
    localStorage.setItem('giftshop:register-snapshot:REG-1', '{not json');
    expect(loadRegisterSnapshot('REG-1', [])).toBeNull();
  });

  it('keeps registers isolated from each other', () => {
    saveRegisterSnapshot('REG-1', { ...emptySnapshot, cart: [line('i1', 1)] });
    saveRegisterSnapshot('REG-2', { ...emptySnapshot, cart: [line('i2', 4)] });
    const inv = [item('i1', 10), item('i2', 5)];
    expect(loadRegisterSnapshot('REG-1', inv)!.cart[0].item.id).toBe('i1');
    expect(loadRegisterSnapshot('REG-2', inv)!.cart[0].item.id).toBe('i2');
    expect(loadRegisterSnapshot('REG-3', inv)).toBeNull();
  });

  it('clearRegisterSnapshot removes the basket', () => {
    saveRegisterSnapshot('REG-1', emptySnapshot);
    clearRegisterSnapshot('REG-1');
    expect(loadRegisterSnapshot('REG-1', [])).toBeNull();
  });
});