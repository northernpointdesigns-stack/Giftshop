const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('isElectron', true);
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  printThermalReceipt: (receiptData) => ipcRenderer.invoke('print-receipt', receiptData),
  openCashDrawer: () => ipcRenderer.invoke('open-drawer'),
  openDualScreenDisplay: () => ipcRenderer.invoke('open-customer-screen'),
  toggleFullScreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  getAppVersion: () => ipcRenderer.invoke('get-version'),
});
