import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  UserPlus,
  Users,
  Edit3,
  DollarSign,
  Tag,
  Settings,
  LogOut,
  Save,
  Trash2,
  Key,
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
  FileText,
  Sparkles,
  MessageSquare,
  Star,
} from 'lucide-react';
import { posDb } from '../../services/db';
import { InventoryItem, StaffUser, StaffRole, CategoryTab, StoreSettings } from '../../types/pos';

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
  const [adminTab, setAdminTab] = useState<'pricing' | 'tabs' | 'cashiers' | 'receipts' | 'feedback' | 'settings'>('cashiers');

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
    setHeaderLinesText((currSettings.receiptHeaderLines || []).join('\n'));
    setFooterLinesText((currSettings.receiptFooterLines || []).join('\n'));
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
    });

    setNewStaffName('');
    setNewStaffUsername('');
    setNewStaffPin('');
    setNewStaffRole('cashier');
    setStaffError('');
    setIsAddStaffModalOpen(false);
    loadBackendData();
  };

  const handleToggleStaffStatus = (id: string, currentStatus: 'active' | 'suspended') => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    posDb.updateStaffUser(id, { status: nextStatus });
    loadBackendData();
  };

  const handleDeleteStaff = (id: string) => {
    if (confirm('Are you sure you want to remove this staff user account?')) {
      posDb.deleteStaffUser(id);
      loadBackendData();
    }
  };

  const handleResetPin = (id: string) => {
    if (!resetPinValue.trim()) return;
    posDb.updateStaffUser(id, { pin: resetPinValue.trim() });
    setEditingStaffId(null);
    setResetPinValue('');
    loadBackendData();
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
    const affected = posDb.bulkAdjustPrices(bulkCategory, bulkAmount, bulkMode);
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

  // Store Settings Handler
  const handleSaveStoreSettings = (e: React.FormEvent) => {
    e.preventDefault();
    posDb.updateSettings(settings);
    onRefreshData(); // Instantly update currency & branding settings across application
    setSettingsSuccessMsg('Store Settings & Admin Passwords saved successfully!');
    setTimeout(() => setSettingsSuccessMsg(''), 3000);
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

      {/* Main Admin Sub-Tab Navigation */}
      <div className="flex bg-[#161B22] p-1.5 rounded-2xl border border-[#1E293B] text-xs gap-1">
        <button
          onClick={() => setAdminTab('cashiers')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            adminTab === 'cashiers'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Cashiers & Staff Accounts ({staffList.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('pricing')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            adminTab === 'pricing'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Product Titles & Prices ({inventory.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('tabs')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            adminTab === 'tabs'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <FolderEdit className="w-4 h-4" />
          <span>Product Tabs ({categoryTabs.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('receipts')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            adminTab === 'receipts'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Receipt Design</span>
        </button>

        <button
          onClick={() => setAdminTab('feedback')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            adminTab === 'feedback'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Feedback Logs ({posDb.getFeedbackList().length})</span>
        </button>

        <button
          onClick={() => setAdminTab('settings')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            adminTab === 'settings'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Store Settings & Security</span>
        </button>
      </div>

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
                          onClick={() => handleDeleteStaff(staff.id)}
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

          {/* Reset PIN Modal */}
          {editingStaffId && (
            <div className="fixed inset-0 z-50 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center p-4">
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

          {/* Modal: Create New Cashier Account */}
          {isAddStaffModalOpen && (
            <div className="fixed inset-0 z-50 bg-[#0F1115]/85 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 max-w-md w-full text-[#E2E8F0] shadow-2xl relative">
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
                      placeholder="e.g. Marie-Claire Seychelles"
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
                      System Role & Permissions:
                    </label>
                    <select
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value as StaffRole)}
                      className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#E2E8F0] focus:outline-none focus:border-emerald-500"
                    >
                      <option value="cashier">Cashier (POS Register Only)</option>
                      <option value="senior_cashier">Senior Cashier (POS Register + Refunds)</option>
                      <option value="shift_lead">Shift Lead (POS + EOD Closing)</option>
                      <option value="admin">Administrator (Full Access)</option>
                    </select>
                  </div>

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
      {adminTab === 'pricing' && (
        <div className="space-y-4">
          {/* Notification Toast */}
          {pricingSuccessMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-600 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{pricingSuccessMsg}</span>
            </div>
          )}

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
                    <th className="p-3 w-28 text-right">Retail ({settings.primaryCurrencySymbol || 'SR'})</th>
                    <th className="p-3 w-32 text-right">Retail ({settings.secondaryCurrencySymbol || '$'}) Override</th>
                    <th className="p-3 w-28 text-right">Cost ({settings.primaryCurrencySymbol || 'SR'})</th>
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
                            <span className="absolute left-1.5 top-1.5 text-emerald-500 font-bold text-[10px]">{settings.primaryCurrencySymbol || 'SR'}</span>
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
                              placeholder={(draft.retailPrice / (settings.exchangeRate || 13.50)).toFixed(2)}
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
                            <span className="absolute left-1.5 top-1.5 text-slate-500 text-[10px]">{settings.primaryCurrencySymbol || 'SR'}</span>
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

                  <div>
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
                      placeholder="e.g. Seychelles Island Boutique"
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
                      placeholder="e.g. Official Retailer • Ocean Seychelles"
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
                    placeholder="Victoria Promenade, Mahé, Seychelles&#10;Tel: +248 4 321 900 • Email: info@oceanseychelles.sc"
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
                    placeholder="e.g. Thank you for visiting Seychelles Island Boutique!"
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
                    placeholder="Follow us on Instagram @oceanseychelles&#10;www.oceanseychelles.sc"
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
                      {settings.storeName || 'Seychelles Island Boutique'}
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
                          <span>VAT 15%: $3.65</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between font-semibold">
                          <span>[Ocean] Ceramic Mug - Gold Rim Line</span>
                          <span>$16.00</span>
                        </div>
                        <div className="text-[9px] text-slate-500 flex justify-between">
                          <span>1 x $16.00</span>
                          <span>VAT 15%: $2.09</span>
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

                        <p className="text-xs text-slate-300 leading-relaxed italic font-sans pt-1">
                          "{fb.comments || 'No written comment left.'}"
                        </p>
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
      {/* TAB 5: STORE SETTINGS & SECURITY */}
      {/* ========================================================================= */}
      {adminTab === 'settings' && (
        <div className="space-y-4">
          {settingsSuccessMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-600 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{settingsSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveStoreSettings} className="bg-[#161B22] border border-[#1E293B] rounded-2xl p-6 space-y-6 shadow-lg">
            <div>
              <h2 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 border-b border-[#1E293B] pb-2">
                <Settings className="w-4 h-4 text-emerald-400" /> Store Profile & Tax Configuration
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
                  Default Seychelles VAT Tax Rate (%):
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={(settings.defaultVatRate * 100).toFixed(0)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultVatRate: (parseFloat(e.target.value) || 0) / 100,
                    })
                  }
                  className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Premium Branding Customization and Dynamic Label Overrides */}
            <div className="pt-4 border-t border-[#1E293B]">
                <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Cashier Access Restrictions
                </h3>
                <p className="text-[11px] text-slate-400 mb-3">
                  Choose which non-admin cashier sessions can open. POS remains required; Settings and Staff are always protected by administrator login.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {([
                    ['pos', 'POS register and checkout', true],
                    ['inventory', 'Inventory and stock', false],
                    ['reports', 'Sales and financial reports', false],
                    ['settings', 'Store settings and branding (Admin only)', true],
                    ['staff', 'Cashier/staff account management (Admin only)', true],
                  ] as const).map(([area, label, locked]) => (
                    <label key={area} className="flex items-center gap-2 bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={settings.cashierAccess?.[area] ?? (area === 'pos')}
                        disabled={locked}
                        onChange={(e) => setSettings({
                          ...settings,
                          cashierAccess: {
                            pos: settings.cashierAccess?.pos ?? true,
                            inventory: settings.cashierAccess?.inventory ?? true,
                            reports: settings.cashierAccess?.reports ?? true,
                            settings: settings.cashierAccess?.settings ?? false,
                            staff: settings.cashierAccess?.staff ?? false,
                            [area]: e.target.checked,
                          },
                        })}
                        className="rounded text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 h-4 w-4"
                      />
                      <span className={locked ? 'text-slate-500' : ''}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#1E293B]">
              <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-emerald-400" /> Whitelabeling, Theme Colors & Navigation Labels
              </h3>
              <p className="text-[11px] text-slate-400 mb-4">
                Full dynamic branding panel. Customize terminal accents, menu titles, brand slogans, and even remove or substitute "Island POS" with your own business identity!
              </p>

              <div className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl space-y-4 mb-4">
                <div className="flex items-start gap-2 border-b border-[#1E293B]/60 pb-3">
                  <input
                    type="checkbox"
                    id="removeIslandBranding"
                    checked={settings.removeIslandBranding || false}
                    onChange={(e) => setSettings({ ...settings, removeIslandBranding: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 h-4.5 w-4.5 mt-0.5"
                  />
                  <div>
                    <label htmlFor="removeIslandBranding" className="text-xs font-bold text-white select-none cursor-pointer">
                      Completely Remove "Island POS" branding
                    </label>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
                      Check this box to substitute "Island POS" default placeholders, logos, and signatures with your custom application profile below.
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
                      placeholder="e.g. My Boutique POS"
                      value={settings.posAppName || ''}
                      onChange={(e) => setSettings({ ...settings, posAppName: e.target.value })}
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
                      onChange={(e) => setSettings({ ...settings, posShortName: e.target.value })}
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
                      onChange={(e) => setSettings({ ...settings, posVersion: e.target.value })}
                      className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Theme Accent Color:
                    </label>
                    <select
                      value={settings.customThemeColor || 'emerald'}
                      onChange={(e) => setSettings({ ...settings, customThemeColor: e.target.value as any })}
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
                    Custom Logo URL (Replaces Badge if specified):
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/logo.png (Transparent background SVG/PNG recommended)"
                    value={settings.brandLogoUrl || ''}
                    onChange={(e) => setSettings({ ...settings, brandLogoUrl: e.target.value })}
                    className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Custom Menu Label Overrides */}
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

              {/* Dynamic Remote Version Update Checker Config */}
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
            </div>

            <div className="pt-4 border-t border-[#1E293B]">
              <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Multi-Currency Pricing Setup
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">
                Configure local base currency and preferred foreign/tourist currency along with the conversion exchange rate. Cashiers can complete checkout in either currency.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Primary Currency Code & Symbol:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. SCR"
                      value={settings.primaryCurrency || 'SCR'}
                      onChange={(e) => setSettings({ ...settings, primaryCurrency: e.target.value.toUpperCase() })}
                      className="w-2/3 bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="text"
                      placeholder="e.g. SR"
                      value={settings.primaryCurrencySymbol || 'SR'}
                      onChange={(e) => setSettings({ ...settings, primaryCurrencySymbol: e.target.value })}
                      className="w-1/3 bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-bold text-white text-center focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Secondary Currency Code & Symbol:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. USD"
                      value={settings.secondaryCurrency || 'USD'}
                      onChange={(e) => setSettings({ ...settings, secondaryCurrency: e.target.value.toUpperCase() })}
                      className="w-2/3 bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="text"
                      placeholder="e.g. $"
                      value={settings.secondaryCurrencySymbol || '$'}
                      onChange={(e) => setSettings({ ...settings, secondaryCurrencySymbol: e.target.value })}
                      className="w-1/3 bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-bold text-white text-center focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Exchange Rate (1 {settings.secondaryCurrency || 'USD'} = X {settings.primaryCurrency || 'SCR'}):
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={settings.exchangeRate || 13.50}
                    onChange={(e) => setSettings({ ...settings, exchangeRate: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Default Register Currency:
                  </label>
                  <select
                    value={settings.defaultCurrencyMode || 'primary'}
                    onChange={(e) => setSettings({ ...settings, defaultCurrencyMode: e.target.value as any })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="primary">Primary ({settings.primaryCurrencySymbol || 'SR'})</option>
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
                  Customer Display Currencies (up to 2) — shown as smaller reference amounts under the total on the customer screen:
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
                      <div key={slotIdx} className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`dcEnabled${slotIdx}`}
                            checked={!!dc.enabled && !!dc.code}
                            onChange={(e) => patchDc({ enabled: e.target.checked })}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          <label htmlFor={`dcEnabled${slotIdx}`} className="text-xs text-slate-300 select-none cursor-pointer font-semibold">
                            Display Currency #{slotIdx + 1}
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder={slotIdx === 0 ? 'e.g. EUR' : 'e.g. USD'}
                            value={dc.code || ''}
                            onChange={(e) => patchDc({ code: e.target.value.toUpperCase() })}
                            className="w-2/3 bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                          />
                          <input
                            type="text"
                            placeholder={slotIdx === 0 ? 'e.g. €' : 'e.g. $'}
                            value={dc.symbol || ''}
                            onChange={(e) => patchDc({ symbol: e.target.value })}
                            className="w-1/3 bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-bold text-white text-center focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                            Rate (1 {dc.code || (slotIdx === 0 ? 'EUR' : 'USD')} = X {settings.primaryCurrency || 'SCR'}):
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            placeholder="e.g. 14.60"
                            value={dc.rate || ''}
                            onChange={(e) => patchDc({ rate: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-[#161B22] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Tip: The main currency (above) always stays as the big TOTAL DUE. These currencies appear underneath it so customers can see the price in their own money.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1E293B]">
              <h3 className="text-sm font-bold text-[#E2E8F0] flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-cyan-400" /> Admin Access Credentials
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Admin Master Username:
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
                    Admin Master Security PIN / Password:
                  </label>
                  <input
                    type="password"
                    value={settings.adminPin || 'admin123'}
                    onChange={(e) => setSettings({ ...settings, adminPin: e.target.value })}
                    className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

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
    </div>
  );
};
