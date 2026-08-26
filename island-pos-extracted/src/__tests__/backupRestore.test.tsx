import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { posDb } from '../services/db';
import {
  generateSQLiteDatabaseDump,
  extractSqliteManifest,
} from '../utils/sqliteExport';
import {
  INVENTORY,
  TRANSACTIONS,
  VENDORS,
  EOD_SESSIONS,
  DRAWER_LOGS,
  SETTINGS,
} from '../test/fixtures';

/**
 * The bug this guards against: on till close the app auto-produces a .db file
 * containing a SQLite SQL dump. importBackup() used to treat that as JSON (and
 * fail) or only restore the settings table. Now the dump embeds a lossless JSON
 * manifest and importBackup() restores the full dataset, so a produced backup
 * file restores just like the JSON export.
 */
describe('backup/restore round-trip (till-close .db dump)', () => {
  // Snapshot the fixture-seeded state once (setup.ts runs before this module).
  // posDb is a shared singleton, so restore the exact fixture state after each
  // test to avoid corrupting the other report suites that depend on it.
  const ORIGINAL = posDb.exportBackup();

  beforeEach(() => {
    // Reset the in-memory store back to defaults so each test starts clean.
    posDb.resetToDefault();
  });

  afterEach(() => {
    // Put the shared singleton + localStorage back to the seeded fixtures.
    posDb.importBackup(ORIGINAL);
  });

  it('embeds a lossless manifest that matches the source data', () => {
    const dump = generateSQLiteDatabaseDump({
      vendors: VENDORS,
      inventory: INVENTORY,
      transactions: TRANSACTIONS,
      payouts: [],
      eodSessions: EOD_SESSIONS,
      drawerLogs: DRAWER_LOGS,
      settings: SETTINGS as any,
      staff: [],
      categories: [],
      customers: [],
      vendorAdvances: [],
      invoices: [],
      exportedAt: '2026-08-26T10:00:00.000Z',
    });

    expect(dump).toContain('backup_manifest');

    const manifest = extractSqliteManifest(dump)!;
    expect(manifest).not.toBeNull();
    expect((manifest as any).transactions).toHaveLength(TRANSACTIONS.length);
    expect((manifest as any).transactions[0].receiptNumber).toBe(TRANSACTIONS[0].receiptNumber);
    expect((manifest as any).inventory).toHaveLength(INVENTORY.length);
    expect((manifest as any).settings.storeName).toBe(SETTINGS.storeName);
  });

  it('imports a till-close-style .db dump and fully restores datasets', () => {
    const dump = generateSQLiteDatabaseDump({
      vendors: VENDORS,
      inventory: INVENTORY,
      transactions: TRANSACTIONS,
      payouts: [],
      eodSessions: EOD_SESSIONS,
      settings: { ...(SETTINGS as any), storeName: 'Restored Gift Shop', primaryCurrencySymbol: 'SR' },
      staff: [],
      categories: [],
      drawerLogs: DRAWER_LOGS,
      customers: [],
      vendorAdvances: [],
      invoices: [],
      exportedAt: new Date().toISOString(),
    });

    posDb.resetToDefault();
    const res = posDb.importBackup(dump);
    expect(res.ok).toBe(true);

    // Every dataset must be present after restoring the produced .db file.
    expect(posDb.getTransactions().length).toBe(TRANSACTIONS.length);
    expect(posDb.getInventory().length).toBe(INVENTORY.length);
    expect(posDb.getVendors().length).toBe(VENDORS.length);
    expect(posDb.getDrawerLogs().length).toBe(DRAWER_LOGS.length);
    expect(posDb.getSettings().storeName).toBe('Restored Gift Shop');
  });

  it('a JSON export backup still restores in full', () => {
    const json = JSON.stringify({
      vendors: VENDORS,
      inventory: INVENTORY,
      transactions: TRANSACTIONS,
      settings: SETTINGS,
    });
    const res = posDb.importBackup(json);
    expect(res.ok).toBe(true);
    expect(posDb.getTransactions().length).toBe(TRANSACTIONS.length);
  });

  it('still rejects true binary SQLite files with a helpful message', () => {
    const res = posDb.importBackup('SQLite format 3\u0000some binary bytes');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/binary|json/i);
  });
});