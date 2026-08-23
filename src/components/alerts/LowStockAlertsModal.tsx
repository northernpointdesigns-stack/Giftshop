import React from 'react';
import { Bell, X, AlertTriangle, Package, ArrowRight } from 'lucide-react';
import { InventoryItem } from '../../types/pos';
import { posDb } from '../../services/db';

interface LowStockAlertsModalProps {
  inventory: InventoryItem[];
  isOpen: boolean;
  onClose: () => void;
  onNavigateToInventory: () => void;
}

export const LowStockAlertsModal: React.FC<LowStockAlertsModalProps> = ({
  inventory,
  isOpen,
  onClose,
  onNavigateToInventory,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';

  if (!isOpen) return null;

  const lowStockItems = inventory.filter((i) => i.stockLevel <= i.reorderPoint);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#161B22] border border-amber-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 my-auto">
        {/* Header */}
        <div className="bg-amber-950/40 border-b border-amber-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Low Stock & Reorder Thresholds</h2>
              <p className="text-[11px] text-amber-200/80">
                {lowStockItems.length} product(s) require replenishment
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of items */}
        <div className="p-5 space-y-2 max-h-[60vh] overflow-y-auto">
          {lowStockItems.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">All stock levels are optimal!</p>
          ) : (
            lowStockItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-white block">{item.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    SKU: {item.sku} • {primarySymbol} {item.price.toFixed(2)}
                  </span>
                </div>

                <div className="text-right">
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                      item.stockLevel <= 0
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {item.stockLevel} left (Reorder at {item.reorderPoint})
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#0F1115] border-t border-[#1E293B] p-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold"
          >
            Dismiss
          </button>

          <button
            onClick={() => {
              onClose();
              onNavigateToInventory();
            }}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
          >
            <span>Manage Inventory & Purchase Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
