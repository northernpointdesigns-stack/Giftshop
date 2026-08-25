import JsBarcode from 'jsbarcode';
import { Transaction, StoreSettings, TaxFreeDetails } from '../types/pos';

export const printStandardInvoice = (
  transaction: Transaction,
  settings: StoreSettings,
  options?: {
    isGiftReceipt?: boolean;
    isTaxFreeExport?: boolean;
    taxFreeDetails?: TaxFreeDetails;
  }
) => {
  const isGift = options?.isGiftReceipt || transaction.isGiftReceipt;
  const isTaxFree = options?.isTaxFreeExport || !!options?.taxFreeDetails || !!transaction.taxFreeDetails;
  const taxFree = options?.taxFreeDetails || transaction.taxFreeDetails;

  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 13.50;
  const logoUrl = settings.shopLogoUrl || settings.receiptLogoUrl || settings.brandLogoUrl;

  // Generate Barcode
  let barcodeHtml = '';
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, transaction.receiptNumber, {
      format: 'CODE128',
      width: 1.8,
      height: 45,
      displayValue: true,
      fontSize: 12,
      margin: 5,
    });
    barcodeHtml = `<img src="${canvas.toDataURL('image/png')}" style="max-height: 45px; width: auto;" alt="Barcode" />`;
  } catch (err) {
    console.error('Failed to generate standard invoice barcode', err);
  }

  // QR code URL for digital inspection
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
    `${window.location.origin}${window.location.pathname}?receipt=${transaction.receiptNumber}`
  )}`;

  // Item rows
  const itemsHtml = transaction.items
    .map((item, index) => {
      const lineSubtotal = item.unitPrice * Math.abs(item.quantity);
      const discount = item.discountAmount || 0;
      const vatRatePercent = ((item.vatRate || 0.15) * 100).toFixed(0);
      const vatAmt = item.vatAmount || 0;

      if (isGift) {
        return `
          <tr class="item-row ${index % 2 === 1 ? 'row-alt' : ''}">
            <td class="text-center font-mono text-muted">${index + 1}</td>
            <td>
              <div class="font-bold text-dark">${item.name}</div>
              <div class="text-xs text-muted">
                ${item.brand ? `<span class="badge-brand">${item.brand}</span> ` : ''}
                ${item.category ? `<span class="badge-category">${item.category}</span> ` : ''}
                SKU: <span class="font-mono">${item.sku}</span>
                ${item.size ? ` • Size: ${item.size}` : ''}
              </div>
            </td>
            <td class="text-center font-bold" style="font-size: 13px;">${Math.abs(item.quantity)}</td>
            <td colspan="5" class="text-center font-mono font-bold text-muted" style="letter-spacing: 1px;">
              [ GIFT ITEM - PRICE SUPPRESSED ]
            </td>
          </tr>
        `;
      }

      return `
        <tr class="item-row ${index % 2 === 1 ? 'row-alt' : ''}">
          <td class="text-center font-mono text-muted">${index + 1}</td>
          <td>
            <div class="font-bold text-dark">${item.name}</div>
            <div class="text-xs text-muted">
              ${item.brand ? `<span class="badge-brand">${item.brand}</span> ` : ''}
              ${item.category ? `<span class="badge-category">${item.category}</span> ` : ''}
              SKU: <span class="font-mono">${item.sku}</span>
              ${item.size ? ` • Size: ${item.size}` : ''}
            </div>
            ${
              item.isDamaged
                ? `<div class="text-xs text-danger font-semibold">⚠️ Damaged Item Markdown (${item.damageDiscountPercent || 0}% Off)</div>`
                : ''
            }
          </td>
          <td class="text-center font-bold">${Math.abs(item.quantity)}</td>
          <td class="text-right font-mono">${primarySymbol} ${item.unitPrice.toFixed(2)}</td>
          <td class="text-right font-mono ${discount > 0 ? 'text-danger' : 'text-muted'}">
            ${discount > 0 ? `-${primarySymbol} ${discount.toFixed(2)}` : '—'}
          </td>
          <td class="text-center text-xs font-mono">${vatRatePercent}%</td>
          <td class="text-right font-mono text-muted">${primarySymbol} ${vatAmt.toFixed(2)}</td>
          <td class="text-right font-mono font-bold text-dark">${primarySymbol} ${item.totalPrice.toFixed(2)}</td>
        </tr>
      `;
    })
    .join('');

  const docTitle = isGift
    ? 'GIFT RECEIPT & EXCHANGE VOUCHER'
    : isTaxFree
    ? 'VAT TAX-FREE EXPORT REFUND CLAIM FORM & CUSTOMS INVOICE'
    : transaction.isRefund
    ? 'CREDIT NOTE / REFUND MEMO'
    : 'OFFICIAL TAX INVOICE & RECEIPT';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${docTitle} - ${transaction.receiptNumber}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 14mm 12mm 14mm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #1e293b;
          background: #ffffff;
          margin: 0;
          padding: 0;
          font-size: 11px;
          line-height: 1.4;
        }
        .container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-bold { font-weight: 700; }
        .font-mono { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; }
        .text-muted { color: #64748b; }
        .text-dark { color: #0f172a; }
        .text-danger { color: #b91c1c; }
        .text-success { color: #047857; }
        .text-primary { color: #0369a1; }
        
        /* Letterhead Header */
        .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 14px;
          margin-bottom: 14px;
        }
        .store-brand {
          max-width: 60%;
        }
        .store-logo {
          max-height: 48px;
          max-width: 180px;
          object-contain: fit;
          margin-bottom: 6px;
        }
        .store-name {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
          margin: 0 0 3px 0;
          text-transform: uppercase;
        }
        .store-subtitle {
          font-size: 11px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 3px;
        }
        .store-lines {
          font-size: 10px;
          color: #64748b;
          line-height: 1.3;
        }
        .tax-id-badge {
          display: inline-block;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          color: #334155;
          margin-top: 5px;
        }

        /* Document Title Block */
        .doc-title-block {
          text-align: right;
          min-width: 200px;
        }
        .doc-badge {
          display: inline-block;
          background: ${transaction.isRefund ? '#fee2e2' : '#f0fdf4'};
          color: ${transaction.isRefund ? '#991b1b' : '#166534'};
          border: 1px solid ${transaction.isRefund ? '#fca5a5' : '#86efac'};
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .doc-number {
          font-size: 15px;
          font-weight: 800;
          font-family: 'SFMono-Regular', Consolas, monospace;
          color: #0f172a;
          margin-bottom: 3px;
        }
        .doc-date {
          font-size: 10px;
          color: #64748b;
        }

        /* Prominent Main Currency Callout Box */
        .currency-declaration-banner {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-left: 4px solid #0284c7;
          padding: 8px 12px;
          margin-bottom: 14px;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .currency-declaration-title {
          font-size: 11px;
          font-weight: 700;
          color: #0369a1;
        }
        .currency-declaration-desc {
          font-size: 10px;
          color: #475569;
        }
        .currency-badge {
          background: #e0f2fe;
          color: #0369a1;
          border: 1px solid #bae6fd;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 800;
          font-size: 11px;
        }

        /* Two-Column Metadata (Billed To / Transaction Details) */
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 14px;
        }
        .meta-col h3 {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          margin: 0 0 6px 0;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 3px;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 10.5px;
          margin-bottom: 3px;
        }
        .meta-row .label {
          color: #64748b;
        }
        .meta-row .value {
          font-weight: 600;
          color: #1e293b;
        }

        /* Items Table */
        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
        }
        .invoice-table th {
          background: #0f172a;
          color: #ffffff;
          padding: 7px 8px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: 1px solid #0f172a;
        }
        .invoice-table td {
          padding: 7px 8px;
          border: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .row-alt {
          background: #f8fafc;
        }
        .badge-brand {
          background: #e2e8f0;
          color: #334155;
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 600;
        }
        .badge-category {
          background: #ede9fe;
          color: #6b21a8;
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 600;
        }

        /* Bottom Summary Section */
        .summary-section {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 20px;
          align-items: start;
          margin-bottom: 16px;
        }
        .payment-audit-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 12px;
        }
        .payment-audit-box h4 {
          margin: 0 0 6px 0;
          font-size: 10px;
          text-transform: uppercase;
          color: #475569;
          font-weight: 700;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 3px;
        }
        .totals-table {
          width: 100%;
          border-collapse: collapse;
        }
        .totals-table td {
          padding: 4px 6px;
          font-size: 11px;
        }
        .grand-total-row {
          background: #0f172a;
          color: #ffffff;
          font-size: 13px !important;
          font-weight: 800;
        }
        .grand-total-row td {
          padding: 8px 10px !important;
          color: #ffffff;
        }

        /* Foreign Currency Highlight */
        .foreign-settlement-card {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          padding: 8px 10px;
          margin-top: 8px;
          font-size: 10px;
        }

        /* Signatures and Footer */
        .signatures-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          margin-top: 20px;
          padding-top: 14px;
          border-top: 1px dashed #cbd5e1;
        }
        .sig-block {
          text-align: center;
        }
        .sig-line {
          border-bottom: 1px solid #475569;
          height: 35px;
          margin-bottom: 4px;
        }
        .sig-label {
          font-size: 9px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }

        .footer-terms {
          margin-top: 16px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          font-size: 9.5px;
          color: #64748b;
          text-align: center;
          line-height: 1.4;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- HEADER / LETTERHEAD -->
        <div class="invoice-header">
          <div class="store-brand">
            ${
              logoUrl
                ? `<img src="${logoUrl}" class="store-logo" alt="Store Logo" />`
                : ''
            }
            <h1 class="store-name">${settings.storeName || 'Seychelles Island Boutique'}</h1>
            ${settings.receiptHeaderSubtitle ? `<div class="store-subtitle">${settings.receiptHeaderSubtitle}</div>` : ''}
            <div class="store-lines">
              ${settings.receiptHeaderLines?.map((line) => `<div>${line}</div>`).join('') || ''}
            </div>
            <div class="tax-id-badge">
              TAX ID / VAT TIN: <span class="font-mono font-bold">${settings.taxRegistrationNumber || 'TAX-SC-1002934'}</span>
            </div>
          </div>

          <div class="doc-title-block">
            <div class="doc-badge">${docTitle}</div>
            <div class="doc-number">${transaction.receiptNumber}</div>
            <div class="doc-date">Issued: ${new Date(transaction.timestamp).toLocaleString()}</div>
            ${
              transaction.originalReceiptNumber
                ? `<div class="text-xs text-danger font-semibold mt-1">Ref Original Receipt: ${transaction.originalReceiptNumber}</div>`
                : ''
            }
          </div>
        </div>

        <!-- PROMINENT MAIN CURRENCY BANNER -->
        <div class="currency-declaration-banner">
          <div>
            <div class="currency-declaration-title">Official Accounting & Tax Base Currency</div>
            <div class="currency-declaration-desc">
              All line items, statutory VAT (15%), and tax balances are audited and recorded in <strong>${primaryCode} (${primarySymbol})</strong>.
            </div>
          </div>
          <div class="currency-badge">
            BASE: ${primaryCode} (${primarySymbol})
          </div>
        </div>

        <!-- TWO-COLUMN METADATA GRID -->
        <div class="meta-grid">
          <div class="meta-col">
            <h3>Customer & Billing Information</h3>
            <div class="meta-row">
              <span class="label">Customer Name:</span>
              <span class="value">${transaction.customerName || 'Walk-in Retail Customer'}</span>
            </div>
            ${
              transaction.customerPhone
                ? `
              <div class="meta-row">
                <span class="label">Phone / WhatsApp:</span>
                <span class="value font-mono">${transaction.customerPhone}</span>
              </div>
            `
                : ''
            }
            ${
              transaction.customerEmail
                ? `
              <div class="meta-row">
                <span class="label">Email Address:</span>
                <span class="value">${transaction.customerEmail}</span>
              </div>
            `
                : ''
            }
            ${
              transaction.loyaltyPointsEarned && transaction.loyaltyPointsEarned > 0
                ? `
              <div class="meta-row">
                <span class="label">Loyalty Rewards:</span>
                <span class="value text-success">+${transaction.loyaltyPointsEarned} Points Earned</span>
              </div>
            `
                : ''
            }
            ${
              taxFree
                ? `
              <div style="margin-top: 8px; padding: 6px 8px; background: #f0f9ff; border: 1px solid #0284c7; border-radius: 6px;">
                <div style="font-weight: 700; color: #0369a1; text-transform: uppercase; font-size: 9px; margin-bottom: 3px;">✈️ Tourist Tax-Free Export Details:</div>
                <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 4px; font-size: 9.5px;">
                  <div>Claim Ref: <strong class="font-mono">${taxFree.certificateRef}</strong></div>
                  <div>Traveler: <strong>${taxFree.travelerName}</strong></div>
                  <div>Passport #: <strong class="font-mono">${taxFree.passportNumber}</strong> (${taxFree.passportCountry})</div>
                  <div>Flight: <strong>${taxFree.flightNumber || 'International Departure'}</strong></div>
                </div>
              </div>
            `
                : ''
            }
          </div>

          <div class="meta-col">
            <h3>Terminal & Processing Details</h3>
            <div class="meta-row">
              <span class="label">Cashier / Staff:</span>
              <span class="value">${transaction.cashierName}</span>
            </div>
            <div class="meta-row">
              <span class="label">Terminal / Register:</span>
              <span class="value font-bold">${transaction.registerName || 'Main Boutique Counter'}</span>
            </div>
            <div class="meta-row">
              <span class="label">Payment Method:</span>
              <span class="value font-bold" style="text-transform: capitalize;">${transaction.paymentMethod}</span>
            </div>
            <div class="meta-row">
              <span class="label">Settlement Currency:</span>
              <span class="value font-bold">
                ${transaction.currencyUsed === 'secondary' ? `${secondaryCode} (${secondarySymbol})` : `${primaryCode} (${primarySymbol})`}
              </span>
            </div>
            ${
              transaction.isRefund && transaction.refundReason
                ? `
              <div class="meta-row">
                <span class="label">Refund Reason:</span>
                <span class="value text-danger font-semibold">${transaction.refundReason}</span>
              </div>
            `
                : ''
            }
          </div>
        </div>

        <!-- LINE ITEMS TABLE -->
        <table class="invoice-table">
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>Description / SKU</th>
              <th class="text-center" style="width: 45px;">Qty</th>
              <th class="text-right" style="width: 80px;">Unit Price</th>
              <th class="text-right" style="width: 70px;">Discount</th>
              <th class="text-center" style="width: 50px;">VAT %</th>
              <th class="text-right" style="width: 75px;">VAT (${primarySymbol})</th>
              <th class="text-right" style="width: 85px;">Total (${primarySymbol})</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- SUMMARY & TOTALS SECTION -->
        <div class="summary-section">
          <!-- Left: Payment Audit & Barcode / QR -->
          <div class="payment-audit-box">
            <h4>Payment & Verification Audit</h4>
            <div class="meta-row">
              <span class="label">Transaction Status:</span>
              <span class="value ${transaction.isRefund ? 'text-danger' : 'text-success'}">
                ${transaction.isRefund ? 'Refund / Credit Voucher' : 'Completed & Settled'}
              </span>
            </div>
            <div class="meta-row">
              <span class="label">Tender Method:</span>
              <span class="value font-bold" style="text-transform: capitalize;">${transaction.paymentMethod}</span>
            </div>
            ${
              transaction.paymentMethod === 'cash' && transaction.cashGiven !== undefined
                ? `
              <div class="meta-row">
                <span class="label">Cash Tendered:</span>
                <span class="value font-mono">
                  ${
                    transaction.currencyUsed === 'secondary' && transaction.cashGivenSecondary !== undefined
                      ? `${secondarySymbol} ${transaction.cashGivenSecondary.toFixed(2)} ${secondaryCode}`
                      : `${primarySymbol} ${transaction.cashGiven.toFixed(2)} ${primaryCode}`
                  }
                </span>
              </div>
            `
                : ''
            }
            ${
              transaction.paymentMethod === 'cash' && transaction.changeDue !== undefined && transaction.changeDue > 0
                ? `
              <div class="meta-row">
                <span class="label">Change Due / Returned:</span>
                <span class="value font-mono font-bold text-success">
                  ${
                    transaction.currencyUsed === 'secondary' && transaction.changeDueSecondary !== undefined
                      ? `${secondarySymbol} ${transaction.changeDueSecondary.toFixed(2)} ${secondaryCode} (${primarySymbol} ${(transaction.changeDueSecondary * (transaction.exchangeRateUsed || exchangeRate)).toFixed(2)} ${primaryCode})`
                      : `${primarySymbol} ${transaction.changeDue.toFixed(2)} ${primaryCode}`
                  }
                </span>
              </div>
            `
                : ''
            }

            ${
              transaction.splitPayments && transaction.splitPayments.length > 0
                ? `
              <div class="foreign-settlement-card">
                <div class="font-bold text-primary mb-1">Split Payment & Currency Tender Breakdown:</div>
                <table style="width: 100%; font-size: 10px; border-collapse: collapse; margin-top: 4px;">
                  <thead>
                    <tr style="border-bottom: 1px solid #cbd5e1; text-align: left;">
                      <th style="padding: 2px 4px;">Method & Currency</th>
                      <th style="padding: 2px 4px; text-align: right;">Amount Tendered</th>
                      <th style="padding: 2px 4px; text-align: right;">Base Equivalent (${primarySymbol})</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${transaction.splitPayments
                      .map(
                        (p) => `
                      <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 2px 4px; text-transform: capitalize;">${p.method === 'cash' ? '💵 Cash' : p.method === 'card' ? '💳 Credit Card' : '🎁 Gift Card'} (${p.currencyCode})</td>
                        <td style="padding: 2px 4px; text-align: right; font-family: monospace;">${p.currencySymbol}${p.amountTendered.toFixed(2)}</td>
                        <td style="padding: 2px 4px; text-align: right; font-family: monospace; font-weight: bold;">${primarySymbol}${p.amountInPrimary.toFixed(2)}</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
                : ''
            }

            ${
              transaction.currencyUsed === 'secondary' && transaction.secondaryTotal
                ? `
              <div class="foreign-settlement-card">
                <div class="font-bold text-primary mb-1">Dual-Currency Conversion Details:</div>
                <div>Foreign Amount Paid: <strong>${secondarySymbol} ${transaction.secondaryTotal.toFixed(2)} ${secondaryCode}</strong></div>
                <div>Locked Exchange Rate: <strong>1 ${secondaryCode} = ${primarySymbol} ${(transaction.exchangeRateUsed || exchangeRate).toFixed(2)}</strong></div>
                <div class="text-muted mt-1">Official accounting ledger credited with ${primarySymbol} ${transaction.total.toFixed(2)} ${primaryCode}.</div>
              </div>
            `
                : ''
            }

            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
              <div>
                <div style="font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 2px;">Digital Audit Verification</div>
                ${barcodeHtml}
              </div>
              <div style="text-align: center;">
                <img src="${qrCodeUrl}" style="width: 55px; height: 55px; border: 1px solid #cbd5e1; padding: 2px; background: #fff;" alt="QR" />
                <div style="font-size: 7.5px; color: #64748b;">Scan to Audit</div>
              </div>
            </div>
          </div>

          <!-- Right: Totals Table -->
          <div>
            ${
              isGift
                ? `
              <div style="padding: 12px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; text-align: center;">
                <div style="font-weight: 800; font-size: 13px; color: #0f172a; text-transform: uppercase;">🎁 GIFT RECEIPT VOUCHER</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Monetary values &amp; prices suppressed for gift presentation.</div>
                <div style="font-size: 11px; font-weight: 700; color: #0284c7; margin-top: 6px;">Total Items Gifted: ${transaction.items.reduce((a, b) => a + Math.abs(b.quantity), 0)} Pcs</div>
                <div style="font-size: 9px; color: #475569; margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
                  Valid for merchandise exchange or store credit within 14 days with attached tags and this receipt barcode.
                </div>
              </div>
            `
                : `
              <table class="totals-table">
                <tr>
                  <td class="text-muted">Gross Subtotal (Excl. VAT):</td>
                  <td class="text-right font-mono font-semibold">${primarySymbol} ${transaction.subtotal.toFixed(2)}</td>
                </tr>
                ${
                  transaction.itemDiscountTotal && transaction.itemDiscountTotal > 0
                    ? `
                  <tr>
                    <td class="text-danger">Damaged Item Markdowns:</td>
                    <td class="text-right font-mono text-danger font-semibold">-${primarySymbol} ${transaction.itemDiscountTotal.toFixed(2)}</td>
                  </tr>
                `
                    : ''
                }
                ${
                  transaction.discount > 0
                    ? `
                  <tr>
                    <td class="text-danger">Order Level Discount:</td>
                    <td class="text-right font-mono text-danger font-semibold">-${primarySymbol} ${transaction.discount.toFixed(2)}</td>
                  </tr>
                `
                    : ''
                }
                <tr>
                  <td class="text-muted">Statutory VAT (15% Tax):</td>
                  <td class="text-right font-mono font-semibold">${primarySymbol} ${(transaction.vatTotal || transaction.tax || 0).toFixed(2)}</td>
                </tr>
                <tr class="grand-total-row">
                  <td>${transaction.isRefund ? 'TOTAL REFUNDED:' : 'TOTAL PAYABLE:'}</td>
                  <td class="text-right font-mono">${primarySymbol} ${transaction.total.toFixed(2)} ${primaryCode}</td>
                </tr>
                ${
                  taxFree
                    ? `
                  <tr style="background: #eff6ff; font-weight: 700; color: #1d4ed8; border-top: 2px solid #2563eb;">
                    <td>✈️ Net Tourist VAT Refund:</td>
                    <td class="text-right font-mono">${primarySymbol} ${(taxFree.netRefundAmount || 0).toFixed(2)}</td>
                  </tr>
                `
                    : ''
                }
                ${
                  transaction.currencyUsed === 'secondary' && transaction.secondaryTotal
                    ? `
                  <tr style="background: #f0f9ff; font-weight: 700; color: #0369a1;">
                    <td>Equivalent in ${secondaryCode}:</td>
                    <td class="text-right font-mono">${secondarySymbol} ${transaction.secondaryTotal.toFixed(2)} ${secondaryCode}</td>
                  </tr>
                `
                    : ''
                }
              </table>
            `
            }
          </div>
        </div>

        <!-- SIGNATURES -->
        <div class="signatures-grid">
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-label">Cashier Signature (${transaction.cashierName})</div>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-label">Customer / Recipient Signature</div>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-label">Store Manager Stamp & Verification</div>
          </div>
        </div>

        <!-- FOOTER & RETURN POLICY -->
        <div class="footer-terms">
          ${settings.receiptFooterMessage ? `<div class="font-bold text-dark mb-1">${settings.receiptFooterMessage}</div>` : ''}
          ${settings.receiptFooterPolicy ? `<div>${settings.receiptFooterPolicy}</div>` : ''}
          ${settings.receiptFooterLines?.map((line) => `<div>${line}</div>`).join('') || ''}
          <div class="text-muted mt-2" style="font-size: 8.5px;">
            This is an official computer-generated Tax Document. Main statutory currency: ${primaryCode}.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
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
};
