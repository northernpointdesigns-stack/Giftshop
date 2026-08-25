import React, { useState } from 'react';
import { ShieldAlert, X, Lock, KeyRound, CheckCircle2 } from 'lucide-react';
import { posDb } from '../../services/db';
import { StaffUser } from '../../types/pos';
import { soundService } from '../../services/audio';

interface ManagerPinGateModalProps {
  title: string;
  actionDescription: string;
  onAuthorized: (manager?: StaffUser) => void;
  onClose: () => void;
}

export const ManagerPinGateModal: React.FC<ManagerPinGateModalProps> = ({
  title,
  actionDescription,
  onAuthorized,
  onClose,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 12) {
      setPin((prev) => prev + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const result = posDb.verifyManagerOrAdminPin(pin);

    if (result.authorized) {
      soundService.playBeep();
      onAuthorized(result.staff);
    } else {
      soundService.playErrorBeep();
      setError('Invalid Manager or Administrator PIN. Access denied.');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-amber-500/40 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1E293B] bg-[#0F1115]">
          <div className="flex items-center gap-2 text-amber-400">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">{title}</h2>
              <p className="text-[10px] text-slate-400">Security Gate Override</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="bg-[#0F1115] border border-[#1E293B] p-3 rounded-xl">
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-amber-400">Authorization required:</strong> {actionDescription}
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-3">
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                autoFocus
                inputMode="numeric"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError('');
                }}
                placeholder="Enter Manager PIN"
                className="w-full bg-[#0F1115] border-2 border-[#1E293B] focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-lg font-mono text-center font-bold text-white focus:outline-none tracking-widest"
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-[11px] text-rose-300 font-medium text-center">
                {error}
              </div>
            )}

            {/* Quick On-Screen Touch Numpad */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="py-2.5 bg-[#0F1115] hover:bg-slate-800 border border-[#1E293B] hover:border-amber-500/40 rounded-xl font-mono text-sm font-bold text-slate-200 transition-colors active:scale-95"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="py-2.5 bg-[#0F1115] hover:bg-slate-800 border border-[#1E293B] hover:border-amber-500/40 rounded-xl font-mono text-sm font-bold text-slate-200 transition-colors active:scale-95"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 transition-colors"
              >
                ⌫
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!pin.trim()}
                className="w-2/3 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-amber-950/40 flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-4 h-4" /> Authorize Action
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
