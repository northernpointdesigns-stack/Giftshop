import React, { useState } from 'react';
import { X, Database, RefreshCw, Download, Table, Code } from 'lucide-react';
import { posDb } from '../../services/db';

interface SqlInspectorModalProps {
  onClose: () => void;
  onRefreshData: () => void;
}

export const SqlInspectorModal: React.FC<SqlInspectorModalProps> = ({
  onClose,
  onRefreshData,
}) => {
  const [activeTable, setActiveTable] = useState<
    'vendors' | 'inventory' | 'transactions' | 'payouts' | 'eod_sessions' | 'drawer_logs'
  >('inventory');

  const vendors = posDb.getVendors();
  const inventory = posDb.getInventory();
  const transactions = posDb.getTransactions();
  const payouts = posDb.getPayoutRecords();
  const eodSessions = posDb.getEODSessions();
  const drawerLogs = posDb.getDrawerLogs();

  const handleResetData = () => {
    if (
      confirm(
        'Reset SQLite Database to default sample seed state? All current custom items & transactions will be re-seeded.'
      )
    ) {
      posDb.resetToDefault();
      onRefreshData();
    }
  };

  const handleExportJson = () => {
    const data = {
      vendors,
      inventory,
      transactions,
      payouts,
      eodSessions,
      drawerLogs,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `island_pos_sqlite_dump_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  let activeData: unknown[] = [];
  if (activeTable === 'vendors') activeData = vendors;
  if (activeTable === 'inventory') activeData = inventory;
  if (activeTable === 'transactions') activeData = transactions;
  if (activeTable === 'payouts') activeData = payouts;
  if (activeTable === 'eod_sessions') activeData = eodSessions;
  if (activeTable === 'drawer_logs') activeData = drawerLogs;

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-4xl w-full p-6 text-[#E2E8F0] shadow-2xl relative max-h-[85vh] flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1E293B] shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#E2E8F0]">
                SQLite Database Schema Inspector & Seeder
              </h2>
              <p className="text-xs text-slate-400">
                Inspect local SQLite relational tables, query logs, and export database state
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table selector tabs */}
        <div className="flex items-center gap-2 mt-4 pb-2 border-b border-[#1E293B] overflow-x-auto shrink-0">
          {[
            { id: 'inventory', label: `Inventory (${inventory.length})` },
            { id: 'vendors', label: `Vendors (${vendors.length})` },
            { id: 'transactions', label: `Transactions (${transactions.length})` },
            { id: 'payouts', label: `Payout Records (${payouts.length})` },
            { id: 'eod_sessions', label: `EOD Sessions (${eodSessions.length})` },
            { id: 'drawer_logs', label: `Drawer Logs (${drawerLogs.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTable(tab.id as typeof activeTable)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap ${
                activeTable === tab.id
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'bg-[#0F1115] text-slate-400 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* JSON / SQL Table Dump */}
        <div className="my-4 bg-[#0F1115] p-4 rounded-xl border border-[#1E293B] font-mono text-xs overflow-y-auto flex-1 max-h-[380px] text-emerald-400">
          <pre>{JSON.stringify(activeData, null, 2)}</pre>
        </div>

        {/* Footer actions */}
        <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between shrink-0">
          <button
            onClick={handleResetData}
            className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Database Seeds</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Export DB Dump (JSON/SQL)</span>
            </button>

            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
