const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron,
  isDesktop: true,
  startDesktopOAuth: (url) => ipcRenderer.invoke('start-desktop-oauth', url),
  openOAuthWindow: (url) => ipcRenderer.invoke('start-desktop-oauth', url),
});
