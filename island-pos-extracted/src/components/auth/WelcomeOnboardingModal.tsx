import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Store,
  Wallet,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Banknote,
  CalendarDays,
  Sparkles,
  Lock,
} from 'lucide-react';
import { posDb } from '../../services/db';
import { StaffUser, StoreSettings } from '../../types/pos';

interface WelcomeOnboardingModalProps {
  settings: StoreSettings;
  onComplete: (authenticatedStaff: StaffUser) => void;
  onClose?: () => void; // Optional if opened as a re-run from settings
  isReplayMode?: boolean;
}

export const WelcomeOnboardingModal: React.FC<WelcomeOnboardingModalProps> = ({
  settings,
  onComplete,
  onClose,
  isReplayMode = false,
}) => {
  // Step 1: Welcome & Default Password Advisory / Create New Password
  // Step 2: Enter Float Money of the Day
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Step 1 State - Store & Password Setup
  const [storeName, setStoreName] = useState(settings.storeName || 'My Boutique');
  const [adminUsername, setAdminUsername] = useState(settings.adminUsername || 'admin');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step1Error, setStep1Error] = useState('');
  const [savedStaffUser, setSavedStaffUser] = useState<StaffUser | null>(null);

  // Step 2 State - Opening Float of the Day
  const [floatAmount, setFloatAmount] = useState('');
  const [openingNotes, setOpeningNotes] = useState('');
  const [step2Error, setStep2Error] = useState('');

  const currencySymbol = settings.primaryCurrencySymbol || 'SR';
  const currencyCode = settings.primaryCurrency || 'SCR';

  const todayStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const parsedFloat = parseFloat(floatAmount);
  const isFloatValid = !isNaN(parsedFloat) && parsedFloat >= 0 && floatAmount.trim() !== '';

  const quickAmounts = [100, 200, 500, 1000];

  // Handle Step 1: Save new password (or keep default) and advance to Step 2
  const handleStep1Submit = (keepDefault: boolean = false) => {
    setStep1Error('');

    let finalPin = settings.adminPin || 'admin123';
    let finalUsername = adminUsername.trim() || 'admin';

    if (!keepDefault) {
      if (!newPin.trim()) {
        setStep1Error('Please enter a new Admin PIN / Password, or click "Keep Default PIN".');
        return;
      }
      if (newPin.length < 4) {
        setStep1Error('New PIN / Password should be at least 4 characters long.');
        return;
      }
      if (newPin !== confirmPin) {
        setStep1Error('New PIN and Confirm PIN do not match. Please re-check.');
        return;
      }
      finalPin = newPin.trim();
    }

    // Persist new admin credentials and store name in database
    const { adminUser } = posDb.completeOnboarding({
      newAdminPin: finalPin,
      newAdminUsername: finalUsername,
      storeName: storeName.trim() || 'My Boutique',
    });

    setSavedStaffUser(adminUser);
    setCurrentStep(2);
  };

  // Handle Step 2: Enter Float Money of the Day & Open Register
  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFloatValid) {
      setStep2Error('Please enter a valid opening float amount (e.g. 200.00).');
      return;
    }

    const cashierName = savedStaffUser?.name || 'Administrator';
    const noteText = openingNotes.trim() 
      ? `Day opened by ${cashierName}. Note: ${openingNotes.trim()}`
      : `Day opened by ${cashierName}`;

    // Open EOD Session for the day
    posDb.openEODSession(Number(parsedFloat.toFixed(2)), noteText, cashierName);

    // Get latest active admin user
    const adminUser = savedStaffUser || posDb.getStaffUsers().find(u => u.role === 'admin') || {
      id: 'STAFF-ADMIN',
      name: 'Main Administrator',
      username: adminUsername,
      pin: newPin || settings.adminPin || 'admin123',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    onComplete(adminUser);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-[#161B22] border border-[#1E293B] rounded-2xl shadow-2xl overflow-hidden relative my-6">
        
        {/* Top Decorative Banner */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

        {/* Wizard Progress Bar */}
        <div className="px-6 pt-5 pb-3 border-b border-[#1E293B] bg-[#0F1115]/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep === 1
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                {currentStep > 1 ? '✓' : '1'}
              </span>
              <span className={`text-xs font-bold ${currentStep === 1 ? 'text-white' : 'text-slate-400'}`}>
                1. Password Setup
              </span>
            </div>

            <div className="w-6 h-px bg-slate-700" />

            <div className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep === 2
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                2
              </span>
              <span className={`text-xs font-bold ${currentStep === 2 ? 'text-white' : 'text-slate-400'}`}>
                2. Opening Float
              </span>
            </div>
          </div>

          {isReplayMode && onClose && (
            <button
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: WELCOMING POPUP & DEFAULT PASSWORD ADVISORY / CREATE NEW PASSWORD */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="p-6 sm:p-7 space-y-5">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-inner">
                <Store className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Welcome to {storeName || 'The Gift Shop'}
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Initial system configuration & master security credentials.
              </p>
            </div>

            {/* ADVISORY: Default Password in Place Notice */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                    Default Security Password In Place
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    This terminal is currently configured with the standard default administrator credentials:
                  </p>
                </div>
              </div>

              <div className="bg-[#0F1115]/80 border border-amber-500/20 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-400">Default Username: </span>
                  <span className="font-bold text-amber-300">admin</span>
                </div>
                <div className="w-px h-4 bg-slate-700" />
                <div>
                  <span className="text-slate-400">Default PIN: </span>
                  <span className="font-bold text-amber-300">admin123</span>
                </div>
              </div>

              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                🔒 <strong>Recommendation:</strong> Create your own secure Master PIN / Password below to protect register controls, financial reports, and settings.
              </p>
            </div>

            {/* Store & New Password Form */}
            <div className="space-y-3.5 bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Boutique / Store Business Name
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Ocean Seychelles Boutique"
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>New Master PIN</span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-200 text-[10px] flex items-center gap-1"
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPin}
                      onChange={(e) => {
                        setNewPin(e.target.value);
                        setStep1Error('');
                      }}
                      placeholder="e.g. 5892 or CustomPin"
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Confirm New PIN
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPin}
                    onChange={(e) => {
                      setConfirmPin(e.target.value);
                      setStep1Error('');
                    }}
                    placeholder="Re-enter to confirm"
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {newPin && confirmPin && newPin === confirmPin && (
                <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-medium pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Passwords match! Ready to proceed.</span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {step1Error && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/70 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{step1Error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleStep1Submit(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl py-3 text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50"
              >
                <KeyRound className="w-4 h-4" />
                <span>Save New Password & Continue to Float</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleStep1Submit(true)}
                className="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-[#1E293B] font-semibold rounded-xl py-2 text-xs transition-colors"
              >
                Keep Default PIN (<span className="font-mono text-amber-300">admin123</span>) for Now & Continue →
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: ENTER FLOAT MONEY OF THE DAY */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="p-6 sm:p-7 space-y-5">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-inner">
                <Wallet className="w-7 h-7 text-amber-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Enter Float Money of the Day
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Count the physical cash in your drawer to initialize today's register audit ledger.
              </p>

              <div className="flex items-center justify-center gap-2 mt-2 text-xs text-slate-400">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-medium">{todayStr}</span>
              </div>
            </div>

            {/* Float Entry Form */}
            <form onSubmit={handleStep2Submit} className="space-y-4">
              <div className="rounded-xl bg-[#0F1115] border border-[#1E293B] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-amber-400" />
                    <span>Opening Cash Drawer Float</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5 rounded">
                    Currency: {currencyCode} ({currencySymbol})
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-amber-400 font-mono">
                    {currencySymbol}
                  </span>
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={floatAmount}
                    onChange={(e) => {
                      setFloatAmount(e.target.value);
                      setStep2Error('');
                    }}
                    placeholder="0.00"
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl pl-14 pr-4 py-3.5 text-3xl font-mono font-black text-white text-center focus:outline-none focus:border-amber-500 shadow-inner"
                  />
                </div>

                {/* Quick Select Buttons */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setFloatAmount(String(amt));
                        setStep2Error('');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        floatAmount === String(amt)
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-xs'
                          : 'bg-[#161B22] text-slate-400 border border-[#1E293B] hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {currencySymbol}{amt}
                    </button>
                  ))}
                </div>

                {/* Optional Opening Notes */}
                <div className="pt-2 border-t border-[#1E293B]/70">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Opening Notes / Shift Remarks (Optional):
                  </label>
                  <input
                    type="text"
                    value={openingNotes}
                    onChange={(e) => setOpeningNotes(e.target.value)}
                    placeholder="e.g. Standard morning float counted & verified"
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Error Message */}
              {step2Error && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/70 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{step2Error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="submit"
                  disabled={!isFloatValid}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl py-3.5 text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50"
                >
                  <Banknote className="w-4 h-4" />
                  <span>Declare Float & Open POS Register</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="w-full text-slate-400 hover:text-slate-200 text-xs py-1.5 transition-colors text-center"
                >
                  ← Back to Password Setup
                </button>
              </div>
            </form>

            <p className="text-[10px] text-slate-500 text-center">
              Your opening float declaration is recorded in the End of Day balancing ledger and cash drawer audit trail.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
