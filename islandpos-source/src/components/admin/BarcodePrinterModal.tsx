import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Printer,
  Barcode as BarcodeIcon,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertCircle,
  Copy,
  Settings2,
  Tag,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { InventoryItem } from '../../types/pos';
import {
  validateGS1GTIN,
  generateGS1GTIN13,
  formatGS1Display,
} from '../../utils/gs1Barcode';

interface BarcodePrinterModalProps {
  inventory: InventoryItem[];
  initialSelectedItemId?: string;
  onClose: () => void;
}

export type GS1Symbology = 'EAN13' | 'CODE128' | 'UPC' | 'GS1_128';
export type LabelPreset = 'shelf_tag' | 'product_sticker' | 'jewelry' | 'avery_30up';

export const BarcodePrinterModal: React.FC<BarcodePrinterModalProps> = ({
  inventory,
  initialSelectedItemId,
  onClose,
}) => {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(
    initialSelectedItemId
      ? [initialSelectedItemId]
      : inventory.map((i) => i.id)
  );

  // Label Quantities per Item: item.id -> number
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    inventory.forEach((item) => {
      initial[item.id] = 1;
    });
    return initial;
  });

  // GS1 Settings
  const [symbology, setSymbology] = useState<GS1Symbology>('EAN13');
  const [labelPreset, setLabelPreset] = useState<LabelPreset>('shelf_tag');
  
  // Custom Display Toggles
  const [showPrice, setShowPrice] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [showCategory, setShowCategory] = useState(true);
  const [showSizeVariant, setShowSizeVariant] = useState(true);
  const [showVatBadge, setShowVatBadge] = useState(true);

  // Filter search inside printer
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (initialSelectedItemId && !selectedItemIds.includes(initialSelectedItemId)) {
      setSelectedItemIds([initialSelectedItemId]);
    }
  }, [initialSelectedItemId]);

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === filteredInventoryList.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredInventoryList.map((i) => i.id));
    }
  };

  const handleSetStockAsQuantities = () => {
    const updated: Record<string, number> = { ...quantities };
    inventory.forEach((item) => {
      updated[item.id] = Math.max(1, item.stockLevel);
    });
    setQuantities(updated);
  };

  const handleSetAllQuantities = (qty: number) => {
    const updated: Record<string, number> = { ...quantities };
    inventory.forEach((item) => {
      updated[item.id] = qty;
    });
    setQuantities(updated);
  };

  const handleQuantityChange = (id: string, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, value),
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredInventoryList = inventory.filter((item) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      (item.brand && item.brand.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Calculate total labels to print
  const totalLabelsToPrint = selectedItemIds.reduce(
    (sum, id) => sum + (quantities[id] || 1),
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:inset-auto print:static">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-6xl w-full p-5 text-[#E2E8F0] shadow-2xl relative max-h-[92vh] flex flex-col justify-between print:bg-white print:border-none print:shadow-none print:p-0 print:max-h-none print:w-full">
        
        {/* Header - Hidden on Print */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1E293B] shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E2E8F0] flex items-center gap-2">
                GS1 Barcode Tag & Shelf Label Printer
              </h2>
              <p className="text-xs text-slate-400">
                Generate GS1 GTIN-13 / GS1-128 compliant barcode labels for immediate shelf & item tagging
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 my-3 overflow-y-auto flex-1 pr-1 print:block print:overflow-visible">
          
          {/* Left Panel: Controls & Item Selector - Hidden on Print */}
          <div className="lg:col-span-5 space-y-3.5 print:hidden">
            
            {/* GS1 Symbology & Preset Config Card */}
            <div className="bg-[#0F1115] p-3.5 rounded-xl border border-[#1E293B] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-emerald-400" /> GS1 Encoding & Format
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  GS1 Compliant
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                    Barcode Symbology
                  </label>
                  <select
                    value={symbology}
                    onChange={(e) => setSymbology(e.target.value as GS1Symbology)}
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="EAN13">GS1 GTIN-13 (EAN-13 Standard)</option>
                    <option value="GS1_128">GS1-128 / (01) GTIN Code</option>
                    <option value="UPC">GS1 GTIN-12 (UPC-A)</option>
                    <option value="CODE128">Code 128 (General SKU)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                    Label Layout Size
                  </label>
                  <select
                    value={labelPreset}
                    onChange={(e) => setLabelPreset(e.target.value as LabelPreset)}
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="shelf_tag">Shelf Tag (2.25" x 1.25")</option>
                    <option value="product_sticker">Product Sticker (2.0" x 1.0")</option>
                    <option value="jewelry">Compact Jewelry Tag (1.5" x 0.75")</option>
                    <option value="avery_30up">Avery 30-up Sheet (1.0" x 2.625")</option>
                  </select>
                </div>
              </div>

              {/* Toggles for Label Content */}
              <div className="pt-1 border-t border-[#1E293B]">
                <span className="text-[10px] font-semibold text-slate-400 block mb-1.5">
                  Label Data Field Toggles:
                </span>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      className="rounded border-[#1E293B] text-emerald-500 focus:ring-0 accent-emerald-500"
                    />
                    <span>Price</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showVatBadge}
                      onChange={(e) => setShowVatBadge(e.target.checked)}
                      className="rounded border-[#1E293B] text-emerald-500 focus:ring-0 accent-emerald-500"
                    />
                    <span>VAT %</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBrand}
                      onChange={(e) => setShowBrand(e.target.checked)}
                      className="rounded border-[#1E293B] text-emerald-500 focus:ring-0 accent-emerald-500"
                    />
                    <span>Brand</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCategory}
                      onChange={(e) => setShowCategory(e.target.checked)}
                      className="rounded border-[#1E293B] text-emerald-500 focus:ring-0 accent-emerald-500"
                    />
                    <span>Group Category</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSizeVariant}
                      onChange={(e) => setShowSizeVariant(e.target.checked)}
                      className="rounded border-[#1E293B] text-emerald-500 focus:ring-0 accent-emerald-500"
                    />
                    <span>Size/Variant</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Item Selection & Quantity List */}
            <div className="bg-[#0F1115] p-3.5 rounded-xl border border-[#1E293B] space-y-2 max-h-[340px] flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-[#1E293B] shrink-0">
                <span className="text-xs font-semibold text-slate-300">
                  Select Items ({selectedItemIds.length} of {inventory.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSetStockAsQuantities}
                    className="text-[10px] text-cyan-400 hover:underline"
                    title="Set label print count equal to item stock quantity"
                  >
                    Match Stock Qty
                  </button>
                  <button
                    onClick={toggleSelectAll}
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    {selectedItemIds.length === filteredInventoryList.length ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5" /> Deselect
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5" /> Select All
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Search Filter */}
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Quick filter item name or SKU..."
                className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 shrink-0"
              />

              {/* Scrollable Items List */}
              <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
                {filteredInventoryList.map((item) => {
                  const isSelected = selectedItemIds.includes(item.id);
                  const qty = quantities[item.id] || 1;
                  const gtinVal = validateGS1GTIN(item.sku);

                  return (
                    <div
                      key={item.id}
                      className={`p-2 rounded-lg text-xs flex items-center justify-between transition-colors border ${
                        isSelected
                          ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200'
                          : 'bg-[#161B22] border-[#1E293B] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <button
                        onClick={() => toggleSelectItem(item.id)}
                        className="flex-1 text-left min-w-0 pr-2"
                      >
                        <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {gtinVal.isValid && (
                            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 rounded">
                              GS1 GTIN
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>SKU: {item.sku}</span>
                          <span>•</span>
                          <span>${item.retailPrice.toFixed(2)}</span>
                          <span>•</span>
                          <span className="text-slate-400">Stock: {item.stockLevel}</span>
                        </div>
                      </button>

                      {isSelected && (
                        <div className="flex items-center gap-1 shrink-0 bg-[#0F1115] px-1.5 py-0.5 rounded border border-[#1E293B]">
                          <span className="text-[10px] text-slate-500 font-mono">Qty:</span>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={qty}
                            onChange={(e) =>
                              handleQuantityChange(item.id, parseInt(e.target.value) || 1)
                            }
                            className="w-10 bg-[#161B22] border border-[#1E293B] rounded text-center text-xs font-mono font-bold text-emerald-400 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel: Label Print Sheet Preview & Render */}
          <div className="lg:col-span-7 bg-[#0F1115] p-4 rounded-xl border border-[#1E293B] flex flex-col print:bg-white print:border-none print:p-0">
            <div className="text-xs text-slate-400 mb-3 flex items-center justify-between shrink-0 print:hidden">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-400" /> Printable Sheet Preview ({totalLabelsToPrint} total stickers)
              </span>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                {labelPreset === 'shelf_tag' && 'Shelf Tag (2.25" x 1.25")'}
                {labelPreset === 'product_sticker' && 'Product Label (2.0" x 1.0")'}
                {labelPreset === 'jewelry' && 'Jewelry Tag (1.5" x 0.75")'}
                {labelPreset === 'avery_30up' && 'Avery 30-up Sheet'}
              </span>
            </div>

            {/* Sticker Grid - Renders in crisp black & white for printer */}
            <div
              className={`p-4 bg-white text-slate-900 rounded-xl overflow-y-auto max-h-[520px] print:max-h-none print:overflow-visible print:p-0 print:bg-white printable-barcodes grid gap-3 ${
                labelPreset === 'shelf_tag'
                  ? 'grid-cols-2 sm:grid-cols-3 print:grid-cols-3'
                  : labelPreset === 'jewelry'
                  ? 'grid-cols-3 sm:grid-cols-4 print:grid-cols-4'
                  : labelPreset === 'avery_30up'
                  ? 'grid-cols-3 print:grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-3 print:grid-cols-3'
              }`}
            >
              {selectedItemIds.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 font-sans text-xs">
                  No items selected for barcode label printing.
                </div>
              ) : (
                inventory
                  .filter((i) => selectedItemIds.includes(i.id))
                  .flatMap((item) => {
                    const count = quantities[item.id] || 1;
                    return Array.from({ length: count }).map((_, idx) => (
                      <GS1BarcodeSticker
                        key={`${item.id}-sticker-${idx}`}
                        item={item}
                        symbology={symbology}
                        labelPreset={labelPreset}
                        showPrice={showPrice}
                        showBrand={showBrand}
                        showCategory={showCategory}
                        showSizeVariant={showSizeVariant}
                        showVatBadge={showVatBadge}
                      />
                    ));
                  })
              )}
            </div>
          </div>
        </div>

        {/* Footer - Hidden on Print */}
        <div className="pt-3 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="text-xs text-slate-400">
            Total Labels queued: <strong className="text-emerald-400 font-mono">{totalLabelsToPrint} stickers</strong> ready for thermal or laser printer.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="bg-slate-800 text-slate-300 hover:bg-slate-700 px-4 py-2 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handlePrint}
              disabled={totalLabelsToPrint === 0}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Print {totalLabelsToPrint} Labels</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Individual GS1 Barcode Sticker Sub-component
interface GS1BarcodeStickerProps {
  item: InventoryItem;
  symbology: GS1Symbology;
  labelPreset: LabelPreset;
  showPrice: boolean;
  showBrand: boolean;
  showCategory: boolean;
  showSizeVariant: boolean;
  showVatBadge: boolean;
}

const GS1BarcodeSticker: React.FC<GS1BarcodeStickerProps> = ({
  item,
  symbology,
  labelPreset,
  showPrice,
  showBrand,
  showCategory,
  showSizeVariant,
  showVatBadge,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hasError, setHasError] = useState(false);

  // Derive GS1 GTIN code string
  let barcodeValue = item.sku;
  let jsbarcodeFormat = 'CODE128';

  if (symbology === 'EAN13' || symbology === 'UPC') {
    // If SKU is not a valid GTIN-13/GTIN-12, format or generate GTIN
    const validation = validateGS1GTIN(item.sku);
    if (!validation.isValid) {
      // Generate clean GTIN-13 based on item SKU
      barcodeValue = generateGS1GTIN13('950', item.sku);
    } else {
      barcodeValue = item.sku.replace(/\D/g, '');
    }

    if (symbology === 'EAN13') {
      jsbarcodeFormat = 'EAN13';
      if (barcodeValue.length !== 13) {
        barcodeValue = generateGS1GTIN13('950', barcodeValue);
      }
    } else if (symbology === 'UPC') {
      jsbarcodeFormat = 'UPC';
      if (barcodeValue.length !== 12) {
        barcodeValue = barcodeValue.slice(0, 12).padStart(12, '0');
      }
    }
  } else if (symbology === 'GS1_128') {
    jsbarcodeFormat = 'CODE128';
    // Format GS1 Application Identifier (01) GTIN
    const validation = validateGS1GTIN(item.sku);
    const gtin14 = validation.isValid
      ? item.sku.replace(/\D/g, '').padStart(14, '0')
      : generateGS1GTIN13('950', item.sku).padStart(14, '0');
    barcodeValue = `(01)${gtin14}`;
  } else {
    jsbarcodeFormat = 'CODE128';
    barcodeValue = item.sku || 'SKU-000';
  }

  useEffect(() => {
    if (svgRef.current) {
      try {
        setHasError(false);
        JsBarcode(svgRef.current, barcodeValue, {
          format: jsbarcodeFormat,
          width: labelPreset === 'jewelry' ? 1.0 : 1.2,
          height: labelPreset === 'jewelry' ? 22 : labelPreset === 'product_sticker' ? 28 : 34,
          displayValue: true,
          fontSize: labelPreset === 'jewelry' ? 8 : 9,
          font: 'monospace',
          margin: 1,
          textMargin: 1,
        });
      } catch (err) {
        setHasError(true);
        // Fallback to CODE128 if EAN13 check digit rejected by JsBarcode
        try {
          JsBarcode(svgRef.current, item.sku, {
            format: 'CODE128',
            width: 1.1,
            height: 28,
            displayValue: true,
            fontSize: 9,
            margin: 1,
          });
        } catch {
          // ignore
        }
      }
    }
  }, [item, symbology, labelPreset, barcodeValue, jsbarcodeFormat]);

  const vatPercent = Math.round((item.vatRate ?? 0.15) * 100);

  return (
    <div
      className={`border border-slate-300 p-2 rounded-lg bg-white text-center flex flex-col justify-between text-slate-900 font-mono shadow-xs print:border-slate-800 print:shadow-none break-inside-avoid ${
        labelPreset === 'jewelry'
          ? 'h-24 text-[9px]'
          : labelPreset === 'product_sticker'
          ? 'h-28 text-[10px]'
          : 'h-36 text-xs'
      }`}
    >
      {/* Label Header info */}
      <div>
        {showBrand && (
          <div className="font-extrabold text-[9px] uppercase tracking-wider text-slate-700 truncate">
            {item.brand || 'Ocean Seychelles'}
          </div>
        )}
        <div className="font-bold text-[10px] sm:text-[11px] truncate uppercase leading-tight text-slate-900">
          {item.name}
        </div>
        <div className="text-[8px] sm:text-[9px] text-slate-600 font-sans flex items-center justify-center gap-1.5 truncate">
          {showCategory && <span>{item.category}</span>}
          {showCategory && showSizeVariant && item.size && <span>•</span>}
          {showSizeVariant && item.size && <span>Size: {item.size}</span>}
          {showSizeVariant && item.variant && <span>({item.variant})</span>}
        </div>
      </div>

      {/* SVG Barcode Output */}
      <div className="my-0.5 flex justify-center items-center">
        <svg ref={svgRef} className="mx-auto max-w-full"></svg>
      </div>

      {/* Footer Price & GS1 Compliance Line */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-200">
        <span className="text-[8px] font-sans font-bold text-slate-500 uppercase">
          GS1 GTIN
        </span>

        {showPrice && (
          <div className="flex items-center gap-1">
            <span className="font-extrabold text-xs sm:text-sm font-mono text-slate-900">
              ${item.retailPrice.toFixed(2)}
            </span>
            {showVatBadge && (
              <span className="text-[8px] font-sans font-bold text-emerald-700 bg-emerald-100 px-1 rounded">
                +{vatPercent}% VAT
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
