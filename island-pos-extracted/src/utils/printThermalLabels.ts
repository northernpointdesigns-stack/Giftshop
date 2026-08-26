import JsBarcode from 'jsbarcode';
import { InventoryItem } from '../types/pos';
import { validateGS1GTIN, generateGS1GTIN13 } from './gs1Barcode';
import { GS1Symbology } from '../components/admin/BarcodePrinterModal';

export const printThermalLabels = (
  items: InventoryItem[],
  quantities: Record<string, number>,
  symbology: GS1Symbology,
  showPrice: boolean,
  showBrand: boolean,
  showCategory: boolean,
  showSizeVariant: boolean,
  showVatBadge: boolean
) => {
  // Generate HTML for each label
  const labelsHtml = items.flatMap((item) => {
    const count = quantities[item.id] || 1;
    
    // Barcode generation logic matches BarcodePrinterModal
    let barcodeValue = item.sku;
    let jsbarcodeFormat = 'CODE128';
    
    if (symbology === 'EAN13' || symbology === 'UPC') {
      const validation = validateGS1GTIN(item.sku);
      if (!validation.isValid) {
        barcodeValue = generateGS1GTIN13('950', item.sku);
      } else {
        barcodeValue = item.sku.replace(/\D/g, '');
      }
      if (symbology === 'EAN13') {
        jsbarcodeFormat = 'EAN13';
        if (barcodeValue.length !== 13) {
          barcodeValue = generateGS1GTIN13('950', barcodeValue);
        }
      } else if (symbology === 'UPC') {
        jsbarcodeFormat = 'UPC';
        if (barcodeValue.length !== 12) {
          barcodeValue = barcodeValue.slice(0, 12).padStart(12, '0');
        }
      }
    } else if (symbology === 'GS1_128') {
      jsbarcodeFormat = 'CODE128';
      const validation = validateGS1GTIN(item.sku);
      const gtin14 = validation.isValid
        ? item.sku.replace(/\D/g, '').padStart(14, '0')
        : generateGS1GTIN13('950', item.sku).padStart(14, '0');
      barcodeValue = `(01)${gtin14}`;
    }

    let barcodeImgStr = '';
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, barcodeValue, {
        format: jsbarcodeFormat,
        width: 1.2,
        height: 25,
        displayValue: true,
        fontSize: 10,
        margin: 1,
        font: 'monospace',
      });
      barcodeImgStr = canvas.toDataURL('image/png');
    } catch {
      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, item.sku, {
          format: 'CODE128',
          width: 1.2,
          height: 25,
          displayValue: true,
          fontSize: 10,
          margin: 1,
          font: 'monospace',
        });
        barcodeImgStr = canvas.toDataURL('image/png');
      } catch (e) {
        // Fallback if both fail
      }
    }

    const vatPercent = Math.round((item.vatRate ?? 0.15) * 100);

    return Array.from({ length: count }).map(() => `
      <div class="label-container">
        ${showBrand ? `<div class="brand">${item.brand || 'Unbranded'}</div>` : ''}
        <div class="product-name">${item.name}</div>
        <div class="meta-row">
          ${showCategory ? `<span>${item.category}</span>` : ''}
          ${showCategory && showSizeVariant && item.size ? `<span>&bull;</span>` : ''}
          ${showSizeVariant && item.size ? `<span>Size: ${item.size}</span>` : ''}
          ${showSizeVariant && item.variant ? `<span>(${item.variant})</span>` : ''}
        </div>
        <div class="barcode-area">
          ${barcodeImgStr ? `<img src="${barcodeImgStr}" />` : ''}
        </div>
        <div class="footer">
          <span class="gs1-tag">GS1 GTIN</span>
          ${showPrice ? `
            <div class="price-area">
              <span class="price">$${item.retailPrice.toFixed(2)}</span>
              ${showVatBadge ? `<span class="vat-badge">+${vatPercent}% VAT</span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `);
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Print Labels</title>
      <style>
        /* 
          Dymo 30334 format or Brother standard roll:
          2.25" x 1.25" (approx 57mm x 32mm).
        */
        @page {
          margin: 0;
          size: 2.25in 1.25in;
        }
        
        body {
          margin: 0;
          padding: 0;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          background: #fff;
          color: #000;
          width: 2.25in;
          /* height: 1.25in; /* Some browsers prefer not setting height */ 
        }

        .label-container {
          width: 2.25in;
          height: 1.25in;
          box-sizing: border-box;
          padding: 2mm 3mm;
          overflow: hidden;
          page-break-after: always;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: center;
        }

        .brand {
          font-weight: 800;
          font-size: 7px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .product-name {
          font-weight: bold;
          font-size: 8.5px;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.1;
        }

        .meta-row {
          font-size: 7px;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 2px;
        }

        .barcode-area {
          flex-grow: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .barcode-area img {
          max-width: 100%;
          max-height: 25px; /* keep it scaled */
        }

        .footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #ccc;
          padding-top: 1px;
        }

        .gs1-tag {
          font-size: 6px;
          font-weight: bold;
          color: #555;
        }

        .price-area {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .price {
          font-weight: 900;
          font-size: 9px;
          font-family: monospace;
        }

        .vat-badge {
          font-size: 6px;
          background-color: #eee;
          padding: 1px 2px;
          border-radius: 2px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      ${labelsHtml}
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
        document.body.removeChild(iframe);
      }, 1000);
    }, 500); 
  }
};
