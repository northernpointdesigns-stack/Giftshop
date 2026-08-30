import {
  Vendor,
  InventoryItem,
  Transaction,
  ConsignmentPayoutRecord,
  EODSession,
  StoreSettings,
  StaffUser,
  CategoryTab,
  CashDrawerLog,
  Customer,
  VendorAdvance,
  Invoice,
} from '../types/pos';

export interface SqliteExportPayload {
  vendors: Vendor[];
  inventory: InventoryItem[];
  transactions: Transaction[];
  payouts: ConsignmentPayoutRecord[];
  eodSessions: EODSession[];
  settings: StoreSettings;
  staff: StaffUser[];
  categories?: CategoryTab[];
  drawerLogs?: CashDrawerLog[];
  customers?: Customer[];
  vendorAdvances?: VendorAdvance[];
  invoices?: Invoice[];
  feedback?: Array<{
    id: string;
    receiptNumber?: string;
    rating: number;
    category?: string;
    comments?: string;
    timestamp: string;
  }>;
  exportedAt?: string;
}

/**
 * Escapes a JS value safely for SQLite insert strings.
 */
function sqlEscape(val: unknown): string {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return '0.0';
    return String(val);
  }
  if (typeof val === 'boolean') {
    return val ? '1' : '0';
  }
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

/** UTF-8 safe base64 encode (used for the lossless restore manifest). */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** UTF-8 safe base64 decode back to the original text. */
function base64ToUtf8(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Extracts the lossless JSON manifest embedded in an app-generated SQLite dump.
 * Returns the parsed object, or null if the content is not a manifest dump.
 */
export function extractSqliteManifest(content: string): Record<string, unknown> | null {
  const match = content.match(
    /INSERT\s+OR\s+REPLACE\s+INTO\s+backup_manifest\s*\([^)]*\)\s*VALUES\s*\(\s*'manifest'\s*,\s*'([^']+)'\s*\)/i
  );
  if (!match) return null;
  try {
    const parsed = JSON.parse(base64ToUtf8(match[1]));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Generates a full SQLite SQL DDL and DML dump that represents the entire state
 * of the POS terminal. This file can be saved as a `.db` / `.sql` file
 * and opened with SQLite CLI, DB Browser for SQLite, DBeaver, or loaded directly.
 */
export function generateSQLiteDatabaseDump(data: SqliteExportPayload): string {
  const timestamp = data.exportedAt || new Date().toISOString();
  const lines: string[] = [];

  // SQL File Header
  lines.push(`-- ==========================================================`);
  lines.push(`-- POS SQLITE DATABASE BACKUP DUMP`);
  lines.push(`-- Exported At: ${timestamp}`);
  lines.push(`-- Store Name: ${data.settings?.storeName || 'The Gift Shop'}`);
  lines.push(`-- Schema Format: SQLite 3 Standard (DDL + DML)`);
  lines.push(`-- ==========================================================`);
  lines.push(``);
  lines.push(`PRAGMA foreign_keys = OFF;`);
  lines.push(`BEGIN TRANSACTION;`);
  lines.push(``);

  // 1. SETTINGS TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: store_settings`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS store_settings (`);
  lines.push(`  key TEXT PRIMARY KEY,`);
  lines.push(`  value TEXT,`);
  lines.push(`  updated_at TEXT`);
  lines.push(`);`);
  lines.push(``);
  if (data.settings) {
    for (const [k, v] of Object.entries(data.settings)) {
      lines.push(
        `INSERT OR REPLACE INTO store_settings (key, value, updated_at) VALUES (${sqlEscape(k)}, ${sqlEscape(v)}, ${sqlEscape(timestamp)});`
      );
    }
    lines.push(``);
  }

  // 2. CATEGORIES TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: category_tabs`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS category_tabs (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  name TEXT NOT NULL,`);
  lines.push(`  display_order INTEGER,`);
  lines.push(`  color TEXT`);
  lines.push(`);`);
  lines.push(``);
  if (Array.isArray(data.categories) && data.categories.length > 0) {
    for (const c of data.categories) {
      lines.push(
        `INSERT OR REPLACE INTO category_tabs VALUES (${sqlEscape(c.id)}, ${sqlEscape(c.name)}, ${sqlEscape(c.displayOrder)}, ${sqlEscape(c.color)});`
      );
    }
    lines.push(``);
  }

  // 3. VENDORS TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: vendors`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS vendors (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  name TEXT NOT NULL,`);
  lines.push(`  brand_name TEXT,`);
  lines.push(`  contact_name TEXT,`);
  lines.push(`  phone TEXT,`);
  lines.push(`  email TEXT,`);
  lines.push(`  supplier_type TEXT,`);
  lines.push(`  payout_terms TEXT,`);
  lines.push(`  consignment_cut_rate REAL DEFAULT 0.30,`);
  lines.push(`  notes TEXT,`);
  lines.push(`  created_at TEXT`);
  lines.push(`);`);
  lines.push(``);
  if (Array.isArray(data.vendors) && data.vendors.length > 0) {
    for (const v of data.vendors) {
      lines.push(
        `INSERT OR REPLACE INTO vendors VALUES (` +
          `${sqlEscape(v.id)}, ` +
          `${sqlEscape(v.name)}, ` +
          `${sqlEscape(v.brandName)}, ` +
          `${sqlEscape(v.contactName)}, ` +
          `${sqlEscape(v.phone)}, ` +
          `${sqlEscape(v.email)}, ` +
          `${sqlEscape(v.supplierType)}, ` +
          `${sqlEscape(v.payoutTerms)}, ` +
          `${sqlEscape(v.consignmentCutRate)}, ` +
          `${sqlEscape(v.notes)}, ` +
          `${sqlEscape(v.createdAt)}` +
          `);`
      );
    }
    lines.push(``);
  }

  // 4. INVENTORY TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: inventory`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS inventory (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  name TEXT NOT NULL,`);
  lines.push(`  brand TEXT,`);
  lines.push(`  category TEXT,`);
  lines.push(`  product_line TEXT,`);
  lines.push(`  size TEXT,`);
  lines.push(`  variant TEXT,`);
  lines.push(`  sku TEXT UNIQUE NOT NULL,`);
  lines.push(`  stock_level INTEGER DEFAULT 0,`);
  lines.push(`  min_stock_threshold INTEGER DEFAULT 5,`);
  lines.push(`  retail_price REAL NOT NULL,`);
  lines.push(`  retail_price_secondary REAL,`);
  lines.push(`  cost_basis REAL NOT NULL,`);
  lines.push(`  cost_basis_secondary REAL,`);
  lines.push(`  vat_rate REAL DEFAULT 0.15,`);
  lines.push(`  taxable INTEGER DEFAULT 1,`);
  lines.push(`  vendor_id TEXT,`);
  lines.push(`  image_url TEXT,`);
  lines.push(`  created_at TEXT`);
  lines.push(`);`);
  lines.push(`CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);`);
  lines.push(`CREATE INDEX IF NOT EXISTS idx_inventory_vendor ON inventory(vendor_id);`);
  lines.push(``);
  if (Array.isArray(data.inventory) && data.inventory.length > 0) {
    for (const i of data.inventory) {
      lines.push(
        `INSERT OR REPLACE INTO inventory VALUES (` +
          `${sqlEscape(i.id)}, ` +
          `${sqlEscape(i.name)}, ` +
          `${sqlEscape(i.brand)}, ` +
          `${sqlEscape(i.category)}, ` +
          `${sqlEscape(i.productLine)}, ` +
          `${sqlEscape(i.size)}, ` +
          `${sqlEscape(i.variant)}, ` +
          `${sqlEscape(i.sku)}, ` +
          `${sqlEscape(i.stockLevel)}, ` +
          `${sqlEscape(i.minStockThreshold)}, ` +
          `${sqlEscape(i.retailPrice)}, ` +
          `${sqlEscape(i.retailPriceSecondary)}, ` +
          `${sqlEscape(i.costBasis)}, ` +
          `${sqlEscape(i.costBasisSecondary)}, ` +
          `${sqlEscape(i.vatRate ?? 0.15)}, ` +
          `${sqlEscape(i.taxable !== false ? 1 : 0)}, ` +
          `${sqlEscape(i.vendorId)}, ` +
          `${sqlEscape(i.imageUrl)}, ` +
          `${sqlEscape(i.createdAt || timestamp)}` +
          `);`
      );
    }
    lines.push(``);
  }

  // 5. CUSTOMERS TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: customers`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS customers (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  name TEXT NOT NULL,`);
  lines.push(`  phone TEXT,`);
  lines.push(`  email TEXT,`);
  lines.push(`  membership_tier TEXT DEFAULT 'Bronze',`);
  lines.push(`  loyalty_points INTEGER DEFAULT 0,`);
  lines.push(`  notes TEXT,`);
  lines.push(`  registered_at TEXT`);
  lines.push(`);`);
  lines.push(``);
  if (Array.isArray(data.customers) && data.customers.length > 0) {
    for (const c of data.customers) {
      lines.push(
        `INSERT OR REPLACE INTO customers VALUES (` +
          `${sqlEscape(c.id)}, ` +
          `${sqlEscape(c.name)}, ` +
          `${sqlEscape(c.phone)}, ` +
          `${sqlEscape(c.email)}, ` +
          `${sqlEscape(c.membershipTier || 'Bronze')}, ` +
          `${sqlEscape(c.loyaltyPoints ?? 0)}, ` +
          `${sqlEscape(c.notes)}, ` +
          `${sqlEscape(c.registeredAt || timestamp)}` +
          `);`
      );
    }
    lines.push(``);
  }

  // 6. TRANSACTIONS TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: transactions`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS transactions (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  receipt_number TEXT UNIQUE,`);
  lines.push(`  timestamp TEXT NOT NULL,`);
  lines.push(`  cashier_name TEXT,`);
  lines.push(`  customer_id TEXT,`);
  lines.push(`  customer_name TEXT,`);
  lines.push(`  customer_phone TEXT,`);
  lines.push(`  subtotal REAL NOT NULL,`);
  lines.push(`  vat_total REAL NOT NULL,`);
  lines.push(`  discount REAL DEFAULT 0.00,`);
  lines.push(`  discount_type TEXT,`);
  lines.push(`  discount_value REAL,`);
  lines.push(`  total REAL NOT NULL,`);
  lines.push(`  payment_method TEXT NOT NULL,`);
  lines.push(`  cash_given REAL,`);
  lines.push(`  change_due REAL,`);
  lines.push(`  currency_used TEXT,`);
  lines.push(`  exchange_rate_used REAL,`);
  lines.push(`  secondary_total REAL,`);
  lines.push(`  items_json TEXT,`);
  lines.push(`  is_refund INTEGER DEFAULT 0,`);
  lines.push(`  refund_reason TEXT,`);
  lines.push(`  original_receipt_number TEXT`);
  lines.push(`);`);
  lines.push(`CREATE INDEX IF NOT EXISTS idx_transactions_receipt ON transactions(receipt_number);`);
  lines.push(`CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);`);
  lines.push(``);
  if (Array.isArray(data.transactions) && data.transactions.length > 0) {
    for (const t of data.transactions) {
      lines.push(
        `INSERT OR REPLACE INTO transactions VALUES (` +
          `${sqlEscape(t.id)}, ` +
          `${sqlEscape(t.receiptNumber)}, ` +
          `${sqlEscape(t.timestamp)}, ` +
          `${sqlEscape(t.cashierName)}, ` +
          `${sqlEscape(t.customerId)}, ` +
          `${sqlEscape(t.customerName)}, ` +
          `${sqlEscape(t.customerPhone)}, ` +
          `${sqlEscape(t.subtotal)}, ` +
          `${sqlEscape(t.vatTotal || t.tax || 0)}, ` +
          `${sqlEscape(t.discount ?? 0)}, ` +
          `${sqlEscape(t.discountType)}, ` +
          `${sqlEscape(t.discountValue)}, ` +
          `${sqlEscape(t.total)}, ` +
          `${sqlEscape(t.paymentMethod)}, ` +
          `${sqlEscape(t.cashGiven)}, ` +
          `${sqlEscape(t.changeDue)}, ` +
          `${sqlEscape(t.currencyUsed)}, ` +
          `${sqlEscape(t.exchangeRateUsed)}, ` +
          `${sqlEscape(t.secondaryTotal)}, ` +
          `${sqlEscape(t.items)}, ` +
          `${sqlEscape(t.isRefund ? 1 : 0)}, ` +
          `${sqlEscape(t.refundReason)}, ` +
          `${sqlEscape(t.originalReceiptNumber)}` +
          `);`
      );
    }
    lines.push(``);
  }

  // 7. EOD SESSIONS TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: eod_sessions`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS eod_sessions (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  date TEXT NOT NULL,`);
  lines.push(`  opened_at TEXT NOT NULL,`);
  lines.push(`  closed_at TEXT,`);
  lines.push(`  starting_float REAL DEFAULT 0.00,`);
  lines.push(`  cash_sales REAL DEFAULT 0.00,`);
  lines.push(`  card_sales REAL DEFAULT 0.00,`);
  lines.push(`  paid_in_total REAL DEFAULT 0.00,`);
  lines.push(`  paid_out_total REAL DEFAULT 0.00,`);
  lines.push(`  cash_drop_total REAL DEFAULT 0.00,`);
  lines.push(`  expected_cash REAL DEFAULT 0.00,`);
  lines.push(`  actual_cash REAL,`);
  lines.push(`  cash_difference REAL,`);
  lines.push(`  status TEXT DEFAULT 'open',`);
  lines.push(`  closed_by TEXT,`);
  lines.push(`  notes TEXT`);
  lines.push(`);`);
  lines.push(``);
  if (Array.isArray(data.eodSessions) && data.eodSessions.length > 0) {
    for (const e of data.eodSessions) {
      lines.push(
        `INSERT OR REPLACE INTO eod_sessions VALUES (` +
          `${sqlEscape(e.id)}, ` +
          `${sqlEscape(e.date)}, ` +
          `${sqlEscape(e.openedAt)}, ` +
          `${sqlEscape(e.closedAt)}, ` +
          `${sqlEscape(e.startingFloat)}, ` +
          `${sqlEscape(e.cashSales)}, ` +
          `${sqlEscape(e.cardSales)}, ` +
          `${sqlEscape(e.paidInTotal)}, ` +
          `${sqlEscape(e.paidOutTotal)}, ` +
          `${sqlEscape(e.cashDropTotal)}, ` +
          `${sqlEscape(e.expectedCash)}, ` +
          `${sqlEscape(e.actualCash)}, ` +
          `${sqlEscape(e.cashDifference)}, ` +
          `${sqlEscape(e.status)}, ` +
          `${sqlEscape(e.closedBy)}, ` +
          `${sqlEscape(e.notes)}` +
          `);`
      );
    }
    lines.push(``);
  }

  // 8. DRAWER AUDIT LOGS TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: drawer_logs`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS drawer_logs (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  session_id TEXT,`);
  lines.push(`  timestamp TEXT NOT NULL,`);
  lines.push(`  event_type TEXT NOT NULL,`);
  lines.push(`  amount REAL,`);
  lines.push(`  staff_name TEXT,`);
  lines.push(`  reason TEXT,`);
  lines.push(`  current_float_after REAL`);
  lines.push(`);`);
  lines.push(``);
  if (Array.isArray(data.drawerLogs) && data.drawerLogs.length > 0) {
    for (const d of data.drawerLogs) {
      lines.push(
        `INSERT OR REPLACE INTO drawer_logs VALUES (` +
          `${sqlEscape(d.id)}, ` +
          `${sqlEscape(d.sessionId)}, ` +
          `${sqlEscape(d.timestamp)}, ` +
          `${sqlEscape(d.eventType)}, ` +
          `${sqlEscape(d.amount)}, ` +
          `${sqlEscape(d.staffName)}, ` +
          `${sqlEscape(d.reason)}, ` +
          `${sqlEscape(d.currentFloatAfter)}` +
          `);`
      );
    }
    lines.push(``);
  }

  // 9. CONSIGNMENT PAYOUTS TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: payouts`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS payouts (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  vendor_id TEXT NOT NULL,`);
  lines.push(`  vendor_name TEXT,`);
  lines.push(`  period_start TEXT,`);
  lines.push(`  period_end TEXT,`);
  lines.push(`  total_units_sold INTEGER DEFAULT 0,`);
  lines.push(`  total_gross_sales REAL DEFAULT 0.00,`);
  lines.push(`  house_commission REAL DEFAULT 0.00,`);
  lines.push(`  payout_amount REAL NOT NULL,`);
  lines.push(`  status TEXT DEFAULT 'pending',`);
  lines.push(`  paid_at TEXT,`);
  lines.push(`  notes TEXT`);
  lines.push(`);`);
  lines.push(``);
  if (Array.isArray(data.payouts) && data.payouts.length > 0) {
    for (const p of data.payouts) {
      lines.push(
        `INSERT OR REPLACE INTO payouts VALUES (` +
          `${sqlEscape(p.id)}, ` +
          `${sqlEscape(p.vendorId)}, ` +
          `${sqlEscape(p.vendorName)}, ` +
          `${sqlEscape(p.periodStart)}, ` +
          `${sqlEscape(p.periodEnd)}, ` +
          `${sqlEscape(p.totalUnitsSold)}, ` +
          `${sqlEscape(p.totalGrossSales)}, ` +
          `${sqlEscape(p.houseCommission)}, ` +
          `${sqlEscape(p.payoutAmount)}, ` +
          `${sqlEscape(p.status)}, ` +
          `${sqlEscape(p.paidAt)}, ` +
          `${sqlEscape(p.notes)}` +
          `);`
      );
    }
    lines.push(``);
  }

  // 10. VENDOR ADVANCES TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: vendor_advances`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS vendor_advances (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  vendor_id TEXT NOT NULL,`);
  lines.push(`  vendor_name TEXT,`);
  lines.push(`  amount REAL NOT NULL,`);
  lines.push(`  date TEXT NOT NULL,`);
  lines.push(`  note TEXT,`);
  lines.push(`  recorded_by TEXT`);
  lines.push(`);`);
  lines.push(``);
  if (Array.isArray(data.vendorAdvances) && data.vendorAdvances.length > 0) {
    for (const a of data.vendorAdvances) {
      lines.push(
        `INSERT OR REPLACE INTO vendor_advances VALUES (` +
          `${sqlEscape(a.id)}, ` +
          `${sqlEscape(a.vendorId)}, ` +
          `${sqlEscape(a.vendorName)}, ` +
          `${sqlEscape(a.amount)}, ` +
          `${sqlEscape(a.date)}, ` +
          `${sqlEscape(a.note)}, ` +
          `${sqlEscape(a.recordedBy)}` +
          `);`
      );
    }
    lines.push(``);
  }

  // 11. INVOICES TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: invoices`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS invoices (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  invoice_number TEXT UNIQUE NOT NULL,`);
  lines.push(`  customer_name TEXT NOT NULL,`);
  lines.push(`  customer_contact TEXT,`);
  lines.push(`  lines_json TEXT,`);
  lines.push(`  notes TEXT,`);
  lines.push(`  status TEXT DEFAULT 'draft',`);
  lines.push(`  payments_json TEXT,`);
  lines.push(`  created_at TEXT,`);
  lines.push(`  created_by TEXT`);
  lines.push(`);`);
  lines.push(``);
  if (Array.isArray(data.invoices) && data.invoices.length > 0) {
    for (const inv of data.invoices) {
      lines.push(
        `INSERT OR REPLACE INTO invoices VALUES (` +
          `${sqlEscape(inv.id)}, ` +
          `${sqlEscape(inv.invoiceNumber)}, ` +
          `${sqlEscape(inv.customerName)}, ` +
          `${sqlEscape(inv.customerContact)}, ` +
          `${sqlEscape(inv.lines)}, ` +
          `${sqlEscape(inv.notes)}, ` +
          `${sqlEscape(inv.status)}, ` +
          `${sqlEscape(inv.payments)}, ` +
          `${sqlEscape(inv.createdAt)}, ` +
          `${sqlEscape(inv.createdBy)}` +
          `);`
      );
    }
    lines.push(``);
  }

  // 12. STAFF USERS TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: staff_users`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS staff_users (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  name TEXT NOT NULL,`);
  lines.push(`  username TEXT NOT NULL,`);
  lines.push(`  pin TEXT NOT NULL,`);
  lines.push(`  role TEXT NOT NULL,`);
  lines.push(`  status TEXT DEFAULT 'active',`);
  lines.push(`  created_at TEXT`);
  lines.push(`);`);
  lines.push(``);
  if (Array.isArray(data.staff) && data.staff.length > 0) {
    for (const u of data.staff) {
      lines.push(
        `INSERT OR REPLACE INTO staff_users VALUES (` +
          `${sqlEscape(u.id)}, ` +
          `${sqlEscape(u.name)}, ` +
          `${sqlEscape(u.username)}, ` +
          `${sqlEscape(u.pin)}, ` +
          `${sqlEscape(u.role)}, ` +
          `${sqlEscape(u.status || 'active')}, ` +
          `${sqlEscape(u.createdAt)}` +
          `);`
      );
    }
    lines.push(``);
  }

  // 13. CUSTOMER FEEDBACK TABLE
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: customer_feedback`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS customer_feedback (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  receipt_number TEXT,`);
  lines.push(`  rating INTEGER,`);
  lines.push(`  category TEXT,`);
  lines.push(`  comments TEXT,`);
  lines.push(`  timestamp TEXT`);
  lines.push(`);`);
  lines.push(``);
  if (Array.isArray(data.feedback) && data.feedback.length > 0) {
    for (const fb of data.feedback) {
      lines.push(
        `INSERT OR REPLACE INTO customer_feedback VALUES (` +
          `${sqlEscape(fb.id)}, ` +
          `${sqlEscape(fb.receiptNumber)}, ` +
          `${sqlEscape(fb.rating)}, ` +
          `${sqlEscape(fb.category)}, ` +
          `${sqlEscape(fb.comments)}, ` +
          `${sqlEscape(fb.timestamp)}` +
          `);`
      );
    }
    lines.push(``);
  }

  // 14. LOSSLESS RESTORE MANIFEST
  // The relational dump is nice for SQLite / DBeaver / DB Browser, but it only
  // carries a subset of fields per table and the app can't rebuild every nested
  // object from it. So we also embed the full runtime state (base64 JSON) here.
  // importBackup() recognizes this manifest and does a complete, lossless restore
  // from a produced .db / .sql file — not just the handful of settings columns.
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`-- Table structure for: backup_manifest (lossless restore payload)`);
  lines.push(`-- ----------------------------------------------------------`);
  lines.push(`CREATE TABLE IF NOT EXISTS backup_manifest (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  json TEXT`);
  lines.push(`);`);
  lines.push(``);
  const manifestJson = JSON.stringify({
    app: 'The Gift Shop POS',
    exportedAt: timestamp,
    vendors: Array.isArray(data.vendors) ? data.vendors : [],
    inventory: Array.isArray(data.inventory) ? data.inventory : [],
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    payouts: Array.isArray(data.payouts) ? data.payouts : [],
    eodSessions: Array.isArray(data.eodSessions) ? data.eodSessions : [],
    settings: data.settings || undefined,
    staff: Array.isArray(data.staff) ? data.staff : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    drawerLogs: Array.isArray(data.drawerLogs) ? data.drawerLogs : [],
    customers: Array.isArray(data.customers) ? data.customers : [],
    vendorAdvances: Array.isArray(data.vendorAdvances) ? data.vendorAdvances : [],
    invoices: Array.isArray(data.invoices) ? data.invoices : [],
    feedback: Array.isArray(data.feedback) ? data.feedback : [],
  });
  lines.push(`INSERT OR REPLACE INTO backup_manifest (id, json) VALUES ('manifest', '${utf8ToBase64(manifestJson)}');`);
  lines.push(``);

  lines.push(`COMMIT;`);
  lines.push(`-- Backup dump completed successfully.`);
  lines.push(``);

  return lines.join('\n');
}

/**
 * Initiates a browser download for a .db / .sqlite file.
 */
export function downloadSQLiteDbFile(filename: string, sqlContent: string): void {
  const safeFilename = filename.endsWith('.db') ? filename : `${filename}.db`;
  const blob = new Blob([sqlContent], { type: 'application/vnd.sqlite3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Initiates a browser download for a JSON backup file.
 */
export function downloadJsonBackup(filename: string, jsonContent: string): void {
  const safeFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
