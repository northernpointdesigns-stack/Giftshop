import React, { useState } from 'react';
import {
  Settings,
  Store,
  DollarSign,
  Printer,
  Shield,
  RotateCcw,
  Database,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Lock,
} from 'lucide-react';
import { StoreSettings } from '../../types/pos';
import { posDb } from '../../services/db';
import { SqlInspectorModal } from './SqlInspectorModal';
import { soundService } from '../../services/audio';

interface AdminBackendProps {
  onRefresh: () => void;
}

export const AdminBackend: React.FC<AdminBackendProps> = ({ onRefresh }) => {
  const [settings, setSettings] = useState<StoreSettings>(posDb.getSettings());
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    posDb.saveSettings(settings);
    soundService.playSuccessChime();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
    onRefresh();
  };

  const handleResetDemoData = () => {
    if (
      window.confirm(
        'WARNING: This will reset all inventory, transactions, and EOD shifts back to initial factory demo seed state. Proceed?'
      )
    ) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0D13] p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Settings className="w-6 h-6 text-emerald-400" />
              <span>Store Configuration & Register Settings</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Customize receipt typography, foreign exchange rates, default VAT, and supervisor authorization PINs
            </p>
          </div>

          <button
            onClick={() => setIsSqlModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Database className="w-4 h-4 text-cyan-400" />
            <span>SQL Inspector</span>
          </button>
        </div>

        {savedToast && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Store settings successfully updated!</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-5">
          {/* Store Identification Card */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-[#1E293B]">
              <Store className="w-4 h-4 text-emerald-400" /> Store Identification & Header
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Store Name</label>
                <input
                  type="text"
                  value={settings.storeName}
                  onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  VAT / Tax Registration No (TIN)
                </label>
                <input
                  type="text"
                  value={settings.taxRegistrationNumber || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, taxRegistrationNumber: e.target.value })
                  }
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Store Address</label>
                <input
                  type="text"
                  value={settings.storeAddress}
                  onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Store Telephone</label>
                <input
                  type="text"
                  value={settings.storePhone}
                  onChange={(e) => setSettings({ ...settings, storePhone: e.target.value })}
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Currencies & Fiscal Tax */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-[#1E293B]">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Currencies & Fiscal VAT
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  USD to SCR Exchange Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.exchangeRate}
                  onChange={(e) =>
                    setSettings({ ...settings, exchangeRate: parseFloat(e.target.value) || 13.5 })
                  }
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 font-mono font-bold text-emerald-400"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">1 USD = {settings.exchangeRate} SCR</span>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Default Seychelles VAT (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.defaultTaxRate}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultTaxRate: parseFloat(e.target.value) || 15 })
                  }
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Thermal Printer Width
                </label>
                <select
                  value={settings.thermalPrinterWidth}
                  onChange={(e) =>
                    setSettings({ ...settings, thermalPrinterWidth: e.target.value as any })
                  }
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-white"
                >
                  <option value="80mm">80mm Standard POS Printer</option>
                  <option value="58mm">58mm Compact Mobile Printer</option>
                </select>
              </div>
            </div>
          </div>

          {/* Desktop App & Offline Terminal Hardware Card */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Printer className="w-4 h-4 text-sky-400" /> Desktop App & Hardware Terminal Configuration
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                Mac & Windows Ready
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#0F1117] border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Standalone Desktop Application (PWA & Electron)</span>
                </div>
                <p className="text-xs text-slate-400">
                  Install directly into your Mac Dock or Windows Start Menu. Operates 100% offline, connects to USB thermal receipt printers, kicks cash drawers, and projects cart items to a 2nd customer monitor.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const evt = new CustomEvent('open-desktop-install');
                  window.dispatchEvent(evt);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl text-xs font-bold shrink-0 transition-all shadow-md shadow-emerald-950/50 cursor-pointer flex items-center gap-2"
              >
                <span>Launch Desktop Setup</span>
              </button>
            </div>
          </div>

          {/* Security & Supervisor PINs */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-[#1E293B]">
              <Shield className="w-4 h-4 text-amber-400" /> Security PINs & Void Authorization
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Manager Authorization PIN (for Voids)
                </label>
                <input
                  type="password"
                  value={settings.adminPin || 'admin123'}
                  onChange={(e) => setSettings({ ...settings, adminPin: e.target.value })}
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-amber-500 rounded-xl px-3 py-2 font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Default Cashier Unlock PIN
                </label>
                <input
                  type="password"
                  value={settings.cashierPin || '1234'}
                  onChange={(e) => setSettings({ ...settings, cashierPin: e.target.value })}
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-amber-500 rounded-xl px-3 py-2 font-mono text-white"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetDemoData}
              className="px-4 py-2.5 rounded-xl border border-rose-900/50 hover:bg-rose-950/40 text-rose-400 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Factory Demo Data</span>
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-950/40"
            >
              Save Store Settings
            </button>
          </div>
        </form>

        <SqlInspectorModal
          isOpen={isSqlModalOpen}
          onClose={() => setIsSqlModalOpen(false)}
        />
      </div>
    </div>
  );
};
