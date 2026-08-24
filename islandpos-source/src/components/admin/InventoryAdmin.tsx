import React, { useState } from 'react';
import {
  Plus,
  Search,
  Package,
  Edit2,
  Trash2,
  AlertTriangle,
  Printer,
  X,
  CheckCircle2,
  FileSpreadsheet,
  Barcode as BarcodeIcon,
  Sparkles,
  Tag,
} from 'lucide-react';
import { InventoryItem, Vendor } from '../../types/pos';
import { posDb } from '../../services/db';
import { BarcodePrinterModal } from './BarcodePrinterModal';
import { CsvImportModal } from './CsvImportModal';
import { generateGS1GTIN13, validateGS1GTIN } from '../../utils/gs1Barcode';

interface InventoryAdminProps {
  inventory: InventoryItem[];
  vendors: Vendor[];
  onRefreshData: () => void;
}

export const InventoryAdmin: React.FC<InventoryAdminProps> = ({
  inventory,
  vendors,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('All');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('All');

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isPrinterOpen, setIsPrinterOpen] = useState(false);
  const [printerInitialItemId, setPrinterInitialItemId] = useState<string | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    brand: 'Ocean Seychelles',
    category: 'T-Shirts',
    productLine: 'Beach Heritage',
    size: 'Adults - Medium',
    variant: 'Turtle Cove',
    sku: '',
    stockLevel: 15,
    minStockThreshold: 5,
    retailPrice: 25.0,
    costBasis: 12.5,
    vatRate: 0.15,
    vendorId: vendors[0]?.id || '',
    imageUrl: '',
  });

  const categories = ['All', ...Array.from(new Set(inventory.map((i) => i.category)))];
  const brands = [
    'All',
    ...Array.from(new Set(inventory.map((i) => i.brand || 'Ocean Seychelles'))),
  ];

  const handleOpenAddModal = () => {
    setEditingItem(null);
    const initialGtin = generateGS1GTIN13('950');
    setFormData({
      name: '',
      brand: 'Ocean Seychelles',
      category: 'T-Shirts',
      productLine: 'Beach Heritage',
      size: 'Adults - Medium',
      variant: '',
      sku: initialGtin,
      stockLevel: 20,
      minStockThreshold: 5,
      retailPrice: 25.0,
      costBasis: 12.5,
      vatRate: 0.15,
      vendorId: vendors[0]?.id || '',
      imageUrl: '',
    });
    setIsItemModalOpen(true);
  };

  const handleGenerateGs1Sku = () => {
    const newGtin = generateGS1GTIN13('950');
    setFormData((prev) => ({ ...prev, sku: newGtin }));
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      brand: item.brand || 'Ocean Seychelles',
      category: item.category,
      productLine: item.productLine || 'Normal Line',
      size: item.size || 'One Size',
      variant: item.variant || '',
      sku: item.sku,
      stockLevel: item.stockLevel,
      minStockThreshold: item.minStockThreshold,
      retailPrice: item.retailPrice,
      costBasis: item.costBasis,
      vatRate: item.vatRate ?? 0.15,
      vendorId: item.vendorId,
      imageUrl: item.imageUrl || '',
    });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = (e?: React.FormEvent, shouldPrint: boolean = false) => {
    if (e) e.preventDefault();

    const savedItem = posDb.saveItem({
      ...(editingItem ? { id: editingItem.id } : {}),
      name: formData.name,
      brand: formData.brand,
      category: formData.category,
      productLine: formData.productLine,
      size: formData.size,
      variant: formData.variant,
      sku: formData.sku,
      stockLevel: Number(formData.stockLevel),
      minStockThreshold: Number(formData.minStockThreshold),
      retailPrice: Number(formData.retailPrice),
      costBasis: Number(formData.costBasis),
      vatRate: Number(formData.vatRate),
      taxable: true,
      vendorId: formData.vendorId,
      imageUrl: formData.imageUrl || undefined,
    });

    setIsItemModalOpen(false);
    onRefreshData();

    if (shouldPrint && savedItem) {
      setPrinterInitialItemId(savedItem.id);
      setIsPrinterOpen(true);
    }
  };

  const handleOpenPrinterForSingleItem = (itemId: string) => {
    setPrinterInitialItemId(itemId);
    setIsPrinterOpen(true);
  };

  const handleOpenPrinterAll = () => {
    setPrinterInitialItemId(undefined);
    setIsPrinterOpen(true);
  };

  const handleDeleteItem = (id: string) => {
    if (confirm('Are you sure you want to delete this inventory item?')) {
      posDb.deleteItem(id);
      onRefreshData();
    }
  };

  const currentSelectedVendor = vendors.find((v) => v.id === formData.vendorId);
  const isSelectedVendorConsignment = currentSelectedVendor?.supplierType === 'consignment';

  const computedConsignmentVendorCut = isSelectedVendorConsignment && currentSelectedVendor
    ? Number((formData.retailPrice * (1 - currentSelectedVendor.consignmentCutRate)).toFixed(2))
    : formData.costBasis;

  const skuValidation = validateGS1GTIN(formData.sku);

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesBrand = selectedBrandFilter === 'All' || (item.brand || 'Ocean Seychelles') === selectedBrandFilter;
    const matchesVendor =
      selectedVendorFilter === 'All' || item.vendorId === selectedVendorFilter;
    return matchesSearch && matchesCategory && matchesBrand && matchesVendor;
  });

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161B22] border border-[#1E293B] p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" /> Catalog & Inventory Manager
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage Ocean Seychelles, Souvenir Boutique direct stock, and GS1 GTIN barcode labeling
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleOpenPrinterAll}
            className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-xs"
          >
            <BarcodeIcon className="w-4 h-4 text-cyan-400" />
            <span>GS1 Barcode Printer</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Item</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by brand, item name, barcode, design..."
            className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl pl-9 pr-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={selectedBrandFilter}
            onChange={(e) => setSelectedBrandFilter(e.target.value)}
            className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All Brands (Ocean Seychelles, Boutique, Artisan)</option>
            {brands.filter((b) => b !== 'All').map((b) => (
              <option key={b} value={b}>
                Brand: {b}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                Group: {c}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={selectedVendorFilter}
            onChange={(e) => setSelectedVendorFilter(e.target.value)}
            className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All Suppliers / Vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.supplierType === 'consignment' ? 'Deposit' : 'Wholesale'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0F1115] text-slate-400 font-semibold border-b border-[#1E293B] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Brand & Item Name</th>
                <th className="p-3.5">Group Category</th>
                <th className="p-3.5">Product Line / Size</th>
                <th className="p-3.5 text-right">Retail Price</th>
                <th className="p-3.5 text-center">VAT %</th>
                <th className="p-3.5 text-right">Cost Basis</th>
                <th className="p-3.5 text-center">Stock Level</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    No matching inventory items found.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const vendor = posDb.getVendorById(item.vendorId);
                  const isConsignment = vendor?.supplierType === 'consignment';
                  const isLowStock = item.stockLevel <= item.minStockThreshold;
                  const isGs1Gtin = validateGS1GTIN(item.sku).isValid;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded">
                            {item.brand || 'Ocean Seychelles'}
                          </span>
                          <span className="font-semibold text-[#E2E8F0]">
                            {item.name}
                          </span>
                          {isLowStock && (
                            <span
                              className="text-amber-400 flex items-center gap-1 text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20"
                              title="Below minimum stock threshold"
                            >
                              <AlertTriangle className="w-3 h-3" /> Low
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span>SKU: {item.sku}</span>
                          {isGs1Gtin && (
                            <span className="text-[9px] font-sans font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20">
                              GS1 GTIN-13
                            </span>
                          )}
                          {item.variant ? <span>• Design: {item.variant}</span> : null}
                        </div>
                      </td>

                      <td className="p-3.5 font-medium text-slate-300">
                        {item.category}
                      </td>

                      <td className="p-3.5 text-slate-400 text-[11px]">
                        <div>{item.productLine || 'Standard Line'}</div>
                        <div className="text-slate-500 text-[10px] font-mono">{item.size || 'One Size'}</div>
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-[#E2E8F0]">
                        ${item.retailPrice.toFixed(2)}
                      </td>

                      <td className="p-3.5 text-center font-mono font-bold text-cyan-400">
                        {((item.vatRate ?? 0.15) * 100).toFixed(0)}%
                      </td>

                      <td className="p-3.5 text-right font-mono text-slate-400">
                        ${item.costBasis.toFixed(2)}
                        {isConsignment && (
                          <span className="block text-[9px] text-amber-400">
                            (Vendor Cut)
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <span
                          className={`font-mono font-bold px-2 py-1 rounded text-xs ${
                            item.stockLevel === 0
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : isLowStock
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                              : 'bg-[#0F1115] text-emerald-400 border border-[#1E293B]'
                          }`}
                        >
                          {item.stockLevel} units
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenPrinterForSingleItem(item.id)}
                            className="p-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/50 rounded transition-colors border border-cyan-800/30"
                            title="Print GS1 Barcode Label"
                          >
                            <BarcodeIcon className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                            title="Edit Item"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                            title="Delete Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Item Modal with Immediate GS1 Barcode Generator */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-lg w-full p-6 text-[#E2E8F0] shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-[#E2E8F0]">
                  {editingItem ? 'Edit Item Details' : 'Add New Inventory Item'}
                </h3>
              </div>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleSaveItem(e, false)} className="space-y-3 my-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Item Description / Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ocean Seychelles T-Shirt - Turtle Cove (Adult M)"
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. Ocean Seychelles, Souvenir Boutique"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Group Category
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. T-Shirts, Mugs, Bags, Pareos"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Product Line
                  </label>
                  <input
                    type="text"
                    value={formData.productLine}
                    onChange={(e) => setFormData({ ...formData, productLine: e.target.value })}
                    placeholder="e.g. Luxury Line, Normal Line"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Size / Target Fit
                  </label>
                  <input
                    type="text"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    placeholder="e.g. Kids L, Adults M, Women S"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Barcode SKU & GS1 Generator Field */}
              <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <BarcodeIcon className="w-3.5 h-3.5 text-emerald-400" /> GS1 Barcode SKU ID
                  </label>

                  <button
                    type="button"
                    onClick={handleGenerateGs1Sku}
                    className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-bold transition-all flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Auto GS1 GTIN-13</span>
                  </button>
                </div>

                <input
                  type="text"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="e.g. 9501234567890 (GS1 GTIN-13 standard)"
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />

                {/* Live GS1 Validation Badge */}
                <div className="flex items-center justify-between text-[10px]">
                  {skuValidation.isValid ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      GS1 GTIN Compliant ({skuValidation.format}) - Modulo 10 OK
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">
                      Custom Code128 SKU (Scanner Compatible)
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    VAT Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    required
                    value={formData.vatRate * 100}
                    onChange={(e) => setFormData({ ...formData, vatRate: (parseFloat(e.target.value) || 0) / 100 })}
                    placeholder="15"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs font-mono font-bold text-cyan-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Vendor / Supplier Profile
                  </label>
                  <select
                    value={formData.vendorId}
                    onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.supplierType === 'consignment' ? 'Deposit' : 'Wholesale'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Retail Selling Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.retailPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, retailPrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cost Basis ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={isSelectedVendorConsignment}
                    value={
                      isSelectedVendorConsignment
                        ? computedConsignmentVendorCut
                        : formData.costBasis
                    }
                    onChange={(e) =>
                      setFormData({ ...formData, costBasis: parseFloat(e.target.value) || 0 })
                    }
                    className={`w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none ${
                      isSelectedVendorConsignment ? 'text-amber-400 opacity-80' : 'text-[#E2E8F0]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Current Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stockLevel}
                    onChange={(e) =>
                      setFormData({ ...formData, stockLevel: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Min Alert Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.minStockThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, minStockThreshold: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveItem(undefined, true)}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                    title="Save item and immediately print GS1 barcode labels"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Save & Print Label</span>
                  </button>

                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
                  >
                    Save Item
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <CsvImportModal
          onClose={() => setIsCsvModalOpen(false)}
          onRefreshData={onRefreshData}
        />
      )}

      {/* GS1 Barcode Label Printer Modal */}
      {isPrinterOpen && (
        <BarcodePrinterModal
          inventory={inventory}
          initialSelectedItemId={printerInitialItemId}
          onClose={() => setIsPrinterOpen(false)}
        />
      )}
    </div>
  );
};
