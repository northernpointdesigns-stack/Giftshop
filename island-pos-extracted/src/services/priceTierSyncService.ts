import { InventoryItem, PriceList, StoreSettings } from '../types/pos';
import { posDb } from './db';

export interface PriceSyncLogEntry {
  id: string;
  timestamp: string;
  itemsProcessed: number;
  tiersSynced: number;
  pricePointsUpdated: number;
  durationMs: number;
  triggerSource: 'admin_settings' | 'manual_sync' | 'db_init' | 'background_worker';
  details: string;
}

export interface PriceSyncResult {
  success: boolean;
  itemsProcessed: number;
  tiersSynced: number;
  pricePointsUpdated: number;
  durationMs: number;
  timestamp: string;
  summary: string;
}

type SyncListener = (result: PriceSyncResult, isSyncing: boolean) => void;

class PriceTierSyncService {
  private isSyncing: boolean = false;
  private lastSyncCompletedAt: string | null = null;
  private lastSyncResult: PriceSyncResult | null = null;
  private syncHistory: PriceSyncLogEntry[] = [];
  private listeners: Set<SyncListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('island_pos_price_tier_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'PRICE_TIER_SYNC_COMPLETED') {
            this.notifyListeners(event.data.result, false);
          }
        };
      } catch (err) {
        console.warn('[PriceTierSyncService] BroadcastChannel not supported in this environment.', err);
      }

      // Restore sync history from localStorage if available
      try {
        const stored = localStorage.getItem('island_pos_price_sync_history_v1');
        if (stored) {
          this.syncHistory = JSON.parse(stored).slice(0, 20);
        }
      } catch (err) {
        console.warn('[PriceTierSyncService] Failed to parse stored sync history.', err);
      }
    }
  }

  /**
   * Register a callback listener for price tier sync events.
   */
  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(result: PriceSyncResult, syncing: boolean) {
    this.listeners.forEach((cb) => {
      try {
        cb(result, syncing);
      } catch (err) {
        console.error('[PriceTierSyncService] Error in sync listener callback:', err);
      }
    });
  }

  /**
   * Get current background sync status metadata
   */
  public getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncCompletedAt: this.lastSyncCompletedAt,
      lastSyncResult: this.lastSyncResult,
      syncHistory: [...this.syncHistory],
    };
  }

  /**
   * Triggers asynchronous background recalculation of all active inventory items' tier pricing.
   */
  public async syncInventoryPriceTiers(
    customPriceLists?: PriceList[],
    triggerSource: PriceSyncLogEntry['triggerSource'] = 'admin_settings'
  ): Promise<PriceSyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        itemsProcessed: 0,
        tiersSynced: 0,
        pricePointsUpdated: 0,
        durationMs: 0,
        timestamp: new Date().toISOString(),
        summary: 'Sync operation is already in progress.',
      };
    }

    this.isSyncing = true;
    const startTime = performance.now();

    // Use setTimeout microtask to yield main thread and execute recalculations asynchronously
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const settings: StoreSettings = posDb.getSettings();
          const activePriceLists: PriceList[] = customPriceLists || settings.priceLists || [
            { id: 'retail', name: 'Standard Retail Price', type: 'retail', isDefault: true, description: 'Default retail pricing' },
            { id: 'wholesale', name: 'Wholesale B2B Tier', type: 'wholesale', discountPercentage: 25, description: '25% wholesale discount' },
            { id: 'vip', name: 'VIP & Staff Price', type: 'vip', discountPercentage: 15, description: '15% VIP discount' },
          ];

          const inventory: InventoryItem[] = posDb.getInventory();
          let pricePointsUpdated = 0;
          let itemsProcessed = 0;

          const updatedInventory = inventory.map((item) => {
            itemsProcessed++;
            const currentPrices: Record<string, number> = { ...(item.prices || {}) };
            let itemChanged = false;

            // Recalculate tier prices for all active price lists
            activePriceLists.forEach((tier) => {
              if (tier.id === 'retail' || tier.type === 'retail') {
                if (currentPrices['retail'] !== item.retailPrice) {
                  currentPrices['retail'] = item.retailPrice;
                  pricePointsUpdated++;
                  itemChanged = true;
                }
              } else if (tier.discountPercentage !== undefined && tier.discountPercentage >= 0) {
                // Compute calculated tier discount price
                const calculatedPrice = Math.max(
                  0.01,
                  Math.round(item.retailPrice * (1 - tier.discountPercentage / 100) * 100) / 100
                );

                // Update if no explicit price override or if previous calculated price needs updating
                if (currentPrices[tier.id] === undefined || currentPrices[tier.id] !== calculatedPrice) {
                  currentPrices[tier.id] = calculatedPrice;
                  pricePointsUpdated++;
                  itemChanged = true;
                }
              } else if (currentPrices[tier.id] === undefined) {
                currentPrices[tier.id] = item.retailPrice;
                pricePointsUpdated++;
                itemChanged = true;
              }
            });

            // Clean up obsolete tier keys that are no longer in active price lists
            const activeTierIds = new Set(activePriceLists.map((p) => p.id));
            Object.keys(currentPrices).forEach((existingTierId) => {
              if (!activeTierIds.has(existingTierId)) {
                delete currentPrices[existingTierId];
                itemChanged = true;
              }
            });

            if (itemChanged) {
              return {
                ...item,
                prices: currentPrices,
              };
            }
            return item;
          });

          // Bulk save updated inventory back into database
          posDb.saveBulkInventory(updatedInventory);

          const endTime = performance.now();
          const durationMs = Math.round(endTime - startTime);
          const timestamp = new Date().toISOString();

          const resultSummary = `Recalculated pricing for ${itemsProcessed} active items across ${activePriceLists.length} price tiers (${pricePointsUpdated} price points updated) in ${durationMs}ms.`;

          const result: PriceSyncResult = {
            success: true,
            itemsProcessed,
            tiersSynced: activePriceLists.length,
            pricePointsUpdated,
            durationMs,
            timestamp,
            summary: resultSummary,
          };

          const logEntry: PriceSyncLogEntry = {
            id: `SYNC-${Date.now()}`,
            timestamp,
            itemsProcessed,
            tiersSynced: activePriceLists.length,
            pricePointsUpdated,
            durationMs,
            triggerSource,
            details: resultSummary,
          };

          this.syncHistory.unshift(logEntry);
          if (this.syncHistory.length > 30) this.syncHistory.pop();
          this.lastSyncCompletedAt = timestamp;
          this.lastSyncResult = result;
          this.isSyncing = false;

          // Save history to localStorage
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem('island_pos_price_sync_history_v1', JSON.stringify(this.syncHistory));
            }
          } catch (e) {
            console.warn('[PriceTierSyncService] Storage save error:', e);
          }

          // Broadcast through BroadcastChannel & Window Event
          if (this.broadcastChannel) {
            this.broadcastChannel.postMessage({
              type: 'PRICE_TIER_SYNC_COMPLETED',
              result,
            });
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('island_pos_price_tier_synced', {
                detail: result,
              })
            );
          }

          this.notifyListeners(result, false);
          resolve(result);
        } catch (err: any) {
          this.isSyncing = false;
          const errorResult: PriceSyncResult = {
            success: false,
            itemsProcessed: 0,
            tiersSynced: 0,
            pricePointsUpdated: 0,
            durationMs: 0,
            timestamp: new Date().toISOString(),
            summary: `Sync failed: ${err?.message || err}`,
          };
          this.notifyListeners(errorResult, false);
          resolve(errorResult);
        }
      }, 20);
    });
  }

  /**
   * Fire-and-forget non-blocking background sync trigger
   */
  public syncBackground(
    customPriceLists?: PriceList[],
    triggerSource: PriceSyncLogEntry['triggerSource'] = 'admin_settings'
  ): void {
    setTimeout(() => {
      this.syncInventoryPriceTiers(customPriceLists, triggerSource).catch((err) => {
        console.error('[PriceTierSyncService] Background sync unhandled error:', err);
      });
    }, 10);
  }
}

export const priceTierSyncService = new PriceTierSyncService();
