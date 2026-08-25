import React, { useState } from 'react';
import { LockKeyhole, LogIn, ShieldCheck, Sparkles, KeyRound, Info } from 'lucide-react';
import { posDb } from '../../services/db';
import { StaffUser } from '../../types/pos';

interface StaffLoginScreenProps {
  storeName: string;
  onAuthenticated: (staff: StaffUser) => void;
  onOpenWelcomeSetup?: () => void;
}

export const StaffLoginScreen: React.FC<StaffLoginScreenProps> = ({
  storeName,
  onAuthenticated,
  onOpenWelcomeSetup,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const settings = posDb.getSettings();
  const isDefaultPinInPlace = (settings.adminPin || 'admin123') === 'admin123';

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const staff = posDb.authenticateStaff(pin);
    if (!staff) {
      // Check if matches admin master pin
      if (pin.trim() === (settings.adminPin || 'admin123')) {
        const adminStaff = posDb.getStaffUsers().find((u) => u.role === 'admin') || {
          id: 'STAFF-ADMIN',
          name: 'Main Administrator',
          username: settings.adminUsername || 'admin',
          pin: settings.adminPin || 'admin123',
          role: 'admin' as const,
          status: 'active' as const,
          createdAt: new Date().toISOString(),
        };
        setError('');
        setPin('');
        onAuthenticated(adminStaff);
        return;
      }

      setError('Incorrect PIN or this staff account is suspended.');
      setPin('');
      return;
    }

    setError('');
    setPin('');
    onAuthenticated(staff);
  };

  return (
    <main className="min-h-screen bg-[#0F1115] text-[#E2E8F0] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-xl font-black mt-4">{storeName}</h1>
          <p className="text-sm text-slate-400 mt-1">Staff sign-in required</p>
        </div>

        {/* Default Password Advisory for First-time / New Users */}
        {isDefaultPinInPlace && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <Info className="w-4 h-4 shrink-0" />
              <span>Default Password in Place</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Default Admin PIN is <code className="bg-black/40 text-amber-300 font-mono px-1.5 py-0.5 rounded font-bold">admin123</code>.
            </p>
            {onOpenWelcomeSetup && (
              <button
                type="button"
                onClick={onOpenWelcomeSetup}
                className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg py-1.5 px-2.5 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open Welcome Wizard to Create New Password</span>
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-bold text-slate-300 mb-1.5">Staff PIN</span>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value);
                  setError('');
                }}
                placeholder="Enter your PIN"
                className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl pl-10 pr-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </label>

          {error && (
            <p className="rounded-xl border border-rose-800/70 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!pin.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Sign in to register
          </button>
        </form>

        <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between text-[11px] text-slate-500">
          <span>Protected POS Terminal</span>
          {onOpenWelcomeSetup && (
            <button
              type="button"
              onClick={onOpenWelcomeSetup}
              className="text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              First Time Setup
            </button>
          )}
        </div>
      </div>
    </main>
  );
};
