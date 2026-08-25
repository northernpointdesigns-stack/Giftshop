import { Transaction } from '../types/pos';
import { triggerSWBackgroundSync } from './swRegister';
import { soundService } from './audio';

export interface OfflineQueueItem {
  id: string;
  type: 'transaction' | 'inventory_update' | 'drawer_event';
  payload: any;
  createdAt: string;
  synced: boolean;
  syncedAt?: string;
  attempts: number;
  lastError?: string;
}

export interface OfflineSyncStatus {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  effectiveOnline: boolean;
  isSyncing: boolean;
  queueLength: number;
  unsyncedCount: number;
  totalUnsyncedValue: number;
  lastSyncedAt: string | null;
  lastSyncResult: { successCount: number; errorCount: number; message: string } | null;
}

type SyncListener = (status: OfflineSyncStatus) => void;

const STORAGE_KEY = 'island_pos_offline_sync_queue_v2';
const SIMULATED_OFFLINE_KEY = 'island_pos_simulated_offline';

class OfflineSyncEngine {
  private queue: OfflineQueueItem[] = [];
  private isSyncing = false;
  private isSimulatedOffline = false;
  private lastSyncedAt: string | null = null;
  private lastSyncResult: { successCount: number; errorCount: number; message: string } | null = null;
  private listeners: Set<SyncListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadQueue();
      this.isSimulatedOffline = sessionStorage.getItem(SIMULATED_OFFLINE_KEY) === 'true';

      // Event listeners for online / offline transition
      window.addEventListener('online', () => {
        console.log('[OfflineSyncEngine] Browser back online');
        this.notify();
        this.autoSyncIfConnected();
      });

      window.addEventListener('offline', () => {
        console.log('[OfflineSyncEngine] Browser gone offline');
        this.notify();
      });

      // Listen for messages from Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'NETWORK_RESTORED_SYNC') {
            console.log('[OfflineSyncEngine] Service Worker signal to sync');
            this.autoSyncIfConnected();
          }
        });
      }
    }
  }

  private loadQueue() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.queue = JSON.parse(data);
      }
    } catch (err) {
      console.error('[OfflineSyncEngine] Failed to load offline queue:', err);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (err) {
      console.error('[OfflineSyncEngine] Failed to save offline queue:', err);
    }
  }

  public getEffectiveOnline(): boolean {
    if (typeof window === 'undefined') return true;
    return navigator.onLine && !this.isSimulatedOffline;
  }

  public setSimulatedOffline(value: boolean) {
    this.isSimulatedOffline = value;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SIMULATED_OFFLINE_KEY, value ? 'true' : 'false');
    }
    this.notify();

    if (!value) {
      // Reconnected from simulation -> attempt auto sync
      this.autoSyncIfConnected();
    }
  }

  public isSimulated(): boolean {
    return this.isSimulatedOffline;
  }

  public getStatus(): OfflineSyncStatus {
    const isOnline = typeof window !== 'undefined' ? navigator.onLine : true;
    const effectiveOnline = this.getEffectiveOnline();
    const unsynced = this.queue.filter((item) => !item.synced);

    const totalUnsyncedValue = unsynced.reduce((acc, item) => {
      if (item.type === 'transaction' && item.payload && typeof item.payload.total === 'number') {
        return acc + item.payload.total;
      }
      return acc;
    }, 0);

    return {
      isOnline,
      isSimulatedOffline: this.isSimulatedOffline,
      effectiveOnline,
      isSyncing: this.isSyncing,
      queueLength: this.queue.length,
      unsyncedCount: unsynced.length,
      totalUnsyncedValue: Number(totalUnsyncedValue.toFixed(2)),
      lastSyncedAt: this.lastSyncedAt,
      lastSyncResult: this.lastSyncResult,
    };
  }

  public getQueue(): OfflineQueueItem[] {
    return [...this.queue];
  }

  public enqueueTransaction(tx: Transaction) {
    const effectiveOnline = this.getEffectiveOnline();
    const newItem: OfflineQueueItem = {
      id: `SYNC-${tx.id || Date.now()}`,
      type: 'transaction',
      payload: tx,
      createdAt: new Date().toISOString(),
      synced: effectiveOnline, // if online, marked synced immediately
      syncedAt: effectiveOnline ? new Date().toISOString() : undefined,
      attempts: effectiveOnline ? 1 : 0,
    };

    // Replace if already exists, else append
    const existingIdx = this.queue.findIndex((q) => q.id === newItem.id);
    if (existingIdx >= 0) {
      this.queue[existingIdx] = newItem;
    } else {
      this.queue.unshift(newItem); // newest first
    }

    this.saveQueue();
    this.notify();

    if (!effectiveOnline) {
      console.log(`[OfflineSyncEngine] Queued transaction ${tx.receiptNumber} for offline sync.`);
      triggerSWBackgroundSync();
    }
  }

  public enqueueEvent(type: 'inventory_update' | 'drawer_event', payload: any) {
    const effectiveOnline = this.getEffectiveOnline();
    const newItem: OfflineQueueItem = {
      id: `SYNC-EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      synced: effectiveOnline,
      syncedAt: effectiveOnline ? new Date().toISOString() : undefined,
      attempts: effectiveOnline ? 1 : 0,
    };

    this.queue.unshift(newItem);
    this.saveQueue();
    this.notify();
  }

  public async autoSyncIfConnected(): Promise<void> {
    if (!this.getEffectiveOnline()) return;

    const unsynced = this.queue.filter((i) => !i.synced);
    if (unsynced.length === 0) return;

    await this.processQueue();
  }

  public async processQueue(): Promise<{ successCount: number; errorCount: number }> {
    if (this.isSyncing) return { successCount: 0, errorCount: 0 };
    if (!this.getEffectiveOnline()) {
      this.lastSyncResult = {
        successCount: 0,
        errorCount: 0,
        message: 'Cannot sync while offline',
      };
      this.notify();
      return { successCount: 0, errorCount: 0 };
    }

    this.isSyncing = true;
    this.notify();

    const unsyncedItems = this.queue.filter((i) => !i.synced);
    let successCount = 0;
    let errorCount = 0;

    console.log(`[OfflineSyncEngine] Starting offline sync for ${unsyncedItems.length} queued items...`);

    for (const item of unsyncedItems) {
      try {
        // Simulate network API post/sync latency
        await new Promise((res) => setTimeout(res, 250));

        // Mark synced
        item.synced = true;
        item.syncedAt = new Date().toISOString();
        item.attempts += 1;
        item.lastError = undefined;
        successCount++;
      } catch (err: any) {
        errorCount++;
        item.attempts += 1;
        item.lastError = err?.message || 'Network submission error';
      }
    }

    this.isSyncing = false;
    this.lastSyncedAt = new Date().toISOString();
    this.lastSyncResult = {
      successCount,
      errorCount,
      message: `Successfully synchronized ${successCount} offline records to primary system database.`,
    };

    this.saveQueue();
    this.notify();

    if (successCount > 0) {
      soundService.playChaChing();
    }

    return { successCount, errorCount };
  }

  public clearSyncedItems() {
    this.queue = this.queue.filter((i) => !i.synced);
    this.saveQueue();
    this.notify();
  }

  public clearAllQueue() {
    this.queue = [];
    this.saveQueue();
    this.notify();
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Initial call
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('[OfflineSyncEngine] Listener error:', err);
      }
    });
  }
}

export const offlineSyncEngine = new OfflineSyncEngine();
