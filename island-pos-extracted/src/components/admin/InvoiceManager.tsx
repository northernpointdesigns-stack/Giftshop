import React, { useMemo, useState } from 'react';
import {
  FileText,
  Plus,
  Printer,
  X,
  Trash2,
  BadgeCheck,
  AlertTriangle,
  PhoneCall,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import { posDb } from '../../services/db';
import {
  Invoice,
  InvoiceFollowUp,
  InvoiceKind,
  InvoiceLine,
  InvoicePayment,
  InvoiceTerms,
} from '../../types/pos';
import {
  AGING_BUCKET_LABEL,
  AgingSummary,
  TERMS_LABEL,
  agingSummary,
  computeInvoiceTotals,
  followUpSuggestion,
  invoiceDueDate,
  lineAmount,
} from '../../utils/invoiceMath';
import { printBusinessDocument, printCustomerStatement } from '../../utils/printBusinessDocument';

interface InvoiceManagerProps {
  onRefreshData?: () => void;
}

const DEFAULT_QUOTE_TERMS = [
  '1. Customer will be billed after indicating acceptance of this quote.',
  '2. Payment will be due prior to delivery of services and goods.',
  '3. Please return a signed copy of this quote to the address above.',
].join('\n');

const KIND_META: Record<InvoiceKind, { label: string; prefix: string; partyLabel: string }> = {
  invoice: { label: 'Invoice', prefix: 'INV', partyLabel: 'Bill To' },
  quote: { label: 'Quote', prefix: 'QT', partyLabel: 'Customer' },
  purchase_order: { label: 'Purchase Order', prefix: 'PO', partyLabel: 'Vendor' },
};

const todayInput = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const FOLLOW_UP_METHOD_LABEL: Record<InvoiceFollowUp['method'], string> = {
  call: 'Phone call',
  email: 'Email',
  letter: 'Letter',
  in_person: 'In person',
};

export const InvoiceManager: React.FC<InvoiceManagerProps> = ({ onRefreshData }) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || '$';

  const [invoices, setInvoices] = useState<Invoice[]>(() => posDb.getInvoices());
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<InvoicePayment['method']>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [followUpInvoice, setFollowUpInvoice] = useState<Invoice | null>(null);
  const [followUpMethod, setFollowUpMethod] = useState<InvoiceFollowUp['method']>('call');
  const [followUpNote, setFollowUpNote] = useState('');
  const [customerFilter, setCustomerFilter] = useState('All Customers');
  const [searchTerm, setSearchTerm] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const now = new Date();
  const totalsOf = (inv: Invoice) => computeInvoiceTotals(inv, now, settings);

  // --- Derived: aging summary (tracker), follow-up queue, filterable rows ---
  const aging: AgingSummary = useMemo(() => agingSummary(invoices, now, settings), [invoices]);

  const followUpsDue = useMemo(
    () =>
      invoices
        .map((inv) => ({ inv, sug: followUpSuggestion(inv, now) }))
        .filter((x) => x.sug !== null)
        .sort((a, b) => (b.sug!.daysOverdue || 0) - (a.sug!.daysOverdue || 0)),
    [invoices]
  );
  const overdueTotal = followUpsDue.reduce(
    (s, x) => s + computeInvoiceTotals(x.inv, now, settings).outstanding,
    0
  );

  const customerNames = useMemo(
    () =>
      Array.from(new Set<string>(invoices.map((i) => i.customerName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [invoices]
  );

  const rows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return invoices
      .filter((inv) => {
        if (customerFilter !== 'All Customers' && inv.customerName !== customerFilter) return false;
        if (overdueOnly && !totalsOf(inv).isOverdue) return false;
        if (term) {
          const hay = `${inv.invoiceNumber} ${inv.customerName} ${inv.notes || ''}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = invoiceDueDate(a, now)?.getTime() ?? Infinity;
        const db = invoiceDueDate(b, now)?.getTime() ?? Infinity;
        return da - db; // most-overdue first, exactly like the tracker's sort hint
      });
  }, [invoices, customerFilter, searchTerm, overdueOnly]);

  // --- Handlers ---
  const nextNumberFor = (kind: InvoiceKind): string => {
    const year = new Date().getFullYear();
    const prefix = `${KIND_META[kind].prefix}-${year}-`;
    const count = invoices.filter((i) => i.invoiceNumber.startsWith(prefix)).length + 1;
    return `${prefix}${String(count).padStart(4, '0')}`;
  };

  const createNew = (kind: InvoiceKind) => {
    setEditing({
      id: `${KIND_META[kind].prefix}-${Date.now()}`,
      invoiceNumber: nextNumberFor(kind),
      kind,
      customerName: '',
      customerContact: '',
      customerId: '',
      shipTo: '',
      lines: [{ description: '', quantity: 1, unitPrice: 0 }],
      notes: '',
      status: 'draft',
      payments: [],
      createdAt: new Date().toISOString(),
      createdBy: 'Admin',
      issueDate: todayInput(),
      terms: 'net_30',
      taxMode: 'none',
      taxRate: settings.defaultVatRate || 0,
      otherLabel: 'Shipping',
      otherAmount: 0,
      ...(kind === 'quote' ? { termsAndConditions: DEFAULT_QUOTE_TERMS } : {}),
      followUps: [],
    });
  };

  const persist = (inv: Invoice) => {
    posDb.saveInvoice(inv);
    setInvoices(posDb.getInvoices());
  };

  const patchEditing = (patch: Partial<Invoice>) => {
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateLine = (idx: number, patch: Partial<InvoiceLine>) => {
    setEditing((prev) =>
      prev ? { ...prev, lines: prev.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) } : prev
    );
  };

  const convertQuote = (quote: Invoice) => {
    if (!confirm(`Convert quote ${quote.invoiceNumber} into an invoice?`)) return;
    persist({
      ...quote,
      id: `INV-${Date.now()}`,
      invoiceNumber: nextNumberFor('invoice'),
      kind: 'invoice',
      status: 'sent',
      issueDate: todayInput(),
      terms: quote.terms || 'net_30',
      notes: `${quote.notes ? quote.notes + ' ' : ''}(Converted from quote ${quote.invoiceNumber})`.trim(),
      followUps: [],
    });
    onRefreshData?.();
  };

  const saveFollowUp = () => {
    if (!followUpInvoice) return;
    const sug = followUpSuggestion(followUpInvoice, now);
    const entry: InvoiceFollowUp = {
      id: `FU-${Date.now()}`,
      date: new Date().toISOString(),
      method: followUpMethod,
      stage: sug ? sug.suggestedStage.stage : 'reminder',
      note: followUpNote || undefined,
      recordedBy: 'Admin',
    };
    persist({
      ...followUpInvoice,
      followUps: [...(followUpInvoice.followUps || []), entry],
      status: followUpInvoice.status === 'draft' ? 'sent' : followUpInvoice.status,
    });
    setFollowUpInvoice(null);
    setFollowUpNote('');
    onRefreshData?.();
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    open: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    sent: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    partial: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    overdue: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    cancelled: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  };

  return (
    <div className="space-y-4">
      {/* Header + creation actions */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div>
          <h2 className="text-base font-bold text-[#E2E8F0] flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" /> Invoices, Quotes & Purchase Orders
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Quote hotels &amp; wholesale customers on your letterhead, track payment due dates, and follow up on overdue balances.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => createNew('invoice')} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
            <Plus className="w-4 h-4" /> New Invoice
          </button>
          <button onClick={() => createNew('quote')} className="bg-indigo-600/80 hover:bg-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
            <ClipboardList className="w-4 h-4" /> New Quote
          </button>
          <button onClick={() => createNew('purchase_order')} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
            <FileText className="w-4 h-4" /> New Purchase Order
          </button>
        </div>
      </div>

      {/* OVERDUE PAYMENTS ALERT BANNER */}
      {followUpsDue.length > 0 && (
        <div className="bg-rose-950/50 border border-rose-700/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </span>
            <div>
              <p className="text-sm font-bold text-rose-200">
                {followUpsDue.length} overdue payment{followUpsDue.length === 1 ? '' : 's'} need attention
              </p>
              <p className="text-xs text-rose-300/80 mt-0.5">
                Total outstanding on overdue documents: <strong className="font-mono">{primarySymbol} {overdueTotal.toFixed(2)}</strong>
                {' — '}most severe is {followUpsDue[0].sug!.daysOverdue} day{(followUpsDue[0].sug!.daysOverdue || 0) === 1 ? '' : 's'} past due ({followUpsDue[0].sug!.suggestedStage.label}).
              </p>
            </div>
          </div>
          <button
            onClick={() => { setOverdueOnly(true); setSearchTerm(''); }}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md"
          >
            Review Overdue <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* AGING SUMMARY (tracker layout: Current / 1-30 / 31-60 / 61-90 / >90) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {([
          { key: 'current', value: aging.current, accent: 'text-emerald-300', border: 'border-emerald-500/30' },
          { key: 'd1_30', value: aging.d1_30, accent: 'text-lime-300', border: 'border-lime-500/30' },
          { key: 'd31_60', value: aging.d31_60, accent: 'text-amber-300', border: 'border-amber-500/30' },
          { key: 'd61_90', value: aging.d61_90, accent: 'text-orange-300', border: 'border-orange-500/30' },
          { key: 'over90', value: aging.over90, accent: 'text-rose-300', border: 'border-rose-500/30' },
          { key: 'total', value: aging.totalOutstanding, accent: 'text-cyan-300', border: 'border-cyan-500/30' },
        ] as const).map((c) => (
          <div key={c.key} className={`bg-[#161B22] border ${c.border} rounded-2xl p-3 shadow-md`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {c.key === 'total' ? 'Total Outstanding' : AGING_BUCKET_LABEL[c.key]}
            </p>
            <p className={`text-sm font-black font-mono mt-1 ${c.accent}`}>
              {primarySymbol} {c.value.toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      {/* FOLLOW-UPS DUE PANEL (collections sequence) */}
      {followUpsDue.length > 0 && (
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl overflow-hidden shadow-md">
          <div className="px-4 py-2.5 bg-[#0F1115] border-b border-[#1E293B] flex items-center justify-between">
            <p className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <PhoneCall className="w-3.5 h-3.5 text-amber-400" /> Follow-up Sequence — next actions
            </p>
            <span className="hidden sm:block text-[10px] text-slate-500">Reminder ≤7d → 1st 8–30d → 2nd 31–60d → Final 61–90d → Collections &gt;90d</span>
          </div>
          <div className="divide-y divide-[#1E293B]/60">
            {followUpsDue.slice(0, 5).map(({ inv, sug }) => (
              <div key={inv.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#E2E8F0]">
                    {inv.customerName || '—'} <span className="font-mono text-slate-500">· {inv.invoiceNumber}</span>
                    {inv.kind === 'quote' && <span className="ml-1.5 text-[9px] font-bold uppercase text-indigo-300">quote</span>}
                    {inv.kind === 'purchase_order' && <span className="ml-1.5 text-[9px] font-bold uppercase text-slate-300">PO</span>}
                  </p>
                  <p className="text-[11px] text-amber-300/90 mt-0.5">
                    {sug!.suggestedStage.action} · {sug!.daysOverdue}d overdue · balance {primarySymbol} {totalsOf(inv).outstanding.toFixed(2)}
                    {sug!.lastFollowUpDate && ` · last contact ${new Date(sug!.lastFollowUpDate).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setFollowUpInvoice(inv); setFollowUpNote(''); }}
                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                  >
                    Log Follow-up
                  </button>
                  <button
                    onClick={() => { setPayingInvoice(inv); setPaymentAmount(totalsOf(inv).outstanding.toFixed(2)); }}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                  >
                    Record Payment
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRACKER TABLE (invoice-tracker layout) */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl overflow-hidden shadow-md">
        <div className="px-4 py-3 bg-[#0F1115] border-b border-[#1E293B] flex flex-wrap items-center gap-2">
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="All Customers">All Customers</option>
            {customerNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search number, customer, notes…"
            className="flex-1 min-w-[160px] bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => setOverdueOnly((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              overdueOnly
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-[#161B22] text-slate-400 border-[#1E293B] hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            Overdue only
          </button>
          <button
            onClick={() => printCustomerStatement(customerFilter, rows, settings, now)}
            title="Print a statement of the currently filtered documents"
            className="bg-[#161B22] hover:bg-slate-800 text-slate-300 border border-[#1E293B] px-2.5 py-1.5 rounded-lg text-xs font-bold"
          >
            <Printer className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> Statement
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm text-slate-300 font-semibold mt-3">No documents match</p>
            <p className="text-xs text-slate-500 mt-1">Create an invoice, quote or purchase order to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0F1115] text-slate-400 border-b border-[#1E293B]">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Number</th>
                  <th className="p-3 text-left">Customer</th>
                  <th className="p-3 text-left">Due Date</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-right">Paid</th>
                  <th className="p-3 text-right">Outstanding</th>
                  <th className="p-3 text-center">Age</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => {
                  const t = totalsOf(inv);
                  const st = t.effectiveStatus;
                  const sug = followUpSuggestion(inv, now);
                  const kindLabel = inv.kind === 'quote' ? 'QT' : inv.kind === 'purchase_order' ? 'PO' : null;
                  return (
                    <tr
                      key={inv.id}
                      className={`border-b border-[#1E293B]/60 hover:bg-[#0F1115]/50 ${st === 'overdue' ? 'bg-rose-950/20' : ''}`}
                    >
                      <td className="p-3 text-slate-400">{inv.issueDate || inv.createdAt.slice(0, 10)}</td>
                      <td className="p-3 font-mono text-slate-300">
                        {inv.invoiceNumber}
                        {kindLabel && <span className="ml-1.5 text-[9px] font-bold uppercase text-indigo-300">{kindLabel}</span>}
                      </td>
                      <td className="p-3 text-[#E2E8F0] font-semibold">{inv.customerName || '—'}</td>
                      <td className="p-3 text-slate-400">{inv.dueDate || (inv.terms && inv.terms !== 'custom' ? 'auto' : '—')}</td>
                      <td className="p-3 text-right font-mono text-slate-200">{primarySymbol} {t.total.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono text-emerald-400">{primarySymbol} {t.paid.toFixed(2)}</td>
                      <td className={`p-3 text-right font-mono font-bold ${t.outstanding > 0 ? 'text-amber-300' : 'text-slate-500'}`}>
                        {primarySymbol} {t.outstanding.toFixed(2)}
                      </td>
                      <td className={`p-3 text-center font-mono ${t.isOverdue ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                        {t.ageDays ?? '—'}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase ${statusColors[st] || statusColors.open}`}>
                          {st}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {t.outstanding > 0 && st !== 'cancelled' && (
                            <button
                              onClick={() => { setPayingInvoice(inv); setPaymentAmount(t.outstanding.toFixed(2)); setPaymentRef(''); }}
                              className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold"
                            >
                              Pay
                            </button>
                          )}
                          {st === 'overdue' && (
                            <button
                              onClick={() => { setFollowUpInvoice(inv); setFollowUpNote(''); }}
                              title={sug ? `${sug.suggestedStage.label}: ${sug.suggestedStage.action}` : 'Log follow-up'}
                              className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold"
                            >
                              Follow-up
                            </button>
                          )}
                          {inv.kind === 'quote' && (
                            <button
                              onClick={() => convertQuote(inv)}
                              title="Convert quote to invoice"
                              className="px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold"
                            >
                              Convert
                            </button>
                          )}
                          <button onClick={() => setEditing({ ...inv })} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded" title="Edit">
                            <FileText className="w-4 h-4" />
                          </button>
                          <button onClick={() => printBusinessDocument(inv, settings)} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded" title="Print / PDF">
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Delete document ${inv.invoiceNumber}?`)) { posDb.deleteInvoice(inv.id); setInvoices(posDb.getInvoices()); onRefreshData?.(); } }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document Editor Modal (invoice / quote / purchase order) */}
      {editing && (() => {
        const kind: InvoiceKind = editing.kind || 'invoice';
        const meta = KIND_META[kind];
        const t = computeInvoiceTotals(editing, new Date(), settings);
        const isQuote = kind === 'quote';
        const isPo = kind === 'purchase_order';
        return (
          <div className="fixed inset-0 z-50 bg-[#0F1115]/80 flex items-center justify-center p-4">
            <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1E293B]">
                <h3 className="text-base font-bold text-[#E2E8F0] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  {meta.label} {editing.invoiceNumber}
                </h3>
                <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Document meta row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={editing.issueDate || todayInput()}
                    onChange={(e) => patchEditing({ issueDate: e.target.value })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {isQuote ? 'Valid Until' : 'Terms'}
                  </label>
                  {isQuote ? (
                    <input
                      type="date"
                      value={editing.dueDate || ''}
                      onChange={(e) => patchEditing({ dueDate: e.target.value })}
                      placeholder="issue + 30d"
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  ) : (
                    <select
                      value={editing.terms || 'net_30'}
                      onChange={(e) => patchEditing({ terms: e.target.value as InvoiceTerms, dueDate: undefined })}
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="due_on_receipt">Due on Receipt</option>
                      <option value="net_15">Net 15 Days</option>
                      <option value="net_30">Net 30 Days</option>
                      <option value="net_60">Net 60 Days</option>
                      <option value="custom">Custom date…</option>
                    </select>
                  )}
                </div>
                {(!isQuote && editing.terms === 'custom') && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={editing.dueDate || ''}
                      onChange={(e) => patchEditing({ dueDate: e.target.value })}
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Customer ID</label>
                  <input
                    value={editing.customerId || ''}
                    onChange={(e) => patchEditing({ customerId: e.target.value })}
                    placeholder="e.g. 564"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Status</label>
                  <select
                    value={editing.status}
                    onChange={(e) => patchEditing({ status: e.target.value as Invoice['status'] })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent / Open</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              {/* Parties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{meta.partyLabel} *</label>
                  <input
                    value={editing.customerName}
                    onChange={(e) => patchEditing({ customerName: e.target.value })}
                    placeholder={isPo ? 'Vendor / supplier name' : 'Customer / hotel name'}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {isPo ? 'Vendor Contact (phone / email)' : 'Contact (phone / email / address)'}
                  </label>
                  <input
                    value={editing.customerContact || ''}
                    onChange={(e) => patchEditing({ customerContact: e.target.value })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                {!isQuote && (
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Ship To (multi-line)</label>
                    <textarea
                      value={editing.shipTo || ''}
                      onChange={(e) => patchEditing({ shipTo: e.target.value })}
                      rows={2}
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}
                {isQuote && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Prepared By</label>
                    <input
                      value={editing.preparedBy || ''}
                      onChange={(e) => patchEditing({ preparedBy: e.target.value })}
                      placeholder="Salesperson name"
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}
                {isPo && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Requisitioner</label>
                      <input value={editing.requisitioner || ''} onChange={(e) => patchEditing({ requisitioner: e.target.value })} className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Ship Via</label>
                      <input value={editing.shipVia || ''} onChange={(e) => patchEditing({ shipVia: e.target.value })} className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">F.O.B.</label>
                      <input value={editing.fob || ''} onChange={(e) => patchEditing({ fob: e.target.value })} className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Shipping Terms</label>
                      <input value={editing.shippingTerms || ''} onChange={(e) => patchEditing({ shippingTerms: e.target.value })} className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                  </>
                )}
              </div>
              {/* Line items */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Line Items</label>
                  {isQuote && (
                    <span className="text-[10px] text-slate-500">Amounts default Qty to 1 — leave Qty blank for flat-fee or discount lines.</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {(editing.lines || []).map((line, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-1.5">
                      {isPo && (
                        <input
                          value={line.itemRef || ''}
                          onChange={(e) => updateLine(idx, { itemRef: e.target.value })}
                          placeholder="Item #"
                          className="w-24 bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                        />
                      )}
                      <input
                        value={line.description}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                        placeholder={isPo ? 'Product / description' : 'e.g. Shell keyrings — 200 units'}
                        className="flex-1 min-w-[140px] bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="number"
                        step="any"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                        title="Qty (blank/0 counts as 1, e.g. discount lines)"
                        className="w-16 bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-2 text-xs font-mono text-white text-center focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                        title="Unit price (negative for a discount line)"
                        className="w-24 bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-2 text-xs font-mono text-white text-right focus:outline-none focus:border-cyan-500"
                      />
                      {(editing.taxMode || 'none') === 'per_line' && (
                        <label className="flex items-center gap-1 px-1.5 py-2 bg-[#0F1115] border border-[#1E293B] rounded-lg cursor-pointer" title="Taxed — counts toward the taxable subtotal">
                          <input
                            type="checkbox"
                            checked={!!line.taxed}
                            onChange={(e) => updateLine(idx, { taxed: e.target.checked })}
                            className="accent-cyan-500"
                          />
                          <span className="text-[10px] font-bold text-slate-400">Taxed</span>
                        </label>
                      )}
                      <span className="w-24 text-right font-mono text-xs text-cyan-300 font-bold" title="Line amount">
                        {primarySymbol} {lineAmount(line).toFixed(2)}
                      </span>
                      <button
                        onClick={() => patchEditing({ lines: editing.lines.filter((_, i) => i !== idx) })}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => patchEditing({ lines: [...(editing.lines || []), { description: '', quantity: 1, unitPrice: 0 }] })}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add line
                  </button>
                </div>
              </div>
              {/* Tax engine + live totals (template Subtotal / Taxable / Tax due / Other / Total) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tax &amp; Adjustments</p>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-400 w-20 shrink-0">Tax mode</label>
                    <select
                      value={editing.taxMode || 'none'}
                      onChange={(e) => patchEditing({ taxMode: e.target.value as Invoice['taxMode'] })}
                      className="flex-1 bg-[#161B22] border border-[#1E293B] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="none">No tax</option>
                      <option value="subtotal">Tax on subtotal</option>
                      <option value="per_line">Tax TAXED lines only</option>
                    </select>
                  </div>
                  {(editing.taxMode || 'none') !== 'none' && (
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-400 w-20 shrink-0">Tax rate %</label>
                      <input
                        type="number"
                        step="0.01"
                        value={((typeof editing.taxRate === 'number' ? editing.taxRate : settings.defaultVatRate || 0) * 100).toFixed(2)}
                        onChange={(e) => patchEditing({ taxRate: (parseFloat(e.target.value) || 0) / 100 })}
                        className="flex-1 bg-[#161B22] border border-[#1E293B] rounded-lg px-2 py-1.5 text-xs font-mono text-white text-right focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-400 w-20 shrink-0">Other label</label>
                    <input
                      value={editing.otherLabel || ''}
                      onChange={(e) => patchEditing({ otherLabel: e.target.value })}
                      placeholder="Shipping / Discount"
                      className="flex-1 bg-[#161B22] border border-[#1E293B] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-400 w-20 shrink-0">Other amt</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editing.otherAmount ?? 0}
                      onChange={(e) => patchEditing({ otherAmount: parseFloat(e.target.value) || 0 })}
                      className="flex-1 bg-[#161B22] border border-[#1E293B] rounded-lg px-2 py-1.5 text-xs font-mono text-white text-right focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Totals (live)</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span className="font-mono text-slate-200">{primarySymbol} {t.subtotal.toFixed(2)}</span></div>
                    {(editing.taxMode || 'none') !== 'none' && (
                      <>
                        <div className="flex justify-between"><span className="text-slate-400">Taxable</span><span className="font-mono text-slate-200">{primarySymbol} {t.taxableSubtotal.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Tax due</span><span className="font-mono text-slate-200">{primarySymbol} {t.taxDue.toFixed(2)}</span></div>
                      </>
                    )}
                    {t.other !== 0 && (
                      <div className="flex justify-between"><span className="text-slate-400">{editing.otherLabel || 'Other'}</span><span className="font-mono text-slate-200">{primarySymbol} {t.other.toFixed(2)}</span></div>
                    )}
                    <div className="flex justify-between border-t border-[#1E293B] pt-1.5 mt-1"><span className="font-bold text-slate-200">TOTAL</span><span className="font-mono font-black text-cyan-300">{primarySymbol} {t.total.toFixed(2)}</span></div>
                    {t.paid > 0 && (
                      <>
                        <div className="flex justify-between"><span className="text-slate-400">Paid to date</span><span className="font-mono text-emerald-400">-{primarySymbol} {t.paid.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="font-bold text-slate-200">Balance due</span><span className="font-mono font-bold text-amber-300">{primarySymbol} {t.outstanding.toFixed(2)}</span></div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* Quote T&C / Notes / Actions */}
              {isQuote && (
                <div className="mb-3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Terms and Conditions</label>
                  <textarea
                    value={editing.termsAndConditions || ''}
                    onChange={(e) => patchEditing({ termsAndConditions: e.target.value })}
                    rows={3}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <div className="mb-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Notes / Comments</label>
                <textarea
                  value={editing.notes || ''}
                  onChange={(e) => patchEditing({ notes: e.target.value })}
                  rows={2}
                  placeholder="Delivery date, special instructions…"
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  onClick={() => setEditing(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { persist({ ...editing }); setEditing(null); onRefreshData?.(); }}
                  disabled={!editing.customerName.trim()}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs"
                >
                  Save {meta.label}
                </button>
                <button
                  onClick={() => { const saved = { ...editing }; persist(saved); setEditing(null); printBusinessDocument(saved, settings); onRefreshData?.(); }}
                  disabled={!editing.customerName.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Save &amp; Print
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Follow-up Modal (collections sequence) */}
      {followUpInvoice && (() => {
        const sug = followUpSuggestion(followUpInvoice, now);
        const t = totalsOf(followUpInvoice);
        return (
          <div className="fixed inset-0 z-50 bg-[#0F1115]/80 flex items-center justify-center p-4">
            <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <h3 className="text-base font-bold text-[#E2E8F0] flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-amber-400" /> Log Follow-up
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {followUpInvoice.customerName || '—'} · <span className="font-mono">{followUpInvoice.invoiceNumber}</span>
              </p>
              <div className="mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-700/40">
                <p className="text-xs font-bold text-amber-200">
                  {sug ? `Stage: ${sug.suggestedStage.label}` : 'No follow-up needed — document is not overdue'}
                </p>
                {sug && (
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    {sug.daysOverdue} days overdue · balance {primarySymbol} {t.outstanding.toFixed(2)}
                    {sug.alreadyLoggedCurrent && ' · current stage already logged, escalating'}
                  </p>
                )}
              </div>
              <div className="space-y-3 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Contact method</label>
                  <select
                    value={followUpMethod}
                    onChange={(e) => setFollowUpMethod(e.target.value as InvoiceFollowUp['method'])}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="call">Phone call</option>
                    <option value="email">Email</option>
                    <option value="letter">Letter</option>
                    <option value="in_person">In person</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Note (optional)</label>
                  <textarea
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Promised bank transfer on Friday"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                {(followUpInvoice.followUps || []).length > 0 && (
                  <div className="max-h-28 overflow-y-auto rounded-xl border border-[#1E293B] divide-y divide-[#1E293B]/60">
                    {(followUpInvoice.followUps || []).slice().reverse().map((f) => (
                      <div key={f.id} className="px-3 py-1.5 text-[11px] text-slate-400">
                        <span className="font-bold text-slate-300">{FOLLOW_UP_METHOD_LABEL[f.method]}</span>
                        {' · '}{new Date(f.date).toLocaleDateString()}{' · '}{f.stage}
                        {f.note && ` · ${f.note}`}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setFollowUpInvoice(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs">
                    Cancel
                  </button>
                  <button
                    disabled={!sug}
                    onClick={saveFollowUp}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-2.5 rounded-xl text-xs"
                  >
                    Log Follow-up
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payment Modal */}
      {payingInvoice && (() => {
        const t = totalsOf(payingInvoice);
        return (
          <div className="fixed inset-0 z-50 bg-[#0F1115]/80 flex items-center justify-center p-4">
            <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-sm w-full p-6 shadow-2xl">
              <h3 className="text-base font-bold text-[#E2E8F0]">
                Record Payment — {payingInvoice.invoiceNumber}
              </h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Balance due:{' '}
                <strong className="font-mono text-amber-400">
                  {primarySymbol} {t.outstanding.toFixed(2)}
                </strong>
              </p>
              <div className="space-y-3">
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Amount received (${primarySymbol})`}
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                />
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as InvoicePayment['method'])}
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
                <input
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Reference (optional)"
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setPayingInvoice(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs">
                    Cancel
                  </button>
                  <button
                    disabled={!(parseFloat(paymentAmount) > 0)}
                    onClick={() => {
                      const payment: InvoicePayment = {
                        id: `PAY-${Date.now()}`,
                        amount: Number(parseFloat(paymentAmount).toFixed(2)),
                        date: new Date().toISOString(),
                        method: paymentMethod,
                        reference: paymentRef || undefined,
                        recordedBy: 'Admin',
                      };
                      persist({
                        ...payingInvoice,
                        payments: [...payingInvoice.payments, payment],
                        status: payingInvoice.status === 'draft' ? 'sent' : payingInvoice.status,
                      });
                      setPayingInvoice(null);
                      onRefreshData?.();
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-2.5 rounded-xl text-xs"
                  >
                    Record Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
