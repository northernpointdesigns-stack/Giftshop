import React, { useState, useEffect } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { CashierPOS } from './components/pos/CashierPOS';
import { InventoryAdmin } from './components/admin/InventoryAdmin';
import { VendorAdmin } from './components/admin/VendorAdmin';
import { EODBalancing } from './components/reports/EODBalancing';
import { FinancialReports } from './components/reports/FinancialReports';
import { ConsignmentPayoutReport } from './components/reports/ConsignmentPayoutReport';
import { SalesForecasting } from './components/reports/SalesForecasting';
import { CustomerDisplay } from './components/customer/CustomerDisplay';
import { DigitalReceiptHub } from './components/customer/DigitalReceiptHub';
import { AdminBackend } from './components/admin/AdminBackend';
import { LowStockAlertsModal } from './components/alerts/LowStockAlertsModal';
import { DesktopInstallModal } from './components/desktop/DesktopInstallModal';
import { posDb } from './services/db';
import { InventoryItem, Vendor } from './types/pos';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('pos');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLowStockOpen, setIsLowStockOpen] = useState(false);
  const [isDesktopInstallOpen, setIsDesktopInstallOpen] = useState(false);

  // Load data from centralized service
  const refreshData = () => {
    setInventory(posDb.getInventory());
    setVendors(posDb.getVendors());
  };

  useEffect(() => {
    refreshData();

    // Check URL parameters for direct shortcut access (e.g. ?tab=inventory or ?tab=customer_display)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as NavTab;
      if (tabParam) {
        setActiveTab(tabParam);
      }

      // Listen for Electron or shortcut tab changes
      const handleTabChange = (e: any) => {
        if (e.detail) {
          setActiveTab(e.detail as NavTab);
        }
      };
      const handleOpenInstall = () => {
        setIsDesktopInstallOpen(true);
      };
      window.addEventListener('nav-tab-change', handleTabChange);
      window.addEventListener('open-desktop-install', handleOpenInstall);
      return () => {
        window.removeEventListener('nav-tab-change', handleTabChange);
        window.removeEventListener('open-desktop-install', handleOpenInstall);
      };
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0D13] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Universal Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        inventory={inventory}
        onOpenLowStock={() => setIsLowStockOpen(true)}
        onOpenDesktopInstall={() => setIsDesktopInstallOpen(true)}
      />

      {/* Main Workspace Router */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'pos' && (
          <CashierPOS inventory={inventory} onRefreshData={refreshData} />
        )}

        {activeTab === 'inventory' && (
          <InventoryAdmin inventory={inventory} onRefresh={refreshData} />
        )}

        {activeTab === 'vendors' && (
          <VendorAdmin vendors={vendors} onRefresh={refreshData} />
        )}

        {activeTab === 'reports' && <EODBalancing onRefresh={refreshData} />}

        {activeTab === 'financials' && <FinancialReports />}

        {activeTab === 'consignment_reports' && <ConsignmentPayoutReport />}

        {activeTab === 'forecast' && <SalesForecasting />}

        {activeTab === 'customer_display' && <CustomerDisplay />}

        {activeTab === 'digital_receipts' && <DigitalReceiptHub />}

        {activeTab === 'admin' && <AdminBackend onRefresh={refreshData} />}
      </main>

      {/* Low Stock Threshold Modal */}
      <LowStockAlertsModal
        inventory={inventory}
        isOpen={isLowStockOpen}
        onClose={() => setIsLowStockOpen(false)}
        onNavigateToInventory={() => {
          setIsLowStockOpen(false);
          setActiveTab('inventory');
        }}
      />

      {/* Desktop App Installer & Terminal Hardware Modal */}
      <DesktopInstallModal
        isOpen={isDesktopInstallOpen}
        onClose={() => setIsDesktopInstallOpen(false)}
      />
    </div>
  );
};

export default App;
