/**
 * Business-document maths engine.
 *
 * Implements the spreadsheet formulas from the store's invoice/quote/purchase
 * order/invoice-tracker worksheet layouts exactly:
 *  - line amount      = ROUND(Qty × Unit Price, 2)   (empty Qty counts as 1)
 *  - subtotal         = Σ line amounts
 *  - taxable subtotal = Σ taxed lines (per-line mode) or the whole subtotal
 *  - tax due          = ROUND(taxable × rate, 2)
 *  - total            = Subtotal + Tax due + Other (shipping / discount)
 *  - outstanding      = Amount − Total Paid
 *  - age              = MAX(0, today − due date) in days (drafts excluded)
 *  - aging buckets    = Current / 1-30 / 31-60 / 61-90 / >90 days past due
 *
 * All money values are rounded to 2 decimal places at each step, matching the
 * ROUND(...) behaviour of the source templates.
 */
import { Invoice, InvoiceLine, StoreSettings } from '../types/pos';

export type AgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'over90';

export type EffectiveInvoiceStatus =
  | 'draft'
  | 'open'
  | 'partial'
  | 'paid'
  | 'cancelled'
  | 'overdue';

export interface InvoiceTotals {
  lineAmounts: number[];
  subtotal: number;
  taxableSubtotal: number;
  taxDue: number;
  other: number;
  total: number;
  paid: number;
  outstanding: number;
  /** Days past the due date (0 on/before due date); null when no due date. */
  ageDays: number | null;
  agingBucket: AgingBucket | null;
  isOverdue: boolean;
  effectiveStatus: EffectiveInvoiceStatus;
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** UTC-midnight day difference (b - a) in whole days — immune to DST shifts. */
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

/** Parse an ISO date-ish string to a local Date at midnight; null if invalid. */
export function parseDay(value: string | undefined | null): Date | null {
  if (!value) return null;
  // Date-only strings ('YYYY-MM-DD') must NOT go through new Date(), which
  // interprets them as UTC midnight and shifts the calendar day in timezones
  // behind UTC.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Day portion (local midnight) of an invoice's issue date; defaults to today. */
export function invoiceIssueDate(inv: Invoice, today: Date = new Date()): Date {
  return parseDay(inv.issueDate) || parseDay(inv.createdAt) || new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export const TERMS_DAYS: Record<string, number> = {
  due_on_receipt: 0,
  net_15: 15,
  net_30: 30,
  net_60: 60,
};

export const TERMS_LABEL: Record<string, string> = {
  due_on_receipt: 'Due on Receipt',
  net_15: 'Net 15 Days',
  net_30: 'Net 30 Days',
  net_60: 'Net 60 Days',
  custom: 'Custom Terms',
};

/** DUE DATE = issue date + terms days (custom terms use the stored dueDate as-is). */
export function dueDateFromTerms(issueDate: Date, terms: string | undefined): Date {
  const days = TERMS_DAYS[terms || 'net_30'] ?? 30;
  const d = new Date(issueDate.getFullYear(), issueDate.getMonth(), issueDate.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/** Resolved due date for an invoice (stored custom dueDate wins). */
export function invoiceDueDate(inv: Invoice, today: Date = new Date()): Date | null {
  if (inv.dueDate) {
    const parsed = parseDay(inv.dueDate);
    if (parsed) return parsed;
  }
  if (inv.terms && inv.terms !== 'custom') {
    return dueDateFromTerms(invoiceIssueDate(inv, today), inv.terms);
  }
  return null;
}

/** VALID UNTIL for quotes = issue date + 30 days (template default). */
export function validUntilFromIssue(issueDate: Date): Date {
  return dueDateFromTerms(issueDate, 'net_30');
}

/** Line amount = ROUND(Qty × Unit Price, 2); an empty/0 qty counts as 1. */
export function lineAmount(line: InvoiceLine): number {
  const qty = Number.isFinite(line.quantity) && line.quantity !== 0 ? line.quantity : 1;
  return round2(qty * (Number.isFinite(line.unitPrice) ? line.unitPrice : 0));
}

/** Effective tax rate: stored per-invoice rate, else the store default VAT. */
export function effectiveTaxRate(inv: Invoice, settings?: Pick<StoreSettings, 'defaultVatRate'> | null): number {
  if (typeof inv.taxRate === 'number' && Number.isFinite(inv.taxRate)) return inv.taxRate;
  const fallback = settings?.defaultVatRate;
  return typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : 0;
}

export function bucketForAge(ageDays: number): AgingBucket {
  if (ageDays <= 0) return 'current';
  if (ageDays <= 30) return 'd1_30';
  if (ageDays <= 60) return 'd31_60';
  if (ageDays <= 90) return 'd61_90';
  return 'over90';
}

export const AGING_BUCKET_LABEL: Record<AgingBucket, string> = {
  current: 'Current',
  d1_30: '1 - 30',
  d31_60: '31 - 60',
  d61_90: '61 - 90',
  over90: '> 90',
};

/** Legacy stored status → presentation status (adds derived 'overdue'/'open'). */
export function deriveStatus(
  inv: Invoice,
  total: number,
  outstanding: number,
  ageDays: number | null
): EffectiveInvoiceStatus {
  if (inv.status === 'cancelled') return 'cancelled';
  const hasPayments = (inv.payments || []).some((p) => p.amount > 0);
  if (inv.status === 'draft' && !hasPayments) return 'draft';
  if (total > 0 && outstanding <= 0) return 'paid';
  if (outstanding > 0 && ageDays !== null && ageDays > 0) return 'overdue';
  if (hasPayments) return 'partial';
  return 'open';
}

/**
 * Full totals computation for one document. `today` is injectable for tests.
 */
export function computeInvoiceTotals(
  inv: Invoice,
  today: Date = new Date(),
  settings?: Pick<StoreSettings, 'defaultVatRate'> | null
): InvoiceTotals {
  const lineAmounts = (inv.lines || []).map(lineAmount);
  const subtotal = round2(lineAmounts.reduce((s, a) => s + a, 0));

  const taxMode = inv.taxMode || 'none';
  let taxableSubtotal = 0;
  if (taxMode === 'subtotal') {
    taxableSubtotal = subtotal;
  } else if (taxMode === 'per_line') {
    taxableSubtotal = round2(
      (inv.lines || []).reduce((s, l) => s + (l.taxed ? lineAmount(l) : 0), 0)
    );
  }
  const taxDue = taxMode === 'none' ? 0 : round2(taxableSubtotal * effectiveTaxRate(inv, settings));
  const other = round2(Number.isFinite(inv.otherAmount as number) ? (inv.otherAmount as number) : 0);
  const total = round2(subtotal + taxDue + other);

  const paid = round2(
    (inv.payments || []).reduce((s, p) => s + (Number.isFinite(p.amount) ? p.amount : 0), 0)
  );
  const outstanding = round2(total - paid);

  const due = invoiceDueDate(inv, today);
  const ageDays = due === null ? null : Math.max(0, daysBetween(due, today));
  const agingBucket = ageDays === null ? null : bucketForAge(ageDays);
  const isOverdue = outstanding > 0 && ageDays !== null && ageDays > 0;

  return {
    lineAmounts,
    subtotal,
    taxableSubtotal,
    taxDue,
    other,
    total,
    paid,
    outstanding,
    ageDays,
    agingBucket,
    isOverdue,
    effectiveStatus: deriveStatus(inv, total, outstanding, ageDays),
  };
}

export interface AgingSummary {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  over90: number;
  totalOutstanding: number;
  overdueCount: number;
  overdueTotal: number;
}

/**
 * Aging summary across all documents (tracker layout). Drafts and cancelled
 * documents are excluded from the buckets, like the spreadsheet's aging block.
 */
export function agingSummary(
  invoices: Invoice[],
  today: Date = new Date(),
  settings?: Pick<StoreSettings, 'defaultVatRate'> | null
): AgingSummary {
  const summary: AgingSummary = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    over90: 0,
    totalOutstanding: 0,
    overdueCount: 0,
    overdueTotal: 0,
  };
  for (const inv of invoices) {
    const t = computeInvoiceTotals(inv, today, settings);
    if (t.effectiveStatus === 'draft' || t.effectiveStatus === 'cancelled') continue;
    if (t.outstanding <= 0) continue;
    summary.totalOutstanding = round2(summary.totalOutstanding + t.outstanding);
    if (t.isOverdue) {
      summary.overdueCount += 1;
      summary.overdueTotal = round2(summary.overdueTotal + t.outstanding);
    }
    switch (t.agingBucket) {
      case 'current': summary.current = round2(summary.current + t.outstanding); break;
      case 'd1_30': summary.d1_30 = round2(summary.d1_30 + t.outstanding); break;
      case 'd31_60': summary.d31_60 = round2(summary.d31_60 + t.outstanding); break;
      case 'd61_90': summary.d61_90 = round2(summary.d61_90 + t.outstanding); break;
      case 'over90': summary.over90 = round2(summary.over90 + t.outstanding); break;
    }
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Collections follow-up sequence
// ---------------------------------------------------------------------------

export interface FollowUpStageDef {
  stage: string;
  label: string;
  action: string;
  maxDays: number; // inclusive upper bound of days-overdue for this stage
}

export const FOLLOW_UP_SEQUENCE: FollowUpStageDef[] = [
  { stage: 'reminder', label: 'Friendly Reminder', action: 'Send a friendly payment reminder', maxDays: 7 },
  { stage: 'follow_up_1', label: 'First Follow-up', action: 'Call / email — payment is now overdue', maxDays: 30 },
  { stage: 'follow_up_2', label: 'Second Follow-up', action: 'Escalate contact — overdue 31+ days', maxDays: 60 },
  { stage: 'final_notice', label: 'Final Notice', action: 'Issue written final notice before collections', maxDays: 90 },
  { stage: 'collections', label: 'Collections', action: 'Escalate to collections / hand to ownership', maxDays: Infinity },
];

/** Sequence stage matching a given number of days overdue. */
export function stageForDays(daysOverdue: number): FollowUpStageDef {
  return FOLLOW_UP_SEQUENCE.find((s) => daysOverdue <= s.maxDays) || FOLLOW_UP_SEQUENCE[FOLLOW_UP_SEQUENCE.length - 1];
}

const stageIndex = (stage: string): number =>
  FOLLOW_UP_SEQUENCE.findIndex((s) => s.stage === stage);

export interface FollowUpSuggestion {
  daysOverdue: number;
  /** Stage the document currently sits at by age. */
  currentStage: FollowUpStageDef;
  /**
   * The next action to take: the age-based stage, or the following stage when
   * the current one has already been logged (so the sequence advances).
   */
  suggestedStage: FollowUpStageDef;
  alreadyLoggedCurrent: boolean;
  lastFollowUpDate: string | null;
}

/**
 * Follow-up suggestion for an overdue document, honouring the logged
 * follow-up history so repeated prompts escalate through the sequence.
 */
export function followUpSuggestion(inv: Invoice, today: Date = new Date()): FollowUpSuggestion | null {
  const t = computeInvoiceTotals(inv, today);
  if (t.ageDays === null || t.ageDays <= 0 || t.outstanding <= 0) return null;

  const currentStage = stageForDays(t.ageDays);
  const logged = inv.followUps || [];
  const last = logged.length > 0 ? logged.reduce((a, b) => (a.date > b.date ? a : b)) : null;
  const lastIdx = last ? stageIndex(last.stage) : -1;
  const currentIdx = stageIndex(currentStage.stage);
  const alreadyLoggedCurrent = lastIdx >= currentIdx;
  const nextIdx = Math.min(currentIdx + 1, FOLLOW_UP_SEQUENCE.length - 1);
  const suggestedStage = alreadyLoggedCurrent ? FOLLOW_UP_SEQUENCE[nextIdx] : currentStage;

  return {
    daysOverdue: t.ageDays,
    currentStage,
    suggestedStage,
    alreadyLoggedCurrent,
    lastFollowUpDate: last ? last.date : null,
  };
}
