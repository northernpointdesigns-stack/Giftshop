export interface InventoryItem {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  description?: string;
  category: string;
  brand?: string;
  price: number; // Primary currency (SCR)
  costPrice: number;
  secondaryPrice?: number; // USD
  stockLevel: number;
  reorderPoint: number;
  targetStockLevel?: number;
  imageUrl?: string;
  isConsignment: boolean;
  vendorId?: string; // Links to Vendor
  taxRate?: number; // VAT percentage (e.g. 15 for 15%)
  unit?: string; // 'pcs', 'kg', 'set'
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  itemId: string;
  sku: string;
  name: string;
  price: number;
  secondaryPrice?: number;
  costPrice: number;
  quantity: number;
  discountPercent?: number;
  discountAmount?: number;
  finalPrice: number; // Price after item discount
  taxRate?: number;
  isConsignment: boolean;
  vendorId?: string;
  brand?: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  commissionRate: number; // e.g., 20 for 20% store commission
  paymentTerms?: string;
  payoutMethod?: 'bank_transfer' | 'cash' | 'check';
  bankDetails?: string;
  notes?: string;
  active?: boolean;
  totalOwed?: number;
  totalPaid?: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  loyaltyPoints: number;
  membershipTier: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
  totalSpend: number;
  visitCount: number;
  lastVisit?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  items: CartItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number; // SCR
  secondaryTotal?: number; // USD
  exchangeRateUsed: number;
  paymentMethod: 'cash' | 'card' | 'split' | 'store_credit';
  cashTendered?: number;
  changeDue?: number;
  cashTenderedCurrency?: 'SCR' | 'USD';
  cardAmount?: number;
  cashAmount?: number;
  cashierName: string;
  terminalId?: string;
  // Refund metadata
  isRefund?: boolean;
  refundReason?: string;
  originalReceiptNumber?: string;
  originalTransactionId?: string;
  restocked?: boolean;
  // Void Transaction Support
  isVoided?: boolean;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  voidAuthorizedBy?: string;
  // Customer & Loyalty Link
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
  loyaltyDiscountApplied?: number;
}

export interface EODSession {
  id: string;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  closedBy?: string;
  cashierName?: string;
  status: 'open' | 'closed';
  startingFloat: number;
  openingFloat: number;
  cashSales: number;
  totalCashSales: number;
  cardSales: number;
  totalCardSales: number;
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  voidCount: number;
  totalTransactions: number;
  paidInTotal: number;
  paidOutTotal: number;
  cashDropTotal: number;
  expectedCash: number;
  actualCash?: number;
  actualCountedCash: number;
  cashVariance?: number;
  cashDiscrepancy: number;
  notes?: string;
  denominationCounts?: Record<string, number>;
}

export interface CustomerDisplayState {
  cart: CartItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  secondaryTotal: number;
  exchangeRate: number;
  attachedCustomer?: Customer | null;
  status: 'idle' | 'scanning' | 'payment' | 'completed';
  lastScannedItem?: CartItem | null;
  paymentDetails?: {
    method: string;
    tendered: number;
    changeDue: number;
    currency: string;
    receiptNumber: string;
  } | null;
}

export type DrawerEventType =
  | 'session_open'
  | 'session_close'
  | 'cash_sale'
  | 'card_sale'
  | 'refund'
  | 'paid_in'
  | 'paid_out'
  | 'cash_drop'
  | 'manual_open'
  | 'void_sale';

export interface CashDrawerLog {
  id: string;
  sessionId?: string;
  timestamp: string;
  eventType: DrawerEventType;
  amount: number;
  staffName: string;
  reason?: string;
  currentFloatAfter?: number;
}

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  taxRegistrationNumber: string; // Seychelles TIN / VAT ID
  defaultTaxRate: number; // 15% standard Seychelles VAT
  primaryCurrency: string; // 'SCR'
  primaryCurrencySymbol: string; // 'SR'
  secondaryCurrency: string; // 'USD'
  secondaryCurrencySymbol: string; // '$'
  exchangeRate: number; // 1 USD = 13.50 SCR
  receiptHeaderMsg: string;
  receiptFooterMsg: string;
  receiptLogoUrl?: string;
  enableDualCurrencyDisplay: boolean;
  enableSoundEffects: boolean;
  enableLowStockAlerts: boolean;
  cashierPin?: string;
  adminPin?: string;
  thermalPrinterWidth: '80mm' | '58mm';
}

export interface StaffUser {
  id: string;
  name: string;
  role: 'admin' | 'supervisor' | 'cashier';
  pin: string;
  active: boolean;
}

export interface ConsignmentPayout {
  id: string;
  vendorId: string;
  vendorName: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  totalGrossSales: number;
  storeCommissionAmount: number;
  netPayoutAmount: number;
  itemCount: number;
  status: 'draft' | 'approved' | 'paid';
  paidAt?: string;
  paymentReference?: string;
}
