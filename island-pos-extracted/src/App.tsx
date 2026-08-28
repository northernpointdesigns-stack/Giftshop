import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Sparkles } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { CashierPOS } from './components/pos/CashierPOS';
import { InventoryAdmin } from './components/admin/InventoryAdmin';
import { VendorAdmin } from './components/admin/VendorAdmin';
import { AdminBackend } from './components/admin/AdminBackend';
import { ConsignmentPayoutReport } from './components/reports/ConsignmentPayoutReport';
import { EODBalancing } from './components/reports/EODBalancing';
import { FinancialReports } from './components/reports/FinancialReports';
import { ReportDownloads } from './components/reports/ReportDownloads';
import { VendorSettlementReport } from './components/reports/VendorSettlementReport';
import { TaxReturnAssistant } from './components/reports/TaxReturnAssistant';
import { LicenseGate, TrialBadge } from './components/license/LicenseGate';
import { resolveLicenseState, LicenseState } from './services/license';
import { resolveStoreName, resolveBrandName } from './services/brand';
import { SalesForecasting } from './components/reports/SalesForecasting';
import { CustomerDisplay } from './components/customer/CustomerDisplay';
import { LowStockAlertsModal } from './components/alerts/LowStockAlertsModal';
import { SqlInspectorModal } from './components/admin/SqlInspectorModal';
import { QuickRecoveryModal } from './components/admin/QuickRecoveryModal';
import { DigitalReceiptHub } from './components/customer/DigitalReceiptHub';
import { VersionUpdateModal } from './components/alerts/VersionUpdateModal';
import { posDb } from './services/db';
import { getEffectiveCashierAccess } from './utils/cashierAccess';
import { InventoryItem, Vendor, Transaction, StaffUser } from './types/pos';
import { StaffLoginScreen } from './components/auth/StaffLoginScreen';
import { OpeningFloatGate } from './components/auth/OpeningFloatGate';
import { CloseShiftModal } from './components/auth/CloseShiftModal';
import { DrawerCashModal } from './components/auth/DrawerCashModal';
import { WelcomeOnboardingModal } from './components/auth/WelcomeOnboardingModal';
import { InvoiceManager } from './components/admin/InvoiceManager';
import { TransactionHistory } from './components/reports/TransactionHistory';
import { SalesHeatmap } from './components/reports/SalesHeatmap';

export default function App() {
  // Check if opened as standalone customer secondary window (e.g. ?view=customer)
  const isCustomerWindow = typeof window !== 'undefined' && window.location.search.includes('view=customer');

  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'vendors' | 'payouts' | 'reports' | 'invoices' | 'admin'>('pos');
    const [reportsSubTab, setReportsSubTab] = useState<'eod' | 'pnl' | 'heatmap' | 'forecasting' | 'history' | 'downloads' | 'tax' | 'vendor_ledger'>('eod');

  // Commercial licensing: offline trial countdown / activation gate
  const [licenseState, setLicenseState] = useState<LicenseState>(() => resolveLicenseState());
  useEffect(() => {
    setLicenseState(resolveLicenseState());
  }, []);

  // Admin Security State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(null);
  // Mandatory opening cash float gate (Phase 1)
  const [hasActiveDay, setHasActiveDay] = useState(() => !!posDb.getActiveEODSession());
  // Welcoming popup onboarding state (default password advisory + float setup)
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(() => !posDb.getSettings().onboardingCompleted);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  // Staff cash drawer movement logger (cash banked / paid in / drops)
  const [isDrawerCashModalOpen, setIsDrawerCashModalOpen] = useState(false);

  // Live Database State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState(() => posDb.getSettings());

  // White-label: window/tab title always reflects the customer's brand
  useEffect(() => {
    document.title = resolveBrandName(settings);
  }, [settings.posAppName, settings.storeName]);
  // Per-cashier security gates: resolved for the logged-in staff member
  // (admin → full access; staff with own gates → those; legacy staff → the
  // global store map they have always inherited).
  const cashierAccess = useMemo(
    () => getEffectiveCashierAccess(currentStaff, settings),
    [currentStaff, settings]
  );

  const isSubTabAllowed = (subTab: 'eod' | 'pnl' | 'heatmap' | 'forecasting' | 'history' | 'downloads' | 'tax') => {
    if (isAdminLoggedIn) return true;
    if (!cashierAccess.reports) return false;
    
    switch (subTab) {
      case 'eod':
        return cashierAccess.reports_eod !== false; // default true
      case 'pnl':
        return !!cashierAccess.reports_pnl;
      case 'heatmap':
        return !!cashierAccess.reports_heatmap;
      case 'forecasting':
        return !!cashierAccess.reports_forecasting;
      case 'history':
        return !!cashierAccess.reports_history;
      default:
        // 'downloads' (and anything else) stays admin-only
        return false;
    }
  };

  useEffect(() => {
    if (!isAdminLoggedIn) {
      const subTabs: ('eod' | 'pnl' | 'heatmap' | 'forecasting' | 'history')[] = ['eod', 'pnl', 'heatmap', 'forecasting', 'history'];
      if (!isSubTabAllowed(reportsSubTab)) {
        const firstAllowed = subTabs.find(t => isSubTabAllowed(t));
        if (firstAllowed) {
          setReportsSubTab(firstAllowed);
        }
      }
    }
  }, [isAdminLoggedIn, cashierAccess, reportsSubTab]);

  // Modals
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
  const [isCustomerDisplayOpen, setIsCustomerDisplayOpen] = useState(false);
  const [isSqlInspectorOpen, setIsSqlInspectorOpen] = useState(false);
  const [isQuickRecoveryOpen, setIsQuickRecoveryOpen] = useState(false);

  // Lifted Terminal Configuration States
  const [activeRegisterId, setActiveRegisterId] = useState<string>(() => {
    const s = posDb.getSettings();
    return s.activeRegisterId || s.registers?.[0]?.id || 'REG-01';
  });
  const [activePriceListId, setActivePriceListId] = useState<string>(() => {
    const s = posDb.getSettings();
    const activeReg = s.registers?.find((r) => r.id === (s.activeRegisterId || 'REG-01'));
    return activeReg?.defaultPriceListId || s.activePriceListId || 'retail';
  });
  const [viewMode, setViewMode] = useState<'grid' | 'quick'>(() => {
    const s = posDb.getSettings();
    return s.posViewMode || 'grid';
  });
  const [activeCurrencyView, setActiveCurrencyView] = useState<string>(() => {
    const s = posDb.getSettings();
    return s.primaryCurrency || 'USD';
  });
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [priceNoticeMsg, setPriceNoticeMsg] = useState<string | null>(null);

  const handleSwitchPriceList = (priceListId: string) => {
    setActivePriceListId(priceListId);
    posDb.updateSettings({ activePriceListId: priceListId });
    const s = posDb.getSettings();
    const pl = (s.priceLists || []).find((l) => l.id === priceListId);
    const discText = pl?.discountPercentage ? ` (-${pl.discountPercentage}%)` : '';
    setPriceNoticeMsg(`Pricing tier: ${pl?.name || priceListId}${discText}`);
    setTimeout(() => setPriceNoticeMsg(null), 3500);
  };

  const handleSwitchRegister = (regId: string) => {
    setActiveRegisterId(regId);
    posDb.updateSettings({ activeRegisterId: regId });
    const s = posDb.getSettings();
    const reg = (s.registers || []).find((r) => r.id === regId);
    if (reg) {
      if (reg.defaultPriceListId) {
        handleSwitchPriceList(reg.defaultPriceListId);
        const pl = (s.priceLists || []).find((l) => l.id === reg.defaultPriceListId);
        setPriceNoticeMsg(`Station: ${reg.name} • Auto: ${pl?.name || reg.defaultPriceListId}`);
      } else {
        setPriceNoticeMsg(`Station: ${reg.name}`);
      }
      setTimeout(() => setPriceNoticeMsg(null), 4000);
    }
  };

  const changeViewMode = (mode: 'grid' | 'quick') => {
    setViewMode(mode);
    posDb.updateSettings({ posViewMode: mode });
  };

  const handleSwitchCurrencyView = (currency: string) => {
    setActiveCurrencyView(currency);
  };
  
  // Version Update Modal State
  const [latestVersionInfo, setLatestVersionInfo] = useState<{
    version: string;
    releaseNotes: string;
    downloadUrl: string;
    releaseDate: string;
  } | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);

  // Load / Refresh Data from DB
  const refreshData = () => {
    setInventory(posDb.getInventory());
    setVendors(posDb.getVendors());
    setTransactions(posDb.getTransactions());
    setSettings(posDb.getSettings());
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Day rollover watcher: if the laptop stays on overnight (or wakes up),
  // re-check the EOD session so a "new trading day" is detected automatically
  // and the starting-cash-float popup appears without restarting the app.
  useEffect(() => {
    const checkDay = () => setHasActiveDay(!!posDb.getActiveEODSession());
    checkDay();
    const interval = setInterval(checkDay, 30_000);
    const onFocus = () => {
      if (!document.hidden) checkDay();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  useEffect(() => {
    if (!isAdminLoggedIn && (
      (activeTab === 'inventory' && !cashierAccess.inventory) ||
      (activeTab === 'reports' && !cashierAccess.reports) ||
      (activeTab === 'admin' && !cashierAccess.settings && !cashierAccess.staff)
    )) {
      setActiveTab('pos');
    }
  }, [activeTab, cashierAccess.inventory, cashierAccess.reports, cashierAccess.settings, cashierAccess.staff, isAdminLoggedIn]);

  // Version auto update check effect
  useEffect(() => {
    const runVersionCheck = async () => {
      const settings = posDb.getSettings();
      if (settings.enableAutoUpdateCheck === false) return;

      const url = settings.updateConfigUrl || '/version.json';
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const config = await res.json();
        
        if (config && config.version) {
          const currentBuild = settings.posVersion || 'v2.4.1';
          const dismissedBuild = settings.dismissedUpdateVersion || '';
          
          if (config.version !== currentBuild && config.version !== dismissedBuild) {
            setLatestVersionInfo(config);
            setIsUpdateModalOpen(true);
          }
        }
      } catch (err) {
        console.warn('Update check failed:', err);
      }
    };

    runVersionCheck();
  }, []);

  // Idle Session Inactivity Warning State (60-second advance notice)
  const [isIdleWarningOpen, setIsIdleWarningOpen] = useState(false);
  const [idleSecondsLeft, setIdleSecondsLeft] = useState(60);

  // Inactivity auto-logout effect with 60s advance warning banner
  useEffect(() => {
    if (!currentStaff) {
      setIsIdleWarningOpen(false);
      return;
    }
    const timeoutMins = settings.inactivityTimeoutMinutes !== undefined ? settings.inactivityTimeoutMinutes : 15;
    if (timeoutMins <= 0) {
      setIsIdleWarningOpen(false);
      return;
    }

    const totalTimeoutMs = timeoutMins * 60 * 1000;
    const warningLeadTimeMs = Math.min(60 * 1000, Math.max(5000, totalTimeoutMs - 5000));
    const warningStartDelayMs = Math.max(1000, totalTimeoutMs - warningLeadTimeMs);

    let warningTimer: NodeJS.Timeout;
    let logoutTimer: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;

    const clearAllTimers = () => {
      if (warningTimer) clearTimeout(warningTimer);
      if (logoutTimer) clearTimeout(logoutTimer);
      if (countdownInterval) clearInterval(countdownInterval);
    };

    const resetInactivityTimer = () => {
      clearAllTimers();
      setIsIdleWarningOpen(false);

      // 1. Schedule the warning banner 60 seconds before timeout
      warningTimer = setTimeout(() => {
        const initialSeconds = Math.round(warningLeadTimeMs / 1000);
        setIdleSecondsLeft(initialSeconds);
        setIsIdleWarningOpen(true);

        let remaining = initialSeconds;
        countdownInterval = setInterval(() => {
          remaining -= 1;
          setIdleSecondsLeft(Math.max(0, remaining));
        }, 1000);

        // 2. Schedule actual auto-logout when the 60s warning period finishes
        logoutTimer = setTimeout(() => {
          clearAllTimers();
          setIsIdleWarningOpen(false);
          setCurrentStaff(null);
          setIsAdminLoggedIn(false);
          setActiveTab('pos');
        }, warningLeadTimeMs);
      }, warningStartDelayMs);
    };

    resetInactivityTimer();

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      clearAllTimers();
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [currentStaff, settings.inactivityTimeoutMinutes]);

  // Calculate low stock alert count
  const lowStockItems = inventory.filter((i) => i.stockLevel <= i.minStockThreshold);

  // Parse receipt query
  const [receiptQuery, setReceiptQuery] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const r = urlParams.get('receipt');
      if (r) {
        setReceiptQuery(r);
      }
    }
  }, []);

  // If viewing digital receipt & feedback
  if (receiptQuery) {
    return (
      <DigitalReceiptHub
        receiptNumber={receiptQuery}
        onBackToApp={() => {
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('receipt');
            window.history.pushState({}, '', url.toString());
            setReceiptQuery(null);
            refreshData();
          }
        }}
      />
    );
  }

  // If in secondary customer display window mode
  if (isCustomerWindow) {
    return (
      <div className="min-h-screen bg-[#0F1115] p-4 flex items-center justify-center">
        <CustomerDisplay isStandaloneWindow={true} />
      </div>
    );
  }

  // If initial onboarding or onboarding popup modal is active
  if (isOnboardingModalOpen || (!settings.onboardingCompleted && !currentStaff)) {
    return (
      <WelcomeOnboardingModal
        settings={settings}
        isReplayMode={!!settings.onboardingCompleted}
        onClose={() => setIsOnboardingModalOpen(false)}
        onComplete={(staff) => {
          setIsOnboardingModalOpen(false);
          setCurrentStaff(staff);
          setIsAdminLoggedIn(staff.role === 'admin');
          setHasActiveDay(true);
          refreshData();
        }}
      />
    );
  }

  if (!currentStaff) {
    return (
      <StaffLoginScreen
        storeName={resolveStoreName(settings)}
        onOpenWelcomeSetup={() => setIsOnboardingModalOpen(true)}
        onAuthenticated={(staff) => {
          setCurrentStaff(staff);
          setIsAdminLoggedIn(staff.role === 'admin');
        }}
      />
    );
  }

  // Mandatory opening cash float — the register cannot be used until today's
  // float is declared. Creates the EOD session for the day.
  if (!hasActiveDay) {
    return (
      <OpeningFloatGate
        storeName={resolveStoreName(settings)}
        storeTagline={settings.receiptHeaderSubtitle}
        cashierName={currentStaff.name}
        currencySymbol={settings.primaryCurrencySymbol || '$'}
        onConfirmed={() => setHasActiveDay(true)}
      />
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full bg-[#0F1115] text-[#E2E8F0] flex font-sans selection:bg-emerald-500 selection:text-[#0F1115] overflow-x-hidden">
      {/* Dynamic Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdminLoggedIn={isAdminLoggedIn}
        currentStaffName={currentStaff?.name}
        onLogout={() => {
          setCurrentStaff(null);
          setIsAdminLoggedIn(false);
          setActiveTab('pos');
        }}
        onCloseShift={() => setIsCloseShiftModalOpen(true)}
        cashierAccess={cashierAccess}
        lowStockCount={lowStockItems.length}
        onOpenLowStockModal={() => setIsLowStockModalOpen(true)}
        onOpenSqlInspector={() => setIsSqlInspectorOpen(true)}
        onOpenQuickRecovery={() => setIsQuickRecoveryOpen(true)}
        onOpenDrawerCash={() => setIsDrawerCashModalOpen(true)}
        isOpenMobile={isSidebarOpenMobile}
        setIsOpenMobile={setIsSidebarOpenMobile}
        activeRegisterId={activeRegisterId}
        onSwitchRegister={handleSwitchRegister}
        activePriceListId={activePriceListId}
        onSwitchPriceList={handleSwitchPriceList}
        viewMode={viewMode}
        onChangeViewMode={changeViewMode}
        activeCurrencyView={activeCurrencyView}
        onSwitchCurrencyView={handleSwitchCurrencyView}
        onOpenRefund={() => setIsRefundModalOpen(true)}
        transactions={transactions}
        inventoryList={inventory}
        vendorsCount={vendors.length}
      />

      {/* Main Workspace Frame next to Sidebar */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Modern Top Header with Quick Status Controls */}
        <TopHeader
          activeTab={activeTab}
          lowStockCount={lowStockItems.length}
          onOpenLowStockModal={() => setIsLowStockModalOpen(true)}
          onOpenCustomerDisplay={() => setIsCustomerDisplayOpen(true)}
          onRefreshData={refreshData}
          isAdminLoggedIn={isAdminLoggedIn}
          currentStaffName={currentStaff.name}
          onOpenSidebarMobile={() => setIsSidebarOpenMobile(true)}
        />

        {/* Main Body Canvas */}
        <main className="flex-1 w-full max-w-[1720px] mx-auto px-3 sm:px-6 py-4 space-y-4 min-w-0 overflow-y-auto">
        {/* TAB 1: Register (POS Terminal) */}
        {activeTab === 'pos' && (
          <CashierPOS
            inventory={inventory}
            onRefreshData={refreshData}
            currentStaff={currentStaff}
            activeRegisterId={activeRegisterId}
            onSwitchRegister={handleSwitchRegister}
            activePriceListId={activePriceListId}
            onSwitchPriceList={handleSwitchPriceList}
            viewMode={viewMode}
            onChangeViewMode={changeViewMode}
            activeCurrencyView={activeCurrencyView}
            onSwitchCurrencyView={handleSwitchCurrencyView}
            isRefundModalOpen={isRefundModalOpen}
            setIsRefundModalOpen={setIsRefundModalOpen}
            priceNoticeMsg={priceNoticeMsg}
          />
        )}

        {/* TAB 2: Inventory Catalog */}
        {activeTab === 'inventory' && (isAdminLoggedIn || cashierAccess.inventory) && (
          <InventoryAdmin
            inventory={inventory}
            vendors={vendors}
            onRefreshData={refreshData}
            currentStaff={currentStaff}
          />
        )}

        {/* TAB 3: Vendors & Supplier Profiles */}
        {activeTab === 'vendors' && (
          <VendorAdmin vendors={vendors} onRefreshData={refreshData} />
        )}

        {/* TAB 4: Consignment Payout Settlement */}
        {activeTab === 'payouts' && (
          <ConsignmentPayoutReport vendors={vendors} onRefreshData={refreshData} />
        )}

        {/* TAB 4b: Invoices & Orders (admin only) */}
        {activeTab === 'invoices' && isAdminLoggedIn && (
          <InvoiceManager onRefreshData={refreshData} />
        )}

        {/* TAB 5: Reports — Cashiers see ONLY the permitted EOD, heatmaps, and dashboard widgets; admins see everything */}
        {activeTab === 'reports' && (isAdminLoggedIn || cashierAccess.reports) && (
          <div className="space-y-4">
            {/* Sub-tab Switcher (shows allowed tabs for cashiers, or all tabs for admin) */}
            {(isAdminLoggedIn || cashierAccess.reports) && (
            <div className="flex bg-[#161B22] p-1.5 rounded-xl border border-[#1E293B] max-w-4xl flex-wrap gap-1 sm:gap-0">
              {isSubTabAllowed('eod') && (
                <button
                  onClick={() => setReportsSubTab('eod')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    reportsSubTab === 'eod'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  EOD Balancing
                </button>
              )}
              {isSubTabAllowed('pnl') && (
                <button
                  onClick={() => setReportsSubTab('pnl')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    reportsSubTab === 'pnl'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  P&L Reports
                </button>
              )}
              {isSubTabAllowed('heatmap') && (
                <button
                  onClick={() => setReportsSubTab('heatmap')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    reportsSubTab === 'heatmap'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sales Heatmap & Peak Hours
                </button>
              )}
              {isSubTabAllowed('forecasting') && (
                <button
                  onClick={() => setReportsSubTab('forecasting')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    reportsSubTab === 'forecasting'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sales Forecasting
                </button>
              )}
              {isAdminLoggedIn && (
                <button
                  onClick={() => setReportsSubTab('tax')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    reportsSubTab === 'tax'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tax Return
                </button>
              )}
              {isAdminLoggedIn && (
                <button
                  onClick={() => setReportsSubTab('downloads')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    reportsSubTab === 'downloads'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Download Reports
                </button>
              )}
              {isSubTabAllowed('history') && (
                <button
                  onClick={() => setReportsSubTab('history')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    reportsSubTab === 'history'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                                  Transaction History
                </button>
              )}
              {isAdminLoggedIn && (
                <button
                  onClick={() => setReportsSubTab('vendor_ledger')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    reportsSubTab === 'vendor_ledger'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Vendor Ledger
                </button>
              )}
            </div>
            )}
            {reportsSubTab === 'eod' ? (
              <EODBalancing />
            ) : reportsSubTab === 'pnl' ? (
              <FinancialReports
                transactions={transactions}
                inventory={inventory}
                vendors={vendors}
              />
            ) : reportsSubTab === 'heatmap' ? (
              <SalesHeatmap
                transactions={transactions}
                inventory={inventory}
                vendors={vendors}
                onRefreshData={refreshData}
              />
            ) : reportsSubTab === 'tax' ? (
              <TaxReturnAssistant transactions={transactions} />
            ) : reportsSubTab === 'downloads' ? (
              <ReportDownloads
                transactions={transactions}
                inventory={inventory}
                vendors={vendors}
              />
                        ) : reportsSubTab === 'history' ? (
              <TransactionHistory
                transactions={transactions}
                onRefreshData={refreshData}
              />
            ) : reportsSubTab === 'vendor_ledger' ? (
              <VendorSettlementReport
                vendors={vendors}
                onRefreshData={refreshData}
              />
            ) : (
              <SalesForecasting
                transactions={transactions}
                inventory={inventory}
                vendors={vendors}
                onRefreshData={refreshData}
              />
            )}
          </div>
        )}

        {/* TAB 6: Admin Backend Portal */}
        {activeTab === 'admin' && isAdminLoggedIn && (
          <AdminBackend
            inventory={inventory}
            onRefreshData={refreshData}
            isAdminLoggedIn={isAdminLoggedIn}
            setIsAdminLoggedIn={setIsAdminLoggedIn}
          />
        )}
      </main>
    </div>

      {/* Commercial licensing: activation gate (trial expired) + trial countdown */}
      {licenseState.status === 'locked' && (
        <LicenseGate onActivated={() => setLicenseState(resolveLicenseState())} />
      )}
      {licenseState.status === 'trial' && <TrialBadge daysLeft={licenseState.daysLeft} />}

      {/* Low Stock Alerts Modal */}
      {isLowStockModalOpen && (
        <LowStockAlertsModal
          lowStockItems={lowStockItems}
          onClose={() => setIsLowStockModalOpen(false)}
          onRefreshData={refreshData}
          currentStaffName={currentStaff?.name || 'Admin'}
        />
      )}

      {/* Customer Dual Display Docked Preview Modal */}
      {isCustomerDisplayOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F1115]/80 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full">
            <CustomerDisplay onCloseModal={() => setIsCustomerDisplayOpen(false)} />
          </div>
        </div>
      )}

      {/* SQL Schema Inspector Modal */}
      {isSqlInspectorOpen && isAdminLoggedIn && (
        <SqlInspectorModal
          onClose={() => setIsSqlInspectorOpen(false)}
          onRefreshData={refreshData}
        />
      )}

      {/* Quick Currency & Recovery Modal — admin-only (parity with SQL Inspector) */}
      {isQuickRecoveryOpen && isAdminLoggedIn && (
        <QuickRecoveryModal
          onClose={() => setIsQuickRecoveryOpen(false)}
          onRefreshData={refreshData}
          onGrantAdmin={() => setIsAdminLoggedIn(true)}
          isAdminLoggedIn={isAdminLoggedIn}
        />
      )}

      {/* Dynamic Version Check Update Prompt Modal */}
      {latestVersionInfo && (
        <VersionUpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          currentVersion={posDb.getSettings().posVersion || 'v2.4.1'}
          latestVersionInfo={latestVersionInfo}
          onDismissVersion={(v) => {
            posDb.updateSettings({ dismissedUpdateVersion: v });
            refreshData();
          }}
          themeColor={posDb.getSettings().customThemeColor || 'emerald'}
        />
      )}

      {/* Visual Idle Session Inactivity Warning Banner (60s Advance Notice) */}
      {isIdleWarningOpen && currentStaff && (
        <div
          onClick={() => {
            // Tapping anywhere on the banner extends and keeps current session active
            window.dispatchEvent(new Event('mousedown'));
          }}
          className="fixed inset-x-0 top-0 z-[100] bg-gradient-to-r from-amber-950/95 via-amber-900/95 to-slate-900/95 border-b-2 border-amber-500/80 p-3 sm:p-4 text-white shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-top duration-300 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-amber-300 tracking-wide uppercase">
                  Session Inactivity Warning
                </span>
                <span className="bg-amber-500 text-slate-950 font-black font-mono text-xs px-2.5 py-0.5 rounded-full shadow-md animate-bounce">
                  Logout in {idleSecondsLeft}s
                </span>
              </div>
              <p className="text-xs text-amber-100/90 mt-0.5 font-medium">
                Tap anywhere on screen or press the button to keep your register session active without losing cart items or unsaved work.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new Event('mousedown'));
              }}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black font-mono text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Keep Session Active</span>
            </button>
          </div>
        </div>
      )}

      {currentStaff && (
        <>
          <CloseShiftModal
            isOpen={isCloseShiftModalOpen}
            onClose={() => setIsCloseShiftModalOpen(false)}
            currentStaff={currentStaff}
            settings={settings}
            onRefreshData={refreshData}
            onSessionClosed={() => {
              setHasActiveDay(false);
              setCurrentStaff(null);
              setIsAdminLoggedIn(false);
              setActiveTab('pos');
              refreshData();
            }}
          />

          <DrawerCashModal
            isOpen={isDrawerCashModalOpen}
            onClose={() => setIsDrawerCashModalOpen(false)}
            currentStaff={currentStaff}
            settings={settings}
            onChanged={refreshData}
          />
        </>
      )}
    </div>
  );
}
