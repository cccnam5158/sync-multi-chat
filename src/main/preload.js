const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendPrompt: (text, activeServices, filePaths) => ipcRenderer.send('send-prompt', text, activeServices, filePaths),
    toggleService: (service, isEnabled) => ipcRenderer.send('toggle-service', service, isEnabled),
    onServiceStatusUpdate: (callback) => ipcRenderer.on('service-status-update', (event, data) => callback(data)),
    externalLogin: (service) => ipcRenderer.send('external-login', service),
    newChat: () => ipcRenderer.send('new-chat'),
    reloadService: (service) => ipcRenderer.send('reload-service', service),
    copyChatThread: (options) => ipcRenderer.send('copy-chat-thread', options),
    onChatThreadCopied: (callback) => ipcRenderer.on('chat-thread-copied', (event, data) => callback(data)),
    copySingleChatThread: (service, options) => ipcRenderer.send('copy-single-chat-thread', service, options),
    onSingleChatThreadCopied: (callback) => ipcRenderer.on('single-chat-thread-copied', (event, data) => callback(data)),
    copyLastResponse: (options) => ipcRenderer.send('copy-last-response', options),
    onLastResponseCopied: (callback) => ipcRenderer.on('last-response-copied', (event, data) => callback(data)),
    crossCheck: (isAnonymousMode, promptPrefix) => ipcRenderer.send('cross-check', isAnonymousMode, promptPrefix),
    toggleScrollSync: (isEnabled) => ipcRenderer.send('toggle-scroll-sync', isEnabled),
    setLayout: (layout) => ipcRenderer.send('set-layout', layout),
    updateViewBounds: (bounds) => ipcRenderer.send('update-view-bounds', bounds),
    saveTempFile: (buffer, name) => ipcRenderer.invoke('save-temp-file', { buffer, name }),
    onFileUploadComplete: (callback) => ipcRenderer.on('file-upload-complete', () => callback()),
    confirmSend: () => ipcRenderer.send('confirm-send'),
    setServiceVisibility: (isVisible) => ipcRenderer.send('set-service-visibility', isVisible)
});
