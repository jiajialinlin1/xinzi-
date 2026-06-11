const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xinziAPI', {
  hide: () => ipcRenderer.invoke('app:hide')
});
