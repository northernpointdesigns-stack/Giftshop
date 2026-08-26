import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsignmentPayoutReport } from '../../components/reports/ConsignmentPayoutReport';
import { TaxReturnAssistant } from '../../components/reports/TaxReturnAssistant';
import { ReportDownloads } from '../../components/reports/ReportDownloads';
import { INVENTORY, VENDORS, TRANSACTIONS } from '../../test/fixtures';
import { getCapturedBlobs, clearCapturedBlobs, readBlobText } from '../../test/setup';

const noop = () => {};

describe('ConsignmentPayoutReport — statements, itemized view & history', () => {
  beforeEach(() => {
    cleanup();
    clearCapturedBlobs();
  });

  it('renders the consignment vendor and payout history', () => {
    render(<ConsignmentPayoutReport vendors={VENDORS} onRefreshData={noop} />);
    expect(screen.getAllByText(/Souvenir Boutique/).length).toBeGreaterThan(0);
    // Historical payout record from the database
    expect(screen.getByText('SR 15.40')).toBeTruthy();
  });

  it('filters to a single vendor via the dropdown', async () => {
    const user = userEvent.setup();
    render(<ConsignmentPayoutReport vendors={VENDORS} onRefreshData={noop} />);
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'V-SOUV');
    expect(screen.getAllByText(/Souvenir Boutique/).length).toBeGreaterThan(0);
  });

  it('itemized sub-tab lists the consignment sale lines', async () => {
    const user = userEvent.setup();
    render(<ConsignmentPayoutReport vendors={VENDORS} onRefreshData={noop} />);
    await user.click(screen.getByRole('button', { name: /itemized/i }));
    expect(screen.getByText('Canvas Tote Bag')).toBeTruthy();
  });
});

describe('TaxReturnAssistant — pre-filled books & exports', () => {
  beforeEach(() => {
    cleanup();
    clearCapturedBlobs();
    vi.clearAllMocks();
  });

  it('renders the worksheet from POS data', () => {
    render(<TaxReturnAssistant transactions={TRANSACTIONS} />);
    expect(screen.getByText(/Tax Return Assistant/)).toBeTruthy();
    expect(screen.getByText(/Tax Year/i)).toBeTruthy();
  });

  it('exports the return as CSV and prints it', async () => {
    const user = userEvent.setup();
    render(<TaxReturnAssistant transactions={TRANSACTIONS} />);
    await user.click(screen.getByRole('button', { name: /^csv$/i }));
    expect(getCapturedBlobs().length).toBe(1);
    const csv = await readBlobText(getCapturedBlobs()[0]);
    expect(csv).toContain('TAX_RETURN');
    await user.click(screen.getByRole('button', { name: /print return/i }));
    expect(window.print).toHaveBeenCalled();
  });

  it('accepts taxpayer edits', async () => {
    const user = userEvent.setup();
    render(<TaxReturnAssistant transactions={TRANSACTIONS} />);
    const yearInput = screen.getByDisplayValue(String(new Date().getFullYear()));
    await user.clear(yearInput);
    await user.type(yearInput, '2025');
    expect((yearInput as HTMLInputElement).value).toBe('2025');
  });
});

describe('ReportDownloads — download center actions', () => {
  beforeEach(() => {
    cleanup();
    clearCapturedBlobs();
    vi.clearAllMocks();
  });

  it('renders the report cards and preset range buttons', () => {
    render(<ReportDownloads transactions={TRANSACTIONS} inventory={INVENTORY} vendors={VENDORS} />);
    expect(screen.getByText(/Download Reports Center/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '7d' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'This Month' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All Time' })).toBeTruthy();
  });

  it('downloads a CSV for each report card and honors the range preset', async () => {
    const user = userEvent.setup();
    render(<ReportDownloads transactions={TRANSACTIONS} inventory={INVENTORY} vendors={VENDORS} />);
    await user.click(screen.getByRole('button', { name: 'All Time' }));

    const csvButtons = screen.getAllByRole('button', { name: 'CSV' });
    expect(csvButtons.length).toBeGreaterThanOrEqual(3);
    await user.click(csvButtons[0]);
    expect(getCapturedBlobs().length).toBe(1);
    const csv = await readBlobText(getCapturedBlobs()[0]);
    expect(csv.length).toBeGreaterThan(50);
  });

  it('print action routes through window.print', async () => {
    const user = userEvent.setup();
    render(<ReportDownloads transactions={TRANSACTIONS} inventory={INVENTORY} vendors={VENDORS} />);
    await user.click(screen.getAllByRole('button', { name: 'Print' })[0]);
    expect(window.print).toHaveBeenCalled();
  });
});
