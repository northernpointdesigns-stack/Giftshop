import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Database,
  ChevronDown,
  ChevronRight,
  Grid,
  Layers,
  ArrowRight,
  Shirt,
  Info,
  Wand2,
  Check,
  Sliders,
  LayoutGrid,
  LayoutList,
  Copy,
  TrendingUp,
  Coins,
  Minus,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  ArrowUpDown,
  ShoppingBag,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { InventoryItem, Vendor, StaffUser } from '../../types/pos';
import { posDb } from '../../services/db';
import { getEffectiveCashierAccess } from '../../utils/cashierAccess';
import { BarcodePrinterModal } from './BarcodePrinterModal';
import { CsvImportModal } from './CsvImportModal';
import { AutoBackupModal } from './AutoBackupModal';
import { ApparelMatrixModal } from './ApparelMatrixModal';
import { ManagerPinGateModal } from '../auth/ManagerPinGateModal';
import { generateGS1GTIN13, validateGS1GTIN } from '../../utils/gs1Barcode';
import {
  getCategoryProfile,
  getStoredCategoryPresets,
  getStoredDemographicOptions,
  formatStandardItemName,
} from '../../utils/categoryProfiles';
import { CategoryPresetAdmin } from './CategoryPresetAdmin';

// Category Emoji icon resolver for visually appealing presentation
export const getCategoryEmoji = (category: string = ''): string => {
  const c = category.toLowerCase();
  if (c.includes('t-shirt') || c.includes('shirt') || c.includes('tee') || c.includes('hoodie') || c.includes('apparel')) return '👕';
  if (c.includes('pareo') || c.includes('silk') || c.includes('scarf') || c.includes('wrap')) return '🧣';
  if (c.includes('mug') || c.includes('cup') || c.includes('bottle') || c.includes('drink')) return '☕';
  if (c.includes('bag') || c.includes('tote') || c.includes('pouch') || c.includes('backpack')) return '👜';
  if (c.includes('soap') || c.includes('cosmetic') || c.includes('oil') || c.includes('lotion')) return '🧼';
  if (c.includes('keyring') || c.includes('keychain') || c.includes('key')) return '🔑';
  if (c.includes('souvenir') || c.includes('craft') || c.includes('magnet') || c.includes('tortoise')) return '🐚';
  if (c.includes('rum') || c.includes('spirit') || c.includes('beverage')) return '🍾';
  if (c.includes('spice') || c.includes('vanilla') || c.includes('tea')) return '🌿';
  return '📦';
};

// Robust display name resolver so items never appear blank or stripped
export const resolveItemDisplayName = (item: {
  name?: string;
  brand?: string;
  category?: string;
  productLine?: string;
  variant?: string;
}): string => {
  const rawName = (item.name || '').trim();
  const rawBrand = (item.brand || '').trim().toLowerCase();

  // If name is blank or merely repeats brand alone
  if (!rawName || (rawBrand && rawName.toLowerCase() === rawBrand)) {
    if (item.category && item.productLine && item.productLine !== 'Standard Line' && item.productLine !== 'Normal Line') {
      return `${item.category} - ${item.productLine}`;
    }
    if (item.category && item.variant) {
      return `${item.category} (${item.variant})`;
    }
    if (item.category) {
      return item.category;
    }
    return 'Retail Boutique Item';
  }

  return rawName;
};

// Helper component to highlight fuzzy match substrings
const HighlightText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  if (!text || !highlight || !highlight.trim()) {
    return <>{text}</>;
  }
  const cleanHighlight = highlight.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${cleanHighlight})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === highlight.trim().toLowerCase() ? (
          <span key={idx} className="bg-amber-400/30 text-amber-300 px-0.5 rounded font-bold underline decoration-amber-400/50">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};

interface InventoryAdminProps {
  inventory: InventoryItem[];
  vendors: Vendor[];
  onRefreshData: () => void;
  currentStaff?: StaffUser | null;
}

export const InventoryAdmin: React.FC<InventoryAdminProps> = ({
  inventory,
  vendors,
  onRefreshData,
  currentStaff,
}) => {
  const isAdmin = currentStaff?.role === 'admin';
  const isSupervisor = currentStaff?.role === 'senior_cashier' || currentStaff?.role === 'shift_lead';
  const isCashier = currentStaff?.role === 'cashier';
  // Resolve the logged-in cashier's per-account security gates (admin → full access).
  const cashierAccess = getEffectiveCashierAccess(currentStaff, posDb.getSettings());

  const [securityGateModal, setSecurityGateModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onSuccess: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onSuccess: () => {},
  });

  /** Gate-aware auth: cashiers who were granted the corresponding gate run directly. */
  const requireInventoryEdit = (title: string, description: string, onSuccess: () => void) => {
    // Admin OR cashier whose per-account gates include Create & Edit Inventory.
    if (isAdmin || cashierAccess.inventory_edit) {
      onSuccess();
    } else {
      setSecurityGateModal({
        isOpen: true,
        title,
        description,
        onSuccess: () => {
          setSecurityGateModal((prev) => ({ ...prev, isOpen: false }));
          onSuccess();
        },
      });
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('All');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('All');

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [matrixInitialProduct, setMatrixInitialProduct] = useState<any>(undefined);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isPrinterOpen, setIsPrinterOpen] = useState(false);
  const [isAutoBackupOpen, setIsAutoBackupOpen] = useState(false);
  const [printerInitialItemId, setPrinterInitialItemId] = useState<string | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Predictive search state
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close predictive dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    brand: 'Unbranded',
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

  // View & Filter Modes
  const [viewMode, setViewMode] = useState<'grouped' | 'flat' | 'cards'>('grouped');
  const [onlyLowStockFilter, setOnlyLowStockFilter] = useState(false);
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  const handleCopySku = (sku: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    setTimeout(() => setCopiedSku(null), 2000);
  };

  const handleQuickStockAdjust = (itemId: string, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    posDb.adjustStock(itemId, delta, {
      user: currentStaff?.name || 'Admin',
      reason: `Quick stock adjust ${delta >= 0 ? '+' : ''}${delta} from inventory panel`,
    });
    onRefreshData();
  };
  const [activePresetsList, setActivePresetsList] = useState(getStoredCategoryPresets());
  const [activeDemographicsList, setActiveDemographicsList] = useState(getStoredDemographicOptions());
  const [isCategoryPresetAdminOpen, setIsCategoryPresetAdminOpen] = useState(false);

  // Dynamic Category & Sizing Profile States
  const [selectedDemographic, setSelectedDemographic] = useState('Adult Male');
  const [selectedApparelSize, setSelectedApparelSize] = useState('M');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [selectedVolumeOrWeight, setSelectedVolumeOrWeight] = useState('');

  const reloadDynamicPresets = () => {
    setActivePresetsList(getStoredCategoryPresets());
    setActiveDemographicsList(getStoredDemographicOptions());
  };

  const activeCategoryProfile = useMemo(() => {
    return getCategoryProfile(formData.category, activePresetsList);
  }, [formData.category, activePresetsList]);

  const categories: string[] = ['All', ...Array.from(new Set(inventory.map((i) => i.category))) as string[]];
  const brands: string[] = [
    'All',
    ...(Array.from(new Set(inventory.map((i) => i.brand || 'Unbranded'))) as string[]),
  ];

  const handleSelectCategoryPreset = (categoryName: string) => {
    const profile = getCategoryProfile(categoryName, activePresetsList);
    let newDemographic = selectedDemographic;
    let newApparelSize = selectedApparelSize;
    let newMaterial = profile.preset?.commonMaterials?.[0] || '';
    let newVol = profile.preset?.commonVolumes?.[0] || '';
    let newSize = 'One Size';
    let newProductLine = profile.preset?.defaultProductLine || formData.productLine;

    if (profile.isApparel) {
      newSize = `${newDemographic} - ${newApparelSize}`;
    } else if (profile.isCosmetics || profile.isDrinkware) {
      newSize = newVol || 'Standard';
    } else {
      newSize = 'One Size';
    }

    setSelectedMaterial(newMaterial);
    setSelectedVolumeOrWeight(newVol);

    const updatedFormData = {
      ...formData,
      category: categoryName,
      productLine: newProductLine,
      size: newSize,
      variant: formData.variant || profile.preset?.commonVariants[0] || '',
    };

    const generatedName = formatStandardItemName({
      brand: updatedFormData.brand,
      category: updatedFormData.category,
      variant: updatedFormData.variant,
      demographic: newDemographic,
      size: profile.isApparel ? newApparelSize : newSize,
      material: newMaterial,
      volumeOrWeight: newVol,
    });

    if (generatedName) {
      updatedFormData.name = generatedName;
    }

    setFormData(updatedFormData);
  };

  const handleSelectDemographic = (demographicId: string) => {
    setSelectedDemographic(demographicId);
    const demo = activeDemographicsList.find((d) => d.id === demographicId);
    const firstSize = demo?.defaultSizes[1] || demo?.defaultSizes[0] || 'M';
    setSelectedApparelSize(firstSize);

    const newSize = `${demographicId} - ${firstSize}`;
    const updatedFormData = {
      ...formData,
      size: newSize,
    };

    const generatedName = formatStandardItemName({
      brand: updatedFormData.brand,
      category: updatedFormData.category,
      variant: updatedFormData.variant,
      demographic: demographicId,
      size: firstSize,
      material: selectedMaterial,
      volumeOrWeight: selectedVolumeOrWeight,
    });

    if (generatedName) {
      updatedFormData.name = generatedName;
    }

    setFormData(updatedFormData);
  };

  const handleSelectApparelSize = (sizeStr: string) => {
    setSelectedApparelSize(sizeStr);
    const newSize = `${selectedDemographic} - ${sizeStr}`;
    const updatedFormData = {
      ...formData,
      size: newSize,
    };

    const generatedName = formatStandardItemName({
      brand: updatedFormData.brand,
      category: updatedFormData.category,
      variant: updatedFormData.variant,
      demographic: selectedDemographic,
      size: sizeStr,
      material: selectedMaterial,
      volumeOrWeight: selectedVolumeOrWeight,
    });

    if (generatedName) {
      updatedFormData.name = generatedName;
    }

    setFormData(updatedFormData);
  };

  const handleSelectVariant = (variantStr: string) => {
    const updatedFormData = {
      ...formData,
      variant: variantStr,
    };

    const generatedName = formatStandardItemName({
      brand: updatedFormData.brand,
      category: updatedFormData.category,
      variant: variantStr,
      demographic: selectedDemographic,
      size: activeCategoryProfile.isApparel ? selectedApparelSize : updatedFormData.size,
      material: selectedMaterial,
      volumeOrWeight: selectedVolumeOrWeight,
    });

    if (generatedName) {
      updatedFormData.name = generatedName;
    }

    setFormData(updatedFormData);
  };

  const handleSelectMaterial = (materialStr: string) => {
    setSelectedMaterial(materialStr);
    const generatedName = formatStandardItemName({
      brand: formData.brand,
      category: formData.category,
      variant: formData.variant,
      demographic: selectedDemographic,
      size: activeCategoryProfile.isApparel ? selectedApparelSize : formData.size,
      material: materialStr,
      volumeOrWeight: selectedVolumeOrWeight,
    });

    if (generatedName) {
      setFormData((prev) => ({ ...prev, name: generatedName }));
    }
  };

  const handleSelectVolume = (volumeStr: string) => {
    setSelectedVolumeOrWeight(volumeStr);
    const updatedFormData = {
      ...formData,
      size: volumeStr,
    };

    const generatedName = formatStandardItemName({
      brand: updatedFormData.brand,
      category: updatedFormData.category,
      variant: updatedFormData.variant,
      demographic: selectedDemographic,
      size: volumeStr,
      material: selectedMaterial,
      volumeOrWeight: volumeStr,
    });

    if (generatedName) {
      updatedFormData.name = generatedName;
    }

    setFormData(updatedFormData);
  };

  const handleAutoFormatTitle = () => {
    const generatedName = formatStandardItemName({
      brand: formData.brand,
      category: formData.category,
      variant: formData.variant,
      demographic: selectedDemographic,
      size: activeCategoryProfile.isApparel ? selectedApparelSize : formData.size,
      material: selectedMaterial,
      volumeOrWeight: selectedVolumeOrWeight,
    });

    if (generatedName) {
      setFormData((prev) => ({ ...prev, name: generatedName }));
    }
  };

  const handleOpenAddModal = (presetCategory?: string) => {
    setEditingItem(null);
    const cat = presetCategory || 'T-Shirts';
    const profile = getCategoryProfile(cat);
    const initialGtin = generateGS1GTIN13('950');

    setSelectedDemographic('Adult Male');
    setSelectedApparelSize('M');
    setSelectedMaterial(profile.preset?.commonMaterials?.[0] || '');
    setSelectedVolumeOrWeight(profile.preset?.commonVolumes?.[0] || '');

    const initialSize = profile.isApparel ? 'Adults - Medium' : (profile.preset?.commonVolumes?.[0] || 'One Size');
    const initialProductLine = profile.preset?.defaultProductLine || 'Beach Heritage';
    const initialVariant = profile.preset?.commonVariants[0] || '';

    const newFormData = {
      name: '',
      brand: 'Unbranded',
      category: cat,
      productLine: initialProductLine,
      size: initialSize,
      variant: initialVariant,
      sku: initialGtin,
      stockLevel: 20,
      minStockThreshold: 5,
      retailPrice: cat === 'Keyrings' ? 8.0 : cat === 'Mugs' ? 14.0 : cat === 'Soaps & Cosmetics' ? 9.5 : 25.0,
      costBasis: cat === 'Keyrings' ? 3.0 : cat === 'Mugs' ? 5.5 : cat === 'Soaps & Cosmetics' ? 4.0 : 12.5,
      vatRate: 0.15,
      vendorId: vendors[0]?.id || '',
      imageUrl: '',
    };

    const generatedName = formatStandardItemName({
      brand: newFormData.brand,
      category: newFormData.category,
      variant: initialVariant,
      demographic: 'Adult Male',
      size: profile.isApparel ? 'M' : initialSize,
      material: profile.preset?.commonMaterials?.[0],
      volumeOrWeight: profile.preset?.commonVolumes?.[0],
    });
    newFormData.name = generatedName || '';

    setFormData(newFormData);
    setIsItemModalOpen(true);
  };

  const handleGenerateGs1Sku = () => {
    const newGtin = generateGS1GTIN13('950');
    setFormData((prev) => ({ ...prev, sku: newGtin }));
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    const profile = getCategoryProfile(item.category);

    let initialDemographic = 'Adult Male';
    const combinedStr = `${item.size || ''} ${item.name || ''}`.toLowerCase();
    if (combinedStr.includes('kid') || combinedStr.includes('child') || combinedStr.includes('youth') || /\d+-\d+y/i.test(combinedStr)) {
      initialDemographic = 'Child / Kids';
    } else if (combinedStr.includes('baby') || combinedStr.includes('infant') || /\d+-\d+m/i.test(combinedStr)) {
      initialDemographic = 'Baby / Infant';
    } else if (combinedStr.includes('women') || combinedStr.includes('female') || combinedStr.includes('ladies')) {
      initialDemographic = 'Adult Female';
    } else if (combinedStr.includes('unisex')) {
      initialDemographic = 'Unisex Adult';
    }

    setSelectedDemographic(initialDemographic);
    setSelectedApparelSize(item.size || 'M');
    setSelectedMaterial('');
    setSelectedVolumeOrWeight(item.size && (item.size.includes('g') || item.size.includes('ml')) ? item.size : '');

    setFormData({
      name: item.name,
      brand: item.brand || 'Unbranded',
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

  // Compress & store a product photo as a small JPEG data URL (offline-safe)
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
        setFormData((f) => ({ ...f, imageUrl: canvas.toDataURL('image/jpeg', 0.75) }));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveItem = (e?: React.FormEvent, shouldPrint: boolean = false) => {
    if (e) e.preventDefault();

    let finalName = (formData.name || '').trim();
    if (!finalName || (formData.brand && finalName.toLowerCase() === formData.brand.toLowerCase())) {
      finalName = formatStandardItemName({
        brand: formData.brand,
        category: formData.category,
        variant: formData.variant,
        demographic: selectedDemographic,
        size: activeCategoryProfile.isApparel ? selectedApparelSize : formData.size,
        material: selectedMaterial,
        volumeOrWeight: selectedVolumeOrWeight,
      }) || `${formData.category}${formData.variant ? ' - ' + formData.variant : ''}`;
    }

    const savedItem = posDb.saveItem(
      {
        ...(editingItem ? { id: editingItem.id } : {}),
        name: finalName,
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
      },
      editingItem
        ? {
            user: currentStaff?.name || 'Admin',
            reason: 'Catalog item edited from inventory panel',
          }
        : undefined
    );

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

  const handleOpenPrinterForItems = (itemIds: string[]) => {
    if (itemIds.length > 0) {
      setPrinterInitialItemId(itemIds[0]);
      setIsPrinterOpen(true);
    }
  };

  const handleOpenPrinterAll = () => {
    setPrinterInitialItemId(undefined);
    setIsPrinterOpen(true);
  };

  const handleOpenMatrixModal = (productGroup?: {
    name: string;
    brand: string;
    category: string;
    productLine: string;
    vendorId: string;
    minPrice: number;
    minCost: number;
  }) => {
    if (productGroup) {
      setMatrixInitialProduct({
        name: productGroup.name,
        brand: productGroup.brand,
        category: productGroup.category,
        productLine: productGroup.productLine,
        vendorId: productGroup.vendorId,
        retailPrice: productGroup.minPrice,
        costBasis: productGroup.minCost,
        vatRate: 0.15,
      });
    } else {
      setMatrixInitialProduct(undefined);
    }
    setIsMatrixModalOpen(true);
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

  // Predictive fuzzy scoring algorithm for barcode partials, SKUs, and keywords
  const getFuzzyItemScore = (item: InventoryItem, q: string): number => {
    const cleanQ = q.trim().toLowerCase();
    if (!cleanQ) return 1;
    let score = 0;
    const sku = item.sku.toLowerCase();
    const name = item.name.toLowerCase();
    const variant = (item.variant || '').toLowerCase();
    const brand = (item.brand || '').toLowerCase();
    const category = item.category.toLowerCase();
    const size = (item.size || '').toLowerCase();

    // Barcode / SKU exact & prefix & substring
    if (sku === cleanQ) score += 100;
    else if (sku.startsWith(cleanQ)) score += 80;
    else if (sku.includes(cleanQ)) score += 60;

    // Partial numeric search on barcode
    const numericQ = cleanQ.replace(/\D/g, '');
    const numericSku = sku.replace(/\D/g, '');
    if (numericQ.length >= 3 && numericSku.includes(numericQ)) {
      score += 65;
    }

    // Name / Variant / Size matches
    if (name.includes(cleanQ)) score += 50;
    if (variant.includes(cleanQ)) score += 45;
    if (size.includes(cleanQ)) score += 40;
    if (brand.includes(cleanQ)) score += 30;
    if (category.includes(cleanQ)) score += 20;

    // Multi-token match (e.g. "coconut blue", "turtle large")
    const tokens = cleanQ.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      const combined = `${brand} ${category} ${name} ${variant} ${size} ${sku}`;
      if (tokens.every((t) => combined.includes(t))) {
        score += 70;
      }
    }

    return score;
  };

  const filteredInventory = useMemo(() => {
    return inventory
      .map((item) => ({
        item,
        score: getFuzzyItemScore(item, searchQuery),
      }))
      .filter(({ item, score }) => {
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        const matchesBrand = selectedBrandFilter === 'All' || (item.brand || 'Unbranded') === selectedBrandFilter;
        const matchesVendor = selectedVendorFilter === 'All' || item.vendorId === selectedVendorFilter;
        const matchesLowStock = !onlyLowStockFilter || item.stockLevel <= item.minStockThreshold;
        return score > 0 && matchesCategory && matchesBrand && matchesVendor && matchesLowStock;
      })
      .sort((a, b) => (searchQuery.trim() ? b.score - a.score : 0))
      .map(({ item }) => item);
  }, [inventory, searchQuery, selectedCategory, selectedBrandFilter, selectedVendorFilter, onlyLowStockFilter]);

  // Predictive search top suggestions
  const predictiveMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return inventory
      .map((item) => ({ item, score: getFuzzyItemScore(item, searchQuery) }))
      .filter((x) => x.score > 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.item);
  }, [inventory, searchQuery]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const toggleAllGroups = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    if (expand) {
      productGroups.forEach((g) => {
        next[g.id] = true;
      });
    }
    setExpandedGroups(next);
  };

  // Group inventory items by product (brand + category + resolved name)
  const productGroups = useMemo(() => {
    const groups = new Map<string, InventoryItem[]>();
    filteredInventory.forEach((item) => {
      const displayName = resolveItemDisplayName(item);
      const key = `${item.brand || 'Unbranded'}|${item.category}|${displayName}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });

    return Array.from(groups.entries())
      .map(([key, items]) => {
        const resolvedName = resolveItemDisplayName(items[0]);
        const totalUnits = items.reduce((sum, i) => sum + i.stockLevel, 0);
        const lowStockVariants = items.filter((i) => i.stockLevel <= i.minStockThreshold);
        const minRetail = Math.min(...items.map((i) => i.retailPrice));
        const maxRetail = Math.max(...items.map((i) => i.retailPrice));
        const minCost = Math.min(...items.map((i) => i.costBasis));
        const maxCost = Math.max(...items.map((i) => i.costBasis));
        const avgMargin = minRetail > 0 ? ((minRetail - minCost) / minRetail) * 100 : 0;

        return {
          id: key,
          brand: items[0].brand || 'Unbranded',
          category: items[0].category,
          name: resolvedName,
          productLine: items[0].productLine || 'Standard Line',
          imageUrl: items.find((i) => i.imageUrl)?.imageUrl,
          items,
          totalStock: totalUnits,
          lowStockCount: lowStockVariants.length,
          minPrice: minRetail,
          maxPrice: maxRetail,
          minCost: minCost,
          maxCost: maxCost,
          avgMargin,
          vendorId: items[0].vendorId,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredInventory, searchQuery]);

  // Overall catalog summary stats
  const catalogMetrics = useMemo(() => {
    const totalProducts = productGroups.length;
    const totalSkus = filteredInventory.length;
    const totalUnits = filteredInventory.reduce((sum, i) => sum + i.stockLevel, 0);
    const totalRetailVal = filteredInventory.reduce((sum, i) => sum + i.stockLevel * i.retailPrice, 0);
    const totalCostVal = filteredInventory.reduce((sum, i) => sum + i.stockLevel * i.costBasis, 0);
    const lowStockTotal = filteredInventory.filter((i) => i.stockLevel <= i.minStockThreshold).length;
    const overallMargin = totalRetailVal > 0 ? ((totalRetailVal - totalCostVal) / totalRetailVal) * 100 : 0;

    return {
      totalProducts,
      totalSkus,
      totalUnits,
      totalRetailVal,
      totalCostVal,
      lowStockTotal,
      overallMargin,
    };
  }, [productGroups, filteredInventory]);

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161B22] border border-[#1E293B] p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-[#E2E8F0] flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" /> Catalog & Inventory Manager
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage vendor brand stock, apparel size matrices, and GS1 GTIN barcode labeling
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAutoBackupOpen(true)}
            title="Scheduled Auto-Backup & SQLite Database Persistence"
            className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Database className="w-4 h-4 text-cyan-400" />
            <span>SQLite Auto-Backup</span>
          </button>

          <button
            onClick={() => requireInventoryEdit('CSV Import Restricted', 'Shop Owner or Manager PIN required to bulk import catalog data via CSV.', () => setIsCsvModalOpen(true))}
            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => requireInventoryEdit('Apparel Matrix Restricted', 'Shop Owner or Manager PIN required to create matrix products.', () => handleOpenMatrixModal())}
            className="bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 hover:from-emerald-600/30 hover:to-cyan-600/30 text-emerald-300 border border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs"
            title="Open Apparel Matrix Grid (Color columns × Size rows generator)"
          >
            <Grid className="w-4 h-4 text-emerald-400" />
            <span>Apparel Matrix Generator</span>
          </button>

          <button
            onClick={handleOpenPrinterAll}
            className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <BarcodeIcon className="w-4 h-4 text-cyan-400" />
            <span>GS1 Barcode Printer</span>
          </button>

          <button
            onClick={() => requireInventoryEdit('Add Item Restricted', 'Shop Owner or Manager PIN required to add new inventory products.', () => handleOpenAddModal())}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Single Item</span>
          </button>
        </div>
      </div>

      {/* KPI Catalog Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="bg-[#161B22] border border-[#1E293B] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Products</span>
            <span className="text-base font-bold text-[#E2E8F0] font-mono">{catalogMetrics.totalProducts}</span>
            <span className="text-[10px] text-slate-500 block">{catalogMetrics.totalSkus} SKUs/Variants</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Package className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#161B22] border border-[#1E293B] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Units on Hand</span>
            <span className="text-base font-bold text-emerald-400 font-mono">{catalogMetrics.totalUnits}</span>
            <span className="text-[10px] text-slate-500 block">Across catalog</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ShoppingBag className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#161B22] border border-[#1E293B] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Retail Valuation</span>
            <span className="text-base font-bold text-[#E2E8F0] font-mono">${catalogMetrics.totalRetailVal.toFixed(0)}</span>
            <span className="text-[10px] text-emerald-400 block font-mono">Margin: {isAdmin ? `${catalogMetrics.overallMargin.toFixed(0)}%` : '***'}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#161B22] border border-[#1E293B] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cost Basis</span>
            <span className="text-base font-bold text-slate-300 font-mono">{isAdmin ? `$${catalogMetrics.totalCostVal.toFixed(0)}` : '***'}</span>
            <span className="text-[10px] text-slate-500 block">Inventory investment</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <Coins className="w-4 h-4" />
          </div>
        </div>

        <div 
          onClick={() => setOnlyLowStockFilter(!onlyLowStockFilter)}
          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
            onlyLowStockFilter 
              ? 'bg-amber-950/60 border-amber-500 text-amber-300 ring-1 ring-amber-500/50' 
              : 'bg-[#161B22] border-[#1E293B] hover:border-amber-500/40 text-slate-300'
          }`}
          title="Click to toggle low stock filter"
        >
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block text-amber-400">Low Stock Alert</span>
            <span className="text-base font-bold text-amber-400 font-mono">{catalogMetrics.lowStockTotal}</span>
            <span className="text-[10px] text-slate-400 block">
              {onlyLowStockFilter ? 'Filtering applied (click to reset)' : 'Needs reordering'}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter Bar & Predictive Fuzzy Search & View Mode Switcher */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-4 relative" ref={searchContainerRef}>
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchFocused(true);
            }}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Search: barcode partial, SKU keyword, design, brand..."
            className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl pl-9 pr-8 py-2 text-xs text-[#E2E8F0] placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-sm"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Predictive Auto-Suggest Dropdown */}
          {isSearchFocused && predictiveMatches.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-[#161B22] border border-[#1E293B] rounded-xl shadow-2xl overflow-hidden divide-y divide-[#1E293B]">
              <div className="p-2 bg-[#0F1115] text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Predictive Matches ({predictiveMatches.length})</span>
                <span className="text-[9px] text-emerald-400 font-mono">Instant Jump</span>
              </div>
              {predictiveMatches.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    const resolvedName = resolveItemDisplayName(item);
                    setSearchQuery(resolvedName);
                    setIsSearchFocused(false);
                    const key = `${item.brand || 'Unbranded'}|${item.category}|${resolvedName}`;
                    setExpandedGroups((prev) => ({ ...prev, [key]: true }));
                  }}
                  className="p-2.5 hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-[#E2E8F0] truncate">
                      <HighlightText text={resolveItemDisplayName(item)} highlight={searchQuery} />
                      {item.variant && (
                        <span className="text-[10px] bg-cyan-950/70 text-cyan-300 border border-cyan-800/40 px-1.5 py-0.2 rounded font-normal">
                          <HighlightText text={item.variant} highlight={searchQuery} />
                        </span>
                      )}
                      {item.size && (
                        <span className="text-[10px] bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 px-1.5 py-0.2 rounded font-mono">
                          <HighlightText text={item.size} highlight={searchQuery} />
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>SKU: <HighlightText text={item.sku} highlight={searchQuery} /></span>
                      <span>• {item.brand || 'Unbranded'}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-[#E2E8F0] block">
                      ${item.retailPrice.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {item.stockLevel} in stock
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <select
            value={selectedBrandFilter}
            onChange={(e) => setSelectedBrandFilter(e.target.value)}
            className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All Brands</option>
            {brands.filter((b) => b !== 'All').map((b) => (
              <option key={b} value={b}>
                {b}
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
                {c === 'All' ? 'All Categories' : `${getCategoryEmoji(c)} ${c}`}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={selectedVendorFilter}
            onChange={(e) => setSelectedVendorFilter(e.target.value)}
            className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All Suppliers</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Segmented Switcher & Group Expanders */}
        <div className="md:col-span-2 flex items-center justify-end gap-1.5">
          <div className="bg-[#0F1115] border border-[#1E293B] p-0.5 rounded-lg flex items-center">
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'grouped'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Hierarchical Master-Detail View"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[11px]">Grouped</span>
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'flat'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Flat SKU Barcode View for quick inventory counting"
            >
              <BarcodeIcon className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[11px]">Flat SKUs</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'cards'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Visual Product Card Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[11px]">Cards</span>
            </button>
          </div>

          {viewMode === 'grouped' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleAllGroups(true)}
                className="p-1.5 bg-[#161B22] border border-[#1E293B] hover:border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg text-xs"
                title="Expand all product groups"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => toggleAllGroups(false)}
                className="p-1.5 bg-[#161B22] border border-[#1E293B] hover:border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg text-xs"
                title="Collapse all product groups"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Copy Toast Feedback */}
      {copiedSku && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" />
          <span>Copied SKU: {copiedSku}</span>
        </div>
      )}

      {/* VIEW 1: MASTER-DETAIL TABLE (GROUPED VIEW) */}
      {viewMode === 'grouped' && (
        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0F1115] text-slate-400 font-semibold border-b border-[#1E293B] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 w-10 text-center"></th>
                  <th className="p-3.5">Product & Collection</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5 text-right">Retail Price</th>
                  <th className="p-3.5 text-right">Cost Basis</th>
                  <th className="p-3.5 text-center">Margin</th>
                  <th className="p-3.5 text-center">Total Stock</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {productGroups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Package className="w-8 h-8 text-slate-600" />
                        <span className="text-sm font-semibold text-slate-400">No matching products found</span>
                        <span className="text-xs text-slate-500">Try adjusting your search keywords or active filters.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  productGroups.map((group) => {
                    const isExpanded = expandedGroups[group.id] || searchQuery.trim().length > 0;
                    const hasLowStock = group.lowStockCount > 0;
                    const isOutOfStock = group.totalStock === 0;
                    const priceStr = group.minPrice === group.maxPrice
                      ? `$${group.minPrice.toFixed(2)}`
                      : `$${group.minPrice.toFixed(2)} - $${group.maxPrice.toFixed(2)}`;
                    const costStr = group.minCost === group.maxCost
                      ? `$${group.minCost.toFixed(2)}`
                      : `$${group.minCost.toFixed(2)} - $${group.maxCost.toFixed(2)}`;
                    const categoryEmoji = getCategoryEmoji(group.category);

                    return (
                      <React.Fragment key={group.id}>
                        {/* Parent Product Master Row */}
                        <tr
                          className={`transition-colors cursor-pointer group ${
                            isExpanded ? 'bg-[#1C2333]/70 hover:bg-[#1C2333]' : 'hover:bg-slate-800/40'
                          }`}
                          onClick={() => toggleGroup(group.id)}
                        >
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              className="p-1 rounded text-slate-400 group-hover:text-emerald-400 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGroup(group.id);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                              )}
                            </button>
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              {/* Category Avatar / Image */}
                              <div className="w-9 h-9 rounded-lg bg-[#0F1115] border border-[#1E293B] flex items-center justify-center text-lg shrink-0 overflow-hidden shadow-xs">
                                {group.imageUrl ? (
                                  <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{categoryEmoji}</span>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                    <HighlightText text={group.brand} highlight={searchQuery} />
                                  </span>
                                  <span className="font-bold text-sm text-[#E2E8F0] tracking-tight">
                                    <HighlightText text={group.name} highlight={searchQuery} />
                                  </span>
                                  <span className="text-[10px] text-slate-400 bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 rounded-full font-medium">
                                    {group.items.length} {group.items.length === 1 ? 'variant' : 'variants'}
                                  </span>
                                  {hasLowStock && (
                                    <span
                                      className="text-amber-400 flex items-center gap-1 text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold"
                                      title={`${group.lowStockCount} variants below minimum stock threshold`}
                                    >
                                      <AlertTriangle className="w-3 h-3" /> Low Stock ({group.lowStockCount})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                                  <span>Line: {group.productLine}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/40">
                              <span>{categoryEmoji}</span>
                              <HighlightText text={group.category} highlight={searchQuery} />
                            </span>
                          </td>

                          <td className="p-3.5 text-right font-mono font-bold text-sm text-[#E2E8F0]">
                            {priceStr}
                          </td>

                          <td className="p-3.5 text-right font-mono text-xs text-slate-400">
                            {isAdmin ? costStr : <span className="text-slate-500 font-mono text-[10px] italic">*** (Locked)</span>}
                          </td>

                          <td className="p-3.5 text-center font-mono">
                            {isAdmin ? (
                              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                                {group.avgMargin.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">***</span>
                            )}
                          </td>

                          <td className="p-3.5 text-center">
                            <span
                              className={`font-mono font-bold px-2.5 py-1 rounded-lg text-xs inline-flex items-center gap-1.5 ${
                                isOutOfStock
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                                  : hasLowStock
                                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                  : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? 'bg-rose-400' : hasLowStock ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                              {group.totalStock} units
                            </span>
                          </td>

                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleOpenMatrixModal(group)}
                                className="text-[11px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-bold transition-colors flex items-center gap-1 shadow-xs"
                                title="Open Apparel Matrix Grid for this product"
                              >
                                <Grid className="w-3 h-3" />
                                <span>+ Matrix</span>
                              </button>

                              <button
                                onClick={() => {
                                  // Prepopulate add single item with this group info
                                  setFormData((f) => ({
                                    ...f,
                                    name: group.name,
                                    brand: group.brand,
                                    category: group.category,
                                    productLine: group.productLine,
                                    vendorId: group.vendorId,
                                    retailPrice: group.minPrice,
                                    costBasis: group.minCost,
                                    variant: '',
                                    sku: generateGS1GTIN13('950'),
                                  }));
                                  setEditingItem(null);
                                  setIsItemModalOpen(true);
                                }}
                                className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1"
                                title="Add a single new variant to this product"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add Var</span>
                              </button>

                              <button
                                onClick={() => toggleGroup(group.id)}
                                className="text-xs text-cyan-400 hover:text-cyan-300 font-bold px-2 py-1 flex items-center gap-0.5"
                              >
                                {isExpanded ? 'Hide' : `Variants (${group.items.length})`}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* MASTER-DETAIL EXPANDED DRAWER */}
                        {isExpanded && (
                          <tr className="bg-[#0C0F14] border-t border-b border-emerald-500/30">
                            <td colSpan={8} className="p-0">
                              <div className="p-4 pl-12 bg-gradient-to-r from-emerald-950/20 via-[#0C0F14] to-[#0C0F14] border-l-4 border-emerald-500 space-y-3">
                                {/* Sub-header / Summary info */}
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-[#E2E8F0] flex items-center gap-1.5">
                                      <Layers className="w-4 h-4 text-emerald-400" />
                                      {group.name} — Size & Variant SKUs
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      ({group.items.length} active SKUs on file)
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleOpenPrinterForItems(group.items.map((i) => i.id))}
                                      className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                      <span>Print All {group.items.length} Barcodes</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Nested Variants Table */}
                                <div className="border border-[#1E293B] rounded-xl overflow-hidden bg-[#161B22]">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-[#0F1115] text-slate-400 font-semibold border-b border-[#1E293B] uppercase tracking-wider text-[10px]">
                                      <tr>
                                        <th className="p-2.5">Variant / Artwork</th>
                                        <th className="p-2.5">Size / Fit</th>
                                        <th className="p-2.5">Barcode / SKU</th>
                                        <th className="p-2.5 text-right">Retail Price</th>
                                        <th className="p-2.5 text-right">Cost Basis</th>
                                        <th className="p-2.5 text-center">Margin</th>
                                        <th className="p-2.5 text-center">Stock on Hand</th>
                                        <th className="p-2.5 text-right">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#1E293B]">
                                      {group.items.map((item) => {
                                        const vendor = posDb.getVendorById(item.vendorId);
                                        const isConsignment = vendor?.supplierType === 'consignment';
                                        const isLowStock = item.stockLevel <= item.minStockThreshold;
                                        const isOutOfStock = item.stockLevel === 0;
                                        const isGs1Gtin = validateGS1GTIN(item.sku).isValid;
                                        const itemMargin = item.retailPrice > 0
                                          ? ((item.retailPrice - item.costBasis) / item.retailPrice) * 100
                                          : 0;

                                        return (
                                          <tr
                                            key={item.id}
                                            className="hover:bg-slate-800/30 transition-colors"
                                          >
                                            <td className="p-2.5">
                                              <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                                <span className="font-semibold text-[#E2E8F0]">
                                                  {item.variant ? (
                                                    <HighlightText text={item.variant} highlight={searchQuery} />
                                                  ) : (
                                                    <span className="text-slate-400">Standard Variant</span>
                                                  )}
                                                </span>
                                              </div>
                                            </td>

                                            <td className="p-2.5 font-mono text-emerald-400 font-bold">
                                              <HighlightText text={item.size || 'One Size'} highlight={searchQuery} />
                                            </td>

                                            <td className="p-2.5">
                                              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
                                                <span><HighlightText text={item.sku} highlight={searchQuery} /></span>
                                                <button
                                                  onClick={(e) => handleCopySku(item.sku, e)}
                                                  className="p-1 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                                                  title="Copy Barcode SKU"
                                                >
                                                  <Copy className="w-3 h-3" />
                                                </button>
                                                {isGs1Gtin && (
                                                  <span className="text-[9px] font-sans font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20">
                                                    GS1 GTIN-13
                                                  </span>
                                                )}
                                              </div>
                                            </td>

                                            <td className="p-2.5 text-right font-mono font-bold text-[#E2E8F0]">
                                              ${item.retailPrice.toFixed(2)}
                                              <span className="block text-[9px] text-cyan-400 font-normal">
                                                VAT: {((item.vatRate ?? 0.15) * 100).toFixed(0)}%
                                              </span>
                                            </td>

                                            <td className="p-2.5 text-right font-mono text-slate-400">
                                              ${item.costBasis.toFixed(2)}
                                              {isConsignment && (
                                                <span className="block text-[9px] text-amber-400">
                                                  (Consignment)
                                                </span>
                                              )}
                                            </td>

                                            <td className="p-2.5 text-center font-mono text-[11px] text-emerald-400">
                                              {itemMargin.toFixed(0)}%
                                            </td>

                                            {/* Interactive Quick Stock Steppers */}
                                            <td className="p-2.5 text-center">
                                              <div className="inline-flex items-center gap-1 bg-[#0F1115] border border-[#1E293B] rounded-lg p-0.5">
                                                <button
                                                  onClick={(e) => handleQuickStockAdjust(item.id, -1, e)}
                                                  disabled={item.stockLevel <= 0}
                                                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                                  title="Decrease stock by 1"
                                                >
                                                  <Minus className="w-3 h-3" />
                                                </button>

                                                <span
                                                  className={`font-mono font-bold px-2 py-0.5 rounded text-xs min-w-[36px] text-center ${
                                                    isOutOfStock
                                                      ? 'text-rose-400'
                                                      : isLowStock
                                                      ? 'text-amber-400'
                                                      : 'text-emerald-400'
                                                  }`}
                                                >
                                                  {item.stockLevel}
                                                </span>

                                                <button
                                                  onClick={(e) => handleQuickStockAdjust(item.id, 1, e)}
                                                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/40 transition-colors"
                                                  title="Increase stock by 1"
                                                >
                                                  <Plus className="w-3 h-3" />
                                                </button>

                                                <button
                                                  onClick={(e) => handleQuickStockAdjust(item.id, 10, e)}
                                                  className="px-1.5 h-6 text-[10px] font-mono font-bold rounded text-cyan-400 hover:bg-cyan-950/40 border-l border-[#1E293B] transition-colors"
                                                  title="Restock +10 units"
                                                >
                                                  +10
                                                </button>
                                              </div>
                                            </td>

                                            <td className="p-2.5 text-right">
                                              <div className="flex items-center justify-end gap-1">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenPrinterForSingleItem(item.id);
                                                  }}
                                                  className="p-1.5 text-cyan-400 hover:bg-cyan-950/50 rounded-lg transition-colors border border-cyan-800/30"
                                                  title="Print GS1 Barcode Label"
                                                >
                                                  <BarcodeIcon className="w-3.5 h-3.5" />
                                                </button>

                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenEditModal(item);
                                                  }}
                                                  className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/40"
                                                  title="Edit Variant"
                                                >
                                                  <Edit2 className="w-3.5 h-3.5" />
                                                </button>

                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteItem(item.id);
                                                  }}
                                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/40"
                                                  title="Delete Variant"
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
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: FLAT SKU TABLE (FAST SCANNING / INVENTORY COUNTING) */}
      {viewMode === 'flat' && (
        <div className="bg-[#161B22] border border-[#1E293B] rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0F1115] text-slate-400 font-semibold border-b border-[#1E293B] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Brand & Product</th>
                  <th className="p-3">Variant / Design</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">SKU / GTIN-13</th>
                  <th className="p-3 text-right">Retail Price</th>
                  <th className="p-3 text-right">Cost Basis</th>
                  <th className="p-3 text-center">Margin</th>
                  <th className="p-3 text-center">Stock on Hand</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-500">
                      No matching SKU items found.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => {
                    const isLowStock = item.stockLevel <= item.minStockThreshold;
                    const isOutOfStock = item.stockLevel === 0;
                    const isGs1Gtin = validateGS1GTIN(item.sku).isValid;
                    const itemMargin = item.retailPrice > 0
                      ? ((item.retailPrice - item.costBasis) / item.retailPrice) * 100
                      : 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-[#E2E8F0] flex items-center gap-1.5">
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.2 rounded font-bold">
                              {item.brand || 'Unbranded'}
                            </span>
                            <HighlightText text={resolveItemDisplayName(item)} highlight={searchQuery} />
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {getCategoryEmoji(item.category)} {item.category} • {item.productLine}
                          </div>
                        </td>

                        <td className="p-3 text-slate-200 font-semibold">
                          <HighlightText text={item.variant || 'Standard'} highlight={searchQuery} />
                        </td>

                        <td className="p-3 font-mono text-emerald-400 font-bold">
                          <HighlightText text={item.size || 'One Size'} highlight={searchQuery} />
                        </td>

                        <td className="p-3 font-mono text-xs">
                          <div className="flex items-center gap-1.5">
                            <HighlightText text={item.sku} highlight={searchQuery} />
                            <button
                              onClick={(e) => handleCopySku(item.sku, e)}
                              className="p-1 text-slate-500 hover:text-emerald-400 rounded"
                              title="Copy SKU"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            {isGs1Gtin && (
                              <span className="text-[9px] font-sans font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20">
                                GS1
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-3 text-right font-mono font-bold text-[#E2E8F0]">
                          ${item.retailPrice.toFixed(2)}
                        </td>

                        <td className="p-3 text-right font-mono text-slate-400">
                          {isAdmin ? `$${item.costBasis.toFixed(2)}` : <span className="text-slate-500 text-[10px] italic">***</span>}
                        </td>

                        <td className="p-3 text-center font-mono text-emerald-400 font-bold">
                          {isAdmin ? `${itemMargin.toFixed(0)}%` : <span className="text-slate-500 text-[10px]">***</span>}
                        </td>

                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1 bg-[#0F1115] border border-[#1E293B] rounded-lg p-0.5">
                            <button
                              onClick={(e) => handleQuickStockAdjust(item.id, -1, e)}
                              disabled={item.stockLevel <= 0}
                              className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-rose-400 disabled:opacity-30"
                            >
                              <Minus className="w-3 h-3" />
                            </button>

                            <span
                              className={`font-mono font-bold px-2 text-xs min-w-[32px] text-center ${
                                isOutOfStock ? 'text-rose-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'
                              }`}
                            >
                              {item.stockLevel}
                            </span>

                            <button
                              onClick={(e) => handleQuickStockAdjust(item.id, 1, e)}
                              className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-emerald-400"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenPrinterForSingleItem(item.id)}
                              className="p-1.5 text-cyan-400 hover:bg-cyan-950/50 rounded-lg border border-cyan-800/30"
                              title="Print Barcode"
                            >
                              <BarcodeIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg border border-slate-700/40"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg border border-slate-700/40"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: PRODUCT CARDS GRID VIEW */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {productGroups.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500 bg-[#161B22] rounded-xl border border-[#1E293B]">
              No matching products found.
            </div>
          ) : (
            productGroups.map((group) => {
              const categoryEmoji = getCategoryEmoji(group.category);
              const priceStr = group.minPrice === group.maxPrice
                ? `$${group.minPrice.toFixed(2)}`
                : `$${group.minPrice.toFixed(2)} - $${group.maxPrice.toFixed(2)}`;

              return (
                <div
                  key={group.id}
                  className="bg-[#161B22] border border-[#1E293B] hover:border-emerald-500/40 rounded-xl p-4 flex flex-col justify-between shadow-md transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-12 h-12 rounded-xl bg-[#0F1115] border border-[#1E293B] flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                        {group.imageUrl ? (
                          <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{categoryEmoji}</span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-400 text-sm block">
                          {priceStr}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Margin: {isAdmin ? `${group.avgMargin.toFixed(0)}%` : '***'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                          {group.brand}
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                          {group.category}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-[#E2E8F0] mt-1 line-clamp-1">
                        {group.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {group.productLine}
                      </p>
                    </div>

                    <div className="bg-[#0F1115] p-2 rounded-lg border border-[#1E293B] flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 text-[11px]">
                        {group.items.length} {group.items.length === 1 ? 'Variant' : 'Variants'}
                      </span>
                      <span className={`font-bold ${group.totalStock === 0 ? 'text-rose-400' : group.lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {group.totalStock} units
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#1E293B] mt-3">
                    <button
                      onClick={() => handleOpenMatrixModal(group)}
                      className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>Matrix</span>
                    </button>

                    <button
                      onClick={() => {
                        setViewMode('grouped');
                        setExpandedGroups((prev) => ({ ...prev, [group.id]: true }));
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <span>View SKUs</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add / Edit Item Modal with Immediate GS1 Barcode Generator */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F1115]/80 flex items-center justify-center p-4">
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

            <form onSubmit={(e) => handleSaveItem(e, false)} className="space-y-4 my-4">
              {/* Category Quick Presets Selector Bar */}
              <div className="space-y-1.5 bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-400" /> Choose Category Preset:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                      {activeCategoryProfile.isApparel
                        ? '👕 Apparel Mode (Sizes & Sex enabled)'
                        : activeCategoryProfile.isSouvenirs
                        ? '🔑 Souvenirs (Sizes & Sex hidden)'
                        : activeCategoryProfile.isDrinkware
                        ? '☕ Drinkware (Capacities & Material)'
                        : activeCategoryProfile.isCosmetics
                        ? '🧼 Cosmetics (Net Weight & Scent)'
                        : '📦 General Retail Item'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCategoryPresetAdminOpen(true)}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded font-bold flex items-center gap-1"
                      title="Edit Category Pills, Sizing Matrices & Presets"
                    >
                      <Sliders className="w-3 h-3 text-cyan-400" />
                      <span>Customize Pills</span>
                    </button>
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activePresetsList.map((preset) => {
                    const isSelected = formData.category.toLowerCase() === preset.name.toLowerCase();
                    return (
                      <button
                        key={preset.id || preset.name}
                        type="button"
                        onClick={() => handleSelectCategoryPreset(preset.name)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                            : 'bg-[#161B22] text-slate-300 hover:text-white hover:bg-slate-800 border border-[#1E293B]'
                        }`}
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Category Input & Brand in single row */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Active Category Name
                    </label>
                    <input
                      type="text"
                      required
                      list="category-options"
                      value={formData.category}
                      onChange={(e) => handleSelectCategoryPreset(e.target.value)}
                      placeholder="e.g. T-Shirts, Keyrings, Mugs"
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-medium"
                    />
                    <datalist id="category-options">
                      {categories.filter((c) => c !== 'All').map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Brand Name
                    </label>
                    <input
                      type="text"
                      required
                      list="brand-options"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="e.g. Acme Gifts"
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-medium"
                    />
                    <datalist id="brand-options">
                      {brands.filter((b) => b !== 'All').map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Dynamic Category-Based Logic Profile */}

              {/* 1. T-SHIRT / APPAREL PROFILE: Dynamically shows Size, Gender, and Color / Artwork fields */}
              {activeCategoryProfile.isApparel && (
                <div className="bg-[#0F1115] border border-emerald-500/30 p-3.5 rounded-xl space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-emerald-500/20">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Shirt className="w-4 h-4 text-emerald-400" /> Apparel Configuration (Gender, Size &amp; Color)
                    </span>
                    <span className="text-[10px] text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded font-mono">
                      Category: {formData.category || 'T-Shirt'}
                    </span>
                  </div>

                  {/* Field 1: Gender / Demographic */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-200 mb-1.5">
                      Gender / Target Demographic
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                      {activeDemographicsList.map((demo) => {
                        const isSelected = selectedDemographic === demo.id;
                        return (
                          <button
                            key={demo.id}
                            type="button"
                            onClick={() => handleSelectDemographic(demo.id)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-xs font-bold ring-1 ring-emerald-400'
                                : 'bg-[#161B22] text-slate-300 hover:bg-slate-800 border border-[#1E293B]'
                            }`}
                          >
                            <span>{demo.icon}</span>
                            <span className="truncate">{demo.shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Field 2: Size Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-200">
                        Size ({selectedDemographic})
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Selected Size: <strong className="text-emerald-400">{selectedApparelSize}</strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(
                        activeDemographicsList.find((d) => d.id === selectedDemographic)?.defaultSizes || [
                          'XS',
                          'S',
                          'M',
                          'L',
                          'XL',
                          '2XL',
                        ]
                      ).map((sz) => {
                        const isSelected = selectedApparelSize === sz;
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => handleSelectApparelSize(sz)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              isSelected
                                ? 'bg-emerald-500 text-[#0F1115] shadow-xs ring-1 ring-emerald-300'
                                : 'bg-[#161B22] text-slate-300 hover:bg-slate-800 border border-[#1E293B]'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Field 3: Color / Artwork / Print */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-200 mb-1.5">
                      Color / Artwork / Print Design
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {activeCategoryProfile.preset?.commonVariants.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => handleSelectVariant(v)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            formData.variant === v
                              ? 'bg-cyan-600 text-white font-bold'
                              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={formData.variant}
                      onChange={(e) => handleSelectVariant(e.target.value)}
                      placeholder={activeCategoryProfile.preset?.variantPlaceholder || 'e.g. Navy Blue, Sunset Coral, Turtle Cove'}
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* 2. SOUVENIRS / KEYRINGS PROFILE: Automatically Hides Size, Gender & Clothing Colors */}
              {activeCategoryProfile.isSouvenirs && (
                <div className="bg-[#0F1115] border border-cyan-500/30 p-3.5 rounded-xl space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-cyan-500/20">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-400" /> Souvenir &amp; Keyring Details
                    </span>
                    <span className="text-[10px] text-cyan-400/80 bg-cyan-500/10 px-2 py-0.5 rounded font-mono">
                      ✓ Apparel Size &amp; Gender Hidden
                    </span>
                  </div>

                  {/* Motif / Shape Variant */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-200 mb-1.5">
                      Motif / Island Shape
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {activeCategoryProfile.preset?.commonVariants.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => handleSelectVariant(v)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            formData.variant === v
                              ? 'bg-cyan-600 text-white font-bold'
                              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={formData.variant}
                      onChange={(e) => handleSelectVariant(e.target.value)}
                      placeholder="e.g. Coco de Mer, Giant Tortoise, Island Map"
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Material / Finish */}
                  {activeCategoryProfile.preset?.commonMaterials && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-200 mb-1.5">
                        Material &amp; Craft Finish
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {activeCategoryProfile.preset.commonMaterials.map((mat) => (
                          <button
                            key={mat}
                            type="button"
                            onClick={() => handleSelectMaterial(mat)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                              selectedMaterial === mat
                                ? 'bg-cyan-500 text-[#0F1115] font-bold'
                                : 'bg-[#161B22] text-slate-300 hover:bg-slate-800 border border-[#1E293B]'
                            }`}
                          >
                            {mat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. DRINKWARE / MUGS PROFILE */}
              {activeCategoryProfile.isDrinkware && (
                <div className="bg-[#0F1115] border border-amber-500/30 p-3.5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-amber-400" /> Drinkware Specifications
                    </span>
                    <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded font-mono">
                      Clothing Sizes & Sex Hidden
                    </span>
                  </div>

                  {/* Capacity Options */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                      Capacity / Liquid Volume
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {activeCategoryProfile.preset?.commonVolumes?.map((vol) => (
                        <button
                          key={vol}
                          type="button"
                          onClick={() => handleSelectVolume(vol)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            selectedVolumeOrWeight === vol
                              ? 'bg-amber-500 text-[#0F1115]'
                              : 'bg-[#161B22] text-slate-300 hover:bg-slate-800 border border-[#1E293B]'
                          }`}
                        >
                          {vol}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Material & Artwork Theme */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Material
                      </label>
                      <select
                        value={selectedMaterial}
                        onChange={(e) => handleSelectMaterial(e.target.value)}
                        className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Select Material...</option>
                        {activeCategoryProfile.preset?.commonMaterials?.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Artwork Theme / Motif
                      </label>
                      <input
                        type="text"
                        value={formData.variant}
                        onChange={(e) => handleSelectVariant(e.target.value)}
                        placeholder="e.g. Granite Boulders"
                        className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. COSMETICS / SOAPS PROFILE */}
              {activeCategoryProfile.isCosmetics && (
                <div className="bg-[#0F1115] border border-rose-500/30 p-3.5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-rose-400" /> Cosmetics & Botanicals
                    </span>
                    <span className="text-[10px] text-rose-400/80 bg-rose-500/10 px-2 py-0.5 rounded font-mono">
                      Sizes & Sex Hidden (Net Wt / Vol)
                    </span>
                  </div>

                  {/* Net Weight / Volume */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                      Net Weight / Volume
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {activeCategoryProfile.preset?.commonVolumes?.map((vol) => (
                        <button
                          key={vol}
                          type="button"
                          onClick={() => handleSelectVolume(vol)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            selectedVolumeOrWeight === vol
                              ? 'bg-rose-500 text-white'
                              : 'bg-[#161B22] text-slate-300 hover:bg-slate-800 border border-[#1E293B]'
                          }`}
                        >
                          {vol}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scent & Formula */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                      Scent / Fragrance Formula
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {activeCategoryProfile.preset?.commonVariants.map((scent) => (
                        <button
                          key={scent}
                          type="button"
                          onClick={() => handleSelectVariant(scent)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            formData.variant === scent
                              ? 'bg-rose-600 text-white font-bold'
                              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {scent}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={formData.variant}
                      onChange={(e) => handleSelectVariant(e.target.value)}
                      placeholder="e.g. Vanilla & Coconut"
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* 5. BAGS & ACCESSORIES PROFILE */}
              {activeCategoryProfile.isBags && (
                <div className="bg-[#0F1115] border border-blue-500/30 p-3.5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-blue-400" /> Bags & Accessories Details
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                      Style / Dimension
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {activeCategoryProfile.preset?.commonVariants.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => handleSelectVariant(v)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            formData.variant === v
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeCategoryProfile.preset?.commonMaterials && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                        Fabric / Material
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {activeCategoryProfile.preset.commonMaterials.map((mat) => (
                          <button
                            key={mat}
                            type="button"
                            onClick={() => handleSelectMaterial(mat)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                              selectedMaterial === mat
                                ? 'bg-blue-500 text-white font-bold'
                                : 'bg-[#161B22] text-slate-300 hover:bg-slate-800 border border-[#1E293B]'
                            }`}
                          >
                            {mat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Item Description / Name (with Auto-Format Magic Button) */}
              <div className="bg-[#0F1115] p-3 rounded-xl border border-[#1E293B] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>Item Description / Title</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoFormatTitle}
                    className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-bold transition-all flex items-center gap-1"
                    title="Auto-assemble standardized name from selected Brand, Category, Variant & Size"
                  >
                    <Wand2 className="w-3 h-3 text-emerald-400" />
                    <span>Auto-Format Title</span>
                  </button>
                </div>

                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Acme Gifts T-Shirt - Turtle Cove (Adult Male - M)"
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-[#E2E8F0] font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Product Photo Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Product Photo (shown on the register)
                </label>
                <div className="flex items-center gap-3">
                  {formData.imageUrl ? (
                    <img
                      src={formData.imageUrl}
                      alt="Product preview"
                      className="w-16 h-16 rounded-lg object-cover border border-[#1E293B]"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-[#0F1115] border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-500 text-center">
                      No photo
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors w-fit">
                      Choose Photo…
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
                    {formData.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: '' })}
                        className="text-rose-400 hover:text-rose-300 text-xs font-semibold w-fit"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
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

              {/* Vendor & VAT */}
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

              {/* Pricing */}
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

              {/* Quantities */}
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

      {/* Apparel Matrix Grid Generator Modal */}
      {isMatrixModalOpen && (
        <ApparelMatrixModal
          vendors={vendors}
          categories={categories}
          brands={brands}
          initialProduct={matrixInitialProduct}
          onClose={() => {
            setIsMatrixModalOpen(false);
            setMatrixInitialProduct(undefined);
          }}
          onRefreshData={onRefreshData}
          onOpenPrinterForItems={handleOpenPrinterForItems}
        />
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

      {/* Category Presets & Sizing Pill Customizer Modal */}
      <CategoryPresetAdmin
        isOpen={isCategoryPresetAdminOpen}
        onClose={() => setIsCategoryPresetAdminOpen(false)}
        onPresetsUpdated={() => {
          reloadDynamicPresets();
          onRefreshData();
        }}
      />

      {/* Scheduled SQLite Auto-Backup & Browser Storage Modal */}
      {isAutoBackupOpen && (
        <AutoBackupModal
          onClose={() => setIsAutoBackupOpen(false)}
          onRefreshData={onRefreshData}
        />
      )}

      {/* Security Override Gate Modal */}
      {securityGateModal.isOpen && (
        <ManagerPinGateModal
          title={securityGateModal.title}
          actionDescription={securityGateModal.description}
          onAuthorized={() => securityGateModal.onSuccess()}
          onClose={() => setSecurityGateModal((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
};
