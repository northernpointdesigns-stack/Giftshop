import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CashierPOS } from './components/pos/CashierPOS';
import { InventoryAdmin } from './components/admin/InventoryAdmin';
import { VendorAdmin } from './components/admin/VendorAdmin';
import { AdminBackend } from './components/admin/AdminBackend';
import { ConsignmentPayoutReport } from './components/reports/ConsignmentPayoutReport';
import { EODBalancing } from './components/reports/EODBalancing';
import { FinancialReports } from './components/reports/FinancialReports';
import { SalesForecasting } from './components/reports/SalesForecasting';
import { CustomerDisplay } from './components/customer/CustomerDisplay';
import { LowStockAlertsModal } from './components/alerts/LowStockAlertsModal';
import { SqlInspectorModal } from './components/admin/SqlInspectorModal';
import { DigitalReceiptHub } from './components/customer/DigitalReceiptHub';
import { VersionUpdateModal } from './components/alerts/VersionUpdateModal';
import { posDb } from './services/db';
import { InventoryItem, Vendor, Transaction, StaffUser } from './types/pos';
import { StaffLoginScreen } from './components/auth/StaffLoginScreen';

export default function App() {
  // Check if opened as standalone customer secondary window (e.g. ?view=customer)
  const isCustomerWindow = typeof window !== 'undefined' && window.location.search.includes('view=customer');

  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'vendors' | 'payouts' | 'reports' | 'admin'>('pos');
  const [reportsSubTab, setReportsSubTab] = useState<'eod' | 'pnl' | 'forecasting'>('eod');

  // Admin Security State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(null);

  // Live Database State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState(() => posDb.getSettings());
  const cashierAccess = settings.cashierAccess || {
    pos: true,
    inventory: true,
    reports: true,
    settings: false,
    staff: false,
  };

  // Modals
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
  const [isCustomerDisplayOpen, setIsCustomerDisplayOpen] = useState(false);
  const [isSqlInspectorOpen, setIsSqlInspectorOpen] = useState(false);
  
  // Version Update Modal State
  const [latestVersionInfo, setLatestVersionInfo] = useState<{
    version: string;
    releaseNotes: string;
    downloadUrl: string;
    releaseDate: string;
  } | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

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

  if (!currentStaff) {
    return (
      <StaffLoginScreen
        storeName={settings.storeName || 'BoutiquePOS'}
        onAuthenticated={(staff) => {
          setCurrentStaff(staff);
          setIsAdminLoggedIn(staff.role === 'admin');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#E2E8F0] flex flex-col font-sans selection:bg-emerald-500 selection:text-[#0F1115]">
      {/* Top Bar adhereing to contract */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lowStockCount={lowStockItems.length}
        onOpenLowStockModal={() => setIsLowStockModalOpen(true)}
        onOpenCustomerDisplay={() => setIsCustomerDisplayOpen(true)}
        onOpenSqlInspector={() => setIsSqlInspectorOpen(true)}
        isAdminLoggedIn={isAdminLoggedIn}
        cashierAccess={cashierAccess}
        currentStaffName={currentStaff.name}
        onLogout={() => {
          setCurrentStaff(null);
          setIsAdminLoggedIn(false);
          setActiveTab('pos');
        }}
      />

      {/* Main Body Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* TAB 1: Register (POS Terminal) */}
        {activeTab === 'pos' && (
          <CashierPOS inventory={inventory} onRefreshData={refreshData} />
        )}

        {/* TAB 2: Inventory Catalog */}
        {activeTab === 'inventory' && (isAdminLoggedIn || cashierAccess.inventory) && (
          <InventoryAdmin
            inventory={inventory}
            vendors={vendors}
            onRefreshData={refreshData}
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

        {/* TAB 5: Reports (EOD Balancing & Financial P&L) */}
        {activeTab === 'reports' && (isAdminLoggedIn || cashierAccess.reports) && (
          <div className="space-y-4">
            {/* Sub-tab Switcher */}
            <div className="flex bg-[#161B22] p-1.5 rounded-xl border border-[#1E293B] max-w-2xl flex-wrap gap-1 sm:gap-0">
              <button
                onClick={() => setReportsSubTab('eod')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                  reportsSubTab === 'eod'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EOD Shift Drawer Balancing
              </button>
              <button
                onClick={() => setReportsSubTab('pnl')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                  reportsSubTab === 'pnl'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Profit & Loss (Owned vs Consignment)
              </button>
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
            </div>

            {reportsSubTab === 'eod' ? (
              <EODBalancing onRefreshData={refreshData} />
            ) : reportsSubTab === 'pnl' ? (
              <FinancialReports
                transactions={transactions}
                inventory={inventory}
                vendors={vendors}
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

      {/* Low Stock Alerts Modal */}
      {isLowStockModalOpen && (
        <LowStockAlertsModal
          lowStockItems={lowStockItems}
          onClose={() => setIsLowStockModalOpen(false)}
          onRefreshData={refreshData}
        />
      )}

      {/* Customer Dual Display Docked Preview Modal */}
      {isCustomerDisplayOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F1115]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-4xl w-full">
            <CustomerDisplay onCloseModal={() => setIsCustomerDisplayOpen(false)} />
          </div>
        </div>
      )}

      {/* SQL Schema Inspector Modal */}
      {isSqlInspectorOpen && (
        <SqlInspectorModal
          onClose={() => setIsSqlInspectorOpen(false)}
          onRefreshData={refreshData}
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
    </div>
  );
}
