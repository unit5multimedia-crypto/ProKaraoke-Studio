import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';

// Fallback for __dirname depending on the build environment
const currentDir = typeof __dirname !== 'undefined' 
  ? __dirname 
  : path.join(app.getAppPath(), 'electron');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  
  // Find secondary displays for projector output
  const secondaryDisplays = displays.filter(d => d.id !== primaryDisplay.id);
  
  // Create main operator window on primary display
  mainWindow = new BrowserWindow({
    width: Math.min(1280, primaryDisplay.workAreaSize.width),
    height: Math.min(800, primaryDisplay.workAreaSize.height),
    x: primaryDisplay.workArea.x,
    y: primaryDisplay.workArea.y,
    title: "ProKaraoke Studio - Operator",
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(currentDir, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // For YouTube/local media access
    },
    titleBarStyle: 'hiddenInset',
  });

  // Create projector windows for secondary displays
  const projectorWindows: BrowserWindow[] = [];
  
  secondaryDisplays.forEach((display, index) => {
    const projectorWindow = new BrowserWindow({
      width: display.workAreaSize.width,
      height: display.workAreaSize.height,
      x: display.workArea.x,
      y: display.workArea.y,
      title: `ProKaraoke Studio - Projector ${index + 1}`,
      backgroundColor: '#000000',
      webPreferences: {
        preload: path.join(currentDir, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
      },
      titleBarStyle: 'hiddenInset',
      fullscreen: true, // Projectors typically want fullscreen
      alwaysOnTop: false, // Let user manage layering
    });

    const projectorUrl = isDev 
      ? `http://localhost:3000?view=stage` 
      : `file://${path.join(currentDir, '../dist/index.html')}?view=stage`;

    projectorWindow.loadURL(projectorUrl);
    projectorWindows.push(projectorWindow);
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://accounts.google.com')) {
      return { action: 'allow' }; // Allow OAuth popups
    }
    return { action: 'deny' };
  });

  const startUrl = isDev 
    ? 'http://localhost:3000?view=operator' 
    : `file://${path.join(currentDir, '../dist/index.html')}?view=operator`;

  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Close all projector windows when main window closes
    projectorWindows.forEach(win => win.close());
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

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
