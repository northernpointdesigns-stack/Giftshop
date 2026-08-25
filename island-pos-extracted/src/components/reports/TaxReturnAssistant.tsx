import React, { useMemo, useState } from 'react';
import {
  Printer,
  Download,
  Save,
  Landmark,
  Calculator,
  UserRound,
  Wand2,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import { posDb } from '../../services/db';
import { Transaction } from '../../types/pos';

interface TaxReturnAssistantProps {
  transactions: Transaction[];
}

type FilingStatus = 'single' | 'joint' | 'head';

interface IncomeLine {
  label: string;
  gross: string;
  withheld: string;
}

interface Bracket {
  cap: string; // upper bound of this band ('' = infinity)
  rate: string; // marginal rate %
}

interface TaxDraft {
  year: string;
  // Section 1 — taxpayer
  name: string;
  tin: string;
  address: string;
  city: string;
  country: string;
  dob: string;
  email: string;
  phone: string;
  filingStatus: FilingStatus;
  // Section 2 — income (6 standard lines)
  income: IncomeLine[];
  // Section 3 — deductions (4 standard lines)
  deductions: string[];
  // Section 4 — calculation
  useBrackets: boolean;
  flatRate: string;
  brackets: Bracket[];
  credits: string;
  otherPaid: string;
  // Section 5 — declaration
  preparerName: string;
  preparerTin: string;
}

const STORAGE_KEY = 'island_pos_tax_return_drafts_v1';

const INCOME_LABELS = [
  'Employment Wages, Salaries & Tips',
  'Business, Self-Employment or Freelance',
  'Investment Income (Dividends, Interest, Capital Gains)',
  'Rental Real Estate, Royalties, Partnerships, Trusts',
  'Pensions, Annuities or Retirement Distributions',
  'Other Miscellaneous Income',
];

const DEDUCTION_LABELS = [
  'Standard Personal Allowance / Basic Exemption',
  'Business-Related Expenses / Professional Costs',
  'Health Insurance, Medical or Social Contributions',
  'Educational, Charitable or Other Approved Deductions',
];

const makeDraft = (year: string): TaxDraft => ({
  year,
  name: '',
  tin: '',
  address: '',
  city: '',
  country: '',
  dob: '',
  email: '',
  phone: '',
  filingStatus: 'single',
  income: INCOME_LABELS.map((label) => ({ label, gross: '', withheld: '' })),
  deductions: DEDUCTION_LABELS.map(() => ''),
  useBrackets: false,
  flatRate: '',
  brackets: [
    { cap: '', rate: '' },
  ],
  credits: '',
  otherPaid: '',
  preparerName: '',
  preparerTin: '',
});

const num = (v: string | undefined): number => {
  const n = parseFloat(v || '');
  return isNaN(n) ? 0 : n;
};

const money = (n: number): string => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const loadDrafts = (): Record<string, TaxDraft> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveDraftToStore = (draft: TaxDraft) => {
  const all = loadDrafts();
  all[draft.year] = draft;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

/** Progressive tax from ascending brackets; empty cap = top band */
export const computeGrossLiability = (taxable: number, brackets: Bracket[], flatRate: string): number => {
  if (!brackets.length) return taxable * (num(flatRate) / 100);
  let remaining = taxable;
  let prevCap = 0;
  let tax = 0;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const cap = b.cap.trim() === '' ? Infinity : num(b.cap);
    const bandWidth = cap === Infinity ? remaining : Math.max(0, cap - prevCap);
    const taxedInBand = Math.min(remaining, bandWidth);
    tax += taxedInBand * (num(b.rate) / 100);
    remaining -= taxedInBand;
    prevCap = cap;
  }
  return tax;
};

export const TaxReturnAssistant: React.FC<TaxReturnAssistantProps> = ({ transactions }) => {
  const settings = posDb.getSettings();
  const symbol = settings.primaryCurrencySymbol || 'SR';

  const [year, setYear] = useState(String(new Date().getFullYear() - 1));
  const [draft, setDraft] = useState<TaxDraft>(() => {
    const y = String(new Date().getFullYear() - 1);
    return loadDrafts()[y] || makeDraft(y);
  });
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  /** Switch year: load existing draft or start a fresh one */
  const switchYear = (y: string) => {
    setYear(y);
    setDraft(loadDrafts()[y] || makeDraft(y));
  };

  const patch = (p: Partial<TaxDraft>) => setDraft((d) => ({ ...d, ...p }));

  // ---- POS book figures for the selected tax year -----------------------
  const books = useMemo(() => {
    const prefix = `${year}-`;
    const sales = transactions.filter(
      (t) => t.timestamp.startsWith(prefix) && !t.isRefund
    );
    let netSales = 0;
    let vatCollected = 0;
    let grossReceipts = 0;
    let houseProfit = 0;
    let vendorPayouts = 0;
    let cogsEstimate = 0;
    let discounts = 0;
    sales.forEach((t) => {
      netSales += t.subtotal || 0;
      vatCollected += t.vatTotal || t.tax || 0;
      grossReceipts += t.total || 0;
      discounts += t.discount || 0;
      (t.items || []).forEach((i) => {
        houseProfit += i.houseProfitAmount || 0;
        vendorPayouts += i.vendorPayoutAmount || 0;
        cogsEstimate += (i.costBasis || 0) * (i.quantity || 0);
      });
    });
    return { count: sales.length, netSales, vatCollected, grossReceipts, houseProfit, vendorPayouts, cogsEstimate, discounts };
  }, [transactions, year]);

  // ---- Derived return figures -------------------------------------------
  const totalGross = draft.income.reduce((a, l) => a + num(l.gross), 0);
  const totalWithheld = draft.income.reduce((a, l) => a + num(l.withheld), 0);
  const totalDeductions = draft.deductions.reduce((a, v) => a + num(v), 0);
  const taxableIncome = Math.max(0, totalGross - totalDeductions);
  const grossLiability = computeGrossLiability(taxableIncome, draft.brackets, draft.flatRate);
  const creditsVal = num(draft.credits);
  const netLiability = Math.max(0, grossLiability - creditsVal);
  const totalPaid = totalWithheld + num(draft.otherPaid);
  const balanceDue = Math.max(0, netLiability - totalPaid);
  const refundDue = Math.max(0, totalPaid - netLiability);

  // ---- Auto-fill helpers -------------------------------------------------
  const addToIncomeLine = (idx: number, amount: number) => {
    if (!amount) return;
    setDraft((d) => {
      const income = d.income.map((l, i) =>
        i === idx ? { ...l, gross: (num(l.gross) + amount).toFixed(2) } : l
      );
      return { ...d, income };
    });
  };

  const handleSaveDraft = () => {
    saveDraftToStore(draft);
    setSaveMsg(`Draft for tax year ${draft.year} saved on this device.`);
    setTimeout(() => setSaveMsg(null), 3500);
  };

  const handleLoadDraft = () => {
    const stored = loadDrafts()[draft.year];
    if (stored) setDraft(stored);
    setSaveMsg(stored ? `Loaded saved draft for ${draft.year}.` : `No saved draft found for ${draft.year}.`);
    setTimeout(() => setSaveMsg(null), 3500);
  };


  // ---- Export & print -----------------------------------------------------
  const buildPrintHtml = (): string => {
    const inc = draft.income
      .map((l, i) => `<tr><td><b>${i + 1}. ${l.label}</b></td><td class="r">${l.gross ? money(num(l.gross)) : ''}</td><td class="r">${l.withheld ? money(num(l.withheld)) : ''}</td></tr>`)
      .join('');
    const ded = draft.deductions
      .map((v, i) => `<tr><td><b>${8 + i}. ${DEDUCTION_LABELS[i]}</b></td><td class="r">${v ? money(num(v)) : ''}</td></tr>`)
      .join('');
    const fs = draft.filingStatus;
    const statusStr = [fs === 'single' ? '☑' : '☐', ' Single&nbsp;&nbsp;', fs === 'joint' ? '☑' : '☐', ' Married/Joint&nbsp;&nbsp;', fs === 'head' ? '☑' : '☐', ' Head of Household'].join('');
    return `<html><head><title>Tax Return ${draft.year}</title><style>
      body{font-family:Georgia,'Times New Roman',serif;padding:32px;color:#111;font-size:13px}
      h1{font-size:19px;margin:0;text-align:center} h2{font-size:13px;margin:22px 0 6px;border-bottom:2px solid #333;padding-bottom:3px}
      table{border-collapse:collapse;width:100%;margin-top:4px}
      td,th{border:1px solid #999;padding:5px 8px;font-size:12px}
      th{background:#eee;text-align:left} .r{text-align:right;font-family:monospace}
      .meta{display:flex;flex-wrap:wrap;gap:4px 24px;margin-top:10px;font-size:12px}
      .decl{font-style:italic;background:#f5f5f0;border:1px solid #ccc;padding:10px;margin-top:18px;font-size:12px}
      .sig{margin-top:26px;display:grid;grid-template-columns:1fr 1fr;gap:14px 40px;font-size:12px}
      .line{border-bottom:1px solid #333;height:22px}
      @media print{.noprint{display:none}}
    </style></head><body>
      <h1>UNIVERSAL INDIVIDUAL INCOME TAX RETURN</h1>
      <p style="text-align:center;margin:2px 0 12px;font-size:11px">Tax Year ${draft.year} • Currency: ${settings.primaryCurrency || 'SCR'} (${symbol})</p>

      <h2>1. TAXPAYER IDENTIFICATION &amp; FILING STATUS</h2>
      <div class="meta"><span><b>Name:</b> ${draft.name || '—'}</span><span><b>TIN:</b> ${draft.tin || '—'}</span></div>
      <div class="meta"><span><b>Address:</b> ${draft.address || '—'}, ${draft.city || '—'}, ${draft.country || '—'}</span></div>
      <div class="meta"><span><b>DOB:</b> ${draft.dob || '—'}</span><span><b>Email:</b> ${draft.email || '—'}</span><span><b>Phone:</b> ${draft.phone || '—'}</span></div>
      <div class="meta"><span><b>Filing Status:</b> ${statusStr}</span></div>

      <h2>2. GROSS INCOME REPORTING</h2>
      <table><thead><tr><th style="width:55%">Income Source</th><th>Gross Amount (${symbol})</th><th>Tax Withheld (${symbol})</th></tr></thead>
      <tbody>${inc}
        <tr><td><b>7. TOTAL GROSS INCOME</b></td><td class="r"><b>${money(totalGross)}</b></td><td class="r"><b>${money(totalWithheld)}</b></td></tr>
      </tbody></table>

      <h2>3. DEDUCTIONS, ALLOWANCES &amp; TAXABLE INCOME</h2>
      <table><tbody>${ded}
        <tr><td><b>12. TOTAL DEDUCTIONS</b></td><td class="r"><b>${money(totalDeductions)}</b></td></tr>
        <tr><td><b>13. NET TAXABLE INCOME (Line 7 − Line 12)</b></td><td class="r"><b>${money(taxableIncome)}</b></td></tr>
      </tbody></table>

      <h2>4. FINAL TAX CALCULATION &amp; RECONCILIATION</h2>
      <table><tbody>
        <tr><td><b>14. Gross Tax Liability</b> (${draft.useBrackets ? `progressive brackets (${draft.brackets.length} band(s))` : `flat ${num(draft.flatRate)}%`})</td><td class="r">${money(grossLiability)}</td></tr>
        <tr><td><b>15. Non-Refundable / Foreign Tax Credits</b></td><td class="r">${money(creditsVal)}</td></tr>
        <tr><td><b>16. Net Tax Liability (Line 14 − Line 15, min 0)</b></td><td class="r">${money(netLiability)}</td></tr>
        <tr><td><b>17. Total Tax Already Paid / Withheld</b></td><td class="r">${money(totalPaid)}</td></tr>
        <tr><td><b>18. FINAL BALANCE DUE</b></td><td class="r"><b>${money(balanceDue)}</b></td></tr>
        <tr><td><b>19. OVERPAYMENT / REFUND DUE</b></td><td class="r"><b>${money(refundDue)}</b></td></tr>
      </tbody></table>

      <h2>5. DECLARATION &amp; SIGNATURE</h2>
      <div class="decl">I hereby declare, under penalty of perjury under the applicable laws of my jurisdiction, that this return and any accompanying schedules or statements have been examined by me and are, to the best of my knowledge and belief, true, correct, and complete.</div>
      <div class="sig">
        <div><b>Taxpayer's Signature:</b><div class="line"></div>Date: ______________</div>
        <div><b>Preparer's Signature:</b> ${draft.preparerName || '________________'}<div class="line"></div>Date: ______________</div>
        <div><b>Preparer's TIN/PTIN:</b> ${draft.preparerTin || '________________'}</div>
        <div><b>Generated by POS books on:</b> ${new Date().toLocaleDateString()}</div>
      </div>
      <p class="noprint" style="margin-top:20px"><button onclick="window.print()">Print / Save as PDF</button></p>
    </body></html>`;
  };

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=950,height=800');
    if (!win) return;
    win.document.write(buildPrintHtml());
    win.document.close();
  };

  const handleExportCsv = () => {
    const rows: string[] = [];
    rows.push(`UNIVERSAL INDIVIDUAL INCOME TAX RETURN,Tax Year ${draft.year}`);
    rows.push(`Taxpayer,"${draft.name}; TIN ${draft.tin}; ${draft.address}, ${draft.city}, ${draft.country}"`);
    rows.push('');
    rows.push('SECTION,GROSS,WITHHELD');
    draft.income.forEach((l, i) =>
      rows.push(`"${i + 1}. ${l.label}",${num(l.gross).toFixed(2)},${num(l.withheld).toFixed(2)}`)
    );
    rows.push(`"7. TOTAL GROSS INCOME",${totalGross.toFixed(2)},${totalWithheld.toFixed(2)}`);
    rows.push('');
    rows.push('DEDUCTIONS,AMOUNT');
    draft.deductions.forEach((v, i) =>
      rows.push(`"${8 + i}. ${DEDUCTION_LABELS[i]}",${num(v).toFixed(2)}`)
    );
    rows.push(`"12. TOTAL DEDUCTIONS",${totalDeductions.toFixed(2)}`);
    rows.push(`"13. NET TAXABLE INCOME",${taxableIncome.toFixed(2)}`);
    rows.push('');
    rows.push('CALCULATION,AMOUNT');
    rows.push(`"14. Gross Tax Liability",${grossLiability.toFixed(2)}`);
    rows.push(`"15. Tax Credits",${creditsVal.toFixed(2)}`);
    rows.push(`"16. Net Tax Liability",${netLiability.toFixed(2)}`);
    rows.push(`"17. Total Tax Paid/Withheld",${totalPaid.toFixed(2)}`);
    rows.push(`"18. BALANCE DUE",${balanceDue.toFixed(2)}`);
    rows.push(`"19. REFUND DUE",${refundDue.toFixed(2)}`);
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Tax_Return_${draft.year}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };



  const inp = 'bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 w-full';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#161B22] border border-[#1E293B] p-4 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-400" /> Tax Return Assistant
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Universal income-tax worksheet pre-filled from your POS books — your base for filing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[10px] font-bold uppercase text-slate-500">Tax Year</label>
          <input
            type="number"
            value={draft.year}
            onChange={(e) => switchYear(e.target.value)}
            className={`${inp} !w-24`}
          />
          <button onClick={handleSaveDraft} className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors">
            <Save className="w-3.5 h-3.5" /> Save Draft
          </button>
          <button onClick={handleLoadDraft} className="flex items-center gap-1.5 bg-[#0F1115] hover:bg-slate-800 text-slate-300 border border-[#1E293B] px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors">
            Load Draft
          </button>
          <button onClick={handleExportCsv} className="flex items-center gap-1.5 bg-[#0F1115] hover:bg-slate-800 text-emerald-300 border border-[#1E293B] px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors">
            <Printer className="w-3.5 h-3.5" /> Print Return
          </button>
        </div>
      </div>
      {saveMsg && (
        <div className="text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800 rounded-lg px-3 py-2">{saveMsg}</div>
      )}

      {/* POS books summary for the year */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
          <Wand2 className="w-4 h-4 text-amber-400" /> Your Books for {draft.year}
          <span className="normal-case font-normal text-slate-500">— figures pulled live from sales records ({books.count} receipts)</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {[
            { label: 'Net Sales (excl. VAT)', value: books.netSales },
            { label: 'VAT Collected', value: books.vatCollected },
            { label: 'Gross Receipts (incl. VAT)', value: books.grossReceipts },
            { label: 'House Net Profit', value: books.houseProfit },
            { label: 'Vendor Payouts Owed', value: books.vendorPayouts },
            { label: 'Cost of Goods Estimate', value: books.cogsEstimate },
          ].map((s) => (
            <div key={s.label} className="bg-[#0F1115] border border-[#1E293B] rounded-lg p-2.5">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className="text-sm font-black font-mono text-[#E2E8F0] mt-0.5">{symbol}{money(s.value)}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => addToIncomeLine(1, books.houseProfit)} className="flex items-center gap-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors">
            <PlusCircle className="w-3 h-3" /> Add House Net Profit to Line 2 (Business Income)
          </button>
          <button onClick={() => addToIncomeLine(1, books.netSales)} className="flex items-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors">
            <PlusCircle className="w-3 h-3" /> Add Net Sales (excl. VAT) to Line 2
          </button>
          <span className="text-[10px] text-slate-500 self-center">Tip: business expenses for Line 9 usually ≈ Cost of Goods ({symbol}{money(books.cogsEstimate)})</span>
        </div>
      </div>


      {/* SECTION 1: Taxpayer */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <UserRound className="w-4 h-4 text-cyan-400" /> 1. Taxpayer Identification &amp; Filing Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input placeholder="Full Legal Name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} className={inp} />
          <input placeholder="Tax ID Number (TIN / SSN)" value={draft.tin} onChange={(e) => patch({ tin: e.target.value })} className={inp} />
          <input type="date" title="Date of Birth" value={draft.dob} onChange={(e) => patch({ dob: e.target.value })} className={inp} />
          <input placeholder="Street Address" value={draft.address} onChange={(e) => patch({ address: e.target.value })} className={`${inp} sm:col-span-2`} />
          <input placeholder="City, State/Region, Postal Code" value={draft.city} onChange={(e) => patch({ city: e.target.value })} className={inp} />
          <input placeholder="Country of Residence" value={draft.country} onChange={(e) => patch({ country: e.target.value })} className={inp} />
          <input placeholder="Email Address" value={draft.email} onChange={(e) => patch({ email: e.target.value })} className={inp} />
          <input placeholder="Phone" value={draft.phone} onChange={(e) => patch({ phone: e.target.value })} className={inp} />
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-300">
          <span className="font-bold uppercase tracking-wider text-slate-500">Filing Status</span>
          {([['single', 'Single'], ['joint', 'Married / Joint'], ['head', 'Head of Household']] as [FilingStatus, string][]).map(([v, label]) => (
            <label key={v} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="filingStatus"
                checked={draft.filingStatus === v}
                onChange={() => patch({ filingStatus: v })}
                className="accent-emerald-500"
              />
              {label}
            </label>
          ))}
        </div>
      </div>


      {/* SECTION 2: Income */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-emerald-400" /> 2. Gross Income Reporting (all figures in {symbol})
        </h3>
        <div className="space-y-1.5">
          {draft.income.map((line, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_120px] sm:grid-cols-[1fr_160px_160px] gap-2 items-center bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2">
              <div className="text-[11px] text-slate-300">
                <span className="font-black text-slate-500 mr-1.5">{i + 1}.</span>{line.label}
              </div>
              <input
                type="number"
                step="0.01"
                placeholder={`Gross ${symbol}`}
                value={line.gross}
                onChange={(e) => {
                  const income = [...draft.income];
                  income[i] = { ...line, gross: e.target.value };
                  patch({ income });
                }}
                className={`${inp} font-mono text-right`}
              />
              <input
                type="number"
                step="0.01"
                placeholder={`Withheld ${symbol}`}
                value={line.withheld}
                onChange={(e) => {
                  const income = [...draft.income];
                  income[i] = { ...line, withheld: e.target.value };
                  patch({ income });
                }}
                className={`${inp} font-mono text-right`}
              />
            </div>
          ))}
          <div className="grid grid-cols-[1fr_120px_120px] sm:grid-cols-[1fr_160px_160px] gap-2 items-center px-3 py-2">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-200">7. Total Gross Income</div>
            <div className="text-right font-mono font-black text-sm text-emerald-400">{money(totalGross)}</div>
            <div className="text-right font-mono font-black text-sm text-cyan-400">{money(totalWithheld)}</div>
          </div>
        </div>
      </div>


      {/* SECTION 3: Deductions */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
          <MinusCircle className="w-4 h-4 text-rose-400" /> 3. Deductions, Allowances &amp; Taxable Income
        </h3>
        <div className="space-y-1.5">
          {draft.deductions.map((val, i) => (
            <div key={i} className="grid grid-cols-[1fr_140px] gap-2 items-center bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2">
              <div className="text-[11px] text-slate-300">
                <span className="font-black text-slate-500 mr-1.5">{8 + i}.</span>{DEDUCTION_LABELS[i]}
              </div>
              <input
                type="number"
                step="0.01"
                placeholder={`${symbol}`}
                value={val}
                onChange={(e) => {
                  const deductions = [...draft.deductions];
                  deductions[i] = e.target.value;
                  patch({ deductions });
                }}
                className={`${inp} font-mono text-right`}
              />
            </div>
          ))}
          <div className="px-1">
            <button
              onClick={() =>
                patch({
                  deductions: draft.deductions.map((v, idx) =>
                    idx === 1 && !num(v) ? books.cogsEstimate.toFixed(2) : v
                  ),
                })
              }
              disabled={!books.cogsEstimate}
              className="flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600/30 disabled:opacity-40 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors"
            >
              <MinusCircle className="w-3 h-3" /> Use Cost of Goods ({symbol}{money(books.cogsEstimate)}) on Line 9
            </button>
          </div>
          <div className="grid grid-cols-[1fr_140px] gap-2 items-center px-3 py-1">
            <div className="text-[11px] font-bold text-slate-400">12. Total Deductions</div>
            <div className="text-right font-mono font-black text-sm text-rose-400">-{money(totalDeductions)}</div>
          </div>
          <div className="grid grid-cols-[1fr_140px] gap-2 items-center bg-emerald-950/40 border border-emerald-800 rounded-lg px-3 py-2">
            <div className="text-[11px] font-black uppercase tracking-wide text-emerald-300">13. Net Taxable Income</div>
            <div className="text-right font-mono font-black text-sm text-emerald-300">{money(taxableIncome)}</div>
          </div>
        </div>
      </div>


      {/* SECTION 4: Tax Calculation */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
          <Landmark className="w-4 h-4 text-amber-400" /> 4. Final Tax Calculation &amp; Reconciliation
        </h3>

        {/* Rate mode toggle */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex bg-[#0F1115] p-1 rounded-lg border border-[#1E293B] text-[11px] font-bold">
            <button
              onClick={() => patch({ useBrackets: false })}
              className={`px-3 py-1 rounded-md transition-colors ${!draft.useBrackets ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Flat Rate
            </button>
            <button
              onClick={() => patch({ useBrackets: true })}
              className={`px-3 py-1 rounded-md transition-colors ${draft.useBrackets ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Progressive Brackets
            </button>
          </div>

          {!draft.useBrackets ? (
            <label className="flex items-center gap-2 text-[11px] text-slate-300">
              Effective flat rate %
              <input
                type="number"
                step="0.01"
                value={draft.flatRate}
                onChange={(e) => patch({ flatRate: e.target.value })}
                placeholder="e.g. 15"
                className={`${inp} !w-24 font-mono`}
              />
            </label>
          ) : (
            <span className="text-[10px] text-slate-500">Bands from lowest to highest — leave the last cap blank for "and above"</span>
          )}
        </div>

        {draft.useBrackets && (
          <div className="space-y-1.5 mb-3">
            {draft.brackets.map((b, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2">
                <span className="text-[10px] font-black uppercase text-slate-500 w-14">Band {i + 1}</span>
                <label className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  Income up to
                  <input
                    type="number"
                    step="0.01"
                    placeholder="∞ (top band)"
                    value={b.cap}
                    onChange={(e) => {
                      const brackets = [...draft.brackets];
                      brackets[i] = { ...b, cap: e.target.value };
                      patch({ brackets });
                    }}
                    className={`${inp} !w-32 font-mono text-right`}
                  />
                </label>
                <label className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  rate %
                  <input
                    type="number"
                    step="0.01"
                    value={b.rate}
                    onChange={(e) => {
                      const brackets = [...draft.brackets];
                      brackets[i] = { ...b, rate: e.target.value };
                      patch({ brackets });
                    }}
                    className={`${inp} !w-20 font-mono text-right`}
                  />
                </label>
                {draft.brackets.length > 1 && (
                  <button
                    onClick={() => patch({ brackets: draft.brackets.filter((_, idx) => idx !== i) })}
                    className="text-rose-400 hover:text-rose-300 p-1"
                    title="Remove band"
                  >
                    <MinusCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => patch({ brackets: [...draft.brackets, { cap: '', rate: '' }] })}
              className="flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 text-[10px] font-bold px-1"
            >
              <PlusCircle className="w-3 h-3" /> Add bracket
            </button>
          </div>
        )}


        {/* Credits & payments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <label className="text-[10px] font-semibold text-slate-400 space-y-1 block">
            15. Non-refundable / foreign tax credits ({symbol})
            <input
              type="number"
              step="0.01"
              value={draft.credits}
              onChange={(e) => patch({ credits: e.target.value })}
              placeholder="0.00"
              className={`${inp} font-mono text-right`}
            />
          </label>
          <label className="text-[10px] font-semibold text-slate-400 space-y-1 block">
            Other tax already paid (advances / instalments) ({symbol})
            <input
              type="number"
              step="0.01"
              value={draft.otherPaid}
              onChange={(e) => patch({ otherPaid: e.target.value })}
              placeholder="0.00"
              className={`${inp} font-mono text-right`}
            />
          </label>
        </div>

        {/* Reconciliation summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
          {[
            { label: '14. Gross Tax Liability', value: grossLiability, color: 'text-slate-200' },
            { label: '16. Net Tax Liability', value: netLiability, color: 'text-amber-300' },
            { label: '17. Total Paid / Withheld', value: totalPaid, color: 'text-cyan-300' },
          ].map((s) => (
            <div key={s.label} className="bg-[#0F1115] border border-[#1E293B] rounded-lg p-2.5">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className={`text-sm font-black font-mono mt-0.5 ${s.color}`}>{symbol}{money(s.value)}</div>
            </div>
          ))}
          <div className={`rounded-lg p-2.5 border ${balanceDue > 0 ? 'bg-rose-950/50 border-rose-800' : 'bg-[#0F1115] border-[#1E293B]'}`}>
            <div className="text-[9px] uppercase tracking-wide text-slate-500">18. Balance Due</div>
            <div className={`text-sm font-black font-mono mt-0.5 ${balanceDue > 0 ? 'text-rose-300' : 'text-slate-600'}`}>{symbol}{money(balanceDue)}</div>
          </div>
          <div className={`rounded-lg p-2.5 border ${refundDue > 0 ? 'bg-emerald-950/50 border-emerald-800' : 'bg-[#0F1115] border-[#1E293B]'}`}>
            <div className="text-[9px] uppercase tracking-wide text-slate-500">19. Refund Due</div>
            <div className={`text-sm font-black font-mono mt-0.5 ${refundDue > 0 ? 'text-emerald-300' : 'text-slate-600'}`}>{symbol}{money(refundDue)}</div>
          </div>
        </div>
      </div>


      {/* SECTION 5: Declaration */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <UserRound className="w-4 h-4 text-purple-400" /> 5. Declaration &amp; Signature
        </h3>
        <p className="text-[11px] italic text-slate-400 bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2.5 leading-relaxed">
          I hereby declare, under penalty of perjury under the applicable laws of my jurisdiction, that this return
          and any accompanying schedules or statements have been examined by me and are, to the best of my knowledge
          and belief, true, correct, and complete.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input placeholder="Preparer's Name (if applicable)" value={draft.preparerName} onChange={(e) => patch({ preparerName: e.target.value })} className={inp} />
          <input placeholder="Preparer's TIN / PTIN" value={draft.preparerTin} onChange={(e) => patch({ preparerTin: e.target.value })} className={inp} />
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>Signature lines appear on the printed return.</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-600">
          ⚠️ This worksheet is a filing base compiled from your own records — always cross-check against your
          jurisdiction's official form and rules before submitting.
        </p>
      </div>
    </div>
  );
};

