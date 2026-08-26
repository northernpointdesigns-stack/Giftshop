import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FinancialReports } from '../../components/reports/FinancialReports';
import { INVENTORY, VENDORS, TRANSACTIONS, EXPECTED_TODAY } from '../../test/fixtures';
import { getCapturedBlobs, clearCapturedBlobs, readBlobText } from '../../test/setup';

const renderReport = (txs = TRANSACTIONS) =>
  render(<FinancialReports transactions={txs} inventory={INVENTORY} vendors={VENDORS} />);

describe('FinancialReports — data-driven figures', () => {
  beforeEach(() => {
    cleanup();
    clearCapturedBlobs();
  });

  it('computes exact KPI figures for the Daily (EOD) cycle', () => {
    renderReport();
    // Net sales subtotal (68 + 30.5 - 25 refund)
    expect(screen.getByText('SR 73.50')).toBeTruthy();
    // VAT collected (10.2 + 4.58 - 3.75)
    expect(screen.getByText('SR 11.03')).toBeTruthy();
    // House net profit (wholesale 27.5 + consignment 6.6)
    expect(screen.getByText('SR 34.10')).toBeTruthy();
    // Gross tendered incl. VAT
    expect(screen.getByText('SR 84.53')).toBeTruthy();
    // Transaction counter
    expect(screen.getByText(/3 Completed Transactions/)).toBeTruthy();
    // Secondary currency uses the transaction snapshot rate (73.5 / 13.5)
    expect(screen.getByText(/\$5\.44/)).toBeTruthy();
  });

  it('shows the effective blended VAT rate, not a hardcoded 15%', () => {
    renderReport();
    expect(screen.getByText(/VAT Tax Collected \(16\.1%\)/)).toBeTruthy();
    expect(screen.queryByText(/VAT Tax Collected \(15%\)/)).toBeNull();
    expect(screen.queryByText('VAT (15%)')).toBeNull();
    expect(screen.getByText('VAT Collected')).toBeTruthy();
  });

  it('derives the peak shopping window from real timestamps only', () => {
    renderReport();
    expect(screen.getByText(EXPECTED_TODAY.peakWindow)).toBeTruthy();
    expect(
      screen.getByText(/Generated SR 68\.00 across 1 transactions/)
    ).toBeTruthy();
  });

  it('builds the brand matrix from live line items (incl. Unbranded fallback)', () => {
    renderReport();
    expect(screen.getByText(/Brand Performance Matrix/)).toBeTruthy();
    expect(screen.getByText('Ocean Seychelles')).toBeTruthy();
    expect(screen.getByText('SR 51.50')).toBeTruthy(); // ocean brand gross
    expect(screen.getByText('3 units sold')).toBeTruthy();
    expect(screen.getByText('Souvenir Boutique')).toBeTruthy();
    expect(screen.getByText('SR 22.00')).toBeTruthy(); // souvenir gross
    expect(screen.getByText('1 units sold')).toBeTruthy();
  });

  it('renders generic Product Line & Size Variant panels (no demo panels)', () => {
    renderReport();
    expect(screen.getByText('Product Line Performance')).toBeTruthy();
    expect(screen.getByText('Beach Heritage')).toBeTruthy();
    expect(screen.getByText('25.00/ea')).toBeTruthy(); // 50 / 2 units
    expect(screen.getByText('Unclassified Line')).toBeTruthy(); // keychain has no line
    expect(screen.getByText('Category & Size Variant Matrix')).toBeTruthy();
    expect(screen.getByText('Adults M')).toBeTruthy();
    expect(screen.queryByText(/Ocean Seychelles T-Shirts Variant Matrix/)).toBeNull();
    expect(screen.queryByText(/Mug Line Comparison/)).toBeNull();
    expect(screen.queryByText(/Luxury Gold Rim Line/)).toBeNull();
    expect(screen.queryByText(/18\.00\/ea/)).toBeNull();
  });

  it('switches every cycle option and recomputes', async () => {
    const user = userEvent.setup();
    renderReport();

    await user.click(screen.getByRole('button', { name: /All Time/ }));
    expect(screen.getByText(/5 Completed Transactions/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /This Week/ }));
    expect(screen.getByText(/3 Completed Transactions/)).toBeTruthy();
    expect(screen.getByText(/Brand Performance Matrix \(WEEK\)/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /This Month/ }));
    expect(screen.getByText(/Brand Performance Matrix \(MONTH\)/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /This Year/ }));
    expect(screen.getByText(/Brand Performance Matrix \(YEAR\)/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Daily \(EOD\)/ }));
    expect(screen.getByText(/3 Completed Transactions/)).toBeTruthy();
  });

  it('shows empty-state panels and hides the peak banner with no data', () => {
    render(<FinancialReports transactions={[]} inventory={INVENTORY} vendors={VENDORS} />);
    expect(screen.getAllByText(/No sales recorded for this cycle yet\./).length).toBe(2);
    expect(screen.queryByText(/Peak Shopping Window/)).toBeNull();
  });

  it('exports a CSV that mirrors the on-screen figures', async () => {
    const user = userEvent.setup();
    renderReport();
    await user.click(screen.getByRole('button', { name: /Export CSV/ }));

    const blobs = getCapturedBlobs();
    expect(blobs.length).toBe(1);
    const csv = await readBlobText(blobs[0]);

    expect(csv).toContain('Blended Exchange Rate (at time of sale),1 USD = SR 13.50');
    expect(csv).toContain('VAT Tax Collected (16.1%)');
    expect(csv).toContain('House Net Profit,34.10');
    expect(csv).toContain('"Ocean Seychelles",3,51.50');
    expect(csv).toContain('Product Line Performance');
    expect(csv).toContain('"Beach Heritage",2,50.00,3.70,25.00');
    expect(csv).toContain('Size / Variant Breakdown');
    expect(csv).toContain('"T-Shirts","Adults M",2,50.00');
    expect(csv).not.toContain('Ocean Seychelles T-Shirt - Coconut'); // no demo literals
  });
});
