import React, { useState, useEffect } from 'react';
import { ShoppingBag, Tv, Sparkles, Heart, CreditCard, Banknote, ExternalLink } from 'lucide-react';
import { CustomerDisplayState } from '../../types/pos';
import { customerChannel } from '../../services/customerChannel';
import { posDb } from '../../services/db';

export const CustomerDisplay: React.FC = () => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';

  const [state, setState] = useState<CustomerDisplayState>({
    cart: [],
    subtotal: 0,
    taxTotal: 0,
    discountTotal: 0,
    total: 0,
    secondaryTotal: 0,
    exchangeRate: settings.exchangeRate || 13.5,
    status: 'idle',
  });

  useEffect(() => {
    const unsub = customerChannel.subscribe((incoming) => {
      setState(incoming);
    });
    return () => unsub();
  }, []);

  const handleOpenDualWindow = () => {
    const url = `${window.location.pathname}?tab=customer_display`;
    window.open(url, '_blank', 'width=1024,height=768');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0D13] p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-4">
        {/* Header (Top screen) */}
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Tv className="w-5 h-5 text-emerald-400" />
              <span>Customer-Facing Dual Screen Preview</span>
            </h1>
            <p className="text-xs text-slate-400">
              Live synchronized kiosk monitor for shoppers at checkout counter
            </p>
          </div>

          <button
            onClick={handleOpenDualWindow}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Pop Out Dual Screen Window</span>
          </button>
        </div>

        {/* The Customer Screen Container */}
        <div className="bg-[#161B22] border border-[#1E293B] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Top Brand Banner */}
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {settings.storeName}
              </h2>
              <span className="text-xs text-emerald-400 font-semibold">
                Victoria, Mahé Island • Welcome to our boutique
              </span>
            </div>

            {state.attachedCustomer ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-2xl text-right">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">
                  Welcome Back Member
                </span>
                <span className="text-xs font-bold text-white">{state.attachedCustomer.name}</span>
              </div>
            ) : (
              <div className="text-right font-mono text-xs text-slate-400">
                1 USD = <strong className="text-white">{state.exchangeRate.toFixed(2)} SCR</strong>
              </div>
            )}
          </div>

          {/* Cart Items or Idle Welcome Message */}
          {state.cart.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <Heart className="w-8 h-8 fill-current" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Thank you for visiting us!</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Items scanned by cashier will appear here in real-time with dual SCR & USD pricing.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-72 overflow-y-auto space-y-2 pr-2">
                {state.cart.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-[#0F1115] border border-[#1E293B] p-3.5 rounded-2xl flex items-center justify-between text-xs sm:text-sm"
                  >
                    <div>
                      <span className="font-bold text-white block">{item.name}</span>
                      <span className="text-xs text-slate-400 font-mono">
                        {item.quantity} x {primarySymbol} {item.finalPrice.toFixed(2)}
                      </span>
                    </div>

                    <div className="text-right font-mono font-extrabold text-white">
                      {primarySymbol} {(item.finalPrice * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Banner */}
              <div className="bg-[#0F1115] border border-emerald-500/40 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                    Total Amount Due
                  </span>
                  <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-400 mt-1">
                    {primarySymbol} {state.total.toFixed(2)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 font-bold uppercase block">
                    USD Equivalent
                  </span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-cyan-400 mt-1">
                    {secondarySymbol} {state.secondaryTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
