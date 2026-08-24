import { app, BrowserWindow, Menu, globalShortcut } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let secondaryWindow = null;

function createWindows() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "BoutiquePOS",
    icon: path.join(__dirname, "dist", "favicon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
  }

  Menu.setApplicationMenu(null);

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (secondaryWindow) {
      secondaryWindow.close();
    }
  });
}

app.whenReady().then(() => {
  createWindows();

  globalShortcut.register("F5", () => {
    mainWindow?.reload();
  });

  globalShortcut.register("Control+Shift+I", () => {
    mainWindow?.webContents.toggleDevTools();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});