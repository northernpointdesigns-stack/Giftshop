import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CloudCheck, HardDrive } from 'lucide-react';
import { offlineSyncEngine, OfflineSyncStatus } from '../../services/offlineSyncEngine';
import { OfflineSyncModal } from './OfflineSyncModal';

interface OfflineStatusPillProps {
  onRefreshData?: () => void;
}

export const OfflineStatusPill: React.FC<OfflineStatusPillProps> = ({ onRefreshData }) => {
  const [status, setStatus] = useState<OfflineSyncStatus>(offlineSyncEngine.getStatus());
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const unsub = offlineSyncEngine.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsub();
  }, []);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs border ${
          status.isSyncing
            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse'
            : !status.effectiveOnline
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
            : status.unsyncedCount > 0
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
        }`}
        title="View Offline Service Worker & Sync Engine Status"
      >
        {status.isSyncing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span className="hidden sm:inline font-mono">Syncing...</span>
          </>
        ) : !status.effectiveOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono">
              Offline {status.unsyncedCount > 0 ? `(${status.unsyncedCount})` : ''}
            </span>
          </>
        ) : status.unsyncedCount > 0 ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono">{status.unsyncedCount} Unsynced</span>
          </>
        ) : (
          <>
            <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline font-mono">Online</span>
          </>
        )}
      </button>

      {isModalOpen && (
        <OfflineSyncModal
          onClose={() => setIsModalOpen(false)}
          onRefreshData={onRefreshData}
        />
      )}
    </>
  );
};
