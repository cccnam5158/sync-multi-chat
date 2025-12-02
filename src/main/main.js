const { app, BrowserWindow, BrowserView, ipcMain, session, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

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

let currentLayout = '1x4'; // Default layout

let selectorsConfig = {};
let currentZoomLevel = 0.9; // Default zoom level

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
    view.webContents.loadURL(serviceUrls[service]);

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
    });

    // Handle config request from preload (Handshake)
    ipcMain.on('request-config', (event) => {
        if (event.sender === view.webContents) {
            if (selectorsConfig[service]) {
                view.webContents.send('set-config', { config: selectorsConfig[service], service });
            }
        }
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
ipcMain.on('send-prompt', async (event, text, activeServices) => {
    const serviceKeys = Object.keys(activeServices);

    // Process each service independently to prevent one failure from blocking others
    serviceKeys.forEach(async (service) => {
        if (activeServices[service] && views[service]) {
            try {
                const selectors = selectorsConfig[service];
                if (selectors) {
                    // Add a small delay for Perplexity if it's being problematic with high load
                    if (service === 'perplexity') {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    if (views[service].view && !views[service].view.webContents.isDestroyed()) {
                        views[service].view.webContents.send('inject-prompt', { text, selectors, autoSend: true });
                        console.log(`Sent prompt to ${service}`);
                    }
                }
            } catch (error) {
                console.error(`Failed to send prompt to ${service}:`, error);
            }
        }
    });
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

// Helper to extract text from a service
async function extractTextFromService(service) {
    if (views[service] && views[service].enabled) {
        try {
            const config = selectorsConfig[service];
            const contentSelectors = config ? config.contentSelector : [];

            const script = `
                (function() {
                    const selectors = ${JSON.stringify(contentSelectors)};
                    let content = '';
                    
                    // Try selectors first
                    if (selectors && selectors.length > 0) {
                        for (const selector of selectors) {
                            const el = document.querySelector(selector);
                            if (el) {
                                content = el.innerText;
                                break;
                            }
                        }
                    }
                    
                    // Fallback to body if no content found
                    if (!content) {
                        content = document.body.innerText;
                    }
                    
                    return content;
                })();
            `;

            const text = await Promise.race([
                views[service].view.webContents.executeJavaScript(script),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]);

            return text;
        } catch (e) {
            console.error(`Error extracting text from ${service}:`, e);
            return `[Error extracting text: ${e.message}]`;
        }
    }
    return null;
}

ipcMain.on('copy-chat-thread', async (event) => {
    const promises = services.map(async (service) => {
        const text = await extractTextFromService(service);
        return { service, text };
    });

    const results = await Promise.all(promises);

    let clipboardText = '';
    results.forEach(result => {
        if (result.text) {
            clipboardText += `=== ${result.service.toUpperCase()} ===\n`;
            clipboardText += result.text.trim();
            clipboardText += '\n\n' + '-'.repeat(40) + '\n\n';
        }
    });

    if (clipboardText) {
        clipboard.writeText(clipboardText);
        console.log('Chat threads copied to clipboard');
        // Notify renderer for visual feedback
        if (mainWindow) {
            mainWindow.webContents.send('chat-thread-copied');
        }
    }
});

ipcMain.on('cross-check', async () => {
    console.log('Starting Cross Check...');
    // 1. Extract all texts
    const results = {};
    for (const service of services) {
        const text = await extractTextFromService(service);
        if (text) {
            results[service] = text;
        }
    }

    // 2. Construct prompts and send
    for (const targetService of services) {
        if (views[targetService] && views[targetService].enabled) {
            let prompt = "";
            for (const sourceService of services) {
                if (sourceService !== targetService && results[sourceService]) {
                    prompt += `=== ${sourceService.toUpperCase()} ===\n${results[sourceService].trim()}\n\n`;
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

app.whenReady().then(createWindow);

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
