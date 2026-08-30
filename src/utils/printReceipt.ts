import { Transaction, StoreSettings } from '../types/pos';
import { printThermalReceipt } from './printThermalReceipt';
import { printStandardInvoice } from './printStandardInvoice';

export type PrintFormat = 'thermal' | 'normal';

export const printReceipt = (
  transaction: Transaction,
  settings: StoreSettings,
  formatOverride?: PrintFormat
) => {
  const chosenFormat: PrintFormat =
    formatOverride ||
    (settings.receiptPrinterType === 'normal' ? 'normal' : 'thermal');

  if (chosenFormat === 'normal') {
    printStandardInvoice(transaction, settings);
  } else {
    printThermalReceipt(transaction, settings, settings.thermalReceiptWidth || '80mm');
  }
};
