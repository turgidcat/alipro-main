const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('projectManager', {
  bootstrap: () => ipcRenderer.invoke('pm:bootstrap'), refresh: () => ipcRenderer.invoke('pm:refresh'), scan: () => ipcRenderer.invoke('pm:scan'),
  addProject: (path) => ipcRenderer.invoke('pm:add-project', path), chooseProject: () => ipcRenderer.invoke('pm:choose-project'), removeProject: (id) => ipcRenderer.invoke('pm:remove-project', id), toggleProject: (payload) => ipcRenderer.invoke('pm:toggle-project', payload),
  syncGitee: (project) => ipcRenderer.invoke('pm:gitee:sync', project), openExternal: (url) => ipcRenderer.invoke('pm:gitee:open', url), runGit: (payload) => ipcRenderer.invoke('pm:git:run', payload), isHighRisk: (operation) => ipcRenderer.invoke('pm:git:risk', operation), queue: () => ipcRenderer.invoke('pm:queue'), clearQueue: () => ipcRenderer.invoke('pm:queue:clear'), metrics: () => ipcRenderer.invoke('pm:metrics'),
  openPath: (path) => ipcRenderer.invoke('pm:open-path', path), openTerminal: (path) => ipcRenderer.invoke('pm:open-terminal', path),
  createTask: (task) => ipcRenderer.invoke('pm:task:create', task), updateTask: (task) => ipcRenderer.invoke('pm:task:update', task), deleteTask: (id) => ipcRenderer.invoke('pm:task:delete', id),
  saveSettings: (settings) => ipcRenderer.invoke('pm:settings', settings), logs: () => ipcRenderer.invoke('pm:logs'), metrics: () => ipcRenderer.invoke('pm:metrics'), notify: (payload) => ipcRenderer.invoke('pm:notify', payload), exportData: () => ipcRenderer.invoke('pm:export'), exportCsv: () => ipcRenderer.invoke('pm:export:csv'), exportZip: () => ipcRenderer.invoke('pm:export:zip'),
  onExportRequest: (callback) => ipcRenderer.on('pm:export-request', callback)
});
