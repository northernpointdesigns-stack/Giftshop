import { AutoBackupSnapshot } from '../types/pos';

const DB_NAME = 'BoutiquePosBackupDB';
const DB_VERSION = 1;
const STORE_NAME = 'daily_backups';
const LOCAL_STORAGE_BACKUP_KEY = 'island_pos_backups_snapshots_v1';

/**
 * Opens and initializes the IndexedDB for storing daily SQLite snapshots.
 */
function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this browser environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB.'));
    };
  });
}

/**
 * Fallback to localStorage if IndexedDB is not available or blocked in private mode.
 */
function getLocalStorageSnapshots(): AutoBackupSnapshot[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalStorageSnapshots(list: AutoBackupSnapshot[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('LocalStorage backup storage quota reached or unavailable:', err);
  }
}

class BackupStorageService {
  /**
   * Saves a snapshot into browser storage (IndexedDB with LocalStorage fallback).
   */
  public async saveSnapshot(snapshot: AutoBackupSnapshot): Promise<void> {
    try {
      const db = await openIndexedDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(snapshot);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to LocalStorage
      const list = getLocalStorageSnapshots().filter((s) => s.id !== snapshot.id);
      list.unshift(snapshot);
      // Keep max 10 in localStorage to avoid storage quota issues
      saveLocalStorageSnapshots(list.slice(0, 10));
    }
  }

  /**
   * Retrieves all saved snapshots sorted by newest first.
   */
  public async getAllSnapshots(): Promise<AutoBackupSnapshot[]> {
    try {
      const db = await openIndexedDb();
      return new Promise<AutoBackupSnapshot[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const res = (req.result || []) as AutoBackupSnapshot[];
          res.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          resolve(res);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      const list = getLocalStorageSnapshots();
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return list;
    }
  }

  /**
   * Retrieves a single snapshot by ID.
   */
  public async getSnapshotById(id: string): Promise<AutoBackupSnapshot | undefined> {
    try {
      const db = await openIndexedDb();
      return new Promise<AutoBackupSnapshot | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result || undefined);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return getLocalStorageSnapshots().find((s) => s.id === id);
    }
  }

  /**
   * Deletes a snapshot by ID from browser storage.
   */
  public async deleteSnapshot(id: string): Promise<boolean> {
    try {
      const db = await openIndexedDb();
      return new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);

        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch {
      const list = getLocalStorageSnapshots().filter((s) => s.id !== id);
      saveLocalStorageSnapshots(list);
      return true;
    }
  }

  /**
   * Clears all stored snapshots.
   */
  public async clearAllSnapshots(): Promise<void> {
    try {
      const db = await openIndexedDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      saveLocalStorageSnapshots([]);
    }
  }

  /**
   * Removes snapshots older than retentionDays.
   */
  public async pruneOldSnapshots(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    const all = await this.getAllSnapshots();
    const toDelete = all.filter((s) => s.timestamp < cutoffTimestamp);

    for (const snap of toDelete) {
      await this.deleteSnapshot(snap.id);
    }

    return toDelete.length;
  }

  /**
   * Calculates overall storage statistics for display in UI.
   */
  public async getStorageStats(): Promise<{
    count: number;
    totalSizeBytes: number;
    oldestDate?: string;
    newestDate?: string;
  }> {
    const all = await this.getAllSnapshots();
    if (all.length === 0) {
      return { count: 0, totalSizeBytes: 0 };
    }

    const totalSizeBytes = all.reduce((sum, s) => sum + (s.sizeBytes || 0), 0);
    const newestDate = all[0]?.date;
    const oldestDate = all[all.length - 1]?.date;

    return {
      count: all.length,
      totalSizeBytes,
      oldestDate,
      newestDate,
    };
  }
}

export const backupStorage = new BackupStorageService();
