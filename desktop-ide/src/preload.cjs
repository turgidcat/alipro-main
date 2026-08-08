const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ide', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  getZoom: () => ipcRenderer.invoke('ide:zoom:get'),
  setZoom: (factor) => ipcRenderer.invoke('ide:zoom:set', factor),
  setAutoFit: (enabled) => ipcRenderer.invoke('ide:autofit:set', enabled),
  quit: () => {
    ipcRenderer.send('ide:quit');
  }
});
