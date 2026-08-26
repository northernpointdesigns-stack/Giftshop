/**
 * Deterministic fixture dataset for the Reports test suite.
 *
 * Every number below is hand-computed so tests can assert exact figures.
 * Dates are relative to "now" so the suite never goes stale.
 */
import type {
  CashDrawerLog,
  ConsignmentPayoutRecord,
  Customer,
  EODSession,
  InventoryItem,
  Transaction,
  Vendor,
} from '../types/pos';

const atTime = (daysAgo: number, hour: number, minute: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const dayKey = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

export const SETTINGS = {
  defaultVatRate: 0.15,
  storeName: 'Test Shop POS',
  taxRegistrationNumber: 'SR-VAT-100293',
  primaryCurrency: 'SCR',
  primaryCurrencySymbol: 'SR',
  secondaryCurrency: 'USD',
  secondaryCurrencySymbol: '$',
  exchangeRate: 13.5,
  allowPaymentInSecondary: true,
  defaultCurrencyMode: 'primary' as const,
  posAppName: 'GiftShop',
  posShortName: 'GS',
  enableAutoUpdateCheck: false,
  cashierAccess: {},
  customCatalogTemplates: [],
  customerDisplayCurrencies: [],
};

export const VENDORS: Vendor[] = [
  {
    id: 'V-OCEAN',
    name: 'Ocean Seychelles Ltd',
    brandName: 'Ocean Seychelles',
    contactName: 'Test Contact',
    email: 'ocean@test.sc',
    phone: '000',
    supplierType: 'wholesale',
    payoutTerms: 'Net 30',
    consignmentCutRate: 0,
    createdAt: atTime(90, 9, 0),
  },
  {
    id: 'V-SOUV',
    name: 'Souvenir Boutique',
    brandName: 'Souvenir Boutique',
    contactName: 'Test Contact',
    email: 'souv@test.sc',
    phone: '000',
    supplierType: 'consignment',
    payoutTerms: 'Bi-weekly',
    consignmentCutRate: 0.3, // house keeps 30%
    createdAt: atTime(90, 9, 0),
  },
];

const baseItem = {
  stockLevel: 30,
  minStockThreshold: 5,
  vatRate: 0.15,
};

export const INVENTORY: InventoryItem[] = [
  {
    ...baseItem,
    id: 'ITEM-TS',
    name: 'T-Shirt Turtle Cove',
    brand: 'Ocean Seychelles',
    category: 'T-Shirts',
    productLine: 'Beach Heritage',
    size: 'Adults M',
    sku: '893100101',
    retailPrice: 25,
    costBasis: 12.5,
    vendorId: 'V-OCEAN',
    createdAt: atTime(80, 9, 0),
  },
  {
    ...baseItem,
    id: 'ITEM-MUG-L',
    name: 'Ceramic Mug Gold Rim',
    brand: 'Ocean Seychelles',
    category: 'Mugs',
    productLine: 'Luxury Line',
    size: '12oz',
    sku: '893100201',
    retailPrice: 18,
    costBasis: 8,
    vendorId: 'V-OCEAN',
    createdAt: atTime(80, 9, 0),
  },
  {
    ...baseItem,
    id: 'ITEM-MUG-N',
    name: 'Ceramic Mug Standard',
    brand: 'Ocean Seychelles',
    category: 'Mugs',
    productLine: 'Normal Line',
    size: '11oz',
    sku: '893100202',
    retailPrice: 12,
    costBasis: 5,
    stockLevel: 2, // below threshold -> critical reorder
    vendorId: 'V-OCEAN',
    createdAt: atTime(80, 9, 0),
  },
  {
    ...baseItem,
    id: 'ITEM-TOTE',
    name: 'Canvas Tote Bag',
    brand: 'Souvenir Boutique',
    category: 'Bags',
    productLine: 'Boutique Accessories',
    size: 'One Size',
    sku: '893200101',
    retailPrice: 22,
    costBasis: 15.4, // consignment: 22 * (1 - 0.30)
    vendorId: 'V-SOUV',
    createdAt: atTime(80, 9, 0),
  },
  {
    ...baseItem,
    id: 'ITEM-KEY',
    name: 'Shell Keychain',
    // NO brand -> must surface as "Unbranded"
    category: 'Accessories',
    // NO productLine -> "Unclassified Line"
    // NO size -> "One Size"
    sku: '893100104',
    retailPrice: 8.5,
    costBasis: 3.5,
    vendorId: 'V-OCEAN',
    createdAt: atTime(80, 9, 0),
  },
];

const tshirtLine = (qty: number, unitPrice: number) => ({
  itemId: 'ITEM-TS',
  name: 'T-Shirt Turtle Cove',
  brand: 'Ocean Seychelles',
  category: 'T-Shirts',
  productLine: 'Beach Heritage',
  size: 'Adults M',
  sku: '893100101',
  quantity: qty,
  unitPrice,
  totalPrice: Number((qty * unitPrice).toFixed(2)),
  vatRate: 0.15,
  vatAmount: Number((qty * unitPrice * 0.15).toFixed(2)),
  vendorId: 'V-OCEAN',
  vendorName: 'Ocean Seychelles Ltd',
  supplierType: 'wholesale' as const,
  costBasis: 12.5,
  vendorPayoutAmount: Number((qty * 12.5).toFixed(2)),
  houseProfitAmount: Number((qty * unitPrice - qty * 12.5).toFixed(2)),
});

export const TRANSACTIONS: Transaction[] = [
  {
    id: 'TX-1',
    receiptNumber: 'IP-0001',
    timestamp: atTime(0, 10, 30),
    cashierName: 'Alice',
    subtotal: 68,
    vatTotal: 10.2,
    tax: 10.2,
    discount: 5,
    discountType: 'amount',
    discountValue: 5,
    total: 73.2,
    paymentMethod: 'card',
    currencyUsed: 'primary',
    exchangeRateUsed: 13.5,
    items: [
      tshirtLine(2, 25),
      {
        itemId: 'ITEM-MUG-L',
        name: 'Ceramic Mug Gold Rim',
        brand: 'Ocean Seychelles',
        category: 'Mugs',
        productLine: 'Luxury Line',
        size: '12oz',
        sku: '893100201',
        quantity: 1,
        unitPrice: 18,
        totalPrice: 18,
        vatRate: 0.15,
        vatAmount: 2.7,
        vendorId: 'V-OCEAN',
        vendorName: 'Ocean Seychelles Ltd',
        supplierType: 'wholesale',
        costBasis: 8,
        vendorPayoutAmount: 8,
        houseProfitAmount: 10,
      },
    ],
  },
  {
    id: 'TX-2',
    receiptNumber: 'IP-0002',
    timestamp: atTime(0, 15, 45),
    cashierName: 'Bob',
    subtotal: 30.5,
    vatTotal: 4.58,
    tax: 4.58,
    discount: 0,
    total: 35.08,
    paymentMethod: 'cash',
    currencyUsed: 'primary',
    exchangeRateUsed: 13.5,
    items: [
      {
        itemId: 'ITEM-TOTE',
        name: 'Canvas Tote Bag',
        brand: 'Souvenir Boutique',
        category: 'Bags',
        productLine: 'Boutique Accessories',
        size: 'One Size',
        sku: '893200101',
        quantity: 1,
        unitPrice: 22,
        totalPrice: 22,
        vatRate: 0.15,
        vatAmount: 3.3,
        vendorId: 'V-SOUV',
        vendorName: 'Souvenir Boutique',
        supplierType: 'consignment',
        costBasis: 15.4,
        vendorPayoutAmount: 15.4,
        houseProfitAmount: 6.6,
      },
      {
        itemId: 'ITEM-KEY',
        name: 'Shell Keychain',
        category: 'Accessories',
        sku: '893100104',
        quantity: 1,
        unitPrice: 8.5,
        totalPrice: 8.5,
        vatRate: 0.15,
        vatAmount: 1.28,
        vendorId: 'V-OCEAN',
        vendorName: 'Ocean Seychelles Ltd',
        supplierType: 'wholesale',
        costBasis: 3.5,
        vendorPayoutAmount: 3.5,
        houseProfitAmount: 5,
      },
    ],
  },
  {
    id: 'TX-3',
    receiptNumber: 'IP-0003',
    timestamp: atTime(0, 9, 0),
    cashierName: 'Alice',
    subtotal: -25,
    vatTotal: -3.75,
    tax: -3.75,
    discount: 0,
    total: -28.75,
    paymentMethod: 'cash',
    currencyUsed: 'primary',
    exchangeRateUsed: 13.5,
    isRefund: true,
    originalReceiptNumber: 'IP-0001',
    items: [{ ...tshirtLine(-1, 25) }],
  },
  {
    id: 'TX-4',
    receiptNumber: 'IP-0005',
    timestamp: atTime(40, 12, 0),
    cashierName: 'Alice',
    subtotal: 12,
    vatTotal: 1.8,
    tax: 1.8,
    discount: 0,
    total: 13.8,
    paymentMethod: 'cash',
    currencyUsed: 'primary',
    exchangeRateUsed: 13.5,
    items: [
      {
        itemId: 'ITEM-MUG-N',
        name: 'Ceramic Mug Standard',
        brand: 'Ocean Seychelles',
        category: 'Mugs',
        productLine: 'Normal Line',
        size: '11oz',
        sku: '893100202',
        quantity: 1,
        unitPrice: 12,
        totalPrice: 12,
        vatRate: 0.15,
        vatAmount: 1.8,
        vendorId: 'V-OCEAN',
        vendorName: 'Ocean Seychelles Ltd',
        supplierType: 'wholesale',
        costBasis: 5,
        vendorPayoutAmount: 5,
        houseProfitAmount: 7,
      },
    ],
  },
  {
    // Intentionally corrupt totals -> the receipt audit engine must flag it
    id: 'TX-5',
    receiptNumber: 'IP-0004',
    timestamp: atTime(40, 13, 0),
    cashierName: 'Bob',
    subtotal: 25,
    vatTotal: 3.75,
    tax: 3.75,
    discount: 0,
    total: 999, // <-- discrepancy
    paymentMethod: 'card',
    currencyUsed: 'primary',
    items: [tshirtLine(1, 25)],
  },
];

export const EOD_SESSIONS: EODSession[] = [
  {
    id: 'EOD-1',
    date: dayKey(1),
    openedAt: atTime(1, 8, 30),
    closedAt: atTime(1, 18, 0),
    startingFloat: 100,
    cashSales: 200,
    cardSales: 50,
    paidInTotal: 20,
    paidOutTotal: 10,
    cashDropTotal: 30,
    expectedCash: 280,
    actualCash: 278,
    cashDifference: -2,
    status: 'closed',
    closedBy: 'Alice',
  },
  {
    id: 'EOD-2',
    date: dayKey(0),
    openedAt: atTime(0, 8, 30),
    startingFloat: 100,
    cashSales: 0,
    cardSales: 0,
    expectedCash: 100,
    status: 'open',
  },
];

export const DRAWER_LOGS: CashDrawerLog[] = [
  {
    id: 'LOG-1',
    sessionId: 'EOD-2',
    timestamp: atTime(0, 8, 30),
    eventType: 'open',
    amount: 100,
    staffName: 'Alice',
    reason: 'Shift opened',
    currentFloatAfter: 100,
  },
  {
    id: 'LOG-2',
    sessionId: 'EOD-2',
    timestamp: atTime(0, 11, 0),
    eventType: 'paid_in',
    amount: 20,
    staffName: 'Bob',
    reason: 'Change fund top-up',
    currentFloatAfter: 120,
  },
  {
    id: 'LOG-3',
    sessionId: 'EOD-2',
    timestamp: atTime(0, 14, 0),
    eventType: 'cash_drop',
    amount: 30,
    staffName: 'Alice',
    reason: 'Safe drop',
    currentFloatAfter: 90,
  },
  {
    id: 'LOG-4',
    sessionId: 'EOD-1',
    timestamp: atTime(1, 8, 31),
    eventType: 'manual_open',
    staffName: 'Bob',
    reason: 'Drawer opened without session',
  },
];

export const PAYOUT_RECORDS: ConsignmentPayoutRecord[] = [
  {
    id: 'PO-1',
    vendorId: 'V-SOUV',
    vendorName: 'Souvenir Boutique',
    periodStart: atTime(40, 0, 0),
    periodEnd: atTime(7, 0, 0),
    totalUnitsSold: 1,
    totalGrossSales: 22,
    houseCommission: 6.6,
    payoutAmount: 15.4,
    status: 'paid',
    paidAt: atTime(6, 10, 0),
    notes: 'Period settlement',
  },
];

export const CUSTOMERS: Customer[] = [];

/* ------------------------------------------------------------------ */
/* Hand-computed expectations for the TODAY cycle (TX-1, TX-2, TX-3)   */
/* ------------------------------------------------------------------ */
export const EXPECTED_TODAY = {
  txCount: 3,
  grossSales: 73.5, // 68 + 30.5 - 25 (refund)
  vatCollected: 11.03, // 10.2 + 4.58 - 3.75
  discounts: 5,
  effectiveVatPct: '16.1', // 11.03 / (73.5 - 5) * 100
  houseNetProfit: 34.1, // 25+10+6.6+5-12.5
  grandTotalWithVat: 84.53,
  wholesaleGross: 51.5,
  wholesaleCogs: 24,
  wholesaleNet: 27.5,
  consignmentGross: 22,
  consignmentPayout: 15.4,
  consignmentCommission: 6.6,
  oceanBrandGross: 43.0, // 50 + 18 − 25 refund (keychain is Unbranded: no brand field)
  oceanBrandUnits: 2,
  souvenirBrandGross: 22,
  peakWindow: '10:00 – 11:00',
  peakRevenue: 68.0,
  fxSecondaryGross: '5.12', // blended snapshot rate: 73.5 / (84.53 blended @13.5) = 14.35
  allTimeTxCount: 5,
  weekTxCount: 3,
};

export const seedStorage = () => {
  window.localStorage.setItem('island_pos_settings_v2', JSON.stringify(SETTINGS));
  window.localStorage.setItem('island_pos_vendors_v2', JSON.stringify(VENDORS));
  window.localStorage.setItem('island_pos_inventory_v2', JSON.stringify(INVENTORY));
  window.localStorage.setItem('island_pos_transactions_v2', JSON.stringify(TRANSACTIONS));
  window.localStorage.setItem('island_pos_eod_v2', JSON.stringify(EOD_SESSIONS));
  window.localStorage.setItem('island_pos_drawer_logs_v2', JSON.stringify(DRAWER_LOGS));
  window.localStorage.setItem('island_pos_payouts_v2', JSON.stringify(PAYOUT_RECORDS));
  window.localStorage.setItem('island_pos_advances_v2', JSON.stringify([]));
  window.localStorage.setItem('island_pos_customers_v2', JSON.stringify(CUSTOMERS));
  window.localStorage.setItem('island_pos_staff_v2', JSON.stringify([]));
  window.localStorage.setItem('island_pos_categories_v2', JSON.stringify([]));
  window.localStorage.setItem('island_pos_invoices_v2', JSON.stringify([]));
};


