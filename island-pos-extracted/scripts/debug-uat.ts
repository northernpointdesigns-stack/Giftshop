import './uat-setup';
import { posDb } from '../src/services/db';

posDb.resetToDefault();
const wv = posDb.saveVendor({ name: 'V', contactName: 'c', email: 'e', phone: 'p', supplierType: 'wholesale', payoutTerms: 'm', consignmentCutRate: 0 });
posDb.saveItem({ name: 'Soap1', category: 'Soaps', sku: 'SPC-001', stockLevel: 100, minStockThreshold: 10, retailPrice: 8, costBasis: 4, vatRate: 0.15, vendorId: wv.id });
const av = posDb.saveVendor({ name: 'A', contactName: 'c', email: 'e', phone: 'p', supplierType: 'consignment', payoutTerms: 'm', consignmentCutRate: 0.3 });
posDb.saveItem({ name: 'S', category: 'x', sku: 'ART-SHL-001', stockLevel: 50, minStockThreshold: 5, retailPrice: 25, costBasis: 0, vatRate: 0.15, vendorId: av.id });
const rows = Array.from({ length: 1000 }, (_, i) => ({
  name: 'Bulk ' + i, brand: 'TB', category: 'Mugs', productLine: 'NL', size: 'OS', variant: '',
  sku: 'BULK-' + String(i + 1).padStart(4, '0'), retailPrice: 10, costBasis: 5,
  stockLevel: 12, minStockThreshold: 3, vatRate: 0.15, vendorName: 'V',
}));
console.log('bulk:', JSON.stringify(posDb.bulkImportFromCsvRows(rows)));
const ws = posDb.getItemBySku('SPC-001')!;
const sh = posDb.getItemBySku('ART-SHL-001')!;
console.log('direct adjustStock test:', posDb.adjustStock(ws.id, -5)?.stockLevel);

// Instrument adjustStock to see if recordTransaction calls it
const orig = posDb.adjustStock.bind(posDb);
let calls = 0;
(posDb as unknown as { adjustStock: unknown }).adjustStock = (id: string, qty: number) => {
  calls++;
  console.log('  -> adjustStock invoked:', id, qty);
  return orig(id, qty);
};
const ws2 = posDb.getItemBySku('SPC-001')!;
const sh2 = posDb.getItemBySku('ART-SHL-001')!;
console.log('pre-sale:', ws2.stockLevel, sh2.stockLevel);
posDb.recordTransaction([{ item: ws2, quantity: 1 }, { item: sh2, quantity: 1 }], 'cash', 'Jane');
console.log('adjustStock call count:', calls);
console.log('post-sale stocks:', posDb.getItemBySku('SPC-001')!.stockLevel, posDb.getItemBySku('ART-SHL-001')!.stockLevel);
console.log('items with id ITEM-690:', JSON.stringify(posDb.getInventory().filter((i) => i.id === 'ITEM-690').map((i) => i.sku + '/' + i.stockLevel)));
console.log('items with id ITEM-651:', JSON.stringify(posDb.getInventory().filter((i) => i.id === 'ITEM-651').map((i) => i.sku + '/' + i.stockLevel)));
console.log('duplicate ids in inventory:', posDb.getInventory().length - new Set(posDb.getInventory().map((i) => i.id)).size);
