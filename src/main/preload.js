const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendPrompt: (text, activeServices, filePaths) => ipcRenderer.send('send-prompt', text, activeServices, filePaths),
    toggleService: (service, isEnabled) => ipcRenderer.send('toggle-service', service, isEnabled),
    onServiceStatusUpdate: (callback) => ipcRenderer.on('service-status-update', (event, data) => callback(data)),
    externalLogin: (service) => ipcRenderer.send('external-login', service),
    newChat: () => ipcRenderer.send('new-chat'),
    copyChatThread: () => ipcRenderer.send('copy-chat-thread'),
    onChatThreadCopied: (callback) => ipcRenderer.on('chat-thread-copied', () => callback()),
    crossCheck: (isAnonymousMode) => ipcRenderer.send('cross-check', isAnonymousMode),
    toggleScrollSync: (isEnabled) => ipcRenderer.send('toggle-scroll-sync', isEnabled),
    setLayout: (layout) => ipcRenderer.send('set-layout', layout),
    updateViewBounds: (bounds) => ipcRenderer.send('update-view-bounds', bounds),
    saveTempFile: (buffer, name) => ipcRenderer.invoke('save-temp-file', { buffer, name }),
    onFileUploadComplete: (callback) => ipcRenderer.on('file-upload-complete', () => callback()),
    confirmSend: () => ipcRenderer.send('confirm-send')
});
