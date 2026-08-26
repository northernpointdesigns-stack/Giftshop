import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Printer,
  X,
  Trash2,
  BadgeCheck,
} from 'lucide-react';
import { posDb } from '../../services/db';
import { Invoice, InvoiceLine, InvoicePayment, InvoiceStatus } from '../../types/pos';

interface InvoiceManagerProps {
  onRefreshData?: () => void;
}

export const InvoiceManager: React.FC<InvoiceManagerProps> = ({ onRefreshData }) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || '$';
;
  const primaryCode = settings.primaryCurrency || 'USD';

  const [invoices, setInvoices] = useState<Invoice[]>(() => posDb.getInvoices());
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<InvoicePayment['method']>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [printing, setPrinting] = useState<Invoice | null>(null);

  const invoiceTotal = (inv: Invoice) =>
    inv.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const paidTotal = (inv: Invoice) =>
    inv.payments.reduce((s, p) => s + p.amount, 0);
  const statusOf = (inv: Invoice): InvoiceStatus => {
    if (inv.status === 'cancelled') return inv.status;
    const total = invoiceTotal(inv);
    const paid = paidTotal(inv);
    if (paid >= total && total > 0) return 'paid';
    if (paid > 0) return 'partial';
    return 'draft';
  };

  const createNew = () => {
    setEditing({
      id: `INV-${Date.now()}`,
      invoiceNumber: posDb.nextInvoiceNumber(),
      customerName: '',
      customerContact: '',
      lines: [{ description: '', quantity: 1, unitPrice: 0 }],
      notes: '',
      status: 'draft',
      payments: [],
      createdAt: new Date().toISOString(),
      createdBy: 'Admin',
    });
  };

  const persist = (inv: Invoice) => {
    posDb.saveInvoice(inv);
    setInvoices(posDb.getInvoices());
  };

  const updateLine = (idx: number, patch: Partial<InvoiceLine>) => {
    if (!editing) return;
    const lines = editing.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    setEditing({ ...editing, lines });
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    sent: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    partial: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    cancelled: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div>
          <h2 className="text-base font-bold text-[#E2E8F0] flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" /> Invoices & Orders
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Quote hotels & wholesale customers on branded letterhead, then record their payments.
          </p>
        </div>
        <button
          onClick={createNew}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Empty state */}
      {invoices.length === 0 && !editing && (
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-10 text-center">
          <FileText className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-sm text-slate-300 font-semibold mt-3">No invoices yet</p>
          <p className="text-xs text-slate-500 mt-1">Create your first quote or order invoice.</p>
        </div>
      )}

      {/* Invoice list */}
      {invoices.length > 0 && (
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl overflow-hidden shadow-md">
          <table className="w-full text-xs">
            <thead className="bg-[#0F1115] text-slate-400 border-b border-[#1E293B]">
              <tr>
                <th className="p-3 text-left">Invoice #</th>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Paid</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const st = statusOf(inv);
                return (
                  <tr key={inv.id} className="border-b border-[#1E293B]/60 hover:bg-[#0F1115]/50">
                    <td className="p-3 font-mono text-slate-300">{inv.invoiceNumber}</td>
                    <td className="p-3 text-[#E2E8F0] font-semibold">{inv.customerName || '—'}</td>
                    <td className="p-3 text-right font-mono text-slate-200">
                      {primarySymbol} {invoiceTotal(inv).toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-400">
                      {primarySymbol} {paidTotal(inv).toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase ${statusColors[st]}`}>
                        {st}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {st !== 'paid' && st !== 'cancelled' && (
                          <button
                            onClick={() => { setPayingInvoice(inv); setPaymentAmount(''); setPaymentRef(''); }}
                            className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold"
                          >
                            Pay
                          </button>
                        )}
                        <button onClick={() => setEditing({ ...inv })} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded" title="Edit">
                          <FileText className="w-4 h-4" />
                        </button>
                        <button onClick={() => setPrinting(inv)} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded" title="Print / PDF">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete invoice ${inv.invoiceNumber}?`)) { posDb.deleteInvoice(inv.id); setInvoices(posDb.getInvoices()); onRefreshData?.(); } }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded"
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

      {/* Invoice Editor Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1E293B]">
              <h3 className="text-base font-bold text-[#E2E8F0] flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Invoice {editing.invoiceNumber}
              </h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <input
                value={editing.customerName}
                onChange={(e) => setEditing({ ...editing, customerName: e.target.value })}
                placeholder="Customer / Hotel name *"
                className="bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <input
                value={editing.customerContact || ''}
                onChange={(e) => setEditing({ ...editing, customerContact: e.target.value })}
                placeholder="Phone / email / address"
                className="bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-2 mb-3">
              {editing.lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={line.description}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                    placeholder="e.g. Shell keyrings - Cone"
                    className="col-span-6 bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: parseInt(e.target.value) || 1 })}
                    className="col-span-2 bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-2 text-xs font-mono text-white text-center focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                    className="col-span-3 bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-2 text-xs font-mono text-white text-right focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_, i) => i !== idx) })}
                    className="col-span-1 text-slate-500 hover:text-rose-400 p-1 justify-self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setEditing({ ...editing, lines: [...editing.lines, { description: '', quantity: 1, unitPrice: 0 }] })}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 pt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add line
              </button>
            </div>

            <textarea
              value={editing.notes || ''}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              placeholder="Notes (delivery date, terms…)"
              rows={2}
              className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 mb-3"
            />

            <div className="flex items-center justify-between pt-3 border-t border-[#1E293B]">
              <span className="text-sm font-bold text-slate-300">
                Total:{' '}
                <span className="font-mono text-emerald-400">
                  {primarySymbol} {invoiceTotal(editing).toFixed(2)} {primaryCode}
                </span>
              </span>
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300">
                  Cancel
                </button>
                <button
                  disabled={!editing.customerName.trim() || editing.lines.every((l) => !l.description.trim())}
                  onClick={() => { persist(editing); setEditing(null); onRefreshData?.(); }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white"
                >
                  Save Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#E2E8F0]">
              Record Payment — {payingInvoice.invoiceNumber}
            </h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Balance due:{' '}
              <strong className="font-mono text-amber-400">
                {primarySymbol} {(invoiceTotal(payingInvoice) - paidTotal(payingInvoice)).toFixed(2)}
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
                className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
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
      )}

      {/* Printable invoice view */}
      {printing && (
        <div className="fixed inset-0 z-50 bg-[#0F1115]/90 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-end gap-2 mb-2 print:hidden sticky top-0 pt-2">
              <button onClick={() => window.print()} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> Print / Save PDF
              </button>
              <button onClick={() => setPrinting(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl text-xs">
                Close
              </button>
            </div>
            <div className="bg-white text-slate-900 rounded-2xl p-8 shadow-2xl print:rounded-none print:shadow-none print:p-0">
              {/* Letterhead with shop branding */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  {settings.receiptLogoUrl ? (
                    <img src={settings.receiptLogoUrl} alt="logo" className="w-14 h-14 object-contain" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                      {(settings.storeName || 'B').slice(0, 1)}
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl font-black">{settings.storeName}</h1>
                    {settings.taxRegistrationNumber && (
                      <p className="text-[11px] text-slate-500">Tax ID: {settings.taxRegistrationNumber}</p>
                    )}
                    {(settings.receiptHeaderLines || []).filter(Boolean).map((l, i) => (
                      <p key={i} className="text-[11px] text-slate-500">{l}</p>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black tracking-tight">INVOICE</div>
                  <div className="font-mono text-sm mt-1">{printing.invoiceNumber}</div>
                  <div className="text-[11px] text-slate-500">{new Date(printing.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Bill To</p>
                <p className="font-bold text-sm">{printing.customerName}</p>
                {printing.customerContact && <p className="text-xs text-slate-500">{printing.customerContact}</p>}
              </div>

              <table className="w-full text-xs mb-6">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-left">
                    <th className="py-2">Description</th>
                    <th className="py-2 text-center w-16">Qty</th>
                    <th className="py-2 text-right w-28">Unit Price</th>
                    <th className="py-2 text-right w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {printing.lines.map((l, i) => (
                    <tr key={i} className="border-b border-slate-200">
                      <td className="py-2">{l.description}</td>
                      <td className="py-2 text-center">{l.quantity}</td>
                      <td className="py-2 text-right font-mono">{l.unitPrice.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono font-bold">{(l.quantity * l.unitPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-3 text-right font-black">TOTAL:</td>
                    <td className="pt-3 text-right font-black font-mono text-base">
                      {primarySymbol} {invoiceTotal(printing).toFixed(2)} {primaryCode}
                    </td>
                  </tr>
                  {paidTotal(printing) > 0 && (
                    <>
                      <tr>
                        <td colSpan={3} className="text-right text-slate-500">Paid to date:</td>
                        <td className="text-right font-mono text-emerald-700">-{primarySymbol} {paidTotal(printing).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="text-right font-bold">Balance due:</td>
                        <td className="text-right font-mono font-bold">{primarySymbol} {(invoiceTotal(printing) - paidTotal(printing)).toFixed(2)}</td>
                      </tr>
                    </>
                  )}
                </tfoot>
              </table>

              {printing.notes && <p className="text-[11px] text-slate-500 italic mb-4">{printing.notes}</p>}
              <div className="flex items-end justify-between pt-4 border-t border-slate-200">
                <p className="text-[10px] text-slate-400">Thank you for your business.</p>
                {statusOf(printing) === 'paid' && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-black text-sm border-2 border-emerald-600 rounded-lg px-3 py-1 rotate-[-6deg]">
                    <BadgeCheck className="w-4 h-4" /> PAID
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
