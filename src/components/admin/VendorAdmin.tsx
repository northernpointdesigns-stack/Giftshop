import React, { useState } from 'react';
import { Users2, Plus, Edit2, Trash2, Phone, Mail, Percent, DollarSign, CheckCircle2 } from 'lucide-react';
import { Vendor } from '../../types/pos';
import { posDb } from '../../services/db';

interface VendorAdminProps {
  vendors: Vendor[];
  onRefresh: () => void;
}

export const VendorAdmin: React.FC<VendorAdminProps> = ({
  vendors,
  onRefresh,
}) => {
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formData, setFormData] = useState<Partial<Vendor>>({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    commissionRate: 15,
    paymentTerms: 'Net 30 Days',
    totalOwed: 0,
    totalPaid: 0,
  });

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      commissionRate: 15,
      paymentTerms: 'Bi-Weekly Friday',
      totalOwed: 0,
      totalPaid: 0,
    });
    setEditingVendor(null);
    setIsCreating(true);
  };

  const handleOpenEdit = (v: Vendor) => {
    setFormData(v);
    setEditingVendor(v);
    setIsCreating(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingVendor) {
      posDb.updateVendor(editingVendor.id, formData);
    } else {
      posDb.addVendor(formData as Omit<Vendor, 'id' | 'createdAt'>);
    }

    setEditingVendor(null);
    setIsCreating(false);
    onRefresh();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to remove this consignment partner?')) {
      posDb.deleteVendor(id);
      onRefresh();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0D13] p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Users2 className="w-6 h-6 text-cyan-400" />
              <span>Consignment Vendors & Artisans</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Manage local Seychellois artisan partnerships, contract commission rates, and supplier balances
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Add Consignment Partner</span>
          </button>
        </div>

        {/* Vendors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((vendor) => (
            <div
              key={vendor.id}
              className="bg-[#161B22] border border-[#1E293B] hover:border-cyan-500/40 rounded-2xl p-5 space-y-4 transition-all shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-white">{vendor.name}</h3>
                  <span className="text-xs text-slate-400">Contact: {vendor.contactPerson}</span>
                </div>
                <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-bold font-mono px-2 py-0.5 rounded-lg">
                  {vendor.commissionRate}% Fee
                </span>
              </div>

              <div className="space-y-1 text-xs text-slate-400">
                {vendor.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>{vendor.phone}</span>
                  </div>
                )}
                {vendor.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>{vendor.email}</span>
                  </div>
                )}
                <div className="text-[11px] text-slate-500 mt-1">Terms: {vendor.paymentTerms}</div>
              </div>

              <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B] flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Pending Payout</span>
                  <span className="text-amber-400 font-bold text-sm">
                    SR {(vendor.totalOwed ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase block">Historical Paid</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    SR {(vendor.totalPaid ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1E293B]">
                <button
                  onClick={() => handleOpenEdit(vendor)}
                  className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(vendor.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Form */}
        {(isCreating || editingVendor) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
            <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 my-auto">
              <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">
                  {editingVendor ? `Edit Partner: ${editingVendor.name}` : 'New Consignment Partner'}
                </h2>
                <button
                  onClick={() => {
                    setEditingVendor(null);
                    setIsCreating(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Company / Artisan Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-cyan-500 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={formData.contactPerson || ''}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-cyan-500 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Store Commission (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.commissionRate ?? 15}
                      onChange={(e) =>
                        setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-cyan-500 rounded-xl px-3 py-2 font-mono text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-cyan-500 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-cyan-500 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Payout Terms</label>
                  <input
                    type="text"
                    value={formData.paymentTerms || ''}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-cyan-500 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-[#1E293B]">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVendor(null);
                      setIsCreating(false);
                    }}
                    className="px-4 py-2 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-md"
                  >
                    Save Partner
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
