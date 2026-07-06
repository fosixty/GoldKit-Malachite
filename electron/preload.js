const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  getDefaultOutputDir: () => ipcRenderer.invoke('app:getDefaultOutputDir'),
  startDownload: (options) => ipcRenderer.invoke('download:start', options),
  cancelDownload: () => ipcRenderer.invoke('download:cancel'),
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  onLog: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:log', handler);
    return () => ipcRenderer.removeListener('download:log', handler);
  },
  onProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },
  onDone: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:done', handler);
    return () => ipcRenderer.removeListener('download:done', handler);
  },
  onError: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:error', handler);
    return () => ipcRenderer.removeListener('download:error', handler);
  },
});
