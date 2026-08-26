import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Download,
  Sparkles,
  Layers,
  ArrowRight,
  ArrowLeft,
  Check,
  Calculator,
  Tag,
  Percent,
  Settings2,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import {
  parseRawCsv,
  getDefaultFieldMapping,
  parseCsvWithAdvancedMapping,
  FieldMapping,
  CategoryConfig,
  VatConfig,
  DEFAULT_CATEGORY_RULES,
  ParsedCsvRow,
} from '../../services/csvParser';
import { posDb, DEFAULT_SETTINGS } from '../../services/db';
import { CustomCatalogTemplate } from '../../types/pos';
import { CustomCatalogTemplatesModal } from './CustomCatalogTemplatesModal';

interface CsvImportModalProps {
  onClose: () => void;
  onRefreshData: () => void;
}

// Database fields available for CSV Header mapping
const TARGET_DB_FIELDS: { id: keyof FieldMapping; label: string; required?: boolean; description: string }[] = [
  { id: 'name', label: 'Item Name / Description', required: true, description: 'Product title (e.g. Classic Cotton T-Shirt - Wave Print)' },
  { id: 'brand', label: 'Brand Name', description: 'Brand line (e.g. Acme Gifts, Souvenir Boutique)' },
  { id: 'category', label: 'Group Category', description: 'Product category (e.g. T-Shirts, Mugs, Bags, Pareos)' },
  { id: 'productLine', label: 'Product Line / Tier', description: 'Sub-line (e.g. Beach Heritage, Luxury Line, Normal Line)' },
  { id: 'size', label: 'Size / Target Fit', description: 'Size demographic (e.g. Adults - Medium, Kids - Large, Women - Small)' },
  { id: 'variant', label: 'Design / Variant', description: 'Artwork design or color pattern name' },
  { id: 'sku', label: 'Barcode SKU', description: '128-bit Barcode code or product ID' },
  { id: 'retailPrice', label: 'Retail Price ($)', required: true, description: 'Base selling price' },
  { id: 'costBasis', label: 'Unit Cost Basis ($)', description: 'Wholesale acquisition cost or supplier cut' },
  { id: 'stockLevel', label: 'Stock Quantity', description: 'Available inventory units on hand' },
  { id: 'minStockThreshold', label: 'Min Alert Stock', description: 'Low stock notification limit' },
  { id: 'vatRate', label: 'VAT Rate (%)', description: 'Applicable tax rate (e.g. 15 for 15% VAT)' },
  { id: 'vendorName', label: 'Supplier / Vendor Name', description: 'Vendor supplier name' },
];

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  onClose,
  onRefreshData,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [rawText, setRawText] = useState('');
  const [rawGrid, setRawGrid] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  // Mappings & Rules Configuration
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({
    name: -1,
    brand: -1,
    category: -1,
    productLine: -1,
    size: -1,
    variant: -1,
    sku: -1,
    retailPrice: -1,
    costBasis: -1,
    stockLevel: -1,
    minStockThreshold: -1,
    vatRate: -1,
    vendorName: -1,
  });

  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig>({
    enableAutoAssign: true,
    defaultCategory: 'Souvenirs & Crafts',
    rules: DEFAULT_CATEGORY_RULES,
  });

  const [vatConfig, setVatConfig] = useState<VatConfig>({
    calculationMode: 'exclusive', // 'exclusive' = CSV has Net Price (add VAT), 'inclusive' = CSV has Gross Price (extract VAT)
    defaultVatRate: 0.15, // 15% VAT
    applyGlobalOverride: false,
  });

  // Parsed Result State
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSummary, setImportSummary] = useState<{ added: number; updated: number } | null>(null);

  // Custom Catalog Presets State
  const [customTemplates, setCustomTemplates] = useState<CustomCatalogTemplate[]>(() => {
    const s = posDb.getSettings();
    return s.customCatalogTemplates && s.customCatalogTemplates.length > 0
      ? s.customCatalogTemplates
      : (DEFAULT_SETTINGS.customCatalogTemplates || []);
  });
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  // Load Initial Text or Samples
  const handleLoadCsvContent = (content: string) => {
    setRawText(content);
    const grid = parseRawCsv(content);
    setRawGrid(grid);
    if (grid.length > 0) {
      const extractedHeaders = grid[0];
      setHeaders(extractedHeaders);
      const autoMap = getDefaultFieldMapping(extractedHeaders);
      setFieldMapping(autoMap);
    } else {
      setHeaders([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleLoadCsvContent(content);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadCustomTemplate = (tmpl: CustomCatalogTemplate) => {
    handleLoadCsvContent(tmpl.csvContent);
  };

  const handleDownloadCustomTemplate = (tmpl: CustomCatalogTemplate) => {
    const filename = tmpl.filename || `${tmpl.name.replace(/\s+/g, '_')}_Template.csv`;
    const blob = new Blob([tmpl.csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Re-calculate Parsed Rows Whenever Mapping, Category, or VAT Config Changes
  useEffect(() => {
    if (rawText && rawGrid.length > 1) {
      const result = parseCsvWithAdvancedMapping(rawText, fieldMapping, categoryConfig, vatConfig);
      setParsedRows(result.rows);
    } else {
      setParsedRows([]);
    }
  }, [rawText, rawGrid, fieldMapping, categoryConfig, vatConfig]);

  // Update Mapping Dropdown
  const handleMappingChange = (fieldId: keyof FieldMapping, colIndex: number) => {
    setFieldMapping((prev) => ({
      ...prev,
      [fieldId]: colIndex,
    }));
  };

  // Execute Import
  const handleExecuteImport = () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);

    setTimeout(() => {
      const summary = posDb.bulkImportFromCsvRows(parsedRows);
      setImportSummary(summary);
      setIsProcessing(false);
      onRefreshData();
    }, 400);
  };

  // Bulk VAT Financial Totals
  const totalNetValue = parsedRows.reduce((acc, r) => acc + (r.netPrice || r.retailPrice) * r.stockLevel, 0);
  const totalVatCalculated = parsedRows.reduce((acc, r) => acc + (r.vatAmount || 0) * r.stockLevel, 0);
  const totalGrossValue = parsedRows.reduce((acc, r) => acc + (r.grossPrice || r.retailPrice) * r.stockLevel, 0);

  // Requirement Check for Step 2
  const isNameMapped = fieldMapping.name !== -1;
  const isPriceMapped = fieldMapping.retailPrice !== -1;
  const canProceedFromStep2 = isNameMapped && isPriceMapped && headers.length > 0;

  // Badge styles map
  const badgeClasses: Record<string, string> = {
    emerald: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600/30',
    blue: 'bg-blue-600/20 text-blue-300 border-blue-500/30 hover:bg-blue-600/30',
    purple: 'bg-purple-600/20 text-purple-300 border-purple-500/30 hover:bg-purple-600/30',
    amber: 'bg-amber-600/20 text-amber-300 border-amber-500/30 hover:bg-amber-600/30',
    cyan: 'bg-cyan-600/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-600/30',
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-5xl w-full p-6 text-[#E2E8F0] shadow-2xl relative my-6 max-h-[92vh] flex flex-col justify-between">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1E293B] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#E2E8F0]">
                Bulk CSV Catalog Import & Tax Mapping Engine
              </h2>
              <p className="text-xs text-slate-400">
                Map CSV header rows to database fields, configure auto-category rules, and calculate bulk VAT taxes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Navigation */}
        <div className="my-3 grid grid-cols-4 gap-2 bg-[#0F1115] p-2 rounded-xl border border-[#1E293B] shrink-0 text-xs">
          <button
            onClick={() => setCurrentStep(1)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold transition-all ${
              currentStep === 1
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-[10px] font-mono">1</span>
            <span>Upload File</span>
          </button>

          <button
            disabled={headers.length === 0}
            onClick={() => setCurrentStep(2)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold transition-all ${
              currentStep === 2
                ? 'bg-emerald-600 text-white shadow-xs'
                : headers.length === 0
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-[10px] font-mono">2</span>
            <span>Header Mapping</span>
          </button>

          <button
            disabled={!canProceedFromStep2}
            onClick={() => setCurrentStep(3)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold transition-all ${
              currentStep === 3
                ? 'bg-emerald-600 text-white shadow-xs'
                : !canProceedFromStep2
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-[10px] font-mono">3</span>
            <span>Category & VAT Rules</span>
          </button>

          <button
            disabled={parsedRows.length === 0}
            onClick={() => setCurrentStep(4)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold transition-all ${
              currentStep === 4
                ? 'bg-emerald-600 text-white shadow-xs'
                : parsedRows.length === 0
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-[10px] font-mono">4</span>
            <span>Preview & Import ({parsedRows.length})</span>
          </button>
        </div>

        {/* STEP 1: UPLOAD CSV / PASTE TEXT */}
        {currentStep === 1 && (
          <div className="space-y-4 my-2 flex-1 overflow-y-auto pr-1">
            {/* Quick Templates Toolbar */}
            <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Quick Catalog Templates:
                </span>
                {customTemplates.map((tmpl) => {
                  const badgeStyle = badgeClasses[tmpl.badgeColor || 'emerald'] || badgeClasses.emerald;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleLoadCustomTemplate(tmpl)}
                      className={`border px-2.5 py-1 rounded-lg font-medium transition-colors text-xs ${badgeStyle}`}
                      title={tmpl.description || `Load ${tmpl.name}`}
                    >
                      Load {tmpl.name}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsTemplatesModalOpen(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 text-xs"
                  title="Customize template names & CSV data for your shop brand"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Edit Quick Templates
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {customTemplates.map((tmpl) => (
                  <button
                    key={`dl-${tmpl.id}`}
                    type="button"
                    onClick={() => handleDownloadCustomTemplate(tmpl)}
                    className="bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-lg hover:bg-slate-700 flex items-center gap-1 text-[11px]"
                    title={`Download ${tmpl.name} template CSV file`}
                  >
                    <Download className="w-3 h-3 text-emerald-400" /> Download {tmpl.name} CSV
                  </button>
                ))}
              </div>
            </div>

            {/* Drag Drop & Paste Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Drag Drop Dropzone */}
              <div className="bg-[#0F1115] border-2 border-dashed border-[#1E293B] hover:border-emerald-500/60 rounded-xl p-6 text-center flex flex-col items-center justify-center relative group transition-all">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-10 h-10 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-[#E2E8F0]">Drop CSV File Here or Click to Browse</span>
                <span className="text-[10px] text-slate-400 mt-1">Supports standard CSV files (.csv, .txt)</span>
              </div>

              {/* Raw CSV Textarea */}
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Or Paste Raw CSV Lines:</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {rawGrid.length > 0 ? `${rawGrid.length - 1} rows detected` : 'No data'}
                  </span>
                </label>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => handleLoadCsvContent(e.target.value)}
                  placeholder="Brand, Item Name, Category, Product Line, Size Target, Barcode SKU, Retail Price, Cost Basis, Stock Qty, VAT Rate %..."
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-emerald-500 resize-none flex-1"
                ></textarea>
              </div>
            </div>

            {/* Header Detection Status */}
            {headers.length > 0 && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs flex items-center justify-between text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Successfully parsed <strong>{headers.length} CSV Header Columns</strong> and <strong>{rawGrid.length - 1} Data Rows</strong>!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1 transition-colors shadow-xs"
                >
                  <span>Proceed to Header Mapping</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: CSV HEADER TO DATABASE FIELD MAPPING */}
        {currentStep === 2 && (
          <div className="space-y-4 my-2 flex-1 overflow-y-auto pr-1">
            <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B] flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[#E2E8F0] flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4 text-emerald-400" /> Database Field Header Alignment
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Map each database field to the corresponding column header from your CSV file.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFieldMapping(getDefaultFieldMapping(headers))}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 font-medium transition-colors"
              >
                <RefreshCw className="w-3 h-3 text-cyan-400" /> Auto-Detect Headers
              </button>
            </div>

            {/* Requirement Warning */}
            {(!isNameMapped || !isPriceMapped) && (
              <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800/80 text-xs text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Required Fields Unmapped:</strong> Please select CSV columns for both <strong>Item Name</strong> and <strong>Retail Price</strong> to continue.
                </span>
              </div>
            )}

            {/* Header Mapping Table */}
            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#161B22] text-slate-400 font-semibold border-b border-[#1E293B] text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Target Database Field</th>
                    <th className="p-3">Requirement</th>
                    <th className="p-3">Mapped CSV Header Column</th>
                    <th className="p-3">Sample Value (Row 1)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {TARGET_DB_FIELDS.map((field) => {
                    const mappedColIdx = fieldMapping[field.id];
                    const isMapped = mappedColIdx !== -1;
                    const sampleVal = isMapped && rawGrid[1] ? rawGrid[1][mappedColIdx] || '—' : '—';

                    return (
                      <tr key={field.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-[#E2E8F0]">{field.label}</div>
                          <div className="text-[10px] text-slate-500">{field.description}</div>
                        </td>

                        <td className="p-3">
                          {field.required ? (
                            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                              Required
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">Optional</span>
                          )}
                        </td>

                        <td className="p-3">
                          <select
                            value={mappedColIdx}
                            onChange={(e) => handleMappingChange(field.id, parseInt(e.target.value))}
                            className={`w-full bg-[#161B22] border rounded-lg px-2.5 py-1.5 text-xs text-[#E2E8F0] focus:outline-none ${
                              isMapped
                                ? 'border-emerald-500/60 font-semibold'
                                : field.required
                                ? 'border-rose-500/60'
                                : 'border-[#1E293B]'
                            }`}
                          >
                            <option value={-1}>-- Ignore / Not Mapped --</option>
                            {headers.map((h, colIdx) => (
                              <option key={colIdx} value={colIdx}>
                                Column {colIdx + 1}: "{h}"
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-3 font-mono text-[11px]">
                          {isMapped ? (
                            <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                              {sampleVal}
                            </span>
                          ) : (
                            <span className="text-slate-600">Unmapped</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 3: AUTOMATIC CATEGORY ASSIGNMENT & BULK VAT CALCULATIONS */}
        {currentStep === 3 && (
          <div className="space-y-4 my-2 flex-1 overflow-y-auto pr-1">
            {/* Automatic Category Assignment Box */}
            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-sm text-[#E2E8F0]">
                    Automatic Category Auto-Assignment Rules
                  </h3>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-emerald-400">
                  <input
                    type="checkbox"
                    checked={categoryConfig.enableAutoAssign}
                    onChange={(e) =>
                      setCategoryConfig({ ...categoryConfig, enableAutoAssign: e.target.checked })
                    }
                    className="accent-emerald-500 rounded"
                  />
                  <span>Enable Auto-Classification Keyword Engine</span>
                </label>
              </div>

              <p className="text-xs text-slate-400">
                When a row's group category is missing or unmapped, the system scans item titles against keyword rules to automatically assign categories (e.g. T-Shirt → T-Shirts, Mug → Mugs, Sarong → Pareos).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Fallback Default Category (If No Keyword Matches):
                  </label>
                  <input
                    type="text"
                    value={categoryConfig.defaultCategory}
                    onChange={(e) =>
                      setCategoryConfig({ ...categoryConfig, defaultCategory: e.target.value })
                    }
                    placeholder="e.g. Souvenirs & Crafts"
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Active Keyword Rules Preview:
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto bg-[#161B22] p-2 rounded-lg border border-[#1E293B] text-[10px]">
                    {categoryConfig.rules.slice(0, 10).map((r, i) => (
                      <span key={i} className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                        "{r.keyword}" → <strong>{r.category}</strong>
                      </span>
                    ))}
                    <span className="text-slate-500 font-italic">+ more</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bulk VAT Tax Calculation Box */}
            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-sm text-[#E2E8F0]">
                    Bulk VAT Tax Calculation Mode & Default Rate
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-cyan-400 font-semibold flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5" /> VAT Rate:
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={vatConfig.defaultVatRate * 100}
                    onChange={(e) =>
                      setVatConfig({
                        ...vatConfig,
                        defaultVatRate: (parseFloat(e.target.value) || 0) / 100,
                      })
                    }
                    className="w-16 bg-[#161B22] border border-[#1E293B] rounded px-2 py-1 text-center font-mono font-bold text-cyan-300 text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-slate-400">%</span>
                </div>
              </div>

              {/* Radio options for Tax Exclusive vs Tax Inclusive */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <label
                  onClick={() => setVatConfig({ ...vatConfig, calculationMode: 'exclusive' })}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                    vatConfig.calculationMode === 'exclusive'
                      ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-300'
                      : 'bg-[#161B22] border-[#1E293B] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="vatMode"
                    checked={vatConfig.calculationMode === 'exclusive'}
                    onChange={() => setVatConfig({ ...vatConfig, calculationMode: 'exclusive' })}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <div>
                    <div className="font-bold text-[#E2E8F0]">Tax Exclusive (Prices in CSV are NET)</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      The retail price in CSV is Net Price. System calculates VAT Amount = Price × VAT%, and Gross Selling Total = Price + VAT.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setVatConfig({ ...vatConfig, calculationMode: 'inclusive' })}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                    vatConfig.calculationMode === 'inclusive'
                      ? 'bg-cyan-950/40 border-cyan-500/80 text-cyan-300'
                      : 'bg-[#161B22] border-[#1E293B] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="vatMode"
                    checked={vatConfig.calculationMode === 'inclusive'}
                    onChange={() => setVatConfig({ ...vatConfig, calculationMode: 'inclusive' })}
                    className="mt-0.5 accent-cyan-500"
                  />
                  <div>
                    <div className="font-bold text-[#E2E8F0]">Tax Inclusive (Prices in CSV are GROSS)</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      The retail price in CSV includes VAT. System extracts Net Retail Price = Gross / (1 + VAT%), and separates VAT Portion.
                    </p>
                  </div>
                </label>
              </div>

              {/* Global VAT Override Checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={vatConfig.applyGlobalOverride}
                    onChange={(e) =>
                      setVatConfig({ ...vatConfig, applyGlobalOverride: e.target.checked })
                    }
                    className="accent-cyan-500 rounded"
                  />
                  <span>
                    Override CSV per-item VAT values and enforce global{' '}
                    <strong className="text-cyan-400 font-mono font-bold">
                      {(vatConfig.defaultVatRate * 100).toFixed(0)}% VAT
                    </strong>{' '}
                    rate across all imported rows.
                  </span>
                </label>
              </div>
            </div>

            {/* Live Bulk VAT Financial Impact Summary Box */}
            <div className="bg-[#161B22] border border-[#1E293B] rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Total Items to Import</div>
                <div className="text-xl font-bold font-mono text-[#E2E8F0] mt-0.5">{parsedRows.length} items</div>
              </div>

              <div>
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Net Inventory Value</div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">${totalNetValue.toFixed(2)}</div>
              </div>

              <div>
                <div className="text-cyan-400 text-[10px] uppercase font-semibold flex items-center gap-1">
                  <Percent className="w-3 h-3" /> Calculated Bulk VAT
                </div>
                <div className="text-xl font-bold font-mono text-cyan-300 mt-0.5">${totalVatCalculated.toFixed(2)}</div>
              </div>

              <div>
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Gross Retail Value</div>
                <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">${totalGrossValue.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: PREVIEW & BULK IMPORT */}
        {currentStep === 4 && (
          <div className="space-y-3 my-2 flex-1 overflow-y-auto pr-1">
            {/* Import Summary Banner if completed */}
            {importSummary ? (
              <div className="p-4 bg-emerald-950/90 border border-emerald-600 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm text-white">Catalog Import Completed Successfully!</h3>
                    <p className="mt-0.5">
                      Successfully imported <strong className="text-white font-mono">{importSummary.added}</strong> new items and updated <strong className="text-white font-mono">{importSummary.updated}</strong> existing items in live POS inventory.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md"
                >
                  Done & Close
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-400" /> Final Parsed Catalog Preview ({parsedRows.length} Items)
                </span>
                <div className="text-[11px] text-slate-400 flex items-center gap-3 font-mono">
                  <span>Net: <strong className="text-emerald-400">${totalNetValue.toFixed(2)}</strong></span>
                  <span>+ VAT: <strong className="text-cyan-400">${totalVatCalculated.toFixed(2)}</strong></span>
                  <span>= Gross: <strong className="text-amber-400">${totalGrossValue.toFixed(2)}</strong></span>
                </div>
              </div>
            )}

            {/* Parsed Items Preview Table */}
            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#161B22] text-slate-400 font-semibold border-b border-[#1E293B] text-[10px] uppercase sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5">Item Name</th>
                    <th className="p-2.5">Brand</th>
                    <th className="p-2.5">Group Category</th>
                    <th className="p-2.5">Line / Size</th>
                    <th className="p-2.5">Barcode SKU</th>
                    <th className="p-2.5 text-right">Net Price</th>
                    <th className="p-2.5 text-center">VAT %</th>
                    <th className="p-2.5 text-right">VAT ($)</th>
                    <th className="p-2.5 text-right">Gross Selling</th>
                    <th className="p-2.5 text-center">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/60 font-mono text-[11px]">
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-2.5 font-semibold text-[#E2E8F0] font-sans max-w-[180px] truncate">
                        {row.name}
                      </td>

                      <td className="p-2.5">
                        <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-sans font-bold">
                          {row.brand}
                        </span>
                      </td>

                      <td className="p-2.5 font-sans">
                        <span className="flex items-center gap-1">
                          <span className="text-slate-200">{row.category}</span>
                          {row.categorySource === 'auto_rule' && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono" title="Category auto-assigned via title keyword rule">
                              Auto Rule
                            </span>
                          )}
                          {row.categorySource === 'fallback' && (
                            <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded font-mono" title="Category assigned using fallback default">
                              Default
                            </span>
                          )}
                        </span>
                      </td>

                      <td className="p-2.5 text-slate-400 font-sans text-[10px]">
                        {row.productLine} | {row.size}
                      </td>

                      <td className="p-2.5 text-slate-400">{row.sku}</td>

                      <td className="p-2.5 text-right text-emerald-400 font-bold">
                        ${(row.netPrice || row.retailPrice).toFixed(2)}
                      </td>

                      <td className="p-2.5 text-center text-cyan-400 font-bold">
                        {(row.vatRate * 100).toFixed(0)}%
                      </td>

                      <td className="p-2.5 text-right text-cyan-300">
                        +${(row.vatAmount || 0).toFixed(2)}
                      </td>

                      <td className="p-2.5 text-right text-amber-400 font-bold">
                        ${(row.grossPrice || row.retailPrice).toFixed(2)}
                      </td>

                      <td className="p-2.5 text-center font-bold text-white">
                        {row.stockLevel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="pt-4 border-t border-[#1E293B] flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            <span>
              Step {currentStep} of 4 • {parsedRows.length} item(s) ready
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                disabled={currentStep === 1 && headers.length === 0}
                onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold px-5 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={parsedRows.length === 0 || isProcessing || importSummary !== null}
                onClick={handleExecuteImport}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold px-5 py-2 rounded-xl text-xs transition-all shadow-lg flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <span>Importing Catalog...</span>
                ) : importSummary ? (
                  <span className="flex items-center gap-1"><Check className="w-4 h-4 text-emerald-300" /> Imported</span>
                ) : (
                  <span>Import {parsedRows.length} Items into Inventory</span>
                )}
              </button>
            )}
          </div>
        </div>

      </div>

      <CustomCatalogTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onTemplatesUpdated={(updated) => setCustomTemplates(updated)}
      />
    </div>
  );
};
