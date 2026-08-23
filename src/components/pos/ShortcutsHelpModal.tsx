import React from 'react';
import { Keyboard, X, Sparkles, Command } from 'lucide-react';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Checkout & Transaction Actions',
      items: [
        { key: 'F2  or  Ctrl + Enter', altKey: 'Cmd + Enter', desc: 'Open Pay / Checkout tender modal' },
        { key: 'F4  or  Ctrl + Q', altKey: 'Cmd + Q', desc: 'Add Quick Custom / Uncatalogued Item' },
        { key: 'F8  or  Ctrl + Shift + D', altKey: 'Cmd + Shift + D', desc: 'Apply global cart percentage discount' },
        { key: 'F9  or  Ctrl + Shift + X', altKey: 'Cmd + Shift + X', desc: 'Clear active shopping cart' },
      ],
    },
    {
      title: 'Navigation & Fast Tools',
      items: [
        { key: 'Ctrl + K  or  /', altKey: 'Cmd + K', desc: 'Focus inventory search & SKU barcode scanner' },
        { key: 'Ctrl + L', altKey: 'Cmd + L', desc: 'Instantly lock cashier register terminal' },
        { key: 'Ctrl + Shift + C', altKey: 'Cmd + Shift + C', desc: 'Open Customer Lookup & Loyalty Points modal' },
        { key: 'Ctrl + Shift + H / F3', altKey: 'Cmd + Shift + H', desc: 'Open Shift History & Void past transaction' },
        { key: 'Ctrl + Shift + R', altKey: 'Cmd + Shift + R', desc: 'Open Refund & Item Return processing modal' },
        { key: 'Escape', altKey: 'Esc', desc: 'Close any active popup modal or cancel action' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 my-auto">
        {/* Header */}
        <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">POS Keyboard Shortcuts</h2>
              <p className="text-[11px] text-slate-400">High-speed cashier register hotkeys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {shortcutGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#0F1115] border border-[#1E293B] text-xs"
                  >
                    <span className="text-slate-300 font-medium">{item.desc}</span>
                    <kbd className="px-2 py-1 rounded bg-[#161B22] border border-slate-700 text-emerald-300 font-mono font-bold text-[11px] shadow-xs">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-[#0F1115] border-t border-[#1E293B] p-3 text-center">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
          >
            Got it, Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
