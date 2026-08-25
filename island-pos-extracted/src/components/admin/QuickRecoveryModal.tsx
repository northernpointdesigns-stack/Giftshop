import React, { useState } from 'react';
import { Coins, Upload, ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, X, Globe, Lock } from 'lucide-react';
import { posDb } from '../../services/db';

interface QuickRecoveryModalProps {
  onClose: () => void;
  onRefreshData: () => void;
  onGrantAdmin: () => void;
  isAdminLoggedIn: boolean;
}

const POPULAR_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SCR', symbol: 'SR', name: 'Seychelles Rupee' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'SAR', symbol: 'SR', name: 'Saudi Riyal' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal' },
];

export const QuickRecoveryModal: React.FC<QuickRecoveryModalProps> = ({
  onClose,
  onRefreshData,
  onGrantAdmin,
  isAdminLoggedIn,
}) => {
  const currentSettings = posDb.getSettings();
  const [currencyCode, setCurrencyCode] = useState(currentSettings.primaryCurrency || 'USD');
  const [currencySymbol, setCurrencySymbol] = useState(currentSettings.primaryCurrencySymbol || '$');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSaveCurrency = (code: string, symbol: string) => {
    try {
      posDb.updateSettings({
        primaryCurrency: code.toUpperCase(),
        primaryCurrencySymbol: symbol,
      });
      setCurrencyCode(code.toUpperCase());
      setCurrencySymbol(symbol);
      setSuccessMsg(`Currency successfully updated to ${code.toUpperCase()} (${symbol})!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update currency');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = String(event.target?.result || '');
        const res = posDb.importBackup(content);
        if (res.ok) {
          setSuccessMsg('Backup restored successfully! All data and settings have been recovered.');
          onRefreshData();
          setTimeout(() => {
            onClose();
            window.location.reload();
          }, 1500);
        } else {
          setErrorMsg(`Restore failed: ${res.error}`);
        }
      } catch (err: any) {
        setErrorMsg(`Failed to parse backup file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-xl w-full p-6 shadow-2xl text-slate-100 space-y-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900/50 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Quick Currency & Data Recovery</h3>
            <p className="text-xs text-slate-400">
              Instantly reconfigure your currency or restore your store from a backup.
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Section 1: Currency Quick Setup */}
        <div className="space-y-3 bg-[#0D1117] p-4 rounded-xl border border-[#30363D]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" /> Select Primary Currency
            </label>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              Current: {currencyCode} ({currencySymbol})
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {POPULAR_CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => handleSaveCurrency(c.code, c.symbol)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  currencyCode === c.code
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                    : 'bg-[#161B22] border-[#30363D] text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                }`}
              >
                <span className="text-xs font-black">{c.code}</span>
                <span className="text-sm font-bold opacity-90">{c.symbol}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-[11px] text-slate-400 font-medium mb-1 block">Custom Currency Code</label>
              <input
                type="text"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                maxLength={4}
                className="w-full bg-[#161B22] border border-[#30363D] rounded-xl px-3 py-2 text-sm text-white uppercase font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 font-medium mb-1 block">Custom Symbol</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  maxLength={6}
                  className="w-full bg-[#161B22] border border-[#30363D] rounded-xl px-3 py-2 text-sm text-white font-bold"
                />
                <button
                  onClick={() => handleSaveCurrency(currencyCode, currencySymbol)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Data Export & Restore */}
        <div className="space-y-3 bg-[#0D1117] p-4 rounded-xl border border-[#30363D]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Upload className="w-4 h-4 text-cyan-400" /> Multi-Laptop Sync & Backup
            </label>
          </div>
          <p className="text-xs text-slate-400">
            To synchronize your products, sales history, inventory, and settings across laptops:
            <span className="block mt-1 text-slate-300 font-medium">1. Click Export below on Laptop A to download your current store backup JSON file.</span>
            <span className="block text-slate-300 font-medium">2. On Laptop B, open this modal and upload that file to instantly sync everything!</span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => {
                try {
                  const jsonStr = posDb.exportBackup();
                  const blob = new Blob([jsonStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `boutique-pos-sync-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setSuccessMsg('Store backup exported successfully for laptop sync!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                } catch (err: any) {
                  setErrorMsg(`Export failed: ${err.message}`);
                }
              }}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-indigo-600/25 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/35 font-bold text-xs transition-all shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Export Sync Backup (JSON)</span>
            </button>

            <label className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-cyan-600/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/25 cursor-pointer font-bold text-xs transition-all shadow-sm">
              <Upload className="w-4 h-4" />
              <span>Restore / Import JSON File</span>
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Section 3: Admin Access Recovery */}
        {!isAdminLoggedIn && (
          <div className="space-y-3 bg-[#0D1117] p-4 rounded-xl border border-[#30363D]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" /> Unlock Admin Access
              </label>
            </div>
            <p className="text-xs text-slate-400">
              Locked out of admin settings? Click below to instantly grant admin privileges for this session.
            </p>
            <button
              onClick={() => {
                onGrantAdmin();
                setSuccessMsg('Admin access granted successfully!');
                setTimeout(() => setSuccessMsg(''), 3000);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30 font-bold text-xs transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" /> Grant Admin Access Now
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-2 border-t border-[#30363D]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
          >
            Close & Return to POS
          </button>
        </div>
      </div>
    </div>
  );
};
