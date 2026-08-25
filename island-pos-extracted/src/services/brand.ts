import { posDb } from './db';
import { StoreSettings } from '../types/pos';

/**
 * Central white-label branding resolution.
 *
 * The customer controls their brand via Admin → Whitelabeling:
 *   posAppName  — the software/product title (e.g. "The Gift Shop POS")
 *   storeName   — the physical shop's name (receipts, reports)
 *
 * Priority: posAppName > storeName > DEFAULT_BRAND. Never hardcode a
 * product name in UI code — import from here instead.
 */
export const DEFAULT_BRAND = 'The Gift Shop POS';
export const DEFAULT_STORE_NAME = 'The Gift Shop';

export function resolveBrandName(settings?: StoreSettings): string {
  const s = settings || posDb.getSettings();
  return s.posAppName?.trim() || s.storeName?.trim() || DEFAULT_BRAND;
}

export function resolveStoreName(settings?: StoreSettings): string {
  const s = settings || posDb.getSettings();
  return s.storeName?.trim() || DEFAULT_STORE_NAME;
}
