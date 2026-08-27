import React, { useState } from 'react';
import { KeyRound, ShieldCheck, ExternalLink, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  activateLicense,
  PURCHASE_URL,
  SUPPORT_EMAIL,
  TRIAL_DAYS,
} from '../../services/license';

interface LicenseGateProps {
  onActivated: () => void;
}

/**
 * Full-screen activation gate shown when the trial has expired.
 * Also exports TrialBadge — a subtle countdown pill shown during trial.
 */
export const LicenseGate: React.FC<LicenseGateProps> = ({ onActivated }) => {
  const [email, setEmail] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await activateLicense(email, key);
      if (result.ok) {
        onActivated();
      } else {
        setError(result.error || 'Activation failed. Please check your details.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#0F1115] flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-[#161B22] border border-[#1E293B] rounded-2xl shadow-2xl p-7 space-y-5 my-auto">
        {/* Brand */}
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3">
            <KeyRound className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-lg font-black text-[#E2E8F0] tracking-tight">Activate Your License</h1>
          <p className="text-xs text-slate-400 mt-1">
            Your {TRIAL_DAYS}-day free trial has ended. Enter the license key and the email you used at checkout to keep selling.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-xl px-3 py-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleActivate} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Purchase Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourshop.com"
              className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              License Key
            </label>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              spellCheck={false}
              className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest uppercase text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !email.trim() || !key.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30"
          >
            {busy ? (
              'Verifying…'
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" /> Activate License
              </>
            )}
          </button>
        </form>

        <div className="border-t border-[#1E293B] pt-4 space-y-2">
          <a
            href={PURCHASE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 w-full bg-[#0F1115] hover:bg-slate-800 text-cyan-300 border border-[#1E293B] font-bold py-2.5 rounded-xl text-xs transition-colors"
          >
            Buy a License — Lifetime, One-Time Payment
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <p className="text-center text-[10px] text-slate-600 flex items-center justify-center gap-1">
            <Mail className="w-3 h-3" /> Lost your key? Contact {SUPPORT_EMAIL}
          </p>
        </div>

        <p className="text-center text-[9px] text-slate-700 leading-relaxed">
          Your license is verified with LemonSqueezy once (online), then cached locally -- your POS keeps working offline after activation.
        </p>
      </div>
    </div>
  );
};

/** Subtle countdown pill shown in-app while a trial is running */
export const TrialBadge: React.FC<{ daysLeft: number }> = ({ daysLeft }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <button
      onClick={() => setDismissed(true)}
      title={`Trial: ${daysLeft} day(s) left. Click to dismiss.`}
      className="fixed bottom-3 right-3 z-[150] bg-[#161B22]/95 hover:bg-[#161B22] border border-[#1E293B] rounded-full pl-2.5 pr-3 py-1.5 flex items-center gap-1.5 shadow-lg transition-colors"
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      <span className="text-[10px] font-bold text-slate-300">
        Trial · {daysLeft} day{daysLeft === 1 ? '' : 's'} left
      </span>
    </button>
  );
};

