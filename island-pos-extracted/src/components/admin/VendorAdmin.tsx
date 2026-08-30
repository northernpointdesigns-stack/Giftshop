import React, { useState } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  DollarSign,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { Vendor, SupplierType } from '../../types/pos';
import { posDb } from '../../services/db';

interface VendorAdminProps {
  vendors: Vendor[];
  onRefreshData: () => void;
}

export const VendorAdmin: React.FC<VendorAdminProps> = ({
  vendors,
  onRefreshData,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    supplierType: 'consignment' as SupplierType,
    payoutTerms: 'Bi-weekly',
    consignmentCutRate: 0.30, // 30% House Cut -> 70% Vendor Payout
    notes: '',
  });

  const handleOpenAddModal = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      contactName: '',
      email: '',
      phone: '',
      supplierType: 'consignment',
      payoutTerms: 'Bi-weekly',
      consignmentCutRate: 0.30,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      contactName: vendor.contactName,
      email: vendor.email,
      phone: vendor.phone,
      supplierType: vendor.supplierType,
      payoutTerms: vendor.payoutTerms,
      consignmentCutRate: vendor.consignmentCutRate,
      notes: vendor.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveVendor = (e: React.FormEvent) => {
    e.preventDefault();

    posDb.saveVendor({
      ...(editingVendor ? { id: editingVendor.id } : {}),
      name: formData.name,
      contactName: formData.contactName,
      email: formData.email,
      phone: formData.phone,
      supplierType: formData.supplierType,
      payoutTerms: formData.payoutTerms,
      consignmentCutRate: Number(formData.consignmentCutRate),
      notes: formData.notes,
    });

    setIsModalOpen(false);
    onRefreshData();
  };

  const handleDeleteVendor = (id: string) => {
    if (confirm('Are you sure you want to remove this vendor profile?')) {
      posDb.deleteVendor(id);
      onRefreshData();
    }
  };

  // Calculate live consignment payout metrics per vendor
  const consignmentPayouts = posDb.calculateConsignmentPayouts();

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161B22] border border-[#1E293B] p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" /> Vendor Profiles & Payout Terms
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict Supplier Type distinction: Wholesale Owned vs Consignment Depositors
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Vendor</span>
        </button>
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {vendors.map((vendor) => {
          const isConsignment = vendor.supplierType === 'consignment';
          const payoutInfo = consignmentPayouts.find((p) => p.vendor.id === vendor.id);

          return (
            <div
              key={vendor.id}
              className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 flex flex-col justify-between shadow-md hover:border-slate-700 transition-all"
            >
              <div>
                {/* Header Badge */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      isConsignment
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                    }`}
                  >
                    {isConsignment ? 'Consignment / Deposit' : 'Wholesale Supplier'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(vendor)}
                      className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteVendor(vendor.id)}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-[#E2E8F0]">{vendor.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Contact: {vendor.contactName}</p>

                <div className="my-3 py-2 px-3 bg-[#0F1115] rounded-xl border border-[#1E293B] space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Email:</span>
                    <span className="text-slate-200">{vendor.email}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Phone:</span>
                    <span className="text-slate-200">{vendor.phone}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Payout Schedule:</span>
                    <span className="text-emerald-400 font-medium">{vendor.payoutTerms}</span>
                  </div>
                  {isConsignment && (
                    <div className="flex justify-between text-amber-300 font-medium pt-1 border-t border-[#1E293B]">
                      <span>Consignment Split:</span>
                      <span>
                        {((1 - vendor.consignmentCutRate) * 100).toFixed(0)}% Vendor /{' '}
                        {(vendor.consignmentCutRate * 100).toFixed(0)}% House
                      </span>
                    </div>
                  )}
                </div>

                {vendor.notes && (
                  <p className="text-[11px] text-slate-500 italic mb-3">"{vendor.notes}"</p>
                )}
              </div>

              {/* Financial Box */}
              {isConsignment && payoutInfo && (
                <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Pending Payout Owed</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      ${payoutInfo.vendorPayoutOwed.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Gross Sales (Units)</span>
                    <span className="font-mono text-slate-300">
                      ${payoutInfo.totalGrossSales.toFixed(2)} ({payoutInfo.totalUnitsSold} pcs)
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F1115]/80 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-lg w-full p-6 text-[#E2E8F0] shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
              <h3 className="text-lg font-bold text-[#E2E8F0]">
                {editingVendor ? 'Edit Vendor Profile' : 'Add Vendor Profile'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="space-y-3 my-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Vendor / Business Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Alan's Handcrafted Soap & Botanicals"
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="e.g. Alan Miller"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(808) 555-0142"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="alan@islandbotanicals.com"
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Strict Supplier Type Toggle */}
              <div className="p-3 bg-[#0F1115] rounded-xl border border-[#1E293B] space-y-2">
                <label className="block text-xs font-bold text-[#E2E8F0]">
                  Supplier Agreement Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, supplierType: 'consignment' })}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                      formData.supplierType === 'consignment'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-[#161B22] border-[#1E293B] text-slate-400'
                    }`}
                  >
                    Consignment / Deposit
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, supplierType: 'wholesale' })}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                      formData.supplierType === 'wholesale'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                        : 'bg-[#161B22] border-[#1E293B] text-slate-400'
                    }`}
                  >
                    Wholesale Owned
                  </button>
                </div>

                {formData.supplierType === 'consignment' && (
                  <div className="pt-2 space-y-2">
                    <label className="block text-xs font-medium text-slate-300">
                      House Retention Commission Rate (e.g., 0.30 = 30% House, 70% Vendor Payout)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="0.9"
                        value={formData.consignmentCutRate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            consignmentCutRate: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-28 bg-[#161B22] border border-[#1E293B] rounded px-2 py-1 text-xs text-amber-300 font-mono"
                      />
                      <span className="text-xs text-slate-400">
                        = Vendor Receives {((1 - formData.consignmentCutRate) * 100).toFixed(0)}% of
                        every sale
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Payout Terms
                  </label>
                  <select
                    value={formData.payoutTerms}
                    onChange={(e) => setFormData({ ...formData, payoutTerms: e.target.value })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Immediate">Immediate / On Sale</option>
                    <option value="Bi-weekly">Bi-weekly</option>
                    <option value="Monthly">Monthly End-of-Month</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Vendor Notes
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Local artisan soap supplier"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
