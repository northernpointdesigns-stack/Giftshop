import React, { useState } from 'react';
import { LockKeyhole, LogIn, ShieldCheck, Sparkles, KeyRound, Info, AlertTriangle } from 'lucide-react';
import { posDb } from '../../services/db';
import { StaffUser } from '../../types/pos';

const MAX_MASTER_RESET_ATTEMPTS = 5;

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
  const [successNotice, setSuccessNotice] = useState('');

  const [showForgotPanel, setShowForgotPanel] = useState(false);
  const [masterResetInput, setMasterResetInput] = useState('');
  const [masterResetError, setMasterResetError] = useState('');
  const [masterResetAttempts, setMasterResetAttempts] = useState(0);

  const settings = posDb.getSettings();
  const isDefaultPinInPlace = (settings.adminPin || 'admin123') === 'admin123';
  const mustChangeAfterReset = Boolean(settings.adminPinMustChange);
  const masterResetAvailable = posDb.hasMasterResetPassword();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const freshSettings = posDb.getSettings();
    const staff = posDb.authenticateStaff(pin);
    if (!staff) {
      if (pin.trim() === (freshSettings.adminPin || 'admin123')) {
        const adminStaff = posDb.getStaffUsers().find((u) => u.role === 'admin') || {
          id: 'STAFF-ADMIN',
          name: 'Main Administrator',
          username: freshSettings.adminUsername || 'admin',
          pin: freshSettings.adminPin || 'admin123',
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

  const handleMasterReset = (event: React.FormEvent) => {
    event.preventDefault();
    if (masterResetAttempts >= MAX_MASTER_RESET_ATTEMPTS) return;
    const result = posDb.resetAdminPinViaMasterReset(masterResetInput);
    if (!result.ok) {
      const next = masterResetAttempts + 1;
      setMasterResetAttempts(next);
      setMasterResetInput('');
      setMasterResetError(
        next >= MAX_MASTER_RESET_ATTEMPTS
          ? 'Too many failed attempts. Master reset is locked for this session — restart the app or restore from a backup.'
          : `${result.error || 'Incorrect Master Reset Password.'} ${MAX_MASTER_RESET_ATTEMPTS - next} attempt${MAX_MASTER_RESET_ATTEMPTS - next === 1 ? '' : 's'} remaining.`
      );
      return;
    }
    setMasterResetInput('');
    setMasterResetError('');
    setShowForgotPanel(false);
    setSuccessNotice(
      'Admin PIN was reset to temporary default admin123. Sign in with admin123, then change the Admin PIN immediately under Store System & Audits.'
    );
    setError('');
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

        {(isDefaultPinInPlace || mustChangeAfterReset) && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <Info className="w-4 h-4 shrink-0" />
              <span>{mustChangeAfterReset ? 'Temporary PIN — change required' : 'Default Password in Place'}</span>
            </div>
            <p className="text-[11px] text-slate-300">
              {mustChangeAfterReset ? (
                <>
                  After recovery, sign in with{' '}
                  <code className="bg-black/40 text-amber-300 font-mono px-1.5 py-0.5 rounded font-bold">admin123</code>
                  {' '}then set a new Admin PIN in Admin → Store System &amp; Audits.
                </>
              ) : (
                <>
                  Default Admin PIN is{' '}
                  <code className="bg-black/40 text-amber-300 font-mono px-1.5 py-0.5 rounded font-bold">admin123</code>.
                </>
              )}
            </p>
            {onOpenWelcomeSetup && !mustChangeAfterReset && (
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

        {successNotice && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 text-[11px] text-emerald-200 leading-relaxed">
            {successNotice}
          </div>
        )}

        {!showForgotPanel ? (
          <>
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

            <div className="text-center">
              {masterResetAvailable ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPanel(true);
                    setMasterResetError('');
                    setMasterResetInput('');
                    setSuccessNotice('');
                  }}
                  className="text-[11px] text-rose-300/90 hover:text-rose-200 font-semibold underline-offset-2 hover:underline"
                >
                  Forgot admin PIN? Use Master Reset
                </button>
              ) : (
                <p className="text-[10px] text-slate-600">
                  Admin lockout recovery is unavailable until a Master Reset Password is set in Store System &amp; Audits.
                </p>
              )}
            </div>
          </>
        ) : (

          <form onSubmit={handleMasterReset} className="space-y-4">
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Master Reset — Admin PIN Recovery</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Enter the Master Reset Password from Admin → Store System &amp; Audits.
                On success the Admin PIN becomes <code className="text-amber-300 font-mono">admin123</code>
                {' '}(change it after login). This is recorded in the security audit log.
              </p>
            </div>

            <label className="block">
              <span className="block text-xs font-bold text-slate-300 mb-1.5">Master Reset Password</span>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  autoFocus
                  type="password"
                  autoComplete="off"
                  value={masterResetInput}
                  disabled={masterResetAttempts >= MAX_MASTER_RESET_ATTEMPTS}
                  onChange={(event) => {
                    setMasterResetInput(event.target.value);
                    setMasterResetError('');
                  }}
                  placeholder="Enter master reset password"
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl pl-10 pr-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-rose-500/60 disabled:opacity-50"
                />
              </div>
            </label>

            {masterResetError && (
              <p className="rounded-xl border border-rose-800/70 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
                {masterResetError}
              </p>
            )}

            <button
              type="submit"
              disabled={!masterResetInput.trim() || masterResetAttempts >= MAX_MASTER_RESET_ATTEMPTS}
              className="w-full bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              Reset Admin PIN to admin123
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForgotPanel(false);
                setMasterResetError('');
                setMasterResetInput('');
              }}
              className="w-full text-[11px] text-slate-400 hover:text-slate-200 font-semibold py-1"
            >
              Back to staff sign-in
            </button>
          </form>
        )}

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
