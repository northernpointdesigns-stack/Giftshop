export type SupplierType = 'wholesale' | 'consignment';

export interface Vendor {
  id: string;
  name: string;
  brandName?: string; // e.g. "Acme Gifts", "Souvenir Boutique"
  contactName: string;
  email: string;
  phone: string;
  supplierType: SupplierType;
  payoutTerms: string; // e.g. "Net 30", "Bi-weekly", "Immediate"
  consignmentCutRate: number; // e.g. 0.30 means House keeps 30%, Vendor gets 70%
  notes?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  brand?: string; // e.g. "Acme Gifts", "Souvenir Boutique"
  category: string; // e.g. "T-Shirts", "Mugs", "Bags", "Pareos", "Soaps"
  productLine?: string; // e.g. "Luxury Line", "Normal Line", "Beachwear"
  size?: string; // e.g. "Kids S", "Adults M", "Women L", "12oz"
  variant?: string; // e.g. "Design #1 - Turtle Cove", "Gold Rim"
  sku: string; // Barcode ID / EAN / UPC
  stockLevel: number;
  minStockThreshold: number;
  retailPrice: number;
  retailPriceSecondary?: number; // Override price in secondary currency, otherwise computed dynamically
  prices?: Record<string, number>; // Custom prices per price list ID e.g. { wholesale: 12.00, vip: 14.50 }
  costBasis: number;
  costBasisSecondary?: number; // Override cost basis in secondary currency, otherwise computed dynamically
  vatRate?: number; // e.g. 0.15 for 15% VAT
  taxable?: boolean;
  vendorId: string;
  imageUrl?: string;
  createdAt: string;
}

export interface TransactionItem {
  itemId: string;
  name: string;
  brand?: string;
  category: string;
  productLine?: string;
  size?: string;
  variant?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vatRate: number;
  vatAmount: number;
  vendorId: string;
  vendorName: string;
  supplierType: SupplierType;
  costBasis: number; // Snapshot of cost basis at time of sale
  vendorPayoutAmount: number; // Snapshot of payout owed to vendor
  houseProfitAmount: number; // Snapshot of house retainment
  // Per-line discount snapshot (e.g., damaged goods markdown applied by cashier)
  isDamaged?: boolean;
  damageDiscountPercent?: number; // e.g. 50 means 50% off this line
  discountAmount?: number; // Amount deducted from this line's gross total
  priceListName?: string;
  priceListType?: string;
}

export type PaymentMethod = 'cash' | 'card' | 'split' | 'gift_card';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  membershipTier: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
  loyaltyPoints: number;
  notes?: string;
  registeredAt: string;
  priceListId?: string; // e.g. 'retail', 'wholesale', 'vip'
  businessType?: 'retail' | 'wholesale';
}

export interface SplitPaymentLine {
  id: string;
  method: 'cash' | 'card' | 'gift_card';
  currencyCode: string; // e.g. 'SCR', 'USD', 'EUR', 'GBP'
  currencySymbol: string; // e.g. 'SR', '$', '€', '£'
  amountTendered: number; // Native amount e.g. $50.00
  exchangeRate: number; // Exchange rate vs primary currency exchanged amount of secondary currency per 1 primary unit
  amountInPrimary: number; // Converted equivalent in primary base currency e.g. 675.00 SCR
  reference?: string; // Terminal Authorization Ref / Approval Code
  note?: string; // Descriptive label e.g. "Foreign Cash (USD)" or "Barclays Visa"
}

export interface Transaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  cashierName: string;
  subtotal: number; // Net amount before VAT & discount
  vatTotal: number; // VAT tax collected
  tax: number; // Same as vatTotal
  discount: number; // Final order-level discount amount actually deducted
  discountType?: 'amount' | 'percent'; // How the order-level discount was entered
  discountValue?: number; // Raw entered order-level discount value (% or amount)
  itemDiscountTotal?: number; // Sum of per-item discounts (damaged markdowns) before order-level discount
  total: number;
  paymentMethod: PaymentMethod;
  cashGiven?: number;
  changeDue?: number;
  splitPayments?: SplitPaymentLine[];
  // Multi-Currency snapshots at checkout
  currencyUsed?: 'primary' | 'secondary' | 'mixed';
  exchangeRateUsed?: number;
  secondaryTotal?: number;
  cashGivenSecondary?: number;
  changeDueSecondary?: number;
  items: TransactionItem[];
  isRefund?: boolean;
  refundReason?: string;
  originalReceiptNumber?: string;
  originalTransactionId?: string;
  restocked?: boolean;
  // Customer & Loyalty Link
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  loyaltyPointsEarned?: number;
  // Offline & Service Worker Sync Status
  isOfflineProcessed?: boolean;
  syncedAt?: string;
  // Digital Receipt, Gift & Tax-Free Export Options
  isGiftReceipt?: boolean;
  taxFreeDetails?: TaxFreeDetails;
  // Terminal & Register Info
  registerId?: string;
  registerName?: string;
  priceListId?: string;
  priceListName?: string;
}

export interface TaxFreeDetails {
  passportNumber: string;
  passportCountry: string;
  travelerName: string;
  departureDate?: string;
  flightNumber?: string;
  refundMethod?: 'credit_card' | 'airport_cash' | 'bank_transfer';
  adminFeeAmount?: number;
  netRefundAmount?: number;
  certificateRef?: string;
  issuedAt?: string;
}

export interface VendorAdvance {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  date: string;
  note?: string;
  recordedBy: string;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  /** Per-line "TAXED" flag: only X-marked lines count toward the taxable subtotal. */
  taxed?: boolean;
  /** Purchase-order ITEM # / SKU reference column. */
  itemRef?: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'cancelled';

/** Document kind rendered from the business document layouts. */
export type InvoiceKind = 'invoice' | 'quote' | 'purchase_order';

/** Payment terms — drives the automatic DUE DATE (issue date + N days). */
export type InvoiceTerms = 'due_on_receipt' | 'net_15' | 'net_30' | 'net_60' | 'custom';

/** Tax engine mode: no tax, tax on the whole subtotal, or tax on TAXED-flagged lines only. */
export type InvoiceTaxMode = 'none' | 'subtotal' | 'per_line';

/** Collections follow-up log entry (phone call, email, letter, in-person visit). */
export interface InvoiceFollowUp {
  id: string;
  date: string; // ISO timestamp
  method: 'call' | 'email' | 'letter' | 'in_person';
  stage: string; // suggested sequence stage at the time of logging
  note?: string;
  recordedBy: string;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  date: string;
  method: 'cash' | 'card' | 'transfer' | 'cheque';
  reference?: string;
  recordedBy: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  kind?: InvoiceKind; // default 'invoice'
  customerName: string;
  customerContact?: string; // phone / email / address
  customerId?: string; // CUSTOMER ID meta field
  shipTo?: string; // SHIP TO block (multi-line)
  lines: InvoiceLine[];
  notes?: string;
  status: InvoiceStatus;
  payments: InvoicePayment[];
  createdAt: string;
  createdBy: string;
  // --- Document meta ---
  issueDate?: string; // ISO date printed as DATE; defaults to createdAt
  dueDate?: string; // ISO date; auto = issueDate + terms days
  terms?: InvoiceTerms; // default 'net_30'
  // --- Tax engine (Vertex42-style Subtotal / Taxable / Tax due / Other / Total) ---
  taxMode?: InvoiceTaxMode; // default 'none' for legacy records
  taxRate?: number; // fraction, e.g. 0.0625 (defaults to settings.defaultVatRate)
  otherLabel?: string; // e.g. 'Shipping' or 'Discount'
  otherAmount?: number;
  // --- Quote-specific ---
  preparedBy?: string;
  termsAndConditions?: string;
  // --- Purchase-order-specific ---
  vendor?: string;
  requisitioner?: string;
  shipVia?: string;
  fob?: string;
  shippingTerms?: string;
  // --- Collections follow-up sequence ---
  followUps?: InvoiceFollowUp[];
}

export interface ConsignmentPayoutRecord {
  id: string;
  vendorId: string;
  vendorName: string;
  periodStart: string;
  periodEnd: string;
  totalUnitsSold: number;
  totalGrossSales: number;
  houseCommission: number;
  payoutAmount: number;
  status: 'pending' | 'paid';
  paidAt?: string;
  notes?: string;
}

export type CashDrawerEventType =
  | 'open'
  | 'close'
  | 'paid_in'
  | 'paid_out'
  | 'cash_drop'
  | 'manual_open';

export interface CashDrawerLog {
  id: string;
  sessionId?: string;
  timestamp: string;
  eventType: CashDrawerEventType;
  amount?: number;
  staffName: string;
  reason: string;
  currentFloatAfter?: number;
}

export interface EODSession {
  id: string;
  date: string;
  openedAt: string;
  closedAt?: string;
  startingFloat: number;
  cashSales: number;
  cardSales: number;
  paidInTotal?: number;
  paidOutTotal?: number;
  cashDropTotal?: number;
  expectedCash: number;
  actualCash?: number;
  cashDifference?: number;
  status: 'open' | 'closed';
  closedBy?: string;
  notes?: string;
}

export interface DisplayCurrencyConfig {
  code: string;   // e.g. "EUR"
  symbol: string; // e.g. "€"
  rate: number;   // 1 unit of this currency = X units of primary currency (e.g. 1 EUR = 14.60 SCR)
  enabled?: boolean;
}

export interface CustomCatalogTemplate {
  id: string;
  name: string; // e.g., "GiftShop Best Sellers Catalog", "Artisan Crafts Catalog"
  description?: string;
  badgeColor?: 'emerald' | 'blue' | 'purple' | 'amber' | 'cyan';
  filename?: string;
  csvContent: string;
}

export interface StoreSettings {
  defaultVatRate: number; // e.g. 0.15 for 15% VAT
  vatInclusive?: boolean; // true = shelf prices already include VAT (extract at checkout); false = VAT added on top
  storeName: string;
  taxRegistrationNumber?: string;
  adminUsername?: string;
  adminPin?: string;
  exchangeRateUpdatedAt?: string; // ISO timestamp of the last daily-rate confirmation

  // Custom Corporate Branding Config
  posAppName?: string;           // Custom App Name (Default: GiftShop)
  posShortName?: string;         // Custom Badge Initials (Default: GS)
  posVersion?: string;           // Custom POS Version Number (Default: v2.4.1)
  brandLogoUrl?: string;         // Custom brand logo icon URL
  removeIslandBranding?: boolean; // Toggle to remove default branding reference
  customThemeColor?: 'emerald' | 'blue' | 'indigo' | 'violet' | 'amber' | 'rose' | 'slate'; // Style accents
  customCatalogTemplates?: CustomCatalogTemplate[]; // Custom quick catalog CSV presets editable per shop
  cashierAccess?: Record<CashierAccessArea, boolean>;

  // Custom Navigation Labels
  customRegisterLabel?: string;  // Default: Register
  customInventoryLabel?: string; // Default: Inventory
  customVendorsLabel?: string;   // Default: Vendors
  customPayoutsLabel?: string;   // Default: Payouts
  customReportsLabel?: string;   // Default: Reports

  // Update Checker Configuration
  enableAutoUpdateCheck?: boolean; // Default: true
  updateConfigUrl?: string;        // Default: '/version.json'
  dismissedUpdateVersion?: string; // Cache skipped version

  // Multi-Currency Pricing Setup
  primaryCurrency?: string; // e.g., "SCR"
  primaryCurrencySymbol?: string; // e.g., "SR"
  secondaryCurrency?: string; // e.g., "USD"
  secondaryCurrencySymbol?: string; // e.g., "$"
  exchangeRate?: number; // 1 unit of secondary currency = X units of primary currency, set by the user daily
  allowPaymentInSecondary?: boolean;
  defaultCurrencyMode?: 'primary' | 'secondary';
  // Up to 2 extra reference currencies shown as smaller equivalents on the Customer Display
  customerDisplayCurrencies?: DisplayCurrencyConfig[];
  // Register view preference: picture grid or touch/scan rows
  posViewMode?: 'grid' | 'quick';
  // Print receipt automatically when payment amount is entered at checkout
  autoPrintReceipt?: boolean;
  // Tourist tax-free export processing fee (%) deducted from the VAT refund.
  // Used by BOTH the checkout savings estimate and the printed certificate.
  taxFreeAdminFeePercent?: number;
  // Force a backup download when closing the day (EOD)
  requireBackupOnDayClose?: boolean;
  lastBackupAt?: string;

  // Scheduled Auto-Backup & SQLite Database Persistence
  enableAutoBackup?: boolean; // Default: true
  autoBackupTime?: string; // Default: '20:00'
  autoBackupToBrowserStorage?: boolean; // Default: true
  autoDownloadDbOnDayClose?: boolean; // Default: true
  autoBackupFormat?: 'db' | 'json' | 'both'; // Default: 'both'
  autoBackupRetentionDays?: number; // Default: 30

  // Receipt Customization Fields
  shopLogoUrl?: string; // Shop logo image dynamically injected into thermal receipts & invoice print templates
  receiptLogoUrl?: string;
  receiptHeaderSubtitle?: string;
  receiptHeaderLines?: string[];
  receiptFooterMessage?: string;
  receiptFooterPolicy?: string;
  receiptFooterLines?: string[];
  receiptPrinterType?: 'thermal' | 'normal' | 'ask'; // Default: 'thermal'
  thermalReceiptWidth?: '80mm' | '58mm'; // Default: '80mm'
  receiptShowMainCurrencyNotice?: boolean; // Default: true
  receiptShowVatBreakdown?: boolean; // Default: true
  onboardingCompleted?: boolean; // Set to true after completing initial welcome and float setup

  // Hardware Barcode & PLU Scanner Rule Engine Config
  enableBarcodeRuleEngine?: boolean;
  barcodeRules?: BarcodeMappingRule[];

  // Price Lists & Cash Register Terminals Configuration
  priceLists?: PriceList[];
  registers?: CashRegisterTerminal[];
  activeRegisterId?: string;
  activePriceListId?: string;

  // Security Inactivity Auto-Logout Timer in minutes (0 = disabled)
  inactivityTimeoutMinutes?: number;

  // Peripheral Hardware Options
  barcodeScannerMode?: 'hid' | 'serial';
  dualDisplayResolutionWidth?: number;
  dualDisplayResolutionHeight?: number;
  dualDisplayScale?: number;

  // Internet & Digital Receipt Settings
  enableInternetFeatures?: boolean;
  enableDigitalReceipts?: boolean;

  // Connectivity & SMTP Email / WhatsApp Webhook Settings
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSenderEmail?: string;
  smtpSecure?: boolean;
  whatsappWebhookUrl?: string;
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
}

export interface PriceList {
  id: string;
  name: string;
  type: 'retail' | 'wholesale' | 'vip' | 'custom';
  isDefault?: boolean;
  discountPercentage?: number; // e.g. 15 for 15% off retail if specific price not set
  description?: string;
}

export interface CashRegisterTerminal {
  id: string;
  name: string;
  location?: string;
  defaultPriceListId: string;
  mode: 'retail' | 'wholesale' | 'hybrid';
  isOnline?: boolean;
}

export type BarcodeAction =
  | 'add_to_cart'
  | 'increment_quantity'
  | 'find_item'
  | 'set_quantity'
  | 'price_embedded'
  | 'open_search'
  | 'apply_discount';

export type BarcodeMatchType = 'prefix' | 'suffix' | 'exact' | 'regex' | 'plu_prefix';

export interface BarcodeMappingRule {
  id: string;
  name: string;
  matchType: BarcodeMatchType;
  pattern: string;
  action: BarcodeAction;
  enabled: boolean;
  skuStartIndex?: number;
  skuLength?: number;
  valueStartIndex?: number;
  valueLength?: number;
  valueDivisor?: number;
  description?: string;
}

export type StaffRole = 'cashier' | 'senior_cashier' | 'shift_lead' | 'admin';
export type CashierAccessArea =
  | 'pos'
  | 'inventory'
  | 'inventory_view'
  | 'inventory_edit'
  | 'reports'
  | 'reports_eod'
  | 'reports_pnl'
  | 'reports_history'
  | 'reports_forecasting'
  | 'reports_heatmap'
  | 'vendors'
  | 'payouts'
  | 'invoices'
  | 'settings'
  | 'staff'
  | 'discounts'
  | 'refunds'
  | 'damaged_markdowns'
  | 'manual_drawer_open'
  | 'eod_close';

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  pin: string;
  role: StaffRole;
  status: 'active' | 'suspended';
  createdAt: string;
  /**
   * Per-cashier security gates. When set, overrides the store-wide
   * cashierAccess map for this cashier's sessions (admins always get full
   * access). Legacy accounts without this map keep inheriting the global map
   * via getEffectiveCashierAccess().
   */
  cashierAccess?: Partial<Record<CashierAccessArea, boolean>>;
}

export interface CategoryTab {
  id: string;
  name: string;
  displayOrder: number;
  color?: string;
}

export interface CustomerDisplayState {
  cartItems: {
    id: string;
    name: string;
    brand?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    secondaryUnitPrice?: number;
    secondaryTotalPrice?: number;
    priceListName?: string;
    priceListType?: string;
  }[];
  subtotal: number;
  discount?: number;
  discountType?: 'amount' | 'percent';
  discountValue?: number;
  itemDiscountTotal?: number;
  tax: number;
  total: number;
  isCheckingOut: boolean;
  displayCurrency?: 'primary' | 'secondary';
  primaryCurrency?: string;
  primarySymbol?: string;
  secondaryCurrency?: string;
  secondarySymbol?: string;
  exchangeRate?: number;
  secondarySubtotal?: number;
  secondaryDiscount?: number;
  secondaryItemDiscount?: number;
  secondaryTax?: number;
  secondaryTotal?: number;
  lastScannedItem?: {
    name: string;
    brand?: string;
    price: number;
    stockRemaining?: number;
  };
  splitPaymentsPreview?: {
    method: string;
    currencyCode: string;
    currencySymbol: string;
    amountTendered: number;
    amountInPrimary: number;
  }[];
  splitTotalPaidSoFar?: number;
  splitRemainingDue?: number;
  stationName?: string;
  priceTierName?: string;
  customMessage?: string;
}

export interface AutoBackupSnapshot {
  id: string; // e.g. "BACKUP-2026-08-24-1724490000"
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string
  trigger: 'eod_close' | 'scheduled_timer' | 'manual';
  eodSessionId?: string;
  itemCount: number;
  transactionCount: number;
  vendorCount: number;
  customerCount: number;
  totalSales: number;
  sizeBytes: number;
      dbSqlContent: string;
  jsonContent: string;
}

// ---------------------------------------------------------------------------
// VENDOR LEDGER (per-vendor settlement statements)
// ---------------------------------------------------------------------------

/**
 * One itemized line in a vendor's ledger — derived from a transaction's
 * TransactionItem plus its surrounding receipt context.
 */
export interface LedgerLineItem {
  txId: string;
  receiptNumber: string;
  timestamp: string;
  isRefund: boolean;
  refundReason?: string;
  sku: string;
  name: string;
  brand?: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vatAmount: number;
  costBasis: number;
  houseCut: number;
  vendorPayout: number;
  supplierType: SupplierType;
}

/**
 * Period-level roll-up for the lines returned in a ledger snapshot.
 */
export interface LedgerPeriodTotals {
  totalUnits: number;
  grossSales: number;
  vat: number;
  houseCut: number;
  vendorPayout: number;
}

/**
 * Full itemized ledger for a single vendor, used to build the per-vendor
 * traceability statement (deposit -> sale -> settlement).
 */
export interface VendorLedgerSnapshot {
  vendor: Vendor | null;
  transactions: LedgerLineItem[];
  advances: VendorAdvance[];
  settlements: ConsignmentPayoutRecord[];
  periodSales: LedgerPeriodTotals;
  advanceTotal: number;
  settledTotal: number;
  netOwing: number;
  isWholesale: boolean;
}
