import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EODBalancing } from '../../components/reports/EODBalancing';
import { getCapturedBlobs, clearCapturedBlobs, readBlobText } from '../../test/setup';

describe('EODBalancing — drawer history & session ledger', () => {
  beforeEach(() => {
    cleanup();
    clearCapturedBlobs();
  });

  it('renders session figures with the configured currency symbol', () => {
    render(<EODBalancing />);
    // Closed session: float 100, cash sales 200, expected 280, actual 278
    expect(screen.getByText('SR 280.00')).toBeTruthy();
    expect(screen.getByText('SR 278.00')).toBeTruthy();
    expect(screen.getAllByText('SR 100.00').length).toBe(2); // both sessions
    expect(screen.getByText(/\+SR200\.00/)).toBeTruthy();
    // Adjustments: +20 paid in -10 paid out -30 drop = -20
    expect(screen.getByText('SR-20.00')).toBeTruthy();
    // Disparity
    expect(screen.getByText('SR-2.00')).toBeTruthy();
  });

  it('filter pills narrow the drawer log list', async () => {
    const user = userEvent.setup();
    render(<EODBalancing />);
    expect(screen.getByText(/All Events \(4\)/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Safe Drops/ }));
    expect(screen.getByText(/Safe drop/)).toBeTruthy();
    expect(screen.queryByText(/Change fund top-up/)).toBeNull();

    await user.click(screen.getByRole('button', { name: /Paid In \/ Out/ }));
    expect(screen.getByText(/Change fund top-up/)).toBeTruthy();
    expect(screen.queryByText(/Safe drop/)).toBeNull();

    await user.click(screen.getByRole('button', { name: /All Events/ }));
    expect(screen.getByText(/Drawer opened without session/)).toBeTruthy();
  });

  it('searches drawer logs by staff and reason', async () => {
    const user = userEvent.setup();
    render(<EODBalancing />);
    await user.type(screen.getByPlaceholderText(/search/i), 'Bob');
    expect(screen.getByText(/Change fund top-up/)).toBeTruthy();
    expect(screen.queryByText(/Safe drop/)).toBeNull(); // Alice
  });

  it('exports drawer history CSV with currency-correct headers', async () => {
    const user = userEvent.setup();
    render(<EODBalancing />);
    await user.click(screen.getByRole('button', { name: /export csv/i }));
    const blobs = getCapturedBlobs();
    expect(blobs.length).toBe(1);
    const csv = await readBlobText(blobs[0]);
    expect(csv).toContain('Amount (SR)');
    expect(csv).toContain('Drawer Float After (SR)');
    expect(csv).toContain('SAFE_DROP');
  });
});
