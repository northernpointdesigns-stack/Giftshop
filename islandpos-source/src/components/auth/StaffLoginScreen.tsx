import React, { useState } from 'react';
import { LockKeyhole, LogIn, ShieldCheck } from 'lucide-react';
import { posDb } from '../../services/db';
import { StaffUser } from '../../types/pos';

interface StaffLoginScreenProps {
  storeName: string;
  onAuthenticated: (staff: StaffUser) => void;
}

export const StaffLoginScreen: React.FC<StaffLoginScreenProps> = ({
  storeName,
  onAuthenticated,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const staff = posDb.authenticateStaff(pin);
    if (!staff) {
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
      <div className="w-full max-w-md bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-xl font-black mt-4">{storeName}</h1>
          <p className="text-sm text-slate-400 mt-1">Staff sign-in required</p>
        </div>

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

        <p className="text-[11px] text-slate-500 text-center mt-6">
          Access is limited by the permissions configured by your administrator.
        </p>
      </div>
    </main>
  );
};