import React, { useState, useMemo } from 'react';
import {
  X,
  Grid,
  Plus,
  Trash2,
  Sparkles,
  Printer,
  PackageCheck,
  Tag,
  Palette,
  Ruler,
  AlertCircle,
  HelpCircle,
  Copy,
} from 'lucide-react';
import { Vendor } from '../../types/pos';
import { posDb } from '../../services/db';
import { generateGS1GTIN13 } from '../../utils/gs1Barcode';

interface ApparelMatrixModalProps {
  vendors: Vendor[];
  categories: string[];
  brands: string[];
  initialProduct?: {
    name: string;
    brand: string;
    category: string;
    productLine: string;
    vendorId: string;
    retailPrice: number;
    costBasis: number;
    vatRate: number;
    imageUrl?: string;
  };
  onClose: () => void;
  onRefreshData: () => void;
  onOpenPrinterForItems?: (itemIds: string[]) => void;
}

const SIZE_PRESETS: { name: string; sizes: string[] }[] = [
  { name: 'Adults (S – 2XL)', sizes: ['S', 'M', 'L', 'XL', '2XL'] },
  { name: 'Adults Full (XS – 3XL)', sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] },
  { name: 'Kids (2Y – 12Y)', sizes: ['2Y', '4Y', '6Y', '8Y', '10Y', '12Y'] },
  { name: 'Ladies Fit (XS – XL)', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Numeric / Shoes (36 – 45)', sizes: ['36', '38', '40', '42', '44'] },
  { name: 'One Size Only', sizes: ['One Size'] },
];

const COLOR_PRESETS = [
  'White', 'Navy Blue', 'Black', 'Ocean Cyan', 'Sunset Coral', 'Sage Green', 'Sand / Beige', 'Heather Grey'
];

export const ApparelMatrixModal: React.FC<ApparelMatrixModalProps> = ({
  vendors,
  categories,
  brands,
  initialProduct,
  onClose,
  onRefreshData,
  onOpenPrinterForItems,
}) => {
  // Base parent info
  const [productName, setProductName] = useState(initialProduct?.name || '');
  const [brand, setBrand] = useState(initialProduct?.brand || 'Unbranded');
  const [category, setCategory] = useState(initialProduct?.category || 'T-Shirts');
  const [productLine, setProductLine] = useState(initialProduct?.productLine || 'Beach Heritage');
  const [vendorId, setVendorId] = useState(initialProduct?.vendorId || vendors[0]?.id || '');
  const [retailPrice, setRetailPrice] = useState(initialProduct?.retailPrice ?? 28.0);
  const [costBasis, setCostBasis] = useState(initialProduct?.costBasis ?? 12.0);
  const [vatRate, setVatRate] = useState(initialProduct?.vatRate ?? 0.15);
  const [minStockThreshold, setMinStockThreshold] = useState(3);
  const [imageUrl, setImageUrl] = useState(initialProduct?.imageUrl || '');

  // Dimensions
  const [colors, setColors] = useState<string[]>(['White', 'Navy Blue', 'Ocean Cyan']);
  const [newColorInput, setNewColorInput] = useState('');

  const [sizes, setSizes] = useState<string[]>(['S', 'M', 'L', 'XL']);
  const [newSizeInput, setNewSizeInput] = useState('');

  // Matrix Quantities: Record<`${color}:::${size}`, number>
  const [stockMatrix, setStockMatrix] = useState<Record<string, number>>({
    'White:::S': 3,
    'White:::M': 5,
    'White:::L': 6,
    'White:::XL': 2,
    'Navy Blue:::S': 2,
    'Navy Blue:::M': 4,
    'Navy Blue:::L': 4,
    'Navy Blue:::XL': 2,
    'Ocean Cyan:::S': 2,
    'Ocean Cyan:::M': 3,
    'Ocean Cyan:::L': 3,
    'Ocean Cyan:::XL': 1,
  });

  const [quickFillQty, setQuickFillQty] = useState<number>(5);

  // Selected vendor information
  const selectedVendor = vendors.find((v) => v.id === vendorId);
  const isConsignment = selectedVendor?.supplierType === 'consignment';
  const computedVendorCut = isConsignment && selectedVendor
    ? Number((retailPrice * (1 - selectedVendor.consignmentCutRate)).toFixed(2))
    : costBasis;

  // Add / remove colors
  const handleAddColor = (cName?: string) => {
    const target = (cName || newColorInput).trim();
    if (!target) return;
    if (!colors.includes(target)) {
      setColors((prev) => [...prev, target]);
    }
    setNewColorInput('');
  };

  const handleRemoveColor = (cName: string) => {
    setColors((prev) => prev.filter((c) => c !== cName));
  };

  // Add / remove sizes
  const handleAddSize = (sName?: string) => {
    const target = (sName || newSizeInput).trim();
    if (!target) return;
    if (!sizes.includes(target)) {
      setSizes((prev) => [...prev, target]);
    }
    setNewSizeInput('');
  };

  const handleRemoveSize = (sName: string) => {
    setSizes((prev) => prev.filter((s) => s !== sName));
  };

  const handleApplySizePreset = (presetSizes: string[]) => {
    setSizes([...presetSizes]);
  };

  // Update cell stock
  const handleCellChange = (color: string, size: string, value: number) => {
    const key = `${color}:::${size}`;
    setStockMatrix((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.floor(value || 0)),
    }));
  };

  // Quick fill all cells
  const handleFillAll = () => {
    const updated: Record<string, number> = {};
    colors.forEach((c) => {
      sizes.forEach((s) => {
        updated[`${c}:::${s}`] = quickFillQty;
      });
    });
    setStockMatrix(updated);
  };

  const handleClearAll = () => {
    setStockMatrix({});
  };

  // Fill specific column (color)
  const handleFillColumn = (color: string) => {
    setStockMatrix((prev) => {
      const copy = { ...prev };
      sizes.forEach((s) => {
        copy[`${color}:::${s}`] = quickFillQty;
      });
      return copy;
    });
  };

  // Compute live matrix metrics
  const matrixStats = useMemo(() => {
    let totalUnits = 0;
    let variantsToCreate = 0;
    const colorTotals: Record<string, number> = {};
    const sizeTotals: Record<string, number> = {};

    colors.forEach((c) => {
      colorTotals[c] = 0;
    });
    sizes.forEach((s) => {
      sizeTotals[s] = 0;
    });

    colors.forEach((c) => {
      sizes.forEach((s) => {
        const qty = stockMatrix[`${c}:::${s}`] || 0;
        if (qty > 0) {
          variantsToCreate += 1;
        }
        totalUnits += qty;
        colorTotals[c] = (colorTotals[c] || 0) + qty;
        sizeTotals[s] = (sizeTotals[s] || 0) + qty;
      });
    });

    const totalRetailValue = totalUnits * retailPrice;
    const totalCostValue = totalUnits * (isConsignment ? computedVendorCut : costBasis);

    return {
      totalUnits,
      variantsToCreate,
      colorTotals,
      sizeTotals,
      totalRetailValue,
      totalCostValue,
    };
  }, [colors, sizes, stockMatrix, retailPrice, costBasis, computedVendorCut, isConsignment]);

  // Image file handler
  const handleImageFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file (JPG, PNG, etc.).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageUrl(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Generate & Save all variants
  const handleSaveMatrix = (shouldPrint: boolean = false) => {
    if (!productName.trim()) {
      alert('Please provide a parent product name.');
      return;
    }
    if (colors.length === 0 || sizes.length === 0) {
      alert('Please define at least one color/design and one size.');
      return;
    }

    const createdIds: string[] = [];

    // Loop through all color x size combinations
    colors.forEach((c) => {
      sizes.forEach((s) => {
        const qty = stockMatrix[`${c}:::${s}`] || 0;
        // Even if qty is 0, we create the catalog entry if user defined the matrix, or default to 0 stock
        const uniqueGtin = generateGS1GTIN13('950');

        const saved = posDb.saveItem({
          name: productName.trim(),
          brand: brand.trim(),
          category: category.trim(),
          productLine: productLine.trim(),
          variant: c.trim(), // e.g. "White", "Navy Blue", "Coconut Print"
          size: s.trim(),    // e.g. "S", "M", "L"
          sku: uniqueGtin,
          stockLevel: qty,
          minStockThreshold: Number(minStockThreshold),
          retailPrice: Number(retailPrice),
          costBasis: Number(costBasis),
          vatRate: Number(vatRate),
          taxable: true,
          vendorId: vendorId,
          imageUrl: imageUrl || undefined,
        });

        if (saved) {
          createdIds.push(saved.id);
        }
      });
    });

    onRefreshData();
    onClose();

    if (shouldPrint && onOpenPrinterForItems && createdIds.length > 0) {
      onOpenPrinterForItems(createdIds);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/85 flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-5xl w-full text-[#E2E8F0] shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1E293B] bg-[#0F1115]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Grid className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#E2E8F0] flex items-center gap-2">
                Apparel Matrix & Variant Grid Generator
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Bulk create color/design columns × size rows with automatic GS1 GTIN barcode generation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Section 1: Parent Product Details */}
          <div className="bg-[#0F1115] p-4 rounded-xl border border-[#1E293B] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <Tag className="w-3.5 h-3.5" /> 1. Parent Product Specs
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Product / Design Title
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. T-Shirt Coconut Tree Heritage"
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-xs font-bold text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Brand Name
                </label>
                <input
                  type="text"
                  required
                  list="matrix-brand-options"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                />
                <datalist id="matrix-brand-options">
                  {brands.filter(b => b !== 'All').map(b => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  required
                  list="matrix-category-options"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="T-Shirts"
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                />
                <datalist id="matrix-category-options">
                  {categories.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Product Line
                </label>
                <input
                  type="text"
                  value={productLine}
                  onChange={(e) => setProductLine(e.target.value)}
                  placeholder="Beach Heritage"
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Supplier / Vendor
                </label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.supplierType === 'consignment' ? 'Deposit' : 'Wholesale'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Min Stock Alert Level
                </label>
                <input
                  type="number"
                  min="1"
                  value={minStockThreshold}
                  onChange={(e) => setMinStockThreshold(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Pricing Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1 border-t border-[#1E293B]">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Retail Selling Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
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
                  disabled={isConsignment}
                  value={isConsignment ? computedVendorCut : costBasis}
                  onChange={(e) => setCostBasis(parseFloat(e.target.value) || 0)}
                  className={`w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none ${
                    isConsignment ? 'text-amber-400 opacity-80' : 'text-[#E2E8F0]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  VAT Rate (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={vatRate * 100}
                  onChange={(e) => setVatRate((parseFloat(e.target.value) || 0) / 100)}
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-xs font-mono font-bold text-cyan-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Product Photo (Optional)
                </label>
                <label className="flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors truncate">
                  {imageUrl ? 'Photo Loaded ✓' : 'Upload Image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleImageFile(e.target.files?.[0]);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Colors / Designs (Columns) & Sizes (Rows) Setup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Colors / Designs (Columns) */}
            <div className="bg-[#0F1115] p-4 rounded-xl border border-[#1E293B] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  <Palette className="w-3.5 h-3.5" /> 2. Color / Design Columns ({colors.length})
                </div>
              </div>

              {/* Color chips */}
              <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-[#161B22] border border-[#1E293B] rounded-lg items-center">
                {colors.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-950/70 border border-cyan-700/50 text-cyan-200"
                  >
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(c)}
                      className="text-cyan-400 hover:text-rose-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {colors.length === 0 && (
                  <span className="text-xs text-slate-500 italic">No colors defined yet.</span>
                )}
              </div>

              {/* Add custom color */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newColorInput}
                  onChange={(e) => setNewColorInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddColor())}
                  placeholder="Type new color / design (e.g. Coral Red)..."
                  className="flex-1 bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddColor()}
                  className="bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              {/* Quick preset color chips */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-500 block mb-1 font-semibold">Quick Add Presets:</span>
                <div className="flex flex-wrap gap-1">
                  {COLOR_PRESETS.map((cp) => (
                    <button
                      key={cp}
                      type="button"
                      onClick={() => handleAddColor(cp)}
                      disabled={colors.includes(cp)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        colors.includes(cp)
                          ? 'bg-slate-800/40 border-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-[#161B22] border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-300'
                      }`}
                    >
                      + {cp}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sizes (Rows) */}
            <div className="bg-[#0F1115] p-4 rounded-xl border border-[#1E293B] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  <Ruler className="w-3.5 h-3.5" /> 3. Size Rows ({sizes.length})
                </div>
              </div>

              {/* Size chips */}
              <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-[#161B22] border border-[#1E293B] rounded-lg items-center">
                {sizes.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-950/70 border border-emerald-700/50 text-emerald-200"
                  >
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSize(s)}
                      className="text-emerald-400 hover:text-rose-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {sizes.length === 0 && (
                  <span className="text-xs text-slate-500 italic">No sizes defined yet.</span>
                )}
              </div>

              {/* Add custom size */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSizeInput}
                  onChange={(e) => setNewSizeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSize())}
                  placeholder="Type new size (e.g. 3XL, 34W, 8Y)..."
                  className="flex-1 bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddSize()}
                  className="bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              {/* Size scale presets */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-500 block mb-1 font-semibold">Load Size Scale Preset:</span>
                <div className="flex flex-wrap gap-1">
                  {SIZE_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleApplySizePreset(p.sizes)}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#161B22] border border-slate-700 text-slate-300 hover:border-emerald-500 hover:text-emerald-300 transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Section 3: Interactive Stock Quantity Matrix (Colors × Sizes) */}
          <div className="bg-[#0F1115] p-4 rounded-xl border border-[#1E293B] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <Grid className="w-3.5 h-3.5" /> 4. Stock Distribution Matrix
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Enter physical units in stock for each size and color combination (e.g. 10 Blue, 3 Large White, 5 Medium White)
                </p>
              </div>

              {/* Quick Fill Toolbar */}
              <div className="flex items-center gap-2 bg-[#161B22] p-1.5 rounded-lg border border-[#1E293B]">
                <span className="text-[10px] font-semibold text-slate-400 pl-1">Quick Qty:</span>
                <input
                  type="number"
                  min="0"
                  value={quickFillQty}
                  onChange={(e) => setQuickFillQty(parseInt(e.target.value) || 0)}
                  className="w-14 bg-[#0F1115] border border-[#1E293B] rounded px-1.5 py-0.5 text-xs font-mono font-bold text-emerald-400 text-center"
                />
                <button
                  type="button"
                  onClick={handleFillAll}
                  className="text-[10px] bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded font-bold transition-colors"
                >
                  Fill All Cells
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Matrix Table */}
            {colors.length > 0 && sizes.length > 0 ? (
              <div className="overflow-x-auto border border-[#1E293B] rounded-xl bg-[#161B22]/50">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0F1115] border-b border-[#1E293B]">
                      <th className="p-3 text-slate-400 font-bold uppercase tracking-wider text-[10px] min-w-[120px]">
                        Size / Fit ↓ \ Color →
                      </th>
                      {colors.map((c) => (
                        <th key={c} className="p-2.5 text-center min-w-[110px] border-l border-[#1E293B]">
                          <div className="font-bold text-cyan-300 text-xs">{c}</div>
                          <button
                            type="button"
                            onClick={() => handleFillColumn(c)}
                            className="text-[9px] text-slate-500 hover:text-cyan-400 underline mt-0.5 block mx-auto"
                            title={`Fill entire column with ${quickFillQty}`}
                          >
                            Fill col ({quickFillQty})
                          </button>
                        </th>
                      ))}
                      <th className="p-2.5 text-center font-bold text-slate-400 text-[10px] border-l border-[#1E293B] bg-[#0F1115]/80 min-w-[80px]">
                        Size Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {sizes.map((s) => (
                      <tr key={s} className="hover:bg-slate-800/20 transition-colors">
                        <td className="p-3 font-bold text-emerald-400 bg-[#0F1115]/50">
                          {s}
                        </td>
                        {colors.map((c) => {
                          const cellKey = `${c}:::${s}`;
                          const qty = stockMatrix[cellKey] ?? 0;
                          return (
                            <td key={cellKey} className="p-2 text-center border-l border-[#1E293B]">
                              <input
                                type="number"
                                min="0"
                                value={qty}
                                onChange={(e) => handleCellChange(c, s, parseInt(e.target.value) || 0)}
                                className={`w-20 text-center font-mono font-bold text-xs py-1.5 px-2 rounded-lg border focus:outline-none transition-all ${
                                  qty > 0
                                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/50 shadow-inner'
                                    : 'bg-[#0F1115] text-slate-500 border-[#1E293B]'
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="p-2.5 text-center font-mono font-bold text-slate-300 border-l border-[#1E293B] bg-[#0F1115]/50">
                          {matrixStats.sizeTotals[s] || 0}
                        </td>
                      </tr>
                    ))}

                    {/* Column totals footer */}
                    <tr className="bg-[#0F1115] border-t-2 border-[#1E293B] font-bold">
                      <td className="p-3 text-slate-400 text-[11px] uppercase">
                        Color Total
                      </td>
                      {colors.map((c) => (
                        <td key={c} className="p-2.5 text-center font-mono text-cyan-300 border-l border-[#1E293B]">
                          {matrixStats.colorTotals[c] || 0}
                        </td>
                      ))}
                      <td className="p-2.5 text-center font-mono text-emerald-400 border-l border-[#1E293B] text-sm bg-emerald-950/30">
                        {matrixStats.totalUnits}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-[#1E293B] rounded-xl">
                Please define at least one color and one size above to generate the stock distribution grid.
              </div>
            )}

            {/* Matrix Summary Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#161B22] p-3.5 rounded-xl border border-[#1E293B]">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Variants Generated:</span>
                <span className="font-mono font-bold text-sm text-[#E2E8F0]">
                  {colors.length * sizes.length} SKU combinations
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Total Physical Units:</span>
                <span className="font-mono font-bold text-sm text-emerald-400">
                  {matrixStats.totalUnits} items in stock
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Retail Catalog Value:</span>
                <span className="font-mono font-bold text-sm text-cyan-300">
                  ${matrixStats.totalRetailValue.toFixed(2)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Estimated Cost Investment:</span>
                <span className="font-mono font-bold text-sm text-slate-300">
                  ${matrixStats.totalCostValue.toFixed(2)}
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-[#1E293B] bg-[#0F1115] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSaveMatrix(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              title="Save all variant entries to POS database and immediately open the GS1 barcode printer"
            >
              <Printer className="w-4 h-4" />
              <span>Generate & Print Barcodes</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveMatrix(false)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Create Matrix & Save All Items ({matrixStats.totalUnits} Units)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
