import React, { useState } from 'react';
import {
  X,
  Search,
  UserCheck,
  Award,
  ShoppingBag,
  RotateCcw,
  PlusCircle,
  Phone,
  Mail,
  Calendar,
  Sparkles,
  TrendingUp,
  Tag,
  FileText,
  UserPlus,
  Edit2,
  CheckCircle2,
  ArrowRight,
  Heart,
  ChevronRight,
} from 'lucide-react';
import { Customer, InventoryItem, Transaction } from '../../types/pos';
import { posDb } from '../../services/db';

interface CustomerLookupModalProps {
  inventory: InventoryItem[];
  onClose: () => void;
  onSelectCustomerForCart?: (customer: Customer) => void;
  onAddToCartItem?: (item: InventoryItem) => void;
  onProcessRefundForReceipt?: (receiptNumber: string) => void;
}

export const CustomerLookupModal: React.FC<CustomerLookupModalProps> = ({
  inventory,
  onClose,
  onSelectCustomerForCart,
  onAddToCartItem,
  onProcessRefundForReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<'ALL' | 'VIP' | 'Gold' | 'Silver' | 'Bronze'>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeCustomerTab, setActiveCustomerTab] = useState<'purchases' | 'receipts' | 'edit'>('purchases');
  
  // Registration Form state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regNotes, setRegNotes] = useState('');
  const [regTier, setRegTier] = useState<Customer['membershipTier']>('Bronze');
  const [toastMsg, setToastMsg] = useState('');

  // Load Customers
  const [customersList, setCustomersList] = useState<Customer[]>(() => posDb.getCustomers());

  const refreshCustomers = () => {
    setCustomersList(posDb.getCustomers());
  };

  // Filter Customers
  const filteredCustomers = customersList.filter((c) => {
    const matchesTier = selectedTierFilter === 'ALL' || c.membershipTier === selectedTierFilter;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesTier;

    const matchesName = c.name.toLowerCase().includes(q);
    const matchesPhone = c.phone.toLowerCase().includes(q);
    const matchesEmail = c.email?.toLowerCase().includes(q) || false;
    const matchesId = c.id.toLowerCase().includes(q);

    // Also check if search query matches any item in customer's purchase history!
    const txs = posDb.getCustomerTransactions(c.id);
    const matchesPurchasedItem = txs.some((tx) =>
      tx.items.some(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.sku.toLowerCase().includes(q) ||
          (it.brand && it.brand.toLowerCase().includes(q)) ||
          tx.receiptNumber.toLowerCase().includes(q)
      )
    );

    return matchesTier && (matchesName || matchesPhone || matchesEmail || matchesId || matchesPurchasedItem);
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regPhone.trim()) {
      alert('Please provide at least Customer Name and Phone Number.');
      return;
    }

    const created = posDb.saveCustomer({
      name: regName.trim(),
      phone: regPhone.trim(),
      email: regEmail.trim(),
      notes: regNotes.trim(),
      membershipTier: regTier,
    });

    refreshCustomers();
    setIsRegistering(false);
    setSelectedCustomer(created);
    setToastMsg(`Customer profile "${created.name}" created successfully!`);
    setTimeout(() => setToastMsg(''), 3500);

    // Reset form
    setRegName('');
    setRegPhone('');
    setRegEmail('');
    setRegNotes('');
    setRegTier('Bronze');
  };

  const handleUpdateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const updated = posDb.saveCustomer({
      id: selectedCustomer.id,
      name: selectedCustomer.name,
      phone: selectedCustomer.phone,
      email: selectedCustomer.email,
      notes: selectedCustomer.notes,
      membershipTier: selectedCustomer.membershipTier,
    });

    setSelectedCustomer(updated);
    refreshCustomers();
    setToastMsg(`Updated customer profile for "${updated.name}"`);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Customer Insights & Purchases
  const currentInsights = selectedCustomer
    ? posDb.getCustomerLoyaltyInsights(selectedCustomer.id)
    : null;
  const currentPurchases = selectedCustomer
    ? posDb.getCustomerPurchasedItems(selectedCustomer.id)
    : [];
  const currentReceipts = selectedCustomer
    ? posDb.getCustomerTransactions(selectedCustomer.id)
    : [];

  const getTierColor = (tier: Customer['membershipTier']) => {
    switch (tier) {
      case 'VIP':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'Gold':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Silver':
        return 'bg-slate-400/20 text-slate-200 border-slate-400/40';
      case 'Bronze':
      default:
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-5xl w-full h-[90vh] flex flex-col text-[#E2E8F0] shadow-2xl relative overflow-hidden">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-[#1E293B] flex items-center justify-between bg-[#111318] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
                Customer Directory & Purchase History Lookup
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  {customersList.length} Active Profiles
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Search past customer purchases, loyalty tiers, re-order history & process returns
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!selectedCustomer && !isRegistering && (
              <button
                type="button"
                onClick={() => setIsRegistering(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">New Customer</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {toastMsg && (
          <div className="bg-emerald-950/90 border-b border-emerald-600/50 px-4 py-2.5 text-xs text-emerald-300 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toastMsg}</span>
            </div>
            <button onClick={() => setToastMsg('')} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body Container */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

          {/* ========================================================================= */}
          {/* VIEW MODE 1: REGISTER NEW CUSTOMER FORM */}
          {/* ========================================================================= */}
          {isRegistering ? (
            <div className="flex-1 p-6 overflow-y-auto max-w-2xl mx-auto w-full">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#1E293B]">
                <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-400" /> Create New Customer Loyalty Profile
                </h3>
                <button
                  onClick={() => setIsRegistering(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ← Back to Directory
                </button>
              </div>

              <form onSubmit={handleCreateCustomer} className="space-y-4 bg-[#0F1115] p-5 rounded-2xl border border-[#1E293B]">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Customer Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Annette Dupuis"
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Phone Number <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="e.g. +248 2 514 820"
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="annette@seychelles.sc"
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Initial Loyalty Membership Tier
                  </label>
                  <select
                    value={regTier}
                    onChange={(e) => setRegTier(e.target.value as Customer['membershipTier'])}
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Bronze">Bronze Member (Entry level)</option>
                    <option value="Silver">Silver Member (100+ points)</option>
                    <option value="Gold">Gold Member (250+ points)</option>
                    <option value="VIP">VIP Platinum Member (500+ points)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Customer Preferences / Notes
                  </label>
                  <textarea
                    rows={3}
                    value={regNotes}
                    onChange={(e) => setRegNotes(e.target.value)}
                    placeholder="e.g. Prefers Ocean Seychelles T-shirts, local artisan crafts..."
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Save Customer Profile
                  </button>
                </div>
              </form>
            </div>
          ) : selectedCustomer ? (
            /* ========================================================================= */
            /* VIEW MODE 2: SELECTED CUSTOMER PROFILE & TRANSACTION HISTORY */
            /* ========================================================================= */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Selected Customer Header Banner */}
              <div className="p-4 bg-[#0F1115] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="bg-[#161B22] hover:bg-slate-800 text-slate-300 border border-[#1E293B] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                  >
                    ← Back
                  </button>

                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-emerald-400 text-base">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{selectedCustomer.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getTierColor(selectedCustomer.membershipTier)}`}>
                        {selectedCustomer.membershipTier} Member
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-emerald-400" /> {selectedCustomer.phone}
                      </span>
                      {selectedCustomer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-cyan-400" /> {selectedCustomer.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-right">
                    <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Loyalty Points</div>
                    <div className="text-sm font-black text-emerald-300 font-mono flex items-center justify-end gap-1">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      {selectedCustomer.loyaltyPoints} pts
                    </div>
                  </div>

                  {onSelectCustomerForCart && (
                    <button
                      onClick={() => {
                        onSelectCustomerForCart(selectedCustomer);
                        onClose();
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Attach to Active Cart</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Loyalty Insights Highlights */}
              <div className="p-4 bg-[#111318] border-b border-[#1E293B] grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" /> Lifetime Spend
                  </div>
                  <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
                    ${currentInsights?.totalSpend.toFixed(2)}
                  </div>
                </div>

                <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3 text-cyan-400" /> Total Visits
                  </div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {currentInsights?.totalOrders} Purchases
                  </div>
                </div>

                <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Top Brand
                  </div>
                  <div className="text-xs font-bold text-amber-300 truncate mt-1">
                    {currentInsights?.topBrand}
                  </div>
                </div>

                <div className="bg-[#161B22] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                    <Tag className="w-3 h-3 text-purple-400" /> Top Category
                  </div>
                  <div className="text-xs font-bold text-purple-300 truncate mt-1">
                    {currentInsights?.topCategory}
                  </div>
                </div>
              </div>

              {/* Profile Sub Tabs */}
              <div className="flex border-b border-[#1E293B] bg-[#161B22] px-4 shrink-0">
                <button
                  onClick={() => setActiveCustomerTab('purchases')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeCustomerTab === 'purchases'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Purchased Items History ({currentPurchases.length})</span>
                </button>

                <button
                  onClick={() => setActiveCustomerTab('receipts')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeCustomerTab === 'receipts'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Sales Receipts ({currentReceipts.length})</span>
                </button>

                <button
                  onClick={() => setActiveCustomerTab('edit')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeCustomerTab === 'edit'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit Profile & Notes</span>
                </button>
              </div>

              {/* Sub-Tab Content Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* SUB TAB 1: PURCHASED ITEMS HISTORY */}
                {activeCustomerTab === 'purchases' && (
                  <div className="space-y-3">
                    {currentPurchases.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 space-y-2">
                        <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="text-sm font-semibold">No purchase history found for this customer.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-[#1E293B] bg-[#0F1115]">
                        <table className="w-full text-left text-xs text-[#E2E8F0]">
                          <thead className="bg-[#161B22] text-slate-400 uppercase text-[10px] font-bold border-b border-[#1E293B]">
                            <tr>
                              <th className="p-3">Purchase Date</th>
                              <th className="p-3">Receipt #</th>
                              <th className="p-3">Item Description</th>
                              <th className="p-3">Brand & Category</th>
                              <th className="p-3 text-center">Qty</th>
                              <th className="p-3 text-right">Price Paid</th>
                              <th className="p-3 text-right">Quick Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1E293B]">
                            {currentPurchases.map((p, idx) => {
                              const matchingStockItem = inventory.find((i) => i.id === p.itemId || i.sku === p.sku);
                              return (
                                <tr key={idx} className="hover:bg-[#161B22]/60 transition-colors">
                                  <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                    {new Date(p.timestamp).toLocaleDateString()}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-cyan-400 whitespace-nowrap">
                                    {p.receiptNumber}
                                  </td>
                                  <td className="p-3">
                                    <div className="font-bold text-white">{p.name}</div>
                                    <div className="text-[10px] text-slate-500 font-mono">SKU: {p.sku}</div>
                                  </td>
                                  <td className="p-3">
                                    <span className="text-slate-300 font-semibold">{p.brand || 'Seychelles'}</span>
                                    <div className="text-[10px] text-slate-400">{p.category}</div>
                                  </td>
                                  <td className="p-3 text-center font-bold">{p.quantity}</td>
                                  <td className="p-3 text-right font-mono font-bold text-emerald-400">
                                    ${p.totalPrice.toFixed(2)}
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {/* Re-Order Button */}
                                      {matchingStockItem && onAddToCartItem && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onAddToCartItem(matchingStockItem);
                                            setToastMsg(`Added "${matchingStockItem.name}" to cart!`);
                                            setTimeout(() => setToastMsg(''), 2500);
                                          }}
                                          className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                                          title="Add item to current active register cart"
                                        >
                                          <PlusCircle className="w-3.5 h-3.5" /> Re-Order
                                        </button>
                                      )}

                                      {/* Process Return Button */}
                                      {onProcessRefundForReceipt && !p.isRefund && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onProcessRefundForReceipt(p.receiptNumber);
                                            onClose();
                                          }}
                                          className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                                          title="Process Return/Refund for this receipt"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" /> Return
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* SUB TAB 2: FULL SALES RECEIPTS */}
                {activeCustomerTab === 'receipts' && (
                  <div className="space-y-3">
                    {currentReceipts.map((tx) => (
                      <div key={tx.id} className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1E293B]">
                          <div>
                            <span className="font-mono font-bold text-cyan-400 text-xs">{tx.receiptNumber}</span>
                            <div className="text-[11px] text-slate-400">
                              {new Date(tx.timestamp).toLocaleString()} • Cashier: {tx.cashierName}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-emerald-400 text-sm">${tx.total.toFixed(2)}</div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">{tx.paymentMethod}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {tx.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-slate-300">
                              <span>
                                {it.quantity}x {it.name} <span className="text-slate-500">({it.sku})</span>
                              </span>
                              <span className="font-mono">${it.totalPrice.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {onProcessRefundForReceipt && !tx.isRefund && (
                          <div className="pt-2 flex justify-end border-t border-[#1E293B]">
                            <button
                              type="button"
                              onClick={() => {
                                onProcessRefundForReceipt(tx.receiptNumber);
                                onClose();
                              }}
                              className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Process Refund for Receipt
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* SUB TAB 3: EDIT PROFILE */}
                {activeCustomerTab === 'edit' && (
                  <form onSubmit={handleUpdateCustomer} className="bg-[#0F1115] p-5 rounded-xl border border-[#1E293B] space-y-4 max-w-xl">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={selectedCustomer.phone}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, phone: e.target.value })}
                        className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-[#E2E8F0]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={selectedCustomer.email || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })}
                        className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Membership Tier
                      </label>
                      <select
                        value={selectedCustomer.membershipTier}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, membershipTier: e.target.value as Customer['membershipTier'] })}
                        className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0]"
                      >
                        <option value="Bronze">Bronze Member</option>
                        <option value="Silver">Silver Member</option>
                        <option value="Gold">Gold Member</option>
                        <option value="VIP">VIP Platinum Member</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Customer Notes & Preferences
                      </label>
                      <textarea
                        rows={3}
                        value={selectedCustomer.notes || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, notes: e.target.value })}
                        className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0]"
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md"
                      >
                        Save Profile Updates
                      </button>
                    </div>
                  </form>
                )}

              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* VIEW MODE 3: CUSTOMER DIRECTORY LIST & SEARCH */
            /* ========================================================================= */
            <div className="flex-1 flex flex-col h-full overflow-hidden p-4 sm:p-5 space-y-4">
              
              {/* Search & Tier Filters Header Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Name, Phone, Email, Loyalty ID, or Past Purchased Item/SKU..."
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#E2E8F0] placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Tier Filters */}
                <div className="flex items-center gap-1 bg-[#0F1115] p-1 rounded-xl border border-[#1E293B] overflow-x-auto shrink-0">
                  {(['ALL', 'VIP', 'Gold', 'Silver', 'Bronze'] as const).map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setSelectedTierFilter(tier)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        selectedTierFilter === tier
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      {tier === 'ALL' ? 'All Members' : `${tier}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Cards Grid */}
              <div className="flex-1 overflow-y-auto pr-1">
                {filteredCustomers.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-3">
                    <UserCheck className="w-10 h-10 text-slate-600 mx-auto" />
                    <div>
                      <p className="text-sm font-semibold">No customer profiles match your search filter.</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Try searching with a different name, phone number, or register a new customer profile.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsRegistering(true)}
                      className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <UserPlus className="w-4 h-4" /> Register New Customer
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredCustomers.map((cust) => {
                      const insights = posDb.getCustomerLoyaltyInsights(cust.id);
                      return (
                        <div
                          key={cust.id}
                          className="bg-[#0F1115] hover:bg-[#161B22] border border-[#1E293B] hover:border-emerald-500/40 rounded-xl p-4 transition-all flex flex-col justify-between space-y-3 shadow-md group"
                        >
                          <div>
                            {/* Card Top Row */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <h3 className="font-bold text-white text-sm group-hover:text-emerald-300 transition-colors">
                                  {cust.name}
                                </h3>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-emerald-400" /> {cust.phone}
                                </div>
                              </div>

                              <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border uppercase ${getTierColor(cust.membershipTier)}`}>
                                {cust.membershipTier}
                              </span>
                            </div>

                            {/* Loyalty & Spend Stats */}
                            <div className="grid grid-cols-2 gap-2 bg-[#161B22] p-2.5 rounded-lg border border-[#1E293B] my-2 text-xs">
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Points</span>
                                <span className="font-mono font-bold text-amber-300 flex items-center gap-1">
                                  <Award className="w-3 h-3 text-amber-400" />
                                  {cust.loyaltyPoints} pts
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Lifetime Spend</span>
                                <span className="font-mono font-bold text-emerald-400">
                                  ${insights.totalSpend.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {cust.notes && (
                              <p className="text-[11px] text-slate-400 italic line-clamp-2 mt-1">
                                "{cust.notes}"
                              </p>
                            )}
                          </div>

                          {/* Card Footer Actions */}
                          <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between gap-2">
                            {onSelectCustomerForCart && (
                              <button
                                onClick={() => {
                                  onSelectCustomerForCart(cust);
                                  onClose();
                                }}
                                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                                title="Attach customer to active sale"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> Attach
                              </button>
                            )}

                            <button
                              onClick={() => setSelectedCustomer(cust)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ml-auto transition-all"
                            >
                              <span>Purchases</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
