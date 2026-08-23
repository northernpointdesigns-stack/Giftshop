import {
  InventoryItem,
  Vendor,
  Customer,
  Transaction,
  EODSession,
  CashDrawerLog,
  StoreSettings,
  StaffUser,
  ConsignmentPayout,
} from '../types/pos';

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Seychelles Ocean Retail',
  storeAddress: 'Victoria Waterfront Plaza, Mahé, Seychelles',
  storePhone: '+248 4 225 100',
  storeEmail: 'pos@seychellesocean.com',
  taxRegistrationNumber: 'SC-VAT-90821-X',
  defaultTaxRate: 15, // Seychelles 15% VAT
  primaryCurrency: 'SCR',
  primaryCurrencySymbol: 'SR',
  secondaryCurrency: 'USD',
  secondaryCurrencySymbol: '$',
  exchangeRate: 13.50, // 1 USD = 13.50 SCR
  receiptHeaderMsg: '🌴 Welcome to Seychelles Ocean Retail 🌴',
  receiptFooterMsg: 'Mersi pour ou vizit! • Thank you for shopping with us!',
  receiptLogoUrl: '',
  enableDualCurrencyDisplay: true,
  enableSoundEffects: true,
  enableLowStockAlerts: true,
  cashierPin: '1234',
  adminPin: 'admin123',
  thermalPrinterWidth: '80mm',
};

const SEED_STAFF: StaffUser[] = [
  { id: 'staff_1', name: 'Jean-Luc Payet', role: 'admin', pin: 'admin123', active: true },
  { id: 'staff_2', name: 'Clara Hoareau', role: 'supervisor', pin: '2244', active: true },
  { id: 'staff_3', name: 'Alain Morel', role: 'cashier', pin: '1234', active: true },
  { id: 'staff_4', name: 'Nadia Savy', role: 'cashier', pin: '5566', active: true },
];

const SEED_VENDORS: Vendor[] = [
  {
    id: 'ven_1',
    name: 'Kreol Woodcrafts Ltd',
    contactPerson: 'David Vidot',
    email: 'david@kreolwoodcrafts.sc',
    phone: '+248 2 555 120',
    commissionRate: 20, // 20% store commission
    paymentTerms: 'Bi-Weekly Friday',
    payoutMethod: 'bank_transfer',
    bankDetails: 'MCB Seychelles • Acc: 00019283748',
    notes: 'Local mahogany and coconut wood hand-carved souvenirs',
    active: true,
    totalOwed: 540.0,
    totalPaid: 3200.0,
    createdAt: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'ven_2',
    name: 'Praslin Black Pearls & Jewelry',
    contactPerson: 'Sophie Michel',
    email: 'sophie@praslinpearls.sc',
    phone: '+248 2 511 890',
    commissionRate: 25, // 25% store commission
    paymentTerms: 'Net 30 Days',
    payoutMethod: 'bank_transfer',
    bankDetails: 'Nouvobanq • Acc: 998822114',
    notes: 'Authentic local black pearl necklaces, rings, and earrings',
    active: true,
    totalOwed: 1387.5,
    totalPaid: 8900.0,
    createdAt: '2026-01-15T09:30:00.000Z',
  },
  {
    id: 'ven_3',
    name: 'Vanilla Islands Spices & Oils',
    contactPerson: 'Christian Cedras',
    email: 'sales@vanillaislands.sc',
    phone: '+248 2 588 334',
    commissionRate: 15,
    paymentTerms: 'Weekly Cash',
    payoutMethod: 'cash',
    notes: 'La Digue organic vanilla pods, coconut body oils, and citronella essences',
    active: true,
    totalOwed: 220.0,
    totalPaid: 1450.0,
    createdAt: '2026-02-01T10:00:00.000Z',
  },
];

const SEED_CUSTOMERS: Customer[] = [
  {
    id: 'cust_1',
    name: 'Marcelle Dubois',
    email: 'marcelle.dubois@seychelles.net',
    phone: '+248 2 712 345',
    loyaltyPoints: 340,
    membershipTier: 'Gold',
    totalSpend: 5420.0,
    visitCount: 14,
    lastVisit: '2026-08-20T14:30:00.000Z',
    createdAt: '2026-03-01T10:00:00.000Z',
    notes: 'Frequent buyer of local craft rums and pearl jewelry.',
  },
  {
    id: 'cust_2',
    name: 'Capt. Thomas Evans',
    email: 'capt.evans@yachtcharter.com',
    phone: '+44 7700 900123',
    loyaltyPoints: 120,
    membershipTier: 'Silver',
    totalSpend: 1890.0,
    visitCount: 5,
    lastVisit: '2026-08-22T11:15:00.000Z',
    createdAt: '2026-05-12T08:00:00.000Z',
    notes: 'Charter captain, buys reef sunscreens and hats.',
  },
  {
    id: 'cust_3',
    name: 'Aurelie Larue',
    email: 'aurelie.larue@gmail.com',
    phone: '+248 2 522 998',
    loyaltyPoints: 45,
    membershipTier: 'Bronze',
    totalSpend: 620.0,
    visitCount: 2,
    lastVisit: '2026-08-21T16:45:00.000Z',
    createdAt: '2026-07-04T12:00:00.000Z',
  },
];

const SEED_INVENTORY: InventoryItem[] = [
  {
    id: 'item_1',
    sku: 'RUM-TAK-SP700',
    barcode: '6901234500012',
    name: 'Takamaka Bay Spiced Rum 700ml',
    description: 'Flagship Seychelles spiced rum blended with local vanilla and caramel notes.',
    category: 'Beverages & Spirits',
    brand: 'Takamaka Rum',
    price: 345.0, // SCR
    costPrice: 220.0,
    secondaryPrice: 25.56,
    stockLevel: 42,
    reorderPoint: 15,
    isConsignment: false,
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'item_2',
    sku: 'RUM-TAK-DK700',
    barcode: '6901234500029',
    name: 'Takamaka Dark Oak Aged Rum 700ml',
    description: 'Premium barrel-aged molasses rum with rich toasted oak aroma.',
    category: 'Beverages & Spirits',
    brand: 'Takamaka Rum',
    price: 420.0,
    costPrice: 280.0,
    secondaryPrice: 31.11,
    stockLevel: 18,
    reorderPoint: 10,
    isConsignment: false,
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'item_3',
    sku: 'BEER-SEY-CAN330',
    barcode: '6901234500036',
    name: 'SeyBrew Lager Beer 330ml Can',
    description: 'Crisp, refreshing Seychelles national pale lager.',
    category: 'Beverages & Spirits',
    brand: 'Seychelles Breweries',
    price: 45.0,
    costPrice: 28.0,
    secondaryPrice: 3.33,
    stockLevel: 140,
    reorderPoint: 48,
    isConsignment: false,
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'item_4',
    sku: 'TEA-VAN-100G',
    barcode: '6901234500043',
    name: 'Seychelles Morne Blanc Vanilla Tea 100g',
    description: 'Highland grown Ceylon black tea infused with natural Seychelles vanilla beans.',
    category: 'Local Gourmet & Tea',
    brand: 'Seychelles Tea',
    price: 95.0,
    costPrice: 50.0,
    secondaryPrice: 7.04,
    stockLevel: 56,
    reorderPoint: 20,
    isConsignment: false,
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'item_5',
    sku: 'JEW-PRAS-PEARL-ER',
    barcode: '6901234500050',
    name: 'Praslin Black Pearl Drop Earrings (925 Silver)',
    description: 'Hand-harvested natural cultured black pearl with sterling silver hooks.',
    category: 'Jewelry & Pearls',
    brand: 'Praslin Pearls',
    price: 1850.0,
    costPrice: 1200.0,
    secondaryPrice: 137.04,
    stockLevel: 6,
    reorderPoint: 4,
    isConsignment: true,
    vendorId: 'ven_2',
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'item_6',
    sku: 'JEW-PRAS-PEARL-PD',
    barcode: '6901234500067',
    name: 'Praslin Black Pearl Pendant Necklace',
    description: '10mm round black pearl on 18-inch sterling silver chain.',
    category: 'Jewelry & Pearls',
    brand: 'Praslin Pearls',
    price: 2450.0,
    costPrice: 1600.0,
    secondaryPrice: 181.48,
    stockLevel: 4,
    reorderPoint: 3,
    isConsignment: true,
    vendorId: 'ven_2',
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'item_7',
    sku: 'CRAFT-COCO-CARV-MED',
    barcode: '6901234500074',
    name: 'Coco de Mer Replica Polished Wood Carving',
    description: 'Authentic Mahé artisan hand-carved mahogany sculpture replica of Coco de Mer.',
    category: 'Handicrafts & Art',
    brand: 'Kreol Woodcrafts',
    price: 890.0,
    costPrice: 580.0,
    secondaryPrice: 65.93,
    stockLevel: 8,
    reorderPoint: 5,
    isConsignment: true,
    vendorId: 'ven_1',
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'item_8',
    sku: 'CRAFT-TORT-WOOD',
    barcode: '6901234500081',
    name: 'Aldabra Giant Tortoise Hardwood Figurine',
    description: 'Solid teak wood hand-carved tortoise with intricate shell detailing.',
    category: 'Handicrafts & Art',
    brand: 'Kreol Woodcrafts',
    price: 480.0,
    costPrice: 310.0,
    secondaryPrice: 35.56,
    stockLevel: 14,
    reorderPoint: 6,
    isConsignment: true,
    vendorId: 'ven_1',
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'item_9',
    sku: 'BEAUTY-VAN-OIL100',
    barcode: '6901234500098',
    name: 'Pure La Digue Virgin Coconut & Vanilla Body Oil 100ml',
    description: 'Cold-pressed coconut oil enriched with pure vanilla bean extracts.',
    category: 'Cosmetics & Wellness',
    brand: 'Vanilla Islands',
    price: 165.0,
    costPrice: 90.0,
    secondaryPrice: 12.22,
    stockLevel: 32,
    reorderPoint: 10,
    isConsignment: true,
    vendorId: 'ven_3',
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'item_10',
    sku: 'BEAUTY-CIT-SPRAY',
    barcode: '6901234500104',
    name: 'Organic Island Citronella & Lemongrass Mist 150ml',
    description: 'Natural DEET-free tropical insect repellent spray.',
    category: 'Cosmetics & Wellness',
    brand: 'Vanilla Islands',
    price: 135.0,
    costPrice: 75.0,
    secondaryPrice: 10.00,
    stockLevel: 28,
    reorderPoint: 12,
    isConsignment: true,
    vendorId: 'ven_3',
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'item_11',
    sku: 'SUN-REEF-50SPF',
    barcode: '6901234500111',
    name: 'Ocean Safe Mineral Sunscreen SPF 50+ 200ml',
    description: '100% Coral reef-friendly non-nano zinc oxide sunscreen, water resistant.',
    category: 'Beach & Sun Care',
    brand: 'Ocean Safe',
    price: 260.0,
    costPrice: 150.0,
    secondaryPrice: 19.26,
    stockLevel: 45,
    reorderPoint: 15,
    isConsignment: false,
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'item_12',
    sku: 'APP-SARONG-TROP',
    barcode: '6901234500128',
    name: 'Seychelles Tropical Floral Pareo / Sarong',
    description: 'Ultra-lightweight rayon beach wrap with vibrant hibiscus print.',
    category: 'Apparel & Beachwear',
    brand: 'Island Threads',
    price: 290.0,
    costPrice: 140.0,
    secondaryPrice: 21.48,
    stockLevel: 22,
    reorderPoint: 8,
    isConsignment: false,
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'item_13',
    sku: 'TOY-ALDA-PLUSH',
    barcode: '6901234500135',
    name: 'Aldabra Giant Tortoise Soft Plush Mascot 25cm',
    description: 'Super soft collectible souvenir plush tortoise for kids and collectors.',
    category: 'Toys & Souvenirs',
    brand: 'Seychelles Wildlife',
    price: 195.0,
    costPrice: 95.0,
    secondaryPrice: 14.44,
    stockLevel: 3, // Low stock on purpose
    reorderPoint: 8,
    isConsignment: false,
    taxRate: 15,
    unit: 'pcs',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
];

const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_seed_1',
    receiptNumber: 'REC-20260823-001',
    timestamp: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    items: [
      {
        itemId: 'item_1',
        sku: 'RUM-TAK-SP700',
        name: 'Takamaka Bay Spiced Rum 700ml',
        price: 345.0,
        costPrice: 220.0,
        quantity: 2,
        finalPrice: 345.0,
        isConsignment: false,
        taxRate: 15,
        brand: 'Takamaka Rum',
      },
      {
        itemId: 'item_4',
        sku: 'TEA-VAN-100G',
        name: 'Seychelles Morne Blanc Vanilla Tea 100g',
        price: 95.0,
        costPrice: 50.0,
        quantity: 1,
        finalPrice: 95.0,
        isConsignment: false,
        taxRate: 15,
        brand: 'Seychelles Tea',
      },
    ],
    subtotal: 682.61,
    discountTotal: 0,
    taxTotal: 102.39,
    total: 785.0,
    secondaryTotal: 58.15,
    exchangeRateUsed: 13.50,
    paymentMethod: 'cash',
    cashTendered: 800.0,
    changeDue: 15.0,
    cashierName: 'Alain Morel',
    customerId: 'cust_1',
    customerName: 'Marcelle Dubois',
    customerPhone: '+248 2 712 345',
    loyaltyPointsEarned: 15,
  },
  {
    id: 'tx_seed_2',
    receiptNumber: 'REC-20260823-002',
    timestamp: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    items: [
      {
        itemId: 'item_5',
        sku: 'JEW-PRAS-PEARL-ER',
        name: 'Praslin Black Pearl Drop Earrings (925 Silver)',
        price: 1850.0,
        costPrice: 1200.0,
        quantity: 1,
        finalPrice: 1850.0,
        isConsignment: true,
        vendorId: 'ven_2',
        taxRate: 15,
        brand: 'Praslin Pearls',
      },
      {
        itemId: 'item_11',
        sku: 'SUN-REEF-50SPF',
        name: 'Ocean Safe Mineral Sunscreen SPF 50+ 200ml',
        price: 260.0,
        costPrice: 150.0,
        quantity: 1,
        finalPrice: 260.0,
        isConsignment: false,
        taxRate: 15,
        brand: 'Ocean Safe',
      },
    ],
    subtotal: 1834.78,
    discountTotal: 0,
    taxTotal: 275.22,
    total: 2110.0,
    secondaryTotal: 156.30,
    exchangeRateUsed: 13.50,
    paymentMethod: 'card',
    cardAmount: 2110.0,
    cashierName: 'Alain Morel',
  },
];

class DatabaseService {
  private inventory: InventoryItem[] = [];
  private vendors: Vendor[] = [];
  private customers: Customer[] = [];
  private transactions: Transaction[] = [];
  private eodSessions: EODSession[] = [];
  private drawerLogs: CashDrawerLog[] = [];
  private settings: StoreSettings = DEFAULT_SETTINGS;
  private staffUsers: StaffUser[] = SEED_STAFF;
  private payouts: ConsignmentPayout[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const invStr = localStorage.getItem('pos_inventory');
      this.inventory = invStr ? JSON.parse(invStr) : SEED_INVENTORY;

      const venStr = localStorage.getItem('pos_vendors');
      this.vendors = venStr ? JSON.parse(venStr) : SEED_VENDORS;

      const custStr = localStorage.getItem('pos_customers');
      this.customers = custStr ? JSON.parse(custStr) : SEED_CUSTOMERS;

      const txStr = localStorage.getItem('pos_transactions');
      this.transactions = txStr ? JSON.parse(txStr) : SEED_TRANSACTIONS;

      const sessStr = localStorage.getItem('pos_eod_sessions');
      if (sessStr) {
        this.eodSessions = JSON.parse(sessStr);
      } else {
        // Create an initial open session for today
        const initialSession: EODSession = {
          id: `SES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`,
          openedAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
          openedBy: 'Alain Morel',
          cashierName: 'Alain Morel',
          status: 'open',
          startingFloat: 2000.0,
          openingFloat: 2000.0,
          cashSales: 785.0,
          totalCashSales: 785.0,
          cardSales: 2110.0,
          totalCardSales: 2110.0,
          totalSales: 2895.0,
          totalRefunds: 0,
          totalVoids: 0,
          voidCount: 0,
          totalTransactions: 2,
          paidInTotal: 0,
          paidOutTotal: 0,
          cashDropTotal: 0,
          expectedCash: 2785.0,
          actualCountedCash: 2785.0,
          cashDiscrepancy: 0,
          notes: 'Standard morning shift open float.',
        };
        this.eodSessions = [initialSession];
      }

      const logStr = localStorage.getItem('pos_drawer_logs');
      this.drawerLogs = logStr ? JSON.parse(logStr) : [
        {
          id: 'log_seed_1',
          sessionId: this.eodSessions[0]?.id,
          timestamp: this.eodSessions[0]?.openedAt || new Date().toISOString(),
          eventType: 'session_open',
          amount: 2000.0,
          staffName: 'Alain Morel',
          reason: 'Shift Open Float Counted',
          currentFloatAfter: 2000.0,
        },
        {
          id: 'log_seed_2',
          sessionId: this.eodSessions[0]?.id,
          timestamp: SEED_TRANSACTIONS[0].timestamp,
          eventType: 'cash_sale',
          amount: 785.0,
          staffName: 'Alain Morel',
          reason: 'Sale #REC-20260823-001 Cash Tendered',
          currentFloatAfter: 2785.0,
        },
      ];

      const setStr = localStorage.getItem('pos_settings');
      this.settings = setStr ? { ...DEFAULT_SETTINGS, ...JSON.parse(setStr) } : DEFAULT_SETTINGS;

      const staffStr = localStorage.getItem('pos_staff');
      this.staffUsers = staffStr ? JSON.parse(staffStr) : SEED_STAFF;

      const payoutStr = localStorage.getItem('pos_payouts');
      this.payouts = payoutStr ? JSON.parse(payoutStr) : [];
    } catch (e) {
      console.error('Error loading POS local storage:', e);
      this.resetToDefaults();
    }
  }

  // --- SAVE METHODS ---
  public saveInventory() {
    localStorage.setItem('pos_inventory', JSON.stringify(this.inventory));
  }
  public saveVendors() {
    localStorage.setItem('pos_vendors', JSON.stringify(this.vendors));
  }
  public saveCustomers() {
    localStorage.setItem('pos_customers', JSON.stringify(this.customers));
  }
  public saveTransactions() {
    localStorage.setItem('pos_transactions', JSON.stringify(this.transactions));
  }
  public saveEODSessions() {
    localStorage.setItem('pos_eod_sessions', JSON.stringify(this.eodSessions));
  }
  public saveDrawerLogs() {
    localStorage.setItem('pos_drawer_logs', JSON.stringify(this.drawerLogs));
  }
  public saveSettings(newSettings?: StoreSettings) {
    if (newSettings) {
      this.settings = { ...this.settings, ...newSettings };
    }
    localStorage.setItem('pos_settings', JSON.stringify(this.settings));
  }
  public saveStaff() {
    localStorage.setItem('pos_staff', JSON.stringify(this.staffUsers));
  }
  public savePayouts() {
    localStorage.setItem('pos_payouts', JSON.stringify(this.payouts));
  }

  // --- INVENTORY API ---
  public getInventory(): InventoryItem[] {
    return [...this.inventory];
  }

  public getItemById(id: string): InventoryItem | undefined {
    return this.inventory.find((i) => i.id === id);
  }

  public getItemByBarcodeOrSku(query: string): InventoryItem | undefined {
    const clean = query.trim().toLowerCase();
    return this.inventory.find(
      (i) => i.barcode.toLowerCase() === clean || i.sku.toLowerCase() === clean
    );
  }

  public searchInventory(query: string): InventoryItem[] {
    if (!query.trim()) return this.inventory;
    const q = query.toLowerCase().trim();
    return this.inventory.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        i.barcode.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.brand && i.brand.toLowerCase().includes(q))
    );
  }

  public addInventoryItem(item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): InventoryItem {
    const newItem: InventoryItem = {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.inventory.unshift(newItem);
    this.saveInventory();
    return newItem;
  }

  public bulkImportInventory(items: Partial<InventoryItem>[]): number {
    let count = 0;
    items.forEach((item) => {
      if (item.name && item.sku) {
        const existingIdx = this.inventory.findIndex((i) => i.sku === item.sku);
        if (existingIdx !== -1) {
          this.inventory[existingIdx] = {
            ...this.inventory[existingIdx],
            ...item,
            updatedAt: new Date().toISOString(),
          };
        } else {
          this.inventory.unshift({
            id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sku: item.sku,
            barcode: item.barcode || item.sku,
            name: item.name,
            category: item.category || 'General',
            brand: item.brand,
            price: item.price || 0,
            costPrice: item.costPrice || 0,
            secondaryPrice: item.secondaryPrice || Number(((item.price || 0) / this.settings.exchangeRate).toFixed(2)),
            stockLevel: item.stockLevel ?? 10,
            reorderPoint: item.reorderPoint ?? 5,
            isConsignment: item.isConsignment || false,
            vendorId: item.vendorId,
            taxRate: item.taxRate || 15,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        count++;
      }
    });
    this.saveInventory();
    return count;
  }

  public updateInventoryItem(id: string, updates: Partial<InventoryItem>): InventoryItem | null {
    const index = this.inventory.findIndex((i) => i.id === id);
    if (index === -1) return null;
    this.inventory[index] = {
      ...this.inventory[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveInventory();
    return this.inventory[index];
  }

  public deleteInventoryItem(id: string): boolean {
    const initialLen = this.inventory.length;
    this.inventory = this.inventory.filter((i) => i.id !== id);
    this.saveInventory();
    return this.inventory.length < initialLen;
  }

  public adjustStock(itemId: string, delta: number) {
    const item = this.getItemById(itemId);
    if (item) {
      item.stockLevel = Math.max(0, item.stockLevel + delta);
      item.updatedAt = new Date().toISOString();
      this.saveInventory();
    }
  }

  // --- VENDORS API ---
  public getVendors(): Vendor[] {
    return [...this.vendors];
  }

  public getVendorById(id: string): Vendor | undefined {
    return this.vendors.find((v) => v.id === id);
  }

  public addVendor(vendor: Omit<Vendor, 'id' | 'createdAt'>): Vendor {
    const newVendor: Vendor = {
      ...vendor,
      id: `ven_${Date.now()}`,
      totalOwed: vendor.totalOwed ?? 0,
      totalPaid: vendor.totalPaid ?? 0,
      paymentTerms: vendor.paymentTerms || 'Bi-Weekly Friday',
      createdAt: new Date().toISOString(),
    };
    this.vendors.push(newVendor);
    this.saveVendors();
    return newVendor;
  }

  public updateVendor(id: string, updates: Partial<Vendor>): Vendor | null {
    const idx = this.vendors.findIndex((v) => v.id === id);
    if (idx === -1) return null;
    this.vendors[idx] = { ...this.vendors[idx], ...updates };
    this.saveVendors();
    return this.vendors[idx];
  }

  public deleteVendor(id: string): boolean {
    this.vendors = this.vendors.filter((v) => v.id !== id);
    this.saveVendors();
    return true;
  }

  public recordVendorPayout(vendorId: string, amount: number) {
    const v = this.getVendorById(vendorId);
    if (v) {
      v.totalOwed = Math.max(0, (v.totalOwed || 0) - amount);
      v.totalPaid = (v.totalPaid || 0) + amount;
      this.saveVendors();
    }
  }

  // --- CUSTOMERS API ---
  public getCustomers(): Customer[] {
    return [...this.customers];
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.customers.find((c) => c.id === id);
  }

  public searchCustomers(query: string): Customer[] {
    if (!query.trim()) return this.customers;
    const q = query.toLowerCase().trim();
    return this.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }

  public addCustomer(cust: Omit<Customer, 'id' | 'createdAt' | 'totalSpend' | 'visitCount'>): Customer {
    const newCust: Customer = {
      ...cust,
      id: `cust_${Date.now()}`,
      totalSpend: 0,
      visitCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.customers.unshift(newCust);
    this.saveCustomers();
    return newCust;
  }

  public updateCustomer(id: string, updates: Partial<Customer>): Customer | null {
    const idx = this.customers.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.customers[idx] = { ...this.customers[idx], ...updates };
    this.saveCustomers();
    return this.customers[idx];
  }

  public getCustomerTransactions(customerIdOrPhone: string): Transaction[] {
    const cust = this.customers.find(
      (c) => c.id === customerIdOrPhone || c.phone === customerIdOrPhone
    );
    const id = cust?.id || customerIdOrPhone;
    const phone = cust?.phone;

    return this.transactions.filter(
      (tx) => tx.customerId === id || (phone && tx.customerPhone === phone)
    );
  }

  public getCustomerPurchasedProducts(customerIdOrPhone: string) {
    const txs = this.getCustomerTransactions(customerIdOrPhone);
    const purchasedList: {
      itemId: string;
      sku: string;
      name: string;
      brand?: string;
      quantity: number;
      lastPurchased: string;
    }[] = [];

    txs.forEach((tx) => {
      if (tx.isVoided) return;
      tx.items.forEach((it) => {
        purchasedList.push({
          itemId: it.itemId,
          sku: it.sku,
          name: it.name,
          brand: it.brand,
          quantity: it.quantity,
          lastPurchased: tx.timestamp,
        });
      });
    });

    return purchasedList;
  }

  public getCustomerLoyaltyInsights(customerIdOrPhone: string) {
    const txs = this.getCustomerTransactions(customerIdOrPhone);
    const validSales = txs.filter((t) => !t.isRefund && !t.isVoided);
    const totalSpend = validSales.reduce((acc, t) => acc + t.total, 0);
    const totalOrders = validSales.length;
    const avgOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0;
    return {
      totalSpend,
      totalOrders,
      avgOrderValue,
      lastVisit: txs[0]?.timestamp,
    };
  }

  // --- TRANSACTIONS API ---
  public getTransactions(): Transaction[] {
    return [...this.transactions];
  }

  public getTransactionByIdOrReceipt(idOrReceipt: string): Transaction | undefined {
    const clean = idOrReceipt.trim().toLowerCase();
    return this.transactions.find(
      (t) => t.id.toLowerCase() === clean || t.receiptNumber.toLowerCase() === clean
    );
  }

  public recordTransaction(txData: Omit<Transaction, 'id' | 'receiptNumber' | 'timestamp'>): Transaction {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = (this.transactions.length + 1).toString().padStart(4, '0');
    const receiptNumber = `REC-${dateStr}-${seq}`;

    const newTx: Transaction = {
      ...txData,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      receiptNumber,
      timestamp: today.toISOString(),
    };

    // 1. Deduct or restore inventory levels
    newTx.items.forEach((item) => {
      if (newTx.isRefund) {
        if (newTx.restocked) {
          this.adjustStock(item.itemId, Math.abs(item.quantity));
        }
      } else {
        this.adjustStock(item.itemId, -Math.abs(item.quantity));
      }
    });

    // 1b. Credit/reverse consignment vendor owed balances
    newTx.items.forEach((item) => {
      if (!item.isConsignment || !item.vendorId) return;
      const vendor = this.getVendorById(item.vendorId);
      if (!vendor) return;
      const lineTotal = item.finalPrice * item.quantity;
      const vendorShare = lineTotal * (1 - vendor.commissionRate / 100);
      if (newTx.isRefund) {
        vendor.totalOwed = Math.max(0, (vendor.totalOwed || 0) - Math.abs(vendorShare));
      } else {
        vendor.totalOwed = (vendor.totalOwed || 0) + vendorShare;
      }
    });
    this.saveVendors();

    // 2. Update Customer Profile & Loyalty
    if (newTx.customerId) {
      const cust = this.getCustomerById(newTx.customerId);
      if (cust) {
        if (!newTx.isRefund) {
          cust.visitCount = (cust.visitCount || 0) + 1;
          cust.totalSpend = (cust.totalSpend || 0) + newTx.total;
          cust.lastVisit = newTx.timestamp;
          if (newTx.loyaltyPointsEarned) {
            cust.loyaltyPoints = (cust.loyaltyPoints || 0) + newTx.loyaltyPointsEarned;
          }
          if (newTx.loyaltyPointsRedeemed) {
            cust.loyaltyPoints = Math.max(0, (cust.loyaltyPoints || 0) - newTx.loyaltyPointsRedeemed);
          }
          // Tier update
          if (cust.loyaltyPoints >= 500) cust.membershipTier = 'VIP';
          else if (cust.loyaltyPoints >= 250) cust.membershipTier = 'Gold';
          else if (cust.loyaltyPoints >= 100) cust.membershipTier = 'Silver';
        }
        this.saveCustomers();
      }
    }

    // 3. Update active EOD Session tallies
    const activeSession = this.getActiveEODSession();
    if (activeSession) {
      activeSession.totalTransactions = (activeSession.totalTransactions || 0) + 1;
      if (newTx.isRefund) {
        activeSession.totalRefunds = (activeSession.totalRefunds || 0) + Math.abs(newTx.total);
        if (newTx.paymentMethod === 'cash') {
          activeSession.cashSales = Number((activeSession.cashSales - Math.abs(newTx.total)).toFixed(2));
          activeSession.totalCashSales = activeSession.cashSales;
        } else if (newTx.paymentMethod === 'card') {
          activeSession.cardSales = Number((activeSession.cardSales - Math.abs(newTx.total)).toFixed(2));
          activeSession.totalCardSales = activeSession.cardSales;
        }
      } else {
        activeSession.totalSales = Number(((activeSession.totalSales || 0) + newTx.total).toFixed(2));
        if (newTx.paymentMethod === 'cash') {
          activeSession.cashSales = Number((activeSession.cashSales + newTx.total).toFixed(2));
          activeSession.totalCashSales = activeSession.cashSales;
        } else if (newTx.paymentMethod === 'card') {
          activeSession.cardSales = Number((activeSession.cardSales + newTx.total).toFixed(2));
          activeSession.totalCardSales = activeSession.cardSales;
        } else if (newTx.paymentMethod === 'split') {
          if (newTx.cashAmount) {
            activeSession.cashSales += newTx.cashAmount;
            activeSession.totalCashSales = activeSession.cashSales;
          }
          if (newTx.cardAmount) {
            activeSession.cardSales += newTx.cardAmount;
            activeSession.totalCardSales = activeSession.cardSales;
          }
        }
      }
      this.recalculateActiveExpectedCash(activeSession);
      this.saveEODSessions();

      // Record drawer audit log
      this.recordDrawerLog({
        sessionId: activeSession.id,
        eventType: newTx.isRefund ? 'refund' : newTx.paymentMethod === 'cash' ? 'cash_sale' : 'card_sale',
        amount: newTx.total,
        staffName: newTx.cashierName,
        reason: `${newTx.isRefund ? 'Refund' : 'Sale'} #${receiptNumber} (${newTx.paymentMethod.toUpperCase()})`,
        currentFloatAfter: activeSession.expectedCash,
      });
    }

    this.transactions.unshift(newTx);
    this.saveTransactions();
    return newTx;
  }

  // --- VOID TRANSACTION ENGINE ---
  public voidTransaction(
    transactionId: string,
    voidedBy: string,
    voidReason: string,
    authorizedBy?: string
  ): { success: boolean; error?: string; transaction?: Transaction } {
    const txIndex = this.transactions.findIndex(
      (t) => t.id === transactionId || t.receiptNumber === transactionId
    );
    if (txIndex === -1) {
      return { success: false, error: 'Transaction record not found.' };
    }

    const tx = this.transactions[txIndex];
    if (tx.isVoided) {
      return { success: false, error: 'Transaction is already voided.' };
    }

    const now = new Date().toISOString();
    const effectiveAuthorizer = authorizedBy || voidedBy;

    // 1. Mark transaction as voided
    tx.isVoided = true;
    tx.voidedAt = now;
    tx.voidedBy = voidedBy;
    tx.voidReason = voidReason;
    tx.voidAuthorizedBy = effectiveAuthorizer;

    // 2. Reverse inventory stock levels
    tx.items.forEach((item) => {
      if (tx.isRefund) {
        if (tx.restocked) {
          this.adjustStock(item.itemId, -Math.abs(item.quantity));
        }
      } else {
        this.adjustStock(item.itemId, Math.abs(item.quantity));
      }
    });

    // 2b. Reverse consignment vendor owed balances
    tx.items.forEach((item) => {
      if (!item.isConsignment || !item.vendorId) return;
      const vendor = this.getVendorById(item.vendorId);
      if (!vendor) return;
      const lineTotal = item.finalPrice * item.quantity;
      const vendorShare = lineTotal * (1 - vendor.commissionRate / 100);
      if (tx.isRefund) {
        vendor.totalOwed = (vendor.totalOwed || 0) + Math.abs(vendorShare);
      } else {
        vendor.totalOwed = Math.max(0, (vendor.totalOwed || 0) - vendorShare);
      }
    });
    this.saveVendors();

    // 3. Reverse customer loyalty points earned
    if (tx.customerId && tx.loyaltyPointsEarned && tx.loyaltyPointsEarned > 0) {
      const cust = this.getCustomerById(tx.customerId);
      if (cust) {
        cust.loyaltyPoints = Math.max(0, (cust.loyaltyPoints || 0) - tx.loyaltyPointsEarned);
        if (cust.loyaltyPoints <= 100) cust.membershipTier = 'Bronze';
        else if (cust.loyaltyPoints <= 250) cust.membershipTier = 'Silver';
        else if (cust.loyaltyPoints <= 500) cust.membershipTier = 'Gold';
        this.saveCustomers();
      }
    }

    // 4. Reverse active cash drawer / EOD Session totals
    const activeSession = this.getActiveEODSession();
    if (activeSession) {
      activeSession.totalVoids = (activeSession.totalVoids || 0) + Math.abs(tx.total);
      activeSession.voidCount = (activeSession.voidCount || 0) + 1;
      activeSession.totalSales = Number(((activeSession.totalSales || 0) - tx.total).toFixed(2));
      if (tx.paymentMethod === 'cash') {
        activeSession.cashSales = Number((activeSession.cashSales - tx.total).toFixed(2));
        activeSession.totalCashSales = activeSession.cashSales;
      } else if (tx.paymentMethod === 'card') {
        activeSession.cardSales = Number((activeSession.cardSales - tx.total).toFixed(2));
        activeSession.totalCardSales = activeSession.cardSales;
      }
      this.recalculateActiveExpectedCash(activeSession);
      this.saveEODSessions();

      // Record drawer audit log for the void
      this.recordDrawerLog({
        sessionId: activeSession.id,
        eventType: 'void_sale',
        amount: Math.abs(tx.total),
        staffName: voidedBy,
        reason: `Voided #${tx.receiptNumber} (${tx.paymentMethod.toUpperCase()} ${tx.total >= 0 ? '-' : '+'}$${Math.abs(tx.total).toFixed(2)}): ${voidReason} (Auth: ${effectiveAuthorizer})`,
        currentFloatAfter: activeSession.expectedCash,
      });
    } else {
      this.recordDrawerLog({
        eventType: 'void_sale',
        amount: Math.abs(tx.total),
        staffName: voidedBy,
        reason: `Voided #${tx.receiptNumber} (${tx.paymentMethod.toUpperCase()} $${Math.abs(tx.total).toFixed(2)}): ${voidReason} (Auth: ${effectiveAuthorizer})`,
      });
    }

    this.saveTransactions();
    return { success: true, transaction: tx };
  }

  // --- EOD SESSIONS & CASH DRAWER AUDIT LOGS ---
  public getActiveEODSession(): EODSession | undefined {
    return this.eodSessions.find((s) => s.status === 'open');
  }

  public getEODSessions(): EODSession[] {
    return [...this.eodSessions];
  }

  public getDrawerLogs(sessionId?: string): CashDrawerLog[] {
    if (sessionId) {
      return this.drawerLogs.filter((l) => l.sessionId === sessionId);
    }
    return [...this.drawerLogs];
  }

  private recalculateActiveExpectedCash(session: EODSession) {
    session.expectedCash = Number(
      (
        session.startingFloat +
        session.cashSales +
        session.paidInTotal -
        session.paidOutTotal -
        session.cashDropTotal
      ).toFixed(2)
    );
  }

  public startEODSession(cashierName: string, openingFloat: number, notes?: string): EODSession {
    return this.openEODSession(cashierName, openingFloat, notes);
  }

  public openEODSession(staffName: string, startingFloat: number, notes?: string): EODSession {
    const existing = this.getActiveEODSession();
    if (existing) {
      throw new Error('A register shift is already currently open. Close it first.');
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sessionCountToday = this.eodSessions.filter((s) => s.openedAt.startsWith(new Date().toISOString().slice(0, 10))).length + 1;
    const newSession: EODSession = {
      id: `SES-${todayStr}-${sessionCountToday.toString().padStart(2, '0')}`,
      openedAt: new Date().toISOString(),
      openedBy: staffName,
      cashierName: staffName,
      status: 'open',
      startingFloat,
      openingFloat: startingFloat,
      cashSales: 0,
      totalCashSales: 0,
      cardSales: 0,
      totalCardSales: 0,
      totalSales: 0,
      totalRefunds: 0,
      totalVoids: 0,
      voidCount: 0,
      totalTransactions: 0,
      paidInTotal: 0,
      paidOutTotal: 0,
      cashDropTotal: 0,
      expectedCash: startingFloat,
      actualCountedCash: startingFloat,
      cashDiscrepancy: 0,
      notes,
    };

    this.eodSessions.unshift(newSession);
    this.saveEODSessions();

    this.recordDrawerLog({
      sessionId: newSession.id,
      eventType: 'session_open',
      amount: startingFloat,
      staffName,
      reason: `Shift Opened with Float: ${startingFloat.toFixed(2)} SCR`,
      currentFloatAfter: startingFloat,
    });

    return newSession;
  }

  public closeEODSession(
    sessionId: string,
    actualCash: number,
    notes?: string,
    closedBy?: string,
    denominationCounts?: Record<string, number>
  ): EODSession {
    const session = this.eodSessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found.');

    const closer = closedBy || session.cashierName || session.openedBy;
    session.status = 'closed';
    session.closedAt = new Date().toISOString();
    session.closedBy = closer;
    session.actualCash = actualCash;
    session.actualCountedCash = actualCash;
    session.cashVariance = Number((actualCash - session.expectedCash).toFixed(2));
    session.cashDiscrepancy = session.cashVariance;
    session.notes = notes ? `${session.notes || ''} | ${notes}` : session.notes;
    session.denominationCounts = denominationCounts;

    this.saveEODSessions();

    this.recordDrawerLog({
      sessionId: session.id,
      eventType: 'session_close',
      amount: actualCash,
      staffName: closer,
      reason: `Shift Closed. Expected: ${session.expectedCash.toFixed(2)}, Counted: ${actualCash.toFixed(2)} (Variance: ${session.cashVariance >= 0 ? '+' : ''}${session.cashVariance.toFixed(2)})`,
      currentFloatAfter: actualCash,
    });

    return session;
  }

  public recordDrawerAdjustment(
    type: 'paid_in' | 'paid_out' | 'cash_drop' | 'manual_open',
    amount: number,
    staffName: string,
    reason: string
  ) {
    const active = this.getActiveEODSession();
    if (active) {
      if (type === 'paid_in') active.paidInTotal += amount;
      if (type === 'paid_out') active.paidOutTotal += amount;
      if (type === 'cash_drop') active.cashDropTotal += amount;

      this.recalculateActiveExpectedCash(active);
      this.saveEODSessions();
    }

    this.recordDrawerLog({
      sessionId: active?.id,
      eventType: type,
      amount,
      staffName,
      reason,
      currentFloatAfter: active?.expectedCash,
    });
  }

  public recordDrawerLog(log: Omit<CashDrawerLog, 'id' | 'timestamp'>): CashDrawerLog {
    const newLog: CashDrawerLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
    };
    this.drawerLogs.unshift(newLog);
    this.saveDrawerLogs();
    return newLog;
  }

  // --- SETTINGS & STAFF ---
  public getSettings(): StoreSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<StoreSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  public getActiveCashiers(): StaffUser[] {
    return this.staffUsers.filter((s) => s.active);
  }

  public getStaffUsers(): StaffUser[] {
    return [...this.staffUsers];
  }

  public addStaffUser(user: Omit<StaffUser, 'id'>): StaffUser {
    const newStaff: StaffUser = {
      ...user,
      id: `staff_${Date.now()}`,
    };
    this.staffUsers.push(newStaff);
    this.saveStaff();
    return newStaff;
  }

  public updateStaffUser(id: string, updates: Partial<StaffUser>) {
    const idx = this.staffUsers.findIndex((s) => s.id === id);
    if (idx !== -1) {
      this.staffUsers[idx] = { ...this.staffUsers[idx], ...updates };
      this.saveStaff();
    }
  }

  public deleteStaffUser(id: string) {
    this.staffUsers = this.staffUsers.filter((s) => s.id !== id);
    this.saveStaff();
  }

  // --- CONSIGNMENT SUMMARY ---
  public getConsignmentSummary() {
    let totalSales = 0;
    let totalCommission = 0;
    let totalOwed = 0;

    this.vendors.forEach((v) => {
      totalOwed += v.totalOwed || 0;
    });

    this.transactions.forEach((tx) => {
      if (tx.isVoided) return;
      tx.items.forEach((it) => {
        if (it.isConsignment) {
          const line = it.finalPrice * it.quantity;
          totalSales += line;
          const vendor = this.vendors.find((v) => v.id === it.vendorId);
          const rate = vendor ? vendor.commissionRate : 20;
          totalCommission += line * (rate / 100);
        }
      });
    });

    return {
      totalSales,
      totalCommission,
      totalOwed,
    };
  }

  public getConsignmentSummaryByVendor(vendorId?: string) {
    const vendors = vendorId ? this.vendors.filter((v) => v.id === vendorId) : this.vendors;

    return vendors.map((vendor) => {
      let totalUnitsSold = 0;
      let grossSales = 0;
      let vendorEarnings = 0;
      let houseCommission = 0;

      this.transactions.forEach((tx) => {
        if (tx.isVoided) return;
        tx.items.forEach((item) => {
          if (item.vendorId === vendor.id) {
            totalUnitsSold += item.quantity;
            const lineTotal = item.finalPrice * item.quantity;
            grossSales += lineTotal;
            const commCut = lineTotal * (vendor.commissionRate / 100);
            houseCommission += commCut;
            vendorEarnings += lineTotal - commCut;
          }
        });
      });

      return {
        vendor,
        totalUnitsSold,
        grossSales,
        vendorEarnings,
        houseCommission,
        commissionRate: vendor.commissionRate,
      };
    });
  }

  public getConsignmentItemsSold(vendorId: string) {
    const soldItems: {
      receiptNumber: string;
      timestamp: string;
      itemId: string;
      name: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      total: number;
      vendorShare: number;
      storeCommission: number;
    }[] = [];

    const vendor = this.getVendorById(vendorId);
    const commRate = vendor ? vendor.commissionRate : 20;

    this.transactions.forEach((tx) => {
      if (tx.isVoided) return;
      tx.items.forEach((item) => {
        if (item.vendorId === vendorId) {
          const total = item.finalPrice * item.quantity;
          const comm = total * (commRate / 100);
          soldItems.push({
            receiptNumber: tx.receiptNumber,
            timestamp: tx.timestamp,
            itemId: item.itemId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.finalPrice,
            total,
            vendorShare: total - comm,
            storeCommission: comm,
          });
        }
      });
    });

    return soldItems;
  }

  public getConsignmentPayouts(): ConsignmentPayout[] {
    return [...this.payouts];
  }

  public recordConsignmentPayout(payout: Omit<ConsignmentPayout, 'id' | 'generatedAt'>): ConsignmentPayout {
    const newPayout: ConsignmentPayout = {
      ...payout,
      id: `PAY-${Date.now()}`,
      generatedAt: new Date().toISOString(),
    };
    this.payouts.unshift(newPayout);
    this.savePayouts();
    return newPayout;
  }

  public updatePayoutStatus(id: string, status: 'approved' | 'paid', paymentRef?: string) {
    const p = this.payouts.find((item) => item.id === id);
    if (p) {
      p.status = status;
      if (status === 'paid') {
        p.paidAt = new Date().toISOString();
        p.paymentReference = paymentRef;
      }
      this.savePayouts();
    }
  }

  // --- DATABASE RESET / FACTORY RESTORE ---
  public resetToDefaults() {
    this.inventory = SEED_INVENTORY;
    this.vendors = SEED_VENDORS;
    this.customers = SEED_CUSTOMERS;
    this.transactions = SEED_TRANSACTIONS;
    this.settings = DEFAULT_SETTINGS;
    this.staffUsers = SEED_STAFF;
    this.payouts = [];

    const initialSession: EODSession = {
      id: `SES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`,
      openedAt: new Date().toISOString(),
      openedBy: 'Alain Morel',
      cashierName: 'Alain Morel',
      status: 'open',
      startingFloat: 2000.0,
      openingFloat: 2000.0,
      cashSales: 785.0,
      totalCashSales: 785.0,
      cardSales: 2110.0,
      totalCardSales: 2110.0,
      totalSales: 2895.0,
      totalRefunds: 0,
      totalVoids: 0,
      voidCount: 0,
      totalTransactions: 2,
      paidInTotal: 0,
      paidOutTotal: 0,
      cashDropTotal: 0,
      expectedCash: 2785.0,
      actualCountedCash: 2785.0,
      cashDiscrepancy: 0,
      notes: 'Initial seed register float',
    };
    this.eodSessions = [initialSession];
    this.drawerLogs = [
      {
        id: 'log_seed_1',
        sessionId: initialSession.id,
        timestamp: initialSession.openedAt,
        eventType: 'session_open',
        amount: 2000.0,
        staffName: 'Alain Morel',
        reason: 'Shift Open Float Counted',
        currentFloatAfter: 2000.0,
      },
    ];

    this.saveInventory();
    this.saveVendors();
    this.saveCustomers();
    this.saveTransactions();
    this.saveEODSessions();
    this.saveDrawerLogs();
    this.saveSettings();
    this.saveStaff();
    this.savePayouts();
  }
}

export const posDb = new DatabaseService();
