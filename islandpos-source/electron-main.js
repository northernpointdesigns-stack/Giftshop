import { app, BrowserWindow, Menu, globalShortcut } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let secondaryWindow = null;

function createWindows() {
  // Create primary cashier POS window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'POS Terminal Client',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load build output or dev server URL
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Remove default menu bar for slick corporate look
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (secondaryWindow) {
      secondaryWindow.close();
    }
  });

  // Support secondary customer-facing dual display screen
  mainWindow.webContents.on('did-finish-load', () => {
    // Enable external display window toggles if dual-display is clicked
  });
}

app.whenReady().then(() => {
  createWindows();

  // Standard keyboard shortcuts for POS operations
  globalShortcut.register('F5', () => {
    mainWindow && mainWindow.reload();
  });

  globalShortcut.register('Control+Shift+I', () => {
    mainWindow && mainWindow.webContents.toggleDevTools();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
