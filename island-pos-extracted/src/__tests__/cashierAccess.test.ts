import { describe, it, expect } from 'vitest';
import { StaffRole, StaffUser } from '../types/pos';
import {
  ALL_CASHIER_ACCESS_AREAS,
  CASHIER_GATE_OPTIONS,
  CASHIER_GATE_GROUPS,
  DEFAULT_STAFF_CASHIER_ACCESS,
  CASHIER_ACCESS_TIERS,
  applyAccessTierPreset,
  roleForAccessTier,
  getEffectiveCashierAccess,
  summarizeCashierAccess,
} from '../utils/cashierAccess';

function makeStaff(role: StaffRole, cashierAccess?: Partial<Record<string, boolean>>): StaffUser {
  return {
    id: 's1',
    name: 'Test Staff',
    username: 'test',
    pin: '1234',
    role,
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...(cashierAccess ? { cashierAccess } : {}),
  } as StaffUser;
}

describe('getEffectiveCashierAccess', () => {
  it('gives admins full access regardless of stored gates or global map', () => {
    const admin = makeStaff('admin', { pos: false, reports: false });
    const global = { ...DEFAULT_STAFF_CASHIER_ACCESS, pos: false, reports: false };
    const resolved = getEffectiveCashierAccess(admin, { cashierAccess: global });
    for (const area of ALL_CASHIER_ACCESS_AREAS) {
      expect(resolved[area]).toBe(true);
    }
  });

  it('uses the staff member’s own gates when present, over the global map', () => {
    const staff = makeStaff('cashier', { refunds: true, reports: true });
    const global = { ...DEFAULT_STAFF_CASHIER_ACCESS, refunds: false, reports: false };
    const resolved = getEffectiveCashierAccess(staff, { cashierAccess: global });
    expect(resolved.refunds).toBe(true);
    expect(resolved.reports).toBe(true);
    // Untouched gates still resolve from the baseline
    expect(resolved.pos).toBe(true);
    expect(resolved.discounts).toBe(true);
    expect(resolved.reports_pnl).toBe(false);
  });

  it('falls back to the standard baseline for keys the staff map omits', () => {
    const staff = makeStaff('cashier', { refunds: true });
    const resolved = getEffectiveCashierAccess(staff, { cashierAccess: undefined });
    expect(resolved.refunds).toBe(true);
    expect(resolved.reports_eod).toBe(true); // baseline default
    expect(resolved.reports_pnl).toBe(false); // baseline default
  });

  it('legacy staff without own gates inherit the global store map', () => {
    const staff = makeStaff('cashier');
    const global = { ...DEFAULT_STAFF_CASHIER_ACCESS, refunds: true, reports_pnl: true };
    const resolved = getEffectiveCashierAccess(staff, { cashierAccess: global });
    expect(resolved.refunds).toBe(true);
    expect(resolved.reports_pnl).toBe(true);
    expect(resolved.settings).toBe(false);
    expect(resolved.staff).toBe(false);
  });

  it('with no staff and no global map, returns the standard baseline', () => {
    const resolved = getEffectiveCashierAccess(null, undefined);
    expect(resolved).toEqual(DEFAULT_STAFF_CASHIER_ACCESS);
  });
});

describe('tier presets', () => {
  it('standard cashier baseline enables register essentials only', () => {
    const baseline = applyAccessTierPreset('cashier');
    expect(baseline.pos).toBe(true);
    expect(baseline.discounts).toBe(true);
    expect(baseline.damaged_markdowns).toBe(true);
    expect(baseline.reports_eod).toBe(true);
    expect(baseline.eod_close).toBe(true);
    expect(baseline.refunds).toBe(false);
    expect(baseline.reports).toBe(false);
    expect(baseline.settings).toBe(false);
    expect(baseline.staff).toBe(false);
  });

  it('senior cashier adds refunds', () => {
    const senior = applyAccessTierPreset('senior_cashier');
    expect(senior.refunds).toBe(true);
    expect(senior.manual_drawer_open).toBe(false);
    expect(senior.reports_history).toBe(false);
  });

  it('shift lead adds refunds, manual drawer and history', () => {
    const lead = applyAccessTierPreset('shift_lead');
    expect(lead.refunds).toBe(true);
    expect(lead.manual_drawer_open).toBe(true);
    expect(lead.reports_history).toBe(true);
    expect(lead.reports_pnl).toBe(false);
  });

  it('administrator enables every area', () => {
    const admin = applyAccessTierPreset('admin');
    for (const area of ALL_CASHIER_ACCESS_AREAS) {
      expect(admin[area]).toBe(true);
    }
  });

  it('maps tiers to staff roles for supervisor PIN authority', () => {
    expect(roleForAccessTier('cashier')).toBe('cashier');
    expect(roleForAccessTier('senior_cashier')).toBe('senior_cashier');
    expect(roleForAccessTier('shift_lead')).toBe('shift_lead');
    expect(roleForAccessTier('admin')).toBe('admin');
    expect(roleForAccessTier('custom')).toBeNull();
  });

  it('exposes exactly the documented tiers', () => {
    expect(CASHIER_ACCESS_TIERS.map((t) => t.tier)).toEqual([
      'cashier',
      'senior_cashier',
      'shift_lead',
      'admin',
      'custom',
    ]);
  });
});

describe('summarizeCashierAccess', () => {
  it('returns a placeholder when no gates are enabled', () => {
    expect(summarizeCashierAccess(undefined)).toBe('Register only');
    expect(summarizeCashierAccess({})).toBe('Register only');
  });

  it('lists enabled gates by label', () => {
    const summary = summarizeCashierAccess({ discounts: true, refunds: true });
    expect(summary).toContain('Apply order discounts');
    expect(summary).toContain('Process refunds & returns');
  });

  it('truncates long lists with a +N more suffix', () => {
    const access = { discounts: true, refunds: true, damaged_markdowns: true, manual_drawer_open: true, reports: true };
    const summary = summarizeCashierAccess(access, 3);
    expect(summary.endsWith('+2 more')).toBe(true);
  });
});

describe('gate metadata consistency', () => {
  it('every editable gate belongs to a known group and a valid area', () => {
    const groups = CASHIER_GATE_GROUPS.map((g) => g.group);
    for (const opt of CASHIER_GATE_OPTIONS) {
      expect(groups).toContain(opt.group);
      expect(ALL_CASHIER_ACCESS_AREAS).toContain(opt.area);
      expect(DEFAULT_STAFF_CASHIER_ACCESS[opt.area]).toBeDefined();
    }
  });

  it('never offers admin-only or implicit areas as editable gates', () => {
    const offered = CASHIER_GATE_OPTIONS.map((o) => o.area);
    expect(offered).not.toContain('pos');
    expect(offered).not.toContain('settings');
    expect(offered).not.toContain('staff');
  });
});

