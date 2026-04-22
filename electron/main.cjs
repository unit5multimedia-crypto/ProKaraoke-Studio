const { app, BrowserWindow, Menu, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let prompterWindow = null;
let stageWindow = null;

// Scan directory for karaoke files
function scanDirectory(dirPath) {
  const files = [];
  
  function scanDir(currentPath) {
    try {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Recursively scan subdirectories
          scanDir(fullPath);
        } else if (stat.isFile()) {
          // Check for karaoke file extensions
          const ext = path.extname(item).toLowerCase();
          if (['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.mp3', '.wav', '.flac', '.m4a'].includes(ext)) {
            files.push({
              name: item,
              path: fullPath,
              type: ext === '.mp3' || ext === '.wav' || ext === '.flac' || ext === '.m4a' ? 'audio' : 'video',
              size: stat.size
            });
          }
        }
      }
    } catch (error) {
      console.error('Error scanning directory:', error);
    }
  }
  
  scanDir(dirPath);
  return files;
}

function createWindow() {
  const displays = screen.getAllDisplays();

  // Main window: Operator Console
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL('http://localhost:3000?view=operator');

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prompter window: For the singer
  prompterWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    x: displays.length > 1 ? displays[1].bounds.x : 50,
    y: displays.length > 1 ? displays[1].bounds.y : 50,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  prompterWindow.loadURL('http://localhost:3000?view=prompter');

  prompterWindow.on('closed', () => {
    prompterWindow = null;
  });

  // Stage Visual window: Concert visuals
  stageWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    frame: false,
    x: displays.length > 2 ? displays[2].bounds.x : (displays.length > 1 ? displays[1].bounds.x + 850 : 100),
    y: displays.length > 2 ? displays[2].bounds.y : (displays.length > 1 ? displays[1].bounds.y + 50 : 100),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  stageWindow.loadURL('http://localhost:3000?view=stage');

  stageWindow.on('closed', () => {
    stageWindow = null;
  });
}

// Menu template
const menuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Scan for Karaoke Files',
        accelerator: 'CmdOrCtrl+O',
        click: async () => {
          const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
          });
          if (!result.canceled) {
            const dir = result.filePaths[0];
            const mediaFiles = scanDirectory(dir);
            // Send to renderer
            mainWindow?.webContents.send('local-files-found', mediaFiles);
            prompterWindow?.webContents.send('local-files-found', mediaFiles);
            stageWindow?.webContents.send('local-files-found', mediaFiles);
          }
        }
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Enter Operator Console',
        accelerator: 'CmdOrCtrl+1',
        click: () => {
          mainWindow?.focus();
          mainWindow?.show();
        }
      },
      {
        label: 'Enter Prompter View',
        accelerator: 'CmdOrCtrl+2', 
        click: () => {
          prompterWindow?.focus();
          prompterWindow?.show();
        }
      },
      {
        label: 'Enter Stage Visual',
        accelerator: 'CmdOrCtrl+3',
        click: () => {
          stageWindow?.focus();
          stageWindow?.show();
        }
      },
      { type: 'separator' },
      {
        label: 'Open Video Output',
        accelerator: 'CmdOrCtrl+4',
        click: () => {
          // Send message to stage window to Open Video Output
          stageWindow?.webContents.send('enable-video-output');
        }
      },
      { type: 'separator' },
      {
        label: 'Reset All Views',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          // Send message to renderer to reset views
          mainWindow?.webContents.send('reset-views');
          prompterWindow?.webContents.send('reset-views');
          stageWindow?.webContents.send('reset-views');
        }
      },
      { type: 'separator' },
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
    ]
  },
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' }
    ]
  }
];

app.whenReady().then(() => {
  // Set application menu
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
