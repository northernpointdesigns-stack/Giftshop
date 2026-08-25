import JsBarcode from 'jsbarcode';
import { Transaction, StoreSettings, TaxFreeDetails } from '../types/pos';
import { resolveStoreName } from '../services/brand';

export const printThermalReceipt = (
  transaction: Transaction,
  settings: StoreSettings,
  rollWidth: '80mm' | '58mm' = '80mm',
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

  // Selected roll width configuration
  const actualWidth = settings.thermalReceiptWidth || rollWidth || '80mm';
  const is58mm = actualWidth === '58mm';
  const paperWidth = is58mm ? '58mm' : '80mm';
  const baseFontSize = is58mm ? '10px' : '12px';

  // Generate Barcode SVG string
  let barcodeHtml = '';
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, transaction.receiptNumber, {
      format: 'CODE128',
      width: is58mm ? 1.2 : 1.5,
      height: is58mm ? 32 : 40,
      displayValue: true,
      fontSize: is58mm ? 10 : 12,
      margin: 3,
    });
    barcodeHtml = `<img src="${canvas.toDataURL('image/png')}" style="max-width: 100%; height: auto;" alt="Barcode" />`;
  } catch (err) {
    console.error('Failed to generate thermal barcode', err);
  }

  // Generate QR Code URL for digital receipt lookup
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${is58mm ? '100x100' : '130x130'}&data=${encodeURIComponent(
    `${window.location.origin}${window.location.pathname}?receipt=${transaction.receiptNumber}`
  )}`;

  // Construct items HTML (Suppressed prices for Gift Receipt)
  const itemsHtml = transaction.items
    .map(
      (item) => `
    <div class="item-row">
      <div class="item-name">${item.brand ? `[${item.brand}] ` : ''}${item.name}${item.size ? ` (${item.size})` : ''}</div>
      ${
        isGift
          ? `
        <div class="item-details font-mono font-bold">
          <span>Qty: ${Math.abs(item.quantity)}</span>
          <span>[ GIFT ITEM ]</span>
        </div>
      `
          : `
        <div class="item-details">
          <span>${Math.abs(item.quantity)} x ${primarySymbol} ${item.unitPrice.toFixed(2)}</span>
          <span class="font-bold">${primarySymbol} ${item.totalPrice.toFixed(2)}</span>
        </div>
        ${
          item.isDamaged && item.discountAmount && item.discountAmount > 0
            ? `<div class="item-discount">- Markdown (${item.damageDiscountPercent || 0}%): -${primarySymbol} ${item.discountAmount.toFixed(2)}</div>`
            : ''
        }
        <div class="item-vat">VAT ${( (item.vatRate || 0.15) * 100 ).toFixed(0)}%: ${primarySymbol} ${(item.vatAmount || 0).toFixed(2)}</div>
      `
      }
    </div>
  `
    )
    .join('');

  // Construct Thermal HTML Document
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Thermal Receipt ${transaction.receiptNumber}</title>
      <style>
        @page {
          margin: 0;
          size: ${paperWidth} auto;
        }
        @media print {
          body {
            width: ${paperWidth} !important;
            padding: ${is58mm ? '4px' : '8px'} !important;
          }
          .thermal-logo-container {
            margin: 0 auto 6px auto !important;
            text-align: center !important;
          }
          .thermal-logo {
            max-width: ${is58mm ? '38mm' : '54mm'} !important;
            max-height: 25mm !important;
            object-fit: contain !important;
            display: block !important;
            margin: 0 auto !important;
            filter: grayscale(100%) contrast(150%) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        .thermal-logo-container {
          text-align: center;
          margin: 0 auto 6px auto;
        }
        .thermal-logo {
          max-width: ${is58mm ? '42mm' : '58mm'};
          max-height: 28mm;
          object-fit: contain;
          display: block;
          margin: 0 auto;
          filter: grayscale(100%) contrast(140%);
        }
        body {
          font-family: 'Courier New', Courier, monospace, 'Lucida Console';
          width: ${paperWidth};
          margin: 0 auto;
          padding: ${is58mm ? '6px 4px' : '10px 8px'};
          color: #000;
          background: #fff;
          font-size: ${baseFontSize};
          line-height: 1.35;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700; }
        .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .double-divider {
          border-top: 2px dashed #000;
          margin: 8px 0;
        }
        .header h1 {
          font-size: ${is58mm ? '13px' : '15px'};
          font-weight: 800;
          margin: 0 0 3px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .header p {
          margin: 0 0 2px 0;
          font-size: ${is58mm ? '9px' : '10px'};
        }
        .main-currency-banner {
          border: 1px solid #000;
          padding: 3px 4px;
          margin: 6px 0;
          text-align: center;
          font-weight: bold;
          font-size: ${is58mm ? '9px' : '10.5px'};
          letter-spacing: 0.2px;
          background: #fff;
        }
        .receipt-info {
          font-size: ${is58mm ? '9.5px' : '10.5px'};
          margin-bottom: 6px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        .items-heading {
          font-weight: bold;
          font-size: ${is58mm ? '9.5px' : '11px'};
          margin-bottom: 4px;
          display: flex;
          justify-content: space-between;
        }
        .item-row {
          margin-bottom: 5px;
          font-size: ${is58mm ? '9.5px' : '11px'};
        }
        .item-name {
          font-weight: 600;
          word-break: break-word;
        }
        .item-details {
          display: flex;
          justify-content: space-between;
        }
        .item-discount {
          font-size: ${is58mm ? '8.5px' : '9.5px'};
          font-style: italic;
          text-align: right;
        }
        .item-vat {
          font-size: ${is58mm ? '8px' : '9px'};
          color: #444;
          text-align: right;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
          font-size: ${is58mm ? '10px' : '11.5px'};
        }
        .grand-total {
          font-size: ${is58mm ? '12.5px' : '14px'};
          font-weight: 800;
          margin-top: 4px;
          padding-top: 4px;
          border-top: 1px solid #000;
        }
        .secondary-settlement {
          border: 1px dashed #000;
          padding: 4px;
          margin: 5px 0;
          font-size: ${is58mm ? '9px' : '10px'};
        }
        .payment-info {
          font-size: ${is58mm ? '9.5px' : '10.5px'};
          margin-top: 6px;
        }
        .barcode-container {
          margin-top: 10px;
          text-align: center;
        }
        .qr-code-container {
          margin-top: 8px;
          text-align: center;
        }
        .qr-code-container img {
          width: ${is58mm ? '75px' : '90px'};
          height: ${is58mm ? '75px' : '90px'};
        }
        .footer {
          margin-top: 12px;
          text-align: center;
          font-size: ${is58mm ? '8.5px' : '9.5px'};
        }
        .badge-refund {
          display: inline-block;
          border: 1.5px solid #000;
          padding: 2px 6px;
          font-weight: 800;
          font-size: ${is58mm ? '10px' : '12px'};
          margin-bottom: 5px;
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <div class="header text-center">
        ${
          isGift
            ? '<div class="badge-refund" style="border-color:#000;">🎁 GIFT RECEIPT</div>'
            : transaction.isRefund
            ? '<div class="badge-refund">*** REFUND CREDIT MEMO ***</div>'
            : isTaxFree
            ? '<div class="badge-refund" style="border-color:#000;">✈️ TOURIST TAX-FREE EXPORT</div>'
            : ''
        }
        ${
          logoUrl
            ? `<div class="thermal-logo-container"><img src="${logoUrl}" class="thermal-logo" alt="Shop Logo" /></div>`
            : ''
        }
        <h1>${resolveStoreName(settings)}</h1>
        ${settings.receiptHeaderSubtitle ? `<p style="font-weight: bold;">${settings.receiptHeaderSubtitle}</p>` : ''}
        ${settings.receiptHeaderLines?.map((line) => `<p>${line}</p>`).join('') || ''}
        <p><strong>VAT / TIN REG:</strong> ${settings.taxRegistrationNumber || 'N/A'}</p>
      </div>

      <!-- PROMINENT MAIN CURRENCY BANNER -->
      <div class="main-currency-banner">
        MAIN CURRENCY: ${primaryCode} (${primarySymbol})
      </div>

      <div class="divider"></div>

      <div class="receipt-info">
        <div class="info-row">
          <span>${isGift ? 'Gift Receipt #:' : transaction.isRefund ? 'Voucher #:' : 'Receipt #:'}</span>
          <span class="font-bold">${transaction.receiptNumber}</span>
        </div>
        ${
          transaction.originalReceiptNumber
            ? `
          <div class="info-row">
            <span>Original Receipt:</span>
            <span>${transaction.originalReceiptNumber}</span>
          </div>
        `
            : ''
        }
        <div class="info-row">
          <span>Date/Time:</span>
          <span>${new Date(transaction.timestamp).toLocaleString()}</span>
        </div>
        <div class="info-row">
          <span>Cashier:</span>
          <span>${transaction.cashierName}</span>
        </div>
        <div class="info-row">
          <span>Terminal:</span>
          <span>${transaction.registerName || 'Main Boutique Counter'}</span>
        </div>
        ${
          transaction.customerName
            ? `
          <div class="info-row">
            <span>Customer:</span>
            <span class="font-bold">${transaction.customerName}</span>
          </div>
        `
            : ''
        }
        ${
          transaction.loyaltyPointsEarned && transaction.loyaltyPointsEarned > 0
            ? `
          <div class="info-row">
            <span>Loyalty Earned:</span>
            <span class="font-bold">+${transaction.loyaltyPointsEarned} pts</span>
          </div>
        `
            : ''
        }
        ${
          transaction.isRefund && transaction.refundReason
            ? `
          <div class="info-row" style="margin-top: 3px; font-style: italic;">
            <span>Reason:</span>
            <span>${transaction.refundReason}</span>
          </div>
        `
            : ''
        }
      </div>

      <div class="divider"></div>

      <div class="items-list">
        <div class="items-heading">
          <span>${isGift ? 'GIFT ITEMS LIST' : transaction.isRefund ? 'RETURNED ITEMS' : 'ITEM DESCRIPTION'}</span>
          <span>${isGift ? 'QUANTITY' : `TOTAL (${primarySymbol})`}</span>
        </div>
        ${itemsHtml}
      </div>

      <div class="divider"></div>

      ${
        isGift
          ? `
        <div class="secondary-settlement" style="text-align: center; margin: 8px 0;">
          <div style="font-weight: 800; font-size: 11px;">🎁 GIFT RECEIPT VOUCHER</div>
          <div style="font-size: 9px; margin-top: 4px;">Prices suppressed for gift presentation.</div>
          <div style="font-size: 8.5px; margin-top: 2px; font-style: italic;">Exchanges accepted with this receipt within 14 days.</div>
        </div>
      `
          : `
        <div class="totals">
          <div class="totals-row">
            <span>Subtotal (Net):</span>
            <span>${primarySymbol} ${transaction.subtotal.toFixed(2)}</span>
          </div>
          ${
            transaction.itemDiscountTotal && transaction.itemDiscountTotal > 0
              ? `
            <div class="totals-row">
              <span>Item Markdowns:</span>
              <span>-${primarySymbol} ${transaction.itemDiscountTotal.toFixed(2)}</span>
            </div>
          `
              : ''
          }
          ${
            transaction.discount > 0
              ? `
            <div class="totals-row">
              <span>Order Discount:</span>
              <span>-${primarySymbol} ${transaction.discount.toFixed(2)}</span>
            </div>
          `
              : ''
          }
          <div class="totals-row">
            <span>VAT Tax Amount:</span>
            <span>${primarySymbol} ${(transaction.vatTotal || transaction.tax || 0).toFixed(2)}</span>
          </div>

          <div class="totals-row grand-total">
            <span>${transaction.isRefund ? 'TOTAL REFUNDED:' : 'TOTAL AMOUNT:'}</span>
            <span>${primarySymbol} ${transaction.total.toFixed(2)}</span>
          </div>

          ${
            taxFree
              ? `
            <div class="secondary-settlement" style="margin-top: 6px; border-style: solid;">
              <div class="info-row font-bold" style="border-bottom: 1px solid #000; padding-bottom: 2px;">
                <span>✈️ TAX-FREE TOURIST REFUND:</span>
                <span>${taxFree.certificateRef}</span>
              </div>
              <div class="info-row"><span>Traveler:</span><span>${taxFree.travelerName}</span></div>
              <div class="info-row"><span>Passport #:</span><span>${taxFree.passportNumber} (${taxFree.passportCountry})</span></div>
              ${taxFree.flightNumber ? `<div class="info-row"><span>Flight:</span><span>${taxFree.flightNumber}</span></div>` : ''}
              <div class="info-row font-bold" style="margin-top: 3px; border-top: 1px dashed #000; padding-top: 2px;">
                <span>Net Refund Payable:</span>
                <span>${primarySymbol} ${(taxFree.netRefundAmount || 0).toFixed(2)}</span>
              </div>
            </div>
          `
              : ''
          }`
      }

        <!-- FOREIGN / SECONDARY CURRENCY BREAKDOWN -->
        ${
          transaction.currencyUsed === 'secondary' && transaction.secondaryTotal
            ? `
          <div class="secondary-settlement">
            <div class="info-row font-bold">
              <span>Settled in ${secondaryCode}:</span>
              <span>${secondarySymbol} ${transaction.secondaryTotal.toFixed(2)}</span>
            </div>
            <div class="info-row" style="font-size: ${is58mm ? '8px' : '9px'};">
              <span>Applied Rate:</span>
              <span>1 ${secondaryCode} = ${primarySymbol} ${(transaction.exchangeRateUsed || exchangeRate).toFixed(2)}</span>
            </div>
            <div class="info-row" style="font-size: ${is58mm ? '8px' : '9px'};">
              <span>Statutory Base:</span>
              <span>${primarySymbol} ${transaction.total.toFixed(2)} ${primaryCode}</span>
            </div>
          </div>
        `
            : ''
        }
      </div>

      <div class="divider"></div>

      <div class="payment-info">
        <div class="info-row font-bold">
          <span style="text-transform: capitalize;">${transaction.isRefund ? 'Refunded via' : 'Paid via'} ${transaction.paymentMethod}:</span>
          <span>
            ${
              transaction.currencyUsed === 'secondary' && transaction.secondaryTotal
                ? `${secondarySymbol} ${transaction.secondaryTotal.toFixed(2)} ${secondaryCode}`
                : `${primarySymbol} ${Math.abs(transaction.total).toFixed(2)} ${primaryCode}`
            }
          </span>
        </div>

        ${
          transaction.splitPayments && transaction.splitPayments.length > 0
            ? `
          <div class="secondary-settlement" style="margin-top: 4px;">
            <div class="info-row font-bold" style="border-bottom: 1px dashed #000; padding-bottom: 2px; margin-bottom: 3px;">
              <span>SPLIT TENDER BREAKDOWN:</span>
              <span>${transaction.splitPayments.length} LINES</span>
            </div>
            ${transaction.splitPayments
              .map(
                (p) => `
              <div class="info-row">
                <span>${p.method === 'cash' ? 'Cash' : p.method === 'card' ? 'Card' : 'Gift Card'} (${p.currencyCode}):</span>
                <span>${p.currencySymbol}${p.amountTendered.toFixed(2)} (${primarySymbol}${p.amountInPrimary.toFixed(2)})</span>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }

        ${
          transaction.paymentMethod === 'cash' && transaction.cashGiven !== undefined
            ? `
          <div class="info-row">
            <span>Cash Tendered:</span>
            <span>
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
          <div class="info-row">
            <span>Change Returned:</span>
            <span>
              ${
                transaction.currencyUsed === 'secondary' && transaction.changeDueSecondary !== undefined
                  ? `${secondarySymbol} ${transaction.changeDueSecondary.toFixed(2)} ${secondaryCode}`
                  : `${primarySymbol} ${transaction.changeDue.toFixed(2)} ${primaryCode}`
              }
            </span>
          </div>
        `
            : ''
        }

        ${
          transaction.currencyUsed === 'secondary' &&
          transaction.paymentMethod === 'cash' &&
          transaction.changeDueSecondary !== undefined &&
          transaction.changeDueSecondary > 0
            ? `
          <div class="info-row" style="font-size: ${is58mm ? '8px' : '9px'}; font-style: italic;">
            <span>(Change in ${primaryCode}):</span>
            <span>${primarySymbol} ${(transaction.changeDueSecondary * (transaction.exchangeRateUsed || exchangeRate)).toFixed(2)}</span>
          </div>
        `
            : ''
        }
      </div>

      <div class="barcode-container">
        ${barcodeHtml}
      </div>

      <div class="qr-code-container">
        <div style="font-size: ${is58mm ? '8px' : '9px'}; margin-bottom: 3px;">Scan for Digital Receipt</div>
        <img src="${qrCodeUrl}" alt="Digital Receipt QR" />
      </div>

      <div class="divider"></div>

      <div class="footer">
        ${settings.receiptFooterMessage ? `<p class="font-bold">${settings.receiptFooterMessage}</p>` : ''}
        ${settings.receiptFooterPolicy ? `<p>${settings.receiptFooterPolicy}</p>` : ''}
        ${settings.receiptFooterLines?.map((line) => `<p>${line}</p>`).join('') || ''}
        <p style="margin-top: 4px; font-size: ${is58mm ? '7.5px' : '8.5px'}; color: #666;">
          Official Tax Base: ${primaryCode} • Powered by The Gift Shop POS
        </p>
      </div>
    </body>
    </html>
  `;

  // Create an invisible iframe for instant clean thermal printing
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

    // Wait for images to load before opening OS print dialogue
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      // Cleanup after print dialog closes
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 500);
  }
};
