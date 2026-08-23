import React, { useState } from 'react';
import {
  Users,
  X,
  Search,
  Plus,
  Sparkles,
  Phone,
  Mail,
  UserCheck,
  ShoppingBag,
  Award,
  Clock,
  History,
} from 'lucide-react';
import { Customer, Transaction } from '../../types/pos';
import { posDb } from '../../services/db';

interface CustomerLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (cust: Customer) => void;
}

export const CustomerLookupModal: React.FC<CustomerLookupModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCustForDetails, setSelectedCustForDetails] = useState<Customer | null>(null);

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');

  if (!isOpen) return null;

  const customers = posDb.searchCustomers(searchQuery);

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const created = posDb.addCustomer({
      name: newName.trim(),
      phone: newPhone.trim() || undefined,
      email: newEmail.trim() || undefined,
      notes: newNotes.trim() || undefined,
      loyaltyPoints: 50, // Welcome bonus points
      membershipTier: 'Bronze',
    });

    onSelectCustomer(created);
    onClose();
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'VIP':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'Gold':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Silver':
        return 'bg-slate-400/20 text-slate-300 border-slate-400/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  const pastOrders = selectedCustForDetails
    ? posDb.getCustomerTransactions(selectedCustForDetails.id)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 my-auto">
        {/* Header */}
        <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Customer & Loyalty Lookup</h2>
              <p className="text-xs text-slate-400">
                Attach customer to sale for loyalty point rewards and personalized receipt
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {!isCreating ? (
            <>
              {/* Search and Add Top Action */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Name, Phone (+248...), Email..."
                    className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Customer</span>
                </button>
              </div>

              {/* Customer List */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {customers.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 space-y-2">
                    <Users className="w-8 h-8 mx-auto text-slate-600" />
                    <p className="text-xs">No matching customers found</p>
                    <button
                      onClick={() => setIsCreating(true)}
                      className="text-xs text-emerald-400 font-bold hover:underline"
                    >
                      + Register customer with 50 bonus points
                    </button>
                  </div>
                ) : (
                  customers.map((c) => (
                    <div
                      key={c.id}
                      className="bg-[#0F1115] border border-[#1E293B] hover:border-emerald-500/50 p-3 rounded-xl flex items-center justify-between transition-all group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{c.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${getTierColor(
                              c.membershipTier
                            )}`}
                          >
                            {c.membershipTier}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500" /> {c.phone}
                            </span>
                          )}
                          {c.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-500" /> {c.email}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-2">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>{c.loyaltyPoints} Points</span>
                          <span className="text-slate-500">•</span>
                          <span>{c.visitCount} visits</span>
                          <span className="text-slate-500">•</span>
                          <span>Total Spend: SR {c.totalSpend.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCustForDetails(c)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
                        >
                          History
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectCustomer(c);
                            onClose();
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 group-hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Attach</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            /* Create Customer Form */
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>New customers automatically receive 50 loyalty points welcome bonus!</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Marcelle Dubois"
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+248 2 712 345"
                    className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="customer@domain.com"
                    className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Preferences / Notes
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Tourist, loves Takamaka rum and pearls"
                  className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
                >
                  Save & Attach Customer
                </button>
              </div>
            </form>
          )}

          {/* Past Orders Mini Popup */}
          {selectedCustForDetails && (
            <div className="mt-4 bg-[#0F1115] border border-cyan-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
                <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-300">
                  <History className="w-4 h-4" />
                  <span>Purchase History for {selectedCustForDetails.name}</span>
                </div>
                <button
                  onClick={() => setSelectedCustForDetails(null)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  Close
                </button>
              </div>

              {pastOrders.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">No past receipts recorded for this member yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {pastOrders.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-[#161B22] p-2 rounded-lg text-[11px] flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono text-cyan-400 font-bold">{tx.receiptNumber}</span>
                        <span className="text-slate-400 ml-2">
                          {new Date(tx.timestamp).toLocaleDateString()}
                        </span>
                        <p className="text-slate-500 truncate max-w-xs">
                          {tx.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                      </div>
                      <div className="font-mono font-bold text-emerald-400 text-xs">
                        SR {tx.total.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
