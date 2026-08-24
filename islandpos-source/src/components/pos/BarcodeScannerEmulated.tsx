import React, { useEffect, useState, useRef } from 'react';
import { Barcode, Volume2, VolumeX, Sparkles, PackageCheck, AlertTriangle } from 'lucide-react';
import { InventoryItem } from '../../types/pos';
import { soundService } from '../../services/audio';

interface BarcodeScannerEmulatedProps {
  inventory: InventoryItem[];
  onScanSku: (sku: string) => void;
}

export const BarcodeScannerEmulated: React.FC<BarcodeScannerEmulatedProps> = ({
  inventory,
  onScanSku,
}) => {
  const [manualInput, setManualInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScannedItem, setLastScannedItem] = useState<InventoryItem | null>(null);
  const [lastScannedMessage, setLastScannedMessage] = useState<string | null>(null);
  const [isScanningActive] = useState(true);

  // USB Hardware Barcode Scanner Buffer Listener
  const keyBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isScanningActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (timeDiff > 100 && keyBufferRef.current.length > 0) {
        keyBufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (keyBufferRef.current.length >= 3) {
          const skuScanned = keyBufferRef.current.trim();
          executeScan(skuScanned);
        }
        keyBufferRef.current = '';
      } else if (e.key.length === 1) {
        keyBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inventory, isScanningActive]);

  const executeScan = (sku: string) => {
    const item = inventory.find(
      (i) => i.sku.toLowerCase() === sku.toLowerCase() || i.id.toLowerCase() === sku.toLowerCase()
    );

    if (item) {
      if (soundEnabled) soundService.playBeep();
      onScanSku(item.sku);
      setLastScannedItem(item);
      setLastScannedMessage(null);
    } else {
      if (soundEnabled) soundService.playErrorBeep();
      setLastScannedItem(null);
      setLastScannedMessage(`Error: SKU / Barcode "${sku}" not recognized.`);
    }

    setTimeout(() => {
      setLastScannedMessage(null);
    }, 4000);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    executeScan(manualInput.trim());
    setManualInput('');
  };

  return (
    <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-3 shadow-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Status */}
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#E2E8F0]">USB Barcode Scanner Reader</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Auto-detects Brand, Variant, Size, Price, VAT & Real-time stock instantly
            </p>
          </div>
        </div>

        {/* Right Manual Form & Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
              soundEnabled
                ? 'bg-slate-800/80 text-[#E2E8F0] border-slate-700/60'
                : 'bg-slate-800/30 text-slate-500 border-slate-800'
            }`}
            title={soundEnabled ? 'Mute Beep Sounds' : 'Enable Beep Sounds'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <form onSubmit={handleManualSubmit} className="flex items-center gap-1.5">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Scan Barcode / SKU..."
              className="bg-[#0F1115] text-[#E2E8F0] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-emerald-500 w-36 sm:w-48"
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shadow-xs"
            >
              Scan
            </button>
          </form>
        </div>
      </div>

      {/* Quick Test Barcode Pills */}
      <div className="pt-2 border-t border-[#1E293B] flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" /> Quick Scan Test:
        </span>
        {inventory.slice(0, 6).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => executeScan(item.sku)}
            className="bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/60 px-2 py-0.5 rounded text-[11px] font-mono shrink-0 transition-colors"
            title={`Scan ${item.name}`}
          >
            {item.sku} ({item.brand || 'Ocean'})
          </button>
        ))}
      </div>

      {/* Real-Time Scanned Item Banner */}
      {lastScannedItem && (
        <div className="p-2.5 rounded-xl bg-[#0F1115] border border-emerald-500/40 text-xs flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded text-[10px]">
                  {lastScannedItem.brand || 'Ocean Seychelles'}
                </span>
                <span className="font-bold text-[#E2E8F0]">{lastScannedItem.name}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Line: <strong className="text-slate-300">{lastScannedItem.productLine || 'Normal'}</strong></span>
                <span>•</span>
                <span>Size/Target: <strong className="text-slate-300">{lastScannedItem.size || 'One Size'}</strong></span>
                <span>•</span>
                <span>VAT Rate: <strong className="text-cyan-400 font-mono">{((lastScannedItem.vatRate ?? 0.15) * 100).toFixed(0)}%</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="text-sm font-black font-mono text-emerald-400">${lastScannedItem.retailPrice.toFixed(2)}</div>
              <div className="text-[10px] text-slate-400">+${(lastScannedItem.retailPrice * (lastScannedItem.vatRate ?? 0.15)).toFixed(2)} VAT</div>
            </div>
            <div className="pl-3 border-l border-[#1E293B]">
              <div className={`text-xs font-mono font-bold ${lastScannedItem.stockLevel <= lastScannedItem.minStockThreshold ? 'text-amber-400' : 'text-emerald-400'}`}>
                {lastScannedItem.stockLevel} left in stock
              </div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Live Stock</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {lastScannedMessage && (
        <div className="p-2 rounded-lg text-xs font-medium bg-rose-950/60 text-rose-300 border border-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{lastScannedMessage}</span>
        </div>
      )}
    </div>
  );
};
