import React, { useState, useEffect } from 'react';
import {
  Download,
  Laptop,
  CheckCircle2,
  Tv,
  Printer,
  Sparkles,
  RefreshCw,
  HardDrive,
  Copy,
  Check,
  Globe,
  WifiOff,
  Wifi,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import { installService, InstallState } from '../../services/installService';
import { posDb } from '../../services/db';

interface DesktopInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesktopInstallModal: React.FC<DesktopInstallModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [installState, setInstallState] = useState<InstallState>(installService.getState());
  const [activeOS, setActiveOS] = useState<'mac' | 'windows'>('mac');
  const [installStatusMsg, setInstallStatusMsg] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [testPrintSuccess, setTestPrintSuccess] = useState(false);
  const [drawerPulseSuccess, setDrawerPulseSuccess] = useState(false);

  useEffect(() => {
    const unsub = installService.subscribe((state) => {
      setInstallState(state);
      if (state.platform === 'windows') {
        setActiveOS('windows');
      } else {
        setActiveOS('mac');
      }
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setInstallStatusMsg('Launching installation prompt...');
    const res = await installService.promptInstall();
    if (res.outcome === 'accepted') {
      setInstallStatusMsg('App installed successfully to your desktop!');
      setTimeout(() => setInstallStatusMsg(null), 4000);
    } else if (res.outcome === 'dismissed') {
      setInstallStatusMsg('Installation was dismissed.');
      setTimeout(() => setInstallStatusMsg(null), 3000);
    } else {
      setInstallStatusMsg('Follow the quick browser guide below to add to your Mac Dock or Windows Desktop.');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2500);
  };

  const handleLaunchCustomerDisplay = () => {
    installService.openCustomerDisplayWindow();
  };

  const handleTestPrint = () => {
    setTestPrintSuccess(true);
    window.print();
    setTimeout(() => setTestPrintSuccess(false), 3000);
  };

  const handleTestDrawer = () => {
    installService.triggerDrawerPulse();
    setDrawerPulseSuccess(true);
    setTimeout(() => setDrawerPulseSuccess(false), 2500);
  };

  const handleExportBackup = () => {
    const backupData = {
      inventory: posDb.getInventory(),
      vendors: posDb.getVendors(),
      customers: posDb.getCustomers(),
      transactions: posDb.getTransactions(),
      sessions: posDb.getEODSessions(),
      settings: posDb.getSettings(),
      staff: posDb.getStaffUsers(),
      exportedAt: new Date().toISOString(),
      appVersion: '1.4.0',
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ocean_POS_Desktop_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto no-print">
      <div className="bg-[#0F1117] border border-[#1E293B] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1E293B] flex items-center justify-between bg-[#141824]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Install Ocean POS for Mac & Windows
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  OFFLINE READY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Run as a dedicated standalone desktop app with hardware scanner, thermal printer & dual-screen support
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Install Action Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#161F2E] to-[#121A24] border border-emerald-500/30 shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-base font-bold text-white">
                    {installState.isInstalled
                      ? 'Ocean POS is Installed & Running in Desktop Window'
                      : 'One-Click Direct Desktop Installation'}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Installs locally on your computer with zero configuration. Launches from your Mac Dock or Windows Start Menu without browser tabs, works 100% offline, and gives instant access to cash registers.
                </p>
              </div>

              <div className="shrink-0 w-full md:w-auto">
                {installState.isInstalled ? (
                  <div className="px-4 py-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>App Already Installed</span>
                  </div>
                ) : (
                  <button
                    onClick={handleInstallClick}
                    className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install Desktop App Now</span>
                  </button>
                )}
              </div>
            </div>

            {installStatusMsg && (
              <div className="mt-3 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-lg">
                {installStatusMsg}
              </div>
            )}
          </div>

          {/* OS Switcher Tabs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveOS('mac')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeOS === 'mac'
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span className="text-base">🍎</span>
                  <span>macOS (Apple Silicon & Intel)</span>
                  {installState.platform === 'mac' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px]">
                      Your OS
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveOS('windows')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeOS === 'windows'
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span className="text-base">🪟</span>
                  <span>Windows 11 / 10 / POS Terminals</span>
                  {installState.platform === 'windows' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px]">
                      Your OS
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* macOS Instructions */}
            {activeOS === 'mac' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Method 1: Google Chrome / Edge on Mac */}
                  <div className="p-4 rounded-xl bg-[#12151F] border border-[#1E293B] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">Method 1: Chrome / Edge PWA</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                          Recommended
                        </span>
                      </div>
                    </div>
                    <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside">
                      <li>
                        Click <strong className="text-white font-semibold">"Install Desktop App Now"</strong> above, or look at the top right of your address bar for the <strong className="text-emerald-400 font-semibold">Install</strong> icon (computer with down arrow).
                      </li>
                      <li>Click <strong className="text-white font-semibold">Install</strong> in the browser prompt.</li>
                      <li>
                        The POS launches immediately in its own clean Mac window and automatically pins to your <strong className="text-white font-semibold">Dock & Launchpad</strong>.
                      </li>
                      <li>
                        Supports <strong className="text-white font-semibold">Cmd+Space</strong> Spotlight search for <em className="text-emerald-300">"Ocean POS"</em> anytime.
                      </li>
                    </ol>
                  </div>

                  {/* Method 2: Safari on macOS Sonoma & Newer */}
                  <div className="p-4 rounded-xl bg-[#12151F] border border-[#1E293B] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">Method 2: Safari Web App</span>
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] font-bold">
                        Native Safari
                      </span>
                    </div>
                    <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside">
                      <li>In Safari, click the top menu: <strong className="text-white font-semibold">File → Add to Dock...</strong></li>
                      <li>Confirm the app title: <strong className="text-emerald-400 font-semibold">"Seychelles Ocean Retail POS"</strong>.</li>
                      <li>Click <strong className="text-white font-semibold">Add</strong>.</li>
                      <li>The POS icon will appear directly in your macOS Dock with its own dedicated sandbox and offline storage.</li>
                    </ol>
                  </div>
                </div>

                {/* Developer / Enterprise Native DMG Build */}
                <div className="p-4 rounded-xl bg-[#12151F] border border-[#1E293B] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs text-white">Method 3: Native Mac Application (.DMG / .APP)</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">Electron Builder</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    If you want to package a standalone signed <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded">.dmg</code> installer for offline retail MacBooks and iMac registers, run this command in terminal:
                  </p>
                  <div className="flex items-center justify-between bg-black/60 border border-slate-800 rounded-lg px-3 py-2 font-mono text-xs text-emerald-300">
                    <code>npm run electron:build:mac</code>
                    <button
                      onClick={() => copyToClipboard('npm run electron:build:mac', 'mac-build')}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Copy command"
                    >
                      {copiedScript === 'mac-build' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Windows Instructions */}
            {activeOS === 'windows' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Windows PWA Method */}
                  <div className="p-4 rounded-xl bg-[#12151F] border border-[#1E293B] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">Method 1: Edge & Chrome for Windows 11/10</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                        Recommended
                      </span>
                    </div>
                    <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside">
                      <li>Click the <strong className="text-emerald-400 font-semibold">"Install Desktop App Now"</strong> button above.</li>
                      <li>In the browser popup, check <strong className="text-white font-semibold">"Create Desktop Shortcut"</strong> and <strong className="text-white font-semibold">"Pin to Taskbar"</strong>.</li>
                      <li>Click <strong className="text-white font-semibold">Install</strong>.</li>
                      <li>
                        Windows creates a dedicated desktop icon, Start Menu entry, and runs in a borderless fullscreen register interface.
                      </li>
                    </ol>
                  </div>

                  {/* Windows POS Terminal Auto-Start */}
                  <div className="p-4 rounded-xl bg-[#12151F] border border-[#1E293B] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">Method 2: Auto-Start Register on PC Boot</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold">
                        Cashier Kiosk
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      To make the POS launch automatically whenever the cashier PC turns on:
                    </p>
                    <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside">
                      <li>Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">Win + R</kbd> on your keyboard.</li>
                      <li>Type <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded font-mono">shell:startup</code> and press Enter.</li>
                      <li>Copy and paste the <strong className="text-white font-semibold">"Ocean POS"</strong> desktop shortcut into this folder.</li>
                    </ol>
                  </div>
                </div>

                {/* Developer / Enterprise Native EXE Build */}
                <div className="p-4 rounded-xl bg-[#12151F] border border-[#1E293B] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs text-white">Method 3: Native Windows Setup (.EXE / .MSI)</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">NSIS Installer</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    To build a standalone single-file Windows installer executable (<code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded">.exe</code>) with native USB barcode COM port & raw ESC/POS thermal printing:
                  </p>
                  <div className="flex items-center justify-between bg-black/60 border border-slate-800 rounded-lg px-3 py-2 font-mono text-xs text-emerald-300">
                    <code>npm run electron:build:win</code>
                    <button
                      onClick={() => copyToClipboard('npm run electron:build:win', 'win-build')}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="Copy command"
                    >
                      {copiedScript === 'win-build' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Hardware & Terminal Tools */}
          <div className="p-5 rounded-2xl bg-[#12151F] border border-[#1E293B] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Desktop Peripherals & Diagnostic Hub
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {installState.isOnline ? (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <Wifi className="w-3.5 h-3.5" /> Online & Synchronized
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400">
                    <WifiOff className="w-3.5 h-3.5" /> Offline Mode Active
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Dual Screen Launcher */}
              <div className="p-3.5 rounded-xl bg-[#161B26] border border-slate-800 space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <Tv className="w-4 h-4 text-sky-400" />
                    <span>2nd Screen Customer Display</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Pop out live cart screen on your customer-facing monitor.
                  </p>
                </div>
                <button
                  onClick={handleLaunchCustomerDisplay}
                  className="w-full py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Launch Screen</span>
                </button>
              </div>

              {/* Thermal Printer Diagnostic */}
              <div className="p-3.5 rounded-xl bg-[#161B26] border border-slate-800 space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>Thermal Printer Test</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Send test slip to 80mm/58mm USB, Bluetooth, or LAN receipt printer.
                  </p>
                </div>
                <button
                  onClick={handleTestPrint}
                  className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2 border border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{testPrintSuccess ? 'Printing Slip...' : 'Test Print Slip'}</span>
                </button>
              </div>

              {/* Cash Drawer RJ11 Trigger */}
              <div className="p-3.5 rounded-xl bg-[#161B26] border border-slate-800 space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    <span>Cash Drawer Pulse</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Test RJ11 cash drawer kick-out solenoid pulse.
                  </p>
                </div>
                <button
                  onClick={handleTestDrawer}
                  className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2 border border-slate-700"
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      drawerPulseSuccess ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  />
                  <span>{drawerPulseSuccess ? 'Pulse Sent!' : 'Kick Drawer'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Database Backup & Terminal Migration */}
          <div className="p-4 rounded-xl bg-[#12151F] border border-[#1E293B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-white">Database Backup & Transfer</h4>
              <p className="text-[11px] text-slate-400">
                Download full local database copy (inventory, vendors, sales, and settings) to move to another Mac or Windows PC.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export DB Backup (.json)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1E293B] bg-[#141824] flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Seychelles Ocean Retail POS v1.4.0</span>
            <span>•</span>
            <span className="text-emerald-400">PWA & Electron Compatible</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
