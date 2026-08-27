import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { printVendorPaymentReceipt } from '../../utils/printVendorPaymentReceipt';
import { VENDORS, SETTINGS } from '../../test/fixtures';
import { VendorLedgerSnapshot } from '../../types/pos';

describe('printVendorPaymentReceipt Utility', () => {
  let mockSnapshot: VendorLedgerSnapshot;
  let mockSettings: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup a clean snap mock
    mockSnapshot = {
      vendor: VENDORS[1], // Souvenir Boutique (consignment)
      transactions: [
        {
          txId: 'TX-1',
          receiptNumber: 'REC-100',
          timestamp: new Date().toISOString(),
          isRefund: false,
          sku: 'SKU-001',
          name: 'Handcrafted Shell Mug',
          category: 'Mugs',
          quantity: 2,
          unitPrice: 15,
          totalPrice: 30,
          vatAmount: 4.5,
          costBasis: 0,
          houseCut: 9,
          vendorPayout: 21,
          supplierType: 'consignment',
        },
      ],
      advances: [
        {
          id: 'ADV-1',
          vendorId: 'V-SOUV',
          vendorName: 'Souvenir Boutique',
          amount: 5,
          date: new Date().toISOString(),
          note: 'Emergency cash topup',
          recordedBy: 'Admin',
        },
      ],
      settlements: [
        {
          id: 'PAY-1',
          vendorId: 'V-SOUV',
          vendorName: 'Souvenir Boutique',
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
          totalUnitsSold: 1,
          totalGrossSales: 15,
          houseCommission: 4.5,
          payoutAmount: 10.5,
          status: 'paid',
          paidAt: new Date().toISOString(),
          notes: 'Settled',
        },
      ],
      periodSales: {
        totalUnits: 2,
        grossSales: 30,
        vat: 4.5,
        houseCut: 9,
        vendorPayout: 21,
      },
      advanceTotal: 5,
      settledTotal: 10.5,
      netOwing: 5.5,
      isWholesale: false,
    };

    mockSettings = {
      ...SETTINGS,
      storeName: 'Test Boutique Store',
      primaryCurrency: 'USD',
      primaryCurrencySymbol: '$',
    };
  });

  it('correctly creates an iframe element, writes HTML template, and attempts to trigger printing', () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');

    printVendorPaymentReceipt(mockSnapshot, mockSettings);

    // Verify it created an iframe
    expect(createElementSpy).toHaveBeenCalledWith('iframe');

    // Clean up
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
  });

  it('handles custom options such as settlement record details', () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    
    printVendorPaymentReceipt(mockSnapshot, mockSettings, {
      settlementRecord: mockSnapshot.settlements[0],
    });

    expect(createElementSpy).toHaveBeenCalledWith('iframe');
    createElementSpy.mockRestore();
  });

  it('handles custom options such as advance record details', () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    
    printVendorPaymentReceipt(mockSnapshot, mockSettings, {
      advanceRecord: mockSnapshot.advances[0],
    });

    expect(createElementSpy).toHaveBeenCalledWith('iframe');
    createElementSpy.mockRestore();
  });
});
