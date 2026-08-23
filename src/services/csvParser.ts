import { InventoryItem } from '../types/pos';

export function exportInventoryToCsv(items: InventoryItem[]): string {
  const headers = [
    'SKU',
    'Barcode',
    'Name',
    'Category',
    'Brand',
    'Price (SCR)',
    'Cost Price (SCR)',
    'Stock Level',
    'Reorder Point',
    'Is Consignment',
    'Vendor ID',
    'Tax Rate (%)',
  ];

  const rows = items.map((item) => [
    `"${item.sku.replace(/"/g, '""')}"`,
    `"${item.barcode.replace(/"/g, '""')}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.category.replace(/"/g, '""')}"`,
    `"${(item.brand || '').replace(/"/g, '""')}"`,
    item.price.toFixed(2),
    item.costPrice.toFixed(2),
    item.stockLevel,
    item.reorderPoint,
    item.isConsignment ? 'YES' : 'NO',
    `"${(item.vendorId || '').replace(/"/g, '""')}"`,
    item.taxRate || 15,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

export function parseInventoryCsv(csvText: string): Partial<InventoryItem>[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
  const parsedItems: Partial<InventoryItem>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    const cleanCols = cols.map((c) => c.replace(/^"|"$/g, '').trim());

    if (cleanCols.length < 3) continue;

    const skuIdx = headers.findIndex((h) => h.includes('sku'));
    const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('title'));
    const barcodeIdx = headers.findIndex((h) => h.includes('barcode') || h.includes('ean') || h.includes('upc'));
    const priceIdx = headers.findIndex((h) => h.includes('price') && !h.includes('cost'));
    const costIdx = headers.findIndex((h) => h.includes('cost'));
    const stockIdx = headers.findIndex((h) => h.includes('stock') || h.includes('qty'));
    const reorderIdx = headers.findIndex((h) => h.includes('reorder') || h.includes('min'));
    const catIdx = headers.findIndex((h) => h.includes('cat'));
    const brandIdx = headers.findIndex((h) => h.includes('brand'));
    const consignIdx = headers.findIndex((h) => h.includes('consign'));
    const vendorIdx = headers.findIndex((h) => h.includes('vendor'));

    const sku = skuIdx !== -1 ? cleanCols[skuIdx] : `SKU-${Date.now()}-${i}`;
    const name = nameIdx !== -1 ? cleanCols[nameIdx] : `Imported Item ${i}`;
    const barcode = barcodeIdx !== -1 && cleanCols[barcodeIdx] ? cleanCols[barcodeIdx] : sku;
    const price = priceIdx !== -1 ? parseFloat(cleanCols[priceIdx]) || 0 : 0;
    const costPrice = costIdx !== -1 ? parseFloat(cleanCols[costIdx]) || 0 : 0;
    const stockLevel = stockIdx !== -1 ? parseInt(cleanCols[stockIdx], 10) || 0 : 0;
    const reorderPoint = reorderIdx !== -1 ? parseInt(cleanCols[reorderIdx], 10) || 5 : 5;
    const category = catIdx !== -1 ? cleanCols[catIdx] : 'General';
    const brand = brandIdx !== -1 ? cleanCols[brandIdx] : undefined;
    const isConsignment = consignIdx !== -1 ? /yes|true|1/i.test(cleanCols[consignIdx]) : false;
    const vendorId = vendorIdx !== -1 ? cleanCols[vendorIdx] : undefined;

    parsedItems.push({
      sku,
      name,
      barcode,
      price,
      costPrice,
      stockLevel,
      reorderPoint,
      category,
      brand,
      isConsignment,
      vendorId,
      taxRate: 15,
    });
  }

  return parsedItems;
}

export function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const csvService = {
  exportInventoryToCsv,
  parseInventoryCsv,
  downloadCsvFile,
  downloadInventoryCsv(items: InventoryItem[]) {
    const csv = exportInventoryToCsv(items);
    downloadCsvFile(`seychelles_pos_inventory_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  },
};
