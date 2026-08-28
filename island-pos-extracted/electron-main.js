import { app, BrowserWindow, Menu, globalShortcut } from 'electron';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let secondaryWindow = null;
let uiCheckTimer = null;

function createWindows() {
  // Create primary cashier POS window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'The Gift Shop POS',
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

  // Diagnostic: capture renderer console (incl. crash stacks) to a temp log
  mainWindow.webContents.on('console-message', (...args) => {
    try {
      const ev = args[0];
      let message, stackTrace, level;
      if (ev && typeof ev === 'object' && 'message' in ev) {
        message = ev.message;
        stackTrace = ev.stackTrace;
        level = ev.level;
      } else {
        // legacy signature: (event, level, message, line, sourceId)
        message = args[2];
        level = args[1];
      }
      fs.appendFileSync(
        '/tmp/pos-renderer.log',
        JSON.stringify({ ts: new Date().toISOString(), level, message, stackTrace }, null, 2) + '\n---\n'
      );
    } catch {
      // never break the app on logging
    }
  });

  // Diagnostic: confirm the UI actually rendered after load.
  // Guard the delayed check so closing the window (X) never crashes the app:
  // the timer is cleared on close and checks the window is still alive before
  // touching webContents.
  mainWindow.webContents.on('did-finish-load', () => {
    if (uiCheckTimer) clearTimeout(uiCheckTimer);
    uiCheckTimer = setTimeout(() => {
      uiCheckTimer = null;
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents
        .executeJavaScript('document.body.innerText.replace(/\\n+/g, " | ").slice(0, 300)')
        .then((text) => {
          fs.appendFileSync('/tmp/pos-renderer.log', JSON.stringify({ uiRenderCheck: text }, null, 2) + '\n---\n');
        })
        .catch(() => {});
    }, 2500);
  });

  // Remove default menu bar for slick corporate look
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    if (uiCheckTimer) {
      clearTimeout(uiCheckTimer);
      uiCheckTimer = null;
    }
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
