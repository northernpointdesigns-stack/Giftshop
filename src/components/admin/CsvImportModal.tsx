import React, { useState } from 'react';
import { UploadCloud, X, FileSpreadsheet, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { csvService } from '../../services/csvParser';
import { posDb } from '../../services/db';
import { soundService } from '../../services/audio';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [importedCount, setImportedCount] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent((event.target?.result as string) || '');
      };
      reader.readAsText(selected);
    }
  };

  const handleProcessImport = () => {
    if (!csvContent) return;
    setImportStatus('parsing');
    setErrorMsg(null);

    try {
      const items = csvService.parseInventoryCsv(csvContent);
      if (items.length === 0) {
        setErrorMsg('No valid products found in CSV. Please verify column headers.');
        setImportStatus('error');
        soundService.playErrorBeep();
        return;
      }

      posDb.bulkImportInventory(items);
      setImportedCount(items.length);
      setImportStatus('success');
      soundService.playSuccessChime();
      onImportComplete();
    } catch {
      setErrorMsg('Failed to process CSV file. Format may be malformed.');
      setImportStatus('error');
      soundService.playErrorBeep();
    }
  };

  const handleDownloadTemplate = () => {
    const template = `name,sku,barcode,category,price,costPrice,stockLevel,reorderPoint,isConsignment,brand\nVanilla Tea 100g,TEA-001,6901234500012,Beverages,85.00,45.00,50,10,false,Seychelles Tea\nTakamaka Rum 700ml,RUM-002,6901234500029,Spirits,380.00,240.00,24,6,false,Trois Freres`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 my-auto">
        {/* Header */}
        <div className="bg-[#0F1115] border-b border-[#1E293B] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Import Inventory Catalog from CSV</h2>
              <p className="text-[11px] text-slate-400">Bulk upload SKUs, pricing, barcodes, and stock levels</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Need the standard import format?</span>
            <button
              onClick={handleDownloadTemplate}
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-bold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template</span>
            </button>
          </div>

          {/* Drag & Drop Box */}
          <div className="border-2 border-dashed border-[#1E293B] hover:border-emerald-500/50 rounded-2xl p-6 text-center space-y-2 bg-[#0F1115] transition-colors">
            <UploadCloud className="w-10 h-10 text-slate-500 mx-auto" />
            <div>
              <label className="cursor-pointer text-xs font-bold text-emerald-400 hover:underline">
                <span>Choose a CSV file</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <span className="text-slate-400 text-xs"> or drag and drop here</span>
            </div>
            {file && (
              <p className="text-xs text-white font-mono bg-slate-800 py-1 px-3 rounded-lg inline-block">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Status Message */}
          {importStatus === 'success' && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Successfully imported and merged {importedCount} catalog items!</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#0F1115] border-t border-[#1E293B] p-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold"
          >
            {importStatus === 'success' ? 'Done' : 'Cancel'}
          </button>
          {importStatus !== 'success' && (
            <button
              onClick={handleProcessImport}
              disabled={!file}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold transition-all"
            >
              Upload & Merge Catalog
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
