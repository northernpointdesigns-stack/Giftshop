import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  Printer,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Sliders,
  DollarSign,
  Layers,
  Percent,
} from 'lucide-react';
import { InventoryItem, Vendor } from '../../types/pos';
import { posDb } from '../../services/db';
import { csvService } from '../../services/csvParser';
import { BarcodePrinterModal } from './BarcodePrinterModal';
import { CsvImportModal } from './CsvImportModal';
import { soundService } from '../../services/audio';

interface InventoryAdminProps {
  inventory: InventoryItem[];
  onRefresh: () => void;
}

export const InventoryAdmin: React.FC<InventoryAdminProps> = ({
  inventory,
  onRefresh,
}) => {
  const settings = posDb.getSettings();
  const vendors = posDb.getVendors();
  const primarySymbol = settings.primaryCurrencySymbol || 'SR';
  const secondarySymbol = settings.secondaryCurrencySymbol || '$';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [itemsToPrint, setItemsToPrint] = useState<InventoryItem[]>([]);

  // Form State
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: '',
    sku: '',
    barcode: '',
    category: 'Beverages',
    price: 0,
    costPrice: 0,
    secondaryPrice: 0,
    stockLevel: 10,
    reorderPoint: 5,
    taxRate: 15,
    isConsignment: false,
    vendorId: '',
    brand: '',
  });

  const categories = useMemo(() => {
    const s = new Set<string>();
    inventory.forEach((i) => s.add(i.category));
    return ['All', ...Array.from(s)];
  }, [inventory]);

  const filteredItems = useMemo(() => {
    return inventory.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.barcode.toLowerCase().includes(q) ||
          (item.brand && item.brand.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [inventory, selectedCategory, searchQuery]);

  const handleOpenCreate = () => {
    const generatedSku = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const generatedBarcode = `69012345${Math.floor(1000 + Math.random() * 9000)}4`;
    setFormData({
      name: '',
      sku: generatedSku,
      barcode: generatedBarcode,
      category: 'Beverages',
      price: 100,
      costPrice: 60,
      secondaryPrice: Number((100 / settings.exchangeRate).toFixed(2)),
      stockLevel: 25,
      reorderPoint: 5,
      taxRate: 15,
      isConsignment: false,
      vendorId: vendors[0]?.id || '',
      brand: 'Seychelles Local',
    });
    setEditingItem(null);
    setIsCreatingNew(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setFormData(item);
    setEditingItem(item);
    setIsCreatingNew(false);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku || !formData.barcode || formData.price === undefined) {
      return;
    }

    if (editingItem) {
      posDb.updateInventoryItem(editingItem.id, formData);
    } else {
      posDb.addInventoryItem(formData as Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>);
    }

    soundService.playSuccessChime();
    setEditingItem(null);
    setIsCreatingNew(false);
    onRefresh();
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm('Are you sure you want to delete this product from the catalog?')) {
      posDb.deleteInventoryItem(id);
      onRefresh();
    }
  };

  const handleExportCsv = () => {
    csvService.downloadInventoryCsv(inventory);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0D13] p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full space-y-5">
        {/* Header Title & Top Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Package className="w-6 h-6 text-emerald-400" />
              <span>Inventory & SKU Catalog Management</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Manage stock levels, VAT pricing, GS1 barcodes, consignment margins, and automated reorder points
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => {
                setItemsToPrint(filteredItems);
                setIsPrintModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print Shelf Labels</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-950/40"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-[#161B22] p-4 rounded-2xl border border-[#1E293B] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Name, SKU, Barcode, Brand..."
              className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#0F1115] text-slate-400 hover:text-white border border-[#1E293B]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Inventory Items Table */}
        <div className="bg-[#161B22] rounded-2xl border border-[#1E293B] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0F1115] text-slate-400 uppercase text-[10px] font-bold border-b border-[#1E293B]">
                <tr>
                  <th className="p-3.5">Product / Brand</th>
                  <th className="p-3.5">SKU & Barcode</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5 text-right">Cost Price</th>
                  <th className="p-3.5 text-right">Retail Price</th>
                  <th className="p-3.5 text-center">Stock Level</th>
                  <th className="p-3.5 text-center">Type</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {filteredItems.map((item) => {
                  const isLow = item.stockLevel <= item.reorderPoint;
                  const isOut = item.stockLevel <= 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Product Name */}
                      <td className="p-3.5">
                        <div className="font-bold text-white text-xs">{item.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.brand || '—'}</div>
                      </td>

                      {/* SKU & Barcode */}
                      <td className="p-3.5 font-mono">
                        <div className="text-cyan-400 font-bold">{item.sku}</div>
                        <div className="text-[10px] text-slate-500">{item.barcode}</div>
                      </td>

                      {/* Category */}
                      <td className="p-3.5">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg text-[11px]">
                          {item.category}
                        </span>
                      </td>

                      {/* Cost */}
                      <td className="p-3.5 text-right font-mono text-slate-400">
                        {primarySymbol} {item.costPrice.toFixed(2)}
                      </td>

                      {/* Retail Price */}
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-400">
                        {primarySymbol} {item.price.toFixed(2)}
                        {item.secondaryPrice && (
                          <div className="text-[10px] text-slate-500 font-normal">
                            ≈ {secondarySymbol} {item.secondaryPrice.toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* Stock Level */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            isOut
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : isLow
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {item.stockLevel} units {isLow && !isOut ? '(Low)' : ''}
                        </span>
                      </td>

                      {/* Type (Direct vs Consignment) */}
                      <td className="p-3.5 text-center">
                        {item.isConsignment ? (
                          <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            Consignment
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px] uppercase font-semibold">
                            Direct
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setItemsToPrint([item]);
                              setIsPrintModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Print barcode tag"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Delete product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit / Create Product Modal */}
        {(isCreatingNew || editingItem) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
            <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0 my-auto">
              <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">
                  {editingItem ? `Edit Product: ${editingItem.name}` : 'Create New Product SKU'}
                </h2>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setIsCreatingNew(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Product Title</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">SKU Code</label>
                    <input
                      type="text"
                      required
                      value={formData.sku || ''}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">GS1 Barcode</label>
                    <input
                      type="text"
                      required
                      value={formData.barcode || ''}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 font-mono text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Category</label>
                    <input
                      type="text"
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Brand / Producer</label>
                    <input
                      type="text"
                      value={formData.brand || ''}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Retail Price ({primarySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.price ?? 0}
                      onChange={(e) => {
                        const price = parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          price,
                          secondaryPrice: Number((price / settings.exchangeRate).toFixed(2)),
                        });
                      }}
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 font-mono font-bold text-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Cost Price ({primarySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.costPrice ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      USD Price ({secondarySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.secondaryPrice ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, secondaryPrice: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 font-mono text-cyan-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Stock On Hand</label>
                    <input
                      type="number"
                      value={formData.stockLevel ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, stockLevel: parseInt(e.target.value) || 0 })
                      }
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Reorder Threshold
                    </label>
                    <input
                      type="number"
                      value={formData.reorderPoint ?? 5}
                      onChange={(e) =>
                        setFormData({ ...formData, reorderPoint: parseInt(e.target.value) || 0 })
                      }
                      className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded-xl px-3 py-2 font-mono text-white"
                    />
                  </div>
                </div>

                {/* Consignment Settings */}
                <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B] space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isConsignmentCheck"
                      checked={formData.isConsignment || false}
                      onChange={(e) => setFormData({ ...formData, isConsignment: e.target.checked })}
                      className="w-4 h-4 accent-cyan-500 rounded"
                    />
                    <label htmlFor="isConsignmentCheck" className="text-xs text-white font-bold cursor-pointer">
                      Consignment Vendor Product (Split profit on sale)
                    </label>
                  </div>

                  {formData.isConsignment && (
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        Select Consignment Vendor
                      </label>
                      <select
                        value={formData.vendorId || ''}
                        onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                        className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-white"
                      >
                        <option value="">-- Choose Vendor --</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.commissionRate}% commission)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-[#1E293B]">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setIsCreatingNew(false);
                    }}
                    className="px-4 py-2 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md"
                  >
                    Save Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modals */}
        <BarcodePrinterModal
          items={itemsToPrint}
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
        />

        <CsvImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportComplete={onRefresh}
        />
      </div>
    </div>
  );
};
