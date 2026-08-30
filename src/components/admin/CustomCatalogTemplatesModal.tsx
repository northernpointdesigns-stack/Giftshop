import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  Edit3,
  Download,
  RotateCcw,
} from 'lucide-react';
import { CustomCatalogTemplate } from '../../types/pos';
import { posDb, DEFAULT_SETTINGS } from '../../services/db';

interface CustomCatalogTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplatesUpdated?: (templates: CustomCatalogTemplate[]) => void;
}

export const CustomCatalogTemplatesModal: React.FC<CustomCatalogTemplatesModalProps> = ({
  isOpen,
  onClose,
  onTemplatesUpdated,
}) => {
  const currentSettings = posDb.getSettings();
  const [templates, setTemplates] = useState<CustomCatalogTemplate[]>(() => {
    return currentSettings.customCatalogTemplates && currentSettings.customCatalogTemplates.length > 0
      ? currentSettings.customCatalogTemplates
      : (DEFAULT_SETTINGS.customCatalogTemplates || []);
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    return templates[0]?.id || '';
  });

  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  const handleUpdateTemplateField = (id: string, field: keyof CustomCatalogTemplate, value: any) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleAddNewTemplate = () => {
    const newId = `tmpl-${Date.now()}`;
    const newTmpl: CustomCatalogTemplate = {
      id: newId,
      name: `${currentSettings.storeName || 'My Shop'} Custom Catalog`,
      description: 'Custom catalog template for quick inventory importing',
      badgeColor: 'emerald',
      filename: `${(currentSettings.storeName || 'My_Shop').replace(/\s+/g, '_')}_Catalog.csv`,
      csvContent: `Brand,Item Name,Group Category,Product Line,Size Target,Barcode SKU,Retail Price,Cost Basis,Stock Qty,VAT Rate %
${currentSettings.storeName || 'My Shop'},Sample Product 1,General,Standard Line,One Size,990000001,20.00,10.00,25,15%
${currentSettings.storeName || 'My Shop'},Sample Product 2,Apparel,Classic Line,Medium,990000002,35.00,18.00,15,15%`,
    };

    setTemplates((prev) => [...prev, newTmpl]);
    setSelectedTemplateId(newId);
  };

  const handleDeleteTemplate = (id: string) => {
    if (templates.length <= 1) {
      alert('You must keep at least one catalog template pill.');
      return;
    }
    if (confirm('Delete this catalog template pill?')) {
      const next = templates.filter((t) => t.id !== id);
      setTemplates(next);
      if (selectedTemplateId === id) {
        setSelectedTemplateId(next[0]?.id || '');
      }
    }
  };

  const handleResetToDefaults = () => {
    if (confirm('Reset catalog templates to default shop presets?')) {
      const defaultList = DEFAULT_SETTINGS.customCatalogTemplates || [];
      setTemplates(defaultList);
      if (defaultList[0]) {
        setSelectedTemplateId(defaultList[0].id);
      }
    }
  };

  const handleSaveAll = () => {
    posDb.updateSettings({ customCatalogTemplates: templates });
    if (onTemplatesUpdated) {
      onTemplatesUpdated(templates);
    }
    setSuccessMsg('Catalog template pills updated successfully!');
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 800);
  };

  const colorBadgeClasses: Record<string, string> = {
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F1115]/85 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-4xl w-full p-6 text-[#E2E8F0] shadow-2xl relative my-6 max-h-[90vh] flex flex-col justify-between">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#E2E8F0]">
                Customize Quick Catalog Template Pills
              </h2>
              <p className="text-xs text-slate-400">
                Rename, add, or edit catalog CSV template presets to match your shop's brand identity
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

        {/* Success Alert */}
        {successMsg && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {successMsg}
          </div>
        )}

        {/* Main Body */}
        <div className="my-4 grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-y-auto">
          {/* Template Tabs & List */}
          <div className="space-y-2 border-r border-[#1E293B] pr-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Catalog Pills</span>
              <button
                type="button"
                onClick={handleAddNewTemplate}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add New
              </button>
            </div>

            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
              {templates.map((tmpl) => {
                const isSelected = tmpl.id === selectedTemplateId;
                const badgeStyle = colorBadgeClasses[tmpl.badgeColor || 'emerald'] || colorBadgeClasses.emerald;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplateId(tmpl.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'bg-slate-800/90 border-emerald-500/60 shadow-md'
                        : 'bg-[#0F1115] border-[#1E293B] hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeStyle}`}>
                          Pill
                        </span>
                        <span className="text-xs font-bold text-white truncate max-w-[130px]">{tmpl.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{tmpl.filename || 'catalog.csv'}</p>
                    </div>

                    {templates.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(tmpl.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete template pill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#1E293B]">
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Reset to Default Presets
              </button>
            </div>
          </div>

          {/* Editor Form for Selected Template */}
          {selectedTemplate && (
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Pill Name / Catalog Title:
                  </label>
                  <input
                    type="text"
                    value={selectedTemplate.name}
                    onChange={(e) => handleUpdateTemplateField(selectedTemplate.id, 'name', e.target.value)}
                    placeholder="e.g. My Shop Best Sellers Catalog"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Pill Accent Color:
                  </label>
                  <select
                    value={selectedTemplate.badgeColor || 'emerald'}
                    onChange={(e) => handleUpdateTemplateField(selectedTemplate.id, 'badgeColor', e.target.value)}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="emerald">Emerald Green</option>
                    <option value="blue">Royal Blue</option>
                    <option value="purple">Violet Purple</option>
                    <option value="amber">Warm Amber</option>
                    <option value="cyan">Bright Cyan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Download File Name:
                  </label>
                  <input
                    type="text"
                    value={selectedTemplate.filename || ''}
                    onChange={(e) => handleUpdateTemplateField(selectedTemplate.id, 'filename', e.target.value)}
                    placeholder="e.g. Shop_Catalog_Template.csv"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Description (optional):
                  </label>
                  <input
                    type="text"
                    value={selectedTemplate.description || ''}
                    onChange={(e) => handleUpdateTemplateField(selectedTemplate.id, 'description', e.target.value)}
                    placeholder="Brief description of items included"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* CSV Content Editor */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Raw CSV Template Lines (Header & Sample Rows):</span>
                  <span className="text-[10px] text-slate-500 font-mono">Include headers: Brand, Item Name, Retail Price, SKU...</span>
                </label>
                <textarea
                  rows={8}
                  value={selectedTemplate.csvContent}
                  onChange={(e) => handleUpdateTemplateField(selectedTemplate.id, 'csvContent', e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#1E293B] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Save Template Pills
          </button>
        </div>

      </div>
    </div>
  );
};
