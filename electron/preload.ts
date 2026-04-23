const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openProjector: (config: any) => ipcRenderer.send('open-projector', config),
  send: (channel: string, data: any) => {
    // whitelist channels
    let validChannels = ["toMain", "open-projector", "karaoke-sync-out"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel: string, func: (...args: any[]) => void) => {
    let validChannels = ["fromMain", "app-exit", "karaoke-sync-in"];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` 
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  removeListener: (channel: string, func: (...args: any[]) => void) => {
    let validChannels = ["fromMain", "app-exit", "karaoke-sync-in"];
    if (validChannels.includes(channel)) {
       ipcRenderer.removeListener(channel, func);
    }
  },
  exitApp: () => ipcRenderer.send('app-exit')
});
