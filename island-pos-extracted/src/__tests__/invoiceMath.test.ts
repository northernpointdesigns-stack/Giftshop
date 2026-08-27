import { describe, it, expect } from 'vitest';
import { Invoice, InvoiceKind } from '../types/pos';
import {
  agingSummary,
  bucketForAge,
  computeInvoiceTotals,
  dueDateFromTerms,
  followUpSuggestion,
  lineAmount,
  validUntilFromIssue,
  FOLLOW_UP_SEQUENCE,
} from '../utils/invoiceMath';
import { buildBusinessDocumentHtml, buildCustomerStatementHtml } from '../utils/printBusinessDocument';

function makeInvoice(patch: Partial<Invoice> = {}): Invoice {
  return {
    id: 'D1',
    invoiceNumber: 'INV-2026-0001',
    kind: 'invoice' as InvoiceKind,
    customerName: 'Test Customer',
    lines: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    status: 'sent',
    payments: [],
    createdAt: '2026-08-01',
    createdBy: 'Admin',
    issueDate: '2026-08-01',
    terms: 'net_30',
    followUps: [],
    ...patch,
  };
}

// Fixed "today" so age/bucket maths are deterministic.
const TODAY = new Date(2026, 7, 27); // 2026-08-27 local
const daysAgo = (n: number): string => {
  const d = new Date(2026, 7, 27 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('line & totals maths (worksheet formulas)', () => {
  it('line amount = ROUND(Qty × Unit, 2); empty Qty counts as 1', () => {
    expect(lineAmount({ description: '', quantity: 5, unitPrice: 75 })).toBe(375);
    expect(lineAmount({ description: '', quantity: 0, unitPrice: 150 })).toBe(150); // IF(D17="",1,D17)
    expect(lineAmount({ description: '', quantity: 3, unitPrice: 25.005 })).toBe(75.02); // ROUND half-up at 2dp
    expect(lineAmount({ description: '', quantity: 1, unitPrice: -50 })).toBe(-50); // discount line
  });

  it('billing-invoice worked example: 200 + 375 − 50 = TOTAL 525 (no tax)', () => {
    const inv = makeInvoice({
      lines: [
        { description: 'Service Fee', quantity: 1, unitPrice: 200 },
        { description: 'Labor: 5 hours at 75/hr', quantity: 5, unitPrice: 75 },
        { description: 'New client discount', quantity: 0, unitPrice: -50 },
      ],
      taxMode: 'none',
    });
    const t = computeInvoiceTotals(inv, TODAY);
    expect(t.subtotal).toBe(525);
    expect(t.taxDue).toBe(0);
    expect(t.total).toBe(525);
    expect(t.effectiveStatus).toBe('open');
  });

  it('InvoiceWithTax worked example: 200 + 375 − 50 = 525 @4.25% → tax 22.31, total 547.31', () => {
    const inv = makeInvoice({
      lines: [
        { description: 'Service Fee', quantity: 1, unitPrice: 200 },
        { description: 'Labor', quantity: 5, unitPrice: 75 },
        { description: 'New client discount', quantity: 0, unitPrice: -50 },
      ],
      taxMode: 'subtotal',
      taxRate: 0.0425,
    });
    const t = computeInvoiceTotals(inv, TODAY);
    expect(t.subtotal).toBe(525);
    expect(t.taxDue).toBe(22.31); // ROUND(525 × 0.0425, 2)
    expect(t.total).toBe(547.31);
  });

  it('invoice-template Invoice 1 worked example: taxed-lines mode → 950 / 345 / 21.56 / 971.56', () => {
    const inv = makeInvoice({
      lines: [
        { description: 'Service Fee', quantity: 1, unitPrice: 230, taxed: false },
        { description: 'Labor: 5 hours at 75/hr', quantity: 5, unitPrice: 75, taxed: false },
        { description: 'Parts', quantity: 1, unitPrice: 345, taxed: true }, // X in TAXED column
      ],
      taxMode: 'per_line',
      taxRate: 0.0625,
      otherAmount: 0,
    });
    const t = computeInvoiceTotals(inv, TODAY);
    expect(t.subtotal).toBe(950);
    expect(t.taxableSubtotal).toBe(345); // SUMIF(E:E,"x",F:F)
    expect(t.taxDue).toBe(21.56); // ROUND(345 × 6.25%, 2)
    expect(t.total).toBe(971.56); // F33+F36+F37
  });

  it('invoice-template Invoice 2 worked example: 600 / 75 / 4.69 / 604.69', () => {
    const inv = makeInvoice({
      lines: [
        { description: 'Service Fee', quantity: 0, unitPrice: 150 }, // qty blank → 1
        { description: 'Labor @ 75/hr', quantity: 5, unitPrice: 75 },
        { description: 'Parts', quantity: 3, unitPrice: 25, taxed: true },
      ],
      taxMode: 'per_line',
      taxRate: 0.0625,
    });
    const t = computeInvoiceTotals(inv, TODAY);
    expect(t.subtotal).toBe(600);
    expect(t.taxableSubtotal).toBe(75);
    expect(t.taxDue).toBe(4.69);
    expect(t.total).toBe(604.69);
  });

  it('"Other" row (shipping/discount) adds into the total; discounts subtract', () => {
    const ship = makeInvoice({ taxMode: 'none', otherLabel: 'Shipping', otherAmount: 25 });
    expect(computeInvoiceTotals(ship, TODAY).total).toBe(125);
    const disc = makeInvoice({ taxMode: 'none', otherLabel: 'Discount', otherAmount: -30 });
    expect(computeInvoiceTotals(disc, TODAY).total).toBe(70);
  });

  it('purchase-order worked example: 15×150 + 1×75 = SUBTOTAL/TOTAL 2325', () => {
    const po = makeInvoice({
      kind: 'purchase_order',
      lines: [
        { description: 'Product XYZ', quantity: 15, unitPrice: 150, itemRef: '23423423' },
        { description: 'Product ABC', quantity: 1, unitPrice: 75, itemRef: '45645645' },
      ],
      taxMode: 'none',
    });
    const t = computeInvoiceTotals(po, TODAY);
    expect(t.subtotal).toBe(2325);
    expect(t.total).toBe(2325);
  });

  it('payments drive paid / outstanding / status', () => {
    const inv = makeInvoice({
      lines: [{ description: 'Work', quantity: 1, unitPrice: 500 }],
      payments: [{ id: 'P1', amount: 200, date: '2026-08-10', method: 'transfer', recordedBy: 'Admin' }],
    });
    const t = computeInvoiceTotals(inv, TODAY);
    expect(t.paid).toBe(200);
    expect(t.outstanding).toBe(300);
    expect(t.effectiveStatus).toBe('partial');

    const settled = computeInvoiceTotals(
      { ...inv, payments: [{ id: 'P1', amount: 500, date: '2026-08-10', method: 'cash', recordedBy: 'Admin' }] },
      TODAY
    );
    expect(settled.outstanding).toBe(0);
    expect(settled.effectiveStatus).toBe('paid');
  });
});

describe('due dates (TERMS / VALID UNTIL)', () => {
  it('DUE DATE = invoice date + terms days (Net 30 default)', () => {
    expect(dueDateFromTerms(new Date(2026, 0, 5), 'net_30')).toEqual(new Date(2026, 1, 4));
    expect(dueDateFromTerms(new Date(2026, 0, 5), 'net_15')).toEqual(new Date(2026, 0, 20));
    expect(dueDateFromTerms(new Date(2026, 0, 5), 'due_on_receipt')).toEqual(new Date(2026, 0, 5));
    expect(dueDateFromTerms(new Date(2026, 0, 5), undefined)).toEqual(new Date(2026, 1, 4));
  });

  it('VALID UNTIL for quotes = quote date + 30 days', () => {
    expect(validUntilFromIssue(new Date(2026, 0, 5))).toEqual(new Date(2026, 1, 4));
  });

  it('age = MAX(0, today − due date), bucketed by due date like the tracker', () => {
    const overdue30 = makeInvoice({ issueDate: daysAgo(60), dueDate: daysAgo(30), status: 'sent' });
    const t30 = computeInvoiceTotals(overdue30, TODAY);
    expect(t30.ageDays).toBe(30);
    expect(t30.agingBucket).toBe('d1_30');
    expect(t30.isOverdue).toBe(true);
    expect(t30.effectiveStatus).toBe('overdue');

    const future = makeInvoice({ issueDate: daysAgo(1), dueDate: daysAgo(-29) });
    const tF = computeInvoiceTotals(future, TODAY);
    expect(tF.ageDays).toBe(0);
    expect(tF.agingBucket).toBe('current');
    expect(tF.isOverdue).toBe(false);

    expect(bucketForAge(0)).toBe('current');
    expect(bucketForAge(31)).toBe('d31_60');
    expect(bucketForAge(61)).toBe('d61_90');
    expect(bucketForAge(91)).toBe('over90');
  });
});

describe('aging summary (tracker Aging block)', () => {
  it('buckets outstanding balances by due date; drafts and paid excluded', () => {
    const invoices = [
      makeInvoice({ id: 'A', dueDate: daysAgo(-10), lines: [{ description: '', quantity: 1, unitPrice: 200 }] }), // current
      makeInvoice({ id: 'B', dueDate: daysAgo(20), lines: [{ description: '', quantity: 1, unitPrice: 100 }] }), // 1-30
      makeInvoice({ id: 'C', dueDate: daysAgo(45), lines: [{ description: '', quantity: 1, unitPrice: 300 }] }), // 31-60
      makeInvoice({ id: 'D', dueDate: daysAgo(75), lines: [{ description: '', quantity: 1, unitPrice: 400 }] }), // 61-90
      makeInvoice({ id: 'E', dueDate: daysAgo(120), lines: [{ description: '', quantity: 1, unitPrice: 500 }] }), // >90
      makeInvoice({ id: 'F', dueDate: daysAgo(120), status: 'draft', lines: [{ description: '', quantity: 1, unitPrice: 999 }] }), // excluded
      makeInvoice({
        id: 'G',
        dueDate: daysAgo(120),
        status: 'paid',
        lines: [{ description: '', quantity: 1, unitPrice: 500 }],
        payments: [{ id: 'P', amount: 500, date: '2026-08-01', method: 'cash', recordedBy: 'Admin' }], // excluded (paid)
      }),
    ];
    const s = agingSummary(invoices, TODAY);
    expect(s.current).toBe(200);
    expect(s.d1_30).toBe(100);
    expect(s.d31_60).toBe(300);
    expect(s.d61_90).toBe(400);
    expect(s.over90).toBe(500);
    expect(s.totalOutstanding).toBe(1500);
    expect(s.overdueCount).toBe(4);
    expect(s.overdueTotal).toBe(1300); // 100 + 300 + 400 + 500
  });
});

describe('collections follow-up sequence', () => {
  it('stage advances with days overdue boundaries', () => {
    const invFor = (days: number) => makeInvoice({ dueDate: daysAgo(days), status: 'sent' });
    expect(followUpSuggestion(invFor(3), TODAY)?.currentStage.stage).toBe('reminder');
    expect(followUpSuggestion(invFor(7), TODAY)?.currentStage.stage).toBe('reminder');
    expect(followUpSuggestion(invFor(8), TODAY)?.currentStage.stage).toBe('follow_up_1');
    expect(followUpSuggestion(invFor(31), TODAY)?.currentStage.stage).toBe('follow_up_2');
    expect(followUpSuggestion(invFor(61), TODAY)?.currentStage.stage).toBe('final_notice');
    expect(followUpSuggestion(invFor(91), TODAY)?.currentStage.stage).toBe('collections');
    expect(followUpSuggestion(invFor(200), TODAY)?.currentStage.stage).toBe('collections');
  });

  it('returns null for not-overdue or settled documents', () => {
    expect(followUpSuggestion(makeInvoice({ dueDate: daysAgo(-5) }), TODAY)).toBeNull();
    expect(
      followUpSuggestion(
        makeInvoice({
          dueDate: daysAgo(30),
          lines: [{ description: '', quantity: 1, unitPrice: 100 }],
          payments: [{ id: 'P', amount: 100, date: '2026-08-01', method: 'cash', recordedBy: 'Admin' }],
        }),
        TODAY
      )
    ).toBeNull();
  });

  it('logging the current stage escalates the next suggestion', () => {
    const logged = makeInvoice({
      dueDate: daysAgo(20), // stage: follow_up_1 by age
      status: 'sent',
      followUps: [{ id: 'FU1', date: daysAgo(2), method: 'email', stage: 'follow_up_1', recordedBy: 'Admin' }],
    });
    const sug = followUpSuggestion(logged, TODAY);
    expect(sug).not.toBeNull();
    expect(sug!.currentStage.stage).toBe('follow_up_1');
    expect(sug!.alreadyLoggedCurrent).toBe(true);
    expect(sug!.suggestedStage.stage).toBe('follow_up_2'); // sequence advances
  });

  it('exposes the full documented sequence', () => {
    expect(FOLLOW_UP_SEQUENCE.map((s) => s.stage)).toEqual([
      'reminder',
      'follow_up_1',
      'follow_up_2',
      'final_notice',
      'collections',
    ]);
  });
});

describe('printed document HTML (white-label letterhead, no template-vendor content)', () => {
  const settings = {
    defaultVatRate: 0.15,
    storeName: 'Island Gifts',
    receiptHeaderLines: ['123 Harbour Road, Victoria'],
    receiptHeaderSubtitle: 'Souvenirs & Wholesale',
    taxRegistrationNumber: 'TIN-100234',
    primaryCurrencySymbol: 'SR',
    receiptLogoUrl: 'data:image/png;base64,AAA',
  } as Parameters<typeof buildBusinessDocumentHtml>[1];

  const doc = makeInvoice({
    invoiceNumber: 'INV-2026-0042',
    customerName: 'Le Méridien Hotel',
    lines: [{ description: 'Shell keyrings', quantity: 200, unitPrice: 4 }],
    taxMode: 'subtotal',
  });

  it('letterhead comes from the store white-label settings', () => {
    const html = buildBusinessDocumentHtml(doc, settings);
    expect(html).toContain('Island Gifts');
    expect(html).toContain('123 Harbour Road, Victoria');
    expect(html).toContain('Souvenirs &amp; Wholesale');
    expect(html).toContain('Tax ID: TIN-100234');
    expect(html).toContain('INVOICE');
    expect(html).toContain('Le Méridien Hotel');
    expect(html).toContain('SR 800.00');
  });

  it('never renders placeholder or template-vendor content, undefined or NaN', () => {
    const html = buildBusinessDocumentHtml(doc, settings);
    expect(html).not.toMatch(/vertex42/i);
    expect(html).not.toContain('[Company Name]');
    expect(html).not.toContain('>undefined<');
    expect(html).not.toContain('>NaN');
  });

  it('statement layout lists documents and the aging summary', () => {
    const html = buildCustomerStatementHtml('Le Méridien Hotel', [doc], settings, TODAY);
    expect(html).toContain('STATEMENT');
    expect(html).toContain('INV-2026-0042');
    expect(html).toContain('Aging Summary');
    expect(html).toContain('Total Outstanding');
  });
});

//__NEXT__
