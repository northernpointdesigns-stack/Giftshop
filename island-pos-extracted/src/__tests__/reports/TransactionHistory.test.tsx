import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionHistory } from '../../components/reports/TransactionHistory';
import { TRANSACTIONS } from '../../test/fixtures';

const noop = () => {};

// Local calendar date string (YYYY-MM-DD) — must match the date filter's local
// handling, not a UTC key that drifts around midnight / across timezones.
const localKey = (d: Date): string => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

// Widen the date filter so the full fixture history is visible again. The
// ledger's default is "today only", so older fixtures must be surfaced first.
const widenToAll = () => {
  const dates = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
  const old = new Date();
  old.setDate(old.getDate() - 90);
  fireEvent.change(dates[0], { target: { value: localKey(old) } });
  fireEvent.change(dates[1], { target: { value: localKey(new Date()) } });
};

describe('TransactionHistory — filters, search & audit actions', () => {
  beforeEach(() => {
    cleanup();
  });

  it('defaults to today only, and shows the full ledger once the range is widened', () => {
    render(<TransactionHistory transactions={TRANSACTIONS} onRefreshData={noop} />);
    // New default: only today's receipts are visible without opening the range.
    for (const receipt of ['IP-0001', 'IP-0002', 'IP-0003']) {
      expect(screen.getByText(receipt)).toBeTruthy();
    }
    expect(screen.queryByText('IP-0004')).toBeNull(); // 40 days ago
    expect(screen.queryByText('IP-0005')).toBeNull(); // 40 days ago

    widenToAll();
    for (const receipt of ['IP-0001', 'IP-0002', 'IP-0003', 'IP-0004', 'IP-0005']) {
      expect(screen.getByText(receipt)).toBeTruthy();
    }
  });

  it('searches by receipt number', async () => {
    const user = userEvent.setup();
    render(<TransactionHistory transactions={TRANSACTIONS} onRefreshData={noop} />);
    await user.type(screen.getByPlaceholderText(/Search receipt #/i), 'IP-0002');
    expect(screen.getByText('IP-0002')).toBeTruthy();
    expect(screen.queryByText('IP-0001')).toBeNull();
    expect(screen.queryByText('IP-0005')).toBeNull();
  });

  it('searches by cashier name', async () => {
    const user = userEvent.setup();
    render(<TransactionHistory transactions={TRANSACTIONS} onRefreshData={noop} />);
    widenToAll(); // Bob also has a 40-day-old receipt (IP-0004)
    await user.type(screen.getByPlaceholderText(/Search receipt #/i), 'Bob');
    expect(screen.getByText('IP-0002')).toBeTruthy();
    expect(screen.getByText('IP-0004')).toBeTruthy();
    expect(screen.queryByText('IP-0001')).toBeNull(); // Alice
  });

  it('status filter: Sales excludes refunds', async () => {
    const user = userEvent.setup();
    render(<TransactionHistory transactions={TRANSACTIONS} onRefreshData={noop} />);
    await user.click(screen.getByRole('button', { name: /^sales$/i }));
    expect(screen.queryByText('IP-0003')).toBeNull(); // the refund
    expect(screen.getByText('IP-0001')).toBeTruthy();
  });

  it('status filter: Refunds shows only the refund', async () => {
    const user = userEvent.setup();
    render(<TransactionHistory transactions={TRANSACTIONS} onRefreshData={noop} />);
    await user.click(screen.getByRole('button', { name: /^refunds$/i }));
    expect(screen.getByText('IP-0003')).toBeTruthy();
    expect(screen.queryByText('IP-0001')).toBeNull();
  });

  it('status filter: Flagged isolates the corrupted receipt via the audit engine', async () => {
    const user = userEvent.setup();
    render(<TransactionHistory transactions={TRANSACTIONS} onRefreshData={noop} />);
    widenToAll(); // the corrupted receipt (IP-0004) is 40 days old
    await user.click(screen.getByRole('button', { name: /flagged/i }));
    expect(screen.getByText('IP-0004')).toBeTruthy(); // total 999 mismatch
    expect(screen.queryByText('IP-0001')).toBeNull();
  });

  it('date range filters both bounds', () => {
    render(<TransactionHistory transactions={TRANSACTIONS} onRefreshData={noop} />);
    const dates = document.querySelectorAll('input[type="date"]');
    const today = localKey(new Date());
    fireEvent.change(dates[0], { target: { value: today } }); // from = today
    expect(screen.getByText('IP-0001')).toBeTruthy();
    expect(screen.queryByText('IP-0005')).toBeNull(); // 40 days ago

    const old = new Date();
    old.setDate(old.getDate() - 60);
    fireEvent.change(dates[0], { target: { value: localKey(old) } });
    expect(screen.getByText('IP-0005')).toBeTruthy(); // range now includes it
  });

  it('opens the receipt audit inspector for a specific transaction', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <TransactionHistory transactions={TRANSACTIONS} onRefreshData={noop} />
    );
    await user.click(screen.getAllByTitle(/Inspect Receipt/i)[0]);
    expect(screen.getAllByText(/IP-000/).length).toBeGreaterThan(0);
    unmount();
  });

  it('thermal & A4 print actions execute without error', async () => {
    const user = userEvent.setup();
    render(<TransactionHistory transactions={TRANSACTIONS} onRefreshData={noop} />);
    await user.click(screen.getAllByTitle(/Print Thermal/i)[0]);
    await user.click(screen.getAllByTitle(/Print Standard A4/i)[0]);
  });
});
