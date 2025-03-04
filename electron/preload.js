const { contextBridge, ipcRenderer } = require('electron');

// Expose IPC methods to the renderer process
// Note: We need to provide these methods directly on window.api
contextBridge.exposeInMainWorld('api', {
  // User preferences
  getUserPreferences: async () => {
    return await ipcRenderer.invoke('get-user-preferences');
  },
  saveUserPreferences: async (preferences) => {
    return await ipcRenderer.invoke('save-user-preferences', preferences);
  },
  
  // Config
  getConfig: async () => {
    return await ipcRenderer.invoke('get-config');
  },
  saveConfig: async (config) => {
    return await ipcRenderer.invoke('save-config', config);
  },
  
  // Logs
  getLogs: async () => {
    return await ipcRenderer.invoke('get-logs');
  },
  
  // App control
  startAutomation: async (settings) => {
    return await ipcRenderer.invoke('start-automation', settings);
  },
  stopAutomation: async () => {
    return await ipcRenderer.invoke('stop-automation');
  },
  
  // Testing
  testProfile: async () => {
    return await ipcRenderer.invoke('test-profile');
  },
  
  // Events
  onLog: (callback) => {
    ipcRenderer.on('log', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('log', callback);
  },
  onProfileAnalyzed: (callback) => {
    ipcRenderer.on('profile-analyzed', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('profile-analyzed', callback);
  },
  onAnalysisStatus: (callback) => {
    ipcRenderer.on('analysis-status', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('analysis-status', callback);
  },
  onStatusChanged: (callback) => {
    ipcRenderer.on('status-changed', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('status-changed', callback);
  },
}); 