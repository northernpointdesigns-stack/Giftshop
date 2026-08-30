/**
 * A4 print layouts for the business documents created in Invoices & Orders:
 * Invoices, Quotes and Purchase Orders (plus per-customer statements).
 *
 * Layouts mirror the store's worksheet templates — letterhead with document
 * meta block, Bill To / Ship To, line-items table with the TAXED column when
 * per-line tax is enabled, the Subtotal / Taxable / Tax due / Other / Total
 * block, terms-and-conditions + acceptance signature on quotes, requisitioner
 * strip on purchase orders, and a PAID / OVERDUE stamp.
 *
 * Every letterhead value comes straight from the store's white-label settings
 * (set during first-run onboarding) — nothing is hard-coded and there are no
 * template-vendor credits anywhere in the output.
 */
import { Invoice, StoreSettings } from '../types/pos';
import {
  computeInvoiceTotals,
  agingSummary,
  invoiceDueDate,
  TERMS_LABEL,
  InvoiceTotals,
} from './invoiceMath';

const escapeHtml = (value: string | undefined | null): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const toDate = (value: string | undefined | null): Date | null => {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

const fmtDate = (value: string | undefined | null): string => {
  const d = toDate(value);
  return d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
};

const money = (symbol: string, amount: number): string =>
  `${escapeHtml(symbol)} ${amount.toFixed(2)}`;

/** Base shared CSS (A4 portrait, print-exact colors). */
const BASE_CSS = `
  @page { size: A4 portrait; margin: 12mm 14mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1e293b; background: #ffffff; margin: 0; padding: 0; font-size: 11px; line-height: 1.45;
  }
  .container { width: 100%; max-width: 820px; margin: 0 auto; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .font-mono { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; }
  .muted { color: #64748b; }
  .letterhead {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid #0f172a; padding-bottom: 14px; margin-bottom: 12px;
  }
  .letterhead-brand { display: flex; gap: 12px; align-items: flex-start; max-width: 62%; }
  .letterhead-logo { max-height: 52px; max-width: 170px; object-fit: contain; }
  .letterhead-mark {
    width: 48px; height: 48px; border-radius: 10px; background: #0f172a; color: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900;
  }
  .letterhead-name { font-size: 19px; font-weight: 900; letter-spacing: -0.3px; margin: 0 0 2px; color: #0f172a; }
  .letterhead-sub { font-size: 11px; font-weight: 600; color: #475569; margin: 0 0 2px; }
  .letterhead-lines { font-size: 10px; color: #64748b; line-height: 1.35; }
  .tax-id-badge {
    display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 7px;
    border-radius: 4px; font-size: 9.5px; font-weight: 700; color: #334155; margin-top: 4px;
  }
  .doc-title-block { text-align: right; min-width: 190px; }
  .doc-title { font-size: 24px; font-weight: 900; letter-spacing: 2.5px; color: #0f172a; margin: 0; }
  .doc-number { font-size: 14px; font-weight: 800; font-family: Consolas, monospace; margin-top: 2px; }
  .doc-date { font-size: 10px; color: #64748b; margin-top: 2px; }
  .meta-strip {
    display: flex; gap: 22px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
    padding: 8px 12px; margin-bottom: 12px; flex-wrap: wrap;
  }
  .meta-item .meta-label { font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.7px; color: #64748b; }
  .meta-item .meta-value { font-size: 11px; font-weight: 700; color: #0f172a; }
  .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
  .party-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 12px; }
  .party-box h4 { margin: 0 0 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; }
  .party-box .party-name { font-size: 12.5px; font-weight: 800; color: #0f172a; }
  .party-box .party-lines { font-size: 10px; color: #475569; white-space: pre-line; }
  table.lines { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  table.lines th {
    background: #0f172a; color: #ffffff; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px;
    padding: 6px 8px; text-align: left;
  }
  table.lines td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  table.lines tr:nth-child(even) td { background: #f8fafc; }
  .totals { margin-left: auto; width: 46%; min-width: 250px; border-collapse: collapse; margin-bottom: 12px; }
  .totals td { padding: 4px 8px; font-size: 11px; }
  .totals td.num { text-align: right; font-family: Consolas, monospace; }
  .totals tr.grand td {
    border-top: 2px solid #0f172a; font-weight: 900; font-size: 13.5px; color: #0f172a; padding-top: 7px;
  }
  .totals .balance-row td { color: #047857; font-weight: 700; }
  .stamp {
    display: inline-block; border: 3px solid; border-radius: 8px; padding: 5px 14px;
    font-size: 16px; font-weight: 900; letter-spacing: 2px; transform: rotate(-6deg);
  }
  .stamp-paid { color: #047857; border-color: #047857; background: #ecfdf5; }
  .stamp-overdue { color: #b91c1c; border-color: #b91c1c; background: #fef2f2; }
  .footer-block { border-top: 1px solid #e2e8f0; margin-top: 14px; padding-top: 8px; font-size: 9.5px; color: #64748b; }
  .comments-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 10px; margin-bottom: 12px; }
  .comments-box h4 { margin: 0 0 3px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; }
  .sig-line { margin-top: 26px; font-size: 11px; color: #334155; }
  .sig-line .line { display: inline-block; border-bottom: 1px solid #334155; min-width: 240px; }
`;

/** Letterhead built entirely from the store's white-label settings. */
function letterheadHtml(settings: StoreSettings, titleBlock: string): string {
  const logoUrl = settings.receiptLogoUrl || settings.shopLogoUrl || settings.brandLogoUrl;
  const name = settings.storeName || 'Your Business';
  const lines = (settings.receiptHeaderLines || []).filter(Boolean);
  return `
    <div class="letterhead">
      <div class="letterhead-brand">
        ${logoUrl ? `<img class="letterhead-logo" src="${escapeHtml(logoUrl)}" alt="logo" />` : `<div class="letterhead-mark">${escapeHtml(name.slice(0, 1).toUpperCase())}</div>`}
        <div>
          <h1 class="letterhead-name">${escapeHtml(name)}</h1>
          ${settings.receiptHeaderSubtitle ? `<p class="letterhead-sub">${escapeHtml(settings.receiptHeaderSubtitle)}</p>` : ''}
          <div class="letterhead-lines">${lines.map((l) => `${escapeHtml(l)}<br/>`).join('')}</div>
          ${settings.taxRegistrationNumber ? `<span class="tax-id-badge">Tax ID: ${escapeHtml(settings.taxRegistrationNumber)}</span>` : ''}
        </div>
      </div>
      <div class="doc-title-block">${titleBlock}</div>
    </div>`;
}

const metaItem = (label: string, value: string): string =>
  `<div class="meta-item"><div class="meta-label">${escapeHtml(label)}</div><div class="meta-value">${escapeHtml(value)}</div></div>`;

const partyBox = (heading: string, name: string, contactLines?: string): string => `
  <div class="party-box">
    <h4>${escapeHtml(heading)}</h4>
    <div class="party-name">${escapeHtml(name || '—')}</div>
    ${contactLines ? `<div class="party-lines">${escapeHtml(contactLines)}</div>` : ''}
  </div>`;

function metaStripHtml(inv: Invoice, totals: InvoiceTotals): string {
  const items: string[] = [];
  items.push(metaItem(inv.kind === 'quote' ? 'QUOTE #' : inv.kind === 'purchase_order' ? 'PO #' : 'INVOICE #', inv.invoiceNumber));
  items.push(metaItem('DATE', fmtDate(inv.issueDate || inv.createdAt)));
  if (inv.customerId) items.push(metaItem('CUSTOMER ID', inv.customerId));
  const due = invoiceDueDate(inv);
  if (inv.kind === 'quote') {
    items.push(metaItem('VALID UNTIL', due ? fmtDate(due.toISOString()) : '—'));
  } else if (inv.terms && inv.terms !== 'custom') {
    items.push(metaItem('TERMS', `${TERMS_LABEL[inv.terms] || 'Net 30'} · ${due ? fmtDate(due.toISOString()) : '—'}`));
  } else {
    items.push(metaItem('DUE DATE', due ? fmtDate(due.toISOString()) : '—'));
  }
  if (totals.isOverdue) items.push(metaItem('STATUS', `OVERDUE ${totals.ageDays} day${(totals.ageDays || 0) === 1 ? '' : 's'}`));
  return `<div class="meta-strip">${items.join('')}</div>`;
}

function partyGridHtml(inv: Invoice): string {
  if (inv.kind === 'purchase_order') {
    return `<div class="party-grid">
      ${partyBox('Vendor', inv.vendor || inv.customerName, inv.customerContact)}
      ${partyBox('Ship To', inv.shipTo || '', undefined)}
    </div>`;
  }
  if (inv.kind === 'quote') {
    return `<div class="party-grid">
      ${partyBox('Customer', inv.customerName, inv.customerContact)}
      ${inv.preparedBy ? partyBox('Prepared By', inv.preparedBy, undefined) : ''}
    </div>`;
  }
  return `<div class="party-grid">
    ${partyBox('Bill To', inv.customerName, inv.customerContact)}
    ${inv.shipTo ? partyBox('Ship To', inv.shipTo, undefined) : ''}
  </div>`;
}

function linesTableHtml(inv: Invoice, totals: InvoiceTotals, symbol: string): string {
  const showTaxed = (inv.taxMode || 'none') === 'per_line';
  const isPo = inv.kind === 'purchase_order';
  const showUnit = isPo || (inv.lines || []).some((l) => l.unitPrice !== 0);
  const head = `
    <tr>
      ${isPo ? '<th style="width:110px;">Item #</th>' : ''}
      <th>Description</th>
      <th class="text-center" style="width:52px;">Qty</th>
      ${showUnit ? '<th class="text-right" style="width:96px;">Unit Price</th>' : ''}
      ${showTaxed ? '<th class="text-center" style="width:54px;">Taxed</th>' : ''}
      <th class="text-right" style="width:100px;">Amount</th>
    </tr>`;
  const rows = (inv.lines || [])
    .map((l, i) => `
      <tr>
        ${isPo ? `<td class="font-mono">${escapeHtml(l.itemRef || '')}</td>` : ''}
        <td>${escapeHtml(l.description) || '&nbsp;'}</td>
        <td class="text-center">${l.quantity || 1}</td>
        ${showUnit ? `<td class="text-right font-mono">${money(symbol, l.unitPrice)}</td>` : ''}
        ${showTaxed ? `<td class="text-center font-bold">${l.taxed ? 'X' : ''}</td>` : ''}
        <td class="text-right font-mono font-bold">${money(symbol, totals.lineAmounts[i] ?? 0)}</td>
      </tr>`)
    .join('');
  return `<table class="lines"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

function totalsTableHtml(inv: Invoice, totals: InvoiceTotals, symbol: string, taxRate: number): string {
  const showTax = (inv.taxMode || 'none') !== 'none';
  const otherLabel = inv.otherLabel || 'Other';
  const rows: string[] = [];
  rows.push(`<tr><td>Subtotal</td><td class="num">${money(symbol, totals.subtotal)}</td></tr>`);
  if (showTax) {
    rows.push(`<tr><td>Taxable</td><td class="num">${money(symbol, totals.taxableSubtotal)}</td></tr>`);
    rows.push(`<tr><td>Tax due (${(taxRate * 100).toFixed(2)}%)</td><td class="num">${money(symbol, totals.taxDue)}</td></tr>`);
  }
  if (totals.other !== 0) {
    rows.push(`<tr><td>${escapeHtml(otherLabel)}</td><td class="num">${money(symbol, totals.other)}</td></tr>`);
  }
  rows.push(`<tr class="grand"><td>TOTAL</td><td class="num">${money(symbol, totals.total)}</td></tr>`);
  if (totals.paid > 0) {
    rows.push(`<tr class="balance-row"><td>Paid to date</td><td class="num">-${money(symbol, totals.paid)}</td></tr>`);
    rows.push(`<tr><td><strong>Balance due</strong></td><td class="num"><strong>${money(symbol, totals.outstanding)}</strong></td></tr>`);
  }
  return `<table class="totals">${rows.join('')}</table>`;
}

function stampHtml(totals: InvoiceTotals): string {
  if (totals.effectiveStatus === 'paid') return `<span class="stamp stamp-paid">PAID</span>`;
  if (totals.isOverdue) return `<span class="stamp stamp-overdue">OVERDUE ${totals.ageDays}d</span>`;
  return '';
}

/** Full A4 document HTML for one Invoice / Quote / Purchase Order. */
export function buildBusinessDocumentHtml(inv: Invoice, settings: StoreSettings): string {
  const symbol = settings.primaryCurrencySymbol || '$';
  const totals = computeInvoiceTotals(inv, new Date(), settings);
  const taxRate = (inv.taxMode || 'none') === 'none' ? 0 : (typeof inv.taxRate === 'number' ? inv.taxRate : settings.defaultVatRate || 0);
  const isQuote = inv.kind === 'quote';
  const isPo = inv.kind === 'purchase_order';

  const docTitle = isQuote ? 'QUOTE' : isPo ? 'PURCHASE ORDER' : 'INVOICE';
  const titleBlock = `
    <div class="doc-title">${docTitle}</div>
    <div class="doc-number">${escapeHtml(inv.invoiceNumber)}</div>
    <div class="doc-date">${fmtDate(inv.issueDate || inv.createdAt)}</div>
    <div style="margin-top:6px;">${stampHtml(totals)}</div>`;

  // Purchase-order requisitioner strip (Requisitioner / Ship Via / F.O.B. / Shipping Terms)
  const poStrip = isPo ? `
    <div class="meta-strip">
      ${metaItem('Requisitioner', inv.requisitioner || '—')}
      ${metaItem('Ship Via', inv.shipVia || '—')}
      ${metaItem('F.O.B.', inv.fob || '—')}
      ${metaItem('Shipping Terms', inv.shippingTerms || '—')}
    </div>` : '';

  // Quote blocks: terms & conditions + customer acceptance signature (template layout)
  const quoteBlocks = isQuote ? `
    ${inv.termsAndConditions ? `
    <div class="comments-box">
      <h4>Terms and Conditions</h4>
      <div style="white-space:pre-line;">${escapeHtml(inv.termsAndConditions)}</div>
    </div>` : ''}
    <div class="comments-box">
      <h4>Customer Acceptance (sign below)</h4>
      <div class="sig-line">x <span class="line">&nbsp;</span></div>
      <div class="sig-line">Print Name: <span class="line" style="min-width:200px;">&nbsp;</span></div>
    </div>` : '';

  const comments = `
    <div class="comments-box">
      <h4>Other Comments / Special Instructions</h4>
      1. Payment due ${inv.terms && inv.terms !== 'custom' ? (TERMS_LABEL[inv.terms] || 'Net 30 Days').replace('Net', 'within').replace(' Days', ' days') : 'by the due date'}.
      2. Please include the document number (${escapeHtml(inv.invoiceNumber)}) on your payment reference.
      ${isQuote ? '3. Customer will be billed after indicating acceptance of this quote.' : ''}
    </div>`;

  const footer = `
    <div class="footer-block">
      ${settings.receiptFooterMessage ? `<div>${escapeHtml(settings.receiptFooterMessage)}</div>` : ''}
      Thank you for your business!
      ${(settings.receiptFooterLines || []).filter(Boolean).map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
    </div>`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${docTitle} ${escapeHtml(inv.invoiceNumber)}</title>
      <style>${BASE_CSS}</style>
    </head>
    <body>
      <div class="container">
        ${letterheadHtml(settings, titleBlock)}
        ${metaStripHtml(inv, totals)}
        ${partyGridHtml(inv)}
        ${poStrip}
        ${linesTableHtml(inv, totals, symbol)}
        ${totalsTableHtml(inv, totals, symbol, taxRate)}
        ${comments}
        ${quoteBlocks}
        ${inv.notes ? `<div class="comments-box"><h4>Notes</h4><div style="white-space:pre-line;">${escapeHtml(inv.notes)}</div></div>` : ''}
        ${footer}
      </div>
    </body>
    </html>`;
}

/** A4 customer statement: every document for one customer + aging summary. */
export function buildCustomerStatementHtml(
  customerName: string,
  invoices: Invoice[],
  settings: StoreSettings,
  asOf: Date = new Date()
): string {
  const symbol = settings.primaryCurrencySymbol || '$';
  const rows = invoices
    .map((inv) => {
      const t = computeInvoiceTotals(inv, asOf, settings);
      const statusLabel = t.effectiveStatus === 'draft' ? 'Draft' : t.isOverdue ? `Overdue ${t.ageDays}d` : t.effectiveStatus;
      return `
        <tr>
          <td>${fmtDate(inv.issueDate || inv.createdAt)}</td>
          <td class="font-mono">${escapeHtml(inv.invoiceNumber)}</td>
          <td>${fmtDate(inv.dueDate)}</td>
          <td class="text-right font-mono">${money(symbol, t.total)}</td>
          <td class="text-right font-mono">${money(symbol, t.paid)}</td>
          <td class="text-right font-mono font-bold">${money(symbol, t.outstanding)}</td>
          <td class="text-center">${t.ageDays ?? '—'}</td>
          <td class="text-center">${escapeHtml(statusLabel)}</td>
        </tr>`;
    })
    .join('');
  const aging = agingSummary(invoices, asOf, settings);
  const titleBlock = `
    <div class="doc-title">STATEMENT</div>
    <div class="doc-number">${escapeHtml(customerName)}</div>
    <div class="doc-date">As of ${fmtDate(asOf.toISOString())}</div>`;
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Statement ${escapeHtml(customerName)}</title>
      <style>${BASE_CSS}</style>
    </head>
    <body>
      <div class="container">
        ${letterheadHtml(settings, titleBlock)}
        <table class="lines">
          <thead>
            <tr>
              <th>Date</th><th>Number</th><th>Due Date</th>
              <th class="text-right">Amount</th><th class="text-right">Paid</th>
              <th class="text-right">Outstanding</th><th class="text-center" style="width:52px;">Age</th><th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="8" class="text-center muted">No documents</td></tr>'}</tbody>
        </table>
        <div class="comments-box">
          <h4>Aging Summary</h4>
          Current: <strong>${money(symbol, aging.current)}</strong> &nbsp;·&nbsp;
          1-30: <strong>${money(symbol, aging.d1_30)}</strong> &nbsp;·&nbsp;
          31-60: <strong>${money(symbol, aging.d31_60)}</strong> &nbsp;·&nbsp;
          61-90: <strong>${money(symbol, aging.d61_90)}</strong> &nbsp;·&nbsp;
          &gt;90: <strong>${money(symbol, aging.over90)}</strong>
          <div style="margin-top:6px; font-size:12px;">Total Outstanding: <strong>${money(symbol, aging.totalOutstanding)}</strong></div>
        </div>
        <div class="footer-block">Thank you for your business!</div>
      </div>
    </body>
    </html>`;
}

/** Print an HTML document through a hidden iframe (same mechanics as receipts). */
function printHtml(html: string, title: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.title = title;
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 500);
  }
}

/** Print / save-as-PDF an Invoice, Quote or Purchase Order. */
export function printBusinessDocument(inv: Invoice, settings: StoreSettings): void {
  printHtml(buildBusinessDocumentHtml(inv, settings), `Business document ${inv.invoiceNumber}`);
}

/** Print / save-as-PDF a per-customer statement. */
export function printCustomerStatement(
  customerName: string,
  invoices: Invoice[],
  settings: StoreSettings,
  asOf?: Date
): void {
  printHtml(buildCustomerStatementHtml(customerName, invoices, settings, asOf), `Statement ${customerName}`);
}
