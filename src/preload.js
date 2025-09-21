const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  saveFile: (content) => ipcRenderer.invoke('save-file-content', content),
  saveFileAs: (content, filePath) => ipcRenderer.invoke('save-file-as-content', { content, filePath }),
  loadVimrc: () => ipcRenderer.invoke('load-vimrc'),
  
  // Event listeners
  onNewFile: (callback) => ipcRenderer.on('new-file', callback),
  onFileOpened: (callback) => ipcRenderer.on('file-opened', callback),
  onSaveFile: (callback) => ipcRenderer.on('save-file', callback),
  onSaveFileAs: (callback) => ipcRenderer.on('save-file-as', callback),
  onToggleView: (callback) => ipcRenderer.on('toggle-view', callback),
  onToggleVim: (callback) => ipcRenderer.on('toggle-vim', callback),
  onReloadVimrc: (callback) => ipcRenderer.on('reload-vimrc', callback),
  onShowHelp: (callback) => ipcRenderer.on('show-help', callback),
  onUpdateTitle: (callback) => ipcRenderer.on('update-title', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
