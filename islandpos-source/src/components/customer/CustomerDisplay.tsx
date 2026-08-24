import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Palmtree,
  Sparkles,
  ExternalLink,
  X,
  Percent,
} from 'lucide-react';
import { CustomerDisplayState } from '../../types/pos';
import { customerChannel } from '../../services/customerChannel';
import { posDb } from '../../services/db';

interface CustomerDisplayProps {
  onCloseModal?: () => void;
  isStandaloneWindow?: boolean;
}

export const CustomerDisplay: React.FC<CustomerDisplayProps> = ({
  onCloseModal,
  isStandaloneWindow = false,
}) => {
  const [state, setState] = useState<CustomerDisplayState>(customerChannel.getCurrentState());
  const [settings, setSettings] = useState(() => posDb.getSettings());

  useEffect(() => {
    const unsubscribe = customerChannel.subscribe((newState) => {
      setState(newState);
    });
    return () => unsubscribe();
  }, []);

  // Sync settings when storage updates across window instances
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'island_pos_settings_v2') {
        setSettings(posDb.getSettings());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleOpenSecondaryWindow = () => {
    const popup = window.open(
      window.location.href + '?view=customer',
      'CustomerDisplayWindow',
      'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no'
    );
    if (popup) {
      popup.focus();
    }
  };

  const isBrandingRemoved = settings.removeIslandBranding;
  const appName = isBrandingRemoved 
    ? (settings.posAppName || settings.storeName || 'My Boutique POS')
    : (settings.posAppName || 'IslandPOS');

  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 13.50;
  const displayCurrency = state.displayCurrency || 'primary';
  const isSecondaryDisplay = displayCurrency === 'secondary';
  const displaySymbol = isSecondaryDisplay ? secondarySymbol : primarySymbol;
  const displayCode = isSecondaryDisplay ? secondaryCode : primaryCode;
  const displaySubtotal = isSecondaryDisplay
    ? (state.secondarySubtotal ?? state.subtotal / exchangeRate)
    : state.subtotal;
  const displayTax = isSecondaryDisplay
    ? (state.secondaryTax ?? state.tax / exchangeRate)
    : state.tax;
  const displayTotal = isSecondaryDisplay
    ? (state.secondaryTotal ?? state.total / exchangeRate)
    : state.total;

  const currentVatRateText = `${Math.round((settings.defaultVatRate ?? 0.15) * 100)}%`;

  return (
    <div className="bg-[#0F1115] text-[#E2E8F0] min-h-[600px] rounded-2xl border border-[#1E293B] p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
      {/* Decorative Tropical Gradient Accents */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header - Conforms to responsive guidelines & avoids boundary overflow */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-[#1E293B] relative z-10 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <Palmtree className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-xl font-black tracking-wide text-emerald-400 truncate max-w-md">
              {appName}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              {state.customMessage || `Thank you for shopping at ${appName}!`}
            </p>
          </div>
        </div>

        {!isStandaloneWindow && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={handleOpenSecondaryWindow}
              className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
              title="Drag window to secondary customer monitor"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Launch 2nd Screen Window</span>
            </button>
            {onCloseModal && (
              <button
                onClick={onCloseModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Split: Left Cart Tape, Right Grand Total Display */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 relative z-10 flex-1">
        {/* Scanned Cart Items List (7 cols) */}
        <div className="lg:col-span-7 bg-[#161B22] border border-[#1E293B] rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B] text-xs text-slate-400">
              <span className="font-semibold flex items-center gap-1.5 text-slate-200">
                <ShoppingBag className="w-4 h-4 text-emerald-400" /> Live Register Receipt
              </span>
              <span>{state.cartItems.reduce((acc, i) => acc + i.quantity, 0)} Items</span>
            </div>

            <div className="my-3 space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {state.cartItems.length === 0 ? (
                <div className="py-16 text-center text-slate-500 space-y-2">
                  <Sparkles className="w-12 h-12 mx-auto text-emerald-400/40 animate-bounce" />
                  <p className="text-sm font-semibold text-slate-300">
                    Welcome!
                  </p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Items will appear here live as our cashier rings up your purchases.
                  </p>
                </div>
              ) : (
                state.cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B] flex items-center justify-between animate-fadeIn"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 shrink-0">
                          {item.brand || 'Ocean'}
                        </span>
                        <span className="font-semibold text-sm text-[#E2E8F0] truncate block">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono">
                         {item.quantity} x {displaySymbol} {(isSecondaryDisplay
                           ? (item.secondaryUnitPrice ?? item.unitPrice / exchangeRate)
                           : item.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-emerald-400 text-base shrink-0">
                      {displaySymbol} {(isSecondaryDisplay
                        ? (item.secondaryTotalPrice ?? item.totalPrice / exchangeRate)
                        : item.totalPrice).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Last Scanned Item Spotlight */}
          {state.lastScannedItem && (
            <div className="bg-emerald-950/40 border border-emerald-800/50 p-3 rounded-xl text-xs flex items-center justify-between text-emerald-300">
              <span className="font-semibold truncate">
                Scanned: [{state.lastScannedItem.brand || 'Ocean'}] {state.lastScannedItem.name}
              </span>
              <span className="font-mono font-bold">{primarySymbol} {state.lastScannedItem.price.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Grand Total Side Display (5 cols) */}
        <div className="lg:col-span-5 bg-[#161B22] border border-[#1E293B] rounded-xl p-6 flex flex-col justify-between shadow-xl">
          <div className="space-y-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold border-b border-[#1E293B] pb-2">
              Payment Total Breakdown
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>Net Subtotal</span>
               <span className="font-mono font-bold text-[#E2E8F0]">
                   {displaySubtotal.toFixed(2)} <span className="text-[10px] text-slate-400 font-semibold">{displayCode}</span>
                </span>
              </div>
              <div className="flex justify-between text-cyan-400">
                <span className="flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5" /> VAT Tax ({currentVatRateText})
                </span>
                <span className="font-mono font-bold">
                   +{displayTax.toFixed(2)} <span className="text-[10px] text-cyan-400/70 font-semibold">{displayCode}</span>
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1E293B]">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                TOTAL DUE
              </div>
              <div className="text-4xl lg:text-5xl font-black font-mono text-emerald-400 my-1">
                {displayTotal.toFixed(2)}
                <span className="text-base lg:text-lg font-bold text-emerald-500/80 ml-2">{displayCode}</span>
              </div>

              {/* Multi-currency reference amounts for the customer */}
              {(settings.customerDisplayCurrencies || []).filter((c) => c.enabled && c.code && c.rate > 0).length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#1E293B] space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    In your currency
                  </div>
                  {(settings.customerDisplayCurrencies || [])
                    .filter((c) => c.enabled && c.code && c.rate > 0)
                    .map((c) => (
                      <div key={c.code} className="flex justify-between text-xs font-mono font-bold text-cyan-400">
                        <span className="text-slate-400">{c.code}</span>
                        <span>{c.symbol} {(state.total / c.rate).toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              )}

              {settings.allowPaymentInSecondary !== false && displayCurrency === 'secondary' && (
                <div className="text-xs text-cyan-400 font-mono font-bold mt-1.5">
                   Equivalent: {primarySymbol}{state.total.toFixed(2)} {primaryCode}
                </div>
              )}

              <div className="text-xs text-slate-500 mt-2">
                Cash, Card, & Mobile Payments Accepted
              </div>
            </div>
          </div>

          {/* Promotional Banner */}
          <div className="mt-6 p-4 rounded-xl bg-[#0F1115] border border-[#1E293B] text-center space-y-1">
            <div className="text-xs font-bold text-amber-300 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> {appName} Quality Guarantee
            </div>
            <p className="text-[11px] text-slate-400">
              Authentic premium designs, artisan goods, local crafts, and island souvenirs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
