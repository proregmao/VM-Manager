const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // SSH相关
  connectSSH: (options) => ipcRenderer.invoke('connect-ssh', options),
  execSSHCommand: (options) => ipcRenderer.invoke('exec-ssh-command', options),
  selectPrivateKey: () => ipcRenderer.invoke('select-private-key'),
  
  // 服务器配置相关
  saveServer: (server) => ipcRenderer.invoke('save-server', server),
  getServers: () => ipcRenderer.invoke('get-servers'),
  deleteServer: (serverId) => ipcRenderer.invoke('delete-server', serverId),
  
  // Cockpit API相关
  cockpitAPI: (options) => ipcRenderer.invoke('cockpit-api', options),
});
