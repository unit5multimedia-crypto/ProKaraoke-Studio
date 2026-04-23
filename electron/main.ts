import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';

// Fallback for __dirname depending on the build environment
const currentDir = typeof __dirname !== 'undefined' 
  ? __dirname 
  : path.join(app.getAppPath(), 'electron');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1280, screenWidth),
    height: Math.min(800, screenHeight),
    title: "ProKaraoke Studio",
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(currentDir, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // For YouTube/local media access
    },
    // Frameless options for potential "Studio" feel
    titleBarStyle: 'hiddenInset', 
  });

  // CRITICAL: Set User Agent to allow Google/YouTube login in Electron
  mainWindow.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Firebase Auth uses the firebaseapp.com domain for its authentication proxy
    if (url.includes('firebaseapp.com') || url.includes('accounts.google.com') || url.startsWith('https://www.youtube.com')) {
      return { 
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 600,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        }
      }; // Allow OAuth popups
    }
    return { action: 'deny' };
  });

  const startUrl = isDev 
    ? 'http://localhost:3000?view=operator' 
    : `file://${path.join(currentDir, '../dist/index.html')}?view=operator`;

  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// IPC Handling for Projection Mode
import { ipcMain } from 'electron';

ipcMain.on('open-projection', (event, viewType: string) => {
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    title: `ProKaraoke - ${viewType.toUpperCase()}`,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(currentDir, 'preload.cjs'),
      contextIsolation: true,
    },
  });

  if (externalDisplay) {
    win.setBounds(externalDisplay.bounds);
    win.setFullScreen(true);
  }

  const url = isDev 
    ? `http://localhost:3000?view=${viewType}` 
    : `file://${path.join(currentDir, '../dist/index.html')}?view=${viewType}`;
  
  win.loadURL(url);
  win.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
});

ipcMain.on('app-exit', () => {
  app.quit();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
