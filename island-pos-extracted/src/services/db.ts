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
  VendorAdvance,
  Invoice,
  SplitPaymentLine,
  PriceList,
  CashRegisterTerminal,
} from '../types/pos';
import { ParsedCsvRow } from './csvParser';
import { generateSQLiteDatabaseDump, extractSqliteManifest } from '../utils/sqliteExport';
import { scheduledBackupService } from './scheduledBackupService';
import { offlineSyncEngine } from './offlineSyncEngine';
import { DEFAULT_BARCODE_RULES } from '../utils/barcodeEngine';
import { calculateCartTotals, computeVatAmount, roundMoney } from '../utils/currencyAndMath';
import { priceTierSyncService } from './priceTierSyncService';

const DEFAULT_PRICE_LISTS: PriceList[] = [
  { id: 'retail', name: 'Standard Retail Price', type: 'retail', isDefault: true, description: 'Default retail pricing for walk-in customers' },
  { id: 'wholesale', name: 'Wholesale B2B Tier', type: 'wholesale', discountPercentage: 25, description: '25% wholesale discount for registered trade partners' },
  { id: 'vip', name: 'VIP & Staff Price', type: 'vip', discountPercentage: 15, description: '15% special discount for VIP members and staff' },
];

const DEFAULT_REGISTERS: CashRegisterTerminal[] = [
  { id: 'REG-1', name: 'Main Retail Counter #1', location: 'Front Store', defaultPriceListId: 'retail', mode: 'retail', isOnline: true },
  { id: 'REG-2', name: 'Wholesale & Trade Desk #2', location: 'Warehouse / B2B', defaultPriceListId: 'wholesale', mode: 'wholesale', isOnline: true },
];

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
  ADVANCES: 'island_pos_advances_v2',
  INVOICES: 'island_pos_invoices_v2',
};

const DEFAULT_CUSTOMERS: Customer[] = [];

const DEFAULT_DRAWER_LOGS: CashDrawerLog[] = [];

export const DEFAULT_SETTINGS: StoreSettings = {
  defaultVatRate: 0.15, // 15% VAT
  vatInclusive: false, // false = VAT added at checkout; true = price tags already include VAT
  storeName: 'The Gift Shop',
  posAppName: 'The Gift Shop POS',
  posShortName: 'TGS',
  posVersion: 'v2.4.1',
  removeIslandBranding: true,
  taxRegistrationNumber: '',
  shopLogoUrl: '',
  receiptLogoUrl: '',
  adminUsername: 'admin',
  adminPin: 'admin123',
  primaryCurrency: 'USD',
  primaryCurrencySymbol: '$',
  secondaryCurrency: 'EUR',
  secondaryCurrencySymbol: '€',
  exchangeRate: 0, // neutral until the shop enters today's rate (prompted at register open)
  exchangeRateUpdatedAt: '',
  allowPaymentInSecondary: true,
  defaultCurrencyMode: 'primary',
  customCatalogTemplates: [
    {
      id: 'tmpl-1',
      name: 'GiftShop Best Sellers Catalog',
      description: 'Beach heritage tees, mugs & souvenir apparel catalog template',
      badgeColor: 'emerald',
      filename: 'GiftShop_Best_Sellers_Catalog.csv',
      csvContent: `Brand,Item Name,Group Category,Product Line,Size Target,Barcode SKU,Retail Price,Cost Basis,Stock Qty,VAT Rate %
GiftShop,GiftShop T-Shirt - Turtle Cove,T-Shirts,Beach Heritage,Adults - Medium,893100101,25.00,12.50,30,15%
GiftShop,GiftShop T-Shirt - Turtle Cove,T-Shirts,Beach Heritage,Women - Small,893100102,25.00,12.50,22,15%
GiftShop,GiftShop T-Shirt - Turtle Cove,T-Shirts,Beach Heritage,Kids - Large,893100103,18.00,9.00,15,15%
GiftShop,GiftShop T-Shirt - Anse Source d'Argent,T-Shirts,Island Paradise,Adults - Large,893100104,28.00,14.00,25,15%
GiftShop,GiftShop Ceramic Mug - Gold Rim,Mugs,Luxury Line,12oz Gold,893100201,18.00,8.00,24,15%
GiftShop,GiftShop Ceramic Mug - Standard Line,Mugs,Normal Line,11oz Ceramic,893100202,12.00,5.00,40,15%`,
    },
    {
      id: 'tmpl-2',
      name: 'Souvenir Boutique & Crafts Catalog',
      description: 'Handcrafted bags, classic tees, and artisan shell souvenirs',
      badgeColor: 'blue',
      filename: 'Souvenir_Boutique_Crafts_Catalog.csv',
      csvContent: `Brand,Item Name,Group Category,Product Line,Size Target,Barcode SKU,Retail Price,Cost Basis,Stock Qty,VAT Rate %
Souvenir Boutique,Souvenir Canvas Tote Bag,Bags,Boutique Accessories,One Size,893200101,22.00,10.00,18,15%
Souvenir Boutique,Souvenir Woven Straw Beach Bag,Bags,Luxury Beachwear,One Size,893200102,34.00,16.00,12,15%
Souvenir Boutique,Souvenir Unisex Cotton T-Shirt - Tropical Palm,T-Shirts,Boutique Classics,Adults - Large,893200103,20.00,10.00,28,15%
Souvenir Boutique,Souvenir Handcrafted Shell Keychain,Accessories,Local Souvenirs,One Size,893200104,8.50,3.50,50,15%`,
    },
  ],
  // Customer Display reference currencies (up to 2 extra)
  customerDisplayCurrencies: [
    { code: 'EUR', symbol: '€', rate: 14.60, enabled: true },
    { code: 'GBP', symbol: '£', rate: 17.20, enabled: true },
  ],
  cashierAccess: {
    pos: true,
    inventory: true,
    inventory_view: true,
    inventory_edit: true, // Staff can add/edit inventory by default
    reports: false,
    reports_eod: true,
    reports_pnl: false,
    reports_history: false,
    reports_forecasting: false,
    reports_heatmap: false,
    vendors: false,
    payouts: false,
    invoices: false,
    settings: false,
    staff: false,
    discounts: true,
    refunds: false,
    damaged_markdowns: true,
    manual_drawer_open: false,
    eod_close: true, // Every staff member can run End-of-Day close shop by default
  },
  enableAutoUpdateCheck: true,
  updateConfigUrl: '/version.json',
  requireBackupOnDayClose: true,
  enableAutoBackup: true,
  autoBackupTime: '20:00',
  autoBackupToBrowserStorage: true,
  autoDownloadDbOnDayClose: true,
  autoBackupFormat: 'both',
  autoBackupRetentionDays: 30,
  receiptHeaderSubtitle: '',
  receiptHeaderLines: [
    
    
  ],
  receiptFooterMessage: 'Thank you for your visit!',
  receiptFooterPolicy: 'Returns & exchanges accepted within 14 days with valid sales receipt.',
  receiptFooterLines: [
    
    
  ],
  enableBarcodeRuleEngine: true,
  barcodeRules: DEFAULT_BARCODE_RULES,
  priceLists: DEFAULT_PRICE_LISTS,
  registers: DEFAULT_REGISTERS,
  activeRegisterId: 'REG-1',
  activePriceListId: 'retail',
  inactivityTimeoutMinutes: 15,
  enableInternetFeatures: true,
  enableDigitalReceipts: true,
  smtpHost: 'smtp.mailtrap.io',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  smtpSenderEmail: 'receipts@myboutique.com',
  smtpSecure: false,
  whatsappWebhookUrl: 'https://graph.facebook.com/v17.0/102938475625/messages',
  whatsappAccessToken: '',
  whatsappPhoneNumberId: '102938475625',
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
    id: 'STAFF-CYNTHIA',
    name: 'Cynthia (Head Cashier)',
    username: 'cynthia',
    pin: '8888',
    role: 'senior_cashier',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'STAFF-MAYA',
    name: 'Maya Cashier',
    username: 'maya',
    pin: '1234',
    role: 'cashier',
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

// Default Vendors - created by the shop admin (no fake data)
const DEFAULT_VENDORS: Vendor[] = [];

// Inventory starts empty - real products are added by the admin
const DEFAULT_INVENTORY: InventoryItem[] = [];

// Helper to generate seed historical transactions for analytics

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
  private vendorAdvances: VendorAdvance[] = [];
  private invoices: Invoice[] = [];
  // Bulk catalog imports may create thousands of items. Defer persistence
  // until the complete batch is in memory rather than serializing the entire
  // catalog for every imported row.
  private isBulkImporting = false;

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
      const adv = localStorage.getItem(STORAGE_KEYS.ADVANCES);
      const inv = localStorage.getItem(STORAGE_KEYS.INVOICES);

      this.vendors = v ? JSON.parse(v) : DEFAULT_VENDORS;
      this.inventory = i ? JSON.parse(i) : DEFAULT_INVENTORY;
      this.payouts = p ? JSON.parse(p) : [];
      this.settings = s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS;
      this.staffUsers = st ? JSON.parse(st) : DEFAULT_STAFF;
      this.categories = ct ? JSON.parse(ct) : DEFAULT_CATEGORIES;
      this.drawerLogs = dl ? JSON.parse(dl) : DEFAULT_DRAWER_LOGS;
      this.customers = cust ? JSON.parse(cust) : DEFAULT_CUSTOMERS;
      this.vendorAdvances = adv ? JSON.parse(adv) : [];
      this.invoices = inv ? JSON.parse(inv) : [];

      this.eodSessions = e ? JSON.parse(e) : [];

      if (t) {
        this.transactions = JSON.parse(t);
      } else {
        this.transactions = [];
        this.saveTransactions();
      }

      // Ensure Admin credentials between Settings and Staff accounts stay in sync
      const adminStaff = this.staffUsers.find((u) => u.role === 'admin' || u.id === 'STAFF-ADMIN');
      let settingsChanged = false;
      let staffChanged = false;

      if (adminStaff) {
        if (this.settings.adminPin && this.settings.adminPin !== adminStaff.pin) {
          adminStaff.pin = this.settings.adminPin;
          staffChanged = true;
        } else if (adminStaff.pin && adminStaff.pin !== 'admin123' && (!this.settings.adminPin || this.settings.adminPin === 'admin123')) {
          this.settings.adminPin = adminStaff.pin;
          this.settings.onboardingCompleted = true;
          settingsChanged = true;
        }

        if (this.settings.adminUsername && this.settings.adminUsername !== adminStaff.username) {
          adminStaff.username = this.settings.adminUsername;
          staffChanged = true;
        } else if (adminStaff.username && adminStaff.username !== 'admin' && (!this.settings.adminUsername || this.settings.adminUsername === 'admin')) {
          this.settings.adminUsername = adminStaff.username;
          settingsChanged = true;
        }
      } else {
        this.staffUsers.unshift({
          id: 'STAFF-ADMIN',
          name: 'Main Administrator',
          username: this.settings.adminUsername || 'admin',
          pin: this.settings.adminPin || 'admin123',
          role: 'admin',
          status: 'active',
          createdAt: new Date().toISOString(),
        });
        staffChanged = true;
      }

      if (!this.staffUsers.some((u) => u.username === 'cynthia' || u.id === 'STAFF-CYNTHIA')) {
        this.staffUsers.push({
          id: 'STAFF-CYNTHIA',
          name: 'Cynthia (Head Cashier)',
          username: 'cynthia',
          pin: '8888',
          role: 'senior_cashier',
          status: 'active',
          createdAt: new Date().toISOString(),
        });
        staffChanged = true;
      }

      if (!this.staffUsers.some((u) => u.username === 'maya' || u.id === 'STAFF-MAYA')) {
        this.staffUsers.push({
          id: 'STAFF-MAYA',
          name: 'Maya Cashier',
          username: 'maya',
          pin: '1234',
          role: 'cashier',
          status: 'active',
          createdAt: new Date().toISOString(),
        });
        staffChanged = true;
      }

      if (!v) this.saveVendors();
      if (!i) this.saveInventory();
      if (!e) this.saveEODSessions();
      if (!s || settingsChanged) this.saveSettings();
      if (!st || staffChanged) this.saveStaff();
      if (!ct) this.saveCategories();
      if (!dl) this.saveDrawerLogs();
      if (!cust) this.saveCustomers();
    } catch {
      this.vendors = DEFAULT_VENDORS;
      this.inventory = DEFAULT_INVENTORY;
      this.transactions = [];
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
    if (this.isBulkImporting) return;
    localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(this.vendors));
  }

  private saveInventory() {
    if (this.isBulkImporting) return;
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(this.inventory));
  }

  /**
   * Collision-resistant unique ID generator.
   * FIX: previous generators (e.g. ITEM-<random 100-900>) had only a few
   * hundred possible values, so bulk-importing 1,000+ items created
   * duplicate IDs — which silently corrupted stock deduction and vendor
   * payout tracking. Timestamp + 8 random hex chars makes collisions
   * practically impossible.
   */
  private generateId(prefix: string): string {
    let rand: string;
    try {
      rand = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
        : Math.random().toString(36).slice(2, 10).toUpperCase();
    } catch {
      rand = Math.random().toString(36).slice(2, 10).toUpperCase();
    }
    return `${prefix}-${Date.now().toString(36).toUpperCase()}${rand}`;
  }

  public saveBulkInventory(items: InventoryItem[]) {
    this.inventory = items;
    this.saveInventory();
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
    this.transactions = [];
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

  // --- VENDOR ADVANCES (partial payments against consignment balance) ---
  public getVendorAdvances(vendorId?: string): VendorAdvance[] {
    let list = [...this.vendorAdvances];
    if (vendorId) list = list.filter((a) => a.vendorId === vendorId);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }

  public recordVendorAdvance(advance: Omit<VendorAdvance, 'id' | 'date'>): VendorAdvance {
    const newAdvance: VendorAdvance = {
      ...advance,
      id: this.generateId('ADV'),
      date: new Date().toISOString(),
    };
    this.vendorAdvances.unshift(newAdvance);
    localStorage.setItem(STORAGE_KEYS.ADVANCES, JSON.stringify(this.vendorAdvances));
    // An advance is cash leaving the business as well as a deduction from the
    // vendor's future settlement. Keep the drawer/EOD audit trail in step.
    this.recordCashAdjustment(
      'paid_out',
      newAdvance.amount,
      newAdvance.recordedBy,
      `Vendor advance to ${newAdvance.vendorName}: ${newAdvance.note || 'Advance against consignment balance'}`
    );
    return newAdvance;
  }

  // --- INVOICES (hotel / wholesale orders) ---
  public getInvoices(): Invoice[] {
    return [...this.invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public saveInvoice(invoice: Invoice): Invoice {
    const idx = this.invoices.findIndex((i) => i.id === invoice.id);
    if (idx >= 0) {
      this.invoices[idx] = invoice;
    } else {
      this.invoices.unshift(invoice);
    }
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(this.invoices));
    return invoice;
  }

  public deleteInvoice(id: string): void {
    this.invoices = this.invoices.filter((i) => i.id !== id);
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(this.invoices));
  }

  public nextInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const count = this.invoices.filter((i) => i.invoiceNumber.includes(String(year))).length + 1;
    return `INV-${year}-${String(count).padStart(4, '0')}`;
  }

  // --- BACKUP / RESTORE (full data export for USB stick or file) ---
  public exportBackup(): string {
    return JSON.stringify(
      {
        app: 'The Gift Shop POS',
        exportedAt: new Date().toISOString(),
        vendors: this.vendors,
        inventory: this.inventory,
        transactions: this.transactions,
        payouts: this.payouts,
        eodSessions: this.eodSessions,
        settings: this.settings,
        staff: this.staffUsers,
        categories: this.categories,
        drawerLogs: this.drawerLogs,
        customers: this.customers,
        vendorAdvances: this.vendorAdvances,
        invoices: this.invoices,
        feedback: this.getFeedbackList(),
      },
      null,
      2
    );
  }

  public exportSQLiteDump(): string {
    return generateSQLiteDatabaseDump({
      vendors: this.vendors,
      inventory: this.inventory,
      transactions: this.transactions,
      payouts: this.payouts,
      eodSessions: this.eodSessions,
      settings: this.settings,
      staff: this.staffUsers,
      categories: this.categories,
      drawerLogs: this.drawerLogs,
      customers: this.customers,
      vendorAdvances: this.vendorAdvances,
      invoices: this.invoices,
      feedback: this.getFeedbackList(),
      exportedAt: new Date().toISOString(),
    });
  }

  public importBackup(content: string): { ok: boolean; error?: string } {
    try {
      const trimmed = content.trim();

      // Check for binary SQLite database header
      if (trimmed.startsWith('SQLite format 3') || content.includes('\u0001\u0002')) {
        return {
          ok: false,
          error: 'Binary SQLite .db files cannot be parsed directly in browser storage. Please upload your JSON backup file or use the quick currency selector above.',
        };
      }

      // This app's own .db/.sql dumps carry a lossless JSON manifest, so a file
      // produced at till close (or a manual SQLite export) restores in full —
      // not just the settings columns.
      const manifest = extractSqliteManifest(trimmed);
      if (manifest) {
        return this.applyFullBackup(manifest);
      }

      // Try parsing as JSON
      let data: any = null;
      try {
        data = JSON.parse(content);
      } catch (jsonErr) {
        // If not valid JSON, check if it's a legacy SQL text dump
        if (trimmed.includes('INSERT INTO') || trimmed.includes('store_settings')) {
          const settingsUpdates: Record<string, any> = {};
          const settingRegex = /INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+store_settings\s*\([^)]*\)\s*VALUES\s*\(\s*'([^']+)'\s*,\s*('[^']*'|[\d.-]+|NULL)\s*,/gi;
          let match;
          while ((match = settingRegex.exec(content)) !== null) {
            const key = match[1];
            let val: any = match[2];
            if (val && val.startsWith("'") && val.endsWith("'")) {
              val = val.slice(1, -1).replace(/''/g, "'");
              try {
                if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
                  val = JSON.parse(val);
                }
              } catch {
                // keep as string
              }
            } else if (val === 'NULL') {
              val = null;
            } else if (!isNaN(Number(val))) {
              val = Number(val);
            }
            settingsUpdates[key] = val;
          }

          if (Object.keys(settingsUpdates).length > 0) {
            this.settings = { ...this.settings, ...settingsUpdates };
            this.saveSettings();
            return { ok: true };
          }
        }
        return { ok: false, error: 'Invalid JSON format. Please ensure you are uploading a valid JSON backup file.' };
      }

      if (!data || typeof data !== 'object') {
        return { ok: false, error: 'Invalid backup file format: root must be an object.' };
      }

      // If it's a settings-only or partial backup object
      if (data.primaryCurrency || data.primaryCurrencySymbol || data.storeName || data.exchangeRate) {
        this.settings = { ...this.settings, ...data };
        this.saveSettings();
        return { ok: true };
      }

      return this.applyFullBackup(data);
    } catch (err: any) {
      return { ok: false, error: `Failed to import backup: ${err.message || String(err)}` };
    }
  }

  /**
   * Restores every dataset from a full backup payload (JSON backup, or the
   * lossless manifest embedded in this app's SQLite dump).
   */
  private applyFullBackup(data: { [key: string]: any; settings?: any }): { ok: boolean; error?: string } {
    try {
      if (Array.isArray(data.vendors)) this.vendors = data.vendors;
      if (Array.isArray(data.inventory)) this.inventory = data.inventory;
      if (Array.isArray(data.transactions)) this.transactions = data.transactions;
      if (Array.isArray(data.payouts)) this.payouts = data.payouts;
      if (Array.isArray(data.eodSessions)) this.eodSessions = data.eodSessions;
      if (data.settings && typeof data.settings === 'object') {
        this.settings = { ...this.settings, ...data.settings };
      }
      if (Array.isArray(data.staff)) this.staffUsers = data.staff;
      if (Array.isArray(data.categories)) this.categories = data.categories;
      if (Array.isArray(data.drawerLogs)) this.drawerLogs = data.drawerLogs;
      if (Array.isArray(data.customers)) this.customers = data.customers;
      if (Array.isArray(data.vendorAdvances)) this.vendorAdvances = data.vendorAdvances;
      if (Array.isArray(data.invoices)) this.invoices = data.invoices;
      // Restore customer feedback logs (exported in exportBackup but previously skipped on import)
      if (Array.isArray(data.feedback)) {
        try {
          localStorage.setItem('island_pos_feedback_v2', JSON.stringify(data.feedback));
        } catch (fbErr) {
          console.warn('Failed to restore feedback logs:', fbErr);
        }
      }

      this.saveVendors();
      this.saveInventory();
      this.saveTransactions();
      this.savePayouts();
      this.saveEODSessions();
      this.saveSettings();
      this.saveStaff();
      this.saveCategories();
      this.saveDrawerLogs();
      this.saveCustomers();
      if (data.vendorAdvances) localStorage.setItem(STORAGE_KEYS.ADVANCES, JSON.stringify(this.vendorAdvances));
      if (data.invoices) localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(this.invoices));

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: `Failed to import backup: ${err.message || String(err)}` };
    }
  }

  public markBackupDone(): void {
    this.settings.lastBackupAt = new Date().toISOString();
    this.saveSettings();
  }

  // --- SETTINGS & VAT ---
  public getSettings(): StoreSettings {
    return {
      ...DEFAULT_SETTINGS,
      ...this.settings,
      // Deep-merge permission flags so any key missing from an older saved
      // config automatically falls back to the default (e.g. eod_close: true).
      cashierAccess: {
        ...DEFAULT_SETTINGS.cashierAccess,
        ...(this.settings.cashierAccess || {}),
      },
    };
  }

  private syncAdminStaffUser(pin?: string, username?: string) {
    const targetPin = pin || this.settings.adminPin || 'admin123';
    const targetUsername = username || this.settings.adminUsername || 'admin';

    let adminUser = this.staffUsers.find((u) => u.role === 'admin' || u.id === 'STAFF-ADMIN');
    if (adminUser) {
      let changed = false;
      if (adminUser.pin !== targetPin) {
        adminUser.pin = targetPin;
        changed = true;
      }
      if (adminUser.username !== targetUsername) {
        adminUser.username = targetUsername;
        changed = true;
      }
      if (changed) {
        this.saveStaff();
      }
    } else {
      this.staffUsers.unshift({
        id: 'STAFF-ADMIN',
        name: 'Main Administrator',
        username: targetUsername,
        pin: targetPin,
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      this.saveStaff();
    }
  }

  public updateSettings(newSettings: Partial<StoreSettings>) {
    if (newSettings.adminPin && newSettings.adminPin !== 'admin123') {
      newSettings.onboardingCompleted = true;
    }
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();

    if (newSettings.adminPin !== undefined || newSettings.adminUsername !== undefined) {
      this.syncAdminStaffUser(newSettings.adminPin, newSettings.adminUsername);
    }

    if (newSettings.priceLists) {
      priceTierSyncService.syncBackground(newSettings.priceLists, 'admin_settings');
    }
  }

  public completeOnboarding(params: {
    newAdminPin?: string;
    newAdminUsername?: string;
    storeName?: string;
  }): { settings: StoreSettings; adminUser: StaffUser } {
    const updates: Partial<StoreSettings> = {
      onboardingCompleted: true,
    };
    if (params.storeName && params.storeName.trim()) {
      updates.storeName = params.storeName.trim();
    }
    if (params.newAdminPin && params.newAdminPin.trim()) {
      updates.adminPin = params.newAdminPin.trim();
    }
    if (params.newAdminUsername && params.newAdminUsername.trim()) {
      updates.adminUsername = params.newAdminUsername.trim();
    }

    this.updateSettings(updates);

    // Sync admin staff user
    let adminUser = this.staffUsers.find((u) => u.role === 'admin' || u.id === 'STAFF-ADMIN');
    if (adminUser) {
      if (params.newAdminPin && params.newAdminPin.trim()) {
        adminUser.pin = params.newAdminPin.trim();
      }
      if (params.newAdminUsername && params.newAdminUsername.trim()) {
        adminUser.username = params.newAdminUsername.trim();
      }
      this.saveStaff();
    } else {
      adminUser = this.addStaffUser({
        name: 'Main Administrator',
        username: params.newAdminUsername?.trim() || 'admin',
        pin: params.newAdminPin?.trim() || 'admin123',
        role: 'admin',
        status: 'active',
      });
    }

    return { settings: this.settings, adminUser };
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
      id: this.generateId('VEND'),
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

  public resolveItemPrice(item: InventoryItem, priceListId?: string): { unitPrice: number; priceListName: string; priceListType: string } {
    const s = this.getSettings();
    const lists = s.priceLists || DEFAULT_PRICE_LISTS;
    const targetId = priceListId || s.activePriceListId || 'retail';
    const targetList = lists.find((l) => l.id === targetId) || lists[0];

    if (item.prices && item.prices[targetList.id] !== undefined) {
      return {
        unitPrice: item.prices[targetList.id],
        priceListName: targetList.name,
        priceListType: targetList.type,
      };
    }

    if (targetList.discountPercentage && targetList.discountPercentage > 0) {
      const discounted = item.retailPrice * (1 - targetList.discountPercentage / 100);
      return {
        unitPrice: Math.round(discounted * 100) / 100,
        priceListName: targetList.name,
        priceListType: targetList.type,
      };
    }

    return {
      unitPrice: item.retailPrice,
      priceListName: targetList.name,
      priceListType: targetList.type,
    };
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
          brand: itemData.brand || vendor?.brandName || 'Unbranded',
          costBasis: calculatedCostBasis,
          vatRate,
        };
        this.saveInventory();
        return this.inventory[idx];
      }
    }

    const newItem: InventoryItem = {
      ...itemData,
      id: this.generateId('ITEM'),
      brand: itemData.brand || vendor?.brandName || 'Unbranded',
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

    this.isBulkImporting = true;
    try {
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
    } finally {
      this.isBulkImporting = false;
      this.saveVendors();
      this.saveInventory();
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
    items: {
      item: InventoryItem;
      quantity: number;
      isDamaged?: boolean;
      damageDiscountPercent?: number; // whole number, e.g. 50 => 50%
      resolvedPrice?: number;
      priceListName?: string;
      priceListType?: string;
    }[],
    paymentMethod: Transaction['paymentMethod'],
    cashierName: string,
    cashGiven?: number,
    discountAmount: number = 0,
    customerInfo?: { id?: string; name: string; phone: string; email?: string },
    currencyUsed: Transaction['currencyUsed'] = 'primary',
    cashGivenSecondary?: number,
    changeDueSecondary?: number,
    secondaryTotal?: number,
    discountMeta?: { type: 'amount' | 'percent'; value: number },
    splitPayments?: SplitPaymentLine[],
    registerInfo?: { registerId?: string; registerName?: string; priceListId?: string; priceListName?: string }
  ): Transaction {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const txNum = Math.floor(10000 + Math.random() * 89999);

    const txItems: TransactionItem[] = items.map(({ item, quantity, isDamaged, damageDiscountPercent, resolvedPrice, priceListName, priceListType }) => {
      const vendor = this.getVendorById(item.vendorId);
      const isConsignment = vendor?.supplierType === 'consignment';

      const basePrice = resolvedPrice !== undefined && resolvedPrice !== null ? resolvedPrice : item.retailPrice;
      const grossTotal = basePrice * quantity;
      const lineDamagePct =
        isDamaged ? Math.min(100, Math.max(0, damageDiscountPercent ?? 50)) : 0;
      const totalPrice = Number((grossTotal * (1 - lineDamagePct / 100)).toFixed(2));
      const lineDiscountAmount = Number((grossTotal - totalPrice).toFixed(2));
      const vatRate = item.vatRate ?? this.settings.defaultVatRate;
      const vatAmount = computeVatAmount(totalPrice, vatRate, this.settings.vatInclusive === true);

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
        brand: item.brand || vendor?.brandName || 'Unbranded',
        category: item.category,
        productLine: item.productLine,
        size: item.size,
        variant: item.variant,
        sku: item.sku,
        quantity,
        unitPrice: basePrice,
        totalPrice,
        vatRate,
        vatAmount,
        vendorId: item.vendorId,
        vendorName: vendor ? vendor.name : 'Unknown Vendor',
        supplierType: vendor ? vendor.supplierType : 'wholesale',
        costBasis: item.costBasis,
        vendorPayoutAmount: Number(vendorPayout.toFixed(2)),
        houseProfitAmount: Number(houseProfit.toFixed(2)),
        isDamaged: isDamaged || undefined,
        damageDiscountPercent: lineDamagePct > 0 ? lineDamagePct : undefined,
        discountAmount: lineDiscountAmount > 0 ? lineDiscountAmount : undefined,
        priceListName,
        priceListType,
      };
    });

    // Keep the persisted transaction totals identical to the totals shown in
    // CashierPOS/CheckoutModal. In particular, an order-level discount must
    // reduce the taxable amount before VAT is calculated.
    const calculatedTotals = calculateCartTotals(
      items,
      'amount',
      discountAmount,
      this.settings.defaultVatRate,
      this.settings.exchangeRate,
      this.settings.vatInclusive === true
    );
    const itemDiscountTotal = calculatedTotals.itemDiscountTotal;
    const subtotal = calculatedTotals.netSubtotal;
    const vatTotal = calculatedTotals.roundedVat;
    const total = calculatedTotals.grandTotal;

    // Distribute an order-level discount across the saved lines. This keeps
    // receipts, inventory reports, profit figures, and consignment payouts on
    // the actual final selling price rather than the pre-discount list price.
    // (Mode-independent: purely the share of the after-item-discount subtotal
    // that survives the order-level discount.)
    const orderDiscountRatio =
      calculatedTotals.afterItemSubtotal > 0
        ? (calculatedTotals.afterItemSubtotal - calculatedTotals.discountAmount) /
          calculatedTotals.afterItemSubtotal
        : 1;
    txItems.forEach((txItem) => {
      const preOrderDiscountTotal = txItem.totalPrice;
      const finalLineTotal = roundMoney(preOrderDiscountTotal * orderDiscountRatio);
      const orderDiscountShare = roundMoney(preOrderDiscountTotal - finalLineTotal);
      txItem.totalPrice = finalLineTotal;
      txItem.discountAmount = roundMoney((txItem.discountAmount || 0) + orderDiscountShare) || undefined;
      txItem.vatAmount = computeVatAmount(
        finalLineTotal,
        txItem.vatRate,
        this.settings.vatInclusive === true
      );

      if (txItem.supplierType === 'consignment') {
        const vendor = this.getVendorById(txItem.vendorId);
        const cutRate = vendor?.consignmentCutRate ?? 0;
        txItem.vendorPayoutAmount = roundMoney(finalLineTotal * (1 - cutRate));
        txItem.houseProfitAmount = roundMoney(finalLineTotal * cutRate);
      } else {
        const totalCost = txItem.costBasis * txItem.quantity;
        txItem.vendorPayoutAmount = roundMoney(totalCost);
        txItem.houseProfitAmount = roundMoney(finalLineTotal - totalCost);
      }
    });

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
      discountType: (discountAmount > 0 || itemDiscountTotal > 0)
        ? (discountMeta?.type ?? 'amount')
        : undefined,
      discountValue: discountMeta?.value,
      itemDiscountTotal: itemDiscountTotal > 0 ? itemDiscountTotal : undefined,
      total,
      paymentMethod,
      cashGiven: cashGiven,
      changeDue: cashGiven && cashGiven >= total ? Number((cashGiven - total).toFixed(2)) : undefined,
      splitPayments: splitPayments && splitPayments.length > 0 ? splitPayments : undefined,
      currencyUsed,
      exchangeRateUsed: currencyUsed !== 'primary' ? (this.settings.exchangeRate || 1) : undefined,
      secondaryTotal: secondaryTotal || (currencyUsed !== 'primary' ? Number((total / (this.settings.exchangeRate || 1)).toFixed(2)) : undefined),
      cashGivenSecondary,
      changeDueSecondary,
      items: txItems,
      customerId: cust?.id,
      customerName: cust?.name || customerInfo?.name,
      customerPhone: cust?.phone || customerInfo?.phone,
      customerEmail: cust?.email || customerInfo?.email,
      loyaltyPointsEarned: pointsEarned > 0 ? pointsEarned : undefined,
      registerId: registerInfo?.registerId || this.settings.activeRegisterId || (this.settings.registers && this.settings.registers[0]?.id) || 'reg_1',
      registerName: registerInfo?.registerName || (this.settings.registers?.find(r => r.id === (registerInfo?.registerId || this.settings.activeRegisterId || 'reg_1'))?.name) || 'Main Boutique Counter',
      priceListId: registerInfo?.priceListId || this.settings.activePriceListId || 'retail',
      priceListName: registerInfo?.priceListName || (this.settings.priceLists?.find(p => p.id === (registerInfo?.priceListId || this.settings.activePriceListId || 'retail'))?.name) || 'Standard Retail',
      isOfflineProcessed: !offlineSyncEngine.getEffectiveOnline(),
      syncedAt: offlineSyncEngine.getEffectiveOnline() ? now.toISOString() : undefined,
    };

    this.transactions.unshift(transaction);
    this.saveTransactions();

    this.updateActiveEODSession(transaction);

    // Enqueue in Service Worker / Offline Sync Queue
    offlineSyncEngine.enqueueTransaction(transaction);

    return transaction;
  }

  public addRawTransactions(txList: Transaction[]): void {
    this.transactions = [...txList, ...this.transactions];
    this.saveTransactions();
  }

  public updateTransaction(transaction: Transaction): Transaction {
    const idx = this.transactions.findIndex(
      (t) => t.id === transaction.id || t.receiptNumber === transaction.receiptNumber
    );
    if (idx !== -1) {
      this.transactions[idx] = { ...this.transactions[idx], ...transaction };
      this.saveTransactions();
      return this.transactions[idx];
    } else {
      this.transactions.unshift(transaction);
      this.saveTransactions();
      return transaction;
    }
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
    const txNum = Math.floor(10000 + Math.random() * 89999);

    const txItems: TransactionItem[] = items.map(({ item, quantity, unitPrice }) => {
      const vendor = this.getVendorById(item.vendorId);
      const isConsignment = vendor?.supplierType === 'consignment';

      const actualUnitPrice = unitPrice !== undefined ? unitPrice : item.retailPrice;
      const negQuantity = -Math.abs(quantity);
      const totalPrice = -Math.abs(actualUnitPrice * quantity);
      const vatRate = item.vatRate ?? this.settings.defaultVatRate;
      const vatAmount = computeVatAmount(totalPrice, vatRate, this.settings.vatInclusive === true);

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
        brand: item.brand || vendor?.brandName || 'Unbranded',
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
    const active = this.eodSessions.find((s) => s.status === 'open');
    
    // Automatically close sessions from previous days so a new float can be opened today
    if (active) {
      const today = new Date().toISOString().split('T')[0];
      if (active.date !== today) {
        this.closeEODSession(active.expectedCash, 'System Auto-Close', 'Automatically closed at start of new day.');
        return undefined; // No active session for today
      }
    }
    return active;
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

    if (tx.splitPayments && tx.splitPayments.length > 0) {
      tx.splitPayments.forEach((p) => {
        if (p.method === 'cash') {
          active.cashSales = Number((active.cashSales + p.amountInPrimary).toFixed(2));
        } else if (p.method === 'card') {
          active.cardSales = Number((active.cardSales + p.amountInPrimary).toFixed(2));
        }
      });
      this.recalculateActiveExpectedCash(active);
    } else if (tx.paymentMethod === 'cash') {
      active.cashSales = Number((active.cashSales + tx.total).toFixed(2));
      this.recalculateActiveExpectedCash(active);
    } else if (tx.paymentMethod === 'card') {
      active.cardSales = Number((active.cardSales + tx.total).toFixed(2));
    }

    this.saveEODSessions();
  }

  public closeEODSession(actualCash: number, closedBy: string, notes?: string): EODSession | undefined {
    // Look up the open session directly — calling getActiveEODSession() here
    // would re-trigger the new-day auto-close path and recurse infinitely
    // when a stale session exists (RangeError: Maximum call stack size exceeded).
    const active = this.eodSessions.find((s) => s.status === 'open');
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

    // Automatically trigger end-of-day SQLite backup & persistent browser storage snapshot
    try {
      scheduledBackupService.handleEndOfDayClosing(active.id).catch((err) => {
        console.error('Failed to auto-backup on EOD close:', err);
      });
    } catch (err) {
      console.error('Failed to trigger auto-backup:', err);
    }

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
      id: this.generateId('LOG'),
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

      const vendorAdvances = this.vendorAdvances
        .filter((advance) => advance.vendorId === vendor.id)
        .reduce((sum, advance) => sum + advance.amount, 0);

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
        vendorAdvanceTotal: Number(vendorAdvances.toFixed(2)),
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
      id: this.generateId('STAFF'),
      createdAt: new Date().toISOString(),
    };
    this.staffUsers.unshift(newUser);
    this.saveStaff();
    return newUser;
  }

  public updateStaffUser(id: string, updates: Partial<StaffUser>): StaffUser | undefined {
    const idx = this.staffUsers.findIndex((u) => u.id === id);
    if (idx !== -1) {
      const user = this.staffUsers[idx];
      this.staffUsers[idx] = { ...user, ...updates };
      this.saveStaff();

      if (user.role === 'admin' || id === 'STAFF-ADMIN') {
        const settingUpdates: Partial<StoreSettings> = {};
        if (updates.pin) {
          settingUpdates.adminPin = updates.pin;
          if (updates.pin !== 'admin123') {
            settingUpdates.onboardingCompleted = true;
          }
        }
        if (updates.username) {
          settingUpdates.adminUsername = updates.username;
        }
        if (Object.keys(settingUpdates).length > 0) {
          this.settings = { ...this.settings, ...settingUpdates };
          this.saveSettings();
        }
      }

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

  public verifyManagerOrAdminPin(pin: string): { authorized: boolean; staff?: StaffUser; isGlobalAdmin?: boolean } {
    const clean = pin.trim();
    if (!clean) return { authorized: false };

    // Check store root admin credentials
    if (clean === (this.settings.adminPin || 'admin123')) {
      return { authorized: true, isGlobalAdmin: true };
    }

    // Check active staff members with admin, shift_lead, or senior_cashier role
    const matched = this.staffUsers.find(
      (u) =>
        u.status === 'active' &&
        u.pin === clean &&
        (u.role === 'admin' || u.role === 'shift_lead' || u.role === 'senior_cashier')
    );

    if (matched) {
      return { authorized: true, staff: matched, isGlobalAdmin: matched.role === 'admin' };
    }

    return { authorized: false };
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
