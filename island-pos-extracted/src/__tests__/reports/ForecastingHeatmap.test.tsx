import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SalesForecasting } from '../../components/reports/SalesForecasting';
import { SalesHeatmap } from '../../components/reports/SalesHeatmap';
import { INVENTORY, VENDORS, TRANSACTIONS } from '../../test/fixtures';
import { getCapturedBlobs, clearCapturedBlobs, readBlobText } from '../../test/setup';

const noop = () => {};

describe('SalesForecasting — reorder engine & CSV export', () => {
  beforeEach(() => {
    cleanup();
    clearCapturedBlobs();
  });

  it('forecasts every inventory item with its real vendor', () => {
    render(
      <SalesForecasting
        transactions={TRANSACTIONS}
        inventory={INVENTORY}
        vendors={VENDORS}
        onRefreshData={noop}
      />
    );
    for (const name of [
      'T-Shirt Turtle Cove',
      'Ceramic Mug Gold Rim',
      'Ceramic Mug Standard',
      'Canvas Tote Bag',
      'Shell Keychain',
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    // Vendor-resolved supplier type is asserted in the CSV export test.
    // Rows render the item brand (with Unbranded fallback), not the vendor name.
    expect(screen.getAllByText(/Unbranded/).length).toBeGreaterThan(0); // keychain
    expect(screen.getAllByText(/Souvenir Boutique/).length).toBeGreaterThan(0); // tote brand
  });

  it('search filter narrows the forecast list', async () => {
    const user = userEvent.setup();
    render(
      <SalesForecasting
        transactions={TRANSACTIONS}
        inventory={INVENTORY}
        vendors={VENDORS}
        onRefreshData={noop}
      />
    );
    await user.type(screen.getByPlaceholderText(/search/i), 'Mug');
    expect(screen.getByText('Ceramic Mug Gold Rim')).toBeTruthy();
    expect(screen.queryByText('T-Shirt Turtle Cove')).toBeNull();
    expect(screen.queryByText('Canvas Tote Bag')).toBeNull();
  });

  it('exports the reorder CSV with vendor-true supplier types', async () => {
    const user = userEvent.setup();
    render(
      <SalesForecasting
        transactions={TRANSACTIONS}
        inventory={INVENTORY}
        vendors={VENDORS}
        onRefreshData={noop}
      />
    );
    await user.click(screen.getByRole('button', { name: /Export Order Guide/i }));
    const blobs = getCapturedBlobs();
    expect(blobs.length).toBe(1);
    const csv = await readBlobText(blobs[0]);
    expect(csv).toContain('Supplier Type');
    expect(csv).toContain('893200101'); // tote
    expect(csv).toContain('Consignment');
    expect(csv).toContain('893100101'); // t-shirt
    expect(csv).toContain('Wholesale');
    expect(csv).toContain('"Unbranded"'); // keychain brand fallback
    expect(csv).toContain('Souvenir Boutique'); // real vendor name in CSV
  });
});

describe('SalesHeatmap — views, metrics, timeframes & export', () => {
  beforeEach(() => {
    cleanup();
    clearCapturedBlobs();
  });

  const renderHeatmap = () =>
    render(
      <SalesHeatmap
        transactions={TRANSACTIONS}
        inventory={INVENTORY}
        vendors={VENDORS}
        onRefreshData={noop}
      />
    );

  it('renders the default heatmap grid', () => {
    renderHeatmap();
    expect(screen.getByRole('button', { name: /Day × Hour Matrix/i })).toBeTruthy();
    // Metric switcher present
    expect(screen.getByRole('button', { name: /Gross Sales/i })).toBeTruthy();
  });

  it('switches every metric option', async () => {
    const user = userEvent.setup();
    renderHeatmap();
    await user.click(screen.getByRole('button', { name: /Orders Count/i }));
    await user.click(screen.getByRole('button', { name: /Units Sold/i }));
    await user.click(screen.getByRole('button', { name: /Avg Basket/i }));
    await user.click(screen.getByRole('button', { name: /Gross Sales/i }));
  });

  it('switches every view mode including the live month calendar', async () => {
    const user = userEvent.setup();
    renderHeatmap();
    await user.click(screen.getByRole('button', { name: /Monthly Calendar/i }));
    const monthName = new Date().toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
    expect(screen.getByText(monthName)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Hourly Velocity/i }));
    await user.click(screen.getByRole('button', { name: /Day Breakdown/i }));
    await user.click(screen.getByRole('button', { name: /Day × Hour Matrix/i }));
  });

  it('changes the timeframe selection', async () => {
    const user = userEvent.setup();
    renderHeatmap();
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'last7days');
    await user.selectOptions(selects[0], 'allTime');
  });

  it('exports the heatmap CSV', async () => {
    const user = userEvent.setup();
    renderHeatmap();
    await user.click(screen.getByRole('button', { name: /Export CSV/ }));
    const blobs = getCapturedBlobs();
    expect(blobs.length).toBe(1);
    const csv = await readBlobText(blobs[0]);
    expect(csv).toContain('Sales Heatmap');
  });
});
