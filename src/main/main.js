const { app, BrowserWindow, BrowserView, ipcMain, session, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Store = require('electron-store');

// Session persistence store (SESS-006)
const store = new Store();
const defaultSessionState = {
    serviceUrls: {}, // Current URLs for each service
    layout: '1x4',
    activeServices: ['chatgpt', 'claude', 'gemini', 'perplexity'],
    isAnonymousMode: false,
    isScrollSyncEnabled: false
};

let robot;
try {
    robot = require('robotjs');
} catch (e) {
    console.warn('robotjs not available:', e.message);
}

const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');

// Disable automation features to avoid detection
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process');
app.commandLine.appendSwitch('disable-site-isolation-trials');
// app.commandLine.appendSwitch('disable-infobars'); // Not always needed but good practice

// Fix for Google Sign-in "This browser or app may not be secure"
// We need to make sure we don't look like an automation tool.


let mainWindow;
const views = {};
const services = ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity'];
const serviceUrls = {
    chatgpt: 'https://chatgpt.com',
    claude: 'https://claude.ai',
    gemini: 'https://gemini.google.com/app',
    grok: 'https://grok.com',
    perplexity: 'https://www.perplexity.ai'
};

// Domain whitelist for each service (EXTLINK-002)
// URLs within these domains will stay in the webview, others open in external browser
const serviceDomains = {
    chatgpt: ['chatgpt.com', 'chat.openai.com', 'openai.com', 'auth0.com', 'auth.openai.com'],
    claude: ['claude.ai', 'anthropic.com'],
    gemini: ['gemini.google.com', 'google.com', 'accounts.google.com', 'gstatic.com'],
    grok: ['grok.com', 'x.com', 'twitter.com'],
    perplexity: ['perplexity.ai']
};

let currentLayout = '1x4'; // Default layout

let selectorsConfig = {};
let currentZoomLevel = 0.9; // Default zoom level

// Session state tracking (SESS)
let savedSessionUrls = {}; // URLs to load on startup
let isAnonymousMode = false; // Track anonymous mode for session save

// Load selectors
try {
    const configPath = path.join(__dirname, '../config/selectors.json');
    selectorsConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
    console.error('Failed to load selectors config:', err);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        show: false // Wait for ready-to-show
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Create BrowserViews only after main window is ready to avoid startup errors
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        services.forEach(service => {
            createServiceView(service);
        });
    });

    // Save session state when window is closed (catches Alt+F4, X button, etc.)
    mainWindow.on('close', () => {
        saveSessionState();
    });

    // Initial Layout is now handled by renderer sending bounds
}

function createServiceView(service) {
    // Cleanup existing view if it exists
    if (views[service] && views[service].view) {
        try {
            if (mainWindow) {
                mainWindow.removeBrowserView(views[service].view);
            }
            // Force destroy webContents to ensure cleanup
            if (!views[service].view.webContents.isDestroyed()) {
                // views[service].view.webContents.destroy(); // Optional, let GC handle it usually
            }
        } catch (e) {
            console.error(`Error cleaning up view for ${service}:`, e);
        }
    }

    const view = new BrowserView({
        webPreferences: {
            preload: path.join(__dirname, '../preload/service-preload.js'),
            partition: `persist:service-${service}`,
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.addBrowserView(view);

    // Use saved session URL if available, otherwise use default (SESS-003)
    const urlToLoad = savedSessionUrls[service] || serviceUrls[service];
    console.log(`[Session] Loading ${service} with URL: ${urlToLoad}`);
    view.webContents.loadURL(urlToLoad);

    // Modify headers for X-Frame-Options (SEC-001)
    view.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = Object.assign({}, details.responseHeaders);
        if (responseHeaders['x-frame-options'] || responseHeaders['X-Frame-Options']) {
            delete responseHeaders['x-frame-options'];
            delete responseHeaders['X-Frame-Options'];
        }
        if (responseHeaders['content-security-policy'] || responseHeaders['Content-Security-Policy']) {
            delete responseHeaders['content-security-policy'];
            delete responseHeaders['Content-Security-Policy'];
        }
        callback({ cancel: false, responseHeaders });
    });

    // User Agent Spoofing (SEC-002) - Updated to newer version
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    view.webContents.setUserAgent(userAgent);

    // Send config when page finishes loading
    view.webContents.on('did-finish-load', () => {

        view.webContents.setZoomFactor(currentZoomLevel);
        view.webContents.send('scroll-sync-state', isScrollSyncEnabled);

        if (selectorsConfig[service]) {
            view.webContents.send('set-config', { config: selectorsConfig[service], service });
        }

        // Defensive URL update: ensure URL bar shows current URL after page loads
        const currentUrl = view.webContents.getURL();
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('webview-url-changed', { service, url: currentUrl });
        }
    });

    // URL Bar: Track URL changes (URLBAR-003)
    const sendUrlUpdate = () => {
        const currentUrl = view.webContents.getURL();
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('webview-url-changed', { service, url: currentUrl });
        }
    };

    view.webContents.on('did-navigate', sendUrlUpdate);
    view.webContents.on('did-navigate-in-page', sendUrlUpdate);

    // Handle config request from preload (Handshake)
    ipcMain.on('request-config', (event) => {
        if (event.sender === view.webContents) {
            if (selectorsConfig[service]) {
                view.webContents.send('set-config', { config: selectorsConfig[service], service });
            }
        }
    });

    // External Link Handling (EXTLINK-001, EXTLINK-003)
    // Check if URL is within allowed domains for this service
    const isAllowedDomain = (url) => {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            const allowedDomains = serviceDomains[service] || [];
            return allowedDomains.some(domain =>
                hostname === domain || hostname.endsWith('.' + domain)
            );
        } catch (e) {
            return true; // If URL parsing fails, allow it
        }
    };

    // Intercept navigation to external domains (EXTLINK-003)
    view.webContents.on('will-navigate', (event, url) => {
        if (!isAllowedDomain(url)) {
            console.log(`[${service}] Blocking navigation to external URL: ${url}`);
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    // Handle new window requests (EXTLINK-004)
    view.webContents.setWindowOpenHandler(({ url }) => {
        if (!isAllowedDomain(url)) {
            console.log(`[${service}] Opening external URL in browser: ${url}`);
            shell.openExternal(url);
            return { action: 'deny' };
        }
        // Allow popup for auth flows within allowed domains
        return { action: 'allow' };
    });

    views[service] = { view, enabled: true };
}

// Layout Management
ipcMain.on('update-view-bounds', (event, boundsMap) => {
    if (!mainWindow) return;

    // Apply bounds to each service view
    Object.entries(boundsMap).forEach(([service, rect]) => {
        if (views[service] && views[service].view) {
            views[service].view.setBounds({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
            });
        }
    });
});

ipcMain.on('set-layout', (event, layout) => {
    currentLayout = layout;
    // We don't calculate layout here anymore, we wait for 'update-view-bounds' from renderer
});

// IPC Handlers
ipcMain.on('send-prompt', async (event, text, activeServices, filePaths = []) => {
    const serviceKeys = Object.keys(activeServices);
    const hasFiles = filePaths && filePaths.length > 0;

    // Process each service independently to prevent one failure from blocking others
    const promises = serviceKeys.map(async (service) => {
        if (activeServices[service] && views[service]) {
            try {
                const selectors = selectorsConfig[service];
                if (selectors) {
                    // Add a small delay for Perplexity if it's being problematic with high load
                    if (service === 'perplexity') {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    if (views[service].view && !views[service].view.webContents.isDestroyed()) {
                        const wc = views[service].view.webContents;

                        // 1. Handle File Uploads if present
                        if (filePaths && filePaths.length > 0 && selectors.fileInputSelector) {
                            try {
                                console.log(`Uploading files to ${service}...`);
                                // Attach debugger
                                try {
                                    wc.debugger.attach('1.3');
                                } catch (err) {
                                    console.log('Debugger already attached');
                                }

                                await wc.debugger.sendCommand('DOM.enable');
                                const { root } = await wc.debugger.sendCommand('DOM.getDocument');

                                // Find file input
                                let nodeId = null;

                                // Special handling for Gemini: Use JavaScript to find/access file input
                                // Avoid clicking menu button to prevent file dialog from opening
                                if (service === 'gemini' && selectors.uploadIconSelector) {
                                    console.log(`[Gemini] Searching for file input via JavaScript...`);
                                    try {
                                        // Try to find file input using JavaScript (can find hidden inputs too)
                                        const fileInputFound = await wc.executeJavaScript(`
                                            (function() {
                                                // Search for all file inputs, including hidden ones
                                                const inputs = document.querySelectorAll('input[type="file"]');
                                                if (inputs.length > 0) {
                                                    console.log('[Gemini JS] Found', inputs.length, 'file input(s)');
                                                    return true;
                                                }
                                                
                                                // Try to find within shadow DOM
                                                const allElements = document.querySelectorAll('*');
                                                for (const el of allElements) {
                                                    if (el.shadowRoot) {
                                                        const shadowInputs = el.shadowRoot.querySelectorAll('input[type="file"]');
                                                        if (shadowInputs.length > 0) {
                                                            console.log('[Gemini JS] Found', shadowInputs.length, 'file input(s) in shadow DOM');
                                                            return true;
                                                        }
                                                    }
                                                }
                                                
                                                return false;
                                            })()
                                        `);

                                        if (fileInputFound) {
                                            console.log(`[Gemini] File input found via JavaScript, proceeding without button clicks`);
                                        } else {
                                            console.log(`[Gemini] No file input found, attempting button clicks to create it...`);
                                            // Fallback: Click buttons to create file input
                                            if (selectors.uploadMenuButtonSelector) {
                                                try {
                                                    // Step 1: Click upload icon
                                                    let iconClicked = false;
                                                    for (const iconSel of selectors.uploadIconSelector) {
                                                        try {
                                                            const iconRes = await wc.debugger.sendCommand('DOM.querySelector', { nodeId: root.nodeId, selector: iconSel });
                                                            if (iconRes.nodeId) {
                                                                const box = await wc.debugger.sendCommand('DOM.getBoxModel', { nodeId: iconRes.nodeId });
                                                                if (box.model) {
                                                                    const x = (box.model.content[0] + box.model.content[2]) / 2;
                                                                    const y = (box.model.content[1] + box.model.content[5]) / 2;
                                                                    await wc.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
                                                                    await wc.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
                                                                    iconClicked = true;
                                                                    console.log(`[Gemini] Upload icon clicked`);
                                                                    await new Promise(resolve => setTimeout(resolve, 300));
                                                                    break;
                                                                }
                                                            }
                                                        } catch (e) { /* ignore */ }
                                                    }

                                                    // Step 2: Click menu button
                                                    if (iconClicked) {
                                                        for (const menuSel of selectors.uploadMenuButtonSelector) {
                                                            try {
                                                                const newRoot = await wc.debugger.sendCommand('DOM.getDocument');
                                                                const menuRes = await wc.debugger.sendCommand('DOM.querySelector', { nodeId: newRoot.root.nodeId, selector: menuSel });
                                                                if (menuRes.nodeId) {
                                                                    const box = await wc.debugger.sendCommand('DOM.getBoxModel', { nodeId: menuRes.nodeId });
                                                                    if (box.model) {
                                                                        const x = (box.model.content[0] + box.model.content[2]) / 2;
                                                                        const y = (box.model.content[1] + box.model.content[5]) / 2;
                                                                        await wc.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
                                                                        await wc.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
                                                                        console.log(`[Gemini] Menu button clicked, waiting for file input...`);
                                                                        await new Promise(resolve => setTimeout(resolve, 200));
                                                                        break;
                                                                    }
                                                                }
                                                            } catch (e) { /* ignore */ }
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.error(`[Gemini] Button click fallback failed:`, e);
                                                }
                                            }
                                        }
                                    } catch (e) {
                                        console.error(`[Gemini] JavaScript search failed:`, e);
                                    }
                                }

                                // Now search for file input (for all services, including Gemini after button clicks)
                                for (const selector of selectors.fileInputSelector) {
                                    try {
                                        // Get fresh DOM for Gemini
                                        const currentRoot = service === 'gemini' ?
                                            (await wc.debugger.sendCommand('DOM.getDocument')).root :
                                            root;

                                        const result = await wc.debugger.sendCommand('DOM.querySelector', {
                                            nodeId: currentRoot.nodeId,
                                            selector: selector
                                        });
                                        if (result.nodeId) {
                                            nodeId = result.nodeId;
                                            console.log(`Found file input for ${service} with selector: ${selector}`);
                                            break;
                                        }
                                    } catch (e) { /* ignore */ }
                                }

                                // Fallback 1: Search for all file inputs in the document
                                if (!nodeId) {
                                    try {
                                        // Get fresh DOM for Gemini
                                        const currentRoot = service === 'gemini' ?
                                            (await wc.debugger.sendCommand('DOM.getDocument')).root :
                                            root;

                                        const allInputs = await wc.debugger.sendCommand('DOM.querySelectorAll', {
                                            nodeId: currentRoot.nodeId,
                                            selector: 'input[type="file"]'
                                        });
                                        if (allInputs.nodeIds && allInputs.nodeIds.length > 0) {
                                            // Use the first file input found
                                            nodeId = allInputs.nodeIds[0];
                                            console.log(`Found file input for ${service} using fallback search (found ${allInputs.nodeIds.length} inputs)`);
                                        }
                                    } catch (e) {
                                        console.error(`Fallback file input search failed for ${service}:`, e);
                                    }
                                }

                                // Fallback 2: For Gemini specifically, try searching in shadow DOMs
                                if (!nodeId && service === 'gemini') {
                                    try {
                                        console.log(`[Gemini] Attempting shadow DOM search...`);
                                        const currentRoot = (await wc.debugger.sendCommand('DOM.getDocument')).root;
                                        // Get all elements
                                        const allElements = await wc.debugger.sendCommand('DOM.querySelectorAll', {
                                            nodeId: currentRoot.nodeId,
                                            selector: '*'
                                        });

                                        // Check each element for shadow root
                                        for (const elementNodeId of allElements.nodeIds.slice(0, 100)) { // Limit to first 100 elements
                                            try {
                                                // Request shadow root
                                                await wc.debugger.sendCommand('DOM.requestNode', { objectId: elementNodeId.toString() });
                                                const shadowRoot = await wc.debugger.sendCommand('DOM.describeNode', {
                                                    nodeId: elementNodeId
                                                });

                                                if (shadowRoot.node && shadowRoot.node.shadowRoots && shadowRoot.node.shadowRoots.length > 0) {
                                                    const shadowRootNodeId = shadowRoot.node.shadowRoots[0].nodeId;
                                                    // Try to find file input in this shadow root
                                                    const shadowInputs = await wc.debugger.sendCommand('DOM.querySelectorAll', {
                                                        nodeId: shadowRootNodeId,
                                                        selector: 'input[type="file"]'
                                                    });

                                                    if (shadowInputs.nodeIds && shadowInputs.nodeIds.length > 0) {
                                                        nodeId = shadowInputs.nodeIds[0];
                                                        console.log(`[Gemini] Found file input in shadow DOM!`);
                                                        break;
                                                    }
                                                }
                                            } catch (e) { /* ignore */ }
                                        }
                                    } catch (e) {
                                        console.error(`[Gemini] Shadow DOM search failed:`, e);
                                    }
                                }

                                // Special delay for Grok to avoid Cloudflare
                                if (service === 'grok' && nodeId) {
                                    console.log(`[Grok] File input found, adding Cloudflare avoidance delay...`);
                                    await new Promise(resolve => setTimeout(resolve, 5000));
                                    console.log(`[Grok] Delay completed, proceeding with file upload`);
                                }

                                if (nodeId) {
                                    await wc.debugger.sendCommand('DOM.setFileInputFiles', {
                                        files: filePaths,
                                        nodeId: nodeId
                                    });
                                    console.log(`Files uploaded to ${service}`);

                                    // Close file dialog for Gemini using system-level ESC key
                                    if (service === 'gemini' && robot) {
                                        console.log(`[Gemini] Sending ESC key to close file dialog...`);
                                        await new Promise(resolve => setTimeout(resolve, 200));

                                        try {
                                            robot.keyTap('escape');
                                            console.log(`[Gemini] ESC key sent`);
                                        } catch (e) {
                                            console.error(`[Gemini] Failed to send ESC key:`, e);
                                        }
                                    }

                                    // Verify file upload by checking for UI indicators
                                    if (selectors.uploadedFileSelector) {
                                        console.log(`[${service}] Verifying upload via UI indicators...`);
                                        let uploadConfirmed = false;
                                        const startTime = Date.now();
                                        const timeout = 5000; // 5 seconds timeout

                                        while (Date.now() - startTime < timeout) {
                                            try {
                                                // Check if any of the uploaded file selectors exist
                                                const checkScript = `
                                                    (function() {
                                                        const selectors = ${JSON.stringify(selectors.uploadedFileSelector)};
                                                        for (const sel of selectors) {
                                                            if (document.querySelector(sel)) return true;
                                                        }
                                                        return false;
                                                    })()
                                                `;
                                                const found = await wc.executeJavaScript(checkScript);
                                                if (found) {
                                                    uploadConfirmed = true;
                                                    console.log(`[${service}] File upload confirmed via UI indicator`);
                                                    break;
                                                }
                                            } catch (e) { /* ignore */ }
                                            await new Promise(resolve => setTimeout(resolve, 500));
                                        }

                                        if (!uploadConfirmed) {
                                            console.warn(`[${service}] Upload UI indicator not found within timeout, proceeding anyway...`);
                                        }
                                    }

                                    // Wait longer for upload to process
                                    const uploadDelay = service === 'grok' ? 4000 : 2000; // Extra time for Grok
                                    await new Promise(resolve => setTimeout(resolve, uploadDelay));

                                    // Wait for send button to be enabled (check up to 5 times)
                                    for (let i = 0; i < 5; i++) {
                                        try {
                                            let sendBtnEnabled = false;
                                            for (const btnSelector of selectors.sendButtonSelector) {
                                                const btnResult = await wc.debugger.sendCommand('DOM.querySelector', {
                                                    nodeId: root.nodeId,
                                                    selector: btnSelector
                                                });
                                                if (btnResult.nodeId) {
                                                    const attrs = await wc.debugger.sendCommand('DOM.getAttributes', {
                                                        nodeId: btnResult.nodeId
                                                    });
                                                    // Check if button is not disabled
                                                    if (!attrs.attributes.includes('disabled')) {
                                                        sendBtnEnabled = true;
                                                        console.log(`Send button enabled for ${service}`);
                                                        break;
                                                    }
                                                }
                                            }
                                            if (sendBtnEnabled) break;
                                        } catch (e) { /* ignore */ }
                                        await new Promise(resolve => setTimeout(resolve, 500));
                                    }
                                } else {
                                    console.warn(`File input not found for ${service}`);
                                }

                                wc.debugger.detach();
                            } catch (uploadErr) {
                                console.error(`Error uploading files to ${service}:`, uploadErr);
                                try { wc.debugger.detach(); } catch (e) { }
                            }
                        }

                        // 2. Inject Prompt
                        wc.send('inject-prompt', { text, selectors, autoSend: !hasFiles });
                        console.log(`Sent prompt to ${service}`);
                    }
                }
            } catch (error) {
                console.error(`Failed to send prompt to ${service}:`, error);
            }
        }
    });

    await Promise.all(promises);

    if (hasFiles) {
        event.sender.send('file-upload-complete');
    }
});

ipcMain.on('confirm-send', (event) => {
    console.log('Received confirm-send event');
    // Iterate over all active views and trigger send button click
    Object.keys(views).forEach(service => {
        if (views[service] && views[service].view && !views[service].view.webContents.isDestroyed()) {
            const selectors = selectorsConfig[service];
            if (selectors) {
                views[service].view.webContents.send('click-send-button', { selectors });
                console.log(`Sent click-send-button to ${service}`);
            }
        }
    });
});

ipcMain.handle('save-temp-file', async (event, { buffer, name }) => {
    try {
        const tempDir = os.tmpdir();
        const filePath = path.join(tempDir, name);
        await fs.promises.writeFile(filePath, Buffer.from(buffer));
        return filePath;
    } catch (error) {
        console.error('Error saving temp file:', error);
        throw error;
    }
});

ipcMain.on('toggle-service', (event, service, isEnabled) => {
    if (isEnabled) {
        const viewObj = views[service];
        // Check if view is valid
        let isValid = viewObj && viewObj.view;
        if (isValid) {
            try {
                if (viewObj.view.webContents.isDestroyed() || viewObj.view.webContents.isCrashed()) {
                    isValid = false;
                }
            } catch (e) {
                isValid = false;
            }
        }

        if (!isValid) {
            console.log(`Recreating view for ${service} (Toggle ON)`);
            createServiceView(service);
            // createServiceView adds it and sets enabled=true
        } else {
            // Just enable existing
            if (!viewObj.enabled) {
                viewObj.enabled = true;
                mainWindow.addBrowserView(viewObj.view);
            }
        }
    } else {
        // Disable
        if (views[service]) {
            views[service].enabled = false;
            if (views[service].view) {
                try {
                    mainWindow.removeBrowserView(views[service].view);
                } catch (e) { /* ignore */ }
            }
        }
    }
    // Layout update will be triggered by renderer via toggle change -> updateLayoutState -> renderLayout -> updateBounds
});

// Request current URLs for all services (URLBAR - for layout/toggle changes)
ipcMain.on('request-current-urls', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    services.forEach(service => {
        if (views[service] && views[service].view && !views[service].view.webContents.isDestroyed()) {
            const currentUrl = views[service].view.webContents.getURL();
            if (currentUrl) {
                mainWindow.webContents.send('webview-url-changed', { service, url: currentUrl });
            }
        }
    });
});

ipcMain.on('new-chat', () => {
    services.forEach(service => {
        if (views[service] && views[service].enabled) {
            let url = serviceUrls[service];
            if (service === 'claude') {
                url = 'https://claude.ai/new';
            }
            // ChatGPT and Gemini use base URL which usually redirects to new chat
            // For ChatGPT, https://chatgpt.com/ is correct.
            // For Gemini, https://gemini.google.com/app is correct.

            console.log(`Resetting chat for ${service} to ${url}`);
            views[service].view.webContents.loadURL(url);
        }
    });
});

ipcMain.on('reload-service', (event, service) => {
    if (views[service] && views[service].enabled) {
        console.log(`Reloading ${service}`);
        views[service].view.webContents.reload();
    }
});

// Open URL in external browser (URLBAR-005)
ipcMain.on('open-url-in-chrome', (event, url) => {
    if (url) {
        console.log(`Opening URL in external browser: ${url}`);
        shell.openExternal(url);
    }
});

// Helper to extract FULL conversation thread from a service (for Copy Chat Thread)
async function extractContentFromService(service, options = {}) {
    if (!views[service] || !views[service].enabled) return null;

    const config = selectorsConfig[service];
    if (!config) return null;

    let content = null;
    let method = 'none';
    const wc = views[service].view.webContents;

    try {
        // Service-specific extraction scripts based on reference exporters
        let script;

        if (service === 'chatgpt') {
            // ChatGPT: Use article[data-testid^="conversation-turn-"] with h5.sr-only (user) and h6.sr-only (AI)
            script = `
                (function() {
                    const turns = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
                    if (turns.length === 0) return null;
                    
                    let markdown = '';
                    turns.forEach((turn, i) => {
                        // User message
                        const userHeading = turn.querySelector('h5.sr-only');
                        if (userHeading) {
                            const userDiv = userHeading.nextElementSibling;
                            if (userDiv) {
                                const userQuery = userDiv.innerText.trim();
                                if (userQuery) {
                                    markdown += '## 👤 User\\n\\n' + userQuery + '\\n\\n';
                                }
                            }
                        }
                        
                        // AI message
                        const modelHeading = turn.querySelector('h6.sr-only');
                        if (modelHeading) {
                            const modelDiv = turn.querySelector('.markdown');
                            if (modelDiv) {
                                markdown += '## 🤖 ChatGPT\\n\\n' + modelDiv.innerHTML + '\\n\\n';
                            }
                        }
                        
                        markdown += '---\\n\\n';
                    });
                    return markdown;
                })();
            `;
        } else if (service === 'claude') {
            // Claude: Use actual DOM selectors from user-provided HTML
            // User messages: [data-testid="user-message"] with .whitespace-pre-wrap
            // AI responses: [data-is-streaming] with .standard-markdown
            script = `
                (function() {
                    let markdown = '';
                    
                    // Get all user messages - look for the actual message content
                    const userMessages = document.querySelectorAll('[data-testid="user-message"]');
                    // Get all AI responses - look for streaming containers
                    const aiResponses = document.querySelectorAll('[data-is-streaming]');
                    
                    // Debug: log what we found
                    console.log('Claude extraction - userMessages:', userMessages.length, 'aiResponses:', aiResponses.length);
                    
                    if (userMessages.length === 0 && aiResponses.length === 0) {
                        // Fallback: try to find messages in the main content area
                        // Look for the conversation container (not sidebar)
                        const mainArea = document.querySelector('.flex-1.flex.flex-col');
                        if (mainArea) {
                            // Find user bubbles (bg-bg-300 rounded-xl)
                            const userBubbles = mainArea.querySelectorAll('div.bg-bg-300.rounded-xl .whitespace-pre-wrap');
                            // Find AI responses (font-claude-response)
                            const aiBlocks = mainArea.querySelectorAll('.font-claude-response .standard-markdown');
                            
                            console.log('Claude fallback - userBubbles:', userBubbles.length, 'aiBlocks:', aiBlocks.length);
                            
                            if (userBubbles.length > 0 || aiBlocks.length > 0) {
                                const allTurns = [];
                                
                                userBubbles.forEach(el => {
                                    const rect = el.getBoundingClientRect();
                                    allTurns.push({ type: 'user', content: el.innerText.trim(), top: rect.top });
                                });
                                
                                aiBlocks.forEach(el => {
                                    const rect = el.getBoundingClientRect();
                                    allTurns.push({ type: 'ai', content: el.innerHTML, top: rect.top });
                                });
                                
                                allTurns.sort((a, b) => a.top - b.top);
                                
                                allTurns.forEach(turn => {
                                    if (turn.type === 'user') {
                                        markdown += '## 👤 User\\n\\n' + turn.content + '\\n\\n---\\n\\n';
                                    } else {
                                        markdown += '## 🤖 Claude\\n\\n' + turn.content + '\\n\\n---\\n\\n';
                                    }
                                });
                                
                                return markdown || null;
                            }
                        }
                        return null;
                    }
                    
                    // Collect all messages with their positions
                    const allTurns = [];
                    
                    userMessages.forEach(el => {
                        const rect = el.getBoundingClientRect();
                        const textEl = el.querySelector('.whitespace-pre-wrap') || el;
                        allTurns.push({ 
                            type: 'user', 
                            content: textEl.innerText.trim(), 
                            top: rect.top 
                        });
                    });
                    
                    aiResponses.forEach(el => {
                        const rect = el.getBoundingClientRect();
                        // Get ALL markdown content sections from the response
                        // Claude responses can have multiple .standard-markdown sections plus artifact blocks
                        const container = el.closest('.font-claude-response') || el;
                        
                        // Collect all standard-markdown sections
                        const markdownSections = container.querySelectorAll('.standard-markdown');
                        
                        // Collect artifact block descriptions
                        const artifactBlocks = container.querySelectorAll('.artifact-block-cell, [class*="artifact"]');
                        
                        let combinedContent = '';
                        
                        // Add all markdown sections
                        if (markdownSections.length > 0) {
                            markdownSections.forEach(section => {
                                combinedContent += section.innerHTML + '\\n\\n';
                            });
                        } else {
                            // Fallback to font-claude-response or direct content
                            const fallbackEl = el.querySelector('.font-claude-response') || el;
                            combinedContent = fallbackEl.innerHTML;
                        }
                        
                        // Add artifact information if present
                        artifactBlocks.forEach(artifact => {
                            const title = artifact.querySelector('.line-clamp-1, [class*="title"]');
                            const type = artifact.querySelector('.text-text-400, [class*="type"]');
                            if (title) {
                                combinedContent += '\\n\\n**[Artifact: ' + (title.textContent || 'Untitled').trim() + ']**';
                                if (type) {
                                    combinedContent += ' (' + type.textContent.trim() + ')';
                                }
                            }
                        });
                        
                        allTurns.push({ 
                            type: 'ai', 
                            content: combinedContent.trim(), 
                            top: rect.top 
                        });
                    });
                    
                    // Sort by vertical position to maintain conversation order
                    allTurns.sort((a, b) => a.top - b.top);
                    
                    allTurns.forEach(turn => {
                        if (turn.type === 'user') {
                            markdown += '## 👤 User\\n\\n' + turn.content + '\\n\\n---\\n\\n';
                        } else {
                            markdown += '## 🤖 Claude\\n\\n' + turn.content + '\\n\\n---\\n\\n';
                        }
                    });
                    
                    return markdown || null;
                })();
            `;
        } else if (service === 'gemini') {
            // Gemini: Use user-query and model-response custom tags (from reference)
            script = `
                (function() {
                    const turns = document.querySelectorAll('user-query, model-response');
                    if (turns.length === 0) return null;
                    
                    let markdown = '';
                    turns.forEach(turn => {
                        if (turn.tagName.toLowerCase() === 'user-query') {
                            const queryText = turn.querySelector('.query-text');
                            if (queryText) {
                                markdown += '## 👤 User\\n\\n' + queryText.innerText.trim() + '\\n\\n---\\n\\n';
                            }
                        } else if (turn.tagName.toLowerCase() === 'model-response') {
                            const responseEl = turn.querySelector('.markdown');
                            if (responseEl) {
                                markdown += '## 🤖 Gemini\\n\\n' + responseEl.innerHTML + '\\n\\n---\\n\\n';
                            }
                        }
                    });
                    return markdown || null;
                })();
            `;
        } else if (service === 'perplexity') {
            // Perplexity: Look for question and answer blocks
            script = `
                (function() {
                    // Try to find conversation turns
                    const container = document.querySelector('main');
                    if (!container) return null;
                    
                    // Perplexity uses various class patterns for questions and answers
                    const questions = container.querySelectorAll('[class*="query"], [class*="question"], .text-base.font-medium');
                    const answers = container.querySelectorAll('.prose, [class*="answer"], [class*="response"]');
                    
                    const allItems = [];
                    
                    questions.forEach(el => {
                        const rect = el.getBoundingClientRect();
                        if (el.innerText.trim().length > 0) {
                            allItems.push({ type: 'user', el, top: rect.top, content: el.innerText.trim() });
                        }
                    });
                    
                    answers.forEach(el => {
                        const rect = el.getBoundingClientRect();
                        if (el.innerHTML.trim().length > 0) {
                            allItems.push({ type: 'ai', el, top: rect.top, content: el.innerHTML });
                        }
                    });
                    
                    allItems.sort((a, b) => a.top - b.top);
                    
                    // Dedupe consecutive same-type items
                    let markdown = '';
                    let lastType = null;
                    allItems.forEach(item => {
                        if (item.type !== lastType) {
                            if (item.type === 'user') {
                                markdown += '## 👤 User\\n\\n' + item.content + '\\n\\n---\\n\\n';
                            } else {
                                markdown += '## 🤖 Perplexity\\n\\n' + item.content + '\\n\\n---\\n\\n';
                            }
                            lastType = item.type;
                        }
                    });
                    
                    return markdown || null;
                })();
            `;
        } else if (service === 'grok') {
            // Grok: User messages have items-end class, AI responses have items-start class
            // Container: div[id^="response-"] with .message-bubble containing content
            script = `
                (function() {
                    let markdown = '';
                    
                    // Find all response containers
                    const responseContainers = document.querySelectorAll('div[id^="response-"]');
                    
                    if (responseContainers.length === 0) return null;
                    
                    const allTurns = [];
                    
                    responseContainers.forEach(container => {
                        const rect = container.getBoundingClientRect();
                        const messageBubble = container.querySelector('.message-bubble');
                        if (!messageBubble) return;
                        
                        const contentEl = messageBubble.querySelector('.response-content-markdown') || messageBubble;
                        const content = contentEl.innerHTML;
                        
                        // Check if this is a user message (items-end) or AI response (items-start)
                        const isUser = container.classList.contains('items-end');
                        
                        if (content.trim()) {
                            allTurns.push({
                                type: isUser ? 'user' : 'ai',
                                content: isUser ? contentEl.innerText.trim() : content,
                                top: rect.top
                            });
                        }
                    });
                    
                    // Sort by position
                    allTurns.sort((a, b) => a.top - b.top);
                    
                    allTurns.forEach(turn => {
                        if (turn.type === 'user') {
                            markdown += '## \ud83d\udc64 User\\n\\n' + turn.content + '\\n\\n---\\n\\n';
                        } else {
                            markdown += '## \ud83e\udd16 Grok\\n\\n' + turn.content + '\\n\\n---\\n\\n';
                        }
                    });
                    
                    return markdown || null;
                })();
            `;
        }

        const rawContent = await wc.executeJavaScript(script);

        if (rawContent) {
            // The service-specific scripts return pre-formatted markdown with HTML in AI responses
            // We need to convert only the HTML parts to markdown, not the entire structure
            const turndownService = new TurndownService({
                headingStyle: 'atx',
                codeBlockStyle: 'fenced'
            });
            turndownService.use(gfm);

            // Remove noise elements
            turndownService.remove('button');
            turndownService.remove('style');
            turndownService.remove('script');
            turndownService.remove('nav');
            turndownService.remove('aside');
            turndownService.remove('svg');

            // Add rule to remove specific noise patterns
            turndownService.addRule('removeNoisePatterns', {
                filter: function (node) {
                    if (node.nodeName === 'SPAN' || node.nodeName === 'DIV') {
                        const text = node.innerText ? node.innerText.trim() : '';
                        const noisePatterns = [
                            'Copy code', '코드 복사', 'Copy', 'Copied!',
                            'python', 'javascript', 'typescript', 'html', 'css', 'bash', 'sql', 'json'
                        ];
                        if (noisePatterns.includes(text) && node.childNodes.length <= 1) {
                            return true;
                        }
                    }
                    return false;
                },
                replacement: function () {
                    return '';
                }
            });

            // Process each section: convert HTML content while preserving markdown headers
            // The rawContent has structure like: ## 👤 User\n\ntext\n\n---\n\n## 🤖 Service\n\n<html>\n\n---
            // We need to convert only the <html> parts
            const sections = rawContent.split(/(?=## [👤🤖])/);
            let processedContent = '';

            for (const section of sections) {
                if (!section.trim()) continue;

                // Check if this section contains HTML (AI responses have innerHTML)
                if (section.includes('<') && section.includes('>')) {
                    // Find the header part and content part
                    const headerMatch = section.match(/^(## [🤖👤][^\n]+\n\n)/);
                    if (headerMatch) {
                        const header = headerMatch[1];
                        let htmlContent = section.substring(header.length);

                        // Remove the trailing ---\n\n if present
                        const separatorIndex = htmlContent.lastIndexOf('---');
                        let separator = '';
                        if (separatorIndex !== -1) {
                            separator = htmlContent.substring(separatorIndex);
                            htmlContent = htmlContent.substring(0, separatorIndex);
                        }

                        // Convert HTML to markdown
                        const converted = turndownService.turndown(htmlContent.trim());
                        processedContent += header + converted + '\n\n' + separator;
                    } else {
                        // No header found, just convert the whole section
                        processedContent += turndownService.turndown(section);
                    }
                } else {
                    // No HTML, keep as-is (user messages with plain text)
                    processedContent += section;
                }
            }

            content = processedContent || rawContent;
            method = 'service-specific';
        }
    } catch (e) {
        console.warn(`Service-specific extraction failed for ${service}:`, e);
    }

    // Fallback: Try to get the main content area
    if (!content) {
        try {
            const containerSelectors = config.conversationContainerSelector || config.contentSelector || [];
            const script = `
                (function() {
                    const selectors = ${JSON.stringify(containerSelectors)};
                    for (const selector of selectors) {
                        const el = document.querySelector(selector);
                        if (el) {
                            return el.innerHTML;
                        }
                    }
                    return null;
                })();
            `;

            const html = await wc.executeJavaScript(script);

            if (html) {
                const turndownService = new TurndownService({
                    headingStyle: 'atx',
                    codeBlockStyle: 'fenced'
                });
                turndownService.use(gfm);
                turndownService.remove('button');
                turndownService.remove('style');
                turndownService.remove('script');
                turndownService.remove('nav');
                turndownService.remove('aside');

                content = turndownService.turndown(html);
                method = 'fallback';
            }
        } catch (e) {
            console.warn(`Fallback extraction failed for ${service}:`, e);
        }
    }

    // Final fallback: innerText
    if (!content) {
        try {
            const contentSelectors = config.contentSelector || [];
            const script = `
                (function() {
                    const selectors = ${JSON.stringify(contentSelectors)};
                    for (const selector of selectors) {
                        const el = document.querySelector(selector);
                        if (el) {
                            return el.innerText;
                        }
                    }
                    return document.body.innerText;
                })();
            `;

            content = await Promise.race([
                wc.executeJavaScript(script),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]);
            method = 'text';
        } catch (e) {
            console.error(`Error extracting text from ${service}:`, e);
            content = `[Error extracting content: ${e.message}]`;
            method = 'error';
        }
    }

    return { service, content, method };
}

// Helper to extract ONLY the last AI response from a service (for Cross Check)
async function extractLastResponseFromService(service, options = {}) {
    if (!views[service] || !views[service].enabled) return null;

    const config = selectorsConfig[service];
    if (!config) return null;

    let content = null;
    let method = 'none';
    const wc = views[service].view.webContents;

    // Try lastResponseSelector first
    const lastResponseSelectors = config.lastResponseSelector || [];

    if (lastResponseSelectors.length > 0) {
        try {
            const script = `
                (function() {
                    const selectors = ${JSON.stringify(lastResponseSelectors)};
                    for (const selector of selectors) {
                        // Use querySelectorAll and get the last match
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            const lastEl = elements[elements.length - 1];
                            return lastEl.innerHTML;
                        }
                    }
                    return null;
                })();
            `;

            const html = await wc.executeJavaScript(script);

            if (html) {
                const turndownService = new TurndownService({
                    headingStyle: 'atx',
                    codeBlockStyle: 'fenced'
                });
                turndownService.use(gfm);

                // Remove noise elements
                turndownService.remove('button');
                turndownService.remove('style');
                turndownService.remove('script');
                turndownService.remove('nav');
                turndownService.remove('aside');

                // Add rule to remove specific noise patterns
                turndownService.addRule('removeNoisePatterns', {
                    filter: function (node) {
                        if (node.nodeName === 'SPAN' || node.nodeName === 'DIV') {
                            const text = node.innerText ? node.innerText.trim() : '';
                            const noisePatterns = [
                                'Copy code', '코드 복사', 'Copy', 'Copied!',
                                'python', 'javascript', 'typescript', 'html', 'css', 'bash', 'sql', 'json'
                            ];
                            if (noisePatterns.includes(text) && node.childNodes.length <= 1) {
                                return true;
                            }
                        }
                        return false;
                    },
                    replacement: function () {
                        return '';
                    }
                });

                content = turndownService.turndown(html);
                method = 'lastResponse';
            }
        } catch (e) {
            console.warn(`Last response extraction failed for ${service}:`, e);
        }
    }

    // Fallback: use markdownContainerSelector and get last message
    if (!content && config.markdownContainerSelector && config.markdownContainerSelector.length > 0) {
        try {
            const script = `
                (function() {
                    const selectors = ${JSON.stringify(config.markdownContainerSelector)};
                    for (const selector of selectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            const lastEl = elements[elements.length - 1];
                            return lastEl.innerHTML;
                        }
                    }
                    return null;
                })();
            `;

            const html = await wc.executeJavaScript(script);

            if (html) {
                const turndownService = new TurndownService({
                    headingStyle: 'atx',
                    codeBlockStyle: 'fenced'
                });
                turndownService.use(gfm);
                turndownService.remove('button');
                turndownService.remove('style');
                turndownService.remove('script');

                content = turndownService.turndown(html);
                method = 'turndown-fallback';
            }
        } catch (e) {
            console.warn(`Fallback extraction failed for ${service}:`, e);
        }
    }

    // Final fallback: innerText of last response-like element
    if (!content) {
        try {
            const script = `
                (function() {
                    // Try common patterns for AI responses
                    const patterns = [
                        '[data-message-author-role="assistant"]',
                        '.assistant',
                        '[class*="response"]',
                        '[class*="answer"]',
                        '.prose'
                    ];
                    for (const pattern of patterns) {
                        const elements = document.querySelectorAll(pattern);
                        if (elements.length > 0) {
                            return elements[elements.length - 1].innerText;
                        }
                    }
                    return null;
                })();
            `;

            content = await Promise.race([
                wc.executeJavaScript(script),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]);
            method = 'text-fallback';
        } catch (e) {
            console.error(`Error extracting last response from ${service}:`, e);
            content = null;
            method = 'error';
        }
    }

    return { service, content, method };
}

ipcMain.on('copy-chat-thread', async (event, options = {}) => {
    const { format = 'markdown', anonymousMode = false } = options;

    // Get all enabled services
    const enabledServices = services.filter(service => views[service] && views[service].enabled);

    // Process all services in parallel (no more native copy, so no clipboard race conditions)
    const promises = enabledServices.map(service => extractContentFromService(service, { format }));
    const results = await Promise.all(promises);

    // Format and combine
    let finalOutput = '';
    const aliases = {
        'chatgpt': 'Service A',
        'claude': 'Service B',
        'gemini': 'Service C',
        'grok': 'Service D',
        'perplexity': 'Service E'
    };

    // Sort results by service order
    results.sort((a, b) => services.indexOf(a.service) - services.indexOf(b.service));

    if (format === 'json') {
        const jsonOutput = results.map(r => ({
            service: anonymousMode ? (aliases[r.service] || r.service) : r.service,
            content: r.content,
            method: r.method,
            timestamp: new Date().toISOString()
        }));
        finalOutput = JSON.stringify(jsonOutput, null, 2);
    } else {
        // Markdown or Text
        results.forEach(result => {
            if (result && result.content) {
                let serviceName = result.service.charAt(0).toUpperCase() + result.service.slice(1);
                let content = result.content;

                if (anonymousMode) {
                    serviceName = aliases[result.service] || serviceName;
                    // Simple anonymization of content (can be improved)
                    Object.keys(aliases).forEach(key => {
                        const regex = new RegExp(key, 'gi');
                        content = content.replace(regex, aliases[key]);
                    });
                }

                if (format === 'markdown') {
                    finalOutput += `# ${serviceName}\n\n${content}\n\n---\n\n`;
                } else {
                    finalOutput += `=== ${serviceName.toUpperCase()} ===\n${content}\n\n${'-'.repeat(40)}\n\n`;
                }
            } else {
                errors.push(result.service);
            }
        });
    }

    if (finalOutput) {
        clipboard.writeText(finalOutput);
        console.log('Chat threads copied to clipboard');

        // Granular feedback
        const successServices = results.filter(r => r.content).map(r => r.service);
        const failedServices = results.filter(r => !r.content).map(r => r.service);

        if (mainWindow) {
            mainWindow.webContents.send('chat-thread-copied', {
                success: successServices,
                failed: failedServices,
                format
            });
        }
    }
});

// Copy single service chat thread
ipcMain.on('copy-single-chat-thread', async (event, service, options = {}) => {
    const { format = 'markdown', anonymousMode = false } = options;

    if (!views[service] || !views[service].enabled) {
        if (mainWindow) {
            mainWindow.webContents.send('single-chat-thread-copied', { service, success: false });
        }
        return;
    }

    const result = await extractContentFromService(service, { format });

    if (result && result.content) {
        const aliases = {
            'chatgpt': 'Service A',
            'claude': 'Service B',
            'gemini': 'Service C',
            'grok': 'Service D',
            'perplexity': 'Service E'
        };

        let finalOutput = '';
        let serviceName = service.charAt(0).toUpperCase() + service.slice(1);
        let content = result.content;

        if (anonymousMode) {
            serviceName = aliases[service] || serviceName;
            Object.keys(aliases).forEach(key => {
                const regex = new RegExp(key, 'gi');
                content = content.replace(regex, aliases[key]);
            });
        }

        if (format === 'json') {
            finalOutput = JSON.stringify({
                service: anonymousMode ? aliases[service] : service,
                content: content,
                method: result.method,
                timestamp: new Date().toISOString()
            }, null, 2);
        } else if (format === 'markdown') {
            finalOutput = `# ${serviceName}\n\n${content}`;
        } else {
            finalOutput = `=== ${serviceName.toUpperCase()} ===\n${content}`;
        }

        clipboard.writeText(finalOutput);
        console.log(`Single chat thread copied from ${service}`);

        if (mainWindow) {
            mainWindow.webContents.send('single-chat-thread-copied', { service, success: true, format });
        }
    } else {
        if (mainWindow) {
            mainWindow.webContents.send('single-chat-thread-copied', { service, success: false });
        }
    }
});

// Copy last response from ALL active services
ipcMain.on('copy-last-response', async (event, options = {}) => {
    const { format = 'markdown', anonymousMode = false } = options;

    const enabledServices = services.filter(service => views[service] && views[service].enabled);
    const promises = enabledServices.map(service => extractLastResponseFromService(service, {}));
    const results = await Promise.all(promises);

    const aliases = {
        'chatgpt': 'Service A',
        'claude': 'Service B',
        'gemini': 'Service C',
        'grok': 'Service D',
        'perplexity': 'Service E'
    };

    results.sort((a, b) => services.indexOf(a.service) - services.indexOf(b.service));

    let finalOutput = '';

    if (format === 'json') {
        const jsonOutput = results.filter(r => r && r.content).map(r => ({
            service: anonymousMode ? (aliases[r.service] || r.service) : r.service,
            content: r.content,
            method: r.method,
            timestamp: new Date().toISOString()
        }));
        finalOutput = JSON.stringify(jsonOutput, null, 2);
    } else {
        results.forEach(result => {
            if (result && result.content) {
                let serviceName = result.service.charAt(0).toUpperCase() + result.service.slice(1);
                let content = result.content;

                if (anonymousMode) {
                    serviceName = aliases[result.service] || serviceName;
                    Object.keys(aliases).forEach(key => {
                        const regex = new RegExp(key, 'gi');
                        content = content.replace(regex, aliases[key]);
                    });
                }

                if (format === 'markdown') {
                    finalOutput += `# ${serviceName}\n\n${content}\n\n---\n\n`;
                } else {
                    finalOutput += `=== ${serviceName.toUpperCase()} ===\n${content}\n\n${'-'.repeat(40)}\n\n`;
                }
            }
        });
    }

    if (finalOutput) {
        clipboard.writeText(finalOutput);
        console.log('Last responses copied to clipboard');

        const successServices = results.filter(r => r && r.content).map(r => r.service);
        const failedServices = results.filter(r => !r || !r.content).map(r => r ? r.service : 'unknown');

        if (mainWindow) {
            mainWindow.webContents.send('last-response-copied', {
                success: successServices,
                failed: failedServices,
                format
            });
        }
    }
});

ipcMain.on('cross-check', async (event, isAnonymousMode, promptPrefix) => {
    console.log('Starting Cross Check... Anonymous:', isAnonymousMode, 'Prefix:', promptPrefix ? 'Yes' : 'No');

    const aliases = {
        'chatgpt': '(A)',
        'claude': '(B)',
        'gemini': '(C)',
        'grok': '(D)',
        'perplexity': '(E)'
    };

    // 1. Extract LAST RESPONSE ONLY from each service
    const results = {};
    for (const service of services) {
        if (views[service] && views[service].enabled) {
            const result = await extractLastResponseFromService(service, {});
            if (result && result.content) {
                results[service] = result.content;
                console.log(`Cross Check: Extracted last response from ${service} (method: ${result.method})`);
            }
        }
    }

    // 2. Construct prompts and send
    for (const targetService of services) {
        if (views[targetService] && views[targetService].enabled) {
            let prompt = "";

            // Add Prefix if exists
            if (promptPrefix) {
                prompt += `${promptPrefix}\n\n`;
            }

            for (const sourceService of services) {
                if (sourceService !== targetService && results[sourceService]) {
                    let header = sourceService.toUpperCase();
                    let content = results[sourceService].trim();

                    if (isAnonymousMode) {
                        header = aliases[sourceService] || header;
                        // Replace all occurrences of service names in content
                        Object.entries(aliases).forEach(([svc, alias]) => {
                            // Create regex for case-insensitive match
                            const regex = new RegExp(svc, 'gi');
                            content = content.replace(regex, alias);
                        });
                    }

                    prompt += `=== ${header} ===\n${content}\n\n`;
                }
            }

            if (prompt) {
                const selectors = selectorsConfig[targetService];
                if (selectors) {
                    // Send with autoSend: true
                    views[targetService].view.webContents.send('inject-prompt', { text: prompt, selectors, autoSend: true });
                }
            }
        }
    }
});

ipcMain.on('copy-single-chat-thread', async (event, text) => {
    if (text) {
        clipboard.writeText(text);
        // Reply to the sender (the webview)
        event.sender.send('single-chat-thread-copied');
    }
});

// Scroll Sync State
let isScrollSyncEnabled = false;

ipcMain.on('toggle-scroll-sync', (event, isEnabled) => {
    isScrollSyncEnabled = isEnabled;
    // Broadcast to all views
    services.forEach(service => {
        if (views[service] && views[service].view) {
            views[service].view.webContents.send('scroll-sync-state', isScrollSyncEnabled);
        }
    });
});

ipcMain.on('sync-scroll', (event, { deltaX, deltaY }) => {
    if (!isScrollSyncEnabled) return;

    // Broadcast to all OTHER views
    services.forEach(service => {
        if (views[service] && views[service].view) {
            // Don't send back to sender (optional optimization, but simple broadcast is fine if logic handles it)
            // But here we are in Main, we don't know easily which view sent it unless we check event.sender
            if (views[service].view.webContents !== event.sender) {
                views[service].view.webContents.send('apply-scroll', { deltaX, deltaY });
            }
        }
    });
});

ipcMain.on('zoom-sync', (event, direction) => {
    const zoomStep = 0.1;
    if (direction === 'in') {
        currentZoomLevel = Math.min(currentZoomLevel + zoomStep, 3.0); // Max 300%
    } else {
        currentZoomLevel = Math.max(currentZoomLevel - zoomStep, 0.5); // Min 50%
    }

    // Apply to all views
    services.forEach(service => {
        if (views[service] && views[service].view) {
            views[service].view.webContents.setZoomFactor(currentZoomLevel);
        }
    });
});

// External Login Handler
ipcMain.on('external-login', async (event, service) => {
    const axios = require('axios');

    console.log(`Launching Chrome for ${service} login...`);
    const isMac = process.platform === 'darwin'; // OS 확인 변수
    const isWin = process.platform === 'win32';

    try {
        // 0. Cleanup existing Chrome instances (Mac specific)
        if (isMac) {
            try {
                const { execSync } = require('child_process');
                execSync('pkill -f "chrome-auth-profile"');
                console.log('Cleaned up existing Chrome instances');
            } catch (e) {
                // Ignore error if no process found
            }
        }

        // 1. Find Chrome Path
        const chromeLauncher = await import('chrome-launcher');
        const chromePath = chromeLauncher.Launcher.getInstallations()[0];
        if (!chromePath) {
            console.error('Chrome installation not found');
            return;
        }

        const puppeteer = require('puppeteer-extra');
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        const stealth = StealthPlugin();

        puppeteer.use(stealth);

        // 2. Launch Chrome with Remote Debugging
        const launchArgs = [
            '--no-first-run',
            '--no-default-browser-check',
        ];

        // [Logic Merge] Apply automation flag to all platforms to avoid detection
        launchArgs.push('--disable-blink-features=AutomationControlled');

        // Launch Browser
        const browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: false,
            defaultViewport: null,
            userDataDir: path.join(app.getPath('userData'), 'chrome-auth-profile'),
            ignoreDefaultArgs: ['--enable-automation'],
            args: launchArgs
        });

        const page = (await browser.pages())[0];

        await page.goto(serviceUrls[service]);

        // Special handling for Grok: Wait longer to bypass Cloudflare
        if (service === 'grok') {
            console.log('Waiting 5 seconds for Grok Cloudflare check...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // 3. Monitor for Login Success (Cookie Check)
        const checkLogin = setInterval(async () => {
            try {
                if (browser.process().killed) {
                    clearInterval(checkLogin);
                    return;
                }

                const cookies = await page.cookies();
                let isLoggedIn = false;

                if (service === 'chatgpt') {
                    // Based on user image: __Secure-next-auth.session-token, oai-did, _cf_bm
                    isLoggedIn = cookies.some(c => c.name === '__Secure-next-auth.session-token' || c.name === 'oai-did');
                } else if (service === 'claude') {
                    isLoggedIn = cookies.some(c => c.name === 'sessionKey');
                } else if (service === 'gemini') {
                    // Based on user image: SID, __Secure-1PSID, __Secure-3PSID
                    isLoggedIn = cookies.some(c => c.name === 'SID' || c.name === '__Secure-1PSID' || c.name === '__Secure-3PSID');
                } else if (service === 'grok') {
                    isLoggedIn = cookies.some(c => c.name.includes('sso') || c.name === 'auth_token' || c.name.includes('grok'));
                } else if (service === 'perplexity') {
                    isLoggedIn = cookies.some(c => c.name === '__Secure-next-auth.session-token');
                }

                // Also check URL to ensure we are not on login page
                const url = page.url();
                const isNotLoginPage = !url.includes('/auth/login') && !url.includes('accounts.google.com') && !url.includes('sso');

                if (isLoggedIn && isNotLoginPage) {
                    clearInterval(checkLogin);
                    console.log(`${service} login detected! Syncing cookies...`);

                    // Sync cookies to Electron session
                    if (views[service] && views[service].view) {
                        const electronCookies = views[service].view.webContents.session.cookies;
                        for (const cookie of cookies) {
                            try {
                                const cookieDetails = {
                                    url: serviceUrls[service],
                                    name: cookie.name,
                                    value: cookie.value,
                                    domain: cookie.domain,
                                    path: cookie.path,
                                    secure: cookie.secure,
                                    httpOnly: cookie.httpOnly,
                                    expirationDate: cookie.expires
                                };

                                // Fix for __Host- prefix: Must NOT have a domain attribute
                                if (cookie.name.startsWith('__Host-')) {
                                    delete cookieDetails.domain;
                                } else if (cookieDetails.domain && cookieDetails.domain.startsWith('.')) {
                                    // Remove leading dot from domain if present for Electron compatibility
                                    // Electron sometimes prefers url to match domain. 
                                    // If domain is .google.com, url https://gemini.google.com works.
                                }

                                await electronCookies.set(cookieDetails);
                            } catch (err) {
                                console.error(`Failed to set cookie ${cookie.name}:`, err);
                            }
                        }
                        console.log(`Cookies synced for ${service}`);

                        // Force reload to apply cookies immediately
                        views[service].view.webContents.reload();
                    }

                    console.log(`${service} login detected! Keeping Chrome open for manual close...`);
                    // Do NOT close browser automatically. User will close it.
                }
            } catch (e) {
                clearInterval(checkLogin);
                console.error('Error checking login status:', e);
            }
        }, 1000);

        // Handle manual close
        browser.on('disconnected', () => {
            clearInterval(checkLogin);
            console.log('Chrome disconnected (closed by user). Reloading view...');

            // Reload the Electron view
            if (views[service] && views[service].view) {
                console.log(`Reloading service view: ${service}`);
                views[service].view.webContents.reload();
            }

            if (mainWindow) {
                mainWindow.webContents.send('external-login-closed');
            }
        });

    } catch (e) {
        console.error('Error in external login:', e);
    }
});

ipcMain.on('reload-active-view', (event) => {
    // Reload only the view that requested it
    event.sender.reload();
});

ipcMain.on('status-update', (event, { isLoggedIn }) => {
    // Optional: Handle status updates from renderer if needed
});

ipcMain.on('set-service-visibility', (event, isVisible) => {
    console.log(`Setting service visibility to: ${isVisible}`);
    Object.keys(views).forEach(service => {
        if (views[service] && views[service].enabled && views[service].view) {
            if (isVisible) {
                // Add back if it was removed (or ensure it's there)
                try {
                    // Check if already attached to avoid error
                    // mainWindow.addBrowserView(views[service].view); 
                    // Electron addBrowserView moves it to top.
                    // We just add it.
                    mainWindow.addBrowserView(views[service].view);
                } catch (e) {
                    console.error(`Failed to show view for ${service}:`, e);
                }
            } else {
                // Remove to hide
                try {
                    mainWindow.removeBrowserView(views[service].view);
                } catch (e) {
                    console.error(`Failed to hide view for ${service}:`, e);
                }
            }
        }
    });
});

app.whenReady().then(() => {
    // Load saved session state (SESS-003)
    const savedState = store.get('sessionState', defaultSessionState);
    currentLayout = savedState.layout || '1x4';
    savedSessionUrls = savedState.serviceUrls || {}; // Load saved URLs for createServiceView
    isAnonymousMode = savedState.isAnonymousMode || false;
    console.log('[Session] Loaded saved state:', savedState);

    createWindow();

    // Send saved state to renderer after window is ready
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('apply-saved-state', savedState);
    });
});

// Save session state function (reusable for close and quit events)
function saveSessionState() {
    const sessionState = {
        serviceUrls: {},
        layout: currentLayout,
        activeServices: [],
        isAnonymousMode: isAnonymousMode,
        isScrollSyncEnabled: isScrollSyncEnabled
    };

    // Collect current URLs from all BrowserViews (SESS-002)
    services.forEach(service => {
        if (views[service] && views[service].view && !views[service].view.webContents.isDestroyed()) {
            sessionState.serviceUrls[service] = views[service].view.webContents.getURL();
            if (views[service].enabled) {
                sessionState.activeServices.push(service);
            }
        }
    });

    store.set('sessionState', sessionState);
    console.log('[Session] Saved state:', sessionState);
}

// Save session state before quit (SESS-001)
app.on('before-quit', () => {
    saveSessionState();
});

// IPC handler for renderer to report UI state (SESS-002)
ipcMain.on('report-ui-state', (event, uiState) => {
    // Update tracking variables for before-quit
    isAnonymousMode = uiState.isAnonymousMode || false;

    // Update the session state with UI control states
    const savedState = store.get('sessionState', defaultSessionState);
    store.set('sessionState', {
        ...savedState,
        isAnonymousMode: uiState.isAnonymousMode,
        isScrollSyncEnabled: uiState.isScrollSyncEnabled,
        layout: uiState.layout,
        activeServices: uiState.activeServices
    });
});

// IPC handler to get current saved state (SESS-003)
ipcMain.handle('get-saved-session', () => {
    return store.get('sessionState', defaultSessionState);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
