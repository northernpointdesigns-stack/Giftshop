import { VendorLedgerSnapshot, StoreSettings, ConsignmentPayoutRecord, VendorAdvance } from '../types/pos';
import { formatMoney } from './currencyAndMath';

export interface PrintVendorReceiptOptions {
  settlementRecord?: ConsignmentPayoutRecord;
  advanceRecord?: VendorAdvance;
  titleOverride?: string;
}

export const printVendorPaymentReceipt = (
  ledgerSnapshot: VendorLedgerSnapshot,
  settings: StoreSettings,
  options?: PrintVendorReceiptOptions
) => {
  const { vendor, transactions, periodSales, advanceTotal, settledTotal, netOwing, isWholesale } = ledgerSnapshot;
  if (!vendor) return;

  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';
  const logoUrl = settings.shopLogoUrl || settings.receiptLogoUrl || settings.brandLogoUrl;
  const money = (val: number | undefined | null) => formatMoney(val || 0, primarySymbol, primaryCode);

  const docTitle = options?.titleOverride || (options?.settlementRecord ? `PAYMENT RECEIPT — ${options.settlementRecord.id}` : options?.advanceRecord ? `ADVANCE VOUCHER — ${options.advanceRecord.id}` : `VENDOR LEDGER STATEMENT — ${vendor.name}`);

  const rows = transactions.map(t => `
    <tr>
      <td class="mono">${new Date(t.timestamp).toLocaleDateString()}</td>
      <td class="mono bold">${t.receiptNumber}</td>
      <td>${t.name}</td>
      <td class="mono">${t.sku}</td>
      <td class="tc mono bold">${t.isRefund ? `-${Math.abs(t.quantity)}` : t.quantity}</td>
      <td class="tr mono">${money(t.unitPrice)}</td>
      <td class="tr mono">${t.isRefund ? '-' : ''}${money(Math.abs(t.totalPrice))}</td>
      <td class="tr mono bold" style="color:#0284c7;">${t.isRefund ? '-' : ''}${money(Math.abs(t.vendorPayout))}</td>
      <td class="tc">${t.isRefund ? '<span class="badge badge-refund">Refund</span>' : '<span class="badge badge-sale">Sale</span>'}</td>
    </tr>`).join('');

  const bodySummary = `
<div class="hdr">
  <div>
    ${logoUrl ? `<div class="logo"><img src="${logoUrl}" alt="Logo"/></div>` : ''}
    <div class="store">${settings.storeName || 'The Gift Shop'}</div>
    <div style="font-size: 9px; color: #475569;">${settings.taxRegistrationNumber ? `TIN: ${settings.taxRegistrationNumber} &bull; ` : ''}Currency: ${primaryCode} (${primarySymbol})</div>
  </div>
  <div>
    <div class="title">${options?.settlementRecord ? 'Payment Receipt' : options?.advanceRecord ? 'Advance Voucher' : 'Vendor Ledger Statement'}</div>
    <div class="sub">Issued: ${new Date().toLocaleString()}</div>
    ${options?.settlementRecord ? `<div class="sub mono bold">Ref: ${options.settlementRecord.id}</div>` : ''}
    ${options?.advanceRecord ? `<div class="sub mono bold">Ref: ${options.advanceRecord.id}</div>` : ''}
  </div>
</div>

<div class="grid">
  <div class="card">
    <div class="card-title">Vendor Profile</div>
    <div class="row"><span class="lbl">Vendor:</span><span class="val">${vendor.name}</span></div>
    ${vendor.brandName ? `<div class="row"><span class="lbl">Brand:</span><span class="val">${vendor.brandName}</span></div>` : ''}
    <div class="row"><span class="lbl">Contact:</span><span class="val">${vendor.contactName || '—'}</span></div>
    <div class="row"><span class="lbl">Supplier Model:</span><span class="val">${vendor.supplierType} ${isWholesale ? '(Wholesale)' : `(${(100 - (vendor.consignmentCutRate || 0) * 100).toFixed(0)}% Payout)`}</span></div>
  </div>
  <div class="card">
    <div class="card-title">Statement Summary</div>
    <div class="row"><span class="lbl">Period Gross Sales:</span><span class="val mono">${money(periodSales.grossSales)}</span></div>
    <div class="row"><span class="lbl">Vendor Gross Share:</span><span class="val mono">${money(periodSales.vendorPayout)}</span></div>
    <div class="row"><span class="lbl">Advances Issued:</span><span class="val mono">-${money(advanceTotal)}</span></div>
    <div class="row"><span class="lbl">Prior Settlements:</span><span class="val mono">-${money(settledTotal)}</span></div>
    <div class="row" style="border-top:1px solid #0f172a; margin-top:3px; padding-top:3px;">
      <span class="lbl bold" style="color:#0f172a;">NET OWING BALANCE:</span>
      <span class="val mono bold" style="color:${netOwing > 0 ? '#b91c1c' : '#15803d'};">${money(netOwing)}</span>
    </div>
  </div>
</div>`;

  const bodyDetails = `
<div class="metrics">
  <div class="m-box"><div class="m-lbl">Period Gross</div><div class="m-val">${money(periodSales.grossSales)}</div></div>
  <div class="m-box"><div class="m-lbl">Vendor Share</div><div class="m-val">${money(periodSales.vendorPayout)}</div></div>
  <div class="m-box green"><div class="m-lbl">Total Paid Out</div><div class="m-val">${money(settledTotal + advanceTotal)}</div></div>
  <div class="m-box ${netOwing > 0 ? 'red' : 'green'}"><div class="m-lbl">Current Outstanding</div><div class="m-val">${money(netOwing)}</div></div>
</div>

${options?.settlementRecord ? `
<div class="voucher">
  <div style="font-weight:800; text-transform:uppercase; color:#15803d; margin-bottom:4px;">★ Payment Settlement Receipt — ${options.settlementRecord.id}</div>
  <div class="grid">
    <div>
      <div><strong>Amount Paid:</strong> <span class="mono bold" style="font-size:12px; color:#15803d;">${money(options.settlementRecord.payoutAmount)}</span></div>
      <div><strong>Status:</strong> <span style="font-weight:800; color:#166534;">PAID / SETTLED</span></div>
    </div>
    <div>
      <div><strong>Date Paid:</strong> ${options.settlementRecord.paidAt ? new Date(options.settlementRecord.paidAt).toLocaleString() : '—'}</div>
      <div><strong>Notes:</strong> ${options.settlementRecord.notes || 'Period Settlement Payment'}</div>
    </div>
  </div>
</div>` : ''}

${options?.advanceRecord ? `
<div class="voucher-adv">
  <div style="font-weight:800; text-transform:uppercase; color:#0369a1; margin-bottom:4px;">★ Vendor Advance Voucher — ${options.advanceRecord.id}</div>
  <div class="grid">
    <div>
      <div><strong>Advance Amount:</strong> <span class="mono bold" style="font-size:12px; color:#0369a1;">${money(options.advanceRecord.amount)}</span></div>
      <div><strong>Issued By:</strong> ${options.advanceRecord.recordedBy || 'Store Management'}</div>
    </div>
    <div>
      <div><strong>Date Issued:</strong> ${new Date(options.advanceRecord.date).toLocaleString()}</div>
      <div><strong>Note:</strong> ${options.advanceRecord.note || 'Cash advance against balance'}</div>
    </div>
  </div>
</div>` : ''}

<div class="sec-h">Itemized Sales & Return Traceability (${transactions.length} Lines)</div>
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Receipt #</th>
      <th>Product</th>
      <th>SKU</th>
      <th class="tc">Qty</th>
      <th class="tr">Unit Price</th>
      <th class="tr">Gross Total</th>
      <th class="tr">Vendor Share</th>
      <th class="tc">Status</th>
    </tr>
  </thead>
  <tbody>
    ${transactions.length === 0 ? `<tr><td colspan="9" class="tc" style="padding:10px; color:#64748b;">No transactions in period.</td></tr>` : rows}
  </tbody>
</table>

<div class="sigs">
  <div class="sig"><div style="height:20px;"></div>Store Manager / Cashier</div>
  <div class="sig"><div style="height:20px;"></div>Vendor / Depositor Signature</div>
  <div class="sig"><div style="height:20px;"></div>Official Store Stamp</div>
</div>

<div class="ftr">Computer-generated Vendor Payment Receipt & Statement &bull; ${settings.storeName || 'The Gift Shop'} POS &bull; ${primaryCode}</div>
`;

  const bodyHtml = bodySummary + bodyDetails;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${docTitle}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 10.5px; line-height: 1.35; color: #0f172a; margin: 0; padding: 0; }
.hdr { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
.logo img { max-height: 40px; margin-bottom: 4px; }
.store { font-size: 16px; font-weight: 800; text-transform: uppercase; }
.title { font-size: 15px; font-weight: 800; color: #0284c7; text-transform: uppercase; text-align: right; }
.sub { font-size: 9.5px; color: #64748b; text-align: right; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 8px 10px; }
.card-title { font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 4px; }
.row { display: flex; justify-content: space-between; margin-bottom: 2px; }
.lbl { color: #475569; font-weight: 500; }
.val { font-weight: 700; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; }
.m-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 5px; padding: 6px; text-align: center; }
.m-box.green { background: #f0fdf4; border-color: #86efac; } .m-box.green .m-val { color: #15803d; }
.m-box.red { background: #fef2f2; border-color: #fca5a5; } .m-box.red .m-val { color: #b91c1c; }
.m-lbl { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #64748b; }
.m-val { font-size: 12px; font-weight: 800; font-family: monospace; }
table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9.5px; }
th { background: #0f172a; color: #fff; font-weight: 700; text-transform: uppercase; font-size: 8.5px; padding: 5px 6px; text-align: left; }
td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; }
tr:nth-child(even) td { background: #f8fafc; }
.tr { text-align: right; } .tc { text-align: center; } .mono { font-family: monospace; } .bold { font-weight: 700; }
.badge { display: inline-block; padding: 1px 4px; border-radius: 3px; font-size: 7.5px; font-weight: 800; text-transform: uppercase; }
.badge-sale { background: #dcfce7; color: #166534; } .badge-refund { background: #fee2e2; color: #991b1b; }
.sec-h { font-size: 10px; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #0f172a; padding-bottom: 2px; margin: 10px 0 4px; }
.voucher { background: #f0fdf4; border: 1.5px solid #22c55e; border-radius: 5px; padding: 8px 10px; margin-bottom: 12px; }
.voucher-adv { background: #f0f9ff; border: 1.5px solid #0284c7; border-radius: 5px; padding: 8px 10px; margin-bottom: 12px; }
.sigs { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; page-break-inside: avoid; }
.sig { border-top: 1px solid #94a3b8; padding-top: 3px; text-align: center; font-size: 8.5px; color: #475569; font-weight: 600; }
.ftr { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 6px; text-align: center; font-size: 8px; color: #94a3b8; }
</style></head><body>
${bodyHtml}
</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = 'none';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 1500);
    }, 500);
  }
};
