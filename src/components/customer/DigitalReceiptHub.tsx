import React, { useState, useEffect } from 'react';
import { QrCode, Search, FileText, CheckCircle2, Copy } from 'lucide-react';
import { Transaction } from '../../types/pos';
import { posDb } from '../../services/db';
import { ReceiptModal } from '../pos/ReceiptModal';

export const DigitalReceiptHub: React.FC = () => {
  const [receiptQuery, setReceiptQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const transactions = posDb.getTransactions().filter((t) => !t.isVoided);

  // Check URL query param ?id=REC-...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam) {
      setReceiptQuery(idParam);
      const found = posDb.getTransactionByIdOrReceipt(idParam);
      if (found) setSelectedTx(found);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptQuery.trim()) return;
    const found = posDb.getTransactionByIdOrReceipt(receiptQuery.trim());
    if (found) {
      setSelectedTx(found);
    } else {
      alert('Receipt number not found.');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0D13] p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <QrCode className="w-6 h-6 text-emerald-400" />
            <span>Digital E-Receipt Lookup Portal</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Instant paperless digital tax invoices for tourists and retail patrons
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="bg-[#161B22] p-4 rounded-2xl border border-[#1E293B] flex gap-2">
          <input
            type="text"
            value={receiptQuery}
            onChange={(e) => setReceiptQuery(e.target.value)}
            placeholder="Enter receipt number (e.g. REC-20260823-0001)..."
            className="flex-1 bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md"
          >
            Find E-Receipt
          </button>
        </form>

        {/* Recent Public Receipts Grid */}
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white">Recent Store Invoices</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {transactions.slice(0, 8).map((tx) => (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="bg-[#0F1115] hover:bg-[#161F2A] border border-[#1E293B] hover:border-emerald-500/40 p-4 rounded-2xl cursor-pointer transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-cyan-400 text-xs">
                    {tx.receiptNumber}
                  </span>
                  <span className="font-mono font-extrabold text-emerald-400 text-xs">
                    SR {tx.total.toFixed(2)}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400">
                  {new Date(tx.timestamp).toLocaleString()} • {tx.items.length} items
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedTx && (
          <ReceiptModal
            transaction={selectedTx}
            onClose={() => setSelectedTx(null)}
          />
        )}
      </div>
    </div>
  );
};
