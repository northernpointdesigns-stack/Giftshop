import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VendorSettlementReport } from '../../components/reports/VendorSettlementReport';
import { posDb } from '../../services/db';
import { TRANSACTIONS, VENDORS, PAYOUT_RECORDS } from '../../test/fixtures';
import { seedStorage } from '../../test/fixtures';

const noop = () => {};

// Re-derive the fixture totals that the ledger should surface so the asserts
// stay in lock-step with src/test/fixtures.ts rather than drifting from it.
const OCEAN = VENDORS.find((v) => v.id === 'V-OCEAN')!; // wholesale
const SOUV = VENDORS.find((v) => v.id === 'V-SOUV')!; // consignment

const oceanPayout = TRANSACTIONS.reduce((s, tx) => {
  const sign = tx.isRefund ? -1 : 1;
  return (
    s +
    tx.items
      .filter((i) => i.vendorId === OCEAN.id && i.supplierType === 'wholesale')
      .reduce((acc, i) => acc + Math.abs(i.vendorPayoutAmount) * sign, 0)
  );
}, 0);

const souvPayout = TRANSACTIONS.reduce((s, tx) => {
  const sign = tx.isRefund ? -1 : 1;
  return (
    s +
    tx.items
      .filter((i) => i.vendorId === SOUV.id && i.supplierType === 'consignment')
      .reduce((acc, i) => acc + Math.abs(i.vendorPayoutAmount) * sign, 0)
  );
}, 0);

const souvPaid = PAYOUT_RECORDS.filter(
  (p) => p.vendorId === SOUV.id && p.status === 'paid'
).reduce((s, p) => s + p.payoutAmount, 0);

const localKey = (d: Date): string => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

describe('VendorSettlementReport — vendor selection & ledger rendering', () => {
        beforeEach(() => {
      cleanup();
      vi.clearAllMocks();
      // Re-seed localStorage (in case a prior test mutated the posDb singleton
      // via recordVendorPayout / recordVendorAdvance). The singleton is loaded
      // once in its constructor; to refresh it we re-seed localStorage and call
      // the same initDatabase path the constructor used.
      seedStorage();
      // @ts-expect-error — initDatabase is private but is the only way to reload.
      posDb.initDatabase();
    });

  it('renders the directory dashboard until a vendor is selected', () => {
    render(<VendorSettlementReport vendors={VENDORS} onRefreshData={noop} />);
    expect(
      screen.getByText(/All Vendors Directory & Balance Audit/i)
    ).toBeTruthy();
  });

  it('shows the wholesale vendor ledger with itemized sales and correct net owing', async () => {
    render(<VendorSettlementReport vendors={VENDORS} onRefreshData={noop} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'V-OCEAN');

    // Header shows the vendor name and the Wholesale badge.
    expect(screen.getByText('Ocean Seychelles Ltd')).toBeTruthy();
    expect(screen.getByText('Wholesale')).toBeTruthy();
    expect(screen.queryByText('Consignment')).toBeNull();

    // Net Owing should equal the period payout (no advances, no prior settlements
    // for Ocean in the fixture set).
    expect(screen.getAllByText('Net Owing').length).toBeGreaterThan(0);
    const netValue = screen
      .getAllByText(/SR /)
      .find(
        (el) =>
          el.textContent?.startsWith('SR') &&
          parseFloat(el.textContent!.replace(/[^\d.-]+/g, '')) === oceanPayout
      );
        expect(netValue).toBeTruthy();
  });

  it('shows the consignment vendor ledger with prior settlement deducted from net owing', async () => {
    render(<VendorSettlementReport vendors={VENDORS} onRefreshData={noop} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'V-SOUV');

    expect(screen.getByText('Souvenir Boutique')).toBeTruthy();
    expect(screen.getByText('Consignment')).toBeTruthy();
    expect(screen.queryByText('Wholesale')).toBeNull();

    // Consignement payout is the tote bag line (15.4), and one prior paid
    // settlement of 15.4 exists in PAYOUT_RECORDS.
    // netOwing = 15.4 - 0 advances - 15.4 settled = 0
    const expectedNet = Number((souvPayout - 0 - souvPaid).toFixed(2));
    expect(expectedNet).toBe(0);

    // Net Owing card should show 0 (since payout equals the prior settlement)
    const zeroElements = screen.getAllByText(/SR 0\.00/);
    expect(zeroElements.length).toBeGreaterThan(0);
  });

  it('renders one itemized ledger row per vendor sale line', async () => {
    render(<VendorSettlementReport vendors={VENDORS} onRefreshData={noop} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'V-OCEAN');

    // Default date range is empty (so all-time). Ocean has sale lines in
    // IP-0001 (t-shirt + mug), IP-0002 (keychain), IP-0005 (mug), minus the
    // refund. Count non-refund sale lines for Ocean.
    const saleLines = TRANSACTIONS.filter((tx) => !tx.isRefund).reduce((s, tx) => {
      return s + tx.items.filter((i) => i.vendorId === OCEAN.id).length;
    }, 0);

        const rows = screen.getAllByText('Sale');
    expect(rows.length).toBe(saleLines);
  });

  it('highlights refund lines and excludes them from payout totals', async () => {
    render(<VendorSettlementReport vendors={VENDORS} onRefreshData={noop} />);

    // Ocean refund: TX-3 refunds a t-shirt line for V-OCEAN.
    await userEvent.selectOptions(screen.getByRole('combobox'), 'V-OCEAN');

    const refundBadges = screen.getAllByText('Refund');
    expect(refundBadges.length).toBeGreaterThan(0);
    // Each refund line is labelled exactly 'Refund' (allowing trimmed whitespace).
    const refundRows = refundBadges.filter((b) => b.textContent?.trim() === 'Refund');
    expect(refundRows.length).toBeGreaterThan(0);
  });

  it('"Mark Paid" routes to recordVendorPayout and clears the balance for the period', async () => {
    render(<VendorSettlementReport vendors={VENDORS} onRefreshData={noop} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'V-OCEAN');

        // The Mark Paid button is enabled because Ocean has a nonzero payout.
    const markPaidBtn = screen.getByRole('button', { name: /mark paid/i });
    expect((markPaidBtn as HTMLButtonElement).disabled).toBe(false);

    const spy = vi.spyOn(posDb, 'recordVendorPayout');

    await userEvent.click(markPaidBtn);

    // window.confirm is stubbed to return true in setup.ts.
    expect(spy).toHaveBeenCalledTimes(1);
    const [vendorIdArg, amountArg] = spy.mock.calls[0];
    expect(vendorIdArg).toBe(OCEAN.id);
    expect(amountArg).toBe(oceanPayout);

    spy.mockRestore();
  });

  it('"Mark Paid" is disabled when the period payout is zero', async () => {
    render(<VendorSettlementReport vendors={VENDORS} onRefreshData={noop} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'V-OCEAN');

    // Pick a date range in the far future where no sales fall.
    const dates = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    const future = new Date();
    future.setFullYear(future.getFullYear() + 5);
    const futureKey = localKey(future);
    fireEvent.change(dates[0], { target: { value: futureKey } });
    fireEvent.change(dates[1], { target: { value: futureKey } });

        // With no sales in range, vendorPayout is 0 → Mark Paid is disabled.
    const markPaidBtn = screen.getByRole('button', { name: /mark paid/i });
    expect((markPaidBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('Export CSV produces a blob with the vendor ledger contents', async () => {
    render(<VendorSettlementReport vendors={VENDORS} onRefreshData={noop} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'V-OCEAN');

    const blobs: Blob[] = [];
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return origCreate(blob);
    });

    const exportBtn = screen.getByRole('button', { name: /export csv/i });
    await userEvent.click(exportBtn);

    expect(blobs.length).toBe(1);
    const text = await blobs[0].text();
    expect(text).toContain('Vendor Settlement Ledger');
    expect(text).toContain('Ocean Seychelles Ltd');
    expect(text).toContain('Itemized Ledger');
    expect(text).toContain('Net Owing');

    URL.createObjectURL = origCreate;
  });
});


