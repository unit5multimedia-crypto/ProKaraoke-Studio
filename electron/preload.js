const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  onResetViews: (callback) => {
    ipcRenderer.on('reset-views', () => callback());
  },
  onEnableVideoOutput: (callback) => {
    ipcRenderer.on('enable-video-output', () => callback());
  },
  enterProjectionMode: () => {
    ipcRenderer.invoke('enter-projection-mode');
  },
  exitProjectionMode: () => {
    ipcRenderer.invoke('exit-projection-mode');
  },
  // Add more APIs as needed
});
