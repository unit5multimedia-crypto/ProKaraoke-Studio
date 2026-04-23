import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import isDev from 'electron-is-dev';

// Geometry Persistence mimicking OBS
function getProjectorGeometry(viewType: string) {
  try {
    const stateFile = path.join(app.getPath('userData'), `obs-projector-${viewType}.dat`);
    if (fs.existsSync(stateFile)) {
      const b64Data = fs.readFileSync(stateFile, 'utf8');
      const jsonStr = Buffer.from(b64Data, 'base64').toString('utf8');
      return JSON.parse(jsonStr);
    }
  } catch (e) {
    console.error("Failed to read projector geometry:", e);
  }
  return null;
}

function saveProjectorGeometry(viewType: string, bounds: Electron.Rectangle) {
  try {
    const stateFile = path.join(app.getPath('userData'), `obs-projector-${viewType}.dat`);
    const jsonStr = JSON.stringify(bounds);
    const b64Data = Buffer.from(jsonStr, 'utf8').toString('base64');
    fs.writeFileSync(stateFile, b64Data);
  } catch (e) {
    console.error("Failed to save projector geometry:", e);
  }
}

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

ipcMain.on('open-projector', (event, config: { type: string, monitor: number, name?: string }) => {
  const { type, monitor, name } = config;
  const displays = screen.getAllDisplays();
  
  const isWindowed = monitor === -1;
  
  // Find the requested display. OBS uses 0 for primary, 1+ for others.
  let targetDisplay = displays[0];
  if (!isWindowed) {
    if (monitor >= 0 && monitor < displays.length) {
      targetDisplay = displays[monitor];
    } else {
      // Fallback: try to find any external display
      targetDisplay = displays.find((display) => display.bounds.x !== 0 || display.bounds.y !== 0) || displays[0];
    }
  }

  const windowTitle = `ProKaraoke Projector - ${name || type.toUpperCase()}`;
  
  let windowConfig: Electron.BrowserWindowConstructorOptions = {
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    title: windowTitle,
    backgroundColor: '#000000',
    frame: !isWindowed,
    autoHideMenuBar: true,
    alwaysOnTop: isWindowed, // Windowed projectors commonly stay on top
    fullscreen: !isWindowed, // Force full screen if not windowed
    webPreferences: {
      preload: path.join(currentDir, 'preload.cjs'),
      contextIsolation: true,
      backgroundThrottling: false, // Ensures GPU pipeline doesn't stall when unfocused
    },
  };

  if (isWindowed) {
    const savedGeometry = getProjectorGeometry(type);
    if (savedGeometry) {
       windowConfig.x = savedGeometry.x;
       windowConfig.y = savedGeometry.y;
       windowConfig.width = savedGeometry.width;
       windowConfig.height = savedGeometry.height;
    } else {
       // Default windowed size
       windowConfig.width = 1280;
       windowConfig.height = 720;
       windowConfig.x = targetDisplay.bounds.x + 50;
       windowConfig.y = targetDisplay.bounds.y + 50;
    }
  }

  const win = new BrowserWindow(windowConfig);

  if (!isWindowed) {
    win.setFullScreen(true);
    win.setMenuBarVisibility(false);
  } else {
    // Save geometry on move and resize for windowed projectors
    const saveState = () => saveProjectorGeometry(type, win.getBounds());
    win.on('moved', saveState);
    win.on('resized', saveState);
  }

  const url = isDev 
    ? `http://localhost:3000?view=${type}` 
    : `file://${path.join(currentDir, '../dist/index.html')}?view=${type}`;
  
  win.loadURL(url);
  win.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
});

// Inter-window communication router (Replaces BroadcastChannel)
ipcMain.on('karaoke-sync-out', (event, data) => {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(w => {
    if (w.webContents !== event.sender) {
      w.webContents.send('karaoke-sync-in', data);
    }
  });
});

ipcMain.on('app-exit', () => {
  app.quit();
});

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(() => {
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true); // Auto-approve mic/camera
  });
  createWindow();
});

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
