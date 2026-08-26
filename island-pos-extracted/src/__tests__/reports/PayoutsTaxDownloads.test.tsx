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
    expect(screen.getAllByText('SR 15.40').length).toBeGreaterThan(0);
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
    expect(csv).toContain('UNIVERSAL INDIVIDUAL INCOME TAX RETURN');
    // Print opens a print preview window and writes the return into it
    const write = vi.fn();
    const close = vi.fn();
    (window.open as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      document: { write, close },
    });
    await user.click(screen.getByRole('button', { name: /print return/i }));
    expect(write).toHaveBeenCalled();
    expect(String(write.mock.calls[0][0])).toContain('TAX');
  });

  it('accepts taxpayer edits', async () => {
    const user = userEvent.setup();
    render(<TaxReturnAssistant transactions={TRANSACTIONS} />);
    // The worksheet defaults to the PREVIOUS fiscal year
    const yearInput = screen.getByDisplayValue(String(new Date().getFullYear() - 1));
    await user.clear(yearInput);
    await user.type(yearInput, '2024');
    expect((yearInput as HTMLInputElement).value).toBe('2024');
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

  it('previews a report before downloading its CSV and honors the range preset', async () => {
    const user = userEvent.setup();
    render(<ReportDownloads transactions={TRANSACTIONS} inventory={INVENTORY} vendors={VENDORS} />);
    await user.click(screen.getByRole('button', { name: 'All Time' }));

    await user.click(screen.getAllByRole('button', { name: /preview report/i })[0]);
    expect(screen.getByText(/previewing/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /download csv/i }));
    expect(getCapturedBlobs().length).toBe(1);
    const csv = await readBlobText(getCapturedBlobs()[0]);
    expect(csv.length).toBeGreaterThan(50);
  });

  it('print action opens the print preview with the report table', async () => {
    const user = userEvent.setup();
    render(<ReportDownloads transactions={TRANSACTIONS} inventory={INVENTORY} vendors={VENDORS} />);
    const write = vi.fn();
    const close = vi.fn();
    (window.open as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      document: { write, close },
    });
    await user.click(screen.getAllByRole('button', { name: /preview report/i })[0]);
    await user.click(screen.getByRole('button', { name: /print report/i }));
    expect(write).toHaveBeenCalled();
    const html = String(write.mock.calls[0][0]);
    expect(html).toContain('<table>');
  });
});
