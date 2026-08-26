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
    // Vendor-resolved supplier type, not a price==cost guess
    expect(screen.getAllByText(/Ocean Seychelles Ltd/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Souvenir Boutique/).length).toBeGreaterThan(0);
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
    const csv = decodeURIComponent(await readBlobText(blobs[0]));
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
    expect(screen.getByRole('button', { name: /heatmap/i })).toBeTruthy();
    // Metric switcher present
    expect(screen.getByRole('button', { name: /^revenue$/i })).toBeTruthy();
  });

  it('switches every metric option', async () => {
    const user = userEvent.setup();
    renderHeatmap();
    await user.click(screen.getByRole('button', { name: /^transactions$/i }));
    await user.click(screen.getByRole('button', { name: /^units$/i }));
    await user.click(screen.getByRole('button', { name: /avg ticket/i }));
    await user.click(screen.getByRole('button', { name: /^revenue$/i }));
  });

  it('switches every view mode including the live month calendar', async () => {
    const user = userEvent.setup();
    renderHeatmap();
    await user.click(screen.getByRole('button', { name: /calendar/i }));
    const monthName = new Date().toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
    expect(screen.getByText(monthName)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /hourly/i }));
    await user.click(screen.getByRole('button', { name: /day of week/i }));
    await user.click(screen.getByRole('button', { name: /^heatmap$/i }));
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
