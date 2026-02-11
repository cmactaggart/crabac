import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  ipcMain,
  shell,
  nativeImage,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const store = new Store<{
  windowBounds: { x: number; y: number; width: number; height: number };
  serverUrl: string;
  minimizeToTray: boolean;
}>({
  defaults: {
    windowBounds: { x: 0, y: 0, width: 1200, height: 800 },
    serverUrl: 'https://app.crab.ac',
    minimizeToTray: false,
  },
});

const DEFAULT_URL = 'https://app.crab.ac';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function getServerUrl(): string {
  return process.env.DEV_SERVER_URL || store.get('serverUrl') || DEFAULT_URL;
}

function createWindow(): void {
  const bounds = store.get('windowBounds');
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    x: bounds.x || undefined,
    y: bounds.y || undefined,
    width: bounds.width,
    height: bounds.height,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#2e1a1a',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(getServerUrl());

  // Save window bounds on move/resize
  const saveBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  };
  mainWindow.on('move', saveBounds);
  mainWindow.on('resize', saveBounds);

  // Handle external links — open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const serverOrigin = new URL(getServerUrl()).origin;
    if (url.startsWith(serverOrigin)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Navigate external links clicked in-page to system browser
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const serverOrigin = new URL(getServerUrl()).origin;
    if (!url.startsWith(serverOrigin)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Minimize to tray on close if configured
  mainWindow.on('close', (event) => {
    if (store.get('minimizeToTray') && tray && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showAndFocusWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

function createTray(): void {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('crab.ac');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: showAndFocusWindow },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', showAndFocusWindow);
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info) => {
    const notification = new Notification({
      title: 'Update Ready',
      body: `crab.ac v${info.version} will be installed on restart.`,
    });
    notification.on('click', () => {
      autoUpdater.quitAndInstall();
    });
    notification.show();
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('Update check failed:', err.message);
  });
}

// IPC handlers
ipcMain.on('show-notification', (_event, { title, body }: { title: string; body: string }) => {
  const notification = new Notification({ title, body });
  notification.on('click', showAndFocusWindow);
  notification.show();
});

ipcMain.handle('get-server-url', () => getServerUrl());

ipcMain.handle('set-server-url', (_event, url: string) => {
  store.set('serverUrl', url);
  mainWindow?.loadURL(url);
});

// App lifecycle
app.on('ready', () => {
  createWindow();
  createTray();

  // Only check for updates in packaged builds
  if (app.isPackaged) {
    setupAutoUpdater();
  }
});

app.on('activate', () => {
  // macOS dock click
  showAndFocusWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
