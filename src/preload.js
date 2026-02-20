const { contextBridge, ipcRenderer } = require('electron');

// Exposer les API IPC au contexte window en toute sécurité
contextBridge.exposeInMainWorld('electron', {
  onAbout: (callback) => {
    ipcRenderer.on('show-about', callback);
  },
  removeAboutListener: () => {
    ipcRenderer.removeAllListeners('show-about');
  }
});
