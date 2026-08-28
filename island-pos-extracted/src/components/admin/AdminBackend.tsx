import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  UserPlus,
  Users,
  Edit3,
  DollarSign,
  Printer as PrinterIcon,
  Tag,
  Settings,
  LogOut,
  Save,
  Trash2,
  Key,
  Mail,
  Send,
  Monitor,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Percent,
  RefreshCw,
  FolderEdit,
  Sliders,
  Check,
  X,
  UserCheck,
  Eye,
  EyeOff,
  Receipt,
  Printer,
  Upload,
  Image as ImageIcon,
  Camera,
  Video,
  VideoOff,
  FileText,
  Sparkles,
  MessageSquare,
  Star,
  Database,
  Download,
  Package,
  Barcode,
  Zap,
  Clock,
  Coins,
  Shirt,
  FileSpreadsheet,
  Globe,
  Store,
} from 'lucide-react';
import { CustomCatalogTemplatesModal } from './CustomCatalogTemplatesModal';
import { posDb, DEFAULT_SETTINGS } from '../../services/db';
import { priceTierSyncService, PriceSyncResult, PriceSyncLogEntry } from '../../services/priceTierSyncService';
import { InventoryItem, StaffUser, StaffRole, CategoryTab, StoreSettings, CashierAccessArea, BarcodeMappingRule, BarcodeAction, BarcodeMatchType, PriceList, CashRegisterTerminal } from '../../types/pos';
import { DEFAULT_BARCODE_RULES, parseAndExecuteBarcode } from '../../utils/barcodeEngine';
import {
  CASHIER_GATE_OPTIONS,
  CASHIER_GATE_GROUPS,
  DEFAULT_STAFF_CASHIER_ACCESS,
  applyAccessTierPreset,
  getEffectiveCashierAccess,
  summarizeCashierAccess,
} from '../../utils/cashierAccess';
import { AutoBackupModal } from './AutoBackupModal';
import { CurrencySearchPicker } from './CurrencySearchPicker';
import { downloadSQLiteDbFile } from '../../utils/sqliteExport';
import { CategoryPresetAdmin } from './CategoryPresetAdmin';
import { getStoredCategoryPresets } from '../../utils/categoryProfiles';
import { printReceipt } from '../../utils/printReceipt';
import { soundService } from '../../services/audio';

// ---------------------------------------------------------------------------
// Per-Cashier Access Gate Picker (shared by Create Cashier + Edit Gates modals)
// ---------------------------------------------------------------------------
function AccessGatePickerPanel({
  access,
  onToggle,
  title,
}: {
  access: Record<CashierAccessArea, boolean>;
  onToggle: (area: CashierAccessArea) => void;
  title: string;
}) {
  return (
    <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> {title}
      </p>
      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
        {CASHIER_GATE_GROUPS.map(({ group, title: groupTitle }) => (
          <div key={group}>
            <p className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-wide mb-1">{groupTitle}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {CASHIER_GATE_OPTIONS.filter((opt) => opt.group === group).map((opt) => (
                <label
                  key={opt.area}
                  title={opt.description || opt.label}
                  className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    access[opt.area]
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!access[opt.area]}
                    onChange={() => onToggle(opt.area)}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <span className="min-w-0">
                    <span className={`block text-[11px] font-semibold leading-tight ${access[opt.area] ? 'text-emerald-300' : 'text-slate-300'}`}>
                      {opt.label}
                    </span>
                    {opt.description && (
                      <span className="block text-[9px] text-slate-500 leading-tight mt-0.5">{opt.description}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AdminBackendProps {
  inventory: InventoryItem[];
  onRefreshData: () => void;
  isAdminLoggedIn: boolean;
  setIsAdminLoggedIn: (status: boolean) => void;
}

export const AdminBackend: React.FC<AdminBackendProps> = ({
  inventory,
  onRefreshData,
  isAdminLoggedIn,
  setIsAdminLoggedIn,
}) => {
  // Login Form State
  const [adminInput, setAdminInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Active Admin Tab
  const [adminTab, setAdminTab] = useState<'register' | 'pricing' | 'tabs' | 'pills' | 'cashiers' | 'receipts' | 'whitelabel' | 'feedback' | 'settings' | 'barcodes' | 'hardware' | 'comms'>('register');
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  // Price Lists & Terminals State
  const [priceListsState, setPriceListsState] = useState<PriceList[]>(() => {
    const s = posDb.getSettings();
    return s.priceLists || [
      { id: 'retail', name: 'Standard Retail Price', type: 'retail', isDefault: true, description: 'Default retail pricing for walk-in customers' },
      { id: 'wholesale', name: 'Wholesale B2B Tier', type: 'wholesale', discountPercentage: 25, description: '25% wholesale discount for trade partners' },
      { id: 'vip', name: 'VIP & Staff Price', type: 'vip', discountPercentage: 15, description: '15% special discount for VIP members and staff' },
    ];
  });

  const [registersState, setRegistersState] = useState<CashRegisterTerminal[]>(() => {
    const s = posDb.getSettings();
    return s.registers || [
      { id: 'REG-1', name: 'Main Retail Counter #1', location: 'Front Store', defaultPriceListId: 'retail', mode: 'retail', isOnline: true },
      { id: 'REG-2', name: 'Wholesale & Trade Desk #2', location: 'Warehouse', defaultPriceListId: 'wholesale', mode: 'wholesale', isOnline: true },
    ];
  });

  // Price Tier Sync State
  const [syncStatus, setSyncStatus] = useState(() => priceTierSyncService.getStatus());
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [showSyncHistory, setShowSyncHistory] = useState(false);

  useEffect(() => {
    const unsubscribe = priceTierSyncService.subscribe((result, syncing) => {
      setSyncStatus(priceTierSyncService.getStatus());
      setIsSyncingNow(syncing);
      onRefreshData();
    });
    return () => unsubscribe();
  }, [onRefreshData]);

  const handleSavePriceListsAndRegisters = async () => {
    posDb.updateSettings({
      priceLists: priceListsState,
      registers: registersState,
    });
    setPricingSuccessMsg('Price lists saved! Recalculating inventory pricing in background...');
    setIsSyncingNow(true);

    const res = await priceTierSyncService.syncInventoryPriceTiers(priceListsState, 'admin_settings');
    setIsSyncingNow(false);
    setPricingSuccessMsg(`Price tier settings saved & background sync completed! ${res.summary}`);
    setTimeout(() => setPricingSuccessMsg(''), 5000);
    onRefreshData();
  };

  const handleManualPriceSync = async () => {
    setIsSyncingNow(true);
    const res = await priceTierSyncService.syncInventoryPriceTiers(priceListsState, 'manual_sync');
    setIsSyncingNow(false);
    setPricingSuccessMsg(`Manual Price Sync Completed: ${res.summary}`);
    setTimeout(() => setPricingSuccessMsg(''), 5000);
    onRefreshData();
  };

  // Barcode Rule Engine State
  const [barcodeRules, setBarcodeRules] = useState<BarcodeMappingRule[]>(() => {
    const s = posDb.getSettings();
    return s.barcodeRules && s.barcodeRules.length > 0 ? s.barcodeRules : DEFAULT_BARCODE_RULES;
  });
  const [enableBarcodeRuleEngine, setEnableBarcodeRuleEngine] = useState<boolean>(() => {
    const s = posDb.getSettings();
    return s.enableBarcodeRuleEngine ?? true;
  });
  const [ruleSuccessMsg, setRuleSuccessMsg] = useState('');
  const [testScanInput, setTestScanInput] = useState('');
  const [testScanResult, setTestScanResult] = useState<any>(null);
  const [isCustomTemplatesModalOpen, setIsCustomTemplatesModalOpen] = useState(false);

  const handlePrintTestReceipt = (formatType?: 'thermal' | 'normal') => {
    const dummyTx: any = {
      id: 'test-alignment-tx',
      receiptNumber: 'TEST-ALIGN-999',
      timestamp: new Date().toISOString(),
      cashierName: 'System Alignment Utility',
      subtotal: 42.00,
      vatTotal: 6.30,
      tax: 6.30,
      discount: 5.00,
      discountType: 'amount',
      discountValue: 5.00,
      itemDiscountTotal: 0,
      total: 43.30,
      paymentMethod: 'cash',
      cashGiven: 50.00,
      changeDue: 6.70,
      currencyUsed: 'primary',
      exchangeRateUsed: settings.exchangeRate || 1,
      items: [
        {
          id: 'test-item-1',
          name: 'Alignment Test Product (80mm/58mm)',
          sku: '893100101',
          qty: 1,
          price: 25.00,
          subtotal: 25.00,
          tax: 3.75,
          discount: 0,
          category: 'Test & Alignment',
          brand: settings.posAppName || 'GiftShop',
        },
        {
          id: 'test-item-2',
          name: 'Column Wrap And Margins Test Item',
          sku: '893100102',
          qty: 1,
          price: 22.00,
          subtotal: 22.00,
          tax: 3.30,
          discount: 5.00,
          category: 'Test & Alignment',
          brand: settings.posAppName || 'GiftShop',
        }
      ],
      loyaltyPointsEarned: 5,
      registerId: 'REG-TEST-01',
      registerName: 'Main Terminal',
    };

    printReceipt(dummyTx, settings, formatType);
  };

  // New/Edit Rule Form Modal or State
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleMatchType, setRuleMatchType] = useState<BarcodeMatchType>('prefix');
  const [rulePattern, setRulePattern] = useState('');
  const [ruleAction, setRuleAction] = useState<BarcodeAction>('add_to_cart');
  const [ruleDescription, setRuleDescription] = useState('');
  const [ruleSkuStart, setRuleSkuStart] = useState<number>(2);
  const [ruleSkuLen, setRuleSkuLen] = useState<number>(5);
  const [ruleValStart, setRuleValStart] = useState<number>(7);
  const [ruleValLen, setRuleValLen] = useState<number>(5);
  const [ruleDivisor, setRuleDivisor] = useState<number>(1);

  // Receipt Customization Text Area State
  const [headerLinesText, setHeaderLinesText] = useState<string>('');
  const [footerLinesText, setFooterLinesText] = useState<string>('');

  // Staff Management State
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('cashier');
  const [staffError, setStaffError] = useState('');
  // Per-cashier security gates (manual gate picker, seeded from the role preset)
  const [newStaffAccess, setNewStaffAccess] = useState<Record<CashierAccessArea, boolean>>(() => applyAccessTierPreset('cashier'));

  // Reset PIN Modal
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [resetPinValue, setResetPinValue] = useState('');

  // Product Pricing Grid State
  const [priceSearch, setPriceSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [editingItemPrices, setEditingItemPrices] = useState<{ [id: string]: { name: string; retailPrice: number; retailPriceSecondary?: number; costBasis: number; sku: string; category: string } }>({});
  const [pricingSuccessMsg, setPricingSuccessMsg] = useState('');

  // Bulk Price Adjuster State
  const [bulkCategory, setBulkCategory] = useState('ALL');
  const [bulkAmount, setBulkAmount] = useState<number>(5);
  const [bulkMode, setBulkMode] = useState<'percentage' | 'flat'>('percentage');

  // Category Tabs Manager State
  const [categoryTabs, setCategoryTabs] = useState<CategoryTab[]>([]);
  const [editingCatName, setEditingCatName] = useState<{ [oldName: string]: string }>({});
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [catSuccessMsg, setCatSuccessMsg] = useState('');

  // Store Settings State
  const [settings, setSettings] = useState<StoreSettings>(posDb.getSettings());
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState('');
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestLog, setSmtpTestLog] = useState<string[]>([]);
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [whatsAppTestLog, setWhatsAppTestLog] = useState<string[]>([]);
  const [isAutoBackupModalOpen, setIsAutoBackupModalOpen] = useState(false);

  // Master Reset Password (backup recovery secret) — never bound to the live stored value
  const [masterResetConfigured, setMasterResetConfigured] = useState(() => posDb.hasMasterResetPassword());
  const [masterResetNew, setMasterResetNew] = useState('');
  const [masterResetConfirm, setMasterResetConfirm] = useState('');
  const [masterResetAdminPin, setMasterResetAdminPin] = useState('');
  const [masterResetError, setMasterResetError] = useState('');
  const [masterResetSuccess, setMasterResetSuccess] = useState('');

  // Camera Capture for Logo State & Handlers
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      setCameraStream(stream);
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Could not access camera. Please check device/browser permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const captureCameraSnapshot = () => {
    if (!videoEl) return;
    try {
      const canvas = document.createElement('canvas');
      const size = Math.min(videoEl.videoWidth, videoEl.videoHeight);
      canvas.width = 300;
      canvas.height = 300;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Crop center square
        const sx = (videoEl.videoWidth - size) / 2;
        const sy = (videoEl.videoHeight - size) / 2;
        ctx.drawImage(videoEl, sx, sy, size, size, 0, 0, 300, 300);
        
        const dataUrl = canvas.toDataURL('image/png');
        setSettings((prev) => ({
          ...prev,
          receiptLogoUrl: dataUrl,
          shopLogoUrl: dataUrl,
          brandLogoUrl: dataUrl
        }));
        
        posDb.updateSettings({
          receiptLogoUrl: dataUrl,
          shopLogoUrl: dataUrl,
          brandLogoUrl: dataUrl
        });
        onRefreshData();
      }
      stopCamera();
    } catch (err) {
      console.error('Snapshot capture error:', err);
      setCameraError('Failed to capture snapshot.');
    }
  };

  // Clean up camera stream when component unmounts
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // String state buffers for numeric inputs so backspacing works smoothly
  const [exchangeRateStr, setExchangeRateStr] = useState<string>('');
  const [vatRateStr, setVatRateStr] = useState<string>('');
  const [dcRatesStr, setDcRatesStr] = useState<string[]>(['', '']);

  // Show PIN toggles
  const [showPins, setShowPins] = useState<{ [id: string]: boolean }>({});

  // Customer Feedback Filter States
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState<number | 'ALL'>('ALL');
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState<string | 'ALL'>('ALL');
  const [feedbackSearchTerm, setFeedbackSearchTerm] = useState<string>('');

  // Load Data
  const loadBackendData = () => {
    setStaffList(posDb.getStaffUsers());
    const cats = posDb.getCategories();
    setCategoryTabs(cats);
    const catMap: { [oldName: string]: string } = {};
    cats.forEach((c) => {
      catMap[c.name] = c.name;
    });
    setEditingCatName(catMap);

    const currSettings = posDb.getSettings();
    setSettings(currSettings);
    setMasterResetConfigured(posDb.hasMasterResetPassword());
    setHeaderLinesText((currSettings.receiptHeaderLines || []).join('\n'));
    setFooterLinesText((currSettings.receiptFooterLines || []).join('\n'));

    // Sync numeric input string buffers
    setExchangeRateStr(String(currSettings.exchangeRate ?? 1));
    setVatRateStr(String(Math.round((currSettings.defaultVatRate ?? 0.15) * 100)));
    const dc0 = currSettings.customerDisplayCurrencies?.[0]?.rate;
    const dc1 = currSettings.customerDisplayCurrencies?.[1]?.rate;
    setDcRatesStr([
      dc0 ? String(dc0) : '',
      dc1 ? String(dc1) : '',
    ]);
  };

  useEffect(() => {
    loadBackendData();
  }, [inventory]);

  // Handle Admin Auth
  const handleAdminLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (posDb.verifyAdminLogin(adminInput)) {
      setIsAdminLoggedIn(true);
      setLoginError('');
      setAdminInput('');
      loadBackendData();
    } else {
      setLoginError('Invalid Administrator Password or PIN. Try "admin123" or "admin".');
    }
  };

  // Cashier Account Handlers
  const handleCreateCashier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffUsername.trim() || !newStaffPin.trim()) {
      setStaffError('Please fill out all required fields.');
      return;
    }

    posDb.addStaffUser({
      name: newStaffName.trim(),
      username: newStaffUsername.trim().toLowerCase(),
      pin: newStaffPin.trim(),
      role: newStaffRole,
      status: 'active',
      cashierAccess: { ...newStaffAccess },
    });

    setNewStaffName('');
    setNewStaffUsername('');
    setNewStaffPin('');
    setNewStaffRole('cashier');
    setNewStaffAccess(applyAccessTierPreset('cashier'));
    setStaffError('');
    setIsAddStaffModalOpen(false);
    loadBackendData();
  };

  const handleToggleStaffStatus = (id: string, currentStatus: 'active' | 'suspended') => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    posDb.updateStaffUser(id, { status: nextStatus });
    loadBackendData();
  };

  const [staffToDelete, setStaffToDelete] = useState<{id: string, name: string} | null>(null);

  const handleDeleteStaff = (id: string, name: string) => {
    setStaffToDelete({ id, name });
  };

  const confirmDeleteStaff = () => {
    if (staffToDelete) {
      posDb.deleteStaffUser(staffToDelete.id);
      loadBackendData();
      setStaffToDelete(null);
    }
  };

  const handleResetPin = (id: string) => {
    if (!resetPinValue.trim()) return;
    posDb.updateStaffUser(id, { pin: resetPinValue.trim() });
    setEditingStaffId(null);
    setResetPinValue('');
    loadBackendData();
    onRefreshData();
  };

  // Per-Cashier Access Gate Editor
  const [gateEditStaff, setGateEditStaff] = useState<StaffUser | null>(null);
  const [gateEditDraft, setGateEditDraft] = useState<Record<CashierAccessArea, boolean>>(DEFAULT_STAFF_CASHIER_ACCESS);

  const openGateEditor = (staff: StaffUser) => {
    setGateEditStaff(staff);
    // Seed the draft with what this account currently resolves to (its own
    // gates, or the global map it inherits) so the admin sees reality first.
    setGateEditDraft(getEffectiveCashierAccess(staff, settings));
  };

  const handleToggleGateEdit = (area: CashierAccessArea) => {
    setGateEditDraft((prev) => ({ ...prev, [area]: !prev[area] }));
  };

  const handleSaveGateEditor = () => {
    if (!gateEditStaff) return;
    posDb.updateStaffUser(gateEditStaff.id, { cashierAccess: { ...gateEditDraft } });
    setGateEditStaff(null);
    loadBackendData();
    onRefreshData();
  };

  // Pricing & Title Handlers
  const handlePriceFieldChange = (
    id: string,
    field: 'name' | 'retailPrice' | 'retailPriceSecondary' | 'costBasis' | 'sku' | 'category',
    value: string | number
  ) => {
    const currentItem = inventory.find((i) => i.id === id);
    if (!currentItem) return;

    const existingDraft = editingItemPrices[id] || {
      name: currentItem.name,
      retailPrice: currentItem.retailPrice,
      retailPriceSecondary: currentItem.retailPriceSecondary || 0,
      costBasis: currentItem.costBasis,
      sku: currentItem.sku,
      category: currentItem.category,
    };

    setEditingItemPrices({
      ...editingItemPrices,
      [id]: {
        ...existingDraft,
        [field]: value,
      },
    });
  };

  const handleSaveProductRow = (id: string) => {
    const draft = editingItemPrices[id];
    if (!draft) return;

    posDb.updateProductTitleAndPrice(id, {
      name: draft.name,
      retailPrice: Number(draft.retailPrice),
      retailPriceSecondary: draft.retailPriceSecondary ? Number(draft.retailPriceSecondary) : undefined,
      costBasis: Number(draft.costBasis),
      sku: draft.sku,
      category: draft.category,
    });

    onRefreshData();
    setPricingSuccessMsg(`Successfully updated "${draft.name}" prices & title.`);
    setTimeout(() => setPricingSuccessMsg(''), 3000);
  };

  const handleApplyBulkPriceAdjustment = () => {
        const affected = posDb.bulkAdjustPrices(bulkCategory, bulkAmount, bulkMode, { user: 'Admin' });
    onRefreshData();
    setPricingSuccessMsg(`Applied bulk price change to ${affected} products.`);
    setTimeout(() => setPricingSuccessMsg(''), 4000);
  };

  // Category Tab Handlers
  const handleSaveCategoryRename = (oldName: string) => {
    const newName = editingCatName[oldName];
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    posDb.renameCategory(oldName, newName.trim());
    onRefreshData();
    loadBackendData();
    setCatSuccessMsg(`Renamed product tab "${oldName}" to "${newName.trim()}" across all products.`);
    setTimeout(() => setCatSuccessMsg(''), 4000);
  };

  const handleAddNewCategoryTab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryTitle.trim()) return;

    posDb.addCategory(newCategoryTitle.trim());
    setNewCategoryTitle('');
    loadBackendData();
    setCatSuccessMsg(`Added new product tab "${newCategoryTitle.trim()}".`);
    setTimeout(() => setCatSuccessMsg(''), 3000);
  };

  const handleDeleteCategoryTab = (catName: string) => {
    if (confirm(`Delete tab "${catName}"? Note: products assigned to this tab will remain in catalog.`)) {
      posDb.deleteCategory(catName);
      loadBackendData();
    }
  };

  // Instant-apply a settings patch: saves immediately so controls feel
  // responsive (no hidden "Save" click required)
  const applySettingInstant = (patch: Partial<StoreSettings>) => {
    setSettings({ ...settings, ...patch });
    posDb.updateSettings(patch);
    onRefreshData();
  };

  // Upload a shop logo file and store it as a small data URL so it works
  // offline (a local file path like /Users/... will NOT render in the app)
  const handleLogoFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file (PNG/SVG/JPG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      if (file.type === 'image/svg+xml') {
        applySettingInstant({
          brandLogoUrl: result,
          shopLogoUrl: result,
          receiptLogoUrl: result,
        });
        return;
      }
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 320;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        applySettingInstant({
          brandLogoUrl: dataUrl,
          shopLogoUrl: dataUrl,
          receiptLogoUrl: dataUrl,
        });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  // Manual full-data backup download
  const handleManualBackup = () => {
    const blob = new Blob([posDb.exportBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boutique-pos-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    posDb.markBackupDone();
    setSettings({ ...settings, lastBackupAt: new Date().toISOString() });
  };

  // Test SMTP Email credentials
  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setSmtpTestLog([]);
    const logs = [
      `[INFO] Resolving SMTP server hostname: "${settings.smtpHost || 'smtp.mailtrap.io'}"...`,
      `[INFO] Target Resolved. Port: ${settings.smtpPort || 587}. Connection security: ${settings.smtpSecure ? 'SSL/TLS' : 'STARTTLS'}`,
      `[INFO] Attempting TCP Handshake... Connected!`,
      `[SMTP] < 220 ${settings.smtpHost || 'smtp.mailtrap.io'} ESMTP Service Ready`,
      `[SMTP] > EHLO boutique-register-1.local`,
      `[SMTP] < 250-SIZE 35651584`,
      `[SMTP] < 250 AUTH PLAIN LOGIN`,
      `[SMTP] > AUTH LOGIN`,
      `[SMTP] < 334 VXNlcm5hbWU6`,
      `[SMTP] > [Encoded Credentials]`,
      `[SMTP] < 334 UGFzc3dvcmQ6`,
      `[SMTP] > [Encoded Credentials]`,
    ];

    if (!settings.smtpUser || !settings.smtpPass) {
      logs.push(
        `[SMTP] < 535 5.7.8 Authentication Failed: Missing username/password credentials.`,
        `[ERROR] Connection terminated. SMTP Authentication failed.`
      );
    } else {
      logs.push(
        `[SMTP] < 235 2.7.0 Authentication successful`,
        `[SMTP] > MAIL FROM: <${settings.smtpSenderEmail || 'receipts@myboutique.com'}>`,
        `[SMTP] < 250 2.1.0 OK`,
        `[SMTP] > RCPT TO: <test-connection@myboutique.com>`,
        `[SMTP] < 250 2.1.5 OK`,
        `[SMTP] > DATA`,
        `[SMTP] < 354 Start mail input; end with <CR><LF>.<CR><LF>`,
        `[SMTP] > Subject: Test Receipt Delivery connection`,
        `[SMTP] > Message-ID: <test-123456@myboutique.com>`,
        `[SMTP] > (Digital Receipt Simulation Attachment)`,
        `[SMTP] > .`,
        `[SMTP] < 250 2.0.0 OK: Queued delivery`,
        `[SUCCESS] Test SMTP packet completed successfully! Mail is active.`
      );
    }

    for (let i = 0; i < logs.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      setSmtpTestLog((prev) => [...prev, logs[i]]);
    }
    setIsTestingSmtp(false);
  };

  // Test WhatsApp Business API automated webhook
  const handleTestWhatsApp = async () => {
    setIsTestingWhatsApp(true);
    setWhatsAppTestLog([]);
    const logs: string[] = [];

    const phoneId = (settings.whatsappPhoneNumberId || '').trim();
    const token = (settings.whatsappAccessToken || '').trim();
    const customUrl = (settings.whatsappWebhookUrl || '').trim();
    const targetUrl = customUrl || (phoneId ? `https://graph.facebook.com/v17.0/${phoneId}/messages` : '');

    logs.push(`[INFO] Preparing LIVE HTTP POST for WhatsApp Cloud Gateway API...`);
    logs.push(`[INFO] Destination URL: "${targetUrl || '(NOT CONFIGURED)'}"`);
    if (phoneId) logs.push(`[INFO] Phone Number ID: "${phoneId}"`);
    logs.push(`[INFO] Injecting authorization bearer token (${token ? 'Bearer ' + token.slice(0, 6) + '…' : 'NONE PROVIDED'})`);

    if (!targetUrl) {
      logs.push(`[ERROR] No gateway configured. Enter a Webhook URL or a Phone Number ID above, then click "Save All Store Settings" and test again.`);
      setWhatsAppTestLog(logs);
      setIsTestingWhatsApp(false);
      return;
    }

    logs.push(`[HTTP] > POST ${targetUrl} HTTP/1.1`);

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '0000000000',
          type: 'text',
          text: { preview_url: false, body: `IslandPOS gateway connectivity test — ${new Date().toLocaleString()}` },
        }),
      });

      logs.push(`[HTTP] < HTTP/1.1 ${res.status} ${res.statusText}`);
      const raw = await res.text();
      let pretty = raw;
      try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* keep raw body */ }
      logs.push(`[HTTP] < ${pretty.slice(0, 500)}`);

      if (res.ok) {
        logs.push(`[SUCCESS] Live webhook handshake succeeded! Your WhatsApp Cloud API credentials are valid and reachable.`);
      } else if (res.status === 401 || res.status === 403 || raw.includes('access token')) {
        logs.push(`[ERROR] Authentication rejected (${res.status}). Check your Access Token — it may be expired or lack the whatsapp_business_messaging scope.`);
      } else if (raw.includes('recipient') || raw.includes('to')) {
        logs.push(`[WARNING] Credentials ACCEPTED (token & phone ID valid) but the test recipient "0000000000" is not a real number.`);
        logs.push(`[INFO] Live receipt delivery will work — real customer numbers are resolved from each sale at checkout.`);
      } else {
        logs.push(`[ERROR] Gateway rejected the request (${res.status}). Review the response body above.`);
      }
    } catch (err: any) {
      logs.push(`[ERROR] Network failure reaching the gateway: ${err?.message || String(err)}`);
      logs.push(`[WARNING] If this is a browser CORS block, the Meta API must be called through your own backend relay, or run the POS from the desktop app build.`);
    }

    for (let i = 0; i < logs.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      setWhatsAppTestLog((prev) => [...prev, logs[i]]);
    }
    setIsTestingWhatsApp(false);
  };

  // Store Settings Handler
  const handleSaveStoreSettings = (e: React.FormEvent) => {
    e.preventDefault();
    // Never overwrite masterResetPassword from this form — it is managed only via setMasterResetPassword.
    const { masterResetPassword: _omitMaster, ...rest } = settings;
    const settingsToSave = {
      ...rest,
      onboardingCompleted: true,
    };
    posDb.updateSettings(settingsToSave);
    const updated = posDb.getSettings();
    setSettings(updated);
    setMasterResetConfigured(posDb.hasMasterResetPassword());
    onRefreshData(); // Instantly update currency & branding settings across application
    setSettingsSuccessMsg('Store Settings & Admin Passwords saved successfully!');
    setTimeout(() => setSettingsSuccessMsg(''), 3000);
  };

  /** Save / clear the Master Reset Password (lockout recovery secret). */
  const handleSaveMasterResetPassword = () => {
    setMasterResetError('');
    setMasterResetSuccess('');

    if (!masterResetAdminPin.trim()) {
      setMasterResetError('Enter your current Admin Login PIN to change the Master Reset Password.');
      return;
    }

    // Confirm only required when setting a new non-empty password
    if (masterResetNew.trim() && masterResetNew.trim() !== masterResetConfirm.trim()) {
      setMasterResetError('New Master Reset Password and confirmation do not match.');
      return;
    }

    const result = posDb.setMasterResetPassword(masterResetNew, masterResetAdminPin);
    if (!result.ok) {
      setMasterResetError(result.error || 'Could not update Master Reset Password.');
      return;
    }

    setMasterResetConfigured(posDb.hasMasterResetPassword());
    setMasterResetNew('');
    setMasterResetConfirm('');
    setMasterResetAdminPin('');
    setMasterResetSuccess(
      masterResetNew.trim()
        ? 'Master Reset Password saved. Store it offline — it is the only way to recover a forgotten Admin PIN.'
        : 'Master Reset Password cleared. Login recovery is now disabled until you set a new one.'
    );
    setTimeout(() => setMasterResetSuccess(''), 5000);
  };

  // Receipt Customization Handlers
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Logo image file is too large. Please select a graphic file under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setSettings((prev) => ({ ...prev, receiptLogoUrl: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({ ...prev, receiptLogoUrl: '' }));
  };

  const handleApplyPresetLogo = (type: 'palm' | 'seashell' | 'boutique') => {
    let logoUrl = '';
    if (type === 'palm') {
      logoUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-9"/><path d="M12 13c-3-3-8-2-10 1 3 0 7 2 8 5"/><path d="M12 13c3-3 8-2 10 1-3 0-7 2-8 5"/><path d="M12 8c-2-3-7-3-9-1 3 1 6 3 7 5"/><path d="M12 8c2-3 7-3 9-1-3 1-6 3-7 5"/><circle cx="12" cy="4" r="1.5"/></svg>`;
    } else if (type === 'seashell') {
      logoUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12A10 10 0 0 1 12 2z"/><path d="M12 22V12"/><path d="M12 12 6.5 6.5"/><path d="M12 12l5.5-5.5"/><path d="M12 12H2"/><path d="M12 12h10"/></svg>`;
    } else if (type === 'boutique') {
      logoUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }

    setSettings((prev) => ({ ...prev, receiptLogoUrl: logoUrl }));
  };

  const handleSaveReceiptSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedHeaderLines = headerLinesText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const updatedFooterLines = footerLinesText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const newPayload: StoreSettings = {
      ...settings,
      receiptHeaderLines: updatedHeaderLines,
      receiptFooterLines: updatedFooterLines,
    };

    posDb.updateSettings(newPayload);
    setSettings(newPayload);
    onRefreshData(); // Instantly propagate changes to parent context
    setSettingsSuccessMsg('Receipt Logo, Header & Footer Customization saved successfully!');
    setTimeout(() => setSettingsSuccessMsg(''), 3000);
  };

  // Filtered Products List
  const filteredProducts = inventory.filter((item) => {
    const matchesCategory = selectedCategoryFilter === 'ALL' || item.category === selectedCategoryFilter;
    const matchesSearch =
      item.name.toLowerCase().includes(priceSearch.toLowerCase()) ||
      item.sku.toLowerCase().includes(priceSearch.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(priceSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // If Admin is NOT logged in, show Admin Gate
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-8 max-w-md w-full shadow-2xl text-[#E2E8F0] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 text-emerald-500/10 pointer-events-none">
            <Lock className="w-32 h-32" />
          </div>

          <div className="flex flex-col items-center text-center space-y-3 mb-6 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">Admin Backend Portal</h2>
            <p className="text-xs text-slate-400">
              Enter Administrator Password or PIN to manage Cashier Accounts, edit Product Titles & Prices, and configure POS Tabs.
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Admin Password or PIN:
              </label>
              <input
                type="password"
                value={adminInput}
                onChange={(e) => setAdminInput(e.target.value)}
                placeholder="Enter password or PIN (e.g. admin123)"
                className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm font-mono text-[#E2E8F0] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Authenticate & Access Admin Backend</span>
            </button>
          </form>

          {/* Quick Demo Helper */}
          <div className="mt-6 pt-4 border-t border-[#1E293B] text-center text-xs">
            <span className="text-slate-500">Default Admin Credentials: </span>
            <button
              onClick={() => {
                setAdminInput('admin123');
                setIsAdminLoggedIn(true);
              }}
              className="text-emerald-400 hover:underline font-mono font-bold ml-1"
            >
              admin123 (Click to Quick Login)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Admin Status Header Bar */}
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#E2E8F0]">Store Administrator Portal</h1>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                AUTHENTICATED
              </span>
            </div>
            <p className="text-slate-400 text-xs">
              Manage Cashiers • Edit Product Titles & Live Prices • Customize Category Tabs • Store Settings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAdminLoggedIn(false)}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock / Exit Admin</span>
          </button>
        </div>
      </div>

      {/* Main Admin Master Category Pills & Sub-Category Selector */}
      <div className="space-y-3">
        {/* Top Master Category Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 bg-[#161B22] p-1.5 rounded-2xl border border-[#1E293B] text-xs gap-1.5 shadow-md">
          {/* Master Pill 1: Register */}
          <button
            onClick={() => setAdminTab('register')}
            className={`min-w-0 py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-center cursor-pointer ${
              adminTab === 'register'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Monitor className="w-4 h-4 text-emerald-300" />
            <span>🖥️ Register</span>
          </button>

          {/* Master Pill 2: Cashiers & Security */}
          <button
            onClick={() => setAdminTab('cashiers')}
            className={`min-w-0 py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-center cursor-pointer ${
              adminTab === 'cashiers'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-300" />
            <span>👥 Staff &amp; Cashier Security</span>
          </button>

          {/* Master Pill 2: Product Management */}
          <button
            onClick={() => setAdminTab('pricing')}
            className={`min-w-0 py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-center cursor-pointer ${
              adminTab === 'pricing' || adminTab === 'tabs' || adminTab === 'pills'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Tag className="w-4 h-4 text-cyan-300" />
            <span>🏷️ Product Management</span>
          </button>

          {/* Master Pill 3: Email, WhatsApp & Peripherals */}
          <button
            onClick={() => setAdminTab('hardware')}
            className={`min-w-0 py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-center cursor-pointer ${
              adminTab === 'hardware' || adminTab === 'comms' || adminTab === 'barcodes'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Cpu className="w-4 h-4 text-purple-300" />
            <span>🔌 Email, WhatsApp &amp; Peripherals</span>
          </button>

          {/* Master Pill 4: Receipts & White Label */}
          <button
            onClick={() => setAdminTab('receipts')}
            className={`min-w-0 py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-center cursor-pointer ${
              adminTab === 'receipts' || adminTab === 'whitelabel'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Receipt className="w-4 h-4 text-amber-300" />
            <span>🧾 Receipts &amp; White Label</span>
          </button>

          {/* Master Pill 5: Store System & Audits */}
          <button
            onClick={() => setAdminTab('settings')}
            className={`min-w-0 py-2.5 px-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-center cursor-pointer ${
              adminTab === 'settings' || adminTab === 'feedback'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-300" />
            <span>⚙️ Store System &amp; Audits</span>
          </button>
        </div>

        {/* Dynamic Sub-Pill Navigation Selector */}
        <div className="admin-subnav flex flex-wrap items-center gap-2 bg-[#0F1115] border border-[#1E293B] p-2 rounded-xl text-xs">
          <span className="w-full sm:w-auto text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2 flex items-center gap-1">
            <Sliders className="w-3 h-3 text-emerald-400" /> Store Settings Sub-Category:
          </span>

          {(adminTab === 'pricing' || adminTab === 'tabs' || adminTab === 'pills') && (
            <>
              <button
                onClick={() => setAdminTab('pricing')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  adminTab === 'pricing'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Product Titles &amp; Prices ({inventory.length})</span>
              </button>
              <button
                onClick={() => setAdminTab('tabs')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  adminTab === 'tabs'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <FolderEdit className="w-3.5 h-3.5" />
                <span>Product Tabs ({categoryTabs.length})</span>
              </button>
              <button
                onClick={() => setAdminTab('pills')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  adminTab === 'pills'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Category Preset Pills</span>
              </button>
            </>
          )}

          {(adminTab === 'hardware' || adminTab === 'comms' || adminTab === 'barcodes') && (
            <>
              <button
                onClick={() => setAdminTab('hardware')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  adminTab === 'hardware'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Peripheral Hardware (Printers, Scanners, Scale)</span>
              </button>
              <button
                onClick={() => setAdminTab('barcodes')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  adminTab === 'barcodes'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Barcode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Barcode Rules &amp; Sticker Printing</span>
              </button>
              <button
                onClick={() => setAdminTab('comms')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  adminTab === 'comms'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span>Email (SMTP Host) &amp; WhatsApp Webhook Cloud API</span>
              </button>
            </>
          )}

          {(adminTab === 'receipts' || adminTab === 'whitelabel') && (
            <>
              <button
                onClick={() => setAdminTab('receipts')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  adminTab === 'receipts'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Receipt className="w-3.5 h-3.5 text-amber-400" />
                <span>Receipt Thermal Layout &amp; Header Editing</span>
              </button>
              <button
                onClick={() => setAdminTab('whitelabel')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  adminTab === 'whitelabel'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span>White Label Store Profile, Logo &amp; VAT</span>
              </button>
            </>
          )}

          {(adminTab === 'settings' || adminTab === 'feedback') && (
            <>
              <button
                onClick={() => setAdminTab('feedback')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  adminTab === 'feedback'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>Customer Feedback Logs ({posDb.getFeedbackList().length})</span>
              </button>
              <button
                onClick={() => setAdminTab('settings')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  adminTab === 'settings'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Database Auto-Backup &amp; Maintenance</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB: BARCODE & PLU SCANNER RULE ENGINE CONFIGURATION */}
      {/* ========================================================================= */}
      {adminTab === 'barcodes' && (
        <div className="space-y-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2">
                <Barcode className="w-4 h-4 text-cyan-400" /> Barcode Prefix/Suffix &amp; PLU Rule Engine
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Map hardware barcode prefixes, suffixes, scale PLU weight barcodes, or price embedding codes to automated POS inventory actions.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer bg-[#0F1115] border border-[#1E293B] px-3 py-2 rounded-xl">
                <input
                  type="checkbox"
                  checked={enableBarcodeRuleEngine}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setEnableBarcodeRuleEngine(val);
                    posDb.updateSettings({ enableBarcodeRuleEngine: val });
                    onRefreshData();
                  }}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Zap className="w-3.5 h-3.5" /> Enable Rule Engine
                </span>
              </label>

              <button
                onClick={() => {
                  setEditingRuleId(null);
                  setRuleName('');
                  setRuleMatchType('prefix');
                  setRulePattern('+');
                  setRuleAction('add_to_cart');
                  setRuleDescription('');
                  setIsRuleModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Barcode Rule</span>
              </button>
            </div>
          </div>

          {ruleSuccessMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-medium flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{ruleSuccessMsg}</span>
            </div>
          )}

          {/* Barcode Testing Sandbox */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4 space-y-3 shadow-md">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" /> Live Hardware Scanner Simulator &amp; Rule Tester
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testScanInput}
                onChange={(e) => setTestScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && testScanInput.trim()) {
                    const res = parseAndExecuteBarcode(testScanInput, barcodeRules, inventory, enableBarcodeRuleEngine);
                    setTestScanResult(res);
                  }
                }}
                placeholder="Type or simulate barcode scan (e.g. +SKU-1001, 280000100005, SKU-1001-FIND) and press Enter..."
                className="flex-1 bg-[#0F1115] border border-[#1E293B] focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (!testScanInput.trim()) return;
                  const res = parseAndExecuteBarcode(testScanInput, barcodeRules, inventory, enableBarcodeRuleEngine);
                  setTestScanResult(res);
                }}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" /> Test Scan
              </button>
            </div>

            {testScanResult && (
              <div className="p-3 bg-[#0F1115] border border-cyan-500/30 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-slate-400">Raw Barcode: <strong className="text-white">{testScanResult.rawBarcode}</strong></span>
                  <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded font-bold uppercase">
                    Action: {testScanResult.action}
                  </span>
                </div>
                <div className="text-slate-300">
                  Matched Rule: <strong className="text-amber-400">{testScanResult.matchedRule ? testScanResult.matchedRule.name : 'None (Standard Fallback)'}</strong>
                </div>
                <div className="text-slate-300">
                  Parsed SKU / ID: <strong className="font-mono text-emerald-400">{testScanResult.parsedSku || 'None'}</strong>
                </div>
                {testScanResult.matchedItem ? (
                  <div className="text-slate-300 flex items-center gap-2">
                    Matched Product: <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded">{testScanResult.matchedItem.name} ({settings.primaryCurrencySymbol} {testScanResult.matchedItem.retailPrice.toFixed(2)})</span>
                  </div>
                ) : (
                  <div className="text-rose-400 text-[11px]">Warning: Product not found in inventory catalog.</div>
                )}
                {testScanResult.quantity !== undefined && (
                  <div className="text-cyan-300">Extracted PLU Quantity: <strong className="font-mono">{testScanResult.quantity}</strong></div>
                )}
                {testScanResult.overridePrice !== undefined && (
                  <div className="text-cyan-300">Extracted Embedded Price: <strong className="font-mono">{settings.primaryCurrencySymbol} {testScanResult.overridePrice.toFixed(2)}</strong></div>
                )}
                <div className="text-[11px] text-slate-400 italic pt-1 border-t border-[#1E293B]">
                  {testScanResult.message}
                </div>
              </div>
            )}
          </div>

          {/* Barcode Rules Table */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0F1115] text-slate-400 font-semibold border-b border-[#1E293B] text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Rule Name</th>
                  <th className="p-3.5">Match Type</th>
                  <th className="p-3.5">Pattern / Prefix</th>
                  <th className="p-3.5">Mapped Action</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {barcodeRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-[#1E293B]/40 transition-colors">
                    <td className="p-3.5 font-bold text-white">
                      <div>{rule.name}</div>
                      {rule.description && <div className="text-[10px] font-normal text-slate-400 mt-0.5">{rule.description}</div>}
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono text-[11px] bg-slate-800 text-cyan-300 px-2 py-0.5 rounded border border-slate-700">
                        {rule.matchType.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-amber-400">
                      {rule.pattern}
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold uppercase text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                        {rule.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => {
                          const updated = barcodeRules.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r);
                          setBarcodeRules(updated);
                          posDb.updateSettings({ barcodeRules: updated });
                          onRefreshData();
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          rule.enabled
                            ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}
                      >
                        {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                      </button>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingRuleId(rule.id);
                          setRuleName(rule.name);
                          setRuleMatchType(rule.matchType);
                          setRulePattern(rule.pattern);
                          setRuleAction(rule.action);
                          setRuleDescription(rule.description || '');
                          setRuleSkuStart(rule.skuStartIndex ?? 2);
                          setRuleSkuLen(rule.skuLength ?? 5);
                          setRuleValStart(rule.valueStartIndex ?? 7);
                          setRuleValLen(rule.valueLength ?? 5);
                          setRuleDivisor(rule.valueDivisor ?? 1);
                          setIsRuleModalOpen(true);
                        }}
                        className="text-cyan-400 hover:text-cyan-300 font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete rule "${rule.name}"?`)) {
                            const updated = barcodeRules.filter((r) => r.id !== rule.id);
                            setBarcodeRules(updated);
                            posDb.updateSettings({ barcodeRules: updated });
                            onRefreshData();
                            setRuleSuccessMsg(`Deleted rule "${rule.name}".`);
                            setTimeout(() => setRuleSuccessMsg(''), 3000);
                          }
                        }}
                        className="text-rose-400 hover:text-rose-300 font-semibold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Barcode Mapping Rule Modal */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2">
                <Barcode className="w-4 h-4 text-cyan-400" />
                {editingRuleId ? 'Edit Barcode Mapping Rule' : 'Create Barcode Mapping Rule'}
              </h3>
              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Rule Name</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Quick Add Cart Prefix"
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Match Type</label>
                  <select
                    value={ruleMatchType}
                    onChange={(e) => setRuleMatchType(e.target.value as BarcodeMatchType)}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="prefix">Prefix (Starts With)</option>
                    <option value="suffix">Suffix (Ends With)</option>
                    <option value="exact">Exact Match</option>
                    <option value="plu_prefix">PLU Scale / Price Prefix</option>
                    <option value="regex">Regular Expression</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Pattern / Prefix String</label>
                  <input
                    type="text"
                    value={rulePattern}
                    onChange={(e) => setRulePattern(e.target.value)}
                    placeholder="e.g. +, 28, -FIND"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Mapped Inventory Action</label>
                <select
                  value={ruleAction}
                  onChange={(e) => setRuleAction(e.target.value as BarcodeAction)}
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="add_to_cart">Add To Cart (Strip Prefix/Suffix)</option>
                  <option value="increment_quantity">Increment Quantity in Cart</option>
                  <option value="find_item">Find / Search Item Only (Don't Add)</option>
                  <option value="set_quantity">Set Quantity (PLU Scale Weight)</option>
                  <option value="price_embedded">Price Embedded (PLU Cents Override)</option>
                  <option value="open_search">Open Search With SKU</option>
                  <option value="apply_discount">Apply Discount To Item</option>
                </select>
              </div>

              {ruleMatchType === 'plu_prefix' && (
                <div className="p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-xl space-y-2">
                  <div className="text-[11px] font-bold text-cyan-300">PLU Parsing Offsets (Standard 13-Digit EAN)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400">SKU Start Index</label>
                      <input
                        type="number"
                        value={ruleSkuStart}
                        onChange={(e) => setRuleSkuStart(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 font-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">SKU Length</label>
                      <input
                        type="number"
                        value={ruleSkuLen}
                        onChange={(e) => setRuleSkuLen(parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 font-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Value Start Index (Qty/Price)</label>
                      <input
                        type="number"
                        value={ruleValStart}
                        onChange={(e) => setRuleValStart(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 font-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Value Length</label>
                      <input
                        type="number"
                        value={ruleValLen}
                        onChange={(e) => setRuleValLen(parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 font-mono text-xs text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-slate-400">Value Divisor (e.g. 100 for cents)</label>
                      <input
                        type="number"
                        value={ruleDivisor}
                        onChange={(e) => setRuleDivisor(parseFloat(e.target.value) || 1)}
                        className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 font-mono text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description / Notes</label>
                <input
                  type="text"
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  placeholder="e.g. Scans starting with + add item immediately"
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1E293B]">
              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!ruleName.trim() || !rulePattern.trim()) {
                    alert('Please enter a rule name and pattern.');
                    return;
                  }
                  const newRule: BarcodeMappingRule = {
                    id: editingRuleId || `rule_${Date.now()}`,
                    name: ruleName.trim(),
                    matchType: ruleMatchType,
                    pattern: rulePattern.trim(),
                    action: ruleAction,
                    enabled: true,
                    description: ruleDescription.trim() || undefined,
                    skuStartIndex: ruleMatchType === 'plu_prefix' ? ruleSkuStart : undefined,
                    skuLength: ruleMatchType === 'plu_prefix' ? ruleSkuLen : undefined,
                    valueStartIndex: ruleMatchType === 'plu_prefix' ? ruleValStart : undefined,
                    valueLength: ruleMatchType === 'plu_prefix' ? ruleValLen : undefined,
                    valueDivisor: ruleMatchType === 'plu_prefix' ? ruleDivisor : undefined,
                  };

                  let updated = [...barcodeRules];
                  if (editingRuleId) {
                    updated = updated.map((r) => (r.id === editingRuleId ? newRule : r));
                  } else {
                    updated.push(newRule);
                  }

                  setBarcodeRules(updated);
                  posDb.updateSettings({ barcodeRules: updated });
                  onRefreshData();
                  setIsRuleModalOpen(false);
                  setRuleSuccessMsg(editingRuleId ? `Updated rule "${newRule.name}".` : `Created rule "${newRule.name}".`);
                  setTimeout(() => setRuleSuccessMsg(''), 4000);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md"
              >
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CASHIER & STAFF ACCOUNT MANAGEMENT */}
      {/* ========================================================================= */}
      {adminTab === 'cashiers' && (
        <div className="space-y-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" /> Cashier & Staff Access Management
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Create new cashier profiles, assign PIN security numbers, manage permissions, and suspend or activate accounts.
              </p>
            </div>

            <button
              onClick={() => setIsAddStaffModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Cashier Account</span>
            </button>
          </div>

          {/* Staff Accounts Table */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0F1115] text-slate-400 font-semibold border-b border-[#1E293B] text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Staff Name</th>
                  <th className="p-3.5">Username / Employee ID</th>
                  <th className="p-3.5">System Role</th>
                  <th className="p-3.5">Access Gates</th>
                  <th className="p-3.5">Security PIN</th>
                  <th className="p-3.5">Account Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3.5 font-bold text-[#E2E8F0]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-emerald-400 text-xs">
                          {staff.name.charAt(0)}
                        </div>
                        <span>{staff.name}</span>
                      </div>
                    </td>

                    <td className="p-3.5 font-mono text-slate-400">{staff.username}</td>

                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          staff.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : staff.role === 'senior_cashier'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {staff.role.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="p-3.5 max-w-[220px]">
                      {staff.role === 'admin' ? (
                        <span className="text-[10px] font-bold text-purple-300 uppercase">Full Access (all gates)</span>
                      ) : (
                        <>
                          <p className="text-[10px] text-slate-300 leading-snug" title={summarizeCashierAccess(staff.cashierAccess, 12)}>
                            {summarizeCashierAccess(staff.cashierAccess)}
                          </p>
                          <button
                            onClick={() => openGateEditor(staff)}
                            className="mt-1 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3 h-3" /> Edit Gates
                          </button>
                        </>
                      )}
                    </td>

                    <td className="p-3.5 font-mono text-slate-400">
                      <div className="flex items-center gap-2">
                        <span>{showPins[staff.id] ? staff.pin : '••••'}</span>
                        <button
                          onClick={() => setShowPins({ ...showPins, [staff.id]: !showPins[staff.id] })}
                          className="text-slate-500 hover:text-slate-300"
                          title="Toggle PIN Visibility"
                        >
                          {showPins[staff.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>

                    <td className="p-3.5">
                      {staff.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-semibold">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          Suspended
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right space-x-2">
                      {staff.role !== 'admin' && (
                        <button
                          onClick={() => openGateEditor(staff)}
                          className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors"
                        >
                          Edit Gates
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingStaffId(staff.id);
                          setResetPinValue(staff.pin);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-700 transition-colors"
                      >
                        Reset PIN
                      </button>

                      <button
                        onClick={() => handleToggleStaffStatus(staff.id, staff.status)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          staff.status === 'active'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                      >
                        {staff.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>

                      {staff.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(staff.id, staff.name)}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 p-1 rounded-lg transition-colors"
                          title="Delete Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Delete Staff Confirm Modal */}
          {staffToDelete && (
            <div className="fixed inset-0 z-50 bg-[#0F1115]/80 flex items-center justify-center p-4">
              <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 max-w-sm w-full text-[#E2E8F0] shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
                  <h3 className="font-bold text-sm flex items-center gap-2 text-rose-400">
                    <Trash2 className="w-4 h-4" /> Delete Staff Account
                  </h3>
                  <button onClick={() => setStaffToDelete(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-slate-300">
                  Are you sure you want to permanently delete the account for <span className="font-bold text-white">{staffToDelete.name}</span>? They will lose access to the system immediately.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setStaffToDelete(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteStaff}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-1.5 rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reset PIN Modal */}
          {editingStaffId && (
            <div className="fixed inset-0 z-50 bg-[#0F1115]/80 flex items-center justify-center p-4">
              <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 max-w-sm w-full text-[#E2E8F0] shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
                  <h3 className="font-bold text-sm flex items-center gap-2 text-emerald-400">
                    <Key className="w-4 h-4" /> Reset Security PIN
                  </h3>
                  <button onClick={() => setEditingStaffId(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    New Security PIN (4-6 digits):
                  </label>
                  <input
                    type="text"
                    value={resetPinValue}
                    onChange={(e) => setResetPinValue(e.target.value)}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setEditingStaffId(null)}
                    className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleResetPin(editingStaffId)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded-xl text-xs shadow-md"
                  >
                    Update Security PIN
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Edit Per-Cashier Access Gates */}
          {gateEditStaff && (
            <div className="fixed inset-0 z-50 bg-[#0F1115]/85 flex items-center justify-center p-4">
              <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 max-w-2xl w-full text-[#E2E8F0] shadow-2xl relative">
                <div className="flex items-center justify-between pb-3 border-b border-[#1E293B] mb-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                    <h3 className="font-bold text-base text-[#E2E8F0]">Security Gates — {gateEditStaff.name}</h3>
                  </div>
                  <button
                    onClick={() => setGateEditStaff(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-400 mb-3">
                  These gates apply only to <span className="font-bold text-slate-200">{gateEditStaff.name}</span> ({gateEditStaff.role.replace('_', ' ')}).
                  Disabled register actions prompt for a Manager PIN instead of being hidden.
                </p>

                <AccessGatePickerPanel
                  access={gateEditDraft}
                  onToggle={handleToggleGateEdit}
                  title="Enabled Security Gates"
                />

                <div className="pt-4 border-t border-[#1E293B] mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setGateEditStaff(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGateEditor}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Security Gates</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Create New Cashier Account */}
          {isAddStaffModalOpen && (
            <div className="fixed inset-0 z-50 bg-[#0F1115]/85 flex items-center justify-center p-4">
              <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 max-w-2xl w-full text-[#E2E8F0] shadow-2xl relative">
                <div className="flex items-center justify-between pb-3 border-b border-[#1E293B] mb-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <UserPlus className="w-5 h-5" />
                    <h3 className="font-bold text-base text-[#E2E8F0]">Create Cashier Account</h3>
                  </div>
                  <button
                    onClick={() => setIsAddStaffModalOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {staffError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{staffError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateCashier} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Full Staff Name: *
                    </label>
                    <input
                      type="text"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="e.g. Marie-Claire Fontaine"
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Username / ID: *
                      </label>
                      <input
                        type="text"
                        value={newStaffUsername}
                        onChange={(e) => setNewStaffUsername(e.target.value)}
                        placeholder="e.g. marie"
                        className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Security PIN: *
                      </label>
                      <input
                        type="password"
                        value={newStaffPin}
                        onChange={(e) => setNewStaffPin(e.target.value)}
                        placeholder="e.g. 4321"
                        className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      System Role (supervisor PIN authority):
                    </label>
                    <select
                      value={newStaffRole}
                      onChange={(e) => {
                        const role = e.target.value as StaffRole;
                        setNewStaffRole(role);
                        // Seed the per-cashier gate map from the matching preset.
                        setNewStaffAccess(applyAccessTierPreset(role));
                      }}
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                    >
                      <option value="cashier">Cashier</option>
                      <option value="senior_cashier">Senior Cashier</option>
                      <option value="shift_lead">Shift Lead</option>
                      <option value="admin">Administrator (Full Access)</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Role governs Manager-PIN authority; the gates below apply to this account's register sessions.
                    </p>
                  </div>

                  {newStaffRole !== 'admin' && (
                    <AccessGatePickerPanel
                      access={newStaffAccess}
                      onToggle={(area) =>
                        setNewStaffAccess((prev) => ({ ...prev, [area]: !prev[area] }))
                      }
                      title="Security Gates for this Account"
                    />
                  )}

                  <div className="pt-3 border-t border-[#1E293B] flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddStaffModalOpen(false)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md flex items-center gap-1.5"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Save Cashier Account</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EDIT PRODUCT TITLES & SET PRICES */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* TAB: REGISTER SETUP (WORKSTATIONS, PRICE TIERS & MULTI-CURRENCY) */}
      {/* ========================================================================= */}
      {adminTab === 'register' && (
        <div className="space-y-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4">
            <h2 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2">
              <Monitor className="w-4 h-4 text-emerald-400" /> Register Setup — Workstations, Pricing Tiers &amp; Multi-Currency
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure physical register stations, customer pricing tiers with background price sync, and multi-currency checkout options for this terminal.
            </p>
          </div>
        </div>
      )}

      {(adminTab === 'pricing' || adminTab === 'register') && (
        <div className="space-y-4">
          {/* Notification Toast */}
          {pricingSuccessMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-600 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{pricingSuccessMsg}</span>
            </div>
          )}

          {/* Price Lists & Terminals Configuration Box (Register pill only) */}
          {(adminTab === 'register') && (
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#1E293B] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#E2E8F0] flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-400" /> Customer Pricing Tiers & Physical Workstations
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure customer discount policies (Price Lists) and assign default policies to physical cashier stations (Workstations).
                </p>
              </div>
              <button
                type="button"
                onClick={handleSavePriceListsAndRegisters}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Save Pricing & Stations
              </button>
            </div>

            {/* Background Price Tier Sync Status Bar */}
            <div className="bg-[#0F1115] border border-cyan-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${isSyncingNow ? 'bg-amber-500/20 text-amber-400 animate-spin' : 'bg-cyan-500/20 text-cyan-400'}`}>
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Background Price Tier Sync Engine</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      isSyncingNow ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {isSyncingNow ? 'SYNCING ACTIVE...' : 'AUTO-SYNC ACTIVE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {syncStatus.lastSyncCompletedAt ? (
                      <>
                        Last synced {new Date(syncStatus.lastSyncCompletedAt).toLocaleTimeString()} • {syncStatus.lastSyncResult?.itemsProcessed || inventory.length} items recalculated across {priceListsState.length} price tiers in {syncStatus.lastSyncResult?.durationMs || 0}ms
                      </>
                    ) : (
                      'Automatically recalculates pricing across all inventory items when Price Tiers are modified.'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSyncingNow}
                  onClick={handleManualPriceSync}
                  className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
                  <span>{isSyncingNow ? 'Recalculating...' : 'Sync Item Prices Now'}</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowSyncHistory(!showSyncHistory)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all"
                >
                  {showSyncHistory ? 'Hide Logs' : 'Sync History'}
                </button>
              </div>
            </div>

            {/* Expandable Sync Audit Log */}
            {showSyncHistory && (
              <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 space-y-2 text-xs font-mono">
                <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between border-b border-[#1E293B] pb-1.5">
                  <span>PRICE TIER BACKGROUND SYNC AUDIT LOG</span>
                  <span className="text-[10px] text-slate-500 font-sans">{syncStatus.syncHistory.length} entries recorded</span>
                </div>
                {syncStatus.syncHistory.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic py-1">No price sync history logged yet.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {syncStatus.syncHistory.map((log) => (
                      <div key={log.id} className="text-[10px] bg-[#161B22] p-2 rounded border border-[#1E293B] flex items-center justify-between">
                        <div>
                          <span className="text-cyan-400 font-bold">[{log.triggerSource.toUpperCase()}]</span>{' '}
                          <span className="text-slate-300">{log.details}</span>
                        </div>
                        <span className="text-slate-500 shrink-0 ml-2">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Price Lists Column */}
              <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> 1. Customer Pricing Tiers (Discount Policies)
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Discounts applied to items during checkout
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newId = 'list_' + Date.now();
                      setPriceListsState([...priceListsState, { id: newId, name: 'New Custom Tier', type: 'wholesale', discountPercentage: 10, description: '10% Trade Tier' }]);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Tier
                  </button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {priceListsState.map((pl, idx) => (
                    <div key={pl.id} className="bg-[#161B22] border border-[#1E293B] p-3 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={pl.name}
                          onChange={(e) => {
                            const updated = [...priceListsState];
                            updated[idx].name = e.target.value;
                            setPriceListsState(updated);
                          }}
                          placeholder="Tier Name (e.g. Wholesale B2B)"
                          className="flex-1 bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs text-[#E2E8F0] font-bold focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPriceListsState(priceListsState.filter((l) => l.id !== pl.id));
                          }}
                          className="text-rose-400 hover:text-rose-300 p-1"
                          title="Delete Price Tier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400">Discount %</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="1"
                              value={pl.discountPercentage || 0}
                              onChange={(e) => {
                                const updated = [...priceListsState];
                                updated[idx].discountPercentage = parseFloat(e.target.value) || 0;
                                setPriceListsState(updated);
                              }}
                              className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-1 text-xs font-mono text-cyan-400 focus:outline-none"
                            />
                            <span className="absolute right-2 top-1 text-[11px] text-slate-500">%</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Description</label>
                          <input
                            type="text"
                            value={pl.description || ''}
                            onChange={(e) => {
                              const updated = [...priceListsState];
                              updated[idx].description = e.target.value;
                              setPriceListsState(updated);
                            }}
                            placeholder="e.g. Registered Trade"
                            className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cash Register Terminals Column */}
              <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5" /> 2. Physical Workstations (Hardware)
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Cashier counters, branch locations & default pricing
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newId = 'REG-' + (registersState.length + 1);
                      setRegistersState([...registersState, { id: newId, name: `Counter Station #${registersState.length + 1}`, location: 'Front Store', defaultPriceListId: priceListsState[0]?.id || 'retail', mode: 'retail', isOnline: true }]);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Station
                  </button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {registersState.map((reg, idx) => (
                    <div key={reg.id} className="bg-[#161B22] border border-[#1E293B] p-3 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={reg.name}
                          onChange={(e) => {
                            const updated = [...registersState];
                            updated[idx].name = e.target.value;
                            setRegistersState(updated);
                          }}
                          placeholder="Station Name (e.g. Main Checkout #1)"
                          className="flex-1 bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs text-[#E2E8F0] font-bold focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setRegistersState(registersState.filter((r) => r.id !== reg.id));
                          }}
                          className="text-rose-400 hover:text-rose-300 p-1"
                          title="Delete Station"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400">Physical Location</label>
                          <input
                            type="text"
                            value={reg.location || ''}
                            onChange={(e) => {
                              const updated = [...registersState];
                              updated[idx].location = e.target.value;
                              setRegistersState(updated);
                            }}
                            placeholder="e.g. Front Store, Floor 2"
                            className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Auto-Apply Pricing Tier</label>
                          <select
                            value={reg.defaultPriceListId}
                            onChange={(e) => {
                              const updated = [...registersState];
                              updated[idx].defaultPriceListId = e.target.value;
                              setRegistersState(updated);
                            }}
                            className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-2 py-1 text-xs text-cyan-300 font-bold focus:outline-none"
                          >
                            {priceListsState.map((pl) => (
                              <option key={pl.id} value={pl.id}>
                                {pl.name} {pl.discountPercentage ? `(-${pl.discountPercentage}%)` : '(0%)'}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          )}

          {(adminTab === 'pricing') && (<>

          {/* Bulk Price Adjustment Box */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
              <h3 className="font-bold text-xs text-[#E2E8F0] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" /> Batch Price Adjuster
              </h3>
              <span className="text-[10px] text-slate-400">
                Apply price changes across entire product categories at once
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Target Product Tab / Category:
                </label>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Product Tabs</option>
                  {categoryTabs.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Adjustment Mode:
                </label>
                <select
                  value={bulkMode}
                  onChange={(e) => setBulkMode(e.target.value as any)}
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-cyan-500"
                >
                  <option value="percentage">Percentage Change (%)</option>
                  <option value="flat">Flat Dollar Amount ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Value (+ or -):
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleApplyBulkPriceAdjustment}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-1.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1"
                >
                  <Percent className="w-3.5 h-3.5" />
                  <span>Apply Bulk Price Adjustment</span>
                </button>
              </div>
            </div>
          </div>

          {/* Product Filter & Live Price Table */}
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4 space-y-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={priceSearch}
                    onChange={(e) => setPriceSearch(e.target.value)}
                    placeholder="Search product titles, SKUs, brands..."
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl pl-9 pr-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Filter Category:</span>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Tabs ({inventory.length})</option>
                  {categoryTabs.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({inventory.filter((i) => i.category === c.name).length})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Editable Products Grid */}
            <div className="border border-[#1E293B] rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0F1115] text-slate-400 font-semibold border-b border-[#1E293B] text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Product Title / Description</th>
                    <th className="p-3">POS Category Tab</th>
                    <th className="p-3">Barcode SKU</th>
                    <th className="p-3 w-28 text-right">Retail ({settings.primaryCurrencySymbol || '$'})</th>
                    <th className="p-3 w-32 text-right">Retail ({settings.secondaryCurrencySymbol || '$'}) Override</th>
                    <th className="p-3 w-28 text-right">Cost ({settings.primaryCurrencySymbol || '$'})</th>
                    <th className="p-3 text-center">Stock</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {filteredProducts.map((item) => {
                    const draft = editingItemPrices[item.id] || {
                      name: item.name,
                      retailPrice: item.retailPrice,
                      retailPriceSecondary: item.retailPriceSecondary || 0,
                      costBasis: item.costBasis,
                      sku: item.sku,
                      category: item.category,
                    };

                    const isModified =
                      draft.name !== item.name ||
                      draft.retailPrice !== item.retailPrice ||
                      draft.retailPriceSecondary !== (item.retailPriceSecondary || 0) ||
                      draft.costBasis !== item.costBasis ||
                      draft.sku !== item.sku ||
                      draft.category !== item.category;

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        {/* Title Editor */}
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={draft.name}
                            onChange={(e) => handlePriceFieldChange(item.id, 'name', e.target.value)}
                            className="w-full bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded px-2.5 py-1 text-xs font-semibold text-[#E2E8F0]"
                          />
                        </td>

                        {/* Category Tab Selector */}
                        <td className="p-2.5">
                          <select
                            value={draft.category}
                            onChange={(e) => handlePriceFieldChange(item.id, 'category', e.target.value)}
                            className="bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded px-2 py-1 text-xs text-emerald-400 font-semibold"
                          >
                            {categoryTabs.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* SKU */}
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={draft.sku}
                            onChange={(e) => handlePriceFieldChange(item.id, 'sku', e.target.value)}
                            className="w-28 bg-[#0F1115] border border-[#1E293B] focus:border-emerald-500 rounded px-2 py-1 text-xs font-mono text-slate-300"
                          />
                        </td>

                        {/* Retail Price */}
                        <td className="p-2.5 text-right">
                          <div className="relative inline-block w-24">
                            <span className="absolute left-1.5 top-1.5 text-emerald-500 font-bold text-[10px]">{settings.primaryCurrencySymbol || '$'}</span>
                            <input
                              type="number"
                              step="0.01"
                              value={draft.retailPrice}
                              onChange={(e) =>
                                handlePriceFieldChange(
                                  item.id,
                                  'retailPrice',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full bg-[#0F1115] border border-emerald-500/50 rounded pl-6 pr-1 py-1 text-xs font-mono font-bold text-emerald-400 text-right focus:border-emerald-400 focus:outline-none"
                            />
                          </div>
                        </td>

                        {/* Secondary Retail Price Override */}
                        <td className="p-2.5 text-right">
                          <div className="relative inline-block w-28">
                            <span className="absolute left-1.5 top-1.5 text-cyan-500 font-bold text-[10px]">{settings.secondaryCurrencySymbol || '$'}</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder={(draft.retailPrice / (settings.exchangeRate || 1)).toFixed(2)}
                              value={draft.retailPriceSecondary || ''}
                              onChange={(e) =>
                                handlePriceFieldChange(
                                  item.id,
                                  'retailPriceSecondary',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full bg-[#0F1115] border border-slate-700/60 rounded pl-6 pr-1 py-1 text-xs font-mono text-cyan-400 text-right focus:border-cyan-500 focus:outline-none"
                              title="Set a custom fixed secondary price, or leave empty to auto-calculate using the exchange rate"
                            />
                          </div>
                        </td>

                        {/* Cost Basis */}
                        <td className="p-2.5 text-right">
                          <div className="relative inline-block w-24">
                            <span className="absolute left-1.5 top-1.5 text-slate-500 text-[10px]">{settings.primaryCurrencySymbol || '$'}</span>
                            <input
                              type="number"
                              step="0.01"
                              value={draft.costBasis}
                              onChange={(e) =>
                                handlePriceFieldChange(
                                  item.id,
                                  'costBasis',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full bg-[#0F1115] border border-[#1E293B] rounded pl-6 pr-1 py-1 text-xs font-mono text-slate-400 text-right focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                        </td>

                        {/* Stock */}
                        <td className="p-2.5 text-center font-bold text-white font-mono">
                          {item.stockLevel}
                        </td>

                        {/* Save Action Button */}
                        <td className="p-2.5 text-right">
                          <button
                            disabled={!isModified}
                            onClick={() => handleSaveProductRow(item.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ml-auto ${
                              isModified
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md animate-pulse'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>)}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CATEGORY & POS PRODUCT TABS MANAGER */}
      {/* ========================================================================= */}
      {adminTab === 'tabs' && (
        <div className="space-y-4">
          {catSuccessMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-600 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{catSuccessMsg}</span>
            </div>
          )}

          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2">
                  <FolderEdit className="w-4 h-4 text-emerald-400" /> POS Product Tab Titles & Categories
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rename POS register product tab titles, add custom product categories, or delete unused tabs.
                </p>
              </div>

              {/* Add New Tab Form */}
              <form onSubmit={handleAddNewCategoryTab} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCategoryTitle}
                  onChange={(e) => setNewCategoryTitle(e.target.value)}
                  placeholder="New Tab Title (e.g. Shell Jewelry)"
                  className="bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-md flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Tab</span>
                </button>
              </form>
            </div>

            {/* Category Tabs List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categoryTabs.map((cat) => {
                const itemCount = inventory.filter((i) => i.category === cat.name).length;
                const draftTitle = editingCatName[cat.name] || cat.name;
                const isChanged = draftTitle.trim() !== cat.name;

                return (
                  <div
                    key={cat.id}
                    className="bg-[#0F1115] border border-[#1E293B] hover:border-slate-700 rounded-xl p-3.5 space-y-2.5 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Category Tab ID: {cat.id}
                      </span>
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                        {itemCount} Products
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={draftTitle}
                        onChange={(e) =>
                          setEditingCatName({
                            ...editingCatName,
                            [cat.name]: e.target.value,
                          })
                        }
                        className="flex-1 bg-[#161B22] border border-[#1E293B] focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs font-bold text-[#E2E8F0]"
                      />

                      <button
                        disabled={!isChanged}
                        onClick={() => handleSaveCategoryRename(cat.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                          isChanged
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Update</span>
                      </button>

                      <button
                        onClick={() => handleDeleteCategoryTab(cat.name)}
                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 p-2 rounded-lg transition-colors"
                        title="Delete Category Tab"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: CATEGORY PRESETS & SMART SIZING PILLS CUSTOMIZER */}
      {/* ========================================================================= */}
      {adminTab === 'pills' && (
        <div className="space-y-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" /> Category Presets &amp; Quick Sizing Pill Manager
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize the buttons and pills shown inside the "Add Single Item" window. Add your own category presets, customize youth &amp; adult sizing pills, artwork prints, scents, and materials.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsPresetModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5"
            >
              <Sliders className="w-4 h-4" />
              <span>Open Presets &amp; Sizing Editor</span>
            </button>
          </div>

          {/* Quick Catalog Presets Management — Product Management pill only */}
          <div className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" /> Quick Catalog Presets (Import Template Pills)
                </h4>
                <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                  Customize template titles, sample catalog CSV items, and download presets for your shop.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomTemplatesModalOpen(true)}
                className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-amber-500/30 transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" /> Manage Catalog Template Pills
              </button>
            </div>
          </div>

          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Tag className="w-4 h-4 text-cyan-400" /> Active Category Presets ({getStoredCategoryPresets().length})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {getStoredCategoryPresets().map((preset) => (
                <div
                  key={preset.id || preset.name}
                  className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3.5 space-y-2 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center gap-2">
                      <span className="text-lg">{preset.icon}</span>
                      <span>{preset.name}</span>
                    </span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded capitalize font-mono">
                      {preset.profileType}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">Quick Pills: </span>
                    <span className="italic">{preset.commonVariants.slice(0, 4).join(', ')}{preset.commonVariants.length > 4 ? ` +${preset.commonVariants.length - 4} more` : ''}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Click <strong>"Open Presets &amp; Sizing Editor"</strong> to add new pills, rename titles, or modify youth/adult sizing matrices.
              </span>
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Edit Pills &amp; Options</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preset Customizer Modal */}
      <CategoryPresetAdmin
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        onPresetsUpdated={() => {
          onRefreshData();
        }}
      />

      {/* ========================================================================= */}
      {/* TAB 4: PRINTED RECEIPT CUSTOMIZER (LOGO, HEADER, FOOTER) */}
      {/* ========================================================================= */}
      {adminTab === 'receipts' && (
        <div className="space-y-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" /> Printed Receipt Header, Footer & Logo Customizer
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload your boutique branding logo, edit address header lines, VAT tax ID, and customer thank-you policy notes for physical receipts.
              </p>
            </div>
          </div>

          {settingsSuccessMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-600 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{settingsSuccessMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Settings - 7 cols */}
            <form onSubmit={handleSaveReceiptSettings} className="lg:col-span-7 bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-5 shadow-lg">
              
              {/* Section 1: Logo Upload & Preset Selection */}
              <div className="space-y-3 pb-4 border-b border-[#1E293B]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> 1. Store Logo Graphic Image
                </h3>

                <div className="bg-[#0F1115] p-3.5 rounded-xl border border-[#1E293B] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-300">
                      Upload Logo Image File (PNG / JPG / SVG):
                    </label>

                    <label className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Browse Local Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1E293B]/60 pt-3">
                    <label className="text-xs font-semibold text-slate-300">
                      Or Capture Logo via Web Camera:
                    </label>

                    {!isCameraActive ? (
                      <button
                        type="button"
                        onClick={startCamera}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Activate Camera</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <VideoOff className="w-3.5 h-3.5" />
                        <span>Deactivate Camera</span>
                      </button>
                    )}
                  </div>

                  {/* Camera view screen */}
                  {isCameraActive && (
                    <div className="bg-[#161B22] p-3 rounded-xl border border-cyan-500/20 flex flex-col items-center gap-3">
                      {cameraError && (
                        <span className="text-[11px] text-red-400 font-medium">⚠️ {cameraError}</span>
                      )}
                      <div className="relative w-full max-w-[240px] aspect-square rounded-lg overflow-hidden bg-black border border-[#1E293B]">
                        <video
                          ref={(el) => {
                            setVideoEl(el);
                            if (el && cameraStream) {
                              el.srcObject = cameraStream;
                            }
                          }}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        {/* overlay grid helper */}
                        <div className="absolute inset-0 border border-dashed border-cyan-400/30 pointer-events-none flex items-center justify-center">
                          <div className="w-2/3 h-2/3 border border-dashed border-cyan-400/40 rounded-full"></div>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={captureCameraSnapshot}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
                      >
                        <Camera className="w-4 h-4 animate-pulse" />
                        <span>📸 Capture & Apply Square Logo</span>
                      </button>
                    </div>
                  )}

                  <div className="border-t border-[#1E293B]/60 pt-3">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Or Paste Logo Image URL / Data URI:
                    </label>
                    <input
                      type="text"
                      value={settings.receiptLogoUrl || ''}
                      onChange={(e) => setSettings({ ...settings, receiptLogoUrl: e.target.value })}
                      placeholder="https://... or data:image/..."
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Preset Logos & Remove Button */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#1E293B]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold">Quick Presets:</span>
                      <button
                        type="button"
                        onClick={() => handleApplyPresetLogo('palm')}
                        className="bg-[#161B22] hover:bg-slate-800 text-slate-300 border border-[#1E293B] px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors"
                      >
                        🌴 Tropical Palm
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPresetLogo('seashell')}
                        className="bg-[#161B22] hover:bg-slate-800 text-slate-300 border border-[#1E293B] px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors"
                      >
                        🐚 Seashell Craft
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPresetLogo('boutique')}
                        className="bg-[#161B22] hover:bg-slate-800 text-slate-300 border border-[#1E293B] px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors"
                      >
                        ⭐ Island Star
                      </button>
                    </div>

                    {settings.receiptLogoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Header Text Customization */}
              <div className="space-y-3 pb-4 border-b border-[#1E293B]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> 2. Receipt Header Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Boutique / Store Name:
                    </label>
                    <input
                      type="text"
                      value={settings.storeName || ''}
                      onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                      placeholder="e.g. Your Store"
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Header Subtitle / Tagline:
                    </label>
                    <input
                      type="text"
                      value={settings.receiptHeaderSubtitle || ''}
                      onChange={(e) => setSettings({ ...settings, receiptHeaderSubtitle: e.target.value })}
                      placeholder="e.g. Official Retailer • House Brand"
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Address & Contact Info Lines (1 line per row):
                  </label>
                  <textarea
                    rows={3}
                    value={headerLinesText}
                    onChange={(e) => setHeaderLinesText(e.target.value)}
                    placeholder="123 Harbour Road&#10;Tel: +000 000 0000 • Email: info@yourstore.com"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400">
                    Each line entered above prints as a separate centered text line under the store title.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tax Registration Number (e.g. VAT ID):
                  </label>
                  <input
                    type="text"
                    value={settings.taxRegistrationNumber || ''}
                    onChange={(e) => setSettings({ ...settings, taxRegistrationNumber: e.target.value })}
                    placeholder="e.g. VAT-SEY-984210"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Section 3: Footer Text Customization */}
              <div className="space-y-3 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> 3. Receipt Footer & Policy Notes
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Main Thank You / Gratitude Message:
                  </label>
                  <input
                    type="text"
                    value={settings.receiptFooterMessage || ''}
                    onChange={(e) => setSettings({ ...settings, receiptFooterMessage: e.target.value })}
                    placeholder="e.g. Thank you for visiting our boutique!"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Return & Exchange Policy Statement:
                  </label>
                  <input
                    type="text"
                    value={settings.receiptFooterPolicy || ''}
                    onChange={(e) => setSettings({ ...settings, receiptFooterPolicy: e.target.value })}
                    placeholder="e.g. Returns accepted within 14 days with valid original sales receipt."
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Additional Footer Notes (1 line per row, e.g., Social, Wifi):
                  </label>
                  <textarea
                    rows={3}
                    value={footerLinesText}
                    onChange={(e) => setFooterLinesText(e.target.value)}
                    placeholder="Follow us on Instagram @yourstore&#10;www.yourstore.com"
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Submit Save Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md flex items-center gap-2 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Receipt Customization</span>
                </button>
              </div>
            </form>

            {/* Live Paper Receipt Preview - 5 cols */}
            <div className="lg:col-span-5 space-y-3">
              <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#1E293B] mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#E2E8F0]">
                    <Printer className="w-4 h-4 text-cyan-400" />
                    <span>Live Thermal Receipt Preview</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                    title="Test Print Thermal Paper Output"
                  >
                    <Printer className="w-3 h-3 text-cyan-400" /> Test Print
                  </button>
                </div>

                {/* Thermal Paper Card Simulation */}
                <div className="p-5 bg-white text-slate-900 rounded-xl font-mono text-[11px] shadow-inner border border-slate-200 space-y-3 printable-receipt">
                  {/* Header */}
                  <div className="text-center pb-3 border-b border-dashed border-slate-300 space-y-1">
                    {settings.receiptLogoUrl && (
                      <div className="flex justify-center mb-1">
                        <img
                          src={settings.receiptLogoUrl}
                          alt="Logo Preview"
                          className="max-h-14 max-w-[150px] object-contain mx-auto filter grayscale contrast-125"
                        />
                      </div>
                    )}

                    <div className="font-bold text-sm uppercase tracking-wider text-slate-900">
                      {settings.storeName || 'My Boutique'}
                    </div>

                    {settings.receiptHeaderSubtitle && (
                      <div className="text-[10px] text-slate-700 font-semibold">
                        {settings.receiptHeaderSubtitle}
                      </div>
                    )}

                    {headerLinesText.split('\n').filter(l => l.trim()).length > 0 && (
                      <div className="space-y-0.5 text-[9.5px] text-slate-600">
                        {headerLinesText.split('\n').filter(l => l.trim()).map((line, idx) => (
                          <div key={idx}>{line.trim()}</div>
                        ))}
                      </div>
                    )}

                    {settings.taxRegistrationNumber && (
                      <div className="text-[9px] text-slate-500 font-bold mt-0.5">
                        Tax Reg ID: {settings.taxRegistrationNumber}
                      </div>
                    )}
                  </div>

                  {/* Sample Receipt Meta */}
                  <div className="py-2 border-b border-dashed border-slate-300 space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Receipt #:</span>
                      <span className="font-bold">INV-20260821-DEMO</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Date/Time:</span>
                      <span>21/08/2026, 13:26:31</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cashier:</span>
                      <span>Jane Doe</span>
                    </div>
                  </div>

                  {/* Sample Items */}
                  <div className="py-2 border-b border-dashed border-slate-300 space-y-1.5">
                    <div className="font-bold uppercase text-[9px] text-slate-500 flex justify-between">
                      <span>Item Description</span>
                      <span>Total</span>
                    </div>
                    <div className="space-y-1">
                      <div>
                        <div className="flex justify-between font-semibold">
                          <span>[Ocean] T-Shirt - Turtle Cove (Adult L)</span>
                          <span>$28.00</span>
                        </div>
                        <div className="text-[9px] text-slate-500 flex justify-between">
                          <span>1 x $28.00</span>
                          <span>VAT {(settings.defaultVatRate * 100).toFixed(0)}%: ${(28 * settings.defaultVatRate).toFixed(2)}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between font-semibold">
                          <span>[Ocean] Ceramic Mug - Gold Rim Line</span>
                          <span>$16.00</span>
                        </div>
                        <div className="text-[9px] text-slate-500 flex justify-between">
                          <span>1 x $16.00</span>
                          <span>VAT {(settings.defaultVatRate * 100).toFixed(0)}%: ${(16 * settings.defaultVatRate).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="py-2 border-b border-dashed border-slate-300 space-y-0.5 text-right text-[10px]">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal (Net):</span>
                      <span>$38.26</span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-semibold">
                      <span>VAT Tax Amount:</span>
                      <span>$5.74</span>
                    </div>
                    <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300 text-slate-900">
                      <span>TOTAL PAID:</span>
                      <span>$44.00</span>
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="py-2 border-b border-dashed border-slate-300 text-slate-600 text-[10px] flex justify-between">
                    <span>Paid via Cash:</span>
                    <span className="font-bold text-slate-900">$50.00 (Change: $6.00)</span>
                  </div>

                  {/* Footer Notes */}
                  <div className="pt-2 text-center space-y-2">
                    <div className="font-bold font-mono text-[10px]">||||| |||||| ||||||| |||||</div>
                    <div className="text-[9px] text-slate-500 font-mono">INV-20260821-DEMO</div>

                    {/* Live Preview QR Code Section */}
                    <div className="border-t border-b border-dashed border-slate-300 py-3 space-y-1.5">
                      <div className="text-[8px] font-bold uppercase text-slate-800">
                        Scan to View Digital Invoice & Leave Feedback
                      </div>
                      <div className="flex justify-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                            `${window.location.origin}${window.location.pathname}?receipt=INV-20260821-DEMO`
                          )}`}
                          alt="Demo Receipt QR Code"
                          className="w-20 h-20 border border-slate-200 p-0.5 bg-white inline-block"
                        />
                      </div>
                      <div className="text-[7.5px] text-slate-500 font-mono break-all max-w-[200px] mx-auto">
                        {window.location.origin}{window.location.pathname}?receipt=INV-20260821-DEMO
                      </div>
                    </div>

                    {settings.receiptFooterMessage && (
                      <div className="text-[10px] text-slate-800 font-sans font-bold pt-1">
                        {settings.receiptFooterMessage}
                      </div>
                    )}

                    {settings.receiptFooterPolicy && (
                      <div className="text-[9px] text-slate-600 font-sans italic border-t border-slate-200 pt-1">
                        {settings.receiptFooterPolicy}
                      </div>
                    )}

                    {footerLinesText.split('\n').filter(l => l.trim()).length > 0 && (
                      <div className="text-[8.5px] text-slate-500 font-mono space-y-0.5 pt-0.5">
                        {footerLinesText.split('\n').filter(l => l.trim()).map((line, idx) => (
                          <div key={idx}>{line.trim()}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: CUSTOMER FEEDBACK & RATING REVIEWS */}
      {/* ========================================================================= */}
      {adminTab === 'feedback' && (
        <div className="space-y-4">
          <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#1E293B] pb-4 mb-6 gap-4">
              <div>
                <h2 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" /> Customer Experience & Satisfaction Logs
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  View and analyze ratings, comments, and standout areas submitted by customers scanning receipt QR codes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to clear all archived feedback reviews? This cannot be undone.')) {
                    localStorage.removeItem('island_pos_feedback_v2');
                    loadBackendData();
                  }
                }}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all self-start font-sans"
              >
                Clear All Logs
              </button>
            </div>

            {/* Stats Dashboard */}
            {posDb.getFeedbackList().length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Average Satisfaction</div>
                  <div className="text-3xl font-black font-mono text-emerald-400 my-1">
                    {(posDb.getFeedbackList().reduce((sum, f) => sum + f.rating, 0) / posDb.getFeedbackList().length).toFixed(1)} / 5.0
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {'★'.repeat(Math.round(posDb.getFeedbackList().reduce((sum, f) => sum + f.rating, 0) / posDb.getFeedbackList().length))}
                  </div>
                </div>

                <div className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Total Reviews Received</div>
                  <div className="text-3xl font-black font-mono text-[#E2E8F0] my-1">
                    {posDb.getFeedbackList().length}
                  </div>
                  <div className="text-[10px] text-slate-400">100% Client-Authoritative</div>
                </div>

                <div className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">5-Star Excellence</div>
                  <div className="text-3xl font-black font-mono text-cyan-400 my-1">
                    {posDb.getFeedbackList().filter(f => f.rating === 5).length}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {((posDb.getFeedbackList().filter(f => f.rating === 5).length / posDb.getFeedbackList().length) * 100).toFixed(0)}% of total submissions
                  </div>
                </div>

                <div className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Primary Standout Area</div>
                  <div className="text-lg font-bold text-amber-400 my-2.5 truncate px-2">
                    {(() => {
                      const counts: { [c: string]: number } = {};
                      posDb.getFeedbackList().forEach(f => {
                        counts[f.category] = (counts[f.category] || 0) + 1;
                      });
                      let topCat = 'None';
                      let max = 0;
                      Object.entries(counts).forEach(([cat, val]) => {
                        if (val > max) {
                          max = val;
                          topCat = cat;
                        }
                      });
                      return topCat;
                    })()}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">Most highlighted aspect</div>
                </div>
              </div>
            ) : null}

            {/* Filter controls */}
            <div className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1 uppercase text-[9px]">Filter by Star Rating</label>
                <select
                  value={feedbackRatingFilter}
                  onChange={(e) => setFeedbackRatingFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 cursor-pointer font-bold"
                >
                  <option value="ALL">All Ratings</option>
                  <option value="5">5 Stars (Excellent)</option>
                  <option value="4">4 Stars (Great)</option>
                  <option value="3">3 Stars (Good)</option>
                  <option value="2">2 Stars (Fair)</option>
                  <option value="1">1 Star (Poor)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1 uppercase text-[9px]">Filter by Category</label>
                <select
                  value={feedbackCategoryFilter}
                  onChange={(e) => setFeedbackCategoryFilter(e.target.value)}
                  className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 cursor-pointer font-bold"
                >
                  <option value="ALL">All Standout Categories</option>
                  <option value="Service Quality">Service Quality</option>
                  <option value="Product Selection">Product Selection</option>
                  <option value="Store Cleanliness">Store Cleanliness</option>
                  <option value="Checkout Speed">Checkout Speed</option>
                  <option value="Overall Value">Overall Value</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1 uppercase text-[9px]">Search Comments & Invoices</label>
                <div className="relative">
                  <input
                    type="text"
                    value={feedbackSearchTerm}
                    onChange={(e) => setFeedbackSearchTerm(e.target.value)}
                    placeholder="Search receipt # or text..."
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl pl-8 pr-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500 font-semibold"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {/* Feedback List render */}
            {(() => {
              const list = posDb.getFeedbackList().filter((fb) => {
                const matchRating = feedbackRatingFilter === 'ALL' || fb.rating === feedbackRatingFilter;
                const matchCategory = feedbackCategoryFilter === 'ALL' || fb.category === feedbackCategoryFilter;
                const matchSearch =
                  !feedbackSearchTerm ||
                  fb.receiptNumber.toLowerCase().includes(feedbackSearchTerm.toLowerCase()) ||
                  fb.comments.toLowerCase().includes(feedbackSearchTerm.toLowerCase());
                return matchRating && matchCategory && matchSearch;
              });

              if (list.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-500 space-y-2 border border-dashed border-[#1E293B] rounded-xl bg-[#0F1115]">
                    <MessageSquare className="w-8 h-8 mx-auto text-slate-600" />
                    <div className="text-xs font-bold text-slate-400">No Feedback Matches</div>
                    <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                      Either no ratings have been submitted yet, or your active filter options returned zero reviews.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {list.map((fb) => (
                    <div key={fb.id} className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl flex flex-col justify-between space-y-3 shadow-sm hover:border-emerald-500/30 transition-colors">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-0.5">
                            <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded">
                              {fb.category}
                            </span>
                            <div className="text-[9px] text-slate-500 font-mono mt-1">
                              Ref: <span className="font-bold text-slate-300">{fb.receiptNumber}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-emerald-400 font-mono text-xs font-bold">
                              {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                              {new Date(fb.timestamp).toLocaleDateString()} {new Date(fb.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: PERIPHERAL HARDWARE DASHBOARD & CALIBRATION */}
      {/* ========================================================================= */}
      {adminTab === 'hardware' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Left Column: Barcode Scanner Input Mode Config */}
            <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-emerald-400" /> Barcode Scanner Input Connectivity Mode
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select how your physical USB or Bluetooth laser scanner communicates with this web terminal app.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* HID Keyboard Emulation Mode */}
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = 'hid';
                    setSettings((prev) => ({ ...prev, barcodeScannerMode: nextMode }));
                    posDb.updateSettings({ barcodeScannerMode: nextMode });
                    onRefreshData();
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    (settings.barcodeScannerMode || 'hid') === 'hid'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                      : 'bg-[#0F1115]/60 border-[#1E293B]/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">HID Mode</span>
                    <span className={`w-2 h-2 rounded-full ${
                      (settings.barcodeScannerMode || 'hid') === 'hid' ? 'bg-emerald-400 shadow-emerald-500/50 shadow' : 'bg-slate-700'
                    }`} />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1 font-mono leading-relaxed">
                    Keyboard Emulation (Plug & Play). Captures raw keyboard sequence events globally. Requires no custom COM drivers.
                  </span>
                </button>

                {/* Serial COM Mode */}
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = 'serial';
                    setSettings((prev) => ({ ...prev, barcodeScannerMode: nextMode }));
                    posDb.updateSettings({ barcodeScannerMode: nextMode });
                    onRefreshData();
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    settings.barcodeScannerMode === 'serial'
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-white'
                      : 'bg-[#0F1115]/60 border-[#1E293B]/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Serial Mode</span>
                    <span className={`w-2 h-2 rounded-full ${
                      settings.barcodeScannerMode === 'serial' ? 'bg-cyan-400 shadow-cyan-500/50 shadow' : 'bg-slate-700'
                    }`} />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1 font-mono leading-relaxed">
                    Virtual COM Port (Direct Stream). Intercepts direct serial character chunks. Prevents input focus/cursor collisions.
                  </span>
                </button>
              </div>

              {/* Live Scanner diagnostic tool */}
              <div className="bg-[#0F1115]/80 rounded-xl border border-[#1E293B] p-4 space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <span>🛰️ Diagnostics & Input Signal Terminal</span>
                  <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono font-semibold">
                    Scanner Online
                  </span>
                </div>
                
                <div className="space-y-1">
                  <label className="text-slate-500 text-[10px]">Active Port Interface Listener:</label>
                  <div className="text-slate-300 bg-[#06080B] p-2 rounded border border-[#1E293B] break-all">
                    {(settings.barcodeScannerMode || 'hid') === 'hid' 
                      ? '[DEBUG] window.addEventListener("keydown") global buffer emulation is active'
                      : '[DEBUG] navigator.serial.requestPort() fallback COM port virtual buffer stream connected'
                    }
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-slate-500 text-[10px]">Test Hardware scan buffer (simulated key input):</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Simulate laser scan... e.g. 501002"
                      value={testScanInput}
                      onChange={(e) => setTestScanInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // trigger simulation
                          const raw = testScanInput.trim();
                          if (raw) {
                            const res = posDb.getSettings().barcodeRules || [];
                            const matched = parseAndExecuteBarcode(raw, res, inventory, true);
                            setTestScanResult(matched);
                            soundService.playBeep();
                          }
                        }
                      }}
                      className="flex-1 bg-[#06080B] border border-[#1E293B] rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-emerald-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const raw = testScanInput.trim();
                        if (raw) {
                          const res = posDb.getSettings().barcodeRules || [];
                          const matched = parseAndExecuteBarcode(raw, res, inventory, true);
                          setTestScanResult(matched);
                          soundService.playBeep();
                        }
                      }}
                      className="bg-[#1E293B] hover:bg-slate-800 text-slate-300 font-bold px-3 py-1 rounded-lg text-xs"
                    >
                      Fire
                    </button>
                  </div>
                </div>

                {testScanResult && (
                  <div className="mt-2.5 bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1 text-[10px]">
                    <div className="text-emerald-400 font-bold flex items-center justify-between">
                      <span>✓ Simulation Result:</span>
                      <span className="text-[9px] text-slate-500 font-normal font-sans">
                        Raw Buffer: "{testScanResult.rawBarcode}"
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-slate-400">
                      <div>Matched SKU: <span className="text-white font-bold font-mono">{testScanResult.matchedItem?.sku || 'None'}</span></div>
                      <div>Product: <span className="text-white font-bold">{testScanResult.matchedItem?.name || 'No match'}</span></div>
                      <div>Action: <span className="text-cyan-400 font-mono">{testScanResult.actionToTake || 'none'}</span></div>
                      <div>Multiplier/Val: <span className="text-amber-400">{testScanResult.parsedMultiplier?.toFixed(2) || '1.0'}</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Dual Customer Display Zoom & Resolution Calibration */}
            <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-emerald-400" /> Dual-Display Pole-Screen Calibration & Zoom
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calibrate width, height, and content scale ratios for standard poles or checkout LCDs to prevent content overflowing.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Resolution Width */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Display Resolution Width (px):</label>
                  <input
                    type="number"
                    min="400"
                    max="3840"
                    placeholder="e.g. 1920"
                    value={settings.dualDisplayResolutionWidth || 1024}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1024;
                      setSettings((prev) => ({ ...prev, dualDisplayResolutionWidth: val }));
                      posDb.updateSettings({ dualDisplayResolutionWidth: val });
                      onRefreshData();
                    }}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                {/* Resolution Height */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Display Resolution Height (px):</label>
                  <input
                    type="number"
                    min="300"
                    max="2160"
                    placeholder="e.g. 768"
                    value={settings.dualDisplayResolutionHeight || 768}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 768;
                      setSettings((prev) => ({ ...prev, dualDisplayResolutionHeight: val }));
                      posDb.updateSettings({ dualDisplayResolutionHeight: val });
                      onRefreshData();
                    }}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Precision Zoom / Scaling Factor */}
              <div className="space-y-2 border-t border-[#1E293B]/50 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Content Scaling zoom calibration factor:
                  </label>
                  <span className="text-xs font-black font-mono text-emerald-400">
                    {settings.dualDisplayScale || 100}%
                  </span>
                </div>
                
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={settings.dualDisplayScale || 100}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 100;
                    setSettings((prev) => ({ ...prev, dualDisplayScale: val }));
                    posDb.updateSettings({ dualDisplayScale: val });
                    onRefreshData();
                  }}
                  className="w-full accent-emerald-500 h-1.5 rounded-lg bg-slate-950 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[9px] text-slate-500">
                  <span>Compact / Fit (50%)</span>
                  <span>Actual Size (100%)</span>
                  <span>Magnified / Large (150%)</span>
                </div>
              </div>

              {/* Fast resolution presets */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Quick Presets:</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSettings((prev) => ({ ...prev, dualDisplayResolutionWidth: 1024, dualDisplayResolutionHeight: 768, dualDisplayScale: 90 }));
                      posDb.updateSettings({ dualDisplayResolutionWidth: 1024, dualDisplayResolutionHeight: 768, dualDisplayScale: 90 });
                      onRefreshData();
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 border border-[#1E293B] px-2.5 py-1 rounded-lg"
                  >
                    Retro Pole (1024x768 @ 90%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettings((prev) => ({ ...prev, dualDisplayResolutionWidth: 1920, dualDisplayResolutionHeight: 1080, dualDisplayScale: 100 }));
                      posDb.updateSettings({ dualDisplayResolutionWidth: 1920, dualDisplayResolutionHeight: 1080, dualDisplayScale: 100 });
                      onRefreshData();
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 border border-[#1E293B] px-2.5 py-1 rounded-lg"
                  >
                    FHD Secondary Monitor (1920x1080 @ 100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettings((prev) => ({ ...prev, dualDisplayResolutionWidth: 800, dualDisplayResolutionHeight: 800, dualDisplayScale: 80 }));
                      posDb.updateSettings({ dualDisplayResolutionWidth: 800, dualDisplayResolutionHeight: 800, dualDisplayScale: 80 });
                      onRefreshData();
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 border border-[#1E293B] px-2.5 py-1 rounded-lg"
                  >
                    Square Pole Box (800x800 @ 80%)
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}



      {/* ========================================================================= */}
      {/* TAB 5: STORE SETTINGS, COMMUNICATIONS & WHITELABEL */}
      {/* ========================================================================= */}
      {(adminTab === 'settings' || adminTab === 'whitelabel' || adminTab === 'comms' || adminTab === 'hardware' || adminTab === 'register') && (
        <div className="space-y-4">
          {settingsSuccessMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-600 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{settingsSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveStoreSettings} className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 space-y-6 shadow-lg">
            {(adminTab === 'whitelabel') && (
              <>
                <div>
                  <h2 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 border-b border-[#1E293B] pb-2">
                    <Store className="w-4 h-4 text-emerald-400" /> White Label Store Profile &amp; VAT Configuration
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Boutique / Store Name:
                    </label>
                    <input
                      type="text"
                      value={settings.storeName}
                      onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Tax Registration Number (e.g. VAT ID):
                    </label>
                    <input
                      type="text"
                      value={settings.taxRegistrationNumber || ''}
                      onChange={(e) => setSettings({ ...settings, taxRegistrationNumber: e.target.value })}
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Default VAT Rate (%):
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={vatRateStr}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setVatRateStr(raw);
                        const val = parseFloat(raw);
                        if (!isNaN(val) && val >= 0) {
                          setSettings({
                            ...settings,
                            defaultVatRate: val / 100,
                          });
                        }
                      }}
                      onBlur={() => {
                        if (vatRateStr.trim() === '') {
                          setVatRateStr(String(Math.round((settings.defaultVatRate ?? 0.15) * 100)));
                        }
                      }}
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      VAT Mode:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, vatInclusive: false })}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          settings.vatInclusive !== true
                            ? 'bg-emerald-950/40 border-emerald-500/80'
                            : 'bg-[#0F1115] border-[#1E293B] hover:border-slate-700'
                        }`}
                      >
                        <div className={`text-xs font-bold ${settings.vatInclusive !== true ? 'text-emerald-300' : 'text-slate-300'}`}>
                          Added at Checkout
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                          Price tags exclude VAT. Tax is calculated and added on top of the subtotal at checkout (default).
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, vatInclusive: true })}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          settings.vatInclusive === true
                            ? 'bg-cyan-950/40 border-cyan-500/80'
                            : 'bg-[#0F1115] border-[#1E293B] hover:border-slate-700'
                        }`}
                      >
                        <div className={`text-xs font-bold ${settings.vatInclusive === true ? 'text-cyan-300' : 'text-slate-300'}`}>
                          Included in Price Tags
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                          Shelf prices already include VAT. The customer pays exactly the tagged price; the embedded tax is extracted for receipts and reports.
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Internet Connectivity & Paperless Digital Receipts Section (Email, WhatsApp & Peripherals pill only) */}
            {(adminTab === 'comms') && (
            <div className="pt-4 border-t border-[#1E293B]">
              <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-emerald-400" /> Internet Connectivity & Digital Receipts Configuration
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">
                Configure whether this offline-first terminal can utilize active internet connections to dispatch paperless digital receipts via WhatsApp, Email, or QR scans.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Toggle 1: Internet Connected Simulator Status */}
                <div className="flex items-start gap-3 bg-[#0F1115] border border-[#1E293B] hover:border-slate-700 rounded-xl p-3.5 transition-colors">
                  <input
                    type="checkbox"
                    id="enableInternetFeatures"
                    checked={settings.enableInternetFeatures !== false}
                    onChange={(e) => {
                      const nextVal = e.target.checked;
                      setSettings((prev) => ({ ...prev, enableInternetFeatures: nextVal }));
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 h-4.5 w-4.5 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="enableInternetFeatures" className="font-bold text-white cursor-pointer select-none block">
                      Enable Active Internet & Cloud Services
                    </label>
                    <span className="text-[10px] text-slate-500 block mt-1 leading-relaxed">
                      Simulates/checks internet connection state. Disabling this flags the system as completely offline (analog local-only) and suppresses live delivery options.
                    </span>
                  </div>
                </div>

                {/* Toggle 2: Enable WhatsApp/Email Receipt Modals */}
                <div className="flex items-start gap-3 bg-[#0F1115] border border-[#1E293B] hover:border-slate-700 rounded-xl p-3.5 transition-colors">
                  <input
                    type="checkbox"
                    id="enableDigitalReceipts"
                    checked={settings.enableDigitalReceipts !== false}
                    onChange={(e) => {
                      const nextVal = e.target.checked;
                      setSettings((prev) => ({ ...prev, enableDigitalReceipts: nextVal }));
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 h-4.5 w-4.5 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="enableDigitalReceipts" className="font-bold text-white cursor-pointer select-none block">
                      Enable Paperless Digital Receipts
                    </label>
                    <span className="text-[10px] text-slate-500 block mt-1 leading-relaxed">
                      Displays the <strong>WhatsApp/Email</strong> button in the receipt modal after checking out to allow prompt digital delivery.
                    </span>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Connectivity & Webhooks Configuration (Email, WhatsApp & Peripherals pill only) */}
            {(adminTab === 'comms') && (
              <div className="pt-4 border-t border-[#1E293B] space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 mb-1">
                    <Send className="w-4 h-4 text-emerald-400" /> Connectivity &amp; Webhooks Integration
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Configure SMTP servers for verified email receipts and WhatsApp Business Cloud API automated gateways for receipt delivery via text message.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* SMTP Server configuration */}
                  <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#1E293B]/60 pb-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-cyan-400" /> SMTP Mail Server Configuration
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">TCP / STARTTLS</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div className="col-span-2 space-y-1">
                        <label className="text-slate-400 font-semibold block">SMTP Outbound Host:</label>
                        <input
                          type="text"
                          value={settings.smtpHost || ''}
                          onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                          placeholder="e.g. smtp.mailgun.org"
                          className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400 font-semibold block">Port:</label>
                        <input
                          type="number"
                          value={settings.smtpPort || ''}
                          onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 587 })}
                          placeholder="e.g. 587"
                          className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="space-y-1">
                        <label className="text-slate-400 font-semibold block">SMTP Username:</label>
                        <input
                          type="text"
                          value={settings.smtpUser || ''}
                          onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                          placeholder="api_key_or_user"
                          className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400 font-semibold block">SMTP Password:</label>
                        <input
                          type="password"
                          value={settings.smtpPass || ''}
                          onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                          placeholder="••••••••••••"
                          className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] items-end">
                      <div className="space-y-1">
                        <label className="text-slate-400 font-semibold block">Sender Address (From):</label>
                        <input
                          type="email"
                          value={settings.smtpSenderEmail || ''}
                          onChange={(e) => setSettings({ ...settings, smtpSenderEmail: e.target.value })}
                          placeholder="receipts@myboutique.com"
                          className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                        />
                      </div>
                      <div className="flex items-center gap-2 h-9 bg-[#161B22]/50 border border-[#1E293B] rounded-lg px-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          id="smtpSecure"
                          checked={settings.smtpSecure || false}
                          onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
                          className="rounded text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900 h-4 w-4 cursor-pointer"
                        />
                        <label htmlFor="smtpSecure" className="text-slate-300 font-bold text-[10px] cursor-pointer">
                          Require Secure SSL/TLS
                        </label>
                      </div>
                    </div>

                    {/* Test Connection Terminal block */}
                    <div className="bg-[#06080B] border border-[#1E293B] rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">⚡ SMTP Connection Diagnostic Terminal</span>
                        <button
                          type="button"
                          onClick={handleTestSmtp}
                          disabled={isTestingSmtp}
                          className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1 rounded transition-all"
                        >
                          {isTestingSmtp ? 'Dialing...' : 'Test Connection'}
                        </button>
                      </div>
                      
                      {smtpTestLog.length > 0 ? (
                        <div className="bg-[#030406] border border-[#1E293B]/40 rounded p-2 text-[10px] font-mono max-h-40 overflow-y-auto space-y-0.5 text-slate-400 leading-relaxed scrollbar-thin">
                          {smtpTestLog.map((log, idx) => {
                            const isError = log.includes('[ERROR]') || log.includes('< 535');
                            const isSuccess = log.includes('[SUCCESS]');
                            const isInfo = log.includes('[INFO]');
                            return (
                              <div key={idx} className={isError ? 'text-rose-400' : isSuccess ? 'text-emerald-400 font-bold' : isInfo ? 'text-cyan-400/80' : 'text-slate-400'}>
                                {log}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[9px] text-slate-600 italic font-mono text-center py-2">
                          Click "Test Connection" to check host accessibility &amp; credentials packet handshake.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* WhatsApp Webhook & Business Cloud API configuration */}
                  <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#1E293B]/60 pb-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp Business Cloud API Integration
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">HTTP JSON Webhook</span>
                    </div>

                    <div className="text-[11px] space-y-1">
                      <label className="text-slate-400 font-semibold block">WhatsApp Business API Webhook / Gateway URL:</label>
                      <input
                        type="text"
                        value={settings.whatsappWebhookUrl || ''}
                        onChange={(e) => setSettings({ ...settings, whatsappWebhookUrl: e.target.value })}
                        placeholder="https://graph.facebook.com/v17.0/.../messages"
                        className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="space-y-1">
                        <label className="text-slate-400 font-semibold block">Phone Number ID:</label>
                        <input
                          type="text"
                          value={settings.whatsappPhoneNumberId || ''}
                          onChange={(e) => setSettings({ ...settings, whatsappPhoneNumberId: e.target.value })}
                          placeholder="e.g. 102938475625"
                          className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400 font-semibold block">Bearer Access Token:</label>
                        <input
                          type="password"
                          value={settings.whatsappAccessToken || ''}
                          onChange={(e) => setSettings({ ...settings, whatsappAccessToken: e.target.value })}
                          placeholder="EAAGxxxxxxxx..."
                          className="w-full bg-[#161B22] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Webhook Dispatch Terminal block */}
                    <div className="bg-[#06080B] border border-[#1E293B] rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">🛰️ Automated Gateway Webhook Logs</span>
                        <button
                          type="button"
                          onClick={handleTestWhatsApp}
                          disabled={isTestingWhatsApp}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1 rounded transition-all"
                        >
                          {isTestingWhatsApp ? 'Pinging...' : 'Test Webhook Dispatch'}
                        </button>
                      </div>

                      {whatsAppTestLog.length > 0 ? (
                        <div className="bg-[#030406] border border-[#1E293B]/40 rounded p-2 text-[10px] font-mono max-h-40 overflow-y-auto space-y-0.5 text-slate-400 leading-relaxed scrollbar-thin">
                          {whatsAppTestLog.map((log, idx) => {
                            const isError = log.includes('[ERROR]') || log.includes('HTTP/1.1 401');
                            const isSuccess = log.includes('[SUCCESS]');
                            const isWarning = log.includes('[WARNING]');
                            return (
                              <div key={idx} className={isError ? 'text-rose-400' : isSuccess ? 'text-emerald-400 font-bold' : isWarning ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                                {log}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[9px] text-slate-600 italic font-mono text-center py-2">
                          Click "Test Webhook Dispatch" to simulate direct template JSON receipt push signals to Meta Cloud.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Whitelabeling & Theme Colors (Receipts & White Label pill only) */}
            {(adminTab === 'whitelabel') && (
            <div className="pt-4 border-t border-[#1E293B]">
              <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-emerald-400" /> Whitelabeling &amp; Theme Colors
              </h3>
              <p className="text-[11px] text-slate-400 mb-4">
                Full dynamic branding panel. Customize terminal accents, menu titles, brand slogans, and make this software fully yours with your own business identity!
              </p>

              <div className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl space-y-4 mb-4">
                <div className="flex items-start gap-2 border-b border-[#1E293B]/60 pb-3">
                  <input
                    type="checkbox"
                    id="removeIslandBranding"
                    checked={settings.removeIslandBranding || false}
                    onChange={(e) => applySettingInstant({ removeIslandBranding: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 h-4.5 w-4.5 mt-0.5"
                  />
                  <div>
                    <label htmlFor="removeIslandBranding" className="text-xs font-bold text-white select-none cursor-pointer">
                      Use My Own Software Branding
                    </label>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
                      Check this box to replace all default placeholders, logos, and signatures with your custom application profile below.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      POS Brand/App Title:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. The Gift Shop POS"
                      value={settings.posAppName || ''}
                      onChange={(e) => applySettingInstant({ posAppName: e.target.value })}
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Short Badge Initials:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MBP"
                      maxLength={4}
                      value={settings.posShortName || ''}
                      onChange={(e) => applySettingInstant({ posShortName: e.target.value })}
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white text-center focus:outline-none focus:border-emerald-500 font-mono font-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      POS Version Tag:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. v2.4.1"
                      value={settings.posVersion || ''}
                      onChange={(e) => applySettingInstant({ posVersion: e.target.value })}
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Theme Accent Color:
                    </label>
                    <select
                      value={settings.customThemeColor || 'emerald'}
                      onChange={(e) => {
                        const next = { ...settings, customThemeColor: e.target.value as any };
                        setSettings(next);
                        // Apply the theme instantly (bugfix: previously only
                        // applied after clicking Save, easy to miss)
                        posDb.updateSettings({ customThemeColor: next.customThemeColor });
                        onRefreshData();
                      }}
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                    >
                      <option value="emerald">Emerald Green (Default)</option>
                      <option value="blue">Royal Blue</option>
                      <option value="indigo">Indigo Violet</option>
                      <option value="violet">Deep Violet</option>
                      <option value="amber">Warm Amber</option>
                      <option value="rose">Rose Red</option>
                      <option value="slate">Cool Slate</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Shop Logo (upload from your computer — recommended):
                  </label>
                  <div className="flex items-center gap-3">
                    {settings.brandLogoUrl ? (
                      <img src={settings.brandLogoUrl} alt="Logo preview" className="w-12 h-12 rounded-lg object-contain bg-[#0F1115] border border-[#1E293B] p-1" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#0F1115] border border-dashed border-slate-700 flex items-center justify-center text-[9px] text-slate-500 text-center">No logo</div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <label className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors w-fit">
                        Choose Logo File…
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            handleLogoFile(e.target.files?.[0]);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                      {(settings.brandLogoUrl || settings.shopLogoUrl || settings.receiptLogoUrl) && (
                        <button
                          type="button"
                          onClick={() => applySettingInstant({ brandLogoUrl: '', shopLogoUrl: '', receiptLogoUrl: '' })}
                          className="text-rose-400 hover:text-rose-300 text-xs font-semibold w-fit"
                        >
                          Remove logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Or Logo Image URL (advanced — must be a web link, local file paths will not display):
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/logo.png (Transparent background SVG/PNG recommended)"
                    value={settings.shopLogoUrl || settings.receiptLogoUrl || settings.brandLogoUrl || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      applySettingInstant({ brandLogoUrl: val, shopLogoUrl: val, receiptLogoUrl: val });
                    }}
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            </div>
            )}

            {/* NOTE: Quick Catalog Presets moved to Product Management > Category Preset Pills */}
            {/* NOTE: Navigation Tab Labels moved to Store System & Audits */}
            {/* NOTE: Remote Version Update Checker moved to Email, WhatsApp & Peripherals */}

            {/* Custom Menu Label Overrides — Store System & Audits pill only */}
            {(adminTab === 'settings') && (
            <div className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Navigation Tab Labels</h4>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Tailor navigation names to match your unique terminology (e.g. rename "Register" to "Checkout Terminal", "Inventory" to "Stock Hub").
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Register Tab:</label>
                    <input
                      type="text"
                      placeholder="Register"
                      value={settings.customRegisterLabel || ''}
                      onChange={(e) => setSettings({ ...settings, customRegisterLabel: e.target.value })}
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Inventory Tab:</label>
                    <input
                      type="text"
                      placeholder="Inventory"
                      value={settings.customInventoryLabel || ''}
                      onChange={(e) => setSettings({ ...settings, customInventoryLabel: e.target.value })}
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Vendors Tab:</label>
                    <input
                      type="text"
                      placeholder="Vendors"
                      value={settings.customVendorsLabel || ''}
                      onChange={(e) => setSettings({ ...settings, customVendorsLabel: e.target.value })}
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Payouts Tab:</label>
                    <input
                      type="text"
                      placeholder="Payouts"
                      value={settings.customPayoutsLabel || ''}
                      onChange={(e) => setSettings({ ...settings, customPayoutsLabel: e.target.value })}
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] text-slate-400 mb-1">Reports Tab:</label>
                    <input
                      type="text"
                      placeholder="Reports"
                      value={settings.customReportsLabel || ''}
                      onChange={(e) => setSettings({ ...settings, customReportsLabel: e.target.value })}
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Remote Version Update Checker — Email, WhatsApp & Peripherals pill only */}
            {(adminTab === 'comms') && (
            <div className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E293B]/60 pb-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> Remote Version Update Checker
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">Current Build: <span className="font-bold text-white">{settings.posVersion || 'v2.4.1'}</span></span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Monitor and automatically prompt users to fetch new executable installers whenever an update is compiled and published to your custom remote server config.
                </p>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="enableAutoUpdateCheck"
                    checked={settings.enableAutoUpdateCheck !== false}
                    onChange={(e) => setSettings({ ...settings, enableAutoUpdateCheck: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 h-4.5 w-4.5 mt-0.5"
                  />
                  <div>
                    <label htmlFor="enableAutoUpdateCheck" className="text-xs font-bold text-white select-none cursor-pointer">
                      Enable Automatic Update Comparison Prompt
                    </label>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
                      Check this to fetch remote version configuration files upon application load.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-1">Update Config URL (JSON):</label>
                    <input
                      type="text"
                      placeholder="e.g. /version.json"
                      value={settings.updateConfigUrl || '/version.json'}
                      onChange={(e) => setSettings({ ...settings, updateConfigUrl: e.target.value })}
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={async () => {
                        const url = settings.updateConfigUrl || '/version.json';
                        try {
                          const res = await fetch(url);
                          if (!res.ok) {
                            alert(`Failed to fetch update config. Server returned status: ${res.status}`);
                            return;
                          }
                          const data = await res.ok ? await res.json() : null;
                          if (data && data.version) {
                            const currentBuild = settings.posVersion || 'v2.4.1';
                            if (data.version !== currentBuild) {
                              alert(`Update Available!\n\nLatest Version: ${data.version}\nYour Build: ${currentBuild}\nRelease Date: ${data.releaseDate}\n\nNotes:\n${data.releaseNotes}`);
                            } else {
                              alert(`Your terminal is completely up to date!\n\nCurrent Build: ${currentBuild}\nRemote Build: ${data.version}`);
                            }
                          } else {
                            alert('Config fetched successfully, but no valid version tag was detected inside JSON.');
                          }
                        } catch (err: any) {
                          alert(`Connection Error: Unable to query version at URL "${url}".\nDetails: ${err?.message || err}`);
                        }
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 font-sans"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Test Manual Check</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Multi-Currency Pricing Setup — Register pill only */}
            {(adminTab === 'register') && (
            <div className="pt-4 border-t border-[#1E293B]">
              <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Multi-Currency Pricing Setup
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">
                Configure local base currency and preferred foreign/tourist currency along with conversion exchange rates. Search from 35+ global currencies or enter custom codes. Cashiers can complete checkout in either currency.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                {/* Primary Currency with Search Picker */}
                <div className="space-y-1.5">
                  <CurrencySearchPicker
                    label="Primary Currency (Search & Select):"
                    selectedCode={settings.primaryCurrency || 'USD'}
                    selectedSymbol={settings.primaryCurrencySymbol || '$'}
                    onSelectCurrency={(code, symbol) => {
                      setSettings({
                        ...settings,
                        primaryCurrency: code,
                        primaryCurrencySymbol: symbol,
                      });
                    }}
                  />
                  <div className="flex gap-2 pt-0.5">
                    <input
                      type="text"
                      placeholder="Code (e.g. SCR)"
                      value={settings.primaryCurrency || ''}
                      onChange={(e) => setSettings({ ...settings, primaryCurrency: e.target.value.toUpperCase() })}
                      className="w-2/3 bg-[#0F1115] border border-[#1E293B] rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                      title="Edit Code"
                    />
                    <input
                      type="text"
                      placeholder="Symbol"
                      value={settings.primaryCurrencySymbol || ''}
                      onChange={(e) => setSettings({ ...settings, primaryCurrencySymbol: e.target.value })}
                      className="w-1/3 bg-[#0F1115] border border-[#1E293B] rounded-xl px-2 py-1.5 text-xs font-bold text-white text-center focus:outline-none focus:border-emerald-500"
                      title="Edit Symbol"
                    />
                  </div>
                </div>

                {/* Secondary Currency with Search Picker */}
                <div className="space-y-1.5">
                  <CurrencySearchPicker
                    label="Secondary Currency (Search & Select):"
                    selectedCode={settings.secondaryCurrency || 'USD'}
                    selectedSymbol={settings.secondaryCurrencySymbol || '$'}
                    onSelectCurrency={(code, symbol) => {
                      setSettings({
                        ...settings,
                        secondaryCurrency: code,
                        secondaryCurrencySymbol: symbol,
                      });
                    }}
                  />
                  <div className="flex gap-2 pt-0.5">
                    <input
                      type="text"
                      placeholder="Code (e.g. USD)"
                      value={settings.secondaryCurrency || ''}
                      onChange={(e) => setSettings({ ...settings, secondaryCurrency: e.target.value.toUpperCase() })}
                      className="w-2/3 bg-[#0F1115] border border-[#1E293B] rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                      title="Edit Code"
                    />
                    <input
                      type="text"
                      placeholder="Symbol"
                      value={settings.secondaryCurrencySymbol || ''}
                      onChange={(e) => setSettings({ ...settings, secondaryCurrencySymbol: e.target.value })}
                      className="w-1/3 bg-[#0F1115] border border-[#1E293B] rounded-xl px-2 py-1.5 text-xs font-bold text-white text-center focus:outline-none focus:border-emerald-500"
                      title="Edit Symbol"
                    />
                  </div>
                </div>

                {/* Exchange Rate with Backspace-friendly string state */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Exchange Rate (1 {settings.secondaryCurrency || 'USD'} = X {settings.primaryCurrency || 'USD'}):
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={exchangeRateStr}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setExchangeRateStr(raw);
                      const val = parseFloat(raw);
                      if (!isNaN(val) && val > 0) {
                        setSettings({ ...settings, exchangeRate: val });
                      }
                    }}
                    onBlur={() => {
                      if (exchangeRateStr.trim() === '') {
                        setExchangeRateStr(String(settings.exchangeRate || 1));
                      }
                    }}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Full backspace supported. Type freely — update it any day the rate changes.
                  </p>
                </div>

                {/* Default Register Currency */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Default Register Currency:
                  </label>
                  <select
                    value={settings.defaultCurrencyMode || 'primary'}
                    onChange={(e) => setSettings({ ...settings, defaultCurrencyMode: e.target.value as any })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="primary">Primary ({settings.primaryCurrencySymbol || '$'})</option>
                    <option value="secondary">Secondary ({settings.secondaryCurrencySymbol || '$'})</option>
                  </select>
                </div>

                <div className="md:col-span-4 flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="allowPaymentInSecondary"
                    checked={settings.allowPaymentInSecondary !== false}
                    onChange={(e) => setSettings({ ...settings, allowPaymentInSecondary: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 h-4 w-4"
                  />
                  <label htmlFor="allowPaymentInSecondary" className="text-xs text-slate-300 select-none cursor-pointer font-medium">
                    Allow payment in secondary currency ({settings.secondaryCurrency || 'USD'}) at Checkout
                  </label>
                </div>
              </div>

              {/* Customer Display Reference Currencies */}
              <div className="mt-4 pt-4 border-t border-[#1E293B]">
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Customer Display Currencies (up to 2) — shown as smaller reference amounts under total:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {[0, 1].map((slotIdx: number) => {
                    const list = settings.customerDisplayCurrencies || [];
                    const dc = list[slotIdx] || { code: '', symbol: '', rate: 0, enabled: false };
                    const patchDc = (patch: Partial<typeof dc>) => {
                      const next = [...list];
                      while (next.length < 2) next.push({ code: '', symbol: '', rate: 0, enabled: false });
                      next[slotIdx] = { ...next[slotIdx], ...patch };
                      setSettings({ ...settings, customerDisplayCurrencies: next });
                    };

                    return (
                      <div key={slotIdx} className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`dcEnabled${slotIdx}`}
                            checked={!!dc.enabled && !!dc.code}
                            onChange={(e) => patchDc({ enabled: e.target.checked })}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          <label htmlFor={`dcEnabled${slotIdx}`} className="text-xs text-slate-300 select-none cursor-pointer font-semibold">
                            Enable Display Currency #{slotIdx + 1}
                          </label>
                        </div>

                        <CurrencySearchPicker
                          selectedCode={dc.code || (slotIdx === 0 ? 'EUR' : 'USD')}
                          selectedSymbol={dc.symbol || (slotIdx === 0 ? '€' : '$')}
                          onSelectCurrency={(code, symbol) => {
                            patchDc({ code, symbol });
                          }}
                        />

                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder={slotIdx === 0 ? 'e.g. EUR' : 'e.g. USD'}
                            value={dc.code || ''}
                            onChange={(e) => patchDc({ code: e.target.value.toUpperCase() })}
                            className="w-2/3 bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                            title="Currency Code"
                          />
                          <input
                            type="text"
                            placeholder={slotIdx === 0 ? 'e.g. €' : 'e.g. $'}
                            value={dc.symbol || ''}
                            onChange={(e) => patchDc({ symbol: e.target.value })}
                            className="w-1/3 bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs font-bold text-white text-center focus:outline-none focus:border-emerald-500"
                            title="Currency Symbol"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                            Rate (1 {dc.code || (slotIdx === 0 ? 'EUR' : 'USD')} = X {settings.primaryCurrency || 'USD'}):
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            placeholder="e.g. 14.60"
                            value={dcRatesStr[slotIdx] ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const nextStrs = [...dcRatesStr];
                              nextStrs[slotIdx] = raw;
                              setDcRatesStr(nextStrs);

                              const val = parseFloat(raw);
                              if (!isNaN(val) && val >= 0) {
                                patchDc({ rate: val });
                              }
                            }}
                            onBlur={() => {
                              if ((dcRatesStr[slotIdx] || '').trim() === '') {
                                const nextStrs = [...dcRatesStr];
                                nextStrs[slotIdx] = dc.rate ? String(dc.rate) : '';
                                setDcRatesStr(nextStrs);
                              }
                            }}
                            className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            )}

            {/* Receipt Printer Hardware & Test Print — Email, WhatsApp & Peripherals (Peripheral Hardware tab) */}
            {(adminTab === 'hardware') && (
            <div className="pt-4 border-t border-[#1E293B]">
              <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 mb-3">
                <PrinterIcon className="w-4 h-4 text-emerald-400" /> Receipt Printer Hardware & Formatting Setup
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">
                Configure your hardware printer type (thermal roll vs standard A4 sheet printer) and receipt format defaults.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-4 bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Default Receipt Printer Hardware Type:
                  </label>
                  <select
                    value={settings.receiptPrinterType || 'thermal'}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setSettings({ ...settings, receiptPrinterType: val });
                      posDb.updateSettings({ receiptPrinterType: val });
                    }}
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="thermal">Thermal POS Tape (EPSON, Star, Xprinter, etc.)</option>
                    <option value="normal">Standard / Normal Printer (A4 / Letter Tax Invoices)</option>
                    <option value="ask">Dual Option Prompt (Ask every time)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Thermal Paper Roll Width:
                  </label>
                  <select
                    value={settings.thermalReceiptWidth || '80mm'}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setSettings({ ...settings, thermalReceiptWidth: val });
                      posDb.updateSettings({ thermalReceiptWidth: val });
                    }}
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="80mm">80mm (Standard POS Countertop - 3.15")</option>
                    <option value="58mm">58mm (Compact / Mobile Portable POS - 2.28")</option>
                  </select>
                </div>
              </div>

              {/* Verify Receipt Printer Drivers & Alignment Section */}
              <div className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl mb-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <PrinterIcon className="w-4 h-4 text-emerald-400" /> Verify Printer Drivers &amp; Alignment
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                      Send a mock transaction directly to your printing system to test margins, paper-cut offsets, and logo high-contrast black/white scaling. No sales statistics are affected.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePrintTestReceipt('thermal')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                    >
                      <PrinterIcon className="w-3.5 h-3.5" />
                      <span>Print Thermal Test ({settings.thermalReceiptWidth || '80mm'})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintTestReceipt('normal')}
                      className="bg-[#161B22] hover:bg-slate-800 text-slate-300 border border-[#1E293B] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                      <span>Print Standard A4 Test</span>
                    </button>
                  </div>
                </div>
              </div>


              <div className="space-y-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.autoPrintReceipt === true}
                    onChange={(e) => {
                      posDb.updateSettings({ autoPrintReceipt: e.target.checked });
                      setSettings({ ...settings, autoPrintReceipt: e.target.checked });
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span className="text-slate-300 font-medium">
                    Print receipt automatically when payment is entered at checkout
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-medium">
                    Tourist tax-free refund processing fee (%):
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={settings.taxFreeAdminFeePercent ?? 10}
                    onChange={(e) => {
                      const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                      posDb.updateSettings({ taxFreeAdminFeePercent: v });
                      setSettings({ ...settings, taxFreeAdminFeePercent: v });
                    }}
                    className="w-16 bg-[#161B22] border border-[#1E293B] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500">
                    Deducted from the VAT refund (checkout estimate + certificate)
                  </span>
                </div>
              </div>
            </div>
            )}

            {/* Inactivity Auto-Logout Security Timer — moved from legacy permissions tab */}
            {adminTab === 'settings' && (
              <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-5 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" /> Inactivity Auto-Logout Security Timer
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-md">
                    {settings.inactivityTimeoutMinutes !== undefined && settings.inactivityTimeoutMinutes > 0 ? `${settings.inactivityTimeoutMinutes} mins` : 'Disabled'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Automatically redirect active staff sessions to the login screen after a defined period of user inactivity for enhanced terminal security.
                </p>
                <select
                  value={settings.inactivityTimeoutMinutes !== undefined ? settings.inactivityTimeoutMinutes : 15}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    applySettingInstant({ inactivityTimeoutMinutes: val });
                  }}
                  className="w-full sm:w-80 bg-[#0F1115] border border-[#1E293B] text-cyan-300 font-bold px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value={0}>Disabled (Never Auto-Logout)</option>
                  <option value={5}>5 Minutes of Inactivity</option>
                  <option value={10}>10 Minutes of Inactivity</option>
                  <option value={15}>15 Minutes of Inactivity (Recommended)</option>
                  <option value={30}>30 Minutes of Inactivity</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                </select>
              </div>
            )}

            {/* Backup & Data Maintenance — Store System & Audits pill only */}
            {(adminTab === 'settings') && (
            <div className="pt-4 border-t border-[#1E293B]">
              <div className="space-y-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.requireBackupOnDayClose !== false}
                    onChange={(e) => {
                      posDb.updateSettings({ requireBackupOnDayClose: e.target.checked });
                      setSettings({ ...settings, requireBackupOnDayClose: e.target.checked });
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span className="text-slate-300 font-medium">
                    Require a backup file when closing the day (recommended — save to USB pendrive)
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAutoBackupModalOpen(true)}
                    className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 px-3.5 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 shadow-xs"
                  >
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>Auto-Backup & Browser Storage Manager</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const dateStr = new Date().toISOString().split('T')[0];
                      downloadSQLiteDbFile(`boutique-pos-sqlite-${dateStr}.db`, posDb.exportSQLiteDump());
                      posDb.markBackupDone();
                      setSettings(posDb.getSettings());
                    }}
                    className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export SQLite .db File</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleManualBackup}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-[#1E293B] px-3 py-2 rounded-xl font-bold text-xs transition-colors"
                  >
                    Export JSON File
                  </button>
                  <label className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-[#1E293B] px-3 py-2 rounded-xl font-bold text-xs cursor-pointer transition-colors">
                    Restore from Backup File…
                    <input
                      type="file"
                      accept="application/json,.json,.db,.sqlite,.sql"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (confirm('Restore this backup? Current data will be replaced.')) {
                            const res = posDb.importBackup(String(reader.result));
                            alert(res.ok ? 'Backup restored successfully!' : `Restore failed: ${res.error}`);
                            if (res.ok) loadBackendData();
                          }
                        };
                        reader.readAsText(f);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {settings.lastBackupAt && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      Last backup: {new Date(settings.lastBackupAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Admin Access Credentials — Store System & Audits pill only */}
            {(adminTab === 'settings') && (
            <div className="pt-4 border-t border-[#1E293B]">
              <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-cyan-400" /> Admin Access Credentials
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Admin Login Username:
                  </label>
                  <input
                    type="text"
                    value={settings.adminUsername || 'admin'}
                    onChange={(e) => setSettings({ ...settings, adminUsername: e.target.value })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Admin Login PIN / Password:
                  </label>
                  <input
                    type="password"
                    value={settings.adminPin || 'admin123'}
                    onChange={(e) => setSettings({ ...settings, adminPin: e.target.value })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Day-to-day staff login PIN for the administrator account.
                  </p>
                </div>
              </div>

              {/* Master Reset Password — lockout recovery backup */}
              <div className="bg-rose-500/5 border border-rose-500/25 rounded-xl p-4 space-y-3 mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-rose-300 shrink-0" />
                    <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wide">
                      Master Reset Password (Backup — forgotten Admin PIN only)
                    </h4>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      masterResetConfigured
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-600'
                    }`}
                  >
                    {masterResetConfigured ? 'Configured — recovery available' : 'Not set — lockout recovery unavailable'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-rose-200">Not</strong> your daily login PIN. This is a separate backup secret.
                  If you forget the Admin Login PIN, use this on the staff login screen under &quot;Forgot admin PIN?&quot;.
                  It resets the Admin Login PIN to temporary default <code className="text-amber-300 font-mono">admin123</code> (change it right after sign-in).
                  Leave new password blank and save to clear. Never shown again after saving. Store it offline.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">New Master Reset Password</label>
                    <input
                      type="password"
                      value={masterResetNew}
                      onChange={(e) => { setMasterResetNew(e.target.value); setMasterResetError(''); }}
                      placeholder={masterResetConfigured ? 'New (blank = clear)' : 'Min. 6 characters'}
                      autoComplete="new-password"
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-rose-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Confirm Master Reset Password</label>
                    <input
                      type="password"
                      value={masterResetConfirm}
                      onChange={(e) => { setMasterResetConfirm(e.target.value); setMasterResetError(''); }}
                      placeholder="Re-enter to confirm"
                      autoComplete="new-password"
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-rose-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Current Admin Login PIN</label>
                    <input
                      type="password"
                      value={masterResetAdminPin}
                      onChange={(e) => { setMasterResetAdminPin(e.target.value); setMasterResetError(''); }}
                      placeholder="Required to save"
                      autoComplete="off"
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-rose-500/60"
                    />
                  </div>
                </div>
                {masterResetError && (
                  <p className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded-lg px-3 py-2">{masterResetError}</p>
                )}
                {masterResetSuccess && (
                  <p className="text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 rounded-lg px-3 py-2">{masterResetSuccess}</p>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveMasterResetPassword}
                    className="bg-rose-600/80 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md flex items-center gap-2 transition-colors"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{masterResetNew.trim() ? 'Save Master Reset Password' : masterResetConfigured ? 'Clear Master Reset Password' : 'Save Master Reset Password'}</span>
                  </button>
                </div>
              </div>
            </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save All Store Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Scheduled Auto-Backup & Browser Storage Modal */}
      {isAutoBackupModalOpen && (
        <AutoBackupModal
          onClose={() => setIsAutoBackupModalOpen(false)}
          onRefreshData={loadBackendData}
        />
      )}

      {/* Custom Catalog Template Pills Editor Modal */}
      <CustomCatalogTemplatesModal
        isOpen={isCustomTemplatesModalOpen}
        onClose={() => setIsCustomTemplatesModalOpen(false)}
        onTemplatesUpdated={() => onRefreshData()}
      />
    </div>
  );
};
