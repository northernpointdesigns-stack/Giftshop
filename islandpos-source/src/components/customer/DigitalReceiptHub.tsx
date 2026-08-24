import React, { useState, useEffect } from 'react';
import { ShoppingBag, Star, CheckCircle, MessageSquare, Award, Clock, ArrowLeft, Heart, Send } from 'lucide-react';
import { posDb, CustomerFeedback } from '../../services/db';
import confetti from 'canvas-confetti';

interface DigitalReceiptHubProps {
  receiptNumber: string;
  onBackToApp?: () => void;
}

export const DigitalReceiptHub: React.FC<DigitalReceiptHubProps> = ({
  receiptNumber,
  onBackToApp,
}) => {
  // Find transaction
  const transactions = posDb.getTransactions();
  const transaction = transactions.find(
    (t) => t.receiptNumber.toLowerCase() === receiptNumber.toLowerCase()
  );

  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';
  const secondaryCode = settings.secondaryCurrency || 'USD';
  const exchangeRate = settings.exchangeRate || 13.50;

  // Feedback State
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [category, setCategory] = useState<string>('Service Quality');
  const [comments, setComments] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Check if already submitted feedback for this receipt
  useEffect(() => {
    const list = posDb.getFeedbackList();
    const existing = list.find((fb) => fb.receiptNumber.toLowerCase() === receiptNumber.toLowerCase());
    if (existing) {
      setIsSubmitted(true);
      setRating(existing.rating);
      setCategory(existing.category);
      setComments(existing.comments);
    }
  }, [receiptNumber]);

  if (!transaction) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-[#E2E8F0] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-[#161B22] border border-[#1E293B] p-8 rounded-2xl max-w-md w-full space-y-4 shadow-xl">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Receipt Not Found</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            We couldn't find a digital receipt with reference <code className="text-rose-400 font-mono font-bold bg-[#0F1115] px-1.5 py-0.5 rounded">{receiptNumber}</code>. Please double-check the QR code or verify with boutique staff.
          </p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="w-full bg-slate-800 hover:bg-slate-700 text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Register
            </button>
          )}
        </div>
      </div>
    );
  }

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setErrorMsg('Please select a star rating first.');
      return;
    }

    posDb.addFeedback(transaction.receiptNumber, rating, category, comments);
    setIsSubmitted(true);
    setErrorMsg('');

    // Trigger sweet confetti!
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#10b981', '#06b6d4', '#6366f1'],
    });
  };

  const categories = [
    'Service Quality',
    'Product Selection',
    'Store Cleanliness',
    'Checkout Speed',
    'Overall Value',
  ];

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#E2E8F0] py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Hub Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
          <div className="text-center sm:text-left space-y-1">
            <div className="text-[10px] text-emerald-400 font-black uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1">
              <Award className="w-3.5 h-3.5" /> {settings.removeIslandBranding ? (settings.posAppName || settings.storeName || 'Premium Client Portal') : (settings.storeName || 'Seychelles Artisan Hub')}
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Customer Portal
            </h1>
          </div>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Terminal
            </button>
          )}
        </div>

        {/* Dynamic Responsive 2-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* COLUMN 1: Digital Receipt Details */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex justify-between items-center border-b border-[#1E293B] pb-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-emerald-400" /> Digital Invoice
              </h2>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                Verified Paid
              </span>
            </div>

            {/* Simulated Receipt Header */}
            <div className="text-center py-2 space-y-1 bg-[#0F1115] rounded-xl p-4 border border-[#1E293B]/50">
              <div className="font-extrabold text-sm uppercase text-slate-200">
                {settings.storeName || 'Seychelles Island Boutique'}
              </div>
              <div className="text-[10px] text-slate-500">
                {settings.receiptHeaderSubtitle || 'Premium Handcrafted Products'}
              </div>
              {settings.taxRegistrationNumber && (
                <div className="text-[9px] text-slate-500 font-mono">
                  VAT ID: {settings.taxRegistrationNumber}
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-[#0F1115] p-4 rounded-xl border border-[#1E293B]/50 font-mono">
              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500 uppercase">Receipt #</div>
                <div className="font-bold text-slate-300">{transaction.receiptNumber}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500 uppercase">Date Time</div>
                <div className="text-slate-300 truncate">{new Date(transaction.timestamp).toLocaleString()}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500 uppercase">Payment Method</div>
                <div className="font-bold text-emerald-400 capitalize">{transaction.paymentMethod}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500 uppercase">Served By</div>
                <div className="text-slate-300">{transaction.cashierName}</div>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Purchased Items</h3>
              <div className="divide-y divide-[#1E293B] space-y-2">
                {transaction.items.map((item, idx) => (
                  <div key={idx} className="pt-2 flex justify-between gap-4 text-xs">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="font-bold text-slate-200 truncate">
                        {item.brand && `[${item.brand}] `}{item.name}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                        <span>{item.quantity}x @ {primarySymbol} {item.unitPrice.toFixed(2)}</span>
                        {item.size && <span className="bg-slate-800 px-1 py-0.2 rounded text-[9px] text-slate-300">{item.size}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono font-bold text-slate-300">
                      {primarySymbol} {item.totalPrice.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="bg-[#0F1115] p-4 rounded-xl border border-[#1E293B]/50 font-mono space-y-1.5 text-xs text-right">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal (Net):</span>
                <span className="text-slate-300">{primarySymbol} {transaction.subtotal.toFixed(2)}</span>
              </div>
              {transaction.discount > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Discount:</span>
                  <span>-{primarySymbol} {transaction.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>VAT Tax (15%):</span>
                <span className="text-slate-300">{primarySymbol} {transaction.vatTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-emerald-400 pt-2 border-t border-[#1E293B]/80">
                <span>TOTAL PAID:</span>
                <span>{primarySymbol} {transaction.total.toFixed(2)}</span>
              </div>

              {/* Dynamic conversion lookup */}
              {transaction.currencyUsed === 'secondary' && transaction.secondaryTotal && (
                <div className="pt-1 text-[10px] text-cyan-400 font-bold border-t border-dashed border-[#1E293B]/80 flex justify-between">
                  <span>Paid Equivalent ({secondaryCode}):</span>
                  <span>{secondarySymbol}{transaction.secondaryTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: Store Feedback Churn */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-5">
            {!isSubmitted ? (
              <form onSubmit={handleFeedbackSubmit} className="space-y-5">
                <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-[#1E293B] pb-3">
                    <MessageSquare className="w-4 h-4 text-emerald-400" /> Share Your Experience
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    Your feedback helps us support local Seychellois artisans, improve stock selections, and provide exemplary boutique service.
                  </p>
                </div>

                {/* Star Rating Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    How was your experience today?
                  </label>
                  <div className="flex items-center gap-2 py-1">
                    {[1, 2, 3, 4, 5].map((starValue) => {
                      const isLit = (hoveredRating || rating) >= starValue;
                      return (
                        <button
                          key={starValue}
                          type="button"
                          onClick={() => setRating(starValue)}
                          onMouseEnter={() => setHoveredRating(starValue)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="p-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded-lg transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-8 h-8 transition-colors ${
                              isLit
                                ? 'fill-emerald-400 text-emerald-400'
                                : 'text-slate-600'
                            }`}
                          />
                        </button>
                      );
                    })}
                    {rating > 0 && (
                      <span className="text-xs font-mono font-bold text-emerald-400 ml-2">
                        {rating === 5 ? 'Excellent 🤩' : rating === 4 ? 'Great 🙂' : rating === 3 ? 'Good 😐' : rating === 2 ? 'Fair 🙁' : 'Poor 😞'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Category Radio Group */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    What stood out most?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`text-left px-3 py-2 rounded-xl text-[11px] font-semibold border transition-all ${
                          category === cat
                            ? 'bg-emerald-600/10 border-emerald-500 text-emerald-300'
                            : 'bg-[#0F1115] border-[#1E293B] text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback Comment */}
                <div className="space-y-2">
                  <label htmlFor="comments" className="block text-xs font-semibold text-slate-300">
                    Additional Comments or Suggestions:
                  </label>
                  <textarea
                    id="comments"
                    rows={4}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Tell us what you liked, or where we can make things better..."
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 placeholder:text-slate-600 font-sans"
                  />
                </div>

                {errorMsg && (
                  <div className="text-[11px] text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                    ⚠️ {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Feedback</span>
                </button>
              </form>
            ) : (
              <div className="py-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">Thank You So Much!</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Your feedback was successfully logged. We review every entry to continuously elevate the Seychellois shopping experience.
                  </p>
                </div>

                <div className="bg-[#0F1115] p-4 rounded-xl border border-[#1E293B] text-left text-xs space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Your Rating:</span>
                    <span className="text-emerald-400">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Focused Area:</span>
                    <span className="text-slate-300 font-bold">{category}</span>
                  </div>
                  {comments && (
                    <div className="pt-2 border-t border-[#1E293B] text-slate-400 font-sans italic text-[11px] leading-relaxed">
                      "{comments}"
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-center gap-1.5 text-[11px] text-slate-500">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  <span>{settings.removeIslandBranding ? `Thank you for shopping with ${settings.storeName || 'us'}` : 'Made in Seychelles with Love'}</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
