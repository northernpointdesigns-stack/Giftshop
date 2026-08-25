import React, { useState } from 'react';
import { ShieldAlert, KeyRound, CheckCircle2, X, Lock } from 'lucide-react';
import { posDb } from '../../services/db';
import { StaffUser } from '../../types/pos';
import { soundService } from '../../services/audio';

interface SupervisorPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorized: (authorizedByStaff: StaffUser) => void;
  actionTitle?: string;
  actionDescription?: string;
}

export const SupervisorPinModal: React.FC<SupervisorPinModalProps> = ({
  isOpen,
  onClose,
  onAuthorized,
  actionTitle = 'Supervisor Authorization Required',
  actionDescription = 'Enter a Supervisor or Admin PIN to approve this operation.',
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successStaffName, setSuccessStaffName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (pinInput.length < 8) {
      setPinInput((prev) => prev + num);
      setErrorMsg('');
    }
  };

  const handleDelete = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    setPinInput('');
    setErrorMsg('');
  };

  const handleVerifyPin = () => {
    if (!pinInput.trim()) {
      setErrorMsg('Please enter a PIN');
      return;
    }

    const allStaff = posDb.getStaffUsers();
    // Supervisors: senior_cashier, shift_lead, or admin
    const matchingStaff = allStaff.find(
      (s) =>
        s.pin === pinInput.trim() &&
        s.status === 'active' &&
        ['senior_cashier', 'shift_lead', 'admin'].includes(s.role)
    );

    if (matchingStaff) {
      soundService.playBeep();
      setSuccessStaffName(matchingStaff.name);
      setTimeout(() => {
        onAuthorized(matchingStaff);
        handleClear();
        setSuccessStaffName(null);
      }, 400);
    } else {
      soundService.playErrorBeep();
      setErrorMsg('Invalid Supervisor PIN. Only Head Cashiers / Admins can authorize this.');
      setPinInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#161B22] border border-amber-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/60 rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-amber-300 uppercase tracking-wide flex items-center gap-2">
              <span>{actionTitle}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{actionDescription}</p>
          </div>
        </div>

        {successStaffName ? (
          <div className="py-8 text-center space-y-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl animate-in zoom-in-95 duration-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <div className="text-sm font-bold text-emerald-300">
              Authorized by {successStaffName}
            </div>
            <div className="text-xs text-slate-400">Proceeding with approved transaction...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* PIN Display Input */}
            <div className="relative">
              <div className="w-full bg-[#0F1115] border border-[#1E293B] focus-within:border-amber-500 rounded-xl px-4 py-3 flex items-center justify-between text-center">
                <KeyRound className="w-5 h-5 text-amber-400 shrink-0" />
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setErrorMsg('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVerifyPin();
                  }}
                  placeholder="Enter Supervisor PIN"
                  className="w-full bg-transparent text-center font-mono text-xl text-white font-bold tracking-widest focus:outline-none placeholder:text-slate-600"
                  autoFocus
                />
                {pinInput && (
                  <button
                    onClick={handleClear}
                    className="text-xs font-mono text-slate-400 hover:text-amber-400 underline shrink-0"
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>

            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold p-2.5 rounded-xl text-center">
                {errorMsg}
              </div>
            )}

            {/* Touch Keypad */}
            <div className="grid grid-cols-3 gap-2 py-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(num)}
                  className="bg-[#0F1115] hover:bg-slate-800 active:scale-95 text-white font-mono text-lg font-bold py-3 rounded-xl border border-[#1E293B] transition-all shadow-sm"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-300 font-mono text-xs font-bold py-3 rounded-xl border border-[#1E293B] transition-all"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="bg-[#0F1115] hover:bg-slate-800 active:scale-95 text-white font-mono text-lg font-bold py-3 rounded-xl border border-[#1E293B] transition-all"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-300 font-mono text-xs font-bold py-3 rounded-xl border border-[#1E293B] transition-all"
              >
                ⌫
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyPin}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black font-mono text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5"
              >
                <Lock className="w-4 h-4" />
                <span>Verify & Approve</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
