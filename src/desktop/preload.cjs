const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xinziAPI', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getClockState: () => ipcRenderer.invoke('clock:get-state'),
  openMainWindow: () => ipcRenderer.invoke('window:open-main'),
  showPopover: () => ipcRenderer.invoke('window:show-popover'),
  hidePopover: () => ipcRenderer.invoke('app:hide-popover'),
  onStateChange: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('clock:state', listener);

    return () => ipcRenderer.removeListener('clock:state', listener);
  }
});
