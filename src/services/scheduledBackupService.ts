import { posDb } from './db';
import { backupStorage } from './backupStorage';
import { generateSQLiteDatabaseDump, downloadSQLiteDbFile, downloadJsonBackup } from '../utils/sqliteExport';
import { AutoBackupSnapshot } from '../types/pos';

class ScheduledBackupService {
  private timerInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private listeners: Array<() => void> = [];

  constructor() {
    // Start background watcher on client side
    if (typeof window !== 'undefined') {
      this.initScheduleWatcher();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('Error in backup listener:', err);
      }
    });
  }

  /**
   * Initializes the scheduled background timer to check for daily scheduled backups.
   */
  public initScheduleWatcher(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    // Check every 60 seconds
    this.timerInterval = setInterval(() => {
      this.checkScheduledBackup();
    }, 60 * 1000);

    // Initial check on load
    setTimeout(() => {
      this.checkScheduledBackup();
    }, 5000);
  }

  /**
   * Checks if an automated daily backup needs to run based on current time and settings.
   */
  private async checkScheduledBackup(): Promise<void> {
    if (this.isProcessing) return;

    const settings = posDb.getSettings();
    if (settings.enableAutoBackup === false) return;

    const now = new Date();
    const todayDateStr = now.toISOString().split('T')[0];

    // Check if we already did a backup today
    const lastBackup = settings.lastBackupAt;
    if (lastBackup && lastBackup.startsWith(todayDateStr)) {
      // Already backed up today
      return;
    }

    const scheduledTime = settings.autoBackupTime || '20:00';
    const [targetHour, targetMinute] = scheduledTime.split(':').map(Number);

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // If current time is equal to or past scheduled time, run the scheduled backup
    if (
      currentHour > targetHour ||
      (currentHour === targetHour && currentMinute >= targetMinute)
    ) {
      console.log(`[AutoBackup] Triggering scheduled daily backup at ${scheduledTime}...`);
      await this.createBackupSnapshot({
        trigger: 'scheduled_timer',
        autoDownload: false, // background timer shouldn't interrupt user unless closing day
      });
    }
  }

  /**
   * Creates a full SQLite & JSON backup snapshot and saves it to browser storage.
   */
  public async createBackupSnapshot(options: {
    trigger: 'eod_close' | 'scheduled_timer' | 'manual';
    eodSessionId?: string;
    autoDownload?: boolean;
    format?: 'db' | 'json' | 'both';
  }): Promise<AutoBackupSnapshot> {
    this.isProcessing = true;
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timestamp = now.toISOString();
      const id = `BACKUP-${dateStr}-${now.getTime().toString().slice(-6)}`;

      const vendors = posDb.getVendors();
      const inventory = posDb.getInventory();
      const transactions = posDb.getTransactions();
      const payouts = posDb.getPayoutRecords();
      const eodSessions = posDb.getEODSessions();
      const settings = posDb.getSettings();
      const staff = posDb.getStaffUsers();
      const categories = posDb.getCategories();
      const drawerLogs = posDb.getDrawerLogs();
      const customers = posDb.getCustomers();
      const vendorAdvances = posDb.getVendorAdvances();
      const invoices = posDb.getInvoices();
      const feedback = posDb.getFeedbackList();

      const dumpPayload = {
        vendors,
        inventory,
        transactions,
        payouts,
        eodSessions,
        settings,
        staff,
        categories,
        drawerLogs,
        customers,
        vendorAdvances,
        invoices,
        feedback,
        exportedAt: timestamp,
      };

      // 1. Generate SQLite .db SQL dump
      const dbSqlContent = generateSQLiteDatabaseDump(dumpPayload);

      // 2. Generate JSON backup
      const jsonContent = JSON.stringify(
        {
          app: 'The Gift Shop POS',
          version: '2.4.0',
          exportedAt: timestamp,
          ...dumpPayload,
        },
        null,
        2
      );

      const totalSales = transactions
        .filter((t) => !t.isRefund)
        .reduce((sum, t) => sum + (t.total || 0), 0);

      const sizeBytes = new Blob([dbSqlContent]).size + new Blob([jsonContent]).size;

      const snapshot: AutoBackupSnapshot = {
        id,
        date: dateStr,
        timestamp,
        trigger: options.trigger,
        eodSessionId: options.eodSessionId,
        itemCount: inventory.length,
        transactionCount: transactions.length,
        vendorCount: vendors.length,
        customerCount: customers.length,
        totalSales,
        sizeBytes,
        dbSqlContent,
        jsonContent,
      };

      // 3. Save to persistent browser storage (IndexedDB / LocalStorage)
      if (settings.autoBackupToBrowserStorage !== false) {
        await backupStorage.saveSnapshot(snapshot);
        // Prune old snapshots based on retention settings
        const retentionDays = settings.autoBackupRetentionDays || 30;
        await backupStorage.pruneOldSnapshots(retentionDays);
      }

      // 4. Update last backup timestamp
      posDb.markBackupDone();

      // 5. Trigger download if requested or configured
      const shouldDownload = options.autoDownload ?? (options.trigger === 'eod_close' && settings.autoDownloadDbOnDayClose !== false);
      if (shouldDownload) {
        const downloadFormat = options.format || settings.autoBackupFormat || 'db';
        const filePrefix = `boutique-pos-sqlite-${dateStr}`;

        if (downloadFormat === 'db' || downloadFormat === 'both') {
          downloadSQLiteDbFile(`${filePrefix}.db`, dbSqlContent);
        }
        if (downloadFormat === 'json' || downloadFormat === 'both') {
          downloadJsonBackup(`${filePrefix}.json`, jsonContent);
        }
      }

      this.notifyListeners();
      return snapshot;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Helper called directly when the cashier closes the End of Day session.
   */
  public async handleEndOfDayClosing(eodSessionId: string): Promise<AutoBackupSnapshot> {
    const settings = posDb.getSettings();
    const shouldDownload = settings.autoDownloadDbOnDayClose !== false;
    return this.createBackupSnapshot({
      trigger: 'eod_close',
      eodSessionId,
      autoDownload: shouldDownload,
      format: settings.autoBackupFormat || 'db',
    });
  }
}

export const scheduledBackupService = new ScheduledBackupService();
