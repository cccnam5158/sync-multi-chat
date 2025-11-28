const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendPrompt: (text, activeServices) => ipcRenderer.send('send-prompt', text, activeServices),
    toggleService: (service, isEnabled) => ipcRenderer.send('toggle-service', service, isEnabled),
    onServiceStatusUpdate: (callback) => ipcRenderer.on('service-status-update', (event, data) => callback(data)),
    externalLogin: (service) => ipcRenderer.send('external-login', service),
    newChat: () => ipcRenderer.send('new-chat'),
    copyChatThread: () => ipcRenderer.send('copy-chat-thread'),
    onChatThreadCopied: (callback) => ipcRenderer.on('chat-thread-copied', () => callback()),
    crossCheck: () => ipcRenderer.send('cross-check'),
    toggleScrollSync: (isEnabled) => ipcRenderer.send('toggle-scroll-sync', isEnabled),
    setLayout: (layout) => ipcRenderer.send('set-layout', layout),
    updateViewBounds: (bounds) => ipcRenderer.send('update-view-bounds', bounds)
});
