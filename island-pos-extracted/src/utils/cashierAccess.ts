/**
 * Per-cashier security gate model.
 *
 * Historically one global `settings.cashierAccess` map governed every
 * non-admin session and was edited from a dedicated admin tab. Gates are now
 * picked per cashier account (StaffUser.cashierAccess) when the account is
 * created or edited. Staff records without their own gate map (e.g. legacy or
 * seeded accounts) keep following the global store map, so existing shops
 * behave exactly as before until gates are assigned per account.
 */
import { CashierAccessArea, StaffUser, StoreSettings } from '../types/pos';

export type CashierGateGroup = 'actions' | 'modules' | 'workspace';

export interface CashierGateOption {
  area: CashierAccessArea;
  group: CashierGateGroup;
  label: string;
  description?: string;
}

/**
 * Every gate an admin can toggle per cashier account. Mirrors the options
 * that used to live on the standalone "Cashier Access Restrictions & Security
 * Gates" tab. `pos` is always enabled for cashier sessions and `settings` /
 * `staff` remain admin-only, so they are not offered here.
 */
export const CASHIER_GATE_OPTIONS: CashierGateOption[] = [
  // Register Action Authorization Gates (Manager PIN prompted when disabled)
  { area: 'discounts', group: 'actions', label: 'Apply order discounts', description: 'Prompts Manager PIN when disabled' },
  { area: 'refunds', group: 'actions', label: 'Process refunds & returns', description: 'Prompts Manager PIN when disabled' },
  { area: 'damaged_markdowns', group: 'actions', label: 'Mark items damaged / markdown', description: 'Prompts Manager PIN when disabled' },
  { area: 'manual_drawer_open', group: 'actions', label: 'Manual cash drawer open', description: 'Prompts Manager PIN when disabled' },
  // Navigation & Management Modules
  { area: 'inventory', group: 'modules', label: 'View Inventory Catalog' },
  { area: 'inventory_edit', group: 'modules', label: 'Create & Edit Inventory Items' },
  { area: 'reports', group: 'modules', label: 'View Reports & Analytics Dashboard' },
  { area: 'vendors', group: 'modules', label: 'Vendor & Supplier Catalog' },
  { area: 'payouts', group: 'modules', label: 'Consignment Payout Settlements' },
  { area: 'invoices', group: 'modules', label: 'Wholesale Invoice Generation' },
  { area: 'eod_close', group: 'modules', label: 'End of Day Balancing & Cash Count' },
  // Workspace Configurator (standard cashier dashboards)
  { area: 'reports_eod', group: 'workspace', label: 'EOD Drawer Balancing & Verification', description: 'Declare closing cash and check register variance' },
  { area: 'reports_pnl', group: 'workspace', label: 'Financial P&L Reports Widget', description: 'Gross profits, margins and sales cost summaries' },
  { area: 'reports_heatmap', group: 'workspace', label: 'Sales Heatmap & Peak Hours Matrix', description: 'Hourly traffic intensity patterns and peak times' },
  { area: 'reports_forecasting', group: 'workspace', label: 'Sales Forecasting & Predictive Analytics', description: 'Predictive trendlines & future sales forecasts' },
  { area: 'reports_history', group: 'workspace', label: 'Transaction History & Receipts Log', description: 'View of the full historical receipts list' },
];

export const CASHIER_GATE_GROUPS: { group: CashierGateGroup; title: string }[] = [
  { group: 'actions', title: 'Register Action Security Gates' },
  { group: 'modules', title: 'Navigation & Management Modules' },
  { group: 'workspace', title: 'Reports Workspace Widgets' },
];

/** Every CashierAccessArea, including implicit / legacy areas. */
export const ALL_CASHIER_ACCESS_AREAS: CashierAccessArea[] = [
  'pos',
  'inventory',
  'inventory_view',
  'inventory_edit',
  'reports',
  'reports_eod',
  'reports_pnl',
  'reports_history',
  'reports_forecasting',
  'reports_heatmap',
  'vendors',
  'payouts',
  'invoices',
  'settings',
  'staff',
  'discounts',
  'refunds',
  'damaged_markdowns',
  'manual_drawer_open',
  'eod_close',
];

/**
 * Baseline gate map for a standard cashier account. Values mirror the store's
 * DEFAULT_SETTINGS.cashierAccess so accounts created before per-cashier gates
 * existed behave identically.
 */
export const DEFAULT_STAFF_CASHIER_ACCESS: Record<CashierAccessArea, boolean> = {
  pos: true,
  inventory: true,
  inventory_view: true,
  inventory_edit: true,
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
  eod_close: true,
};

const FULL_ACCESS: Record<CashierAccessArea, boolean> = ALL_CASHIER_ACCESS_AREAS.reduce(
  (acc, area) => {
    acc[area] = true;
    return acc;
  },
  {} as Record<CashierAccessArea, boolean>
);

/**
 * Access tier presets. Selecting a tier prefills the per-cashier gate picker
 * (the admin can still fine-tune individual gates) and maps to the stored
 * StaffRole so supervisor PIN authority keeps working.
 */
export type CashierAccessTier = 'cashier' | 'senior_cashier' | 'shift_lead' | 'admin' | 'custom';

export const CASHIER_ACCESS_TIERS: {
  tier: CashierAccessTier;
  label: string;
  role: 'cashier' | 'senior_cashier' | 'shift_lead' | 'admin' | null;
}[] = [
  { tier: 'cashier', label: 'Standard Cashier (Register & Discounts)', role: 'cashier' },
  { tier: 'senior_cashier', label: 'Senior Cashier (Register + Refunds)', role: 'senior_cashier' },
  { tier: 'shift_lead', label: 'Shift Lead (Refunds, Drawer & EOD Closing)', role: 'shift_lead' },
  { tier: 'admin', label: 'Administrator (Full Access)', role: 'admin' },
  { tier: 'custom', label: 'Custom (Manual Gate Selection)', role: null },
];

/** Gate map for a given tier preset. `custom` returns the standard baseline. */
export function applyAccessTierPreset(tier: CashierAccessTier): Record<CashierAccessArea, boolean> {
  switch (tier) {
    case 'admin':
      return { ...FULL_ACCESS };
    case 'senior_cashier':
      return { ...DEFAULT_STAFF_CASHIER_ACCESS, refunds: true };
    case 'shift_lead':
      return {
        ...DEFAULT_STAFF_CASHIER_ACCESS,
        refunds: true,
        manual_drawer_open: true,
        reports_history: true,
      };
    case 'cashier':
    case 'custom':
    default:
      return { ...DEFAULT_STAFF_CASHIER_ACCESS };
  }
}

/** Role stored for a tier preset (null = keep whatever the form had). */
export function roleForAccessTier(tier: CashierAccessTier): 'cashier' | 'senior_cashier' | 'shift_lead' | 'admin' | null {
  const found = CASHIER_ACCESS_TIERS.find((t) => t.tier === tier);
  return found ? found.role : null;
}

/**
 * Resolve the effective gate map for the staff member currently driving a
 * session:
 *  - admins always get full access;
 *  - staff with their own per-account gates use them (missing keys fall back
 *    to the standard cashier baseline);
 *  - everyone else inherits the global store cashierAccess map (legacy).
 */
export function getEffectiveCashierAccess(
  staff: StaffUser | null | undefined,
  settings: Pick<StoreSettings, 'cashierAccess'> | null | undefined
): Record<CashierAccessArea, boolean> {
  if (staff?.role === 'admin') {
    return { ...FULL_ACCESS };
  }

  const own = staff?.cashierAccess;
  if (own && Object.keys(own).length > 0) {
    return { ...DEFAULT_STAFF_CASHIER_ACCESS, ...own };
  }

  return { ...DEFAULT_STAFF_CASHIER_ACCESS, ...(settings?.cashierAccess || {}) };
}

/**
 * Short human-readable summary of enabled gates for table badges,
 * e.g. "Register only" or "Apply order discounts, Process refunds & returns +2 more".
 */
export function summarizeCashierAccess(
  access: Partial<Record<CashierAccessArea, boolean>> | null | undefined,
  maxListed = 4
): string {
  const enabledLabels = CASHIER_GATE_OPTIONS.filter((opt) => access?.[opt.area] === true).map((opt) => opt.label);
  if (enabledLabels.length === 0) {
    return 'Register only';
  }
  const listed = enabledLabels.slice(0, maxListed).join(', ');
  const remaining = enabledLabels.length - Math.min(maxListed, enabledLabels.length);
  return remaining > 0 ? `${listed} +${remaining} more` : listed;
}