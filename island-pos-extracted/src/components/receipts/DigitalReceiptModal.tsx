import React, { useState } from 'react';
import { X, Send, Mail, Check, Copy, ExternalLink, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { Transaction } from '../../types/pos';
import { posDb } from '../../services/db';
import { resolveStoreName } from '../../services/brand';

interface DigitalReceiptModalProps {
  transaction: Transaction;
  onClose: () => void;
}

const COUNTRY_CODES = [
  { code: '+248', label: 'Seychelles (+248)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+44', label: 'United Kingdom (+44)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+39', label: 'Italy (+39)' },
  { code: '+971', label: 'United Arab Emirates (+971)' },
  { code: '+27', label: 'South Africa (+27)' },
  { code: '+1', label: 'United States / Canada (+1)' },
  { code: '+41', label: 'Switzerland (+41)' },
  { code: '+43', label: 'Austria (+43)' },
  { code: '+7', label: 'Russia (+7)' },
  { code: '+972', label: 'Israel (+972)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+86', label: 'China (+86)' },
];

export const DigitalReceiptModal: React.FC<DigitalReceiptModalProps> = ({
  transaction,
  onClose,
}) => {
  const settings = posDb.getSettings();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const primaryCode = settings.primaryCurrency || 'SCR';

  const [countryCode, setCountryCode] = useState(
    transaction.customerPhone?.startsWith('+') ? '' : '+248'
  );
  const [phoneNumber, setPhoneNumber] = useState(
    transaction.customerPhone
      ? transaction.customerPhone.replace(/^\+\d+\s*/, '')
      : ''
  );

  const [emailAddress, setEmailAddress] = useState(transaction.customerEmail || '');
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sendingEmailProgress, setSendingEmailProgress] = useState(false);

  // Digital Receipt Link
  const receiptUrl = `${window.location.origin}${window.location.pathname}?receipt=${transaction.receiptNumber}`;

  // Generate WhatsApp Message Text
  const generateWhatsAppMessage = () => {
    const itemsList = transaction.items
      .map(
        (item) =>
          `• ${Math.abs(item.quantity)}x ${item.name}${item.size ? ` (${item.size})` : ''} - ${primarySymbol} ${item.totalPrice.toFixed(2)}`
      )
      .join('\n');

    return (
      `🛍️ *${settings.storeName || 'My Boutique'} Digital Receipt*\n` +
      `----------------------------------------\n` +
      `Receipt #: *${transaction.receiptNumber}*\n` +
      `Date: ${new Date(transaction.timestamp).toLocaleDateString()} ${new Date(transaction.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n` +
      `Cashier: ${transaction.cashierName}\n\n` +
      `*Purchased Items:*\n${itemsList}\n\n` +
      `*Total Paid:* *${primarySymbol} ${transaction.total.toFixed(2)} ${primaryCode}*\n` +
      `----------------------------------------\n` +
      `🔗 *View Official Verified Tax Invoice & Receipt:* \n${receiptUrl}\n\n` +
      `Thank you for visiting ${settings.storeName}!`
    );
  };

  const handleSendWhatsApp = () => {
    const cleanNum = phoneNumber.replace(/\D/g, '');
    if (!cleanNum) return;

    const fullPhone = countryCode ? `${countryCode.replace('+', '')}${cleanNum}` : cleanNum;
    const msg = encodeURIComponent(generateWhatsAppMessage());
    const waUrl = `https://wa.me/${fullPhone}?text=${msg}`;

    window.open(waUrl, '_blank');
    setWhatsappSent(true);
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAddress) return;

    setSendingEmailProgress(true);

    // Prepare mailto link
    const subject = encodeURIComponent(
      `Digital Receipt ${transaction.receiptNumber} - ${resolveStoreName(settings)}`
    );
    const body = encodeURIComponent(
      `Dear ${transaction.customerName || 'Valued Customer'},\n\n` +
        `Thank you for shopping at ${settings.storeName || 'My Boutique'}.\n\n` +
        `TRANSACTION DETAILS:\n` +
        `Receipt Number: ${transaction.receiptNumber}\n` +
        `Date: ${new Date(transaction.timestamp).toLocaleString()}\n` +
        `Total Paid: ${primarySymbol} ${transaction.total.toFixed(2)} ${primaryCode}\n\n` +
        `ITEMS:\n` +
        transaction.items.map((i) => `- ${i.quantity}x ${i.name} (${primarySymbol} ${i.totalPrice.toFixed(2)})`).join('\n') +
        `\n\n` +
        `You can view and download your full digital VAT receipt at any time using the link below:\n` +
        `${receiptUrl}\n\n` +
        `Warm regards,\n` +
        `${settings.storeName || 'My Boutique'}`
    );

    setTimeout(() => {
      window.location.href = `mailto:${emailAddress}?subject=${subject}&body=${body}`;
      setSendingEmailProgress(false);
      setEmailSent(true);
    }, 400);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(receiptUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-lg w-full p-6 text-[#E2E8F0] shadow-2xl relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Send Instant Digital Receipt</h3>
              <p className="text-xs text-slate-400">Paperless receipt delivery via WhatsApp or Email</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-4 space-y-5">
          {/* Offline/Internet simulated connection warning */}
          {settings.enableInternetFeatures === false && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2 animate-pulse">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block text-amber-200">System Simulator is Offline</span>
                <span className="text-[10px] text-slate-400 block leading-relaxed">
                  WhatsApp and Email sending tools are disabled because the register is set to <strong>Offline Mode</strong> in the Admin Dashboard. To connect this applet to the web, toggle <strong>"Enable Active Internet & Cloud Services"</strong> under Store Settings.
                </span>
              </div>
            </div>
          )}

          {/* Summary Box */}
          <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 font-mono">Receipt #: </span>
              <span className="font-bold font-mono text-cyan-400">{transaction.receiptNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 font-mono">Total Paid: </span>
              <span className="font-bold font-mono text-emerald-400">
                {primarySymbol} {transaction.total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Option 1: WhatsApp Instant Send */}
          <div className="space-y-2 bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl">
            <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
              <span>💬 Instant WhatsApp Receipt</span>
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="bg-[#161B22] border border-[#1E293B] rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 w-32"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Mobile phone number"
                className="flex-1 bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
             </div>
            <button
              onClick={handleSendWhatsApp}
              disabled={!phoneNumber.trim() || settings.enableInternetFeatures === false}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{whatsappSent ? 'Resend WhatsApp Receipt' : 'Send via WhatsApp'}</span>
            </button>
          </div>

          {/* Option 2: Email Receipt Send */}
          <form onSubmit={handleSendEmail} className="space-y-2 bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl">
            <label className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider">
              <span>✉️ Email Digital Receipt</span>
            </label>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="tourist.email@example.com"
              className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              type="submit"
              disabled={!emailAddress.trim() || sendingEmailProgress || settings.enableInternetFeatures === false}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{emailSent ? 'Email Dispatched ✓' : 'Dispatch Email Receipt'}</span>
            </button>
          </form>

          {/* Option 3: Copy Direct Digital Link */}
          <div className="flex items-center justify-between bg-slate-800/40 p-3 rounded-xl border border-slate-700/60">
            <div className="truncate mr-2">
              <div className="text-[10px] uppercase text-slate-400 font-bold">Direct Web Link</div>
              <div className="text-xs font-mono text-cyan-300 truncate">{receiptUrl}</div>
            </div>
            <button
              onClick={handleCopyLink}
              className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 border border-slate-700"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-[#1E293B] flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
