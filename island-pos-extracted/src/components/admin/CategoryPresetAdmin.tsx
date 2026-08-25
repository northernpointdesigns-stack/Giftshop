import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Sparkles,
  Shirt,
  Tag,
  Sliders,
  Layers,
  Edit2,
  Info,
} from 'lucide-react';
import {
  CategoryPreset,
  DemographicOption,
  CategoryProfileType,
  getStoredCategoryPresets,
  saveStoredCategoryPresets,
  getStoredDemographicOptions,
  saveStoredDemographicOptions,
  resetCategoryPresetsToDefault,
  DEFAULT_CATEGORY_PRESETS,
  DEFAULT_DEMOGRAPHIC_OPTIONS,
} from '../../utils/categoryProfiles';

interface CategoryPresetAdminProps {
  isOpen: boolean;
  onClose: () => void;
  onPresetsUpdated?: () => void;
}

export const CategoryPresetAdmin: React.FC<CategoryPresetAdminProps> = ({
  isOpen,
  onClose,
  onPresetsUpdated,
}) => {
  const [presets, setPresets] = useState<CategoryPreset[]>([]);
  const [demographics, setDemographics] = useState<DemographicOption[]>([]);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [activeSubTab, setActiveSubTab] = useState<'presets' | 'demographics'>('presets');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Input states for adding new pills
  const [newVariantInput, setNewVariantInput] = useState('');
  const [newMaterialInput, setNewMaterialInput] = useState('');
  const [newVolumeInput, setNewVolumeInput] = useState('');
  const [newSizeInput, setNewSizeInput] = useState('');
  const [selectedDemoIndex, setSelectedDemoIndex] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setPresets(getStoredCategoryPresets());
      setDemographics(getStoredDemographicOptions());
      setSelectedPresetIndex(0);
      setSelectedDemoIndex(0);
      setSuccessMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPreset = presets[selectedPresetIndex] || presets[0];
  const currentDemo = demographics[selectedDemoIndex] || demographics[0];

  const handleSaveAll = () => {
    saveStoredCategoryPresets(presets);
    saveStoredDemographicOptions(demographics);
    setSuccessMessage('Category presets and sizing pills saved successfully!');
    if (onPresetsUpdated) onPresetsUpdated();
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  const handleResetDefaults = () => {
    if (
      window.confirm(
        'Are you sure you want to reset all category pills, options, and sizing matrices back to factory defaults?'
      )
    ) {
      const resetData = resetCategoryPresetsToDefault();
      setPresets(resetData.presets);
      setDemographics(resetData.demographics);
      setSelectedPresetIndex(0);
      setSelectedDemoIndex(0);
      setSuccessMessage('Restored factory default category presets and sizing options.');
      if (onPresetsUpdated) onPresetsUpdated();
      setTimeout(() => setSuccessMessage(''), 3500);
    }
  };

  // Preset field modifications
  const updateCurrentPreset = (updates: Partial<CategoryPreset>) => {
    const updated = [...presets];
    updated[selectedPresetIndex] = {
      ...updated[selectedPresetIndex],
      ...updates,
    };
    setPresets(updated);
  };

  const handleAddPreset = () => {
    const newPreset: CategoryPreset = {
      id: `preset_${Date.now()}`,
      name: 'New Category',
      icon: '✨',
      profileType: 'general',
      defaultProductLine: 'Standard Line',
      variantLabel: 'Design / Option',
      variantPlaceholder: 'e.g. Option 1',
      commonVariants: ['Option A', 'Option B', 'Option C'],
      commonMaterials: ['Standard'],
      commonVolumes: ['One Size'],
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    setSelectedPresetIndex(updated.length - 1);
  };

  const handleDeletePreset = (index: number) => {
    if (presets.length <= 1) {
      alert('You must keep at least one category preset.');
      return;
    }
    const updated = presets.filter((_, i) => i !== index);
    setPresets(updated);
    setSelectedPresetIndex(Math.max(0, index - 1));
  };

  // Add/Remove Variants (Pills)
  const handleAddVariant = () => {
    if (!newVariantInput.trim() || !currentPreset) return;
    const clean = newVariantInput.trim();
    if (currentPreset.commonVariants.includes(clean)) return;
    updateCurrentPreset({
      commonVariants: [...currentPreset.commonVariants, clean],
    });
    setNewVariantInput('');
  };

  const handleRemoveVariant = (variantToRemove: string) => {
    if (!currentPreset) return;
    updateCurrentPreset({
      commonVariants: currentPreset.commonVariants.filter((v) => v !== variantToRemove),
    });
  };

  // Add/Remove Materials
  const handleAddMaterial = () => {
    if (!newMaterialInput.trim() || !currentPreset) return;
    const clean = newMaterialInput.trim();
    const existing = currentPreset.commonMaterials || [];
    if (existing.includes(clean)) return;
    updateCurrentPreset({
      commonMaterials: [...existing, clean],
    });
    setNewMaterialInput('');
  };

  const handleRemoveMaterial = (matToRemove: string) => {
    if (!currentPreset || !currentPreset.commonMaterials) return;
    updateCurrentPreset({
      commonMaterials: currentPreset.commonMaterials.filter((m) => m !== matToRemove),
    });
  };

  // Add/Remove Volumes/Weights
  const handleAddVolume = () => {
    if (!newVolumeInput.trim() || !currentPreset) return;
    const clean = newVolumeInput.trim();
    const existing = currentPreset.commonVolumes || [];
    if (existing.includes(clean)) return;
    updateCurrentPreset({
      commonVolumes: [...existing, clean],
    });
    setNewVolumeInput('');
  };

  const handleRemoveVolume = (volToRemove: string) => {
    if (!currentPreset || !currentPreset.commonVolumes) return;
    updateCurrentPreset({
      commonVolumes: currentPreset.commonVolumes.filter((v) => v !== volToRemove),
    });
  };

  // Sizing pills for demographics
  const handleAddSizeToDemo = () => {
    if (!newSizeInput.trim() || !currentDemo) return;
    const clean = newSizeInput.trim().toUpperCase();
    if (currentDemo.defaultSizes.includes(clean)) return;
    const updated = [...demographics];
    updated[selectedDemoIndex] = {
      ...currentDemo,
      defaultSizes: [...currentDemo.defaultSizes, clean],
    };
    setDemographics(updated);
    setNewSizeInput('');
  };

  const handleRemoveSizeFromDemo = (sizeToRemove: string) => {
    if (!currentDemo) return;
    const updated = [...demographics];
    updated[selectedDemoIndex] = {
      ...currentDemo,
      defaultSizes: currentDemo.defaultSizes.filter((s) => s !== sizeToRemove),
    };
    setDemographics(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#1E293B] flex items-center justify-between bg-[#0F1115]">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Customize Inventory Category Presets &amp; Sizing Pills
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Rename category buttons, edit quick-select pills (sizes, designs, materials), or add new presets.
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

        {/* Sub Navigation Bar */}
        <div className="px-4 py-2 border-b border-[#1E293B] bg-[#161B22] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('presets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'presets'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Category Presets &amp; Options ({presets.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('demographics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'demographics'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Shirt className="w-3.5 h-3.5" />
              <span>Apparel Demographics &amp; Sizes ({demographics.length})</span>
            </button>
          </div>

          <button
            onClick={handleResetDefaults}
            className="text-xs text-slate-400 hover:text-rose-300 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset to Factory Defaults</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {successMessage && (
          <div className="m-4 mb-0 p-3 bg-emerald-950/80 border border-emerald-600 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeSubTab === 'presets' ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Left Column: Preset List (4 cols) */}
              <div className="md:col-span-4 bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 space-y-2 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
                  <span className="text-[11px] font-bold uppercase text-slate-400">
                    Category Presets
                  </span>
                  <button
                    onClick={handleAddPreset}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Preset
                  </button>
                </div>

                <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[420px] pr-1">
                  {presets.map((p, idx) => {
                    const isSelected = selectedPresetIndex === idx;
                    return (
                      <div
                        key={p.id || p.name + idx}
                        onClick={() => setSelectedPresetIndex(idx)}
                        className={`p-2.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400'
                            : 'bg-[#161B22] text-slate-300 hover:bg-slate-800 border border-[#1E293B]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base">{p.icon}</span>
                          <span className="truncate">{p.name}</span>
                        </div>
                        <span className="text-[10px] opacity-75 capitalize font-mono">
                          {p.profileType}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Preset Editor (8 cols) */}
              {currentPreset && (
                <div className="md:col-span-8 bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <Edit2 className="w-3.5 h-3.5 text-emerald-400" /> Edit Preset: {currentPreset.name}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(selectedPresetIndex)}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Preset
                    </button>
                  </div>

                  {/* Preset General Settings */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Category Title
                      </label>
                      <input
                        type="text"
                        value={currentPreset.name}
                        onChange={(e) => updateCurrentPreset({ name: e.target.value })}
                        placeholder="e.g. T-Shirts"
                        className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Icon / Emoji
                      </label>
                      <input
                        type="text"
                        value={currentPreset.icon}
                        onChange={(e) => updateCurrentPreset({ icon: e.target.value })}
                        placeholder="e.g. 👕"
                        className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 text-center font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Behavior Profile Type
                      </label>
                      <select
                        value={currentPreset.profileType}
                        onChange={(e) =>
                          updateCurrentPreset({
                            profileType: e.target.value as CategoryProfileType,
                          })
                        }
                        className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 focus:outline-none focus:border-emerald-500 font-bold"
                      >
                        <option value="apparel">👕 Apparel (Sizes + Demographic)</option>
                        <option value="souvenirs">🔑 Souvenirs / Keyrings (Motif + Material)</option>
                        <option value="drinkware">☕ Drinkware (Capacity + Material)</option>
                        <option value="cosmetics">🧼 Cosmetics (Net Wt / Vol + Fragrance)</option>
                        <option value="bags">👜 Bags &amp; Accessories</option>
                        <option value="general">📦 General Merchandise</option>
                      </select>
                    </div>
                  </div>

                  {/* Design / Artwork / Option Quick Pills */}
                  <div className="space-y-2 pt-2 border-t border-[#1E293B]">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Artwork / Option Quick Pills
                      </label>
                      <span className="text-[10px] text-slate-400">
                        {currentPreset.commonVariants.length} Pills Available
                      </span>
                    </div>

                    {/* Variant Pills List */}
                    <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-[#161B22] rounded-lg border border-[#1E293B]">
                      {currentPreset.commonVariants.map((v) => (
                        <span
                          key={v}
                          className="bg-slate-800 text-slate-200 border border-slate-700 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1.5"
                        >
                          <span>{v}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(v)}
                            className="text-slate-400 hover:text-rose-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {currentPreset.commonVariants.length === 0 && (
                        <span className="text-xs text-slate-500 italic py-0.5">No option pills defined yet</span>
                      )}
                    </div>

                    {/* Add new variant pill */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newVariantInput}
                        onChange={(e) => setNewVariantInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddVariant();
                          }
                        }}
                        placeholder="Type new option (e.g. Vintage Palm) and press Add..."
                        className="flex-1 bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddVariant}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Pill
                      </button>
                    </div>
                  </div>

                  {/* Materials Quick Pills (For Souvenirs, Drinkware, Bags) */}
                  {(currentPreset.profileType === 'souvenirs' ||
                    currentPreset.profileType === 'drinkware' ||
                    currentPreset.profileType === 'bags' ||
                    currentPreset.profileType === 'general') && (
                    <div className="space-y-2 pt-2 border-t border-[#1E293B]">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" /> Material &amp; Craft Pills
                      </label>

                      <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-[#161B22] rounded-lg border border-[#1E293B]">
                        {(currentPreset.commonMaterials || []).map((m) => (
                          <span
                            key={m}
                            className="bg-amber-950/40 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1.5"
                          >
                            <span>{m}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterial(m)}
                              className="text-amber-400/60 hover:text-rose-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newMaterialInput}
                          onChange={(e) => setNewMaterialInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddMaterial();
                            }
                          }}
                          placeholder="Type material (e.g. Coconut Shell, Ceramic)..."
                          className="flex-1 bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={handleAddMaterial}
                          className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Material
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Volume / Capacities Quick Pills (Drinkware, Cosmetics) */}
                  {(currentPreset.profileType === 'cosmetics' ||
                    currentPreset.profileType === 'drinkware' ||
                    currentPreset.profileType === 'general') && (
                    <div className="space-y-2 pt-2 border-t border-[#1E293B]">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-rose-400" /> Volume / Capacity / Weight Pills
                      </label>

                      <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-[#161B22] rounded-lg border border-[#1E293B]">
                        {(currentPreset.commonVolumes || []).map((vol) => (
                          <span
                            key={vol}
                            className="bg-rose-950/40 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1.5"
                          >
                            <span>{vol}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveVolume(vol)}
                              className="text-rose-400/60 hover:text-rose-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newVolumeInput}
                          onChange={(e) => setNewVolumeInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddVolume();
                            }
                          }}
                          placeholder="Type volume (e.g. 100ml, 50g, 450ml)..."
                          className="flex-1 bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-rose-500"
                        />
                        <button
                          type="button"
                          onClick={handleAddVolume}
                          className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Volume
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Demographic & Sizes Tab */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Left Column: Demographics List */}
              <div className="md:col-span-4 bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 space-y-2">
                <span className="text-[11px] font-bold uppercase text-slate-400 block pb-2 border-b border-[#1E293B]">
                  Target Fit Categories
                </span>

                <div className="space-y-1.5">
                  {demographics.map((demo, idx) => {
                    const isSelected = selectedDemoIndex === idx;
                    return (
                      <div
                        key={demo.id}
                        onClick={() => setSelectedDemoIndex(idx)}
                        className={`p-2.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400'
                            : 'bg-[#161B22] text-slate-300 hover:bg-slate-800 border border-[#1E293B]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{demo.icon}</span>
                          <span>{demo.label}</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-80">
                          {demo.defaultSizes.length} sizes
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Size Pills Editor for Demographic */}
              {currentDemo && (
                <div className="md:col-span-8 bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
                    <div>
                      <h3 className="text-xs font-bold text-white flex items-center gap-2">
                        <span className="text-lg">{currentDemo.icon}</span>
                        <span>{currentDemo.label} - Size Options</span>
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        These size buttons will automatically appear when {currentDemo.label} is clicked in the Add Item modal.
                      </p>
                    </div>
                  </div>

                  {/* Size Pills Container */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-300">
                      Configured Size Pills ({currentDemo.defaultSizes.length})
                    </label>

                    <div className="flex flex-wrap gap-2 p-3 bg-[#161B22] rounded-xl border border-[#1E293B]">
                      {currentDemo.defaultSizes.map((sz) => (
                        <span
                          key={sz}
                          className="bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2"
                        >
                          <span>{sz}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSizeFromDemo(sz)}
                            className="text-emerald-400 hover:text-rose-400"
                            title="Remove Size"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Add Size Form */}
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        value={newSizeInput}
                        onChange={(e) => setNewSizeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSizeToDemo();
                          }
                        }}
                        placeholder="Add size code (e.g. 5XL, 3-4Y, One Size)..."
                        className="flex-1 bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                      />
                      <button
                        type="button"
                        onClick={handleAddSizeToDemo}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add Size
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1E293B] bg-[#0F1115] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>Changes take effect immediately across all inventory forms.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save &amp; Apply Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
