import React from 'react';
import { X, AlertTriangle, Package, RefreshCw, Plus } from 'lucide-react';
import { InventoryItem } from '../../types/pos';
import { posDb } from '../../services/db';

interface LowStockAlertsModalProps {
  lowStockItems: InventoryItem[];
  onClose: () => void;
  onRefreshData: () => void;
  currentStaffName?: string;
}

export const LowStockAlertsModal: React.FC<LowStockAlertsModalProps> = ({
  lowStockItems,
  onClose,
  onRefreshData,
  currentStaffName,
}) => {
  const handleQuickRestock = (itemId: string, addQty: number = 10) => {
    posDb.adjustStock(itemId, addQty, {
      user: currentStaffName || 'Authorized Staff',
      reason: `Quick restock +${addQty} from low-stock alerts`,
    });
    onRefreshData();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/80 flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-2xl w-full p-6 text-[#E2E8F0] shadow-2xl relative max-h-[85vh] flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1E293B] shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#E2E8F0]">
                Automated Low-Stock Inventory Alerts
              </h2>
              <p className="text-xs text-slate-400">
                Items below assigned minimum stock threshold requiring reorder
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of items below minimum stock */}
        <div className="my-4 overflow-y-auto space-y-2.5 flex-1 pr-1">
          {lowStockItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-400" />
              <p className="text-xs font-semibold text-slate-300">
                All Inventory Levels Healthy!
              </p>
              <p className="text-[11px] text-slate-500">
                No items are currently below their assigned minimum stock thresholds.
              </p>
            </div>
          ) : (
            lowStockItems.map((item) => {
              const vendor = posDb.getVendorById(item.vendorId);
              const isConsignment = vendor?.supplierType === 'consignment';

              return (
                <div
                  key={item.id}
                  className="bg-[#0F1115] p-3.5 rounded-xl border border-amber-500/30 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#E2E8F0] truncate">
                        {item.name}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                          isConsignment
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                        }`}
                      >
                        {isConsignment ? 'Deposit' : 'Wholesale'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3 font-mono">
                      <span>SKU: {item.sku}</span>
                      <span>Supplier: {vendor?.name || 'Vendor'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-bold text-amber-400 font-mono">
                        {item.stockLevel} left (Min {item.minStockThreshold})
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Retail ${item.retailPrice.toFixed(2)}
                      </div>
                    </div>

                    <button
                      onClick={() => handleQuickRestock(item.id, 10)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm"
                      title="Add 10 units to stock level"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Restock +10</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            {lowStockItems.length} item(s) flagged for reorder
          </span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-medium transition-colors"
          >
            Close Alerts
          </button>
        </div>
      </div>
    </div>
  );
};
