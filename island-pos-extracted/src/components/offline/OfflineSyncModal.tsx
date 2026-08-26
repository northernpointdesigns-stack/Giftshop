import React, { useState, useEffect } from 'react';
import {
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Server,
  ToggleLeft,
  ToggleRight,
  Database,
  ArrowRight,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { offlineSyncEngine, OfflineSyncStatus, OfflineQueueItem } from '../../services/offlineSyncEngine';
import { getSWRegistration } from '../../services/swRegister';

interface OfflineSyncModalProps {
  onClose: () => void;
  onRefreshData?: () => void;
}

export const OfflineSyncModal: React.FC<OfflineSyncModalProps> = ({ onClose, onRefreshData }) => {
  const [status, setStatus] = useState<OfflineSyncStatus>(offlineSyncEngine.getStatus());
  const [queue, setQueue] = useState<OfflineQueueItem[]>(offlineSyncEngine.getQueue());
  const [isProcessingManualSync, setIsProcessingManualSync] = useState(false);
  const [swActive, setSwActive] = useState<boolean>(false);

  useEffect(() => {
    const unsub = offlineSyncEngine.subscribe((newStatus) => {
      setStatus(newStatus);
      setQueue(offlineSyncEngine.getQueue());
    });

    setSwActive(!!getSWRegistration() || (typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller));

    return () => unsub();
  }, []);

  const handleManualSync = async () => {
    setIsProcessingManualSync(true);
    try {
      await offlineSyncEngine.processQueue();
      if (onRefreshData) onRefreshData();
    } finally {
      setIsProcessingManualSync(false);
    }
  };

  const handleToggleSimulatedOffline = () => {
    const nextVal = !status.isSimulatedOffline;
    offlineSyncEngine.setSimulatedOffline(nextVal);
  };

  const handleClearSynced = () => {
    offlineSyncEngine.clearSyncedItems();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/85 flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-2xl w-full p-6 text-[#E2E8F0] shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1E293B] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${status.effectiveOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {status.effectiveOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Service Worker &amp; Offline Sync Engine
              </h2>
              <p className="text-xs text-slate-400">
                Guarantees continuous transaction processing during internet outages
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Status Indicators Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Real Network Status Card */}
            <div className="bg-[#0F1115] border border-[#1E293B] p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Network Status</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                  status.isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {status.isOnline ? 'BROWSER ONLINE' : 'DISCONNECTED'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                {status.isOnline ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Internet Link Active</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Internet Unavailable</span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                {swActive ? 'Service Worker active (Cache & Sync ready)' : 'PWA Offline Cache Active'}
              </div>
            </div>

            {/* Offline Simulation Control Card */}
            <div className="bg-[#0F1115] border border-[#1E293B] p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Offline Test Simulation</span>
                <button
                  onClick={handleToggleSimulatedOffline}
                  className="text-amber-400 hover:text-amber-300 transition-colors focus:outline-none"
                  title="Toggle simulated network disconnection for training & offline testing"
                >
                  {status.isSimulatedOffline ? (
                    <ToggleRight className="w-7 h-7 text-amber-400" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-slate-600" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <span>{status.isSimulatedOffline ? 'Simulated Offline Mode Active' : 'Normal Live Operation'}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {status.isSimulatedOffline
                  ? 'Simulating connection loss. Sales will queue locally until untoggled.'
                  : 'Toggle to test offline checkout behavior without pulling network cables.'}
              </div>
            </div>
          </div>

          {/* Queue Performance Tally Banner */}
          <div className="bg-slate-800/40 border border-slate-700/60 p-4 rounded-xl flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs text-slate-400 font-semibold">Unsynced Offline Queue</div>
              <div className="text-2xl font-black text-amber-400 font-mono flex items-center gap-2">
                <span>{status.unsyncedCount} Records</span>
                {status.unsyncedCount > 0 && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-normal">
                    Pending ({status.totalUnsyncedValue.toFixed(2)} value)
                  </span>
                )}
              </div>
              {status.lastSyncedAt && (
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Last synced: {new Date(status.lastSyncedAt).toLocaleTimeString()}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleManualSync}
                disabled={status.isSyncing || isProcessingManualSync || !status.effectiveOnline || status.unsyncedCount === 0}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${status.isSyncing || isProcessingManualSync ? 'animate-spin' : ''}`} />
                <span>{status.isSyncing || isProcessingManualSync ? 'Syncing Queue...' : 'Force Sync Now'}</span>
              </button>
            </div>
          </div>

          {/* Sync Result Feedback Banner */}
          {status.lastSyncResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{status.lastSyncResult.message}</span>
            </div>
          )}

          {/* Queued Records Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-cyan-400" /> Queue Transaction Audit Log ({queue.length})
              </span>
              {queue.some((i) => i.synced) && (
                <button
                  onClick={handleClearSynced}
                  className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear Synced Records
                </button>
              )}
            </div>

            {queue.length === 0 ? (
              <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-8 text-center text-slate-500 text-xs">
                No items in offline queue. All transactions are fully synchronized.
              </div>
            ) : (
              <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#161B22] text-slate-400 border-b border-[#1E293B] font-mono uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="p-2.5">ID / Receipt</th>
                      <th className="p-2.5">Created At</th>
                      <th className="p-2.5 text-right">Amount</th>
                      <th className="p-2.5 text-center">Sync Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {queue.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/20">
                        <td className="p-2.5 font-mono text-white font-semibold">
                          {item.payload?.receiptNumber || item.id}
                        </td>
                        <td className="p-2.5 text-slate-400 font-mono text-[11px]">
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                          {item.payload?.total !== undefined ? `${item.payload.total.toFixed(2)}` : '—'}
                        </td>
                        <td className="p-2.5 text-center">
                          {item.synced ? (
                            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                              ✓ SYNCED
                            </span>
                          ) : (
                            <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                              ⏳ PENDING
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-[#1E293B] flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="flex items-center gap-1 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Automatic Background Sync Enabled
          </span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl font-bold transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
