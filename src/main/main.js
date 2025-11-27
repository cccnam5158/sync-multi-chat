const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
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
const services = ['chatgpt', 'claude', 'gemini'];
const serviceUrls = {
    chatgpt: 'https://chatgpt.com',
    claude: 'https://claude.ai',
    gemini: 'https://gemini.google.com/app'
};

let selectorsConfig = {};

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
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Create BrowserViews
    services.forEach(service => {
        createServiceView(service);
    });

    // Initial Layout
    mainWindow.once('ready-to-show', () => {
        updateLayout();
    });

    // Handle Resize
    mainWindow.on('resize', () => {
        updateLayout();
    });
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

function updateLayout() {
    if (!mainWindow) return;
    const bounds = mainWindow.getContentBounds();
    const controlHeight = 120; // Height of the bottom control bar
    const viewHeight = bounds.height - controlHeight;

    // Calculate visible services
    const enabledServices = services.filter(s => views[s] && views[s].enabled);
    const count = enabledServices.length;

    if (count === 0) return;

    const viewWidth = Math.floor(bounds.width / count);
    let x = 0;

    services.forEach(service => {
        if (views[service] && views[service].enabled) {
            views[service].view.setBounds({ x: x, y: 0, width: viewWidth, height: viewHeight });
            x += viewWidth;
        } else if (views[service] && views[service].view) {
            views[service].view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        }
    });
}

// IPC Handlers
ipcMain.on('send-prompt', (event, text, activeServices) => {
    Object.keys(activeServices).forEach(service => {
        if (activeServices[service] && views[service]) {
            const selectors = selectorsConfig[service];
            if (selectors) {
                views[service].view.webContents.send('inject-prompt', { text, selectors });
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
            updateLayout();
        } else {
            // Just enable existing
            if (!viewObj.enabled) {
                viewObj.enabled = true;
                mainWindow.addBrowserView(viewObj.view);
                updateLayout();
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
            updateLayout();
        }
    }
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

// Handle status updates from services
ipcMain.on('status-update', (event, status) => {
    // Find which service sent this
    const senderWebContents = event.sender;
    const serviceName = Object.keys(views).find(key => views[key].view.webContents === senderWebContents);

    if (serviceName && mainWindow) {
        mainWindow.webContents.send('service-status-update', { service: serviceName, status });
    }
});

// Handle reload request from service view
ipcMain.on('reload-active-view', (event) => {
    const senderWebContents = event.sender;
    const serviceName = Object.keys(views).find(key => views[key].view.webContents === senderWebContents);

    if (serviceName && views[serviceName]) {
        console.log(`Reloading service view: ${serviceName}`);
        views[serviceName].view.webContents.reload();
    }
});

// External Login Handler
const puppeteer = require('puppeteer-core');
const { exec } = require('child_process');

ipcMain.on('external-login', async (event, service) => {
    const url = serviceUrls[service];
    if (!url) return;

    // 1. Find Chrome Path (Windows)
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    // 2. Launch Chrome with Remote Debugging
    const userDataDir = path.join(app.getPath('userData'), 'chrome-auth-profile');

    const port = 9222;
    const args = [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        url
    ];

    const chromeCmd = `"${chromePath}" ${args.join(' ')}`;
    console.log('Launching Chrome:', chromeCmd);

    const chromeProcess = exec(chromeCmd);

    // 3. Connect Puppeteer
    // Wait a bit for Chrome to start
    setTimeout(async () => {
        try {
            const browser = await puppeteer.connect({
                browserURL: `http://127.0.0.1:${port}`,
                defaultViewport: null
            });

            const pages = await browser.pages();
            const page = pages[0];

            // Notify Renderer that Chrome is open
            mainWindow.webContents.send('external-login-started', service);

            let loginSuccess = false;

            // Handle manual close of Chrome window
            browser.on('disconnected', () => {
                if (!loginSuccess) {
                    console.log('Chrome disconnected without login success');
                    if (views[service]) {
                        views[service].view.webContents.send('external-login-closed');
                    }
                }
            });

            // 4. Monitor for Login Success
            // We can check cookies periodically
            const checkInterval = setInterval(async () => {
                try {
                    // Check if browser is still connected
                    if (!browser.isConnected()) {
                        clearInterval(checkInterval);
                        return;
                    }

                    const cookies = await page.cookies();
                    const currentUrl = await page.url();

                    // Check for specific login cookies
                    let hasLoginCookies = false;
                    if (service === 'chatgpt') {
                        hasLoginCookies = cookies.some(c => c.name.includes('__Secure-next-auth.session-token'));
                    } else if (service === 'claude') {
                        hasLoginCookies = cookies.some(c => c.name.includes('sessionKey'));
                    } else if (service === 'gemini') {
                        hasLoginCookies = cookies.some(c => c.name === 'SID');
                    }

                    // Strict URL check: Ensure we are back on the main app, not login page
                    const isNotLoginPage = !currentUrl.includes('/auth') && !currentUrl.includes('/login') && !currentUrl.includes('accounts.google.com');

                    // For ChatGPT specifically, we want to be on chatgpt.com
                    const isCorrectDomain = service === 'chatgpt' ? currentUrl.includes('chatgpt.com') : true;

                    if (hasLoginCookies && isNotLoginPage && isCorrectDomain) {
                        clearInterval(checkInterval);
                        loginSuccess = true;

                        // 5. Sync Cookies to Electron
                        const viewObj = views[service];
                        if (viewObj) {
                            const electronSession = viewObj.view.webContents.session;
                            for (const cookie of cookies) {
                                let scheme = cookie.secure ? 'https' : 'http';

                                // Strict handling for Secure prefixes
                                if (cookie.name.startsWith('__Secure-') || cookie.name.startsWith('__Host-')) {
                                    scheme = 'https';
                                    cookie.secure = true;
                                }

                                const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
                                const cookieUrl = `${scheme}://${domain}${cookie.path}`;

                                // Map SameSite values from Puppeteer (Capitalized) to Electron (lowercase/enum)
                                let sameSite = 'unspecified';
                                if (cookie.sameSite) {
                                    switch (cookie.sameSite.toLowerCase()) {
                                        case 'lax': sameSite = 'lax'; break;
                                        case 'strict': sameSite = 'strict'; break;
                                        case 'none': sameSite = 'no_restriction'; break;
                                    }
                                }

                                await electronSession.cookies.set({
                                    url: cookieUrl,
                                    name: cookie.name,
                                    value: cookie.value,
                                    domain: cookie.domain,
                                    path: cookie.path,
                                    secure: cookie.secure,
                                    httpOnly: cookie.httpOnly,
                                    expirationDate: cookie.expires,
                                    sameSite: sameSite
                                }).catch(e => console.error(`Cookie set failed for ${cookie.name}:`, e));
                            }

                            // Reload view to main URL to ensure we are not on login page
                            viewObj.view.webContents.loadURL(serviceUrls[service]);
                        }

                        // Close Chrome
                        await browser.close();

                        // Notify Renderer
                        mainWindow.webContents.send('external-login-success', service);
                    }
                } catch (err) {
                    // Ignore errors if browser closed
                    if (err.message.includes('Protocol error') || err.message.includes('Target closed')) {
                        clearInterval(checkInterval);
                    } else {
                        console.error('Error checking cookies:', err);
                    }
                }
            }, 2000);

            // Safety timeout (5 mins)
            setTimeout(() => {
                clearInterval(checkInterval);
                if (browser.isConnected()) {
                    browser.disconnect();
                }
            }, 300000);

        } catch (err) {
            console.error('Puppeteer connection failed:', err);
            mainWindow.webContents.send('external-login-error', { service, error: err.message });
            // Also reset button if connection failed
            if (views[service]) {
                views[service].view.webContents.send('external-login-closed');
            }
        }
    }, 3000);
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
