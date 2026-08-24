import {
  Vendor,
  InventoryItem,
  Transaction,
  ConsignmentPayoutRecord,
  EODSession,
  TransactionItem,
  StoreSettings,
  StaffUser,
  CategoryTab,
  CashDrawerLog,
  CashDrawerEventType,
  Customer,
} from '../types/pos';
import { ParsedCsvRow } from './csvParser';

const STORAGE_KEYS = {
  VENDORS: 'island_pos_vendors_v2',
  INVENTORY: 'island_pos_inventory_v2',
  TRANSACTIONS: 'island_pos_transactions_v2',
  PAYOUTS: 'island_pos_payouts_v2',
  EOD_SESSIONS: 'island_pos_eod_v2',
  SETTINGS: 'island_pos_settings_v2',
  STAFF: 'island_pos_staff_v2',
  CATEGORIES: 'island_pos_categories_v2',
  DRAWER_LOGS: 'island_pos_drawer_logs_v2',
  CUSTOMERS: 'island_pos_customers_v2',
};

const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: 'CUST-1001',
    name: 'Annette Dupuis',
    phone: '+248 2 514 820',
    email: 'annette.dupuis@seychelles.sc',
    membershipTier: 'VIP',
    loyaltyPoints: 480,
    notes: 'Regular customer for artisan soaps & Ocean T-shirts. Prefers digital receipts.',
    registeredAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 'CUST-1002',
    name: 'Jean-Luc Barbier',
    phone: '+248 2 710 334',
    email: 'jl.barbier@granite-island.sc',
    membershipTier: 'Gold',
    loyaltyPoints: 310,
    notes: 'Collects Ocean Seychelles mugs & handmade coconut crafts.',
    registeredAt: new Date(Date.now() - 45 * 86400000).toISOString(),
  },
  {
    id: 'CUST-1003',
    name: 'Sarah Jenkins',
    phone: '+44 7700 900123',
    email: 'sarah.j.travels@outlook.com',
    membershipTier: 'Silver',
    loyaltyPoints: 165,
    notes: 'Tourist from UK. Purchased souvenir t-shirts & pareos for family.',
    registeredAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'CUST-1004',
    name: 'Marcelle Roy',
    phone: '+248 2 888 102',
    email: 'marcelle.roy@seychelles.net',
    membershipTier: 'Bronze',
    loyaltyPoints: 85,
    notes: 'Boutique neighbor on Promenade.',
    registeredAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'CUST-1005',
    name: 'Davide Rossi',
    phone: '+39 347 555 0192',
    email: 'davide.rossi@milano.it',
    membershipTier: 'Bronze',
    loyaltyPoints: 50,
    notes: 'Resort guest, bought Pareo & Souvenir Bag.',
    registeredAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

const DEFAULT_DRAWER_LOGS: CashDrawerLog[] = [
  {
    id: 'LOG-SEED-01',
    sessionId: 'EOD-001',
    timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    eventType: 'open',
    amount: 200.00,
    staffName: 'Jane Doe',
    reason: 'Morning shift opening float initialized',
    currentFloatAfter: 200.00,
  },
  {
    id: 'LOG-SEED-02',
    sessionId: 'EOD-001',
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    eventType: 'paid_in',
    amount: 50.00,
    staffName: 'Jane Doe',
    reason: 'Added $50 petty cash change float top-up',
    currentFloatAfter: 250.00,
  },
  {
    id: 'LOG-SEED-03',
    sessionId: 'EOD-001',
    timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    eventType: 'manual_open',
    amount: 0,
    staffName: 'Marc Antoine',
    reason: 'Opened cash drawer for customer receipt re-print check',
    currentFloatAfter: 250.00,
  },
  {
    id: 'LOG-SEED-04',
    sessionId: 'EOD-001',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    eventType: 'cash_drop',
    amount: 100.00,
    staffName: 'Jane Doe',
    reason: 'Mid-day safe cash drop for security',
    currentFloatAfter: 150.00,
  },
];

const DEFAULT_SETTINGS: StoreSettings = {
  defaultVatRate: 0.15, // 15% Seychelles VAT
  storeName: 'Seychelles Island Boutique',
  taxRegistrationNumber: 'VAT-SEY-984210',
  adminUsername: 'admin',
  adminPin: 'admin123',
  primaryCurrency: 'SCR',
  primaryCurrencySymbol: 'SR',
  secondaryCurrency: 'USD',
  secondaryCurrencySymbol: '$',
  exchangeRate: 13.50,
  allowPaymentInSecondary: true,
  defaultCurrencyMode: 'primary',
  // Customer Display reference currencies (up to 2)
  customerDisplayCurrencies: [
    { code: 'EUR', symbol: '€', rate: 14.60, enabled: true },
    { code: 'USD', symbol: '$', rate: 13.50, enabled: true },
  ],
  cashierAccess: {
    pos: true,
    inventory: true,
    reports: true,
    settings: false,
    staff: false,
  },
  enableAutoUpdateCheck: true,
  updateConfigUrl: '/version.json',
  receiptLogoUrl: '',
  receiptHeaderSubtitle: 'Official Retailer • Ocean Seychelles & Artisan Goods',
  receiptHeaderLines: [
    'Victoria Promenade, Mahé, Seychelles',
    'Tel: +248 4 321 900 • Email: info@oceanseychelles.sc',
  ],
  receiptFooterMessage: 'Thank you for visiting Seychelles Island Boutique!',
  receiptFooterPolicy: 'Returns & exchanges accepted within 14 days with valid sales receipt.',
  receiptFooterLines: [
    'Follow us on Instagram @oceanseychelles',
    'www.oceanseychelles.sc',
  ],
};

const DEFAULT_STAFF: StaffUser[] = [
  {
    id: 'STAFF-ADMIN',
    name: 'Main Administrator',
    username: 'admin',
    pin: 'admin123',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'STAFF-01',
    name: 'Jane Doe',
    username: 'jane',
    pin: '1234',
    role: 'cashier',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'STAFF-02',
    name: 'Marc Antoine',
    username: 'marc',
    pin: '5678',
    role: 'senior_cashier',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_CATEGORIES: CategoryTab[] = [
  { id: 'CAT-1', name: 'T-Shirts', displayOrder: 1, color: 'emerald' },
  { id: 'CAT-2', name: 'Mugs', displayOrder: 2, color: 'cyan' },
  { id: 'CAT-3', name: 'Bags', displayOrder: 3, color: 'blue' },
  { id: 'CAT-4', name: 'Pareos', displayOrder: 4, color: 'amber' },
  { id: 'CAT-5', name: 'Soaps & Cosmetics', displayOrder: 5, color: 'rose' },
  { id: 'CAT-6', name: 'Souvenirs & Crafts', displayOrder: 6, color: 'purple' },
];

// Default Vendors including Ocean Seychelles and Souvenir Boutique
const DEFAULT_VENDORS: Vendor[] = [
  {
    id: 'VEND-OCEAN',
    name: 'Ocean Seychelles Products',
    brandName: 'Ocean Seychelles',
    contactName: 'Laurent Morel',
    email: 'info@oceanseychelles.sc',
    phone: '+248 4 321 900',
    supplierType: 'wholesale',
    payoutTerms: 'Net 30',
    consignmentCutRate: 0,
    notes: 'Official line of Ocean Seychelles T-shirts (9 designs across Kids, Adults, Women) and Luxury/Normal Ceramic Mugs.',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: 'VEND-BOUTIQUE',
    name: 'Souvenir Boutique Direct',
    brandName: 'Souvenir Boutique',
    contactName: 'Chantal Duprès',
    email: 'chantal@souvenirboutique.sc',
    phone: '+248 4 888 120',
    supplierType: 'wholesale',
    payoutTerms: 'Net 15',
    consignmentCutRate: 0,
    notes: 'In-house Souvenir Boutique direct stock including tote bags, t-shirts, and local crafts.',
    createdAt: new Date(Date.now() - 80 * 86400000).toISOString(),
  },
  {
    id: 'VEND-001',
    name: "Alan's Handcrafted Soap & Botanicals",
    brandName: 'Island Botanicals',
    contactName: 'Alan Miller',
    email: 'alan@islandbotanicals.com',
    phone: '(808) 555-0142',
    supplierType: 'consignment',
    payoutTerms: 'Bi-weekly',
    consignmentCutRate: 0.30, // 30% House Cut (70% to Alan)
    notes: 'Local artisan supplier of natural soaps, body scrubs, and botanical bath items.',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'VEND-003',
    name: 'Bora Bora Silk Pareos',
    brandName: 'Bora Silk',
    contactName: 'Keanu Tane',
    email: 'keanu@boraborasilk.com',
    phone: '(808) 555-3390',
    supplierType: 'consignment',
    payoutTerms: 'Monthly',
    consignmentCutRate: 0.35, // 35% House Cut
    notes: 'Hand-dyed silk sarongs, pareos, and beach wraps.',
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
  },
];

// Pre-seeded inventory matching the user request
const DEFAULT_INVENTORY: InventoryItem[] = [
  // --- OCEAN SEYCHELLES PRODUCTS (9 T-Shirt Designs + Luxury & Normal Mugs) ---
  {
    id: 'OCEAN-TS-01',
    name: "Ocean Seychelles T-Shirt - Turtle Cove (Adult M)",
    brand: 'Ocean Seychelles',
    category: 'T-Shirts',
    productLine: 'Beach Heritage',
    size: 'Adults - Medium',
    variant: 'Turtle Cove Design #1',
    sku: '893100101',
    stockLevel: 28,
    minStockThreshold: 5,
    retailPrice: 25.00,
    costBasis: 12.50,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-OCEAN',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'OCEAN-TS-02',
    name: "Ocean Seychelles T-Shirt - Turtle Cove (Women S)",
    brand: 'Ocean Seychelles',
    category: 'T-Shirts',
    productLine: 'Beach Heritage',
    size: 'Women - Small',
    variant: 'Turtle Cove Design #1',
    sku: '893100102',
    stockLevel: 18,
    minStockThreshold: 5,
    retailPrice: 25.00,
    costBasis: 12.50,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-OCEAN',
    imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'OCEAN-TS-03',
    name: "Ocean Seychelles T-Shirt - Turtle Cove (Kids L)",
    brand: 'Ocean Seychelles',
    category: 'T-Shirts',
    productLine: 'Beach Heritage',
    size: 'Kids - Large',
    variant: 'Turtle Cove Design #1',
    sku: '893100103',
    stockLevel: 14,
    minStockThreshold: 4,
    retailPrice: 18.00,
    costBasis: 9.00,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-OCEAN',
    imageUrl: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'OCEAN-TS-04',
    name: "Ocean Seychelles T-Shirt - Anse Source d'Argent (Adult L)",
    brand: 'Ocean Seychelles',
    category: 'T-Shirts',
    productLine: 'Island Paradise',
    size: 'Adults - Large',
    variant: "Anse Source d'Argent Design #2",
    sku: '893100104',
    stockLevel: 22,
    minStockThreshold: 6,
    retailPrice: 28.00,
    costBasis: 14.00,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-OCEAN',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'OCEAN-TS-05',
    name: "Ocean Seychelles T-Shirt - Anse Source d'Argent (Women M)",
    brand: 'Ocean Seychelles',
    category: 'T-Shirts',
    productLine: 'Island Paradise',
    size: 'Women - Medium',
    variant: "Anse Source d'Argent Design #2",
    sku: '893100105',
    stockLevel: 16,
    minStockThreshold: 5,
    retailPrice: 28.00,
    costBasis: 14.00,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-OCEAN',
    imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'OCEAN-TS-06',
    name: "Ocean Seychelles T-Shirt - Coco de Mer Heritage (Adult XL)",
    brand: 'Ocean Seychelles',
    category: 'T-Shirts',
    productLine: 'Botanical Heritage',
    size: 'Adults - XL',
    variant: 'Coco de Mer Design #3',
    sku: '893100106',
    stockLevel: 10,
    minStockThreshold: 4,
    retailPrice: 30.00,
    costBasis: 15.00,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-OCEAN',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'OCEAN-TS-07',
    name: "Ocean Seychelles T-Shirt - Coco de Mer Heritage (Women S)",
    brand: 'Ocean Seychelles',
    category: 'T-Shirts',
    productLine: 'Botanical Heritage',
    size: 'Women - Small',
    variant: 'Coco de Mer Design #3',
    sku: '893100107',
    stockLevel: 12,
    minStockThreshold: 4,
    retailPrice: 30.00,
    costBasis: 15.00,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-OCEAN',
    imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'OCEAN-TS-08',
    name: "Ocean Seychelles T-Shirt - Praslin Palms (Kids M)",
    brand: 'Ocean Seychelles',
    category: 'T-Shirts',
    productLine: 'Sunset Collection',
    size: 'Kids - Medium',
    variant: 'Praslin Palms Design #4',
    sku: '893100108',
    stockLevel: 15,
    minStockThreshold: 4,
    retailPrice: 18.00,
    costBasis: 9.00,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-OCEAN',
    imageUrl: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'OCEAN-TS-09',
    name: "Ocean Seychelles T-Shirt - Mahé Coral Marine (Adult M)",
    brand: 'Ocean Seychelles',
    category: 'T-Shirts',
    productLine: 'Marine Life',
    size: 'Adults - Medium',
    variant: 'Mahé Coral Design #5',
    sku: '893100109',
    stockLevel: 3, // Low stock alert
    minStockThreshold: 8,
    retailPrice: 26.00,
    costBasis: 13.00,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-OCEAN',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'OCEAN-MUG-01',
    name: "Ocean Seychelles Ceramic Mug - Luxury Gold Rim Line",
    brand: 'Ocean Seychelles',
    category: 'Mugs',
    productLine: 'Luxury Line',
    size: '12oz Gold Trim',
    variant: 'Luxury Gold Edition',
    sku: '893100201',
    stockLevel: 24,
    minStockThreshold: 6,
    retailPrice: 18.00,
    costBasis: 8.00,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-OCEAN',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'OCEAN-MUG-02',
    name: "Ocean Seychelles Ceramic Mug - Normal Standard Line",
    brand: 'Ocean Seychelles',
    category: 'Mugs',
    productLine: 'Normal Line',
    size: '11oz Classic',
    variant: 'Standard Matte Blue',
    sku: '893100202',
    stockLevel: 40,
    minStockThreshold: 10,
    retailPrice: 12.00,
    costBasis: 5.00,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-OCEAN',
    imageUrl: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },

  // --- SOUVENIR BOUTIQUE DIRECT INVENTORY ---
  {
    id: 'BOUT-01',
    name: 'Souvenir Boutique Canvas Tote Bag',
    brand: 'Souvenir Boutique',
    category: 'Bags',
    productLine: 'Boutique Accessories',
    size: 'One Size',
    variant: 'Natural Cotton',
    sku: '893200101',
    stockLevel: 18,
    minStockThreshold: 5,
    retailPrice: 22.00,
    costBasis: 10.00,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-BOUTIQUE',
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'BOUT-02',
    name: 'Souvenir Boutique Woven Straw Beach Bag',
    brand: 'Souvenir Boutique',
    category: 'Bags',
    productLine: 'Luxury Beachwear',
    size: 'Large Tote',
    variant: 'Woven Natural Straw',
    sku: '893200102',
    stockLevel: 12,
    minStockThreshold: 4,
    retailPrice: 34.00,
    costBasis: 16.00,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-BOUTIQUE',
    imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'BOUT-03',
    name: 'Souvenir Boutique Unisex Cotton T-Shirt',
    brand: 'Souvenir Boutique',
    category: 'T-Shirts',
    productLine: 'Boutique Classics',
    size: 'Adults - Large',
    variant: 'Tropical Palm',
    sku: '893200103',
    stockLevel: 25,
    minStockThreshold: 6,
    retailPrice: 20.00,
    costBasis: 10.00,
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-BOUTIQUE',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },

  // --- ARTISAN DEPOSIT GOODS ---
  {
    id: 'ITEM-001',
    name: 'Hand-dyed Artisanal Silk Pareo',
    brand: 'Bora Silk',
    category: 'Pareos',
    productLine: 'Handmade Silk',
    size: 'One Size',
    variant: 'Hibiscus Cyan',
    sku: '893400101',
    stockLevel: 18,
    minStockThreshold: 5,
    retailPrice: 45.00,
    costBasis: 29.25, // 65% to vendor ($45 * 0.65)
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-003',
    imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ITEM-002',
    name: 'Coconut Lime Organic Soap',
    brand: 'Island Botanicals',
    category: 'Soaps',
    productLine: 'Botanical Care',
    size: '150g Bar',
    variant: 'Coconut Lime',
    sku: '893400102',
    stockLevel: 24,
    minStockThreshold: 8,
    retailPrice: 12.00,
    costBasis: 8.40, // 70% to Alan
    vatRate: 0.15,
    taxable: true,
    vendorId: 'VEND-001',
    imageUrl: 'https://images.unsplash.com/photo-1607006344380-b6775a0824a7?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
  },
];

// Helper to generate seed historical transactions for analytics
function generateSeedTransactions(vendors: Vendor[], items: InventoryItem[]): Transaction[] {
  const transactions: Transaction[] = [];
  const now = new Date();

  // Create 12 transactions over the past 3 days
  for (let i = 1; i <= 12; i++) {
    const hoursAgo = (12 - i) * 6 + (i % 4);
    const txDate = new Date(now.getTime() - hoursAgo * 3600 * 1000);

    const item1 = items[i % items.length];
    const item2 = items[(i + 4) % items.length];
    const vendor1 = vendors.find((v) => v.id === item1.vendorId) || vendors[0];
    const vendor2 = vendors.find((v) => v.id === item2.vendorId) || vendors[1];

    const qty1 = (i % 2) + 1;
    const qty2 = 1;

    // Calculate payouts & VAT
    const vatRate1 = item1.vatRate ?? 0.15;
    const item1NetPrice = item1.retailPrice * qty1;
    const item1Vat = Number((item1NetPrice * vatRate1).toFixed(2));

    const vatRate2 = item2.vatRate ?? 0.15;
    const item2NetPrice = item2.retailPrice * qty2;
    const item2Vat = Number((item2NetPrice * vatRate2).toFixed(2));

    const item1Payout = vendor1.supplierType === 'consignment'
      ? item1NetPrice * (1 - vendor1.consignmentCutRate)
      : item1.costBasis * qty1;
    const item1Profit = item1NetPrice - item1Payout;

    const item2Payout = vendor2.supplierType === 'consignment'
      ? item2NetPrice * (1 - vendor2.consignmentCutRate)
      : item2.costBasis * qty2;
    const item2Profit = item2NetPrice - item2Payout;

    const txItems: TransactionItem[] = [
      {
        itemId: item1.id,
        name: item1.name,
        brand: item1.brand,
        category: item1.category,
        productLine: item1.productLine,
        size: item1.size,
        variant: item1.variant,
        sku: item1.sku,
        quantity: qty1,
        unitPrice: item1.retailPrice,
        totalPrice: item1NetPrice,
        vatRate: vatRate1,
        vatAmount: item1Vat,
        vendorId: vendor1.id,
        vendorName: vendor1.name,
        supplierType: vendor1.supplierType,
        costBasis: item1.costBasis,
        vendorPayoutAmount: Number(item1Payout.toFixed(2)),
        houseProfitAmount: Number(item1Profit.toFixed(2)),
      },
      {
        itemId: item2.id,
        name: item2.name,
        brand: item2.brand,
        category: item2.category,
        productLine: item2.productLine,
        size: item2.size,
        variant: item2.variant,
        sku: item2.sku,
        quantity: qty2,
        unitPrice: item2.retailPrice,
        totalPrice: item2NetPrice,
        vatRate: vatRate2,
        vatAmount: item2Vat,
        vendorId: vendor2.id,
        vendorName: vendor2.name,
        supplierType: vendor2.supplierType,
        costBasis: item2.costBasis,
        vendorPayoutAmount: Number(item2Payout.toFixed(2)),
        houseProfitAmount: Number(item2Profit.toFixed(2)),
      },
    ];

    const subtotal = txItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
    const vatTotal = Number(txItems.reduce((acc, curr) => acc + curr.vatAmount, 0).toFixed(2));
    const total = Number((subtotal + vatTotal).toFixed(2));
    const paymentMethod = i % 3 === 0 ? 'cash' : 'card';

    transactions.push({
      id: `TX-${1000 + i}`,
      receiptNumber: `INV-${txDate.getFullYear()}${(txDate.getMonth() + 1).toString().padStart(2, '0')}${txDate.getDate().toString().padStart(2, '0')}-${100 + i}`,
      timestamp: txDate.toISOString(),
      cashierName: i % 2 === 0 ? 'Maya Cashier' : 'Store Admin',
      subtotal,
      vatTotal,
      tax: vatTotal,
      discount: 0,
      total,
      paymentMethod,
      cashGiven: paymentMethod === 'cash' ? Math.ceil(total / 10) * 10 : undefined,
      changeDue: paymentMethod === 'cash' ? Math.ceil(total / 10) * 10 - total : undefined,
      items: txItems,
    });
  }

  return transactions;
}

class PosDatabase {
  private vendors: Vendor[] = [];
  private inventory: InventoryItem[] = [];
  private transactions: Transaction[] = [];
  private payouts: ConsignmentPayoutRecord[] = [];
  private eodSessions: EODSession[] = [];
  private settings: StoreSettings = DEFAULT_SETTINGS;
  private staffUsers: StaffUser[] = [];
  private categories: CategoryTab[] = [];
  private drawerLogs: CashDrawerLog[] = [];
  private customers: Customer[] = [];

  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    if (typeof window === 'undefined') return;

    try {
      const v = localStorage.getItem(STORAGE_KEYS.VENDORS);
      const i = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      const t = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const p = localStorage.getItem(STORAGE_KEYS.PAYOUTS);
      const e = localStorage.getItem(STORAGE_KEYS.EOD_SESSIONS);
      const s = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const st = localStorage.getItem(STORAGE_KEYS.STAFF);
      const ct = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      const dl = localStorage.getItem(STORAGE_KEYS.DRAWER_LOGS);
      const cust = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);

      this.vendors = v ? JSON.parse(v) : DEFAULT_VENDORS;
      this.inventory = i ? JSON.parse(i) : DEFAULT_INVENTORY;
      this.payouts = p ? JSON.parse(p) : [];
      this.settings = s ? JSON.parse(s) : DEFAULT_SETTINGS;
      this.staffUsers = st ? JSON.parse(st) : DEFAULT_STAFF;
      this.categories = ct ? JSON.parse(ct) : DEFAULT_CATEGORIES;
      this.drawerLogs = dl ? JSON.parse(dl) : DEFAULT_DRAWER_LOGS;
      this.customers = cust ? JSON.parse(cust) : DEFAULT_CUSTOMERS;

      this.eodSessions = e ? JSON.parse(e) : [
        {
          id: 'EOD-001',
          date: new Date().toISOString().split('T')[0],
          openedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
          startingFloat: 200.00,
          cashSales: 0,
          cardSales: 0,
          paidInTotal: 50.00,
          paidOutTotal: 0,
          cashDropTotal: 100.00,
          expectedCash: 150.00,
          status: 'open',
          notes: 'Shift opened with $200 float.',
        },
      ];

      if (t) {
        this.transactions = JSON.parse(t);
      } else {
        this.transactions = generateSeedTransactions(this.vendors, this.inventory);
        this.saveTransactions();
      }

      if (!v) this.saveVendors();
      if (!i) this.saveInventory();
      if (!e) this.saveEODSessions();
      if (!s) this.saveSettings();
      if (!st) this.saveStaff();
      if (!ct) this.saveCategories();
      if (!dl) this.saveDrawerLogs();
      if (!cust) this.saveCustomers();
    } catch {
      this.vendors = DEFAULT_VENDORS;
      this.inventory = DEFAULT_INVENTORY;
      this.transactions = generateSeedTransactions(DEFAULT_VENDORS, DEFAULT_INVENTORY);
      this.eodSessions = [];
      this.settings = DEFAULT_SETTINGS;
      this.staffUsers = DEFAULT_STAFF;
      this.categories = DEFAULT_CATEGORIES;
      this.drawerLogs = DEFAULT_DRAWER_LOGS;
      this.customers = DEFAULT_CUSTOMERS;
    }
  }

  // Persistent Savers
  private saveVendors() {
    localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(this.vendors));
  }

  private saveInventory() {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(this.inventory));
  }

  private saveTransactions() {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(this.transactions));
  }

  private savePayouts() {
    localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(this.payouts));
  }

  private saveEODSessions() {
    localStorage.setItem(STORAGE_KEYS.EOD_SESSIONS, JSON.stringify(this.eodSessions));
  }

  private saveSettings() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
  }

  private saveStaff() {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(this.staffUsers));
  }

  private saveCategories() {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(this.categories));
  }

  private saveDrawerLogs() {
    localStorage.setItem(STORAGE_KEYS.DRAWER_LOGS, JSON.stringify(this.drawerLogs));
  }

  private saveCustomers() {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(this.customers));
  }

  // Reset / Seed DB
  public resetToDefault() {
    this.vendors = DEFAULT_VENDORS;
    this.inventory = DEFAULT_INVENTORY;
    this.transactions = generateSeedTransactions(DEFAULT_VENDORS, DEFAULT_INVENTORY);
    this.payouts = [];
    this.settings = DEFAULT_SETTINGS;
    this.drawerLogs = DEFAULT_DRAWER_LOGS;
    this.eodSessions = [
      {
        id: 'EOD-001',
        date: new Date().toISOString().split('T')[0],
        openedAt: new Date().toISOString(),
        startingFloat: 200.00,
        cashSales: 0,
        cardSales: 0,
        paidInTotal: 50.00,
        paidOutTotal: 0,
        cashDropTotal: 100.00,
        expectedCash: 150.00,
        status: 'open',
        notes: 'Drawer reset with $200 float.',
      },
    ];
    this.saveVendors();
    this.saveInventory();
    this.saveTransactions();
    this.savePayouts();
    this.saveEODSessions();
    this.saveSettings();
    this.saveDrawerLogs();
  }

  // --- SETTINGS & VAT ---
  public getSettings(): StoreSettings {
    return { ...DEFAULT_SETTINGS, ...this.settings };
  }

  public updateSettings(newSettings: Partial<StoreSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  public getVatRate(): number {
    return this.settings.defaultVatRate ?? 0.15;
  }

  // --- VENDORS ---
  public getVendors(): Vendor[] {
    return [...this.vendors];
  }

  public getVendorById(id: string): Vendor | undefined {
    return this.vendors.find((v) => v.id === id);
  }

  public getVendorByName(name: string): Vendor | undefined {
    const clean = name.trim().toLowerCase();
    return this.vendors.find(
      (v) => v.name.toLowerCase() === clean || (v.brandName && v.brandName.toLowerCase() === clean)
    );
  }

  public saveVendor(vendor: Omit<Vendor, 'id' | 'createdAt'> & { id?: string }): Vendor {
    if (vendor.id) {
      const idx = this.vendors.findIndex((v) => v.id === vendor.id);
      if (idx !== -1) {
        this.vendors[idx] = {
          ...this.vendors[idx],
          ...vendor,
        };
        this.recalculateConsignmentCostBasis(this.vendors[idx]);
        this.saveVendors();
        return this.vendors[idx];
      }
    }

    const newVendor: Vendor = {
      ...vendor,
      id: `VEND-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
    };
    this.vendors.unshift(newVendor);
    this.saveVendors();
    return newVendor;
  }

  public deleteVendor(id: string): boolean {
    this.vendors = this.vendors.filter((v) => v.id !== id);
    this.saveVendors();
    return true;
  }

  private recalculateConsignmentCostBasis(vendor: Vendor) {
    if (vendor.supplierType === 'consignment') {
      this.inventory = this.inventory.map((item) => {
        if (item.vendorId === vendor.id) {
          const vendorCut = item.retailPrice * (1 - vendor.consignmentCutRate);
          return {
            ...item,
            costBasis: Number(vendorCut.toFixed(2)),
          };
        }
        return item;
      });
      this.saveInventory();
    }
  }

  // --- INVENTORY ---
  public getInventory(): InventoryItem[] {
    return [...this.inventory];
  }

  public getItemBySku(sku: string): InventoryItem | undefined {
    const cleanSku = sku.trim().toLowerCase();
    return this.inventory.find(
      (item) => item.sku.toLowerCase() === cleanSku || item.id.toLowerCase() === cleanSku
    );
  }

  public saveItem(itemData: Omit<InventoryItem, 'id' | 'createdAt'> & { id?: string }): InventoryItem {
    const vendor = this.getVendorById(itemData.vendorId);
    let calculatedCostBasis = itemData.costBasis;

    if (vendor && vendor.supplierType === 'consignment') {
      calculatedCostBasis = Number((itemData.retailPrice * (1 - vendor.consignmentCutRate)).toFixed(2));
    }

    const vatRate = itemData.vatRate !== undefined ? itemData.vatRate : this.settings.defaultVatRate;

    if (itemData.id) {
      const idx = this.inventory.findIndex((i) => i.id === itemData.id);
      if (idx !== -1) {
        this.inventory[idx] = {
          ...this.inventory[idx],
          ...itemData,
          brand: itemData.brand || vendor?.brandName || 'Ocean Seychelles',
          costBasis: calculatedCostBasis,
          vatRate,
        };
        this.saveInventory();
        return this.inventory[idx];
      }
    }

    const newItem: InventoryItem = {
      ...itemData,
      id: `ITEM-${Math.floor(100 + Math.random() * 900)}`,
      brand: itemData.brand || vendor?.brandName || 'Ocean Seychelles',
      costBasis: calculatedCostBasis,
      vatRate,
      createdAt: new Date().toISOString(),
    };
    this.inventory.unshift(newItem);
    this.saveInventory();
    return newItem;
  }

  public bulkImportFromCsvRows(rows: ParsedCsvRow[]): { added: number; updated: number } {
    let added = 0;
    let updated = 0;

    for (const row of rows) {
      // Find vendor or auto-create vendor profile if brand missing
      let vendor = this.getVendorByName(row.brand) || this.getVendorByName(row.vendorName);
      if (!vendor) {
        vendor = this.saveVendor({
          name: `${row.brand} Direct`,
          brandName: row.brand,
          contactName: 'Brand Manager',
          email: `contact@${row.brand.toLowerCase().replace(/[^a-z]/g, '')}.com`,
          phone: '+248 4 000 000',
          supplierType: 'wholesale',
          payoutTerms: 'Net 30',
          consignmentCutRate: 0,
          notes: `Auto-created vendor profile during CSV import of ${row.brand}.`,
        });
      }

      // Check if SKU already exists
      const existing = this.getItemBySku(row.sku);
      if (existing) {
        this.saveItem({
          id: existing.id,
          name: row.name,
          brand: row.brand,
          category: row.category,
          productLine: row.productLine,
          size: row.size,
          variant: row.variant,
          sku: row.sku,
          retailPrice: row.retailPrice,
          costBasis: row.costBasis,
          stockLevel: row.stockLevel,
          minStockThreshold: row.minStockThreshold,
          vatRate: row.vatRate,
          taxable: true,
          vendorId: vendor.id,
        });
        updated++;
      } else {
        this.saveItem({
          name: row.name,
          brand: row.brand,
          category: row.category,
          productLine: row.productLine,
          size: row.size,
          variant: row.variant,
          sku: row.sku,
          retailPrice: row.retailPrice,
          costBasis: row.costBasis,
          stockLevel: row.stockLevel,
          minStockThreshold: row.minStockThreshold,
          vatRate: row.vatRate,
          taxable: true,
          vendorId: vendor.id,
        });
        added++;
      }
    }

    return { added, updated };
  }

  public adjustStock(itemId: string, qtyDelta: number): InventoryItem | undefined {
    const item = this.inventory.find((i) => i.id === itemId);
    if (item) {
      item.stockLevel = Math.max(0, item.stockLevel + qtyDelta);
      this.saveInventory();
      return item;
    }
    return undefined;
  }

  public deleteItem(id: string): boolean {
    this.inventory = this.inventory.filter((i) => i.id !== id);
    this.saveInventory();
    return true;
  }

  public getLowStockItems(): InventoryItem[] {
    return this.inventory.filter((i) => i.stockLevel <= i.minStockThreshold);
  }

  // --- TRANSACTIONS & RECORDING ---
  public getTransactions(): Transaction[] {
    return [...this.transactions].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public recordTransaction(
    items: { item: InventoryItem; quantity: number }[],
    paymentMethod: Transaction['paymentMethod'],
    cashierName: string,
    cashGiven?: number,
    discountAmount: number = 0,
    customerInfo?: { id?: string; name: string; phone: string; email?: string },
    currencyUsed: Transaction['currencyUsed'] = 'primary',
    cashGivenSecondary?: number,
    changeDueSecondary?: number,
    secondaryTotal?: number
  ): Transaction {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const txNum = Math.floor(100 + Math.random() * 900);

    const txItems: TransactionItem[] = items.map(({ item, quantity }) => {
      const vendor = this.getVendorById(item.vendorId);
      const isConsignment = vendor?.supplierType === 'consignment';

      const totalPrice = item.retailPrice * quantity;
      const vatRate = item.vatRate ?? this.settings.defaultVatRate;
      const vatAmount = Number((totalPrice * vatRate).toFixed(2));

      let vendorPayout = 0;
      let houseProfit = 0;

      if (isConsignment && vendor) {
        vendorPayout = totalPrice * (1 - vendor.consignmentCutRate);
        houseProfit = totalPrice * vendor.consignmentCutRate;
      } else {
        const totalCost = item.costBasis * quantity;
        vendorPayout = totalCost;
        houseProfit = totalPrice - totalCost;
      }

      this.adjustStock(item.id, -quantity);

      return {
        itemId: item.id,
        name: item.name,
        brand: item.brand || vendor?.brandName || 'Ocean Seychelles',
        category: item.category,
        productLine: item.productLine,
        size: item.size,
        variant: item.variant,
        sku: item.sku,
        quantity,
        unitPrice: item.retailPrice,
        totalPrice,
        vatRate,
        vatAmount,
        vendorId: item.vendorId,
        vendorName: vendor ? vendor.name : 'Unknown Vendor',
        supplierType: vendor ? vendor.supplierType : 'wholesale',
        costBasis: item.costBasis,
        vendorPayoutAmount: Number(vendorPayout.toFixed(2)),
        houseProfitAmount: Number(houseProfit.toFixed(2)),
      };
    });

    const subtotal = txItems.reduce((acc, curr) => acc + curr.totalPrice, 0) - discountAmount;
    const vatTotal = Number(txItems.reduce((acc, curr) => acc + curr.vatAmount, 0).toFixed(2));
    const total = Number((subtotal + vatTotal).toFixed(2));

    let cust: Customer | undefined;
    let pointsEarned = 0;

    if (customerInfo && customerInfo.name) {
      cust = this.saveCustomer({
        id: customerInfo.id,
        name: customerInfo.name,
        phone: customerInfo.phone || '',
        email: customerInfo.email || '',
      });
      pointsEarned = Math.floor(total);
      cust.loyaltyPoints = (cust.loyaltyPoints || 0) + pointsEarned;
      if (cust.loyaltyPoints > 500) cust.membershipTier = 'VIP';
      else if (cust.loyaltyPoints > 250) cust.membershipTier = 'Gold';
      else if (cust.loyaltyPoints > 100) cust.membershipTier = 'Silver';
      this.saveCustomers();
    }

    const transaction: Transaction = {
      id: `TX-${Date.now()}`,
      receiptNumber: `INV-${dateStr}-${txNum}`,
      timestamp: now.toISOString(),
      cashierName,
      subtotal,
      vatTotal,
      tax: vatTotal,
      discount: discountAmount,
      total,
      paymentMethod,
      cashGiven: cashGiven,
      changeDue: cashGiven && cashGiven >= total ? Number((cashGiven - total).toFixed(2)) : undefined,
      currencyUsed,
      exchangeRateUsed: currencyUsed !== 'primary' ? (this.settings.exchangeRate || 13.50) : undefined,
      secondaryTotal: secondaryTotal || (currencyUsed !== 'primary' ? Number((total / (this.settings.exchangeRate || 13.50)).toFixed(2)) : undefined),
      cashGivenSecondary,
      changeDueSecondary,
      items: txItems,
      customerId: cust?.id,
      customerName: cust?.name || customerInfo?.name,
      customerPhone: cust?.phone || customerInfo?.phone,
      customerEmail: cust?.email || customerInfo?.email,
      loyaltyPointsEarned: pointsEarned > 0 ? pointsEarned : undefined,
    };

    this.transactions.unshift(transaction);
    this.saveTransactions();

    this.updateActiveEODSession(transaction);

    return transaction;
  }

  // --- CUSTOMERS & LOYALTY ---
  public getCustomers(): Customer[] {
    return [...this.customers].sort((a, b) => b.loyaltyPoints - a.loyaltyPoints);
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.customers.find((c) => c.id === id);
  }

  public saveCustomer(custData: Partial<Customer> & { name: string; phone: string }): Customer {
    const existingIndex = custData.id
      ? this.customers.findIndex((c) => c.id === custData.id)
      : this.customers.findIndex(
          (c) =>
            (custData.phone && c.phone.trim() === custData.phone.trim()) ||
            (custData.email && c.email && c.email.toLowerCase() === custData.email.toLowerCase())
        );

    if (existingIndex >= 0) {
      const existing = this.customers[existingIndex];
      const updated: Customer = {
        ...existing,
        ...custData,
        id: existing.id,
      };
      this.customers[existingIndex] = updated;
      this.saveCustomers();
      return updated;
    } else {
      const newCust: Customer = {
        id: custData.id || `CUST-${1000 + this.customers.length + 1}`,
        name: custData.name.trim(),
        phone: custData.phone.trim(),
        email: custData.email?.trim() || '',
        membershipTier: custData.membershipTier || 'Bronze',
        loyaltyPoints: custData.loyaltyPoints ?? 0,
        notes: custData.notes || '',
        registeredAt: new Date().toISOString(),
      };
      this.customers.unshift(newCust);
      this.saveCustomers();
      return newCust;
    }
  }

  public getCustomerTransactions(query: string): Transaction[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return this.transactions.filter((tx) => {
      const matchId = tx.customerId?.toLowerCase() === q;
      const matchName = tx.customerName?.toLowerCase().includes(q);
      const matchPhone = tx.customerPhone?.toLowerCase().includes(q);
      const matchEmail = tx.customerEmail?.toLowerCase().includes(q);
      const matchReceipt = tx.receiptNumber.toLowerCase().includes(q);
      const matchItem = tx.items.some(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.sku.toLowerCase().includes(q) ||
          (it.brand && it.brand.toLowerCase().includes(q))
      );
      return matchId || matchName || matchPhone || matchEmail || matchReceipt || matchItem;
    });
  }

  public getCustomerPurchasedItems(customerIdOrPhone: string) {
    const txs = this.getCustomerTransactions(customerIdOrPhone);
    const purchasedList: {
      itemId: string;
      name: string;
      sku: string;
      brand?: string;
      category?: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      receiptNumber: string;
      transactionId: string;
      timestamp: string;
      isRefund?: boolean;
    }[] = [];

    txs.forEach((tx) => {
      tx.items.forEach((it) => {
        purchasedList.push({
          itemId: it.itemId,
          name: it.name,
          sku: it.sku,
          brand: it.brand,
          category: it.category,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          receiptNumber: tx.receiptNumber,
          transactionId: tx.id,
          timestamp: tx.timestamp,
          isRefund: tx.isRefund,
        });
      });
    });

    return purchasedList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getCustomerLoyaltyInsights(customerIdOrPhone: string) {
    const txs = this.getCustomerTransactions(customerIdOrPhone);
    const validSales = txs.filter((t) => !t.isRefund);
    const totalSpend = validSales.reduce((acc, t) => acc + t.total, 0);
    const totalOrders = validSales.length;
    const avgOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0;

    const brandCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};

    validSales.forEach((t) => {
      t.items.forEach((it) => {
        if (it.brand) {
          brandCounts[it.brand] = (brandCounts[it.brand] || 0) + it.quantity;
        }
        if (it.category) {
          categoryCounts[it.category] = (categoryCounts[it.category] || 0) + it.quantity;
        }
      });
    });

    const topBrand = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      totalSpend: Number(totalSpend.toFixed(2)),
      totalOrders,
      avgOrderValue: Number(avgOrderValue.toFixed(2)),
      topBrand,
      topCategory,
      lastVisitDate: validSales[0]?.timestamp || null,
    };
  }

  public getTransactionByReceiptNumber(receiptNum: string): Transaction | undefined {
    const query = receiptNum.trim().toLowerCase();
    if (!query) return undefined;
    return this.transactions.find(
      (tx) => tx.receiptNumber.toLowerCase() === query || tx.id.toLowerCase() === query
    );
  }

  public recordRefundTransaction(
    items: { item: InventoryItem; quantity: number; unitPrice?: number }[],
    paymentMethod: Transaction['paymentMethod'],
    cashierName: string,
    refundReason: string,
    restockInventory: boolean = true,
    originalReceiptNumber?: string,
    originalTransactionId?: string
  ): Transaction {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const txNum = Math.floor(100 + Math.random() * 900);

    const txItems: TransactionItem[] = items.map(({ item, quantity, unitPrice }) => {
      const vendor = this.getVendorById(item.vendorId);
      const isConsignment = vendor?.supplierType === 'consignment';

      const actualUnitPrice = unitPrice !== undefined ? unitPrice : item.retailPrice;
      const negQuantity = -Math.abs(quantity);
      const totalPrice = -Math.abs(actualUnitPrice * quantity);
      const vatRate = item.vatRate ?? this.settings.defaultVatRate;
      const vatAmount = Number((totalPrice * vatRate).toFixed(2));

      let vendorPayout = 0;
      let houseProfit = 0;

      if (isConsignment && vendor) {
        vendorPayout = totalPrice * (1 - vendor.consignmentCutRate);
        houseProfit = totalPrice * vendor.consignmentCutRate;
      } else {
        const totalCost = -Math.abs(item.costBasis * quantity);
        vendorPayout = totalCost;
        houseProfit = totalPrice - totalCost;
      }

      // Restock items back into inventory stock levels if requested
      if (restockInventory) {
        this.adjustStock(item.id, Math.abs(quantity));
      }

      return {
        itemId: item.id,
        name: item.name,
        brand: item.brand || vendor?.brandName || 'Ocean Seychelles',
        category: item.category,
        productLine: item.productLine,
        size: item.size,
        variant: item.variant,
        sku: item.sku,
        quantity: negQuantity,
        unitPrice: actualUnitPrice,
        totalPrice: Number(totalPrice.toFixed(2)),
        vatRate,
        vatAmount,
        vendorId: item.vendorId,
        vendorName: vendor ? vendor.name : 'Unknown Vendor',
        supplierType: vendor ? vendor.supplierType : 'wholesale',
        costBasis: item.costBasis,
        vendorPayoutAmount: Number(vendorPayout.toFixed(2)),
        houseProfitAmount: Number(houseProfit.toFixed(2)),
      };
    });

    const subtotal = Number(txItems.reduce((acc, curr) => acc + curr.totalPrice, 0).toFixed(2));
    const vatTotal = Number(txItems.reduce((acc, curr) => acc + curr.vatAmount, 0).toFixed(2));
    const total = Number((subtotal + vatTotal).toFixed(2));

    const transaction: Transaction = {
      id: `TX-REFUND-${Date.now()}`,
      receiptNumber: `REF-${dateStr}-${txNum}`,
      timestamp: now.toISOString(),
      cashierName,
      subtotal,
      vatTotal,
      tax: vatTotal,
      discount: 0,
      total,
      paymentMethod,
      isRefund: true,
      refundReason,
      originalReceiptNumber,
      originalTransactionId,
      restocked: restockInventory,
      items: txItems,
    };

    this.transactions.unshift(transaction);
    this.saveTransactions();

    this.updateActiveEODSession(transaction);

    // Record drawer log if refund is paid out in cash
    if (paymentMethod === 'cash') {
      const activeSession = this.getActiveEODSession();
      this.recordDrawerLog({
        sessionId: activeSession?.id,
        eventType: 'paid_out',
        amount: Math.abs(total),
        staffName: cashierName,
        reason: `Cash Refund Out (${transaction.receiptNumber}): ${refundReason}`,
        currentFloatAfter: activeSession ? activeSession.expectedCash : undefined,
      });
    }

    return transaction;
  }

  // --- EOD SESSIONS & CASH DRAWER AUDIT LOGS ---
  public getActiveEODSession(): EODSession | undefined {
    return this.eodSessions.find((s) => s.status === 'open');
  }

  public getEODSessions(): EODSession[] {
    return [...this.eodSessions];
  }

  private recalculateActiveExpectedCash(session: EODSession) {
    const paidIn = session.paidInTotal || 0;
    const paidOut = session.paidOutTotal || 0;
    const cashDrop = session.cashDropTotal || 0;
    session.expectedCash = Number((session.startingFloat + session.cashSales + paidIn - paidOut - cashDrop).toFixed(2));
  }

  public openEODSession(startingFloat: number, notes?: string, staffName: string = 'Staff Member'): EODSession {
    const active = this.getActiveEODSession();
    if (active) return active;

    const newSession: EODSession = {
      id: `EOD-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      openedAt: new Date().toISOString(),
      startingFloat,
      cashSales: 0,
      cardSales: 0,
      paidInTotal: 0,
      paidOutTotal: 0,
      cashDropTotal: 0,
      expectedCash: startingFloat,
      status: 'open',
      notes,
    };

    this.eodSessions.unshift(newSession);
    this.saveEODSessions();

    this.recordDrawerLog({
      sessionId: newSession.id,
      eventType: 'open',
      amount: startingFloat,
      staffName,
      reason: notes || `Shift opened with starting float of $${startingFloat.toFixed(2)}`,
      currentFloatAfter: startingFloat,
    });

    return newSession;
  }

  private updateActiveEODSession(tx: Transaction) {
    const active = this.getActiveEODSession();
    if (!active) return;

    if (tx.paymentMethod === 'cash') {
      active.cashSales = Number((active.cashSales + tx.total).toFixed(2));
      this.recalculateActiveExpectedCash(active);
    } else if (tx.paymentMethod === 'card') {
      active.cardSales = Number((active.cardSales + tx.total).toFixed(2));
    }

    this.saveEODSessions();
  }

  public closeEODSession(actualCash: number, closedBy: string, notes?: string): EODSession | undefined {
    const active = this.getActiveEODSession();
    if (!active) return undefined;

    active.closedAt = new Date().toISOString();
    active.actualCash = actualCash;
    active.cashDifference = Number((actualCash - active.expectedCash).toFixed(2));
    active.status = 'closed';
    active.closedBy = closedBy;
    if (notes) active.notes = (active.notes ? active.notes + ' | ' : '') + notes;

    this.saveEODSessions();

    this.recordDrawerLog({
      sessionId: active.id,
      eventType: 'close',
      amount: actualCash,
      staffName: closedBy,
      reason: `Shift closed. Counted $${actualCash.toFixed(2)} vs Expected $${active.expectedCash.toFixed(2)} (${active.cashDifference >= 0 ? '+' : ''}$${active.cashDifference.toFixed(2)} variance). ${notes || ''}`,
      currentFloatAfter: actualCash,
    });

    return active;
  }

  public recordCashAdjustment(
    eventType: 'paid_in' | 'paid_out' | 'cash_drop' | 'manual_open',
    amount: number,
    staffName: string,
    reason: string
  ): CashDrawerLog {
    const active = this.getActiveEODSession();
    const sessionId = active ? active.id : undefined;

    if (active) {
      if (eventType === 'paid_in') {
        active.paidInTotal = Number(((active.paidInTotal || 0) + amount).toFixed(2));
      } else if (eventType === 'paid_out') {
        active.paidOutTotal = Number(((active.paidOutTotal || 0) + amount).toFixed(2));
      } else if (eventType === 'cash_drop') {
        active.cashDropTotal = Number(((active.cashDropTotal || 0) + amount).toFixed(2));
      }
      this.recalculateActiveExpectedCash(active);
      this.saveEODSessions();
    }

    const currentFloatAfter = active ? active.expectedCash : undefined;

    return this.recordDrawerLog({
      sessionId,
      eventType,
      amount: eventType === 'manual_open' ? 0 : amount,
      staffName,
      reason,
      currentFloatAfter,
    });
  }

  public getDrawerLogs(sessionId?: string): CashDrawerLog[] {
    let logs = [...this.drawerLogs];
    if (sessionId) {
      logs = logs.filter((l) => l.sessionId === sessionId);
    }
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public recordDrawerLog(log: Omit<CashDrawerLog, 'id' | 'timestamp'>): CashDrawerLog {
    const newLog: CashDrawerLog = {
      ...log,
      id: `LOG-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
    };
    this.drawerLogs.unshift(newLog);
    this.saveDrawerLogs();
    return newLog;
  }

  // --- CONSIGNMENT PAYOUT CALCULATIONS ---
  public calculateConsignmentPayouts(vendorId?: string) {
    const vendors = vendorId 
      ? this.vendors.filter((v) => v.id === vendorId && v.supplierType === 'consignment')
      : this.vendors.filter((v) => v.supplierType === 'consignment');

    return vendors.map((vendor) => {
      let totalUnitsSold = 0;
      let totalGrossSales = 0;
      let vendorPayoutOwed = 0;
      let houseCommission = 0;

      this.transactions.forEach((tx) => {
        tx.items.forEach((item) => {
          if (item.vendorId === vendor.id) {
            totalUnitsSold += item.quantity;
            totalGrossSales += item.totalPrice;
            vendorPayoutOwed += item.vendorPayoutAmount;
            houseCommission += item.houseProfitAmount;
          }
        });
      });

      return {
        vendor,
        totalUnitsSold,
        totalGrossSales: Number(totalGrossSales.toFixed(2)),
        vendorPayoutOwed: Number(vendorPayoutOwed.toFixed(2)),
        houseCommission: Number(houseCommission.toFixed(2)),
      };
    });
  }

  public recordVendorPayout(vendorId: string, amount: number, periodNotes: string): ConsignmentPayoutRecord {
    const vendor = this.getVendorById(vendorId);
    const newRecord: ConsignmentPayoutRecord = {
      id: `PAY-${Date.now()}`,
      vendorId,
      vendorName: vendor ? vendor.name : 'Vendor',
      periodStart: new Date(Date.now() - 30 * 86400000).toISOString(),
      periodEnd: new Date().toISOString(),
      totalUnitsSold: 0,
      totalGrossSales: amount,
      houseCommission: 0,
      payoutAmount: amount,
      status: 'paid',
      paidAt: new Date().toISOString(),
      notes: periodNotes,
    };

    this.payouts.unshift(newRecord);
    this.savePayouts();
    return newRecord;
  }

  public getPayoutRecords(): ConsignmentPayoutRecord[] {
    return [...this.payouts];
  }

  // --- STAFF & CASHIER MANAGEMENT ---
  public getStaffUsers(): StaffUser[] {
    return [...this.staffUsers];
  }

  public getActiveCashiers(): StaffUser[] {
    return this.staffUsers.filter((u) => u.status === 'active');
  }

  public authenticateStaff(pin: string): StaffUser | undefined {
    const cleanPin = pin.trim();
    if (!cleanPin) return undefined;
    return this.staffUsers.find((user) => user.status === 'active' && user.pin === cleanPin);
  }

  public addStaffUser(user: Omit<StaffUser, 'id' | 'createdAt'>): StaffUser {
    const newUser: StaffUser = {
      ...user,
      id: `STAFF-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
    };
    this.staffUsers.unshift(newUser);
    this.saveStaff();
    return newUser;
  }

  public updateStaffUser(id: string, updates: Partial<StaffUser>): StaffUser | undefined {
    const idx = this.staffUsers.findIndex((u) => u.id === id);
    if (idx !== -1) {
      this.staffUsers[idx] = { ...this.staffUsers[idx], ...updates };
      this.saveStaff();
      return this.staffUsers[idx];
    }
    return undefined;
  }

  public deleteStaffUser(id: string): boolean {
    this.staffUsers = this.staffUsers.filter((u) => u.id !== id);
    this.saveStaff();
    return true;
  }

  public verifyAdminLogin(input: string): boolean {
    const clean = input.trim();
    if (!clean) return false;
    if (clean === (this.settings.adminPin || 'admin123') || clean === (this.settings.adminUsername || 'admin')) {
      return true;
    }
    return this.staffUsers.some(
      (u) => u.role === 'admin' && (u.username.toLowerCase() === clean.toLowerCase() || u.pin === clean)
    );
  }

  // --- CATEGORY TABS MANAGEMENT ---
  public getCategories(): CategoryTab[] {
    return [...this.categories].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public addCategory(name: string, color: string = 'emerald'): CategoryTab {
    const cleanName = name.trim();
    const existing = this.categories.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing;

    const newCat: CategoryTab = {
      id: `CAT-${Date.now()}`,
      name: cleanName,
      displayOrder: this.categories.length + 1,
      color,
    };
    this.categories.push(newCat);
    this.saveCategories();
    return newCat;
  }

  public renameCategory(oldName: string, newName: string): boolean {
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanOld || !cleanNew) return false;

    // Update Category Tab Title
    const catIndex = this.categories.findIndex((c) => c.name.toLowerCase() === cleanOld.toLowerCase());
    if (catIndex !== -1) {
      this.categories[catIndex].name = cleanNew;
      this.saveCategories();
    } else {
      this.addCategory(cleanNew);
    }

    // Rename matching category on all products in inventory
    let updatedCount = 0;
    this.inventory = this.inventory.map((item) => {
      if (item.category.toLowerCase() === cleanOld.toLowerCase()) {
        updatedCount++;
        return { ...item, category: cleanNew };
      }
      return item;
    });

    if (updatedCount > 0) {
      this.saveInventory();
    }
    return true;
  }

  public deleteCategory(name: string): boolean {
    const clean = name.trim();
    this.categories = this.categories.filter((c) => c.name.toLowerCase() !== clean.toLowerCase());
    this.saveCategories();
    return true;
  }

  // --- PRODUCT TITLES & PRICE SETTER ---
  public updateProductTitleAndPrice(
    id: string,
    updates: {
      name?: string;
      retailPrice?: number;
      retailPriceSecondary?: number;
      costBasis?: number;
      costBasisSecondary?: number;
      category?: string;
      brand?: string;
      sku?: string;
      stockLevel?: number;
    }
  ): InventoryItem | undefined {
    const idx = this.inventory.findIndex((item) => item.id === id);
    if (idx === -1) return undefined;

    const item = this.inventory[idx];
    const vendor = this.getVendorById(item.vendorId);

    let newRetailPrice = updates.retailPrice !== undefined ? updates.retailPrice : item.retailPrice;
    let newCostBasis = updates.costBasis !== undefined ? updates.costBasis : item.costBasis;

    if (vendor && vendor.supplierType === 'consignment' && updates.retailPrice !== undefined) {
      newCostBasis = Number((newRetailPrice * (1 - vendor.consignmentCutRate)).toFixed(2));
    }

    this.inventory[idx] = {
      ...item,
      name: updates.name !== undefined ? updates.name : item.name,
      retailPrice: newRetailPrice,
      retailPriceSecondary: updates.retailPriceSecondary !== undefined ? updates.retailPriceSecondary : item.retailPriceSecondary,
      costBasis: newCostBasis,
      costBasisSecondary: updates.costBasisSecondary !== undefined ? updates.costBasisSecondary : item.costBasisSecondary,
      category: updates.category !== undefined ? updates.category : item.category,
      brand: updates.brand !== undefined ? updates.brand : item.brand,
      sku: updates.sku !== undefined ? updates.sku : item.sku,
      stockLevel: updates.stockLevel !== undefined ? updates.stockLevel : item.stockLevel,
    };

    this.saveInventory();
    return this.inventory[idx];
  }

  public bulkAdjustPrices(categoryFilter: string, amount: number, mode: 'percentage' | 'flat'): number {
    let affectedCount = 0;
    this.inventory = this.inventory.map((item) => {
      if (categoryFilter === 'ALL' || item.category === categoryFilter) {
        affectedCount++;
        let newPrice = item.retailPrice;
        if (mode === 'percentage') {
          newPrice = item.retailPrice * (1 + amount / 100);
        } else {
          newPrice = item.retailPrice + amount;
        }
        newPrice = Math.max(0.01, Number(newPrice.toFixed(2)));

        const vendor = this.getVendorById(item.vendorId);
        let newCost = item.costBasis;
        if (vendor && vendor.supplierType === 'consignment') {
          newCost = Number((newPrice * (1 - vendor.consignmentCutRate)).toFixed(2));
        }

        return {
          ...item,
          retailPrice: newPrice,
          costBasis: newCost,
        };
      }
      return item;
    });

    if (affectedCount > 0) {
      this.saveInventory();
    }
    return affectedCount;
  }

  // --- CUSTOMER FEEDBACK & RATING REVIEWS ---
  public getFeedbackList(): CustomerFeedback[] {
    if (typeof window === 'undefined') return [];
    try {
      const fb = localStorage.getItem('island_pos_feedback_v2');
      return fb ? JSON.parse(fb) : [];
    } catch {
      return [];
    }
  }

  public addFeedback(receiptNumber: string, rating: number, category: string, comments: string): CustomerFeedback {
    const list = this.getFeedbackList();
    const newFeedback: CustomerFeedback = {
      id: `FB-${Date.now()}`,
      receiptNumber,
      rating,
      category,
      comments,
      timestamp: new Date().toISOString()
    };
    list.unshift(newFeedback);
    if (typeof window !== 'undefined') {
      localStorage.setItem('island_pos_feedback_v2', JSON.stringify(list));
    }
    return newFeedback;
  }
}

export interface CustomerFeedback {
  id: string;
  receiptNumber: string;
  rating: number; // 1-5
  category: string;
  comments: string;
  timestamp: string;
}

export const posDb = new PosDatabase();
