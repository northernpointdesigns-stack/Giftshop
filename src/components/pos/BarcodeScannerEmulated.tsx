import React, { useState } from 'react';
import { ScanBarcode, X, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { InventoryItem } from '../../types/pos';
import { soundService } from '../../services/audio';

interface BarcodeScannerEmulatedProps {
  inventory: InventoryItem[];
  isOpen: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
}

export const BarcodeScannerEmulated: React.FC<BarcodeScannerEmulatedProps> = ({
  inventory,
  isOpen,
  onClose,
  onBarcodeScanned,
}) => {
  const [manualCode, setManualCode] = useState('');

  if (!isOpen) return null;

  const handleScanPreset = (barcode: string) => {
    soundService.playBeep();
    onBarcodeScanned(barcode);
    onClose();
  };

  const handleManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    soundService.playBeep();
    onBarcodeScanned(manualCode.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 my-auto">
        {/* Header */}
        <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ScanBarcode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Hardware Barcode Scanner Simulator</h2>
              <p className="text-[11px] text-slate-400">
                Simulates GS1/EAN-13 USB handheld laser barcode gun triggers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Manual Input Trigger */}
          <form onSubmit={handleManualScan} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400">
              Type or Paste Any Scanned Raw Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. 6901234500012 or (01)06901234567890"
                className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shrink-0"
              >
                Scan Gun
              </button>
            </div>
          </form>

          {/* Preset One-Click Quick Test Barcodes */}
          <div className="space-y-2 pt-2 border-t border-[#1E293B]">
            <span className="text-xs font-bold text-slate-300 block">
              Quick Test Catalog Barcodes (Click to simulate scan):
            </span>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {inventory.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleScanPreset(item.barcode)}
                  className="w-full bg-[#0F1115] hover:bg-emerald-500/10 border border-[#1E293B] hover:border-emerald-500/40 p-2.5 rounded-xl flex items-center justify-between text-left transition-all group"
                >
                  <div className="truncate pr-2">
                    <span className="text-xs font-semibold text-white block truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.brand || 'Ocean'} • SKU: {item.sku}
                    </span>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded">
                      {item.barcode}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
