import React, { useState } from 'react';
import { Printer, X, Tag, Sliders } from 'lucide-react';
import { InventoryItem } from '../../types/pos';
import { posDb } from '../../services/db';

interface BarcodePrinterModalProps {
  items: InventoryItem[];
  isOpen: boolean;
  onClose: () => void;
}

export const BarcodePrinterModal: React.FC<BarcodePrinterModalProps> = ({
  items,
  isOpen,
  onClose,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';

  const [labelSize, setLabelSize] = useState<'standard' | 'compact'>('standard');
  const [printCopies, setPrintCopies] = useState<{ [id: string]: number }>(() => {
    const initial: { [id: string]: number } = {};
    items.forEach((it) => {
      initial[it.id] = 1;
    });
    return initial;
  });

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyChange = (id: string, val: number) => {
    setPrintCopies((prev) => ({
      ...prev,
      [id]: Math.max(1, val),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl space-y-0 my-auto">
        {/* Header (Screen only) */}
        <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Shelf & Hangtag Barcode Label Printer</h2>
              <p className="text-xs text-slate-400">
                Generate high-resolution printable GS1 barcode stickers with Seychelles retail pricing
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

        {/* Controls Toolbar (Screen only) */}
        <div className="p-4 bg-[#0F1115]/50 border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>Label Format:</span>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs text-white"
              >
                <option value="standard">Standard Shelf Tag (50x30mm)</option>
                <option value="compact">Jewelry / Compact Tag (35x20mm)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
          >
            <Printer className="w-4 h-4" />
            <span>Print Labels (Ctrl+P)</span>
          </button>
        </div>

        {/* Print Sheets Canvas */}
        <div className="p-6 bg-slate-900 overflow-y-auto max-h-[65vh]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.flatMap((item) => {
              const count = printCopies[item.id] || 1;
              return Array.from({ length: count }).map((_, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="bg-white text-black p-3 rounded-lg border border-slate-300 shadow-sm flex flex-col justify-between text-center select-text"
                  style={{ minHeight: labelSize === 'compact' ? '110px' : '140px' }}
                >
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-tight truncate text-slate-800">
                      {settings.storeName}
                    </div>
                    <div className="text-xs font-black truncate text-black">{item.name}</div>
                    <div className="text-[9px] text-slate-600 font-mono">
                      SKU: {item.sku} {item.brand ? `• ${item.brand}` : ''}
                    </div>
                  </div>

                  <div className="my-1.5">
                    {/* Simulated SVG GS1 Barcode lines */}
                    <div className="tracking-[4px] font-mono text-[10px] font-extrabold text-black">
                      ||| | |||| || ||||| | |||
                    </div>
                    <div className="text-[10px] font-mono font-bold text-slate-700 tracking-wider">
                      {item.barcode}
                    </div>
                  </div>

                  <div className="border-t border-slate-300 pt-1 flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase text-slate-600">
                      VAT Included
                    </span>
                    <span className="text-xs font-black text-black">
                      {primarySymbol} {item.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              ));
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
