import { Customer, InventoryItem } from '../types/pos';

/**
 * Durable register basket snapshots.
 *
 * The POS renders one view at a time, so leaving the Register tab unmounts
 * CashierPOS and — without this — wipes the cashier's in-progress basket.
 * These helpers persist the working basket (plus discount and hold state)
 * to localStorage, keyed per register, so a basket survives:
 *   - navigating to Settings / Inventory / Reports / any other tab
 *   - switching between registers (each keeps its own basket)
 *   - an app crash or accidental close (power-cut safe)
 */

export interface PersistedCartLine {
  item: InventoryItem;
  quantity: number;
  isDamaged: boolean;
  damageDiscountPercent: number;
  resolvedPrice?: number;
  priceListName?: string;
  priceListType?: string;
}

export interface RegisterSnapshot {
  cart: PersistedCartLine[];
  discountType: 'amount' | 'percent';
  discountValue: number;
  heldCart: PersistedCartLine[] | null;
  attachedCustomer: Customer | null;
  savedAt: number;
}

const snapshotKey = (registerId: string) =>
  `giftshop:register-snapshot:${registerId || 'default'}`;

/** Rebuilds cart lines from JSON, refreshing item data from live inventory. */
function hydrateLines(raw: unknown, inventory: InventoryItem[]): PersistedCartLine[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map(inventory.map((i) => [i.id, i]));
  const lines: PersistedCartLine[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const stored = e.item && typeof e.item === 'object' ? (e.item as InventoryItem) : null;
    if (!stored || typeof stored.id !== 'string' || !stored.id) continue;
    // Prefer the live inventory record (fresh price/stock); if the product
    // was deleted (or inventory has not loaded yet), keep the stored copy
    // rather than silently losing the cashier's scanned line.
    const item = byId.get(stored.id) ?? stored;
    const resolved = e.resolvedPrice;
    lines.push({
      item,
      quantity: Math.max(1, Math.floor(Number(e.quantity) || 1)),
      isDamaged: e.isDamaged === true,
      damageDiscountPercent: Math.min(100, Math.max(0, Number(e.damageDiscountPercent) || 0)),
      resolvedPrice:
        typeof resolved === 'number' && Number.isFinite(resolved) ? resolved : undefined,
      priceListName: typeof e.priceListName === 'string' ? e.priceListName : undefined,
      priceListType: typeof e.priceListType === 'string' ? e.priceListType : undefined,
    });
  }
  return lines;
}

export function loadRegisterSnapshot(
  registerId: string,
  inventory: InventoryItem[]
): RegisterSnapshot | null {
  try {
    const raw = localStorage.getItem(snapshotKey(registerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      cart: hydrateLines(parsed.cart, inventory),
      discountType: parsed.discountType === 'percent' ? 'percent' : 'amount',
      discountValue: Math.max(0, Number(parsed.discountValue) || 0),
      heldCart: Array.isArray(parsed.heldCart)
        ? hydrateLines(parsed.heldCart, inventory)
        : null,
      attachedCustomer:
        parsed.attachedCustomer && typeof parsed.attachedCustomer === 'object'
          ? (parsed.attachedCustomer as Customer)
          : null,
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function saveRegisterSnapshot(registerId: string, snapshot: RegisterSnapshot): void {
  try {
    localStorage.setItem(snapshotKey(registerId), JSON.stringify(snapshot));
  } catch {
    // Storage unavailable (private mode/quota) — basket simply stays in memory.
  }
}

export function clearRegisterSnapshot(registerId: string): void {
  try {
    localStorage.removeItem(snapshotKey(registerId));
  } catch {
    // ignore
  }
}