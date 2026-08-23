const { app, BrowserWindow, Menu, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;
let customerWindow = null;

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0B0D13',
    title: 'Seychelles Ocean Retail POS',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (customerWindow) {
      customerWindow.close();
      customerWindow = null;
    }
  });

  createAppMenu();
}

function createCustomerFacingWindow() {
  if (customerWindow) {
    customerWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  const targetBounds = externalDisplay
    ? externalDisplay.bounds
    : { x: 100, y: 100, width: 1024, height: 768 };

  customerWindow = new BrowserWindow({
    x: targetBounds.x,
    y: targetBounds.y,
    width: targetBounds.width,
    height: targetBounds.height,
    fullscreen: !!externalDisplay,
    backgroundColor: '#0B0D13',
    title: 'Customer Facing Display • Ocean POS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    customerWindow.loadURL('http://localhost:3000/?tab=customer_display');
  } else {
    customerWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      search: 'tab=customer_display'
    });
  }

  customerWindow.on('closed', () => {
    customerWindow = null;
  });
}

function createAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'Terminal',
      submenu: [
        {
          label: 'Cashier Checkout POS',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow?.webContents.executeJavaScript(
              `window.dispatchEvent(new CustomEvent('nav-tab-change', { detail: 'pos' }))`
            );
          },
        },
        {
          label: 'Inventory Management',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow?.webContents.executeJavaScript(
              `window.dispatchEvent(new CustomEvent('nav-tab-change', { detail: 'inventory' }))`
            );
          },
        },
        {
          label: 'End-of-Day Balancing',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow?.webContents.executeJavaScript(
              `window.dispatchEvent(new CustomEvent('nav-tab-change', { detail: 'reports' }))`
            );
          },
        },
        { type: 'separator' },
        {
          label: 'Open Customer Display (2nd Screen)',
          accelerator: 'CmdOrCtrl+D',
          click: () => createCustomerFacingWindow(),
        },
        {
          label: 'Quick Print Thermal Receipt',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            mainWindow?.webContents.print({ silent: false, printBackground: true });
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }]
          : [{ role: 'close' }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('open-customer-screen', () => {
  createCustomerFacingWindow();
  return true;
});

ipcMain.handle('toggle-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return mainWindow.isFullScreen();
  }
  return false;
});

ipcMain.handle('get-version', () => app.getVersion());

ipcMain.handle('print-receipt', async (event, options) => {
  if (mainWindow) {
    return new Promise((resolve) => {
      mainWindow.webContents.print(
        {
          silent: options?.silent || false,
          printBackground: true,
          deviceName: options?.printerName || '',
        },
        (success, errorType) => {
          resolve({ success, errorType });
        }
      );
    });
  }
  return { success: false, error: 'No main window' };
});

ipcMain.handle('open-drawer', () => {
  // Cash drawer RJ11 trigger simulation
  return { success: true, message: 'Cash drawer trigger pulse sent.' };
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
