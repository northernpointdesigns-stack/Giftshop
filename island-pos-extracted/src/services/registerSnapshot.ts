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

/**
 * A cart parked on hold so the cashier can serve the next customer without
 * losing the current one. Every register keeps a list of these; the cashier
 * can label each (e.g. "Customer A") and recall or discard them later.
 */
export interface HeldCartSnapshot {
  id: string;
  /** Editable label shown in the held-carts panel, e.g. "Customer A". */
  label: string;
  lines: PersistedCartLine[];
  discountType: 'amount' | 'percent';
  discountValue: number;
  attachedCustomerId?: string | null;
  attachedCustomerName?: string;
  /** Epoch ms when the cart was parked. */
  heldAt: number;
}

export interface RegisterSnapshot {
  cart: PersistedCartLine[];
  discountType: 'amount' | 'percent';
  discountValue: number;
  heldCarts: HeldCartSnapshot[];
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

    const savedAt = Number(parsed.savedAt) || 0;
    const discountType = parsed.discountType === 'percent' ? 'percent' : 'amount';
    const discountValue = Math.max(0, Number(parsed.discountValue) || 0);

    // Hydrate the per-register held-cart list.
    const heldCarts: HeldCartSnapshot[] = [];
    if (Array.isArray(parsed.heldCarts)) {
      for (const entry of parsed.heldCarts) {
        if (!entry || typeof entry !== 'object') continue;
        const h = entry as Record<string, unknown>;
        const lines = Array.isArray(h.lines) ? hydrateLines(h.lines, inventory) : [];
        if (lines.length === 0 && !Array.isArray(h.lines)) continue;
        heldCarts.push({
          id: typeof h.id === 'string' && h.id ? h.id : `held-${Date.now()}-${heldCarts.length}`,
          label: typeof h.label === 'string' && h.label ? h.label : 'Held Order',
          lines,
          discountType: h.discountType === 'percent' ? 'percent' : 'amount',
          discountValue: Math.max(0, Number(h.discountValue) || 0),
          attachedCustomerId:
            typeof h.attachedCustomerId === 'string' ? h.attachedCustomerId : null,
          attachedCustomerName:
            typeof h.attachedCustomerName === 'string' ? h.attachedCustomerName : undefined,
          heldAt: Number(h.heldAt) || savedAt || Date.now(),
        });
      }
    }

    // Migrate the legacy single-slot hold (heldCart) into the new list.
    if (heldCarts.length === 0 && Array.isArray(parsed.heldCart)) {
      const legacyLines = hydrateLines(parsed.heldCart, inventory);
      if (legacyLines.length > 0) {
        heldCarts.push({
          id: `legacy-held`,
          label: 'Held Order',
          lines: legacyLines,
          discountType,
          discountValue,
          attachedCustomerId: null,
          attachedCustomerName: undefined,
          heldAt: savedAt || Date.now(),
        });
      }
    }

    return {
      cart: hydrateLines(parsed.cart, inventory),
      discountType,
      discountValue,
      heldCarts,
      attachedCustomer:
        parsed.attachedCustomer && typeof parsed.attachedCustomer === 'object'
          ? (parsed.attachedCustomer as Customer)
          : null,
      savedAt,
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