const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  saveFile: (content) => ipcRenderer.invoke('save-file-content', content),
  saveFileAs: (content, filePath) => ipcRenderer.invoke('save-file-as-content', { content, filePath }),
  hasCurrentFile: () => ipcRenderer.invoke('has-current-file'),
  loadVimrc: () => ipcRenderer.invoke('load-vimrc'),

  // Auto-save and recovery
  autoSaveContent: (content) => ipcRenderer.invoke('auto-save-content', content),
  loadScratch: () => ipcRenderer.invoke('load-scratch'),
  clearScratch: () => ipcRenderer.invoke('clear-scratch'),
  markUnsavedChanges: (hasChanges) => ipcRenderer.invoke('mark-unsaved-changes', hasChanges),
  getRecoveryData: () => ipcRenderer.invoke('get-recovery-data'),
  fileSavedSuccessfully: () => ipcRenderer.send('file-saved-successfully'),

  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
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
  onSaveBeforeClose: (callback) => ipcRenderer.on('save-before-close', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
