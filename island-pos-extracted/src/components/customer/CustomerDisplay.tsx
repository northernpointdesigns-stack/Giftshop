import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Palmtree,
  Sparkles,
  ExternalLink,
  X,
  Percent,
  Tag,
  Globe,
} from 'lucide-react';
import { CustomerDisplayState } from '../../types/pos';
import { customerChannel } from '../../services/customerChannel';
import { posDb } from '../../services/db';
import { formatCurrency, getMultiCurrencyEquivalents } from '../../utils/currencyAndMath';

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

  const primarySymbol = state.primarySymbol || settings.primaryCurrencySymbol || '$';
;
  const primaryCode = state.primaryCurrency || settings.primaryCurrency || 'USD';
  const secondarySymbol = state.secondarySymbol || settings.secondaryCurrencySymbol || '$';
  const secondaryCode = state.secondaryCurrency || settings.secondaryCurrency || 'USD';
  const exchangeRate = state.exchangeRate || settings.exchangeRate || 1;

  // Selected viewing currency on customer display
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState<string>(
    state.displayCurrency === 'secondary' ? secondaryCode : primaryCode
  );

  useEffect(() => {
    const unsubscribe = customerChannel.subscribe((newState) => {
      setState(newState);
    });
    return () => unsubscribe();
  }, []);

  // Follow the cashier's live currency view so the customer screen always
  // mirrors exactly what the main register is showing (SCR vs USD etc.)
  useEffect(() => {
    setSelectedCurrencyCode(state.displayCurrency === 'secondary' ? secondaryCode : primaryCode);
  }, [state.displayCurrency, secondaryCode, primaryCode]);

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

  const appName = settings.posAppName || settings.storeName || 'GiftShop';

  // Multi-currency rates map
  const activeCurrencies = [
    { code: primaryCode, symbol: primarySymbol, rate: 1.0, name: 'Local Currency (Primary)' },
    { code: secondaryCode, symbol: secondarySymbol, rate: exchangeRate, name: 'US Dollar (Secondary)' },
    ...(settings.customerDisplayCurrencies || [])
      .filter((c) => c.enabled && c.code && c.code !== primaryCode && c.code !== secondaryCode && c.rate > 0),
  ];

  const currentCurrObj = activeCurrencies.find((c) => c.code === selectedCurrencyCode) || activeCurrencies[0];
  const currentRate = currentCurrObj.rate || 1.0;
  const currentSymbol = currentCurrObj.symbol || primarySymbol;

  // Computed display values in selected customer currency.
  // In the secondary currency we render the register's OWN pushed snapshot
  // values (secondarySubtotal/secondaryTax/secondaryTotal) which are computed
  // by the exact same calculateCartTotals routine the cashier sees — this
  // guarantees zero cent disparities between the two screens. For any other
  // display currency we convert from the primary grand total.
  const isSecondaryView = selectedCurrencyCode === secondaryCode && secondaryCode !== primaryCode;
  const displaySubtotal =
    isSecondaryView && state.secondarySubtotal !== undefined
      ? state.secondarySubtotal
      : state.subtotal / currentRate;
  const displayDiscount =
    isSecondaryView && state.secondaryDiscount !== undefined
      ? state.secondaryDiscount
      : (state.discount || 0) / currentRate;
  const displayItemDiscount =
    isSecondaryView && state.secondaryItemDiscount !== undefined
      ? state.secondaryItemDiscount
      : (state.itemDiscountTotal || 0) / currentRate;
  const displayTax =
    isSecondaryView && state.secondaryTax !== undefined
      ? state.secondaryTax
      : state.tax / currentRate;
  const displayTotal =
    isSecondaryView && state.secondaryTotal !== undefined
      ? state.secondaryTotal
      : state.total / currentRate;

  // Effective blended VAT percentage derived from the register's own pushed
  // figures (items may carry individual VAT rates) — falls back to the
  // store default while the cart is empty.
  const effectiveVatPct =
    state.subtotal > 0
      ? Math.round((state.tax / state.subtotal) * 100)
      : Math.round((settings.defaultVatRate ?? 0.15) * 100);
  const currentVatRateText = `${effectiveVatPct}%`;

  // Settings snapshot pinned to the register's pushed exchange rate so the
  // "Or Equivalent Amounts" panel can never drift from the cashier's screen.
  const syncedSettings = { ...settings, exchangeRate: state.exchangeRate || settings.exchangeRate };

  const scale = settings.dualDisplayScale ? settings.dualDisplayScale / 100 : 1;
  const widthVal = settings.dualDisplayResolutionWidth ? `${settings.dualDisplayResolutionWidth}px` : undefined;
  const heightVal = settings.dualDisplayResolutionHeight ? `${settings.dualDisplayResolutionHeight}px` : undefined;

  const styleOverride: React.CSSProperties = {
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: scale !== 1 ? 'top center' : undefined,
    width: widthVal,
    height: heightVal,
  };

  return (
    <div
      style={styleOverride}
      className="bg-[#0F1115] text-[#E2E8F0] min-h-[600px] rounded-2xl border border-[#1E293B] p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden"
    >
      {/* Decorative Tropical Gradient Accents */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-[#1E293B] relative z-10 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <Palmtree className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base md:text-xl font-black tracking-wide text-emerald-400 truncate max-w-md">
                {appName}
              </h1>
              {state.stationName && (
                <span className="text-[10px] text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 font-mono">
                  🖥️ {state.stationName}
                </span>
              )}
              {state.priceTierName && (
                <span className="text-[10px] text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/70 font-mono font-semibold">
                  🏷️ {state.priceTierName}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">
              {state.customMessage || `Thank you for shopping at ${appName}!`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {/* Customer International Currency Chooser */}
          <div className="flex items-center gap-1 bg-[#161B22] border border-[#1E293B] rounded-xl p-1">
            <span className="text-[10px] font-bold text-slate-400 px-1.5 flex items-center gap-1">
              <Globe className="w-3 h-3 text-cyan-400" /> Currency:
            </span>
            {activeCurrencies.map((c) => (
              <button
                key={c.code}
                onClick={() => setSelectedCurrencyCode(c.code)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold font-mono transition-all ${
                  selectedCurrencyCode === c.code
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`View prices in ${c.code}`}
              >
                {c.code}
              </button>
            ))}
          </div>

          {!isStandaloneWindow && (
            <>
              <button
                onClick={handleOpenSecondaryWindow}
                className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                title="Drag window to secondary customer monitor"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden md:inline">2nd Screen</span>
              </button>
              {onCloseModal && (
                <button
                  onClick={onCloseModal}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content Split: Left Cart Tape, Right Grand Total Display */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 relative z-10 flex-1">
        {/* Scanned Cart Items List (7 cols) */}
        <div className="lg:col-span-7 bg-[#161B22] border border-[#1E293B] rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B] text-xs text-slate-400">
              <span className="font-semibold flex items-center gap-1.5 text-slate-200">
                <ShoppingBag className="w-4 h-4 text-emerald-400" /> Live Register Tape
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
                state.cartItems.map((item) => {
                  const itemUnitPriceInCurr = item.unitPrice / currentRate;
                  const itemTotalPriceInCurr = (item.unitPrice * item.quantity) / currentRate;

                  return (
                    <div
                      key={item.id}
                      className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B] flex items-center justify-between animate-fadeIn"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 shrink-0">
                            {item.brand || 'Ocean'}
                          </span>
                          <span className="font-semibold text-sm text-[#E2E8F0] truncate block">
                            {item.name}
                          </span>
                          {item.priceListName && (
                            <span className="font-bold text-[9px] text-cyan-300 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-800/60 shrink-0 font-mono">
                              {item.priceListName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                          {item.quantity} x {currentSymbol} {itemUnitPriceInCurr.toFixed(2)}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-emerald-400 text-base shrink-0">
                        {currentSymbol} {itemTotalPriceInCurr.toFixed(2)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Last Scanned Item Spotlight */}
          {state.lastScannedItem && (
            <div className="bg-emerald-950/40 border border-emerald-800/50 p-3 rounded-xl text-xs flex items-center justify-between text-emerald-300">
              <span className="font-semibold truncate">
                Scanned: [{state.lastScannedItem.brand || 'Ocean'}] {state.lastScannedItem.name}
              </span>
              <span className="font-mono font-bold">{currentSymbol} {(state.lastScannedItem.price / currentRate).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Grand Total Side Display (5 cols) */}
        <div className="lg:col-span-5 bg-[#161B22] border border-[#1E293B] rounded-xl p-6 flex flex-col justify-between shadow-xl">
          <div className="space-y-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold border-b border-[#1E293B] pb-2">
              Payment Breakdown
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>Net Subtotal</span>
                <span className="font-mono font-bold text-[#E2E8F0]">
                  {currentSymbol} {displaySubtotal.toFixed(2)}
                </span>
              </div>

              {displayItemDiscount > 0 && (
                <div className="flex justify-between text-amber-400/90 text-xs">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-amber-400" /> Damaged Markdown
                  </span>
                  <span className="font-mono font-bold">
                    -{currentSymbol} {displayItemDiscount.toFixed(2)}
                  </span>
                </div>
              )}

              {displayDiscount > 0 && (
                <div className="flex justify-between text-amber-400 text-xs">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-amber-400" /> Order Discount
                    {state.discountType === 'percent' && state.discountValue ? ` (${state.discountValue}%)` : ''}
                  </span>
                  <span className="font-mono font-bold">
                    -{currentSymbol} {displayDiscount.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-cyan-400">
                <span className="flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5" /> VAT Tax ({currentVatRateText})
                </span>
                <span className="font-mono font-bold">
                  +{currentSymbol} {displayTax.toFixed(2)}
                </span>
              </div>
            </div>

            {(() => {
              const multiEqs = getMultiCurrencyEquivalents(state.total, syncedSettings);
              const otherEquivalents = multiEqs.filter((c) => c.code !== selectedCurrencyCode);

              return (
                <div className="pt-4 border-t border-[#1E293B]">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    GRAND TOTAL DUE
                  </div>
                  <div className="text-4xl lg:text-5xl font-black font-mono text-emerald-400 my-1">
                    {displayTotal.toFixed(2)}
                    <span className="text-base lg:text-lg font-bold text-emerald-500/80 ml-2">{selectedCurrencyCode}</span>
                  </div>

                  {/* Live Split Payments Breakdown if cashier is in split mode */}
                  {state.splitPaymentsPreview && state.splitPaymentsPreview.length > 0 && (
                    <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                      <div className="text-xs font-bold text-amber-300 flex items-center justify-between">
                        <span>Split Payments Tendered</span>
                        <span className="font-mono text-cyan-300">
                          Paid: {primarySymbol} {(state.splitTotalPaidSoFar || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {state.splitPaymentsPreview.map((line, i) => (
                          <div key={i} className="text-xs font-mono flex justify-between text-slate-300">
                            <span>{line.method === 'cash' ? '💵 Cash' : '💳 Card'} ({line.currencyCode}):</span>
                            <span className="font-bold">
                              {line.currencySymbol}{line.amountTendered.toFixed(2)} ({primarySymbol}{line.amountInPrimary.toFixed(2)})
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-amber-500/20 flex justify-between text-xs font-bold font-mono">
                        <span className="text-amber-200">REMAINING BALANCE DUE:</span>
                        <span className="text-amber-400 text-sm">
                          {primarySymbol} {(state.splitRemainingDue || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Multi-currency Equivalent References (Local, Secondary, 3rd Currency) */}
                  <div className="mt-3 bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 space-y-2">
                    <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-cyan-400">
                        <Globe className="w-3.5 h-3.5" /> Or Equivalent Amounts:
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">1 {secondaryCode} = {primarySymbol} {exchangeRate.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 font-mono">
                      {otherEquivalents.map((c) => (
                        <div
                          key={c.code}
                          className={`bg-[#161B22] border rounded-lg p-2.5 flex flex-col justify-between ${
                            c.isPrimary
                              ? 'border-emerald-500/40'
                              : c.isSecondary
                              ? 'border-cyan-500/40'
                              : 'border-purple-500/40'
                          }`}
                        >
                          <span className={`text-[10px] font-bold uppercase truncate ${
                            c.isPrimary ? 'text-emerald-400' : c.isSecondary ? 'text-cyan-400' : 'text-purple-400'
                          }`}>
                            {c.code} ({c.label.split(' ')[0]})
                          </span>
                          <span className="text-sm font-black text-white mt-0.5 truncate">
                            {c.symbol} {c.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 mt-3">
                    Cash, Card, & Contactless Mobile Payments Accepted
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Promotional Banner */}
          <div className="mt-6 p-4 rounded-xl bg-[#0F1115] border border-[#1E293B] text-center space-y-1">
            <div className="text-xs font-bold text-amber-300 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> {appName} Island Authenticity Guarantee
            </div>
            <p className="text-[11px] text-slate-400">
              Original hand-crafted apparel, local spices, boutique jewelry, and local gifts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
