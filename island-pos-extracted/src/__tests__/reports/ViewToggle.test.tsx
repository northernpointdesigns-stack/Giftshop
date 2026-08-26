import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FinancialReports } from '../../components/reports/FinancialReports';
import { AnimatedAreaChart } from '../../components/reports/charts/AnimatedAreaChart';
import { AnimatedDonut } from '../../components/reports/charts/AnimatedDonut';
import { AnimatedBarChart } from '../../components/reports/charts/AnimatedBarChart';
import { INVENTORY, VENDORS, TRANSACTIONS } from '../../test/fixtures';

const renderReport = () =>
  render(<FinancialReports transactions={TRANSACTIONS} inventory={INVENTORY} vendors={VENDORS} />);

describe('FinancialReports — Numbers / Graphs / Pie view toggle', () => {
  beforeEach(() => {
    cleanup();
    localStorage.removeItem('finreports.viewMode');
  });

  it('defaults to the Numbers view with all tables visible', () => {
    renderReport();
    expect(screen.getByRole('tab', { name: /Numbers/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Numbers/i }).getAttribute('aria-selected')).toBe('true');
    // Numbers-only table sections are rendered
    expect(screen.getByText(/Brand Performance Matrix/i)).toBeTruthy();
    expect(screen.getByText(/Revenue & Volume by Group Category/i)).toBeTruthy();
    // Chart panels are not
    expect(screen.queryByText(/Revenue Trend/i)).toBeNull();
  });

  it('switches to Graphs view: live area chart + bar rankings, tables hidden', async () => {
    const user = userEvent.setup();
    renderReport();
    await user.click(screen.getByRole('tab', { name: /Graphs/i }));

    expect(screen.getByText(/Revenue Trend/i)).toBeTruthy();
    expect(screen.getByText(/Top Brands by Revenue/i)).toBeTruthy();
    expect(screen.getByText(/Top Product Lines/i)).toBeTruthy();
    expect(screen.queryByText(/Brand Performance Matrix/i)).toBeNull();
    // KPI cards stay in every view
    expect(screen.getByText('SR 73.50')).toBeTruthy();
    // Choice persists for next mount
    expect(localStorage.getItem('finreports.viewMode')).toBe('graphs');
  });

  it('switches to Pie view: donut share charts with legend percentages', async () => {
    const user = userEvent.setup();
    renderReport();
    await user.click(screen.getByRole('tab', { name: /Pie/i }));

    expect(screen.getByText(/Brand Sales Share/i)).toBeTruthy();
    expect(screen.getByText(/Category Sales Share/i)).toBeTruthy();
    expect(screen.getByText('Brand Total')).toBeTruthy();
    expect(screen.queryByText(/Revenue & Volume by Group Category/i)).toBeNull();
    expect(localStorage.getItem('finreports.viewMode')).toBe('pie');
  });

  it('returns to Numbers view and renders tables again', async () => {
    const user = userEvent.setup();
    renderReport();
    await user.click(screen.getByRole('tab', { name: /Pie/i }));
    await user.click(screen.getByRole('tab', { name: /Numbers/i }));
    expect(screen.getByText(/Brand Performance Matrix/i)).toBeTruthy();
    expect(screen.queryByText(/Brand Sales Share/i)).toBeNull();
  });

  it('shows empty-state messages in chart views when a cycle has no sales', () => {
    render(
      <FinancialReports transactions={[]} inventory={INVENTORY} vendors={VENDORS} />
    );
    const graphsTab = screen.getByRole('tab', { name: /Graphs/i });
    graphsTab.click();
    expect(screen.getAllByText(/No sales recorded for this cycle yet/i).length).toBeGreaterThan(0);
  });
});

describe('Chart primitives', () => {
  beforeEach(() => cleanup());

  const data = [
    { label: 'Mon', value: 10 },
    { label: 'Tue', value: 40 },
  ];

  it('AnimatedAreaChart renders an accessible svg with data points', () => {
    const { container } = render(<AnimatedAreaChart data={data} formatValue={(v) => `X ${v}`} />);
    expect(container.querySelector('svg[aria-label="Revenue trend chart"]')).toBeTruthy();
  });

  it('AnimatedDonut renders legend entries for each slice', () => {
    render(<AnimatedDonut data={data} formatValue={(v) => `X ${v}`} />);
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.getByText('Tue')).toBeTruthy();
    // 10/50 and 40/50 legend percentages
    expect(screen.getByText('20.0%')).toBeTruthy();
    expect(screen.getByText('80.0%')).toBeTruthy();
  });

  it('AnimatedBarChart labels each row with its formatted value', () => {
    render(<AnimatedBarChart data={data} formatValue={(v) => `X ${v}`} />);
    expect(screen.getByText('X 10')).toBeTruthy();
    expect(screen.getByText('X 40')).toBeTruthy();
  });

  it('charts render nothing (null) with empty data', () => {
    const { container: a } = render(<AnimatedAreaChart data={[]} />);
    const { container: b } = render(<AnimatedDonut data={[]} />);
    const { container: c } = render(<AnimatedBarChart data={[]} />);
    expect(a.querySelector('svg')).toBeNull();
    expect(b.querySelector('svg')).toBeNull();
    expect(c.textContent).toBe('');
  });
});