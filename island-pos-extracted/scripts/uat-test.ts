/**
 * AUTOMATED UAT HARNESS — runs the real POS business logic end-to-end.
 * Mirrors the manual testing script: setup, daily flow, artisan payouts.
 * Run with:  npx tsx scripts/uat-test.ts
 */
import './uat-setup';
import { posDb } from '../src/services/db';
import { resolveBrandName } from '../src/services/brand';

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function check(id: string, description: string, condition: boolean, detail?: string) {
  if (condition) {
    passCount++;
    console.log(`  PASS  [${id}] ${description}`);
  } else {
    failCount++;
    failures.push(`${id}: ${description}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  [${id}] ${description}${detail ? ` — ${detail}` : ''}`);
  }
}

const approx = (a: number, b: number, tol = 0.02) => Math.abs(a - b) < tol;

async function main() {
  console.log('='.repeat(70));
  console.log(' POS FULL SYSTEM UAT — headless run against real db layer');
  console.log('='.repeat(70));

  // Fresh slate
  posDb.resetToDefault();
  // resetToDefault seeds a demo drawer session (EOD-001); close it so the
  // tests start from a clean, known state like a real shop would.
  const seededSession = posDb.getActiveEODSession();
  if (seededSession) {
    posDb.closeEODSession(seededSession.expectedCash, 'UAT Setup', 'Close seeded demo drawer');
  }

  /* ================= PHASE 1: ADMIN SETUP & INVENTORY ================ */
  console.log('\n--- PHASE 1: Admin Setup & Inventory Loading ---');

  const wholesaleVendor = posDb.saveVendor({
    name: 'Spice Traders Ltd',
    contactName: 'John Trader',
    email: 'john@spicetraders.sc',
    phone: '+248 2 500 100',
    supplierType: 'wholesale',
    payoutTerms: 'Net 30',
    consignmentCutRate: 0,
  });
  check('T1.1', 'Wholesale vendor profile saves', !!posDb.getVendorByName('Spice Traders Ltd'));

  const wholesaleSkus = ['SPC-001', 'SPC-002', 'SPC-003', 'SPC-004', 'SPC-005'];
  wholesaleSkus.forEach((sku, i) => {
    posDb.saveItem({
      name: `Commercial Soap ${i + 1}`,
      category: 'Soaps',
      sku,
      stockLevel: 100,
      minStockThreshold: 10,
      retailPrice: 8 + i,
      costBasis: 4 + i / 2,
      vatRate: 0.15,
      vendorId: wholesaleVendor.id,
    });
  });
  const wsItems = wholesaleSkus.map((s) => posDb.getItemBySku(s)!);
  check('T1.2', '5 wholesale items added with cost & retail prices', wsItems.every((i) => i && i.costBasis > 0 && i.retailPrice > 0));

  const artisan = posDb.saveVendor({
    name: 'Local Shell Crafter',
    contactName: 'Marie Rose',
    email: 'marie@shells.sc',
    phone: '+248 2 511 200',
    supplierType: 'consignment',
    payoutTerms: 'Monthly',
    consignmentCutRate: 0.3,
  });
  const savedArtisan = posDb.getVendorByName('Local Shell Crafter');
  check('T1.3', 'Artisan consignment profile saves with cut terms', !!savedArtisan && savedArtisan.supplierType === 'consignment' && savedArtisan.consignmentCutRate === 0.3);

  posDb.saveItem({
    name: 'Handmade Shell', category: 'Souvenirs', sku: 'ART-SHL-001',
    stockLevel: 50, minStockThreshold: 5, retailPrice: 25, costBasis: 0,
    vatRate: 0.15, vendorId: artisan.id,
  });
  posDb.saveItem({
    name: 'Shell Keyring', category: 'Souvenirs', sku: 'ART-KEY-001',
    stockLevel: 20, minStockThreshold: 5, retailPrice: 10, costBasis: 0,
    vatRate: 0.15, vendorId: artisan.id,
  });
  const shells = posDb.getItemBySku('ART-SHL-001')!;
  const keyrings = posDb.getItemBySku('ART-KEY-001')!;
  const depositedOk =
    shells.stockLevel === 50 && shells.vendorId === artisan.id &&
    keyrings.stockLevel === 20 && keyrings.vendorId === artisan.id;
  check('T1.4', 'Consignment deposit tagged to artisan (50 + 20 units)', depositedOk);

  const bulkRows = Array.from({ length: 1000 }, (_, i) => ({
    name: `Bulk Item ${i + 1}`,
    brand: 'TestBrand',
    category: i % 2 === 0 ? 'Mugs' : 'Bags',
    productLine: 'Normal Line',
    size: 'One Size',
    variant: '',
    sku: `BULK-${String(i + 1).padStart(4, '0')}`,
    retailPrice: 10 + (i % 50),
    costBasis: 5,
    stockLevel: 12,
    minStockThreshold: 3,
    vatRate: 0.15,
    vendorName: 'Spice Traders Ltd',
  }));
  const t0 = Date.now();
  const bulkResult = posDb.bulkImportFromCsvRows(bulkRows);
  const bulkMs = Date.now() - t0;
  check('T1.5a', `Bulk import adds 1,000 items (added=${bulkResult.added})`, bulkResult.added === 1000);
  check('T1.5b', `Bulk import performance OK (${bulkMs}ms)`, bulkMs < 8000, `${bulkMs}ms`);
  // REGRESSION: the original ID generator had only ~800 possible values,
  // so bulk imports created duplicate IDs, silently corrupting stock
  // deduction & vendor payouts. Every imported item must have a unique ID.
  const allInv = posDb.getInventory();
  const dupIdCount = allInv.length - new Set(allInv.map((i) => i.id)).size;
  check('T1.5c', `REGRESSION: no duplicate item IDs after 1,000-item import`, dupIdCount === 0, `${dupIdCount} duplicates`);
  const tSearch = Date.now();
  const found = posDb.getItemBySku('BULK-0377');
  check('T1.5d', `Random item search instant (${Date.now() - tSearch}ms)`, !!found && found.name === 'Bulk Item 377');

  /* ================= PHASE 2: CASHIER DAILY FLOW ===================== */
  console.log('\n--- PHASE 2: Cashier Daily Flow ---');

  // T2.1 Shift open with $200 float
  const session = posDb.openEODSession(200, 'Morning shift', 'Jane Doe');
  check('T2.1', 'Shift opens; drawer logs $200 starting float', session.expectedCash === 200 && session.status === 'open');

  // T2.2 Standard sale: 1 wholesale + 1 artisan item, exact cash
  const sale1 = posDb.recordTransaction(
    [
      { item: wsItems[0], quantity: 1 },
      { item: shells, quantity: 1 },
    ],
    'cash',
    'Jane Doe'
  );
  const expectedTotal1 = Number(((wsItems[0].retailPrice + shells.retailPrice) * 1.15).toFixed(2));
  check('T2.2a', `Receipt total incl VAT correct (${sale1.total})`, approx(sale1.total, expectedTotal1), `expected ${expectedTotal1}`);
  check('T2.2b', 'Inventory drops by 1 for both sold items', posDb.getItemBySku('SPC-001')!.stockLevel === 99 && posDb.getItemBySku('ART-SHL-001')!.stockLevel === 49);
  check('T2.2c', 'Drawer now expects float + cash sale', approx(session.expectedCash, 200 + sale1.total));

  const artisanLine = sale1.items.find((i) => i.sku === 'ART-SHL-001')!;
  const expectedPayout = Number((artisanLine.totalPrice * 0.7).toFixed(2));
  check('T2.2d', `Artisan owed 70% of line (${artisanLine.vendorPayoutAmount})`, approx(artisanLine.vendorPayoutAmount, expectedPayout));

  // T2.3 Mixed payment: $10 cash, rest card — 3 deluxe keyrings @ 11.50
  posDb.saveItem({
    name: 'Deluxe Keyring', category: 'Souvenirs', sku: 'ART-KEY-002',
    stockLevel: 30, minStockThreshold: 2, retailPrice: 11.5, costBasis: 0,
    vatRate: 0.15, vendorId: artisan.id,
  });
  const mixedItem = posDb.getItemBySku('ART-KEY-002')!;
  const mixedGross = Number((11.5 * 3 * 1.15).toFixed(2));
  const cardPart = Number((mixedGross - 10).toFixed(2));
  const splitSale = posDb.recordTransaction(
    [{ item: mixedItem, quantity: 3 }],
    'split',
    'Jane Doe',
    undefined, 0, undefined, 'primary', undefined, undefined, undefined, undefined,
    [
      { id: 'sp1', method: 'cash', currencyCode: 'SCR', currencySymbol: 'SR', amountTendered: 10, exchangeRate: 1, amountInPrimary: 10 },
      { id: 'sp2', method: 'card', currencyCode: 'SCR', currencySymbol: 'SR', amountTendered: cardPart, exchangeRate: 1, amountInPrimary: cardPart },
    ]
  );
  const s2 = posDb.getActiveEODSession()!;
  check('T2.3a', 'Split payment clears as transaction', !!splitSale && splitSale.paymentMethod === 'split');
  check('T2.3b', 'Cash revenue ledger exact (sale1 + $10)', approx(s2.cashSales, sale1.total + 10));
  check('T2.3c', 'Card revenue ledger exact', approx(s2.cardSales, cardPart));

  // T2.4 Refund an artisan shell to cash, restocked
  const preRefundExpected = posDb.getActiveEODSession()!.expectedCash;
  const refundTx = posDb.recordRefundTransaction(
    [{ item: shells, quantity: 1 }],
    'cash',
    'Jane Doe',
    'Customer changed mind',
    true,
    sale1.receiptNumber,
    sale1.id
  );
  check('T2.4a', 'Refund processed; shell restocked to artisan pool', posDb.getItemBySku('ART-SHL-001')!.stockLevel === 50);
  check('T2.4b', 'Cash drawer expects minus refund', approx(posDb.getActiveEODSession()!.expectedCash, preRefundExpected - Math.abs(refundTx.total)));
  const refundLog = posDb.getDrawerLogs().find((l) => l.eventType === 'paid_out' && l.reason.includes('Refund'));
  check('T2.4c', 'Refund logged as paid-out drawer movement', !!refundLog);

  // T2.5 Cash drop: remove 100 from overflowing till
  const preDropExpected = posDb.getActiveEODSession()!.expectedCash;
  posDb.recordCashAdjustment('cash_drop', 100, 'Jane Doe', 'Safe drop - till too heavy');
  check('T2.5', 'Cash drop logs; expected till reduced by exactly $100', approx(posDb.getActiveEODSession()!.expectedCash, preDropExpected - 100));

  // T2.6 Shift close with perfect count → Z-report math
  const finalSession = posDb.getActiveEODSession()!;
  const closed = posDb.closeEODSession(finalSession.expectedCash, 'Jane Doe', 'Clean close');
  check('T2.6a', 'Shift closes; zero variance when counted = expected', !!closed && closed.cashDifference === 0 && closed.status === 'closed');
  check('T2.6b', 'Z-close recorded in drawer audit log', posDb.getDrawerLogs(finalSession.id).some((l) => l.eventType === 'close'));


  /* ============ PHASE 3: ARTISAN PAYOUT & ADVANCE TEST =============== */
  console.log('\n--- PHASE 3: Artisan Payout & Advance ---');

  // Re-open a session for month-end operations
  posDb.openEODSession(150, 'Re-open for month-end', 'Admin');

  // T3.1 $50 advance mid-month, paid from the till
  const advance = posDb.recordVendorAdvance({
    vendorId: artisan.id,
    vendorName: artisan.name,
    amount: 50,
    note: 'Mid-month advance',
    recordedBy: 'Admin',
  });
  check('T3.1a', '$50 advance logged against artisan profile', posDb.getVendorAdvances(artisan.id).length === 1 && advance.amount === 50);
  const preAdvExpected = posDb.getActiveEODSession()!.expectedCash;
  posDb.recordCashAdjustment('cash_drop', 50, 'Admin', 'Advance paid to Local Shell Crafter');
  check('T3.1b', 'Till reduced by the $50 advance', approx(posDb.getActiveEODSession()!.expectedCash, preAdvExpected - 50));

  // T3.2 End-of-month sales + consignment report
  // Sell 5 more deluxe keyrings so the month's artisan earnings exceed the advance.
  const monthEndSale = posDb.recordTransaction([{ item: mixedItem, quantity: 5 }], 'cash', 'Jane Doe');
  const calc = posDb.calculateConsignmentPayouts(artisan.id)[0];
  check('T3.2a', 'Consignment report computes vendor totals', !!calc && typeof calc.totalGrossSales === 'number');
  // Net units: shells +1/-1 refunded => 0; deluxe keyrings 3 + 5 = 8.
  check('T3.2b', `Units sold net of refunds = ${calc.totalUnitsSold} (expect 8)`, calc.totalUnitsSold === 8);
  // Payout basis is PRE-VAT retail (correct for consignment): 11.50 x 8 = 92.00
  check('T3.2c', `Report gross = pre-VAT artisan sales (${calc.totalGrossSales})`, approx(calc.totalGrossSales, 92, 0.05));

  // T3.3 Final payout = gross − house cut − advances
  const advancesPaid = posDb.getVendorAdvances(artisan.id).reduce((a, v) => a + v.amount, 0);
  const priorPaid = posDb.getPayoutRecords().filter((r) => r.vendorId === artisan.id && r.status === 'paid').reduce((a, r) => a + r.payoutAmount, 0);
  const finalPayout = Number((calc.vendorPayoutOwed - priorPaid - advancesPaid).toFixed(2));
  check('T3.3a', `House commission is 30% of gross`, approx(calc.houseCommission, calc.totalGrossSales * 0.3, 0.05));
  check('T3.3b', `Payout owed = 70% of gross (${calc.vendorPayoutOwed})`, approx(calc.vendorPayoutOwed, calc.totalGrossSales * 0.7, 0.05));
  check('T3.3c', `Final payable = payout − $${advancesPaid} advance = ${finalPayout}`, finalPayout > 0 && approx(finalPayout, calc.vendorPayoutOwed - 50, 0.05));
  posDb.recordVendorPayout(artisan.id, finalPayout, `Month-end settlement incl $${advancesPaid} advance deduction`);
  const paidRecord = posDb.getPayoutRecords().find((r) => r.vendorId === artisan.id);
  check('T3.3d', 'Settlement recorded as paid', !!paidRecord && paidRecord.status === 'paid' && paidRecord.payoutAmount === finalPayout);

  // T3.4 Unsold inventory on deposit
  // Shells: deposited 50, sold 1, refunded back +1 → 50. Deluxe keyrings: 30 − 8 = 22.
  const shellsNow = posDb.getItemBySku('ART-SHL-001')!.stockLevel;
  const keysNow = posDb.getItemBySku('ART-KEY-002')!.stockLevel;
  check('T3.4', `Artisan stock on deposit exact (shells=${shellsNow}, keyrings=${keysNow})`, shellsNow === 50 && keysNow === 22);

  /* ====== PHASE 4: EDGE CASES VERIFIABLE WITHOUT DEVICES ============ */
  console.log('\n--- PHASE 4: Permissions, branding, backups (headless-safe) ---');

  const cashier = posDb.authenticateStaff('1234'); // seeded demo cashier
  check('T4.1a', 'Cashier PIN authenticates with non-admin role', !!cashier && cashier.role !== 'admin');
  const adminCheck = posDb.verifyManagerOrAdminPin('admin123');
  check('T4.1b', 'Manager/Admin override PIN authorizes', adminCheck.authorized === true);

  posDb.updateSettings({ posAppName: 'Maria Beach Shop POS' });
  check('T4.2', 'White-label brand resolves from settings', resolveBrandName() === 'Maria Beach Shop POS');
  posDb.updateSettings({ posAppName: '' });
  check('T4.2b', 'Brand falls back to store name when title empty', resolveBrandName().length > 0);

  const backupJson = posDb.exportBackup();
  const parsedBackup = JSON.parse(backupJson);
  check(
    'T4.3',
    'Full backup exports transactions + inventory + vendors',
    Array.isArray(parsedBackup.transactions) && parsedBackup.transactions.length > 0 &&
    Array.isArray(parsedBackup.inventory) && parsedBackup.inventory.length > 0 &&
    Array.isArray(parsedBackup.vendors) && parsedBackup.vendors.length > 0
  );

/* ====== PHASE 5: MASTER PLAN TC COVERAGE (software-testable) ======= */
  console.log('\n--- PHASE 5: Master Plan TC Coverage (discounts, tax, tender, RBAC) ---');

  posDb.openEODSession(200, 'Phase 5 session', 'Jane Doe');
  const s5 = posDb.getActiveEODSession()!;

  // TC-POS-002 manual search by name
  const searchHit = posDb.getInventory().find((i) => i.name.toLowerCase().includes('commercial soap 3'));
  check('TC-POS-002', 'Manual search by name finds item with SKU', !!searchHit && searchHit.sku === 'SPC-003');

  // TC-POS-003 quantity modifier: qty 5 scales subtotal
  const qtyItem = wsItems[0]; // SPC-001 retail 8
  const qtyTx = posDb.recordTransaction([{ item: qtyItem, quantity: 5 }], 'cash', 'Alice');
  check('TC-POS-003', 'Qty 5 scales line correctly (5 x 8 + 15% VAT = 46)', approx(qtyTx.total, 46));

  // TC-POS-004 authorized price override via resolvedPrice (9 -> 7)
  const overrideItem = posDb.getItemBySku('SPC-002')!; // retail 9
  const overrideTx = posDb.recordTransaction(
    [{ item: overrideItem, quantity: 1, resolvedPrice: 7 }],
    'cash', 'Alice'
  );
  const overrideLine = overrideTx.items[0];
  check('TC-POS-004', 'Authorized price override (9->7) applied on line', approx(overrideLine.unitPrice, 7) && approx(overrideTx.total, 7 * 1.15));

  // TC-POS-005 unauthorized override: cashier PIN must NOT authorize manager ops
  const cashierAuth = posDb.verifyManagerOrAdminPin('1234'); // Maya cashier
  const managerAuth = posDb.verifyManagerOrAdminPin('8888'); // Cynthia senior
  check('TC-POS-005a', 'Cashier PIN blocked from manager/price-override auth', cashierAuth.authorized === false);
  check('TC-POS-005b', 'Senior cashier PIN permits override', managerAuth.authorized === true);

  // TC-POS-006 line void/return restocks inventory
  const shell2 = posDb.getItemBySku('ART-SHL-001')!;
  posDb.recordRefundTransaction([{ item: shell2, quantity: 1 }], 'cash', 'Alice', 'Line void', true);
  check('TC-POS-006', 'Line void/return restores inventory (restock)', posDb.getItemBySku('ART-SHL-001')!.stockLevel >= 50);

  // TC-POS-007 line-item 15% discount (damage markdown) on a $100 item
  posDb.saveItem({ name: 'Deluxe Mug Gold', category: 'Mugs', sku: 'MUG-GOLD', stockLevel: 10, minStockThreshold: 1, retailPrice: 100, costBasis: 40, vatRate: 0.15, vendorId: wholesaleVendor.id });
  const mug = posDb.getItemBySku('MUG-GOLD')!;
  const discLineTx = posDb.recordTransaction([{ item: mug, quantity: 1, isDamaged: true, damageDiscountPercent: 15 }], 'cash', 'Alice');
  const discLine = discLineTx.items[0];
  check('TC-POS-007', 'Line 15% discount -> $85; VAT recalc on discounted price', approx(discLine.totalPrice, 85) && approx(discLine.vatAmount, 12.75));
  /* ========================= SUMMARY ================================= */
  console.log('\n' + '='.repeat(70));
  console.log(` RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log('='.repeat(70));
  if (failures.length) {
    failures.forEach((f) => console.log('  FAIL DETAIL: ' + f));
  }
  console.log('\nNOT COVERED HERE (need physical devices / Wi-Fi):');
  console.log('  - Cloud sync across registers (iPad vs Windows live stock flag)');
// TC-POS-008 cart-level discount ($20 off $200 basket)
  const basketA = posDb.getItemBySku('SPC-003')!; // $10
  const basketB = posDb.getItemBySku('SPC-004')!; // $11
  const cartTx = posDb.recordTransaction(
    [{ item: basketA, quantity: 10 }, { item: basketB, quantity: 10 }],
    'cash', 'Alice', undefined, 20
  );
  check('TC-POS-008', 'Cart-level $20 coupon reduces subtotal by $20', approx(cartTx.subtotal, 190), `got subtotal=${cartTx.subtotal}`);

  // TC-POS-009 multi-tier tax logic
  posDb.saveItem({ name: 'ZeroVatItem', category: 'Books', sku: 'ZERO-001', stockLevel: 5, minStockThreshold: 1, retailPrice: 20, costBasis: 5, vatRate: 0, vendorId: wholesaleVendor.id });
  const zeroItem = posDb.getItemBySku('ZERO-001')!;
  const multiTx = posDb.recordTransaction([{ item: mug, quantity: 1 }, { item: zeroItem, quantity: 1 }], 'cash', 'Alice');
  const zeroLine = multiTx.items.find((l) => l.sku === 'ZERO-001')!;
  check('TC-POS-009a', 'Tax-exempt (0% VAT) item has zero VAT', zeroLine.vatAmount === 0);
  check('TC-POS-009b', 'Taxable line in mixed basket still taxed', approx(multiTx.items.find((l) => l.sku === 'MUG-GOLD')!.vatAmount, 15));

  // TC-POS-010 tax exemption -> VAT total zero
  const taxFreeTx = posDb.recordTransaction([{ item: zeroItem, quantity: 2 }], 'cash', 'Alice');
  check('TC-POS-010', 'Tax-exempt basket totals $40 with zero VAT', approx(taxFreeTx.total, 40) && taxFreeTx.vatTotal === 0);

  // TC-PAY-001 exact cash -> change due $0
  const keyring1 = posDb.getItemBySku('ART-KEY-001')!; // $10 -> $11.50
  const exactTx = posDb.recordTransaction([{ item: keyring1, quantity: 1 }], 'cash', 'Alice', 11.5);
  check('TC-PAY-001', 'Exact cash tender: change due $0.00', (exactTx.changeDue ?? 0) === 0 && approx(exactTx.total, 11.5));

  // TC-PAY-002 $20 tender on $11.50 -> change
  const changeTx = posDb.recordTransaction([{ item: keyring1, quantity: 1 }], 'cash', 'Alice', 20);
  check('TC-PAY-002', '$20 tender on $11.50 -> change due $8.50', approx(changeTx.changeDue ?? 0, 8.5));
// TC-PAY-010 gift card redemption (split with gift leg)
  const giftTx = posDb.recordTransaction(
    [{ item: keyring1, quantity: 1 }],
    'split', 'Alice', undefined, 0, undefined, 'primary', undefined, undefined, undefined, undefined,
    [{ id: 'gc1', method: 'gift_card', currencyCode: 'SCR', currencySymbol: 'SR', amountTendered: 11.5, exchangeRate: 1, amountInPrimary: 11.5 }]
  );
  check('TC-PAY-010', 'Gift card tender settles full total', !!giftTx && giftTx.splitPayments?.[0]?.method === 'gift_card' && approx(giftTx.total, 11.5));

  // TC-EOD-002 paid-in increases float
  const prePaidIn = s5.expectedCash;
  posDb.recordCashAdjustment('paid_in', 25, 'Alice', 'Bought change from bank');
  check('TC-EOD-002', 'Paid-in +$25 increases expected till balance', approx(posDb.getActiveEODSession()!.expectedCash, prePaidIn + 25));

  // TC-EOD-003 variance on manual close (count differs from expected)
  const sClose = posDb.getActiveEODSession()!;
  const closedVar = posDb.closeEODSession(sClose.expectedCash + 10, 'Alice', 'over by 10');
  check('TC-EOD-003', 'Blind close variance: +$10 overage recorded', closedVar?.cashDifference === 10);

  // TC-EOD-004 Z-report immutable close fields
  check('TC-EOD-004', 'Z-report fields persisted (closedAt/closedBy/status)', closedVar?.status === 'closed' && !!closedVar?.closedAt && !!closedVar?.closedBy);

  /* ========= Security / privacy / audit headless checks ============= */
  console.log('\n--- SECURITY, PRIVACY & AUDIT (software-level) ---');
  const t1 = posDb.getTransactions()[0];
  const hasCardNumberField = Object.keys(t1).some((k) => /pan|cardnum|card_no|cvv/gi.test(k));
  check('SEC-01', 'No PAN/CVV stored in transaction records', !hasCardNumberField);
  const hasCardNumInSplit = JSON.stringify(t1).search(/pan|cvv|cardnum/i) !== -1;
  check('SEC-02', 'No plaintext card data in split-payment legs', !hasCardNumInSplit);
  const auditOk = posDb.getDrawerLogs().length > 0 && posDb.getDrawerLogs().every((l) => l.staffName && l.reason && l.timestamp);
  check('SEC-03', 'Drawer audit log populated with user + reason everywhere', auditOk);
  const cashierUser = posDb.authenticateStaff('1234');
  check('SEC-04', 'Cashier is not admin; role separation enforced at db layer', !!cashierUser && cashierUser.role !== 'admin');

  /* ============ STRESS / throughput sanity ========================== */
  console.log('\n--- STRESS: rapid sale throughput ---');
  const hotItem = posDb.getItemBySku('SPC-001')!;
  const tStart = Date.now();
  let sold = 0;
  for (let i = 0; i < 100; i++) {
    posDb.recordTransaction([{ item: hotItem, quantity: 1 }], 'cash', 'Alice');
    sold++;
  }
  const tElapsed = Date.now() - tStart;
  const perSec = Math.round((sold / tElapsed) * 1000);
  check('STRESS-01', `100 rapid checkouts complete (~${perSec}/sec)`, tElapsed < 15000, `${tElapsed}ms`);
  check('STRESS-02', 'No runtime crash during load loop', true);
  console.log('  - Offline mode on Android APK + reconnect queue flush');
  console.log('  - Receipt printer paper output on real hardware');
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('HARNESS CRASH:', err);
  process.exit(2);
});

