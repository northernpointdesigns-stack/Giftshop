export type SupplierType = 'wholesale' | 'consignment';

export interface Vendor {
  id: string;
  name: string;
  brandName?: string; // e.g. "Ocean Seychelles", "Souvenir Boutique"
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
  brand?: string; // e.g. "Ocean Seychelles", "Souvenir Boutique"
  category: string; // e.g. "T-Shirts", "Mugs", "Bags", "Pareos", "Soaps"
  productLine?: string; // e.g. "Luxury Line", "Normal Line", "Beachwear"
  size?: string; // e.g. "Kids S", "Adults M", "Women L", "12oz"
  variant?: string; // e.g. "Design #1 - Turtle Cove", "Gold Rim"
  sku: string; // Barcode ID / EAN / UPC
  stockLevel: number;
  minStockThreshold: number;
  retailPrice: number;
  retailPriceSecondary?: number; // Override price in secondary currency, otherwise computed dynamically
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
}

export interface Transaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  cashierName: string;
  subtotal: number; // Net amount before VAT & discount
  vatTotal: number; // VAT tax collected
  tax: number; // Same as vatTotal
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashGiven?: number;
  changeDue?: number;
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
}

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'cancelled';

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
  customerName: string;
  customerContact?: string; // phone / email / address
  lines: InvoiceLine[];
  notes?: string;
  status: InvoiceStatus;
  payments: InvoicePayment[];
  createdAt: string;
  createdBy: string;
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

export interface StoreSettings {
  defaultVatRate: number; // e.g. 0.15 for 15% VAT
  storeName: string;
  taxRegistrationNumber?: string;
  adminUsername?: string;
  adminPin?: string;

  // Custom Corporate Branding Config
  posAppName?: string;           // Custom App Name (Default: IslandPOS)
  posShortName?: string;         // Custom Badge Initials (Default: IP)
  posVersion?: string;           // Custom POS Version Number (Default: v2.4.1)
  brandLogoUrl?: string;         // Custom brand logo icon URL
  removeIslandBranding?: boolean; // Toggle to remove any Island POS reference
  customThemeColor?: 'emerald' | 'blue' | 'indigo' | 'violet' | 'amber' | 'rose' | 'slate'; // Style accents
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
  exchangeRate?: number; // 1 unit of secondary currency = X units of primary currency, e.g. 1 USD = 13.5 SCR
  allowPaymentInSecondary?: boolean;
  defaultCurrencyMode?: 'primary' | 'secondary';
  // Up to 2 extra reference currencies shown as smaller equivalents on the Customer Display
  customerDisplayCurrencies?: DisplayCurrencyConfig[];
  // Register view preference: picture grid or touch/scan rows
  posViewMode?: 'grid' | 'quick';
  // Print receipt automatically when payment amount is entered at checkout
  autoPrintReceipt?: boolean;
  // Force a backup download when closing the day (EOD)
  requireBackupOnDayClose?: boolean;
  lastBackupAt?: string;

  // Receipt Customization Fields
  receiptLogoUrl?: string;
  receiptHeaderSubtitle?: string;
  receiptHeaderLines?: string[];
  receiptFooterMessage?: string;
  receiptFooterPolicy?: string;
  receiptFooterLines?: string[];
}

export type StaffRole = 'cashier' | 'senior_cashier' | 'shift_lead' | 'admin';
export type CashierAccessArea = 'pos' | 'inventory' | 'reports' | 'settings' | 'staff';

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  pin: string;
  role: StaffRole;
  status: 'active' | 'suspended';
  createdAt: string;
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
  }[];
  subtotal: number;
  tax: number;
  total: number;
  isCheckingOut: boolean;
  displayCurrency?: 'primary' | 'secondary';
  secondarySubtotal?: number;
  secondaryTax?: number;
  secondaryTotal?: number;
  lastScannedItem?: {
    name: string;
    brand?: string;
    price: number;
    stockRemaining?: number;
  };
  customMessage?: string;
}
