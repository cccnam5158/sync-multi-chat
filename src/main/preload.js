const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendPrompt: (text, activeServices) => ipcRenderer.send('send-prompt', text, activeServices),
    toggleService: (service, isEnabled) => ipcRenderer.send('toggle-service', service, isEnabled),
    onServiceStatusUpdate: (callback) => ipcRenderer.on('service-status-update', (event, data) => callback(data)),
    externalLogin: (service) => ipcRenderer.send('external-login', service),
    newChat: () => ipcRenderer.send('new-chat')
});
