const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xinziAPI', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getClockState: () => ipcRenderer.invoke('clock:get-state'),
  getUiState: () => ipcRenderer.invoke('ui:get-state'),
  toggleHiddenMetric: (key) => ipcRenderer.invoke('ui:toggle-hidden-metric', key),
  getFishState: () => ipcRenderer.invoke('fish:get-state'),
  startFishing: () => ipcRenderer.invoke('fish:start'),
  startFishingCountdown: (minutes) => ipcRenderer.invoke('fish:start-countdown', minutes),
  confirmFishingStop: () => ipcRenderer.invoke('fish:confirm-stop'),
  resumeFishing: () => ipcRenderer.invoke('fish:resume'),
  stopAndSaveFishing: () => ipcRenderer.invoke('fish:stop-and-save'),
  updateFishingMinutes: (minutes) => ipcRenderer.invoke('fish:update-default-minutes', minutes),
  getCalendarStatus: () => ipcRenderer.invoke('calendar:get-status'),
  requestCalendarAccess: () => ipcRenderer.invoke('calendar:request-access'),
  getCalendarDayOverrides: () => ipcRenderer.invoke('calendar:get-day-overrides'),
  openMainWindow: () => ipcRenderer.invoke('window:open-main'),
  showPopover: () => ipcRenderer.invoke('window:show-popover'),
  hidePopover: () => ipcRenderer.invoke('app:hide-popover'),
  onStateChange: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('clock:state', listener);

    return () => ipcRenderer.removeListener('clock:state', listener);
  }
});
