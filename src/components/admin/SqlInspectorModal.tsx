import React, { useState } from 'react';
import { Database, X, Play, RefreshCw, Copy, CheckCircle2 } from 'lucide-react';
import { posDb } from '../../services/db';

interface SqlInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SqlInspectorModal: React.FC<SqlInspectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState<string>('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 10;');
  const [results, setResults] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleRunQuery = () => {
    const q = query.trim().toLowerCase();
    const inventory = posDb.getInventory();
    const transactions = posDb.getTransactions();
    const vendors = posDb.getVendors();
    const sessions = posDb.getEODSessions();

    let res: any[] = [];
    if (q.includes('transactions')) {
      res = transactions;
    } else if (q.includes('inventory')) {
      res = inventory;
    } else if (q.includes('vendors')) {
      res = vendors;
    } else if (q.includes('sessions') || q.includes('eod')) {
      res = sessions;
    } else {
      res = [{ message: 'Table not recognized. Try querying "transactions", "inventory", "vendors", or "sessions".' }];
    }

    setResults(res.slice(0, 50));
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Database SQL Inspector & Query Console</h2>
              <p className="text-[11px] text-slate-400">Query active POS ledger tables in real-time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Query Input Box */}
        <div className="p-4 bg-[#0F1115]/60 border-b border-[#1E293B] space-y-2 shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>SQL Query Prompt:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setQuery('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 20;')}
                className="hover:text-emerald-400 font-mono text-[10px]"
              >
                [transactions]
              </button>
              <button
                onClick={() => setQuery('SELECT * FROM inventory WHERE stockLevel <= reorderPoint;')}
                className="hover:text-emerald-400 font-mono text-[10px]"
              >
                [low_stock]
              </button>
              <button
                onClick={() => setQuery('SELECT * FROM vendors;')}
                className="hover:text-emerald-400 font-mono text-[10px]"
              >
                [vendors]
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleRunQuery}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Execute</span>
            </button>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 p-4 bg-[#0B0D13] overflow-y-auto font-mono text-xs text-slate-300">
          {results.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#1E293B] text-slate-400 text-[11px]">
                <span>Returned {results.length} rows</span>
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1 hover:text-white"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="bg-[#161B22] p-4 rounded-xl border border-[#1E293B] overflow-x-auto text-[11px] text-emerald-300">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-600 text-center">
              Execute a query above to view rows and ledger records.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
