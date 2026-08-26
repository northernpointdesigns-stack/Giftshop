import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Database,
  Download,
  Calendar,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RotateCcw,
  Sparkles,
  Layers,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { posDb } from '../../services/db';
import { backupStorage } from '../../services/backupStorage';
import { scheduledBackupService } from '../../services/scheduledBackupService';
import { AutoBackupSnapshot, StoreSettings } from '../../types/pos';
import { downloadSQLiteDbFile, downloadJsonBackup } from '../../utils/sqliteExport';

interface AutoBackupModalProps {
  onClose: () => void;
  onRefreshData: () => void;
}

export const AutoBackupModal: React.FC<AutoBackupModalProps> = ({
  onClose,
  onRefreshData,
}) => {
  const [snapshots, setSnapshots] = useState<AutoBackupSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Settings state
  const [settings, setSettings] = useState<StoreSettings>(() => posDb.getSettings());

  const loadSnapshots = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await backupStorage.getAllSnapshots();
      setSnapshots(list);
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
    const unsubscribe = scheduledBackupService.subscribe(() => {
      loadSnapshots();
      setSettings(posDb.getSettings());
    });
    return () => unsubscribe();
  }, [loadSnapshots]);

  const handleUpdateSetting = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    const updated = { ...settings, [key]: value };
    posDb.updateSettings({ [key]: value });
    setSettings(updated);
    setStatusMessage({ text: 'Auto-backup preferences updated.', type: 'info' });
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleManualSnapshot = async () => {
    setIsTakingSnapshot(true);
    try {
      const snap = await scheduledBackupService.createBackupSnapshot({
        trigger: 'manual',
        autoDownload: false,
      });
      await loadSnapshots();
      onRefreshData();
      setStatusMessage({
        text: `Snapshot created & saved to browser storage (${(snap.sizeBytes / 1024).toFixed(1)} KB).`,
        type: 'success',
      });
    } catch (err) {
      setStatusMessage({ text: `Failed to create snapshot: ${String(err)}`, type: 'error' });
    } finally {
      setIsTakingSnapshot(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleExportLiveDb = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const sqlDump = posDb.exportSQLiteDump();
    downloadSQLiteDbFile(`boutique-pos-sqlite-${dateStr}.db`, sqlDump);
    posDb.markBackupDone();
    setSettings(posDb.getSettings());
    setStatusMessage({ text: 'Exported live SQLite state as .db file.', type: 'success' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleExportLiveJson = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const jsonDump = posDb.exportBackup();
    downloadJsonBackup(`boutique-pos-backup-${dateStr}.json`, jsonDump);
    posDb.markBackupDone();
    setSettings(posDb.getSettings());
    setStatusMessage({ text: 'Exported live JSON backup file.', type: 'success' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDownloadSnapshotDb = (snap: AutoBackupSnapshot) => {
    downloadSQLiteDbFile(`boutique-pos-${snap.date}-${snap.id}.db`, snap.dbSqlContent);
  };

  const handleDownloadSnapshotJson = (snap: AutoBackupSnapshot) => {
    downloadJsonBackup(`boutique-pos-${snap.date}-${snap.id}.json`, snap.jsonContent);
  };

  const handleRestoreSnapshot = (snap: AutoBackupSnapshot) => {
    if (
      confirm(
        `Are you sure you want to restore data from backup taken on ${new Date(snap.timestamp).toLocaleString()}?\n\nThis will replace current inventory, transactions, and settings with this snapshot.`
      )
    ) {
      const res = posDb.importBackup(snap.jsonContent);
      if (res.ok) {
        onRefreshData();
        setStatusMessage({ text: 'Database successfully restored from snapshot!', type: 'success' });
      } else {
        setStatusMessage({ text: `Restore failed: ${res.error}`, type: 'error' });
      }
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (confirm('Delete this backup snapshot from browser storage?')) {
      await backupStorage.deleteSnapshot(id);
      await loadSnapshots();
      setStatusMessage({ text: 'Snapshot deleted from browser storage.', type: 'info' });
      setTimeout(() => setStatusMessage(null), 2500);
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear ALL stored snapshots from browser storage?')) {
      await backupStorage.clearAllSnapshots();
      await loadSnapshots();
      setStatusMessage({ text: 'All snapshots cleared.', type: 'info' });
      setTimeout(() => setStatusMessage(null), 2500);
    }
  };

  const totalStoredBytes = snapshots.reduce((sum, s) => sum + (s.sizeBytes || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/85 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-4xl w-full text-[#E2E8F0] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between shrink-0 bg-[#161B22]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E2E8F0] flex items-center gap-2">
                Scheduled SQLite Auto-Backup & Browser Storage
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  .db Relational
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Automated end-of-business-day snapshots saved locally to browser storage with one-click .db downloads
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast Message */}
        {statusMessage && (
          <div
            className={`mx-5 mt-3 px-4 py-2 rounded-xl text-xs flex items-center gap-2 border font-medium transition-all ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
            }`}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {statusMessage.type === 'info' && <Sparkles className="w-4 h-4 text-cyan-400" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Auto-Backup Status
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${settings.enableAutoBackup !== false ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-xs font-bold text-[#E2E8F0]">
                  {settings.enableAutoBackup !== false ? 'Active & Scheduled' : 'Disabled'}
                </span>
              </div>
            </div>

            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Stored Snapshots
              </span>
              <span className="text-xs font-bold text-cyan-400 font-mono">
                {snapshots.length} daily snapshot{snapshots.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Storage Consumed
              </span>
              <span className="text-xs font-bold text-slate-200 font-mono">
                {(totalStoredBytes / 1024).toFixed(1)} KB (IndexedDB)
              </span>
            </div>

            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Last Backup Run
              </span>
              <span className="text-xs font-bold text-emerald-400 truncate block">
                {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleDateString() : 'Never'}
              </span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" /> Instant Database Export & Snapshot
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportLiveDb}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Export SQLite .db File</span>
              </button>

              <button
                type="button"
                onClick={handleManualSnapshot}
                disabled={isTakingSnapshot}
                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTakingSnapshot ? 'animate-spin' : ''}`} />
                <span>{isTakingSnapshot ? 'Saving Snapshot...' : 'Save Snapshot to Browser Storage Now'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportLiveJson}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-[#1E293B] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-400" />
                <span>Export JSON Backup</span>
              </button>
            </div>
          </div>

          {/* Scheduled Auto-Backup Configuration Settings */}
          <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Auto-Backup Schedule Rules
              </h3>
              <span className="text-[11px] text-slate-500">
                End-of-business-day automated triggers
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* Toggles */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.enableAutoBackup !== false}
                    onChange={(e) => handleUpdateSetting('enableAutoBackup', e.target.checked)}
                    className="rounded border-[#1E293B] text-emerald-500 focus:ring-0 accent-emerald-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-[#E2E8F0] font-semibold block">
                      Enable End-of-Day Automated Backup
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Triggers on closing the day or at the scheduled closing time
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.autoBackupToBrowserStorage !== false}
                    onChange={(e) => handleUpdateSetting('autoBackupToBrowserStorage', e.target.checked)}
                    className="rounded border-[#1E293B] text-emerald-500 focus:ring-0 accent-emerald-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-[#E2E8F0] font-semibold block">
                      Save Snapshots into Browser Storage
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Stores .db state history in persistent IndexedDB for instant recovery
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.autoDownloadDbOnDayClose !== false}
                    onChange={(e) => handleUpdateSetting('autoDownloadDbOnDayClose', e.target.checked)}
                    className="rounded border-[#1E293B] text-emerald-500 focus:ring-0 accent-emerald-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-[#E2E8F0] font-semibold block">
                      Prompt .db File Download on Day Close
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Automatically delivers downloadable .db file to cashier on EOD submit
                    </span>
                  </div>
                </label>
              </div>

              {/* Timing & Format */}
              <div className="space-y-3 bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Scheduled Daily Closing Time:
                  </label>
                  <input
                    type="time"
                    value={settings.autoBackupTime || '20:00'}
                    onChange={(e) => handleUpdateSetting('autoBackupTime', e.target.value)}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Daily snapshot automatically captures if register remains open past this time
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Download Format:
                    </label>
                    <select
                      value={settings.autoBackupFormat || 'both'}
                      onChange={(e) => handleUpdateSetting('autoBackupFormat', e.target.value as 'db' | 'json' | 'both')}
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-cyan-500"
                    >
                      <option value="db">SQLite (.db file)</option>
                      <option value="json">JSON Backup</option>
                      <option value="both">Both (.db & .json)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Retention Window:
                    </label>
                    <select
                      value={settings.autoBackupRetentionDays || 30}
                      onChange={(e) => handleUpdateSetting('autoBackupRetentionDays', Number(e.target.value))}
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-cyan-500"
                    >
                      <option value={7}>Last 7 Business Days</option>
                      <option value={14}>Last 14 Business Days</option>
                      <option value={30}>Last 30 Business Days</option>
                      <option value={60}>Last 60 Business Days</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Browser Storage Archive Table */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#1E293B] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Saved Daily Browser Storage Snapshots ({snapshots.length})
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Stored directly in browser persistent storage — click to download the SQLite .db file or restore state
                </p>
              </div>

              {snapshots.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition-colors flex items-center gap-1 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                Loading saved snapshots from browser storage...
              </div>
            ) : snapshots.length === 0 ? (
              <div className="p-8 text-center bg-[#0F1115]">
                <Database className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-300">No backup snapshots stored in browser yet</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                  Snapshots will automatically populate when you close the business day in EOD Balancing or when scheduled timer fires.
                </p>
                <button
                  onClick={handleManualSnapshot}
                  disabled={isTakingSnapshot}
                  className="mt-3 bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Take First Snapshot Now</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#1E293B] max-h-72 overflow-y-auto font-mono text-xs">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-3.5 bg-[#0F1115]/60 hover:bg-[#0F1115] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#E2E8F0] font-sans">
                          {snap.date}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-sans font-semibold border ${
                            snap.trigger === 'eod_close'
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                              : snap.trigger === 'scheduled_timer'
                              ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                              : 'bg-slate-700/50 border-slate-600 text-slate-300'
                          }`}
                        >
                          {snap.trigger === 'eod_close'
                            ? 'EOD Day Close'
                            : snap.trigger === 'scheduled_timer'
                            ? 'Scheduled Daily'
                            : 'Manual Snapshot'}
                        </span>
                        {snap.eodSessionId && (
                          <span className="text-[10px] text-slate-500">
                            ({snap.eodSessionId})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-sans">
                        <span>📦 {snap.itemCount} items</span>
                        <span>🧾 {snap.transactionCount} txs</span>
                        <span className="text-emerald-400 font-mono">${snap.totalSales.toFixed(2)} sales</span>
                        <span className="text-slate-500">({(snap.sizeBytes / 1024).toFixed(1)} KB)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center font-sans">
                      <button
                        onClick={() => handleDownloadSnapshotDb(snap)}
                        title="Download SQLite .db File"
                        className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>.db</span>
                      </button>

                      <button
                        onClick={() => handleDownloadSnapshotJson(snap)}
                        title="Download JSON Backup"
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-[#1E293B] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>.json</span>
                      </button>

                      <button
                        onClick={() => handleRestoreSnapshot(snap)}
                        title="Restore Database to this snapshot"
                        className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>

                      <button
                        onClick={() => handleDeleteSnapshot(snap.id)}
                        title="Delete snapshot"
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* External Restore Drag/Upload */}
          <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-800 text-slate-400 border border-slate-700">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#E2E8F0]">Restore from External File</h4>
                <p className="text-[11px] text-slate-400">
                  Select a previously exported POS backup (.json or .db) to restore full terminal state
                </p>
              </div>
            </div>

            <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0 flex items-center gap-2">
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Select File to Restore…</span>
              <input
                type="file"
                accept="application/json,.json,.db,.sqlite,.sql"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (confirm(`Restore database from "${f.name}"? Current data will be replaced.`)) {
                      const res = posDb.importBackup(String(reader.result));
                      if (res.ok) {
                        onRefreshData();
                        loadSnapshots();
                        setStatusMessage({ text: 'Database successfully restored from file!', type: 'success' });
                      } else {
                        setStatusMessage({ text: `Restore failed: ${res.error}`, type: 'error' });
                      }
                      setTimeout(() => setStatusMessage(null), 3500);
                    }
                  };
                  reader.readAsText(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1E293B] bg-[#161B22] flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span>SQLite .db format compliant with standard SQLite 3 tools & DB Browser for SQLite</span>
          </div>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
