const { app, BrowserWindow, WebContentsView, ipcMain, session, clipboard, shell, screen, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Store = require('electron-store');
const { initAutoUpdater, checkForUpdates } = require('./updater');

// Session persistence store (SESS-006)
const store = new Store();
const defaultSessionState = {
    serviceUrls: {}, // Current URLs for each service
    layout: '1x4',
    activeServices: ['chatgpt', 'claude', 'gemini', 'perplexity'],
    isAnonymousMode: false,
    isScrollSyncEnabled: false
};

// User data persistence (prompts)
const PROMPT_STORE_KEYS = {
    customPrompts: 'customPrompts',
    predefinedPrompt: 'predefinedPrompt',
    customPromptGlobalVars: 'customPromptGlobalVars'
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

/**
 * Anti-detection script injected via CDP (Page.addScriptToEvaluateOnNewDocument)
 * before any page JavaScript runs. Mirrors ParallelChat's approach to reduce
 * bot/automation fingerprinting that triggers Google's "browser not secure" warning.
 */
function getAntiDetectionScript() {
    return `
(() => {
  // 1. Remove navigator.webdriver (automation fingerprint)
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true
    });
  } catch {}

  // 2. Mock navigator.plugins (empty array is automation signal)
  try {
    const mockPlugins = [
      { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
    ];
    Object.defineProperty(navigator, 'plugins', {
      get: () => mockPlugins,
      configurable: true
    });
  } catch {}

  // 3. Mock navigator.languages (single language is suspicious)
  try {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en', 'ko-KR', 'ko'],
      configurable: true
    });
  } catch {}

  // 4. Fix WebGL renderer fingerprint (hide SwiftShader/llvmpipe headless markers)
  try {
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Intel Inc.';        // UNMASKED_VENDOR_WEBGL
      if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
      return getParameter.apply(this, arguments);
    };
  } catch {}
  try {
    const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter2.apply(this, arguments);
    };
  } catch {}

  // 5. Ensure window.chrome object exists (some detectors check for it)
  try {
    if (!window.chrome) {
      window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
    }
  } catch {}

  // 6. Fix permissions.query (automation environments may return anomalies)
  try {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission, onchange: null })
        : originalQuery(parameters)
    );
  } catch {}

  // 7. Fix outerWidth/outerHeight (headless: equal to innerWidth/innerHeight)
  try {
    if (window.outerWidth === 0 || window.outerHeight === 0) {
      Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth, configurable: true });
      Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 85, configurable: true });
    }
  } catch {}
})();
    `;
}

/**
 * Inject anti-detection script via Chrome DevTools Protocol (CDP).
 * The script runs before any page JavaScript on every new document in the session.
 * Debugger is detached after injection — the script persists for the session lifetime.
 */
async function injectAntiDetection(webContents) {
    const dbg = webContents.debugger;
    let attached = false;
    try {
        if (!dbg.isAttached()) {
            dbg.attach('1.3');
            attached = true;
        }
        await dbg.sendCommand('Page.enable');
        await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
            source: getAntiDetectionScript()
        });
        console.log('[anti-detection] CDP script injected successfully');
    } catch (err) {
        console.warn(`[anti-detection] injection failed: ${err?.message || err}`);
    } finally {
        if (attached && dbg.isAttached()) {
            try { dbg.detach(); } catch {}
        }
    }
}

/**
 * Open a dedicated modal BrowserWindow for Google account login.
 * Uses the same partition so cookies are shared with the service view.
 * This avoids Google's embedded-webview detection that triggers "browser not secure".
 */
function openGoogleLoginWindow(url, partition, parentView, serviceUrl) {
    const loginWin = new BrowserWindow({
        parent: mainWindow || undefined,
        modal: !!mainWindow,
        show: true,
        width: 900,
        height: 680,
        autoHideMenuBar: true,
        webPreferences: {
            partition,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
        },
    });

    // The login window loads accounts.google.com where Safari UA is needed.
    // Session-level onBeforeSendHeaders handles per-request UA switching,
    // but webContents.userAgent is sent as the default — set it to Safari
    // so the initial request and any sub-resources use Safari UA.
    loginWin.webContents.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36'
    );

    // Inject anti-detection into the login window too
    loginWin.webContents.once('did-start-loading', () => {
        injectAntiDetection(loginWin.webContents).catch(() => {});
    });

    // Allow ESC and Cmd/Ctrl+W to close the modal (macOS modal windows may lack visible close button)
    loginWin.webContents.on('before-input-event', (_event, input) => {
        if (input.type !== 'keyDown') return;
        const isClose = input.key === 'Escape' ||
            (input.key === 'w' && (input.meta || input.control));
        if (isClose) {
            try { loginWin.close(); } catch {}
        }
    });

    // Auto-close when login completes and redirects back to the service.
    // Three-tier detection:
    //   1. Service domain match → auth flow complete (e.g., chatgpt.com, gemini.google.com)
    //   2. Google auth pages (accounts.google.com, id.google.com) → stay open (still in login flow)
    //   3. OAuth intermediaries (auth0.com etc.) → stay open (mid-flow token exchange)
    //   4. Any other domain → close (user navigated away or flow ended elsewhere)
    const serviceBaseDomain = (() => {
        try { return new URL(serviceUrl).hostname.replace(/^www\./, ''); } catch { return ''; }
    })();
    const OAUTH_INTERMEDIARIES = ['auth0.com', 'auth.openai.com'];

    let closed = false;
    const doClose = (reloadUrl) => {
        if (closed) return;
        closed = true;
        try { loginWin.close(); } catch {}
        try {
            if (parentView && !parentView.webContents.isDestroyed()) {
                parentView.webContents.loadURL(reloadUrl || serviceUrl);
            }
        } catch {}
    };

    const maybeClose = (nextUrl) => {
        if (!nextUrl || !serviceBaseDomain || closed) return;
        try {
            const host = new URL(nextUrl).hostname;

            // 1. Reached the service's own domain → auth complete, use actual URL (preserves session tokens)
            if (host === serviceBaseDomain || host.endsWith('.' + serviceBaseDomain)) {
                doClose(nextUrl);
                return;
            }

            // 2. Still on Google auth pages → stay open
            if (host.includes('accounts.google.com') || host.includes('id.google.com')) {
                return;
            }

            // 3. On OAuth intermediary (e.g., auth0 processing callback) → stay open
            if (OAUTH_INTERMEDIARIES.some(d => host === d || host.endsWith('.' + d))) {
                return;
            }

            // 4. Any other domain (e.g., myaccount.google.com, consent pages) → close
            doClose(serviceUrl);
        } catch {}
    };

    // Electron 39+: will-redirect callback receives (details) object with .url
    loginWin.webContents.on('will-redirect', (details) => maybeClose(details.url));
    loginWin.webContents.on('did-navigate', (_e, nextUrl) => maybeClose(nextUrl));

    try { loginWin.loadURL(url); } catch {}
    return loginWin;
}

// Fix for Google CookieMismatch error (Chromium 134+ third-party cookie phase-out)
// Disable third-party cookie deprecation and cookie partitioning (CHIPS) so that
// Google's cross-domain auth flow (accounts.google.com ↔ gemini.google.com) works properly.
app.commandLine.appendSwitch(
    'disable-features',
    'ThirdPartyCookieDeprecationTrial,TrackingProtection3pcd,PartitionedCookies,BoundSessionCredentials'
);

// GPU tile memory optimization: prevent "tile memory limits exceeded" warning
// on Retina (scaleFactor=2) displays. Each WebContentsView uses 4x tile memory
// at 2x DPI; with 6 views at 1792×1120@2x the total exceeds Chromium's default
// tile budget (~128-256MB). Raising reported GPU memory to 2048MB increases the
// tile memory budget proportionally so 6 Retina views fit within limits.
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '2048');
app.commandLine.appendSwitch('gpu-rasterization-msaa-sample-count', '0');

// Windows taskbar grouping/icon behavior is strongly tied to AppUserModelID.
// Setting a stable ID helps Windows associate the running process with the correct icon/shortcut.
if (process.platform === 'win32') {
    app.setAppUserModelId('com.syncmultichat.app');
}
// Note: Removed disable-features=IsolateOrigins,site-per-process and disable-site-isolation-trials
// to allow proper origin isolation for cookie context matching
// app.commandLine.appendSwitch('disable-infobars'); // Not always needed but good practice

// Fix for Google Sign-in "This browser or app may not be secure"
// We need to make sure we don't look like an automation tool.


let mainWindow;
const views = {};
const services = ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'genspark'];
const serviceUrls = {
    chatgpt: 'https://chatgpt.com',
    claude: 'https://claude.ai',
    gemini: 'https://gemini.google.com/app',
    grok: 'https://grok.com',
    perplexity: 'https://www.perplexity.ai',
    genspark: 'https://www.genspark.ai/agents?type=ai_chat'
};

// Domain whitelist for each service (EXTLINK-002)
// URLs within these domains will stay in the webview, others open in external browser
const serviceDomains = {
    chatgpt: ['chatgpt.com', 'chat.openai.com', 'openai.com', 'auth0.com', 'auth.openai.com'],
    // cloudflare.com: challenges / Turnstile iframes (e.g. challenges.cloudflare.com) must stay in-webview (EXTLINK)
    claude: ['claude.ai', 'anthropic.com', 'cloudflare.com'],
    gemini: ['gemini.google.com', 'google.com', 'accounts.google.com', 'gstatic.com'],
    grok: ['grok.com', 'x.com', 'twitter.com', 'google.com', 'accounts.google.com', 'gstatic.com'],
    perplexity: ['perplexity.ai'],
    genspark: ['genspark.ai', 'google.com', 'accounts.google.com', 'gstatic.com']
};

/**
 * Preserve original CSP and X-Frame-Options for these responses so Cloudflare / bot checks
 * (Turnstile, challenge pages) can run correctly in the embedded WebContentsView.
 * Stripping CSP globally broke verification loops for Claude (see CF-RAY / human check retries).
 */
function shouldPreserveResponseSecurityHeadersForUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        const roots = ['claude.ai', 'anthropic.com', 'cloudflare.com'];
        return roots.some(
            (root) => hostname === root || hostname.endsWith('.' + root)
        );
    } catch {
        return false;
    }
}

let currentLayout = '1x4'; // Default layout

let selectorsConfig = {};
let currentZoomLevel = 0.9; // Default zoom level (user preference, 0.5–3.0)

/**
 * Effective zoom factor = userZoom only (no DPI compensation).
 * Chromium internally handles DPI-aware rendering: on a 2x display, content is rendered
 * with 2x pixel density at the same logical size. Dividing by scaleFactor was previously
 * applied here but caused content to shrink on high-DPI displays (e.g., 0.9/2 = 0.45)
 * and dramatic size jumps when dragging between displays with different DPIs.
 */
function getEffectiveZoomFactor() {
    return currentZoomLevel;
}

/** Apply current zoom to all WebContentsViews. */
function applyZoomToAllViews() {
    const zoom = getEffectiveZoomFactor();
    services.forEach(service => {
        if (views[service] && views[service].view && !views[service].view.webContents.isDestroyed()) {
            views[service].view.webContents.setZoomFactor(zoom);
        }
    });
    Object.keys(singleModeViews).forEach(instanceKey => {
        const entry = singleModeViews[instanceKey];
        if (entry && entry.view && !entry.view.webContents.isDestroyed()) {
            entry.view.webContents.setZoomFactor(zoom);
        }
    });
}

/**
 * Collect non-enabled views for throttling.
 */
function getDisabledViews() {
    const result = [];
    services.forEach(service => {
        if (views[service] && views[service].view && !views[service].view.webContents.isDestroyed()) {
            if (!views[service].enabled) result.push(views[service].view);
        }
    });
    Object.keys(singleModeViews).forEach(instanceKey => {
        const entry = singleModeViews[instanceKey];
        if (entry && entry.view && !entry.view.webContents.isDestroyed()) {
            if (!entry.enabled) result.push(entry.view);
        }
    });
    return result;
}

/**
 * Throttle non-enabled views to 1 FPS to reduce simultaneous tile re-rasterization.
 * Called during display transitions, window resize, and layout changes.
 * Automatically restores after autoRestoreMs (default 2s) as a safety net;
 * callers may also call restoreViewFrameRates() explicitly for earlier restore.
 */
let _throttleRestoreTimeout = null;
function throttleViewsDuringTransition(autoRestoreMs = 2000) {
    const disabledViews = getDisabledViews();
    disabledViews.forEach(view => {
        try { view.webContents.setFrameRate(1); } catch (e) { /* ignore */ }
    });

    // Safety net: auto-restore if caller doesn't call restoreViewFrameRates()
    if (_throttleRestoreTimeout) clearTimeout(_throttleRestoreTimeout);
    _throttleRestoreTimeout = setTimeout(() => {
        _throttleRestoreTimeout = null;
        restoreViewFrameRates();
    }, autoRestoreMs);
}

/** Restore all non-enabled views to normal frame rate (60 FPS). */
function restoreViewFrameRates() {
    if (_throttleRestoreTimeout) {
        clearTimeout(_throttleRestoreTimeout);
        _throttleRestoreTimeout = null;
    }
    getDisabledViews().forEach(view => {
        try {
            if (!view.webContents.isDestroyed()) view.webContents.setFrameRate(60);
        } catch (e) { /* ignore */ }
    });
}

/**
 * Returns a spoofed User-Agent string (SEC-002) in the same format as standard Chrome desktop UAs.
 * Desktop only: Windows / macOS / Linux (no iOS/Android). Chrome version is dynamic from process.versions.chrome
 * to avoid version mismatch detection (e.g. Google). No "Electron" in string.
 */
function getSpoofedUserAgent() {
    const chromeVer = process.versions.chrome || '131.0.6778.0';
    const platformPart = process.platform === 'darwin'
        ? '(Macintosh; Intel Mac OS X 10_15_7)'
        : process.platform === 'linux'
            ? '(X11; Linux x86_64)'
            : '(Windows NT 10.0; Win64; x64)';
    return `Mozilla/5.0 ${platformPart} AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`;
}

/** Services that use Google account login (ChatGPT, Gemini, Grok, Genspark). */
const GOOGLE_LOGIN_SERVICES = ['chatgpt', 'gemini', 'grok', 'genspark'];

/**
 * All services use Chrome-style UA uniformly. Previous approaches (Firefox UA globally,
 * Safari UA for accounts.google.com only) caused issues:
 *   - Firefox UA: engine mismatch (Chromium pretending to be Firefox) triggered Google flags
 *   - Safari UA on accounts.google.com: UA switch mid-auth-flow caused CookieMismatch
 * Now we rely on CDP anti-detection script (webdriver removal, plugins mock, WebGL spoof,
 * window.chrome, etc.) to pass Google's bot checks with a consistent Chrome UA everywhere.
 */
function getUserAgentForService(_service) {
    return getSpoofedUserAgent();
}

/** One outgoing-header hook per session (partition); avoids duplicate listeners when multiple instances share a partition. */
const sessionsWithOutgoingHeaderHook = new WeakSet();

/**
 * ParallelChat-matching header normalization.
 *
 * Key design decisions (learned from trial & error):
 *   1. Safari UA for accounts.google.com — Electron's TLS fingerprint (JA3/JA4) doesn't
 *      match Chrome's. Google detects UA-vs-TLS mismatch and shows "unsafe browser".
 *      Safari UA avoids this because Google doesn't enforce TLS fingerprint for Safari.
 *   2. DO NOT manipulate Sec-CH-UA headers — let Chromium handle them naturally.
 *      Explicit manipulation caused CookieMismatch in prior attempts.
 *   3. Use spread operator (new headers object) to match ParallelChat exactly.
 *   4. Strip Electron-revealing custom headers.
 */
function attachOutgoingHeaderNormalization(webSession, service) {
    if (!webSession || sessionsWithOutgoingHeaderHook.has(webSession)) return;
    sessionsWithOutgoingHeaderHook.add(webSession);

    const isGoogleLoginService = GOOGLE_LOGIN_SERVICES.includes(service);

    webSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const rh = details.requestHeaders;
        if (!rh) {
            callback({});
            return;
        }
        // Strip any Electron-revealing headers
        for (const key of Object.keys(rh)) {
            if (/electron/i.test(key)) {
                delete rh[key];
            }
        }

        // Determine UA: Safari for accounts.google.com (Google-login services), Chrome otherwise
        let ua = getSpoofedUserAgent();
        if (isGoogleLoginService) {
            try {
                const hostname = new URL(details.url).hostname;
                if (hostname.includes('accounts.google.com') || hostname.includes('id.google.com')) {
                    ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36';
                }
            } catch { /* ignore */ }
        }

        // Spread original headers (preserves cookies, Sec-CH-UA, etc. untouched)
        // Only override User-Agent and Accept-Language — matches ParallelChat exactly
        const headers = {
            ...rh,
            'User-Agent': ua,
            'Accept-Language': `${app.getLocale() || 'en-US'},en;q=0.9`,
        };
        callback({ cancel: false, requestHeaders: headers });
    });
}

/**
 * Google auth: Cookie header is not exposed on requestHeaders; avoid replacing the entire header map in listeners
 * that would drop cookies. Outgoing normalization uses in-place mutation only (see attachOutgoingHeaderNormalization).
 */
function applyChromeClientHintsToSession(_ses) {
    // No-op: header interception removed to preserve cookies. UA is set at session level when creating the view.
}

// Session state tracking (SESS)
let savedSessionUrls = {}; // URLs to load on startup
let isAnonymousMode = false; // Track anonymous mode for session save

// ========================================
// Single AI Mode State (REQ-MODE)
// ========================================
let chatMode = 'multi'; // 'multi' | 'single'
let singleAiService = null; // 'chatgpt' | 'claude' | etc.
const SINGLE_MODE_MAX_INSTANCES = 3; // Reduced to 3 for bot detection mitigation
let singleAiActiveInstances = [true, true, true]; // Up to 3 instances
const singleModeViews = {}; // { 'chatgpt-0': { view, enabled }, 'chatgpt-1': { view, enabled }, ... }
let isClosingWindow = false;

// Track SPA URL changes (e.g. ChatGPT pushState) per view.
const lastKnownMultiUrls = {}; // { chatgpt: 'https://...' }
const lastKnownInstanceUrls = {}; // { 'chatgpt-0': 'https://...' }

// Load selectors
try {
    const configPath = path.join(__dirname, '../config/selectors.json');
    selectorsConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
    console.error('Failed to load selectors config:', err);
}

function createWindow() {
    // Icon files are generated by scripts/generate-icons.js into /build (gitignored).
    // In packaged app, icons are in resources folder via extraResources config.
    const { nativeImage } = require('electron');
    
    const getIconPath = (filename) => {
        if (app.isPackaged) {
            return path.join(process.resourcesPath, filename);
        } else {
            return path.join(__dirname, '../../build', filename);
        }
    };
    
    // Try multiple icon sources: 512px PNG (best quality), 256px PNG, ICO
    const png512IconPath = getIconPath('icon-512.png');
    const pngIconPath = getIconPath('icon.png');
    const icoIconPath = getIconPath('icon.ico');
    
    console.log('[Icon] isPackaged:', app.isPackaged);
    console.log('[Icon] PNG-512 path:', png512IconPath, 'exists:', fs.existsSync(png512IconPath));
    console.log('[Icon] PNG path:', pngIconPath, 'exists:', fs.existsSync(pngIconPath));
    console.log('[Icon] ICO path:', icoIconPath, 'exists:', fs.existsSync(icoIconPath));
    
    // Try loading icons in order of preference
    let windowIcon = undefined;
    const iconPaths = [png512IconPath, pngIconPath, icoIconPath];
    
    for (const iconPath of iconPaths) {
        if (fs.existsSync(iconPath)) {
            try {
                const icon = nativeImage.createFromPath(iconPath);
                if (!icon.isEmpty()) {
                    windowIcon = icon;
                    console.log('[Icon] Successfully loaded from:', iconPath, 'size:', icon.getSize());
                    break;
                }
            } catch (err) {
                console.error('[Icon] Failed to load from:', iconPath, err.message);
            }
        }
    }
    
    if (!windowIcon) {
        console.warn('[Icon] No valid icon found, using default Electron icon');
    }

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        icon: windowIcon,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
            // Note: sandbox intentionally NOT set here — the main window loads file:// and
            // its renderer uses IndexedDB (HistoryManager / conversations-db). Enabling
            // sandbox changes Chromium's file-access model and causes LevelDB LOCK failures
            // on the file__0.indexeddb.leveldb database, breaking chat history persistence.
        },
        show: false, // Wait for ready-to-show
        autoHideMenuBar: true // Hide menu bar by default
    });

    // Increase listener limit to prevent MaxListenersExceededWarning 
    // (we have 6 services + several system listeners)
    mainWindow.setMaxListeners(100);

    // Re-apply zoom on resize and force repaint on display DPI transitions.
    // The zoom VALUE doesn't change across displays (DPI compensation removed),
    // but re-setting the same zoom forces Chromium to re-composite all views cleanly,
    // preventing flickering when the window moves between displays with different DPIs.
    let zoomApplyTimeout = null;
    const scheduleApplyZoom = () => {
        if (zoomApplyTimeout) clearTimeout(zoomApplyTimeout);
        zoomApplyTimeout = setTimeout(() => {
            zoomApplyTimeout = null;
            if (mainWindow && !mainWindow.isDestroyed()) applyZoomToAllViews();
        }, 300);
    };
    mainWindow.on('resized', scheduleApplyZoom);

    // Throttle non-enabled views during continuous window resize to reduce tile memory pressure.
    // 'will-resize' fires on every frame during drag-resize; we throttle once at start
    // and restore after the resize settles (500ms debounce).
    let resizeThrottleActive = false;
    let resizeEndTimeout = null;
    mainWindow.on('will-resize', () => {
        if (!resizeThrottleActive) {
            resizeThrottleActive = true;
            throttleViewsDuringTransition();
        }
        if (resizeEndTimeout) clearTimeout(resizeEndTimeout);
        resizeEndTimeout = setTimeout(() => {
            resizeThrottleActive = false;
            restoreViewFrameRates();
        }, 500);
    });

    // Detect display change on window move and force repaint to prevent flickering.
    // Tracks the last display ID so we only repaint when actually crossing display boundaries.
    let lastDisplayId = null;
    mainWindow.on('moved', () => {
        try {
            const winBounds = mainWindow.getBounds();
            const display = screen.getDisplayMatching(winBounds);
            if (display && lastDisplayId !== null && display.id !== lastDisplayId) {
                // Window crossed to a different display — force repaint all views
                // by re-applying the same zoom factor (triggers Chromium re-composite)
                throttleViewsDuringTransition();
                setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) applyZoomToAllViews();
                }, 150);
            }
            if (display) lastDisplayId = display.id;
        } catch (e) { /* ignore */ }
    });

    // Also handle external display connect/disconnect (scaleFactor changes)
    try {
        screen.on('display-metrics-changed', (event, display, changedMetrics) => {
            if (Array.isArray(changedMetrics) && changedMetrics.includes('scaleFactor')) {
                throttleViewsDuringTransition();
                setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) applyZoomToAllViews();
                }, 150);
            }
        });
    } catch (e) { /* screen API may vary by Electron version */ }

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Create WebContentsViews only after main window is ready to avoid startup errors
    mainWindow.once('ready-to-show', () => {
        // Explicitly set icon again after window is ready (Windows fix)
        if (windowIcon) {
            mainWindow.setIcon(windowIcon);
            console.log('[Icon] setIcon() called after ready-to-show');
        }
        mainWindow.show();
        
        // Create views based on chat mode
        if (chatMode === 'single' && singleAiService) {
            console.log(`[Session] Restoring Single AI Mode: ${singleAiService}`);
            // Create Single AI instances (staggered) - limit to SINGLE_MODE_MAX_INSTANCES
            const maxInstances = Math.min(singleAiActiveInstances.length, SINGLE_MODE_MAX_INSTANCES);
            for (let i = 0; i < maxInstances; i++) {
                if (singleAiActiveInstances[i]) {
                    const instanceKey = `${singleAiService}-${i}`;
                    const savedUrl = lastKnownInstanceUrls[instanceKey] || null;
                    const delay = i * SINGLE_VIEW_CREATE_BASE_DELAY_MS + jitterMs(SINGLE_VIEW_CREATE_BASE_DELAY_MS, SINGLE_VIEW_CREATE_JITTER_MS);
                    createSingleModeInstanceView(singleAiService, i, delay, savedUrl);
                }
            }
            // Also create Multi AI views in background (hidden) for mode switching
            services.forEach(service => {
                createServiceView(service);
                // Immediately hide them since we're in Single AI Mode
                if (views[service] && views[service].view) {
                    views[service].enabled = false;
                    try {
                        mainWindow.contentView.removeChildView(views[service].view);
                    } catch (e) { /* ignore */ }
                }
            });
        } else {
            // Multi AI Mode (default)
            services.forEach(service => {
                createServiceView(service);
            });
        }
    });

    // Save session state when window is closed (catches Alt+F4, X button, etc.)
    // Also give renderer a chance to persist IndexedDB chat history with up-to-date URLs.
    mainWindow.on('close', async (e) => {
        if (isClosingWindow) {
            return;
        }
        isClosingWindow = true;

        // Prevent immediate close; we'll close after renderer confirms (or timeout).
        e.preventDefault();

        try {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('app-will-close');
            }
        } catch (err) {
            console.error('[Session] Failed to notify renderer on close:', err);
        }

        // Wait up to 2500ms for renderer to finish saving history
        const waitForRenderer = new Promise((resolve) => {
            ipcMain.once('__app-close-ready__', () => resolve(true));
        });
        await Promise.race([waitForRenderer, new Promise(r => setTimeout(r, 2500))]);

        // Persist electron-store sessionState no matter what
        try { saveSessionState(); } catch (err) { console.error('[Session] saveSessionState failed:', err); }

        if (geminiKeepAliveTimerId != null) {
            clearInterval(geminiKeepAliveTimerId);
            geminiKeepAliveTimerId = null;
        }
        if (geminiKeepAliveRetryTimeoutId != null) {
            clearTimeout(geminiKeepAliveRetryTimeoutId);
            geminiKeepAliveRetryTimeoutId = null;
        }
        // Now actually close
        try {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.destroy();
            }
        } finally {
            isClosingWindow = false;
        }
    });

    // Initial Layout is now handled by renderer sending bounds

    startGeminiKeepAlive();
}

// Centralized handler for request-config to avoid listener accumulation
ipcMain.on('request-config', (event) => {
    // Multi AI Mode: match sender to service view
    for (const [service, viewData] of Object.entries(views)) {
        if (viewData && viewData.view && !viewData.view.webContents.isDestroyed() && event.sender === viewData.view.webContents) {
            if (selectorsConfig[service]) {
                console.log(`[Config] Sending set-config to Multi AI service: ${service}`);
                viewData.view.webContents.send('set-config', { config: selectorsConfig[service], service });
            }
            return;
        }
    }
    // Single AI Mode: match sender to instance view
    for (const [instanceKey, viewData] of Object.entries(singleModeViews)) {
        if (viewData && viewData.view && !viewData.view.webContents.isDestroyed() && event.sender === viewData.view.webContents) {
            const service = viewData.service;
            if (selectorsConfig[service]) {
                console.log(`[Config] Sending set-config to Single AI instance: ${instanceKey} (service: ${service})`);
                viewData.view.webContents.send('set-config', { config: selectorsConfig[service], service, instanceKey });
            }
            return;
        }
    }
    console.log('[Config] request-config received but no matching view found. singleModeViews keys:', Object.keys(singleModeViews), 'views keys:', Object.keys(views));
});

function createServiceView(service) {
    // Cleanup existing view if it exists
    if (views[service] && views[service].view) {
        try {
            if (mainWindow) {
                mainWindow.contentView.removeChildView(views[service].view);
            }
            // Force destroy webContents to ensure cleanup
            if (!views[service].view.webContents.isDestroyed()) {
                // views[service].view.webContents.destroy(); // Optional, let GC handle it usually
            }
        } catch (e) {
            console.error(`Error cleaning up view for ${service}:`, e);
        }
    }

    const partition = `persist:service-${service}`;
    const view = new WebContentsView({
        webPreferences: {
            preload: path.join(__dirname, '../preload/service-preload.js'),
            partition,
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true, // Explicitly enable web security for proper origin context
            backgroundThrottling: true // Reduce tile memory usage for non-visible views during DPI transitions
            // Note: sandbox intentionally NOT set — adding it to existing views causes
            // service_worker_storage and quota_database IO errors in Chromium's storage layer.
        }
    });

    mainWindow.contentView.addChildView(view);

    // CDP anti-detection: inject for ALL services before any page JS runs.
    // With contextIsolation: true, service-preload.js anti-detection (webdriver, plugins,
    // window.chrome) runs in an isolated context and does NOT affect the page context.
    // CDP Page.addScriptToEvaluateOnNewDocument is the only way to modify the page context
    // before page scripts detect automation signals (Cloudflare, Google, etc.).
    // ParallelChat also injects on all views — "绕过 Cloudflare 等检测".
    view.webContents.once('did-start-loading', () => {
        injectAntiDetection(view.webContents).catch(() => {});
    });

    // User Agent Spoofing (SEC-002) — Chrome UA for all; Safari UA swap for accounts.google.com via onBeforeSendHeaders
    const userAgent = getUserAgentForService(service);
    view.webContents.session.setUserAgent(userAgent);
    view.webContents.setUserAgent(userAgent);
    applyChromeClientHintsToSession(view.webContents.session);
    attachOutgoingHeaderNormalization(view.webContents.session, service);

    // Use saved session URL if available, otherwise use default (SESS-003)
    const urlToLoad = savedSessionUrls[service] || serviceUrls[service];
    console.log(`[Session] Loading ${service} with URL: ${urlToLoad}`);
    console.log(`[Session] Partition: ${partition}`);

    // Log persisted auth cookies on startup (helps diagnose login persistence issues)
    if (service === 'gemini') {
        view.webContents.session.cookies.get({ domain: '.google.com' })
            .then(cookies => {
                const authNames = ['SID', '__Secure-1PSID', '__Secure-3PSID', 'SIDTS', '__Secure-1PSIDTS', '__Secure-3PSIDTS'];
                const found = cookies.filter(c => authNames.includes(c.name));
                console.log(`[Session][gemini] Persisted auth cookies on startup: ${found.map(c => c.name).join(', ') || '(none)'}`);
            })
            .catch(() => {});
    }

    // Ensure WebContentsView is ready before loading URL to prevent origin context mismatch
    // Use setImmediate to ensure WebContentsView is fully attached and ready
    setImmediate(() => {
        // Load URL - this will set the proper origin context
        view.webContents.loadURL(urlToLoad);
    });

    // Modify headers for X-Frame-Options (SEC-001)
    // Skip header manipulation for Google auth domains to preserve cookie integrity (CookieMismatch fix)
    view.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const url = details.url || '';
        // Google auth domains: do NOT modify response headers (preserves Set-Cookie, CSP, etc.)
        if (url.includes('accounts.google.com') ||
            url.includes('myaccount.google.com') ||
            url.includes('accounts.youtube.com')) {
            callback({ cancel: false, responseHeaders: details.responseHeaders });
            return;
        }
        if (shouldPreserveResponseSecurityHeadersForUrl(url)) {
            callback({ cancel: false, responseHeaders: details.responseHeaders });
            return;
        }
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

    // Intercept requests to ensure proper origin context for cookie requests
    // This helps prevent origin mismatch errors during initial load
    view.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        // Ensure requests have proper origin context
        // The URL is already set correctly, so we just need to let it proceed
        callback({ cancel: false });
    }, {
        urls: ['<all_urls>']
    });

    // Helper: Check if URL is a conversation URL
    const isConversationUrl = (u) => {
        if (!u || typeof u !== 'string') return false;
        return /\/c\/[a-f0-9-]+/i.test(u) ||       // ChatGPT
               /\/chat\/[a-f0-9-]+/i.test(u) ||    // Claude
               /conversation.*[a-f0-9-]{8,}/i.test(u) ||
               /\/share\/[a-f0-9-]+/i.test(u);
    };

    // Send config when page finishes loading
    view.webContents.on('did-finish-load', () => {

        view.webContents.setZoomFactor(getEffectiveZoomFactor());
        view.webContents.send('scroll-sync-state', isScrollSyncEnabled);

        if (selectorsConfig[service]) {
            view.webContents.send('set-config', { config: selectorsConfig[service], service });
        }

        // Defensive URL update: ensure URL bar shows current URL after page loads
        // (with conversation URL protection)
        const currentUrl = view.webContents.getURL();
        const existingUrl = lastKnownMultiUrls[service];
        if (isConversationUrl(currentUrl) || !isConversationUrl(existingUrl)) {
            lastKnownMultiUrls[service] = currentUrl;
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('webview-url-changed', { service, url: currentUrl });
        }
    });

    // URL Bar: Track URL changes (URLBAR-003) with conversation URL protection
    const sendUrlUpdate = () => {
        const currentUrl = view.webContents.getURL();
        const existingUrl = lastKnownMultiUrls[service];
        if (isConversationUrl(currentUrl) || !isConversationUrl(existingUrl)) {
            lastKnownMultiUrls[service] = currentUrl;
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('webview-url-changed', { service, url: currentUrl });
        }
    };

    view.webContents.on('did-navigate', sendUrlUpdate);
    view.webContents.on('did-navigate-in-page', sendUrlUpdate);

    // NOTE: 'request-config' handler is now registered globally to avoid listener accumulation

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

    // Intercept navigation to external domains (EXTLINK-003) and Google login redirects.
    // For Google-login services: check Google login BEFORE domain whitelist so that
    // accounts.google.com is intercepted even when not in serviceDomains (e.g., ChatGPT).
    view.webContents.on('will-navigate', (event, url) => {
        // Google-login services: intercept navigation to accounts.google.com first
        if (GOOGLE_LOGIN_SERVICES.includes(service)) {
            try {
                const host = new URL(url).hostname;
                if (host.includes('accounts.google.com') || host.includes('id.google.com')) {
                    event.preventDefault();
                    console.log(`[${service}] Intercepting Google login redirect → modal window: ${url}`);
                    openGoogleLoginWindow(url, partition, view, serviceUrls[service]);
                    return;
                }
            } catch {}
        }
        if (!isAllowedDomain(url)) {
            console.log(`[${service}] Blocking navigation to external URL: ${url}`);
            event.preventDefault();
            shell.openExternal(url);
            return;
        }
    });

    // Intercept server-side redirects (302) to accounts.google.com (e.g., auth0 → Google).
    // will-navigate does NOT fire for 302 redirects mid-chain, so will-redirect is needed.
    view.webContents.on('will-redirect', (details) => {
        try {
            const host = new URL(details.url).hostname;
            if (host.includes('accounts.google.com') || host.includes('id.google.com')) {
                details.preventDefault();
                console.log(`[${service}] Intercepting 302 redirect to Google login → modal window: ${details.url}`);
                openGoogleLoginWindow(details.url, partition, view, serviceUrls[service]);
            }
        } catch {}
    });

    // Handle new window requests (EXTLINK-004)
    // Google login URLs open in a dedicated modal BrowserWindow (same partition)
    // to avoid embedded-webview detection that triggers "browser not secure".
    view.webContents.setWindowOpenHandler(({ url }) => {
        // Google login: intercept before domain check so it works for all services
        try {
            const host = new URL(url).hostname;
            if (host.endsWith('accounts.google.com') || host.endsWith('id.google.com')) {
                console.log(`[${service}] Opening Google login in modal window: ${url}`);
                openGoogleLoginWindow(url, partition, view, serviceUrls[service]);
                return { action: 'deny' };
            }
        } catch {}
        if (!isAllowedDomain(url)) {
            console.log(`[${service}] Opening external URL in browser: ${url}`);
            shell.openExternal(url);
            return { action: 'deny' };
        }
        // Allow popup for other auth flows within allowed domains
        return { action: 'allow' };
    });

    views[service] = { view, enabled: true };
}

// ========================================
// Gemini session keep-alive (reduce idle logout after ~10 min)
// ========================================
// Google may treat the session as idle and require re-login. We ping /app so the server sees activity.
const GEMINI_KEEPALIVE_INTERVAL_MS = 1 * 60 * 1000; // 1 minute (shortened to help maintain session)
let geminiKeepAliveTimerId = null;
let geminiKeepAliveRetryTimeoutId = null;

/** When set (SMC_GEMINI_SESSION_DEBUG=1), log keep-alive and login-state changes for session expiry analysis. */
function isGeminiSessionDebug() {
    return process.env.SMC_GEMINI_SESSION_DEBUG === '1' || process.env.SMC_GEMINI_SESSION_DEBUG === 'true';
}

/** Google auth cookie names we observe to infer token/session refresh (no value logged). */
const GEMINI_AUTH_COOKIE_NAMES = ['SID', 'HSID', 'SSID', '__Secure-1PSID', '__Secure-3PSID', 'SIDTS', '__Secure-1PSIDTS', '__Secure-3PSIDTS'];
/** Previous expiry snapshot for comparison; key = cookie name, value = expirationDate (Unix s) or 'session'. */
let geminiAuthCookieExpiriesPrev = {};


/**
 * Collect all Gemini webContents to ping (Multi + Single mode).
 * Includes both /app and conversation URLs like /app/be54b06c57aac760 (url.includes('gemini.google.com') covers both).
 */
function getGeminiKeepAliveTargets() {
    const targets = [];
    if (views.gemini && views.gemini.view && !views.gemini.view.webContents.isDestroyed()) {
        const wc = views.gemini.view.webContents;
        const url = wc.getURL() || '';
        if (url.includes('gemini.google.com') && !url.includes('accounts.google.com')) targets.push(wc);
    }
    if (chatMode === 'single' && singleAiService === 'gemini') {
        for (const entry of Object.values(singleModeViews)) {
            if (entry.service !== 'gemini' || !entry.view || entry.view.webContents.isDestroyed()) continue;
            const wc = entry.view.webContents;
            const url = wc.getURL() || '';
            if (url.includes('gemini.google.com') && !url.includes('accounts.google.com')) targets.push(wc);
        }
    }
    return targets;
}

/**
 * Log Gemini partition auth cookie expiries (no values). If any expiry extended vs previous run, log "Possible refresh".
 * Set SMC_GEMINI_TOKEN_DEBUG=1 to enable. Helps confirm OAuth/session refresh after keep-alive.
 */
async function logGeminiAuthCookieExpiries() {
    const targets = getGeminiKeepAliveTargets();
    if (targets.length === 0) return;
    const wc = targets[0];
    if (wc.isDestroyed()) return;
    try {
        const cookies = await wc.session.cookies.get({ domain: '.google.com' });
        const auth = cookies.filter(c => GEMINI_AUTH_COOKIE_NAMES.includes(c.name));
        const now = {};
        for (const c of auth) {
            const exp = c.expirationDate != null && c.expirationDate > 0 ? c.expirationDate : 'session';
            now[c.name] = exp;
        }
        const changed = [];
        for (const [name, exp] of Object.entries(now)) {
            const prev = geminiAuthCookieExpiriesPrev[name];
            if (prev !== undefined && exp !== 'session' && (prev === 'session' || (typeof exp === 'number' && exp > prev))) {
                changed.push(name);
            }
        }
        if (changed.length > 0) {
            console.log('[gemini] Auth cookie expiry extended (possible OAuth/session refresh):', changed.join(', '));
        }
        console.log('[gemini] Auth cookies expiry:', Object.entries(now).map(([n, e]) => `${n}=${e === 'session' ? 'session' : new Date(e * 1000).toISOString()}`).join('; ') || '(none)');
        geminiAuthCookieExpiriesPrev = now;
    } catch (e) {
        console.warn('[gemini] Auth cookie expiry check failed:', e?.message || e);
    }
}

function geminiKeepAliveTick() {
    try {
        const targets = getGeminiKeepAliveTargets();
        if (targets.length === 0) return;
        if (isGeminiSessionDebug()) {
            console.log('[gemini] Keep-alive tick targets=', targets.length);
        }
        // Ping current path when it's /app or /app/<id> (conversation URL) so activity is tied to the same page; cache-bust so request hits server.
        const script = `(function(){ try {
          var path = (window.location.pathname && window.location.pathname.indexOf('/app') === 0) ? window.location.pathname : '/app';
          var u = window.location.origin + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'smc_ka=' + Date.now();
          fetch(u, { method: 'GET', credentials: 'same-origin', keepalive: true, cache: 'no-store' }).catch(function(){});
        } catch (e) {} })();`;
        const promises = targets.map(wc => wc.executeJavaScript(script).catch(() => { throw new Error('executeJS failed'); }));
        Promise.allSettled(promises).then(async (results) => {
            const anyRejected = results.some(r => r.status === 'rejected');
            if (anyRejected && geminiKeepAliveRetryTimeoutId == null) {
                geminiKeepAliveRetryTimeoutId = setTimeout(() => {
                    geminiKeepAliveRetryTimeoutId = null;
                    geminiKeepAliveTick();
                }, 60000);
            }
            if (isGeminiSessionDebug() || process.env.SMC_GEMINI_TOKEN_DEBUG === '1' || process.env.SMC_GEMINI_TOKEN_DEBUG === 'true') {
                await logGeminiAuthCookieExpiries();
            }
        });
    } catch (e) {
        // ignore
    }
}

/** Return slotKey ('gemini' or 'gemini-0' etc.) for a Gemini webContents, or null. */
function getSlotKeyForGeminiWebContents(wc) {
    if (!wc || wc.isDestroyed()) return null;
    if (views.gemini && views.gemini.view && views.gemini.view.webContents === wc) return 'gemini';
    if (chatMode === 'single' && singleAiService === 'gemini') {
        for (const [key, entry] of Object.entries(singleModeViews)) {
            if (entry.view && entry.view.webContents === wc) return key;
        }
    }
    return null;
}


function startGeminiKeepAlive() {
    if (geminiKeepAliveTimerId != null) return;
    geminiKeepAliveTimerId = setInterval(geminiKeepAliveTick, GEMINI_KEEPALIVE_INTERVAL_MS);
    // 방안 2: 첫 틱을 앱 시작 직후 한 번 실행
    geminiKeepAliveTick();
    console.log('[gemini] Keep-alive started (interval:', GEMINI_KEEPALIVE_INTERVAL_MS / 1000, 's, first tick now)');

}

// ========================================
// Single AI Mode Functions (REQ-MODE)
// ========================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function jitterMs(base, spread) {
    const r = Math.random();
    return Math.max(0, Math.round(base + (r - 0.5) * 2 * spread));
}

// Tunables: Anti-bot detection - conservative delays to mimic human behavior
// Webview creation: 1~1.5 seconds between instances
const SINGLE_VIEW_CREATE_BASE_DELAY_MS = 1000;
const SINGLE_VIEW_CREATE_JITTER_MS = 500;
// Prompt sending: 1.5~4 seconds between instances
const SINGLE_PROMPT_STAGGER_BASE_DELAY_MS = 1500;
const SINGLE_PROMPT_STAGGER_JITTER_MS = 2500;

/**
 * Create a Single AI Mode instance view
 * @param {string} service - The AI service (e.g., 'chatgpt')
 * @param {number} instanceIndex - Instance index (0-3)
 * @param {number} loadDelayMs - Optional delay before loadURL (stagger startup)
 * @param {string} savedUrl - Optional saved URL to load instead of default service URL
 */
function createSingleModeInstanceView(service, instanceIndex, loadDelayMs = 0, savedUrl = null) {
    const instanceKey = `${service}-${instanceIndex}`;
    
    // Cleanup existing view if it exists
    if (singleModeViews[instanceKey] && singleModeViews[instanceKey].view) {
        try {
            if (mainWindow) {
                mainWindow.contentView.removeChildView(singleModeViews[instanceKey].view);
            }
            // Destroy webContents to free memory
            if (!singleModeViews[instanceKey].view.webContents.isDestroyed()) {
                singleModeViews[instanceKey].view.webContents.close();
            }
        } catch (e) {
            console.error(`Error cleaning up single mode view ${instanceKey}:`, e);
        }
        delete singleModeViews[instanceKey];
    }

    const singlePartition = `persist:service-${service}`;
    const view = new WebContentsView({
        webPreferences: {
            preload: path.join(__dirname, '../preload/service-preload.js'),
            // Use shared partition by default (REQ-MODE-018)
            partition: singlePartition,
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            backgroundThrottling: true // Reduce tile memory usage for non-visible views during DPI transitions
        }
    });

    mainWindow.contentView.addChildView(view);

    // CDP anti-detection: all services (see createServiceView for rationale)
    view.webContents.once('did-start-loading', () => {
        injectAntiDetection(view.webContents).catch(() => {});
    });

    // User Agent Spoofing (SEC-002) — Chrome UA for all; Safari UA swap for accounts.google.com via onBeforeSendHeaders
    const userAgentSingle = getUserAgentForService(service);
    view.webContents.session.setUserAgent(userAgentSingle);
    view.webContents.setUserAgent(userAgentSingle);
    applyChromeClientHintsToSession(view.webContents.session);
    attachOutgoingHeaderNormalization(view.webContents.session, service);

    // Use saved URL if available, otherwise fall back to default service URL
    const urlToLoad = savedUrl || serviceUrls[service];
    console.log(`[SingleAI] Creating instance ${instanceKey} with URL: ${urlToLoad}`);

    setTimeout(() => {
        // Check if view still exists and is not destroyed before loading URL
        if (view && view.webContents && !view.webContents.isDestroyed()) {
            view.webContents.loadURL(urlToLoad);
        }
    }, Math.max(0, loadDelayMs));

    // Apply same headers/security as multi-AI mode
    // Skip header manipulation for Google auth domains to preserve cookie integrity (CookieMismatch fix)
    view.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const url = details.url || '';
        // Google auth domains: do NOT modify response headers (preserves Set-Cookie, CSP, etc.)
        if (url.includes('accounts.google.com') ||
            url.includes('myaccount.google.com') ||
            url.includes('accounts.youtube.com')) {
            callback({ cancel: false, responseHeaders: details.responseHeaders });
            return;
        }
        if (shouldPreserveResponseSecurityHeadersForUrl(url)) {
            callback({ cancel: false, responseHeaders: details.responseHeaders });
            return;
        }
        const responseHeaders = Object.assign({}, details.responseHeaders);
        delete responseHeaders['x-frame-options'];
        delete responseHeaders['X-Frame-Options'];
        delete responseHeaders['content-security-policy'];
        delete responseHeaders['Content-Security-Policy'];
        callback({ cancel: false, responseHeaders });
    });

    // Helper: Check if URL is a conversation URL (reused from service-url-updated handler)
    const isConversationUrl = (u) => {
        if (!u || typeof u !== 'string') return false;
        return /\/c\/[a-f0-9-]+/i.test(u) ||       // ChatGPT
               /\/chat\/[a-f0-9-]+/i.test(u) ||    // Claude
               /conversation.*[a-f0-9-]{8,}/i.test(u) ||
               /\/share\/[a-f0-9-]+/i.test(u);
    };

    // On page load
    view.webContents.on('did-finish-load', () => {
        view.webContents.setZoomFactor(getEffectiveZoomFactor());
        view.webContents.send('scroll-sync-state', isScrollSyncEnabled);

        if (selectorsConfig[service]) {
            view.webContents.send('set-config', { config: selectorsConfig[service], service, instanceKey });
        }

        // Send URL update (with conversation URL protection)
        const currentUrl = view.webContents.getURL();
        const existingUrl = lastKnownInstanceUrls[instanceKey];
        // Only store if new URL is conversation URL OR existing is not conversation URL
        if (isConversationUrl(currentUrl) || !isConversationUrl(existingUrl)) {
            lastKnownInstanceUrls[instanceKey] = currentUrl;
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('single-instance-url-changed', {
                instanceKey, 
                service,
                instanceIndex,
                url: currentUrl 
            });
        }
    });

    // URL change tracking (with conversation URL protection)
    const sendUrlUpdate = () => {
        const currentUrl = view.webContents.getURL();
        const existingUrl = lastKnownInstanceUrls[instanceKey];
        // Only store if new URL is conversation URL OR existing is not conversation URL
        if (isConversationUrl(currentUrl) || !isConversationUrl(existingUrl)) {
            lastKnownInstanceUrls[instanceKey] = currentUrl;
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('single-instance-url-changed', { 
                instanceKey,
                service,
                instanceIndex,
                url: currentUrl 
            });
        }
    };
    view.webContents.on('did-navigate', sendUrlUpdate);
    view.webContents.on('did-navigate-in-page', sendUrlUpdate);

    // External link handling
    const isAllowedDomain = (url) => {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            const allowedDomains = serviceDomains[service] || [];
            return allowedDomains.some(domain =>
                hostname === domain || hostname.endsWith('.' + domain)
            );
        } catch (e) {
            return true;
        }
    };

    view.webContents.on('will-navigate', (event, url) => {
        // Google-login services: intercept navigation to accounts.google.com first
        if (GOOGLE_LOGIN_SERVICES.includes(service)) {
            try {
                const host = new URL(url).hostname;
                if (host.includes('accounts.google.com') || host.includes('id.google.com')) {
                    event.preventDefault();
                    console.log(`[SingleAI][${instanceKey}] Intercepting Google login redirect → modal window: ${url}`);
                    openGoogleLoginWindow(url, singlePartition, view, serviceUrls[service]);
                    return;
                }
            } catch {}
        }
        if (!isAllowedDomain(url)) {
            event.preventDefault();
            shell.openExternal(url);
            return;
        }
    });

    // Intercept server-side redirects (302) to accounts.google.com (e.g., auth0 → Google)
    view.webContents.on('will-redirect', (details) => {
        try {
            const host = new URL(details.url).hostname;
            if (host.includes('accounts.google.com') || host.includes('id.google.com')) {
                details.preventDefault();
                console.log(`[SingleAI][${instanceKey}] Intercepting 302 redirect to Google login → modal window: ${details.url}`);
                openGoogleLoginWindow(details.url, singlePartition, view, serviceUrls[service]);
            }
        } catch {}
    });

    view.webContents.setWindowOpenHandler(({ url }) => {
        // Google login: intercept before domain check
        try {
            const host = new URL(url).hostname;
            if (host.endsWith('accounts.google.com') || host.endsWith('id.google.com')) {
                console.log(`[SingleAI][${instanceKey}] Opening Google login in modal window: ${url}`);
                openGoogleLoginWindow(url, singlePartition, view, serviceUrls[service]);
                return { action: 'deny' };
            }
        } catch {}
        if (!isAllowedDomain(url)) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        // Allow popup for other auth flows within allowed domains
        return { action: 'allow' };
    });

    singleModeViews[instanceKey] = { view, enabled: true, service, instanceIndex };
    return view;
}

/**
 * Switch to Single AI Mode
 * @param {string} service - The AI service to use
 * @param {boolean[]} activeInstances - Array of up to SINGLE_MODE_MAX_INSTANCES booleans for instance states
 * @param {Object|null} urls - Optional URLs for each instance (e.g., { 'chatgpt-0': 'https://...' })
 *                             If null/undefined, clears lastKnownInstanceUrls for this service (new session)
 *                             If provided, uses these URLs for session restoration
 */
function switchToSingleAiMode(service, activeInstances = [true, true, true], urls = null) {
    console.log(`[ChatMode] Switching to Single AI Mode: ${service}, urls:`, urls);
    
    // Hide all Multi AI views
    Object.keys(views).forEach(svc => {
        if (views[svc] && views[svc].view) {
            views[svc].view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
            views[svc].enabled = false;
        }
    });

    // Clear existing Single AI views and destroy webContents to free memory
    Object.keys(singleModeViews).forEach(key => {
        if (singleModeViews[key] && singleModeViews[key].view) {
            try {
                mainWindow.contentView.removeChildView(singleModeViews[key].view);
                // Destroy webContents to free memory
                if (!singleModeViews[key].view.webContents.isDestroyed()) {
                    singleModeViews[key].view.webContents.close();
                }
            } catch (e) {
                console.error(`Error removing single mode view ${key}:`, e);
            }
        }
        delete singleModeViews[key];
    });

    // Clear lastKnownInstanceUrls for this service to prevent stale URLs from being used
    // If urls are provided (session restoration), set them; otherwise clear them (new session)
    for (let i = 0; i < SINGLE_MODE_MAX_INSTANCES; i++) {
        const instanceKey = `${service}-${i}`;
        if (urls && urls[instanceKey]) {
            lastKnownInstanceUrls[instanceKey] = urls[instanceKey];
            console.log(`[ChatMode] Set lastKnownInstanceUrls[${instanceKey}] = ${urls[instanceKey]}`);
        } else {
            delete lastKnownInstanceUrls[instanceKey];
            console.log(`[ChatMode] Cleared lastKnownInstanceUrls[${instanceKey}]`);
        }
    }

    // Update state
    chatMode = 'single';
    singleAiService = service;
    singleAiActiveInstances = activeInstances;

    // Create instances (staggered)
    for (let i = 0; i < SINGLE_MODE_MAX_INSTANCES; i++) {
        if (activeInstances[i]) {
            const instanceKey = `${service}-${i}`;
            // Use URL from urls parameter if available (for session restoration)
            const savedUrl = (urls && urls[instanceKey]) ? urls[instanceKey] : null;
            const delay = i * SINGLE_VIEW_CREATE_BASE_DELAY_MS + jitterMs(SINGLE_VIEW_CREATE_BASE_DELAY_MS, SINGLE_VIEW_CREATE_JITTER_MS);
            createSingleModeInstanceView(service, i, delay, savedUrl);
        }
    }

    // Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chat-mode-changed', {
            mode: 'single',
            service,
            activeInstances
        });
    }
}

/**
 * Switch to Multi AI Mode
 */
function switchToMultiAiMode() {
    console.log(`[ChatMode] Switching to Multi AI Mode`);
    
    // Hide, remove and destroy all Single AI views to free memory
    Object.keys(singleModeViews).forEach(key => {
        if (singleModeViews[key] && singleModeViews[key].view) {
            try {
                mainWindow.contentView.removeChildView(singleModeViews[key].view);
                // Destroy webContents to free memory
                if (!singleModeViews[key].view.webContents.isDestroyed()) {
                    singleModeViews[key].view.webContents.close();
                }
            } catch (e) {
                console.error(`Error removing single mode view ${key}:`, e);
            }
        }
        delete singleModeViews[key];
    });

    // Update state
    chatMode = 'multi';
    singleAiService = null;
    singleAiActiveInstances = [true, true, true]; // Reset to 3 instances

    // Re-enable Multi AI views and add them back to window
    Object.keys(views).forEach(service => {
        if (views[service]) {
            views[service].enabled = true;
            // Add view back to window
            if (views[service].view && !views[service].view.webContents.isDestroyed()) {
                try {
                    mainWindow.contentView.addChildView(views[service].view);
                    console.log(`[ChatMode] Re-added view for ${service}`);
                } catch (e) {
                    console.error(`Error adding view ${service}:`, e);
                }
            }
        }
    });

    // Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chat-mode-changed', {
            mode: 'multi',
            service: null,
            activeInstances: null
        });
    }
}

/**
 * Toggle a Single AI Mode instance
 */
function toggleSingleInstance(instanceIndex, enabled) {
    if (chatMode !== 'single' || !singleAiService) return;
    
    const instanceKey = `${singleAiService}-${instanceIndex}`;
    singleAiActiveInstances[instanceIndex] = enabled;

    if (enabled) {
        // Create the instance if it doesn't exist
        if (!singleModeViews[instanceKey]) {
            createSingleModeInstanceView(singleAiService, instanceIndex);
        } else {
            singleModeViews[instanceKey].enabled = true;
        }
    } else {
        // Hide the instance
        if (singleModeViews[instanceKey] && singleModeViews[instanceKey].view) {
            singleModeViews[instanceKey].view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
            singleModeViews[instanceKey].enabled = false;
        }
    }
}

/**
 * Get active views based on current chat mode
 */
function getActiveViews() {
    if (chatMode === 'single') {
        return Object.entries(singleModeViews)
            .filter(([_, v]) => v && v.enabled)
            .map(([key, v]) => ({ key, view: v.view, service: v.service, instanceIndex: v.instanceIndex }));
    } else {
        return Object.entries(views)
            .filter(([_, v]) => v && v.enabled)
            .map(([service, v]) => ({ key: service, view: v.view, service }));
    }
}

// Layout Management
// Stagger setBounds to prevent simultaneous tile re-rasterization across all views.
// Enabled views update immediately; disabled views defer by 100ms intervals.
// This reduces peak tile memory usage during sidebar toggle, window resize, and layout changes,
// mitigating Chromium's "tile memory limits exceeded" warning.
let _pendingBoundsTimers = [];
ipcMain.on('update-view-bounds', (event, boundsMap) => {
    if (!mainWindow) return;

    // Cancel any pending deferred bounds updates from previous call
    _pendingBoundsTimers.forEach(t => clearTimeout(t));
    _pendingBoundsTimers = [];

    if (chatMode === 'single') {
        const immediate = [];
        const deferred = [];
        Object.entries(boundsMap).forEach(([instanceKey, rect]) => {
            const entry = singleModeViews[instanceKey];
            if (entry && entry.view) {
                if (entry.enabled) {
                    immediate.push({ view: entry.view, rect });
                } else {
                    deferred.push({ view: entry.view, rect });
                }
            }
        });
        immediate.forEach(({ view, rect }) => view.setBounds(rect));
        deferred.forEach(({ view, rect }, i) => {
            _pendingBoundsTimers.push(setTimeout(() => view.setBounds(rect), 100 * (i + 1)));
        });
    } else {
        const immediate = [];
        const deferred = [];
        Object.entries(boundsMap).forEach(([service, rect]) => {
            if (views[service] && views[service].view) {
                if (views[service].enabled) {
                    immediate.push({ view: views[service].view, rect });
                } else {
                    deferred.push({ view: views[service].view, rect });
                }
            }
        });
        immediate.forEach(({ view, rect }) => view.setBounds(rect));
        deferred.forEach(({ view, rect }, i) => {
            _pendingBoundsTimers.push(setTimeout(() => view.setBounds(rect), 100 * (i + 1)));
        });
    }
});

ipcMain.on('set-layout', (event, layout) => {
    currentLayout = layout;
    // We don't calculate layout here anymore, we wait for 'update-view-bounds' from renderer
});

// Temporarily shrink WebContentsView heights to make room for popup overlays
let _savedViewBounds = null;
let _shrinkRefCount = 0;

ipcMain.on('shrink-views-for-popup', (event, popupHeight) => {
    if (!mainWindow) return;
    _shrinkRefCount++;
    if (_savedViewBounds) return; // Already shrunk, just bump ref count
    _savedViewBounds = {};

    const shrink = (key, viewObj) => {
        if (!viewObj || !viewObj.view || !viewObj.enabled) return;
        const b = viewObj.view.getBounds();
        _savedViewBounds[key] = { ...b };
        const newHeight = Math.max(0, b.height - popupHeight);
        viewObj.view.setBounds({ x: b.x, y: b.y, width: b.width, height: newHeight });
    };

    if (chatMode === 'single') {
        Object.entries(singleModeViews).forEach(([k, v]) => shrink('s_' + k, v));
    } else {
        Object.entries(views).forEach(([k, v]) => shrink('m_' + k, v));
    }
});

ipcMain.on('restore-views-from-popup', () => {
    if (!mainWindow || !_savedViewBounds) return;
    _shrinkRefCount = Math.max(0, _shrinkRefCount - 1);
    if (_shrinkRefCount > 0) return; // Other popups still open

    const restore = (key, viewObj) => {
        const savedKey = (chatMode === 'single' ? 's_' : 'm_') + key;
        if (!viewObj || !viewObj.view || !_savedViewBounds[savedKey]) return;
        viewObj.view.setBounds(_savedViewBounds[savedKey]);
    };

    if (chatMode === 'single') {
        Object.entries(singleModeViews).forEach(([k, v]) => restore(k, v));
    } else {
        Object.entries(views).forEach(([k, v]) => restore(k, v));
    }
    _savedViewBounds = null;
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

                                // Special handling for Gemini/Genspark: Use JavaScript to find/access file input
                                // Avoid clicking menu button to prevent file dialog from opening if possible
                                if ((service === 'gemini' || service === 'genspark') && selectors.uploadIconSelector) {
                                    console.log(`[${service}] Searching for file input via JavaScript...`);
                                    try {
                                        // Try to find file input using JavaScript (can find hidden inputs too)
                                        const fileInputFound = await wc.executeJavaScript(`
                                            (function() {
                                                // Search for all file inputs, including hidden ones
                                                const inputs = document.querySelectorAll('input[type="file"]');
                                                if (inputs.length > 0) {
                                                    console.log('[Service JS] Found', inputs.length, 'file input(s)');
                                                    return true;
                                                }
                                                
                                                // Try to find within shadow DOM
                                                const allElements = document.querySelectorAll('*');
                                                for (const el of allElements) {
                                                    if (el.shadowRoot) {
                                                        const shadowInputs = el.shadowRoot.querySelectorAll('input[type="file"]');
                                                        if (shadowInputs.length > 0) {
                                                            console.log('[Service JS] Found', shadowInputs.length, 'file input(s) in shadow DOM');
                                                            return true;
                                                        }
                                                    }
                                                }
                                                
                                                return false;
                                            })()
                                        `);

                                        if (fileInputFound) {
                                            console.log(`[${service}] File input found via JavaScript, proceeding without button clicks`);
                                        } else {
                                            console.log(`[${service}] No file input found, attempting button clicks to create it...`);
                                            // For Genspark: Click icon to open menu (this may create hidden file input)
                                            // For Gemini: Click both icon and menu button
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
                                                                    console.log(`[${service}] Upload icon clicked`);
                                                                    await new Promise(resolve => setTimeout(resolve, 500));
                                                                    break;
                                                                }
                                                            }
                                                        } catch (e) { /* ignore */ }
                                                    }

                                                    // Step 2: For Gemini - click menu button. For Genspark - close menu and search for file input
                                                    if (iconClicked && service === 'gemini') {
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
                                                                        console.log(`[${service}] Menu button clicked, waiting for file input...`);
                                                                        await new Promise(resolve => setTimeout(resolve, 200));
                                                                        break;
                                                                    }
                                                                }
                                                            } catch (e) { /* ignore */ }
                                                        }
                                                    } else if (iconClicked && service === 'genspark') {
                                                        console.log(`[${service}] Clicking menu item to create file input...`);
                                                        // For Genspark: Click "로컬 파일 찾기" to create file input
                                                        // This will open native dialog. We must set files BEFORE closing dialog
                                                        let menuClicked = false;
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
                                                                        menuClicked = true;
                                                                        console.log(`[${service}] Menu item clicked, searching for file input immediately...`);
                                                                        break;
                                                                    }
                                                                }
                                                            } catch (e) { /* ignore */ }
                                                        }

                                                        // Immediately search for file input and set files BEFORE closing dialog
                                                        if (menuClicked) {
                                                            await new Promise(resolve => setTimeout(resolve, 100)); // Brief wait for input creation

                                                            // Search for file input
                                                            let gensparkNodeId = null;
                                                            try {
                                                                const freshRoot = await wc.debugger.sendCommand('DOM.getDocument');
                                                                const inputResult = await wc.debugger.sendCommand('DOM.querySelector', {
                                                                    nodeId: freshRoot.root.nodeId,
                                                                    selector: 'input[type="file"]'
                                                                });
                                                                if (inputResult.nodeId) {
                                                                    gensparkNodeId = inputResult.nodeId;
                                                                    console.log(`[${service}] Found file input immediately after menu click`);
                                                                }
                                                            } catch (e) {
                                                                console.log(`[${service}] Could not find file input:`, e.message);
                                                            }

                                                            // Set files on the input
                                                            if (gensparkNodeId) {
                                                                try {
                                                                    console.log(`[${service}] Setting files via CDP before closing dialog...`);
                                                                    await wc.debugger.sendCommand('DOM.setFileInputFiles', {
                                                                        nodeId: gensparkNodeId,
                                                                        files: filePaths
                                                                    });
                                                                    console.log(`[${service}] Files set successfully!`);
                                                                    nodeId = gensparkNodeId; // Mark as found so we don't search again
                                                                } catch (e) {
                                                                    console.error(`[${service}] Failed to set files:`, e.message);
                                                                }
                                                            }

                                                            // Now close the native dialog with ESC
                                                            if (robot) {
                                                                await new Promise(resolve => setTimeout(resolve, 200));
                                                                robot.keyTap('escape');
                                                                console.log(`[${service}] ESC key sent to close native dialog`);
                                                            }
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.error(`[${service}] Button click fallback failed:`, e);
                                                }
                                            }
                                        }
                                    } catch (e) {
                                        console.error(`[${service}] JavaScript search failed:`, e);
                                    }
                                }

                                // Variable to track if we need to close dialog
                                const shouldSendEsc = (service === 'gemini' || service === 'genspark') && selectors.uploadIconSelector;

                                // Now search for file input (for all services, including Gemini/Genspark after button clicks)
                                for (const selector of selectors.fileInputSelector) {
                                    try {
                                        // Get fresh DOM for Gemini/Genspark
                                        const currentRoot = (service === 'gemini' || service === 'genspark') ?
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
                                        // Get fresh DOM for Gemini/Genspark
                                        const currentRoot = (service === 'gemini' || service === 'genspark') ?
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

                                // Fallback 2: For Gemini/Genspark specifically, try searching in shadow DOMs
                                if (!nodeId && (service === 'gemini' || service === 'genspark')) {
                                    try {
                                        console.log(`[${service}] Attempting shadow DOM search...`);
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
                                                        console.log(`[${service}] Found file input in shadow DOM!`);
                                                        break;
                                                    }
                                                }
                                            } catch (e) { /* ignore */ }
                                        }
                                    } catch (e) {
                                        console.error(`[${service}] Shadow DOM search failed:`, e);
                                    }
                                }

                                // Special delay for Grok to avoid Cloudflare
                                if (service === 'grok' && nodeId) {
                                    console.log(`[Grok] File input found, adding Cloudflare avoidance delay...`);
                                    await new Promise(resolve => setTimeout(resolve, 5000));
                                    console.log(`[Grok] Delay completed, proceeding with file upload`);
                                }

                                if (nodeId) {
                                    // Sanitize arguments for Electron 39 strictness
                                    const sanitizedFiles = filePaths.map(p => String(p));
                                    const sanitizedNodeId = parseInt(nodeId, 10);
                                    const isPerplexity = service === 'perplexity';

                                    console.log(`[CDP] Calling DOM.setFileInputFiles with nodeId: ${sanitizedNodeId}, files:`, sanitizedFiles);

                                    await wc.debugger.sendCommand('DOM.setFileInputFiles', {
                                        files: sanitizedFiles,
                                        nodeId: sanitizedNodeId
                                    });
                                    console.log(`Files uploaded to ${service}`);

                                    // Verify file upload by checking for UI indicators
                                    if (selectors.uploadedFileSelector) {
                                        console.log(`[${service}] Verifying upload via UI indicators...`);
                                        let uploadConfirmed = false;
                                        const startTime = Date.now();
                                        const timeout = isPerplexity ? 1200 : 5000;

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
                                            await new Promise(resolve => setTimeout(resolve, isPerplexity ? 200 : 500));
                                        }

                                        if (!uploadConfirmed) {
                                            console.warn(`[${service}] Upload UI indicator not found within timeout, proceeding anyway...`);
                                        }
                                    }

                                    // Wait longer for upload to process
                                    // Perplexity: keep delay short so prompt text can be filled quickly while provider-side upload finalizes.
                                    const uploadDelay = service === 'grok' ? 4000 : (isPerplexity ? 250 : 2000);
                                    await new Promise(resolve => setTimeout(resolve, uploadDelay));

                                    // Wait for send button to be enabled (check up to 5 times)
                                    // Skip this on Perplexity to avoid delaying prompt injection.
                                    if (!isPerplexity) {
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
                                        console.log('[perplexity] Skipping send-button readiness wait to speed up prompt injection.');
                                    }
                                } else {
                                    console.warn(`File input not found for ${service}`);
                                }

                                // ALWAYS try to close dialog for Gemini/Genspark if we likely opened it
                                if (shouldSendEsc && robot) {
                                    console.log(`[${service}] Sending ESC key cleanup (regardless of upload success)...`);
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                    try {
                                        robot.keyTap('escape');
                                        console.log(`[${service}] ESC key sent`);
                                    } catch (e) {
                                        console.error(`[${service}] Failed to send ESC key:`, e);
                                    }
                                }

                                wc.debugger.detach();
                            } catch (uploadErr) {
                                console.error(`Error uploading files to ${service}:`, uploadErr);
                                try { wc.debugger.detach(); } catch (e) { }
                            }
                        }

                        // 2. Inject Prompt
                        wc.send('inject-prompt', { text, selectors, autoSend: !hasFiles, typingMode: 'instant' });
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
    if (chatMode === 'single' && singleAiService) {
        const selectors = selectorsConfig[singleAiService];
        if (!selectors) return;
        getEnabledSingleInstances().forEach(({ instanceKey, wc }) => {
            try {
                wc.send('click-send-button', { selectors, sendDelayMs: 1000 });
                console.log(`Sent click-send-button to ${instanceKey}`);
            } catch (e) {
                console.error(`Failed click-send-button to ${instanceKey}:`, e);
            }
        });
        return;
    }

    // Multi AI Mode: Iterate over all active views and trigger send button click
    Object.keys(views).forEach(service => {
        if (views[service] && views[service].view && !views[service].view.webContents.isDestroyed()) {
            const selectors = selectorsConfig[service];
            if (selectors) {
                views[service].view.webContents.send('click-send-button', { selectors, sendDelayMs: 0 });
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
                mainWindow.contentView.addChildView(viewObj.view);
            }
        }
    } else {
        // Disable
        if (views[service]) {
            views[service].enabled = false;
            if (views[service].view) {
                try {
                    mainWindow.contentView.removeChildView(views[service].view);
                } catch (e) { /* ignore */ }
            }
        }
    }
    // Layout update will be triggered by renderer via toggle change -> updateLayoutState -> renderLayout -> updateBounds
});

// Request current URLs for all services (URLBAR - for layout/toggle changes)
ipcMain.on('request-current-urls', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    // Helper: Check if URL is a conversation URL
    const isConversationUrl = (url) => {
        if (!url || typeof url !== 'string') return false;
        return /\/c\/[a-f0-9-]+/i.test(url) ||       // ChatGPT
               /\/chat\/[a-f0-9-]+/i.test(url) ||    // Claude
               /conversation.*[a-f0-9-]{8,}/i.test(url) ||
               /\/share\/[a-f0-9-]+/i.test(url) ||
               /app\/[a-f0-9]+/i.test(url);          // Gemini
    };

    if (chatMode === 'single') {
        for (const { instanceKey, service, instanceIndex, wc } of getEnabledSingleInstances()) {
            try {
                // Try executeJavaScript for SPA accuracy
                const actualUrl = await wc.executeJavaScript('window.location.href', true);
                const wcUrl = wc.getURL();
                const cachedUrl = lastKnownInstanceUrls[instanceKey];
                
                // Pick best URL: prefer conversation URLs
                let bestUrl = wcUrl;
                if (isConversationUrl(actualUrl)) {
                    bestUrl = actualUrl;
                } else if (isConversationUrl(cachedUrl)) {
                    bestUrl = cachedUrl;
                } else if (actualUrl) {
                    bestUrl = actualUrl;
                }
                
                console.log(`[URL Request] ${instanceKey}: actualUrl=${actualUrl}, cached=${cachedUrl}, picked=${bestUrl}`);
                
                if (bestUrl) {
                    mainWindow.webContents.send('single-instance-url-changed', {
                        instanceKey,
                        service,
                        instanceIndex,
                        url: bestUrl
                    });
                }
            } catch (e) {
                // Fallback
                const url = lastKnownInstanceUrls[instanceKey] || wc.getURL();
                if (url) {
                    mainWindow.webContents.send('single-instance-url-changed', {
                        instanceKey,
                        service,
                        instanceIndex,
                        url
                    });
                }
            }
        }
        return;
    }

    // Multi AI Mode
    for (const service of services) {
        if (views[service] && views[service].view && !views[service].view.webContents.isDestroyed()) {
            try {
                const wc = views[service].view.webContents;
                const actualUrl = await wc.executeJavaScript('window.location.href', true);
                const wcUrl = wc.getURL();
                const cachedUrl = lastKnownMultiUrls[service];
                
                let bestUrl = wcUrl;
                if (isConversationUrl(actualUrl)) {
                    bestUrl = actualUrl;
                } else if (isConversationUrl(cachedUrl)) {
                    bestUrl = cachedUrl;
                } else if (actualUrl) {
                    bestUrl = actualUrl;
                }
                
                if (bestUrl) {
                    mainWindow.webContents.send('webview-url-changed', { service, url: bestUrl });
                }
            } catch (e) {
                const url = lastKnownMultiUrls[service] || views[service].view.webContents.getURL();
                if (url) {
                    mainWindow.webContents.send('webview-url-changed', { service, url });
                }
            }
        }
    }
});

// Helper: canonical "reset/new chat" URL for each service
function getServiceResetUrl(service) {
    let url = serviceUrls[service];
    if (service === 'claude') {
        url = 'https://claude.ai/new';
    }
    // ChatGPT and Gemini use base URL which usually redirects to new chat
    // For ChatGPT, https://chatgpt.com/ is correct.
    // For Gemini, https://gemini.google.com/app is correct.
    return url;
}

/**
 * Navigate a webContents to `url` using in-page JavaScript (`window.location.href`)
 * instead of Electron's `loadURL()`. This preserves the existing page context (cookies,
 * TLS session, Referrer header) so Cloudflare sees a natural user navigation rather than
 * a cold top-level request, greatly reducing bot-challenge frequency.
 *
 * Falls back to `loadURL()` if executeJavaScript fails (e.g. page is a Cloudflare challenge
 * page or about:blank where JS execution is not possible).
 */
async function softNavigate(wc, url, label = '') {
    if (!wc || wc.isDestroyed()) return;
    try {
        await wc.executeJavaScript(`window.location.href = ${JSON.stringify(url)};`);
        if (label) console.log(`[SoftNav] ${label} → ${url}`);
    } catch (e) {
        // Fallback: page context may not support JS (challenge page, about:blank, etc.)
        console.warn(`[SoftNav] executeJavaScript failed for ${label}, falling back to loadURL:`, e?.message || e);
        wc.loadURL(url);
    }
}

/** True when URL path looks like a login / sign-in page (cookie sync should not treat as "landed on app" yet). */
function urlLooksLikeLoginPage(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return false;
    try {
        const p = new URL(urlStr).pathname.toLowerCase();
        if (p === '/login' || p.endsWith('/login')) return true;
        if (p.includes('/signin') || p.includes('/sign-in')) return true;
        if (p.includes('/auth/login')) return true;
        return false;
    } catch {
        return false;
    }
}

/** Force canonical URL navigation and wait until webContents stops loading. */
function loadUrlWithWait(wc, url, reason = 'navigate', timeoutMs = 12000) {
    return new Promise((resolve) => {
        if (!wc || wc.isDestroyed()) return resolve(false);

        let done = false;
        let timerId = null;

        const finish = (ok) => {
            if (done) return;
            done = true;
            if (timerId) clearTimeout(timerId);
            wc.removeListener('did-stop-loading', onStopLoading);
            resolve(ok);
        };

        const onStopLoading = () => finish(true);
        wc.on('did-stop-loading', onStopLoading);

        timerId = setTimeout(() => {
            console.warn(`[Gemini] Timed out waiting for load stop (${reason})`);
            finish(false);
        }, timeoutMs);

        try {
            wc.loadURL(url);
        } catch (e) {
            console.error(`[Gemini] loadURL failed (${reason}):`, e);
            finish(false);
        }
    });
}

async function forceGeminiResetNavigation(wc, reason) {
    const url = getServiceResetUrl('gemini');
    const ok = await loadUrlWithWait(wc, url, reason);
    if (ok && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    }
    return ok;
}

ipcMain.on('new-chat', () => {
    if (chatMode === 'single' && singleAiService) {
        const url = getServiceResetUrl(singleAiService);
        console.log(`[SingleAI] Resetting chat for all instances of ${singleAiService} to ${url}`);

        for (let i = 0; i < SINGLE_MODE_MAX_INSTANCES; i++) {
            const instanceKey = `${singleAiService}-${i}`;
            delete lastKnownInstanceUrls[instanceKey];
            console.log(`[SingleAI] Cleared lastKnownInstanceUrls[${instanceKey}] for new chat`);
        }

        (async () => {
            for (const { instanceKey, wc } of getEnabledSingleInstances()) {
                try {
                    console.log(`[SingleAI] Resetting chat for ${instanceKey} to ${url}`);
                    if (singleAiService === 'gemini') {
                        await forceGeminiResetNavigation(wc, `new-chat:${instanceKey}`);
                    } else {
                        await softNavigate(wc, url, `new-chat:${instanceKey}`);
                    }
                } catch (e) {
                    console.error(`[SingleAI] Failed to reset ${instanceKey}:`, e);
                }
            }
        })();
        return;
    }

    (async () => {
        for (const service of services) {
            if (!views[service] || !views[service].view) continue;
            const wc = views[service].view.webContents;
            if (!wc || wc.isDestroyed()) continue;
            const url = getServiceResetUrl(service);
            delete lastKnownMultiUrls[service];
            console.log(`[MultiAI] Cleared lastKnownMultiUrls[${service}] for new chat`);

            console.log(`Resetting chat for ${service} to ${url}`);
            if (service === 'gemini') {
                await forceGeminiResetNavigation(wc, 'new-chat:multi');
            } else {
                await softNavigate(wc, url, `new-chat:multi:${service}`);
            }
        }
    })();
});

ipcMain.on('new-chat-for-service', (event, service) => {
    if (!views[service]) return;
    const wc = views[service].view?.webContents;
    const url = getServiceResetUrl(service);
    delete lastKnownMultiUrls[service];
    console.log(`[MultiAI] Cleared lastKnownMultiUrls[${service}] for new chat`);

    if (service === 'gemini' && wc && !wc.isDestroyed()) {
        (async () => {
            console.log(`Resetting chat for ${service} to ${url}`);
            await forceGeminiResetNavigation(wc, 'new-chat-for-service');
        })();
    } else {
        console.log(`Resetting chat for ${service} to ${url}`);
        if (wc && !wc.isDestroyed()) softNavigate(wc, url, `new-chat-for-service:${service}`);
    }
});

ipcMain.on('reload-service', (event, service) => {
    if (views[service] && views[service].enabled) {
        console.log(`Reloading ${service}`);
        views[service].view.webContents.reload();
    }
});

// Navigate a specific service to a URL (for session restoration)
ipcMain.on('navigate-to-url', (event, service, url) => {
    if (views[service] && views[service].view && !views[service].view.webContents.isDestroyed()) {
        console.log(`Navigating ${service} to ${url}`);
        views[service].view.webContents.loadURL(url);
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
    const wcOverride = options && options.__wcOverride ? options.__wcOverride : null;
    if (!wcOverride) {
        if (!views[service] || !views[service].enabled) return null;
    }

    const config = selectorsConfig[service];
    if (!config) return null;

    let content = null;
    let method = 'none';
    const wc = wcOverride || views[service].view.webContents;

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

function getEnabledSingleInstances() {
    return Object.entries(singleModeViews)
        .filter(([_, v]) => v && v.enabled && v.view && !v.view.webContents.isDestroyed())
        .map(([instanceKey, v]) => ({
            instanceKey,
            service: v.service,
            instanceIndex: v.instanceIndex,
            wc: v.view.webContents
        }));
}

// Helper to extract ONLY the last AI response from a service (for Cross Check)
async function extractLastResponseFromService(service, options = {}) {
    const wcOverride = options && options.__wcOverride ? options.__wcOverride : null;
    if (!wcOverride) {
        if (!views[service] || !views[service].enabled) return null;
    }

    const config = selectorsConfig[service];
    if (!config) return null;

    let content = null;
    let method = 'none';
    const wc = wcOverride || views[service].view.webContents;

    // Service-specific overrides
    if (service === 'claude') {
        try {
            const script = `
                (function() {
                    // Get all AI responses
                    const aiResponses = document.querySelectorAll('[data-is-streaming], .font-claude-message');
                    
                    if (aiResponses.length === 0) {
                        // Backup check for just standard markdown blocks in deep structure
                        const deepMarkdown = document.querySelectorAll('.font-claude-response .standard-markdown');
                        if (deepMarkdown.length > 0) {
                            // This is harder to isolate to "last response" without a container, 
                            // so we'll rely on the main selectors first.
                            return null;
                        }
                        return null;
                    }
                    
                    // Get the last one
                    const lastResponse = aiResponses[aiResponses.length - 1];
                    
                    // Extract content similar to the full thread extraction
                    // 1. Get container
                    const container = lastResponse.closest('.font-claude-response') || lastResponse;
                    
                    // 2. Get markdown sections
                    const markdownSections = container.querySelectorAll('.standard-markdown');
                    
                    // 3. Get artifact blocks
                    const artifactBlocks = container.querySelectorAll('.artifact-block-cell, [class*="artifact"]');
                    
                    let combinedContent = '';
                    
                    if (markdownSections.length > 0) {
                        markdownSections.forEach(section => {
                            combinedContent += section.innerHTML + '\\n\\n';
                        });
                    } else {
                        // Fallback
                        const fallbackEl = lastResponse.querySelector('.font-claude-response') || lastResponse;
                        combinedContent = fallbackEl.innerHTML;
                    }
                    
                    // Add artifacts
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
                    
                    return combinedContent.trim() || null;
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
                return { service, content, method: 'claude-custom' };
            }
        } catch (e) {
            console.warn('Claude specific extraction failed, falling back to generic:', e);
        }
    }

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

async function buildChatThreadJsonForCPB({ anonymousMode = false } = {}) {
    if (chatMode === 'single' && singleAiService) {
        const enabledInstances = getEnabledSingleInstances().sort((a, b) => a.instanceIndex - b.instanceIndex);
        const aliases = ['(A)', '(B)', '(C)', '(D)'];
        const results = (await Promise.all(
            enabledInstances.map((inst) =>
                extractContentFromService(inst.service, { format: 'json', __wcOverride: inst.wc })
                    .then((r) => (r ? { ...r, instanceIndex: inst.instanceIndex } : null))
            )
        )).filter(Boolean);

        const jsonOutput = results.map((r) => ({
            instance: anonymousMode ? (aliases[r.instanceIndex] || `(${r.instanceIndex})`) : `#${r.instanceIndex + 1}`,
            service: r.service,
            content: r.content,
            method: r.method,
            timestamp: new Date().toISOString()
        }));
        return JSON.stringify(jsonOutput, null, 2);
    }

    const enabledServices = services.filter((service) => views[service] && views[service].enabled);
    const results = await Promise.all(enabledServices.map((service) => extractContentFromService(service, { format: 'json' })));
    results.sort((a, b) => services.indexOf(a.service) - services.indexOf(b.service));
    const aliases = {
        'chatgpt': 'Service A',
        'claude': 'Service B',
        'gemini': 'Service C',
        'grok': 'Service D',
        'perplexity': 'Service E',
        'genspark': 'Service F'
    };

    const jsonOutput = results.map((r) => ({
        service: anonymousMode ? (aliases[r.service] || r.service) : r.service,
        content: r.content,
        method: r.method,
        timestamp: new Date().toISOString()
    }));
    return JSON.stringify(jsonOutput, null, 2);
}

async function buildLastResponseJsonForCPB({ anonymousMode = false } = {}) {
    if (chatMode === 'single' && singleAiService) {
        const enabledInstances = getEnabledSingleInstances().sort((a, b) => a.instanceIndex - b.instanceIndex);
        const aliases = ['(A)', '(B)', '(C)', '(D)'];
        const results = (await Promise.all(
            enabledInstances.map((inst) =>
                extractLastResponseFromService(inst.service, { __wcOverride: inst.wc })
                    .then((r) => (r ? { ...r, instanceIndex: inst.instanceIndex } : null))
            )
        )).filter(Boolean);

        const jsonOutput = results
            .filter((r) => r && r.content)
            .map((r) => ({
                instance: anonymousMode ? (aliases[r.instanceIndex] || `(${r.instanceIndex})`) : `#${r.instanceIndex + 1}`,
                service: r.service,
                content: r.content,
                method: r.method,
                timestamp: new Date().toISOString()
            }));
        return jsonOutput.length ? JSON.stringify(jsonOutput, null, 2) : '';
    }

    const enabledServices = services.filter((service) => views[service] && views[service].enabled);
    const results = await Promise.all(enabledServices.map((service) => extractLastResponseFromService(service, {})));
    results.sort((a, b) => services.indexOf(a.service) - services.indexOf(b.service));
    const aliases = {
        'chatgpt': 'Service A',
        'claude': 'Service B',
        'gemini': 'Service C',
        'grok': 'Service D',
        'perplexity': 'Service E',
        'genspark': 'Service F'
    };

    const jsonOutput = results
        .filter((r) => r && r.content)
        .map((r) => ({
            service: anonymousMode ? (aliases[r.service] || r.service) : r.service,
            content: r.content,
            method: r.method,
            timestamp: new Date().toISOString()
        }));
    return jsonOutput.length ? JSON.stringify(jsonOutput, null, 2) : '';
}

ipcMain.on('copy-chat-thread', async (event, options = {}) => {
    const { format = 'markdown', anonymousMode = false } = options;

    // Single AI Mode: copy across enabled instances
    if (chatMode === 'single' && singleAiService) {
        const enabledInstances = getEnabledSingleInstances().sort((a, b) => a.instanceIndex - b.instanceIndex);
        const promises = enabledInstances.map(inst =>
            extractContentFromService(inst.service, { format, __wcOverride: inst.wc })
                .then(r => (r ? { ...r, instanceKey: inst.instanceKey, instanceIndex: inst.instanceIndex } : null))
        );
        const results = (await Promise.all(promises)).filter(Boolean);

        const aliases = ['(A)', '(B)', '(C)', '(D)'];
        let finalOutput = '';

        if (format === 'json') {
            const jsonOutput = results.map(r => ({
                instance: anonymousMode ? (aliases[r.instanceIndex] || `(${r.instanceIndex})`) : `#${r.instanceIndex + 1}`,
                service: r.service,
                content: r.content,
                method: r.method,
                timestamp: new Date().toISOString()
            }));
            finalOutput = JSON.stringify(jsonOutput, null, 2);
        } else {
            results.forEach(r => {
                const label = anonymousMode ? (aliases[r.instanceIndex] || `(${r.instanceIndex})`) : `#${r.instanceIndex + 1}`;
                const title = `${r.service.toUpperCase()} ${label}`;
                if (format === 'markdown') {
                    finalOutput += `# ${title}\n\n${r.content}\n\n---\n\n`;
                } else {
                    finalOutput += `=== ${title} ===\n${r.content}\n\n${'-'.repeat(40)}\n\n`;
                }
            });
        }

        if (finalOutput) {
            clipboard.writeText(finalOutput);
            if (mainWindow) {
                mainWindow.webContents.send('chat-thread-copied', {
                    success: results.map(r => r.instanceKey),
                    failed: [],
                    format
                });
            }
        }
        return;
    }

    // Multi AI Mode
    const enabledServices = services.filter(service => views[service] && views[service].enabled);
    const promises = enabledServices.map(service => extractContentFromService(service, { format }));
    const results = await Promise.all(promises);

    // Format and combine
    let finalOutput = '';
    const aliases = {
        'chatgpt': 'Service A',
        'claude': 'Service B',
        'gemini': 'Service C',
        'grok': 'Service D',
        'perplexity': 'Service E',
        'genspark': 'Service F'
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

    // Support both:
    // - Multi AI Mode: `service` is provider key (chatgpt/claude/...)
    // - Single AI Mode: `service` can be instanceKey (e.g. chatgpt-0)
    const isInstanceKey = typeof service === 'string' && /-\d$/.test(service);
    let result = null;

    if (isInstanceKey && singleModeViews[service] && singleModeViews[service].enabled) {
        const inst = singleModeViews[service];
        result = await extractContentFromService(inst.service, { format, __wcOverride: inst.view.webContents });
    } else {
        if (!views[service] || !views[service].enabled) {
            if (mainWindow) {
                mainWindow.webContents.send('single-chat-thread-copied', { service, success: false });
            }
            return;
        }
        result = await extractContentFromService(service, { format });
    }

    if (result && result.content) {
        const aliases = {
            'chatgpt': 'Service A',
            'claude': 'Service B',
            'gemini': 'Service C',
            'grok': 'Service D',
            'perplexity': 'Service E',
            'genspark': 'Service F'
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

    if (chatMode === 'single' && singleAiService) {
        const enabledInstances = getEnabledSingleInstances().sort((a, b) => a.instanceIndex - b.instanceIndex);
        const promises = enabledInstances.map(inst =>
            extractLastResponseFromService(inst.service, { __wcOverride: inst.wc })
                .then(r => (r ? { ...r, instanceKey: inst.instanceKey, instanceIndex: inst.instanceIndex } : null))
        );
        const results = (await Promise.all(promises)).filter(Boolean);

        const aliases = ['(A)', '(B)', '(C)', '(D)'];
        let finalOutput = '';

        if (format === 'json') {
            const jsonOutput = results.filter(r => r && r.content).map(r => ({
                instance: anonymousMode ? (aliases[r.instanceIndex] || `(${r.instanceIndex})`) : `#${r.instanceIndex + 1}`,
                service: r.service,
                content: r.content,
                method: r.method,
                timestamp: new Date().toISOString()
            }));
            finalOutput = JSON.stringify(jsonOutput, null, 2);
        } else {
            results.forEach(r => {
                if (r && r.content) {
                    const label = anonymousMode ? (aliases[r.instanceIndex] || `(${r.instanceIndex})`) : `#${r.instanceIndex + 1}`;
                    const title = `${r.service.toUpperCase()} ${label}`;
                    if (format === 'markdown') {
                        finalOutput += `# ${title}\n\n${r.content}\n\n---\n\n`;
                    } else {
                        finalOutput += `=== ${title} ===\n${r.content}\n\n${'-'.repeat(40)}\n\n`;
                    }
                }
            });
        }

        if (finalOutput) {
            clipboard.writeText(finalOutput);
            if (mainWindow) {
                mainWindow.webContents.send('last-response-copied', {
                    success: results.filter(r => r && r.content).map(r => r.instanceKey),
                    failed: results.filter(r => !r || !r.content).map(r => r ? r.instanceKey : 'unknown'),
                    format
                });
            }
        }
        return;
    }

    const enabledServices = services.filter(service => views[service] && views[service].enabled);
    const promises = enabledServices.map(service => extractLastResponseFromService(service, {}));
    const results = await Promise.all(promises);

    const aliases = {
        'chatgpt': 'Service A',
        'claude': 'Service B',
        'gemini': 'Service C',
        'grok': 'Service D',
        'perplexity': 'Service E',
        'genspark': 'Service F'
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

    if (chatMode === 'single' && singleAiService) {
        const enabledInstances = getEnabledSingleInstances().sort((a, b) => a.instanceIndex - b.instanceIndex);
        const aliases = ['(A)', '(B)', '(C)', '(D)'];

        // 1) Extract last response from each instance
        const results = {};
        for (const inst of enabledInstances) {
            const r = await extractLastResponseFromService(inst.service, { __wcOverride: inst.wc });
            if (r && r.content) {
                results[inst.instanceKey] = { content: r.content, instanceIndex: inst.instanceIndex };
            }
        }

        // 2) Construct and send prompt to each instance with others' responses
        const selectors = selectorsConfig[singleAiService];
        if (!selectors) return;

        for (const target of enabledInstances) {
            let prompt = '';
            if (promptPrefix) prompt += `${promptPrefix}\n\n`;

            for (const source of enabledInstances) {
                if (source.instanceKey === target.instanceKey) continue;
                const src = results[source.instanceKey];
                if (!src || !src.content) continue;

                const header = isAnonymousMode
                    ? (aliases[source.instanceIndex] || `(X)`)
                    : `#${source.instanceIndex + 1}`;
                prompt += `=== ${header} ===\n${src.content.trim()}\n\n`;
            }

            if (prompt) {
                try {
                    target.wc.send('inject-prompt', { text: prompt, selectors, autoSend: true, typingMode: 'human' });
                } catch (e) {
                    console.error(`[SingleAI] Cross-check send failed to ${target.instanceKey}:`, e);
                }
            }
        }
        return;
    }

    const aliases = {
        'chatgpt': '(A)',
        'claude': '(B)',
        'gemini': '(C)',
        'grok': '(D)',
        'perplexity': '(E)',
        'genspark': '(F)'
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
                    views[targetService].view.webContents.send('inject-prompt', { text: prompt, selectors, autoSend: true, typingMode: 'instant' });
                }
            }
        }
    }
});

// NOTE: legacy handler removed (duplicate channel name caused both listeners to fire).
// If you need raw-text copy in the future, add a new IPC channel name, e.g. 'copy-raw-text'.

// Scroll Sync State
let isScrollSyncEnabled = false;

ipcMain.on('toggle-scroll-sync', (event, isEnabled) => {
    isScrollSyncEnabled = isEnabled;
    // Broadcast to all views (multi + single)
    services.forEach(service => {
        if (views[service] && views[service].view) {
            views[service].view.webContents.send('scroll-sync-state', isScrollSyncEnabled);
        }
    });
    Object.keys(singleModeViews).forEach(instanceKey => {
        const v = singleModeViews[instanceKey];
        if (v && v.view && !v.view.webContents.isDestroyed()) {
            v.view.webContents.send('scroll-sync-state', isScrollSyncEnabled);
        }
    });
});

ipcMain.on('sync-scroll', (event, { deltaX, deltaY }) => {
    if (!isScrollSyncEnabled) return;

    // Broadcast to all OTHER views (multi + single)
    services.forEach(service => {
        if (views[service] && views[service].view) {
            // Don't send back to sender (optional optimization, but simple broadcast is fine if logic handles it)
            // But here we are in Main, we don't know easily which view sent it unless we check event.sender
            if (views[service].view.webContents !== event.sender) {
                views[service].view.webContents.send('apply-scroll', { deltaX, deltaY });
            }
        }
    });
    Object.keys(singleModeViews).forEach(instanceKey => {
        const v = singleModeViews[instanceKey];
        if (v && v.view && !v.view.webContents.isDestroyed()) {
            if (v.view.webContents !== event.sender) {
                v.view.webContents.send('apply-scroll', { deltaX, deltaY });
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

    applyZoomToAllViews();
});

/**
 * Resolves the executable path for external login: Chrome first, then Edge.
 * Returns { browser: 'chrome'|'edge', path: string } or null if neither is found.
 */
async function getExternalLoginBrowserInfo() {
    // 1. Try Chrome via chrome-launcher
    try {
        const chromeLauncher = await import('chrome-launcher');
        const installations = chromeLauncher.Launcher.getInstallations();
        if (installations && installations[0]) {
            const p = installations[0];
            if (fs.existsSync(p)) return { browser: 'chrome', path: p };
        }
    } catch (e) {
        console.warn('Chrome not found via chrome-launcher:', e?.message || e);
    }

    // 2. Try Edge (Chromium) - OS-specific paths
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    if (isWin) {
        const candidates = [
            process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
            process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
        ].filter(Boolean);
        for (const p of candidates) {
            if (fs.existsSync(p)) return { browser: 'edge', path: p };
        }
    } else if (isMac) {
        const edgePath = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
        if (fs.existsSync(edgePath)) return { browser: 'edge', path: edgePath };
    }
    return null;
}

ipcMain.handle('get-external-login-browser', async () => {
    const info = await getExternalLoginBrowserInfo();
    return info ? { browser: info.browser } : null;
});

/**
 * Clear persisted partition storage (cookies, localStorage, SW cache, etc.) for one AI service, then reload its webview(s).
 * Use before "Sign in with Chrome/Edge" for a clean cookie sync (Cloudflare cf_clearance + app session).
 *
 * IMPORTANT: Preserves Cloudflare `cf_clearance` cookies to avoid forcing a fresh bot challenge after every reset.
 * The cf_clearance cookie proves the browser already passed Turnstile; destroying it causes repeated challenge loops.
 */
ipcMain.handle('clear-service-partition-storage', async (_event, service) => {
    if (!services.includes(service)) {
        return { ok: false, error: 'invalid service' };
    }
    const partition = `persist:service-${service}`;
    const ses = session.fromPartition(partition);

    // Step 1: Save Cloudflare cf_clearance cookies before clearing (bot-challenge avoidance)
    let cfCookiesToRestore = [];
    try {
        const allCookies = await ses.cookies.get({});
        cfCookiesToRestore = allCookies.filter(c =>
            c.name === 'cf_clearance' || c.name === '_cf_bm' || c.name === '__cf_bm'
        );
        if (cfCookiesToRestore.length > 0) {
            console.log(`[${service}] Preserving ${cfCookiesToRestore.length} Cloudflare cookie(s) across partition clear`);
        }
    } catch (e) {
        console.warn(`[${service}] Failed to save Cloudflare cookies:`, e?.message || e);
    }

    // Step 2: Clear all storage
    try {
        await ses.clearStorageData({
            storages: [
                'cookies',
                'filesystem',
                'indexdb',
                'localstorage',
                'shadercache',
                'websql',
                'serviceworkers',
                'cachestorage'
            ]
        });
    } catch (e) {
        console.warn(`[${service}] clearStorageData:`, e?.message || e);
    }
    try {
        await ses.clearCache();
        await ses.cookies.flushStore();
    } catch (e) {
        console.warn(`[${service}] clearCache/flush:`, e?.message || e);
    }

    // Step 3: Restore Cloudflare cookies so the webview does not face a fresh challenge
    for (const cookie of cfCookiesToRestore) {
        try {
            const cleanDomain = (cookie.domain || '').startsWith('.') ? cookie.domain.substring(1) : (cookie.domain || '');
            const cookieUrl = `${cookie.secure ? 'https' : 'http'}://${cleanDomain}${cookie.path || '/'}`;
            await ses.cookies.set({
                url: cookieUrl,
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path || '/',
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                expirationDate: cookie.expirationDate,
                sameSite: cookie.sameSite || 'no_restriction'
            });
        } catch (e) {
            console.warn(`[${service}] Failed to restore Cloudflare cookie ${cookie.name}:`, e?.message || e);
        }
    }
    if (cfCookiesToRestore.length > 0) {
        try { await ses.cookies.flushStore(); } catch (_) {}
        console.log(`[${service}] Cloudflare cookies restored after partition clear`);
    }

    const targetUrl = serviceUrls[service];
    try {
        if (views[service]?.view?.webContents && !views[service].view.webContents.isDestroyed()) {
            views[service].view.webContents.loadURL(targetUrl);
        }
    } catch (_) { /* ignore */ }
    try {
        Object.keys(singleModeViews).forEach((instanceKey) => {
            const entry = singleModeViews[instanceKey];
            if (entry?.service === service && entry?.view?.webContents && !entry.view.webContents.isDestroyed()) {
                entry.view.webContents.loadURL(targetUrl);
            }
        });
    } catch (_) { /* ignore */ }
    console.log(`[${service}] Partition storage cleared: ${partition}`);
    return { ok: true };
});

// External Login Handler
ipcMain.on('external-login', async (event, service) => {
    const axios = require('axios');

    const isMac = process.platform === 'darwin'; // OS 확인 변수
    const isWin = process.platform === 'win32';

    const browserInfo = await getExternalLoginBrowserInfo();
    if (!browserInfo) {
        console.error('No Chrome or Edge installation found for external login');
        event.sender.send('external-login-unavailable');
        return;
    }

    const { browser: browserName, path: executablePath } = browserInfo;
    console.log(`Launching ${browserName === 'chrome' ? 'Chrome' : 'Edge'} for ${service} login...`);

    try {
        // Helper: collect cookies relevant to each service (captures Google SSO cookies too)
        const collectLoginCookies = async (page, service) => {
            let cookies = [];
            try {
                cookies = await page.cookies();
            } catch (e) {
                console.warn('Failed to fetch page cookies:', e);
            }

            // Always try service base URL cookies explicitly (can differ from current URL)
            try {
                const serviceBaseCookies = await page.cookies(serviceUrls[service]);
                cookies = [...cookies, ...serviceBaseCookies];
            } catch (e) {
                // ignore
            }

            // Google-based login cookies (accounts + gemini domains for one-shot sync)
            if (service === 'gemini' || service === 'genspark') {
                try {
                    const googleCookies = await page.cookies(
                        'https://accounts.google.com',
                        'https://google.com',
                        'https://www.google.com',
                        'https://gemini.google.com'
                    );
                    cookies = [...cookies, ...googleCookies];
                } catch (e) {
                    console.warn(`Failed to fetch Google cookies for ${service}:`, e);
                }
            }

            // Genspark domain cookies can be separate from Google cookies
            if (service === 'genspark') {
                try {
                    const gsCookies = await page.cookies(
                        'https://www.genspark.ai',
                        'https://genspark.ai'
                    );
                    cookies = [...cookies, ...gsCookies];
                } catch (e) {
                    // ignore
                }
            }

            // Claude: app + CDN subdomains + anthropic (cf_clearance, sessionKey, a.claude.ai storage cookies)
            if (service === 'claude') {
                try {
                    const claudeExtra = await page.cookies(
                        'https://claude.ai',
                        'https://www.claude.ai',
                        'https://a.claude.ai',
                        'https://anthropic.com',
                        'https://www.anthropic.com'
                    );
                    cookies = [...cookies, ...claudeExtra];
                } catch (e) {
                    console.warn('Failed to fetch extra cookies for Claude:', e);
                }
            }

            // Grok extra cookies (X + Google)
            if (service === 'grok') {
                try {
                    const extraCookies = await page.cookies(
                        'https://x.com',
                        'https://twitter.com',
                        'https://accounts.google.com',
                        'https://google.com'
                    );
                    cookies = [...cookies, ...extraCookies];
                } catch (e) {
                    console.warn('Failed to fetch extra cookies for Grok:', e);
                }
            }

            // Deduplicate by name+domain+path
            const seen = new Set();
            const unique = [];
            for (const c of cookies) {
                const key = `${c.name}|${c.domain || ''}|${c.path || ''}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(c);
                }
            }
            return unique;
        };

        // Helper: determine "logged-in" for each service based on cookie presence
        const isAuthCookiePresent = (service, cookies) => {
            if (!Array.isArray(cookies) || cookies.length === 0) return false;

            if (service === 'chatgpt') {
                // Based on user image: __Secure-next-auth.session-token, oai-did, _cf_bm
                return cookies.some(c => c.name === '__Secure-next-auth.session-token' || c.name === 'oai-did');
            }
            if (service === 'claude') {
                return cookies.some(c => c.name === 'sessionKey');
            }
            if (service === 'gemini') {
                // Based on user image: SID, _Secure-1PSID, __Secure-1PSID, _Secure-3PSID, __Secure-3PSID
                // Check for both single and double underscore variants to handle different cookie formats
                return cookies.some(c =>
                    c.name === 'SID' ||
                    c.name === '_Secure-1PSID' || c.name === '__Secure-1PSID' ||
                    c.name === '_Secure-3PSID' || c.name === '__Secure-3PSID' ||
                    c.name === '_Secure-1PAPISID' || c.name === '__Secure-1PAPISID' ||
                    c.name === '_Secure-3PAPISID' || c.name === '__Secure-3PAPISID'
                );
            }
            if (service === 'grok') {
                return cookies.some(c => c.name.includes('sso') || c.name === 'auth_token' || c.name.includes('grok'));
            }
            if (service === 'perplexity') {
                return cookies.some(c => c.name === '__Secure-next-auth.session-token');
            }
            if (service === 'genspark') {
                // Genspark relies on Google Login, so check Google auth cookies
                return cookies.some(c => c.name === '__Secure-1PSID' || c.name === '__Secure-3PSID' || c.name === 'SID');
            }
            return false;
        };

        const clearConflictingAuthCookies = async (service) => {
            if (!views[service] || !views[service].view) return;
            const electronCookies = views[service].view.webContents.session.cookies;

            // Each service uses its own partition, so this cleanup is scoped to that service only.
            // Remove likely-conflicting old auth cookies before importing fresh ones.
            const domainsForService = (() => {
                if (service === 'gemini') {
                    return ['gemini.google.com', 'accounts.google.com', 'google.com', 'www.google.com'];
                }
                if (service === 'genspark') {
                    return ['genspark.ai', 'www.genspark.ai', 'accounts.google.com', 'google.com'];
                }
                if (service === 'claude') {
                    return ['claude.ai', 'a.claude.ai', 'www.claude.ai', 'anthropic.com', 'www.anthropic.com'];
                }
                return [];
            })();
            if (domainsForService.length === 0) return;

            try {
                const existing = await electronCookies.get({});
                let removedCfCount = 0;
                for (const cookie of existing) {
                    const domain = (cookie.domain || '').replace(/^\./, '').toLowerCase();
                    const shouldRemove = domainsForService.some(d => domain === d || domain.endsWith(`.${d}`));
                    if (!shouldRemove) continue;

                    // Always remove stale Cloudflare cookies — they are bound to the
                    // TLS fingerprint (JA3/JA4) of the browser that passed the challenge
                    // and will be invalid in Electron's different TLS context.
                    const isCfCookie = cookie.name === 'cf_clearance' || cookie.name === '_cf_bm' || cookie.name === '__cf_bm';
                    if (isCfCookie) removedCfCount++;

                    const cookieUrl = `${cookie.secure ? 'https' : 'http'}://${domain || 'localhost'}${cookie.path || '/'}`;
                    try {
                        await electronCookies.remove(cookieUrl, cookie.name);
                    } catch (e) {
                        // ignore individual remove failures
                    }
                }
                if (removedCfCount > 0) {
                    console.log(`[${service}] Cleared ${removedCfCount} stale Cloudflare cookie(s) before sync`);
                }
            } catch (e) {
                console.warn(`[${service}] Failed to clear conflicting cookies:`, e?.message || e);
            }
        };

        const syncCookiesToElectron = async (service, cookies) => {
            if (!views[service] || !views[service].view) return;
            const electronCookies = views[service].view.webContents.session.cookies;

            // Clear old/invalid auth cookies first to avoid mixed-cookie state (important for Gemini)
            await clearConflictingAuthCookies(service);

            // Filter out Cloudflare cookies from Chrome — they are bound to Chrome's
            // TLS fingerprint (JA3/JA4) and will be rejected by Cloudflare in Electron's
            // different TLS context, causing infinite challenge loops. The webview must
            // pass the Cloudflare challenge on its own to get a valid cf_clearance.
            const cfCookieNames = new Set(['cf_clearance', '_cf_bm', '__cf_bm']);
            const filteredCookies = cookies.filter(c => !cfCookieNames.has(c.name));
            const skippedCf = cookies.length - filteredCookies.length;
            if (skippedCf > 0) {
                console.log(`[${service}] Skipped ${skippedCf} Cloudflare cookie(s) from Chrome (TLS fingerprint mismatch)`);
            }

            for (const cookie of filteredCookies) {
                try {
                    // Determine URL based on cookie domain
                    let cookieUrl = serviceUrls[service];
                    if (cookie.domain) {
                        const cleanDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
                        cookieUrl = (cookie.secure ? 'https://' : 'http://') + cleanDomain + '/';
                    }

                    // Map SameSite to Electron-accepted values
                    const mapSameSite = (value, isSecure) => {
                        const normalized = (value || '').toLowerCase();
                        if (normalized === 'no_restriction' || normalized === 'none') return 'no_restriction';
                        if (normalized === 'lax') return 'lax';
                        if (normalized === 'strict') return 'strict';
                        // Fallback: match Chrome behavior (None requires secure)
                        return isSecure ? 'no_restriction' : 'lax';
                    };

                    const cookieDetails = {
                        url: cookieUrl,
                        name: cookie.name,
                        value: cookie.value,
                        domain: cookie.domain,
                        path: cookie.path || '/',
                        secure: cookie.secure,
                        httpOnly: cookie.httpOnly,
                        // Explicitly set SameSite policy for proper cookie context
                        sameSite: mapSameSite(cookie.sameSite, cookie.secure)
                    };

                    // Persist ALL cookies across app restarts (including session cookies).
                    // Google's SIDTS family cookies are session-only (expires: -1) but required
                    // for authentication. Electron/Chromium discards session cookies on exit,
                    // so we convert them to persistent cookies with a 30-day expiry.
                    // This mirrors Chrome's "Continue where you left off" behavior.
                    if (typeof cookie.expires === 'number' && cookie.expires > 0) {
                        cookieDetails.expirationDate = cookie.expires;
                    } else {
                        cookieDetails.expirationDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
                    }

                    // Fix for __Host- prefix: Must NOT have a domain attribute
                    if (cookie.name.startsWith('__Host-')) {
                        delete cookieDetails.domain;
                    }

                    await electronCookies.set(cookieDetails);
                } catch (err) {
                    console.error(`Failed to set cookie ${cookie.name}:`, err?.message || err);
                }
            }

            // Ensure cookie writes are flushed to disk before reloading service URL.
            try {
                await electronCookies.flushStore();
                const sessionConverted = filteredCookies.filter(c => !(typeof c.expires === 'number' && c.expires > 0)).length;
                console.log(`[${service}] Cookie sync complete: ${filteredCookies.length} synced (${skippedCf} CF skipped), ${sessionConverted} session→persistent converted, flushed to disk`);
            } catch (e) {
                console.warn(`[${service}] Cookie flush warning:`, e?.message || e);
            }
        };

        const clearGeminiRuntimeCaches = async (service) => {
            if (service !== 'gemini') return;
            if (!views[service] || !views[service].view) return;

            try {
                const ses = views[service].view.webContents.session;
                await ses.clearStorageData({
                    origin: 'https://gemini.google.com',
                    storages: ['serviceworkers', 'cachestorage']
                });
            } catch (e) {
                console.warn('[gemini] Failed to clear runtime caches:', e?.message || e);
            }
        };

        // 0. Cleanup existing external-login browser instances (Mac specific)
        if (isMac) {
            try {
                const { execSync } = require('child_process');
                execSync('pkill -f "chrome-auth-profile"');
                execSync('pkill -f "edge-auth-profile"');
                console.log('Cleaned up existing external login browser instances');
            } catch (e) {
                // Ignore error if no process found
            }
        }

        const userDataDirName = browserName === 'chrome' ? 'chrome-auth-profile' : 'edge-auth-profile';
        const userDataDir = path.join(app.getPath('userData'), userDataDirName);

        const puppeteer = require('puppeteer-extra');
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        const stealth = StealthPlugin();

        puppeteer.use(stealth);

        // Launch Chrome or Edge with Remote Debugging
        const launchArgs = [
            '--no-first-run',
            '--no-default-browser-check',
        ];

        // Do NOT pass --disable-blink-features=AutomationControlled: Chrome shows an "unsupported flag" warning and
        // Cloudflare/bot systems treat it as an automation signal. puppeteer-extra stealth + ignoreDefaultArgs
        // (--enable-automation) are sufficient for manual login.

        const browser = await puppeteer.launch({
            executablePath,
            headless: false,
            defaultViewport: null,
            userDataDir,
            ignoreDefaultArgs: ['--enable-automation'],
            args: launchArgs
        });

        const page = (await browser.pages())[0];

        // Track latest cookies so we can sync even if user closes Chrome quickly after login
        let lastSeenCookies = [];
        let lastAuthCookies = [];
        let didSyncCookies = false;
        let lastSyncedCookieCount = 0; // Re-sync when Chrome has more cookies (e.g. after full login → gemini.google.com)
        // Track if user actually completed login in Chrome (not just had old cookies in profile)
        let loginConfirmedInChrome = false;
        let lastObservedUrl = '';
        let lastObservedIsNotLoginPage = false;
        let loginCheckInFlight = false;

        // NOTE: We do NOT sync cookies on framenavigated anymore.
        // Problem: Chrome profile may have stale/invalid cookies from previous sessions.
        // If we sync on navigation, we may sync invalid cookies before user actually logs in.
        // Instead, we only sync when polling detects login AND user is on a non-login page.

        await page.goto(serviceUrls[service]);

        // Wait for page to stabilize before starting login detection.
        // This is CRITICAL for Google-based services (Gemini/Genspark):
        // - Chrome profile may have OLD/INVALID cookies from previous sessions
        // - If we check immediately, we might see those cookies + /app URL = false "login detected"
        // - But Chrome will redirect to login page within 1-2 seconds if cookies are invalid
        // - By waiting, we give Chrome time to redirect before we start checking
        const stabilizeDelay = (service === 'grok') ? 5000 : 
                               (service === 'gemini' || service === 'genspark') ? 3000 : 1000;
        console.log(`[${service}] Waiting ${stabilizeDelay}ms for page to stabilize...`);
        await new Promise(resolve => setTimeout(resolve, stabilizeDelay));

        const isOnServiceDomain = (url) => {
            if (service === 'gemini') return url.includes('gemini.google.com');
            if (service === 'genspark') return url.includes('genspark.ai');
            if (service === 'chatgpt') return url.includes('chatgpt.com') || url.includes('chat.openai.com');
            if (service === 'claude') return url.includes('claude.ai');
            if (service === 'grok') return url.includes('grok.com') || url.includes('x.com');
            if (service === 'perplexity') return url.includes('perplexity.ai');
            return !url.includes('accounts.google.com');
        };

        const geminiLoginDebug = process.env.SMC_GEMINI_LOGIN_DEBUG === '1' || process.env.SMC_GEMINI_LOGIN_DEBUG === 'true';

        // Shared login evaluation so both polling and fast navigation events can confirm login.
        const evaluateLoginState = async (source) => {
            if (loginCheckInFlight) return false;
            loginCheckInFlight = true;

            try {
                if (!browser || !browser.isConnected()) return false;

                const cookies = await collectLoginCookies(page, service);
                lastSeenCookies = cookies;
                const isLoggedIn = isAuthCookiePresent(service, cookies);
                if (isLoggedIn) {
                    lastAuthCookies = cookies;
                }

                const url = page.url();
                lastObservedUrl = url;
                const isNotLoginPage = isOnServiceDomain(url) &&
                    !urlLooksLikeLoginPage(url) &&
                    !url.includes('accounts.google.com') &&
                    !url.includes('sso');
                lastObservedIsNotLoginPage = isNotLoginPage;

                // For Gemini/Genspark: accept login as soon as auth cookies are present, even if still on accounts.google.com
                // (avoids requiring redirect to gemini.google.com before we sync — enables one-shot login)
                const acceptLogin = isLoggedIn && (
                    isNotLoginPage ||
                    (service === 'gemini' || service === 'genspark')
                );
                if (geminiLoginDebug && (service === 'gemini' || service === 'genspark')) {
                    const urlShort = url.length > 64 ? url.substring(0, 64) + '...' : url;
                    console.log(`[${service}-debug] ${source} url=${urlShort} isLoggedIn=${isLoggedIn} isNotLoginPage=${isNotLoginPage} acceptLogin=${acceptLogin} cookies=${cookies.length}`);
                }
                if (acceptLogin) {
                    if (!loginConfirmedInChrome) {
                        console.log(`${service} login detected in Chrome via ${source}! Syncing cookies...`);
                    }
                    loginConfirmedInChrome = true;

                    // Sync when: first time on service domain, OR (Gemini/Genspark) we're on service domain with more cookies than last sync.
                    // For Gemini/Genspark: do NOT sync on accounts.google.com (account chooser); sync only after landing on service domain so the webview gets the complete post-login cookie set. Re-sync whenever cookie count increases (e.g. after full login flow).
                    const firstSyncOk = didSyncCookies || (isNotLoginPage || (service !== 'gemini' && service !== 'genspark'));
                    const reSyncMore = (service === 'gemini' || service === 'genspark') && isNotLoginPage && cookies.length > lastSyncedCookieCount;
                    const shouldSync = (!didSyncCookies && firstSyncOk) || reSyncMore;
                    if (shouldSync) {
                        console.log(`[${service}] Syncing ${cookies.length} cookies...${lastSyncedCookieCount ? ` (re-sync, was ${lastSyncedCookieCount})` : ''}`);
                        await syncCookiesToElectron(service, cookies);
                        await clearGeminiRuntimeCaches(service);
                        didSyncCookies = true;
                        lastSyncedCookieCount = cookies.length;
                        console.log(`Cookies synced for ${service}`);

                        // Navigate to canonical service URL so DOM-based login detection updates immediately
                        const targetUrl = getServiceResetUrl(service);
                        if (views[service] && views[service].view) {
                            views[service].view.webContents.loadURL(targetUrl);
                        }
                    }
                    return true;
                }
                return false;
            } catch (e) {
                console.error(`[${service}] Error checking login status (${source}):`, e);
                return false;
            } finally {
                loginCheckInFlight = false;
            }
        };

        // Run once right after stabilization so fast-close after login is less likely to miss detection.
        await evaluateLoginState('initial');

        // 3. Monitor for Login Success (Cookie Check)
        const pollIntervalMs = (service === 'gemini' || service === 'genspark') ? 500 : 1000;
        const checkLogin = setInterval(async () => {
            if (browser.process().killed) {
                clearInterval(checkLogin);
                return;
            }
            await evaluateLoginState('poll');
        }, pollIntervalMs);

        // Fast path: detect login as soon as main-frame navigation lands on service domain.
        page.on('framenavigated', async (frame) => {
            try {
                if (frame !== page.mainFrame()) return;
                await evaluateLoginState('navigation');
            } catch (e) {
                // ignore
            }
        });

        // Handle manual close
        browser.on('disconnected', async () => {
            clearInterval(checkLogin);
            const geminiLoginDebug = process.env.SMC_GEMINI_LOGIN_DEBUG === '1' || process.env.SMC_GEMINI_LOGIN_DEBUG === 'true';
            console.log(`Chrome disconnected (closed by user). loginConfirmedInChrome=${loginConfirmedInChrome} didSyncCookies=${didSyncCookies} lastAuthCookies=${(lastAuthCookies || []).length} lastObservedUrl=${lastObservedUrl || '(none)'}`);
            if (geminiLoginDebug && (service === 'gemini' || service === 'genspark')) {
                console.log(`[${service}-debug] disconnect branch: loginConfirmedInChrome=${loginConfirmedInChrome} lastAuthCookies.length=${(lastAuthCookies || []).length} lastObservedIsNotLoginPage=${lastObservedIsNotLoginPage}`);
            }

            if (views[service] && views[service].view) {
                // CRITICAL FIX: Only navigate app view to /app if login was ACTUALLY confirmed in Chrome.
                // Problem scenario:
                // 1. User logs out in app webview (Electron cookies cleared)
                // 2. Opens Chrome - Chrome profile may still have OLD Google cookies
                // 3. If we sync those old cookies and navigate to /app, they're invalid → stuck on login
                // 4. Second attempt works because user actually logged in, making cookies valid
                //
                // Solution: Only sync cookies and navigate to /app if polling detected actual login.
                if (loginConfirmedInChrome) {
                    if (geminiLoginDebug && (service === 'gemini' || service === 'genspark')) {
                        console.log(`[${service}-debug] disconnect: branch=loginConfirmedInChrome`);
                    }
                    // User actually completed login in Chrome - sync and navigate
                    if (!didSyncCookies && Array.isArray(lastAuthCookies) && lastAuthCookies.length > 0) {
                        console.log(`[${service}] Syncing confirmed auth cookies (${lastAuthCookies.length})...`);
                        try {
                            await syncCookiesToElectron(service, lastAuthCookies);
                            await clearGeminiRuntimeCaches(service);
                            didSyncCookies = true;
                        } catch (e) {
                            // ignore
                        }
                    }

                    const targetUrl = getServiceResetUrl(service);
                    console.log(`[${service}] Login confirmed, loading: ${targetUrl}`);
                    views[service].view.webContents.loadURL(targetUrl);
                } else {
                    // Fallback 1: latest snapshot was on service domain with auth cookies
                    const likelyConfirmedBySnapshot =
                        lastObservedIsNotLoginPage &&
                        Array.isArray(lastSeenCookies) &&
                        isAuthCookiePresent(service, lastSeenCookies);
                    if (geminiLoginDebug && (service === 'gemini' || service === 'genspark')) {
                        console.log(`[${service}-debug] disconnect: branch=fallback1_check likelyConfirmedBySnapshot=${likelyConfirmedBySnapshot}`);
                    }
                    if (likelyConfirmedBySnapshot) {
                        console.log(`[${service}] Using last snapshot fallback (url=${lastObservedUrl})`);
                        try {
                            await syncCookiesToElectron(service, lastSeenCookies);
                            await clearGeminiRuntimeCaches(service);
                        } catch (e) {
                            // ignore
                        }
                        const targetUrl = getServiceResetUrl(service);
                        views[service].view.webContents.loadURL(targetUrl);
                            mainWindow?.webContents.send('external-login-closed');
                        return;
                    }

                    // Fallback 2 (Gemini/Genspark): we saw auth cookies at some point but never "confirmed"
                    // (e.g. user closed Chrome right after signing in on accounts.google.com). Sync anyway.
                    const fallback2 = (service === 'gemini' || service === 'genspark') &&
                        Array.isArray(lastAuthCookies) && lastAuthCookies.length > 0;
                    if (geminiLoginDebug && (service === 'gemini' || service === 'genspark')) {
                        console.log(`[${service}-debug] disconnect: branch=fallback2_check fallback2=${fallback2} lastAuthCookies.length=${(lastAuthCookies || []).length}`);
                    }
                    if (fallback2) {
                        console.log(`[${service}] Syncing on close: auth cookies were present (url=${lastObservedUrl})`);
                        try {
                            await syncCookiesToElectron(service, lastAuthCookies);
                            await clearGeminiRuntimeCaches(service);
                            const targetUrl = getServiceResetUrl(service);
                            views[service].view.webContents.loadURL(targetUrl);
                        } catch (e) {
                            console.warn(`[${service}] Sync on close failed:`, e?.message || e);
                            views[service].view.webContents.reload();
                        }
                            mainWindow?.webContents.send('external-login-closed');
                        return;
                    }

                    // User closed Chrome without completing login - just reload current view
                    if (geminiLoginDebug && (service === 'gemini' || service === 'genspark')) {
                        console.log(`[${service}-debug] disconnect: branch=no_login_reload`);
                    }
                    console.log(`[${service}] No login confirmed, reloading current view...`);
                    views[service].view.webContents.reload();
                }
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

// ===========================================
// Prompt Persistence (electron-store)
// ===========================================
ipcMain.handle('get-custom-prompts', async () => {
    try {
        return store.get(PROMPT_STORE_KEYS.customPrompts, []);
    } catch (e) {
        console.error('[Prompts] Failed to read custom prompts:', e);
        return [];
    }
});

ipcMain.handle('save-custom-prompts', async (event, prompts) => {
    try {
        if (Array.isArray(prompts)) {
            store.set(PROMPT_STORE_KEYS.customPrompts, prompts);
        }
        return true;
    } catch (e) {
        console.error('[Prompts] Failed to save custom prompts:', e);
        return false;
    }
});

ipcMain.handle('get-predefined-prompt', async () => {
    try {
        return store.get(PROMPT_STORE_KEYS.predefinedPrompt, null);
    } catch (e) {
        console.error('[Prompts] Failed to read predefined prompt:', e);
        return null;
    }
});

ipcMain.handle('save-predefined-prompt', async (event, promptText) => {
    try {
        if (typeof promptText === 'string') {
            store.set(PROMPT_STORE_KEYS.predefinedPrompt, promptText);
        }
        return true;
    } catch (e) {
        console.error('[Prompts] Failed to save predefined prompt:', e);
        return false;
    }
});

// ===========================================
// Custom Prompt Builder - Global Variables
// ===========================================
ipcMain.handle('get-custom-prompt-global-vars', async () => {
    try {
        return store.get(PROMPT_STORE_KEYS.customPromptGlobalVars, []);
    } catch (e) {
        console.error('[CPB] Failed to read global vars:', e);
        return [];
    }
});

ipcMain.handle('save-custom-prompt-global-vars', async (event, vars) => {
    try {
        if (Array.isArray(vars)) {
            store.set(PROMPT_STORE_KEYS.customPromptGlobalVars, vars);
        }
        return true;
    } catch (e) {
        console.error('[CPB] Failed to save global vars:', e);
        return false;
    }
});

// ===========================================
// Custom Prompt Builder - System Variables (runtime)
// ===========================================
ipcMain.handle('get-system-vars-for-cpb', async (event, options = {}) => {
    try {
        const anonymousMode = !!options.anonymousMode;
        // Keep CPB system vars aligned with main toolbar "Copy ... (JSON)" outputs.
        const chatThread = await buildChatThreadJsonForCPB({ anonymousMode });
        const lastResponse = await buildLastResponseJsonForCPB({ anonymousMode });

        return {
            chat_thread: chatThread || '',
            last_response: lastResponse || '',
            current_time: new Date().toISOString()
        };
    } catch (e) {
        console.error('[CPB] Failed to collect system vars:', e);
        return {
            chat_thread: '',
            last_response: '',
            current_time: new Date().toISOString()
        };
    }
});

// ===========================================
// Chat Mode IPC Handlers (Single AI / Multi AI)
// ===========================================

ipcMain.handle('set-chat-mode', async (event, mode, config = {}) => {
    try {
        console.log(`[ChatMode] set-chat-mode called: mode=${mode}`, config);
        
        if (mode === 'single') {
            const { service, activeInstances: rawInstances = [true, true, true], urls = null } = config;
            // Ensure max SINGLE_MODE_MAX_INSTANCES
            const activeInstances = rawInstances.slice(0, SINGLE_MODE_MAX_INSTANCES);
            
            if (!service || !services.includes(service)) {
                console.error(`[ChatMode] Invalid service: ${service}`);
                return { success: false, error: 'Invalid service' };
            }
            switchToSingleAiMode(service, activeInstances, urls);
            return { success: true, mode: 'single', service, activeInstances };
        } else {
            switchToMultiAiMode();
            return { success: true, mode: 'multi' };
        }
    } catch (e) {
        console.error('[ChatMode] Error setting chat mode:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('get-chat-mode', async () => {
    return {
        mode: chatMode,
        service: singleAiService,
        activeInstances: singleAiActiveInstances
    };
});

// Return current URLs directly from WebContentsView webContents using executeJavaScript for SPA accuracy
ipcMain.handle('get-current-urls', async () => {
    console.log('[Session] get-current-urls called, chatMode:', chatMode);
    console.log('[Session] lastKnownInstanceUrls:', JSON.stringify(lastKnownInstanceUrls));
    console.log('[Session] lastKnownMultiUrls:', JSON.stringify(lastKnownMultiUrls));
    
    // Helper: Check if URL is a conversation URL (not just base URL)
    const isConversationUrl = (url) => {
        if (!url || typeof url !== 'string') return false;
        return /\/c\/[a-f0-9-]+/i.test(url) ||       // ChatGPT
               /\/chat\/[a-f0-9-]+/i.test(url) ||    // Claude
               /conversation.*[a-f0-9-]{8,}/i.test(url) ||
               /\/share\/[a-f0-9-]+/i.test(url);
    };
    
    // Helper: Pick the best URL (prefer conversation URLs over base URLs)
    const pickBestUrl = (actualUrl, cachedUrl, wcUrl) => {
        // If actual URL is a conversation URL, use it
        if (isConversationUrl(actualUrl)) return actualUrl;
        // If cached URL is a conversation URL, prefer it over base actualUrl
        if (isConversationUrl(cachedUrl)) return cachedUrl;
        // Otherwise fall back to actualUrl or wcUrl
        return actualUrl || cachedUrl || wcUrl;
    };
    
    try {
        if (chatMode === 'single') {
            const urls = {};
            const entries = Object.entries(singleModeViews).filter(([_, v]) => 
                v && v.enabled && v.view && !v.view.webContents.isDestroyed()
            );
            
            console.log('[Session] Single mode entries count:', entries.length);
            
            // Use executeJavaScript to get actual location.href (handles SPA pushState)
            for (const [instanceKey, v] of entries) {
                try {
                    // Try to get actual location.href from page context
                    const actualUrl = await v.view.webContents.executeJavaScript('window.location.href', true);
                    const wcUrl = v.view.webContents.getURL();
                    const cachedUrl = lastKnownInstanceUrls[instanceKey];
                    
                    // Pick the best URL (prefer conversation URL)
                    const bestUrl = pickBestUrl(actualUrl, cachedUrl, wcUrl);
                    urls[instanceKey] = bestUrl;
                    
                    console.log(`[Session] ${instanceKey}: executeJS=${actualUrl}, cached=${cachedUrl}, picked=${bestUrl}`);
                    
                    // Update lastKnown only if we got a conversation URL
                    if (isConversationUrl(actualUrl)) {
                        lastKnownInstanceUrls[instanceKey] = actualUrl;
                    }
                } catch (e) {
                    console.error(`[Session] executeJavaScript failed for ${instanceKey}:`, e.message);
                    // Fallback if executeJavaScript fails
                    urls[instanceKey] = lastKnownInstanceUrls[instanceKey] || v.view.webContents.getURL();
                }
            }
            
            console.log('[Session] get-current-urls (single) result:', JSON.stringify(urls));
            return { mode: 'single', urls };
        }

        const urls = {};
        const activeServices = services.filter(service => 
            views[service] && views[service].enabled && views[service].view && !views[service].view.webContents.isDestroyed()
        );
        
        console.log('[Session] Multi mode active services:', activeServices);
        
        // Use executeJavaScript for Multi AI Mode as well
        for (const service of activeServices) {
            try {
                const actualUrl = await views[service].view.webContents.executeJavaScript('window.location.href', true);
                const wcUrl = views[service].view.webContents.getURL();
                const cachedUrl = lastKnownMultiUrls[service];
                
                const bestUrl = pickBestUrl(actualUrl, cachedUrl, wcUrl);
                urls[service] = bestUrl;
                
                console.log(`[Session] ${service}: executeJS=${actualUrl}, cached=${cachedUrl}, picked=${bestUrl}`);
                
                if (isConversationUrl(actualUrl)) {
                    lastKnownMultiUrls[service] = actualUrl;
                }
            } catch (e) {
                console.error(`[Session] executeJavaScript failed for ${service}:`, e.message);
                urls[service] = lastKnownMultiUrls[service] || views[service].view.webContents.getURL();
            }
        }
        
        console.log('[Session] get-current-urls (multi) result:', JSON.stringify(urls));
        return { mode: 'multi', urls };
    } catch (e) {
        console.error('[Session] get-current-urls failed:', e);
        return { mode: chatMode, urls: {} };
    }
});

// SPA-safe URL updates from service-preload (pushState/replaceState/popstate polling)
ipcMain.on('service-url-updated', (event, payload) => {
    try {
        const { service, instanceKey, url } = payload || {};
        console.log(`[URL] service-url-updated received: service=${service}, instanceKey=${instanceKey}, url=${url}`);
        if (!url) return;
        
        // Helper: Check if URL is a conversation URL
        const isConversationUrl = (u) => {
            if (!u || typeof u !== 'string') return false;
            return /\/c\/[a-f0-9-]+/i.test(u) ||       // ChatGPT
                   /\/chat\/[a-f0-9-]+/i.test(u) ||    // Claude
                   /conversation.*[a-f0-9-]{8,}/i.test(u) ||
                   /\/share\/[a-f0-9-]+/i.test(u);
        };
        
        if (instanceKey) {
            // Only update cache if new URL is a conversation URL OR if there's no cached URL
            const existingUrl = lastKnownInstanceUrls[instanceKey];
            const shouldUpdate = isConversationUrl(url) || !isConversationUrl(existingUrl);
            
            if (shouldUpdate) {
                console.log(`[URL] Storing in lastKnownInstanceUrls[${instanceKey}] = ${url}`);
                lastKnownInstanceUrls[instanceKey] = url;
            } else {
                console.log(`[URL] NOT storing base URL over conversation URL for ${instanceKey}. Keeping: ${existingUrl}`);
            }
            
            const viewObj = singleModeViews[instanceKey];
            const instanceIndex = viewObj?.instanceIndex;
            const svc = service || viewObj?.service;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('single-instance-url-changed', {
                    instanceKey,
                    service: svc,
                    instanceIndex,
                    url
                });
            }
        } else if (service) {
            // Only update cache if new URL is a conversation URL OR if there's no cached URL
            const existingUrl = lastKnownMultiUrls[service];
            const shouldUpdate = isConversationUrl(url) || !isConversationUrl(existingUrl);
            
            if (shouldUpdate) {
                console.log(`[URL] Storing in lastKnownMultiUrls[${service}] = ${url}`);
                lastKnownMultiUrls[service] = url;
            } else {
                console.log(`[URL] NOT storing base URL over conversation URL for ${service}. Keeping: ${existingUrl}`);
            }
            
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('webview-url-changed', { service, url });
            }
        } else {
            console.log('[URL] No instanceKey or service provided, URL not stored');
        }
    } catch (e) {
        console.error('[URL] service-url-updated failed:', e);
    }
});

ipcMain.on('toggle-single-instance', (event, instanceIndex, enabled) => {
    console.log(`[ChatMode] toggle-single-instance: index=${instanceIndex}, enabled=${enabled}`);
    toggleSingleInstance(instanceIndex, enabled);
});

// Single AI Mode: Send prompt to instances
ipcMain.on('send-prompt-to-instances', async (event, text, instanceKeys, filePaths = []) => {
    console.log(`[SingleAI] Sending prompt to instances:`, instanceKeys, 'hasFiles:', filePaths?.length > 0);
    
    const hasFiles = filePaths && filePaths.length > 0;

    // Send sequentially with jitter to avoid "bot-like burst" behavior
    const orderedKeys = [...instanceKeys].sort();
    for (const instanceKey of orderedKeys) {
        const viewObj = singleModeViews[instanceKey];
        if (!(viewObj && viewObj.view && viewObj.enabled && !viewObj.view.webContents.isDestroyed())) {
            continue;
        }

        // Small stagger between instances
        await sleep(jitterMs(SINGLE_PROMPT_STAGGER_BASE_DELAY_MS, SINGLE_PROMPT_STAGGER_JITTER_MS));

        try {
            const service = viewObj.service;
            const selectors = selectorsConfig[service];

            if (!selectors) {
                console.error(`[SingleAI] No selectors config for service: ${service}`);
                continue;
            }

            const wc = viewObj.view.webContents;

            // 1) File uploads (if present)
            if (hasFiles && selectors.fileInputSelector) {
                try {
                    console.log(`[SingleAI] Uploading files to ${instanceKey}...`);
                    try {
                        wc.debugger.attach('1.3');
                    } catch (err) {
                        console.log(`[SingleAI] Debugger already attached for ${instanceKey}`);
                    }

                    await wc.debugger.sendCommand('DOM.enable');
                    const { root } = await wc.debugger.sendCommand('DOM.getDocument');

                    let nodeId = null;
                    for (const selector of selectors.fileInputSelector) {
                        try {
                            const result = await wc.debugger.sendCommand('DOM.querySelector', {
                                nodeId: root.nodeId,
                                selector: selector
                            });
                            if (result.nodeId) {
                                nodeId = result.nodeId;
                                break;
                            }
                        } catch (e) { /* ignore */ }
                    }

                    if (nodeId) {
                        await wc.debugger.sendCommand('DOM.setFileInputFiles', {
                            nodeId: nodeId,
                            files: filePaths
                        });
                        console.log(`[SingleAI] Files set for ${instanceKey}`);
                        await sleep(jitterMs(1400, 300));
                    } else {
                        console.warn(`[SingleAI] File input not found for ${instanceKey}`);
                    }

                    try { wc.debugger.detach(); } catch (e) { /* ignore */ }
                } catch (uploadErr) {
                    console.error(`[SingleAI] Error uploading files to ${instanceKey}:`, uploadErr);
                    try { wc.debugger.detach(); } catch (e) { /* ignore */ }
                }
            }

            // 2) Inject prompt
            wc.send('inject-prompt', { text, selectors, autoSend: !hasFiles, typingMode: 'human' });
            console.log(`[SingleAI] Sent prompt to ${instanceKey}`);

        } catch (e) {
            console.error(`[SingleAI] Failed to send to ${instanceKey}:`, e);
        }
    }
    
    if (hasFiles) {
        // Notify file upload complete
        event.sender.send('file-upload-complete');
    }
});

ipcMain.on('navigate-instance', (event, instanceKey, url) => {
    if (singleModeViews[instanceKey] && singleModeViews[instanceKey].view && 
        !singleModeViews[instanceKey].view.webContents.isDestroyed()) {
        console.log(`[SingleAI] Navigating ${instanceKey} to ${url}`);
        singleModeViews[instanceKey].view.webContents.loadURL(url);
    }
});

ipcMain.on('reload-instance', (event, instanceKey) => {
    if (singleModeViews[instanceKey] && singleModeViews[instanceKey].view &&
        singleModeViews[instanceKey].enabled && !singleModeViews[instanceKey].view.webContents.isDestroyed()) {
        console.log(`[SingleAI] Reloading ${instanceKey}`);
        singleModeViews[instanceKey].view.webContents.reload();
    }
});

ipcMain.on('new-chat-for-instance', (event, instanceKey) => {
    if (singleModeViews[instanceKey] && singleModeViews[instanceKey].view &&
        !singleModeViews[instanceKey].view.webContents.isDestroyed()) {
        const service = singleModeViews[instanceKey].service;
        const url = getServiceResetUrl(service);
        console.log(`[SingleAI] New chat for ${instanceKey}: ${url}`);
        if (service === 'gemini') {
            singleModeViews[instanceKey].view.webContents.loadURL(url);
        } else {
            softNavigate(singleModeViews[instanceKey].view.webContents, url, `new-chat-for-instance:${instanceKey}`);
        }
    }
});

// Update view bounds to handle Single AI Mode
ipcMain.on('update-single-view-bounds', (event, boundsMap) => {
    if (!mainWindow || chatMode !== 'single') return;

    Object.entries(boundsMap).forEach(([instanceKey, rect]) => {
        if (singleModeViews[instanceKey] && singleModeViews[instanceKey].view) {
            singleModeViews[instanceKey].view.setBounds({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
            });
        }
    });
});

ipcMain.on('status-update', (event, { isLoggedIn }) => {
    if (isGeminiSessionDebug()) {
        const slotKey = getSlotKeyForGeminiWebContents(event.sender);
        if (slotKey && !isLoggedIn) {
            console.log('[gemini] Preload reported not logged in (session may have expired) slotKey=', slotKey);
        }
    }
});

// ========================================
// Cloudflare Challenge Detection & Auto-Retry
// ========================================
// When a service webview hits a Cloudflare challenge (Turnstile / "Just a moment"),
// we wait for it to auto-resolve. If it doesn't within a timeout, we reload once.
// This avoids the user needing to manually intervene for transient challenges.

const cfChallengeTimers = new Map(); // key = webContents.id, value = timeoutId

ipcMain.on('cloudflare-challenge-detected', (event, { service, instanceKey, count }) => {
    const wcId = event.sender.id;
    console.log(`[CF] Challenge detected: service=${service}, instanceKey=${instanceKey || 'multi'}, count=${count}`);

    // Notify renderer to show challenge indicator
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cloudflare-challenge-status', {
            service, instanceKey, active: true
        });
    }

    // Auto-reload after 20s if challenge doesn't resolve on its own.
    // Allow up to 3 retries per webContents; counter resets when challenge resolves.
    if (!cfChallengeTimers.has(wcId) && count <= 3) {
        const timerId = setTimeout(async () => {
            cfChallengeTimers.delete(wcId);
            if (event.sender.isDestroyed()) return;

            // Before reloading, clear any stale cf_clearance that may be causing
            // Cloudflare to reject us (e.g. leftover from Chrome sync with wrong TLS fingerprint).
            try {
                const ses = event.sender.session;
                const allCookies = await ses.cookies.get({});
                for (const c of allCookies) {
                    if (c.name === 'cf_clearance' || c.name === '_cf_bm' || c.name === '__cf_bm') {
                        const domain = (c.domain || '').replace(/^\./, '');
                        const cookieUrl = `${c.secure ? 'https' : 'http'}://${domain}${c.path || '/'}`;
                        await ses.cookies.remove(cookieUrl, c.name);
                    }
                }
                console.log(`[CF] Cleared stale CF cookies before retry for ${service}`);
            } catch (e) {
                console.warn(`[CF] Failed to clear CF cookies:`, e?.message || e);
            }

            console.log(`[CF] Auto-reloading ${service} after challenge timeout (attempt ${count})`);
            event.sender.reload();
        }, 20000);
        cfChallengeTimers.set(wcId, timerId);
    }
});

ipcMain.on('cloudflare-challenge-resolved', (event, { service, instanceKey }) => {
    const wcId = event.sender.id;
    console.log(`[CF] Challenge resolved: service=${service}, instanceKey=${instanceKey || 'multi'}`);

    // Cancel pending auto-reload
    const timerId = cfChallengeTimers.get(wcId);
    if (timerId) {
        clearTimeout(timerId);
        cfChallengeTimers.delete(wcId);
    }

    // Notify renderer to hide challenge indicator
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cloudflare-challenge-status', {
            service, instanceKey, active: false
        });
    }
});


ipcMain.on('set-service-visibility', (event, isVisible) => {
    console.log(`Setting service visibility to: ${isVisible}, chatMode: ${chatMode}`);
    
    if (chatMode === 'single') {
        // Single AI Mode: Handle singleModeViews
        Object.keys(singleModeViews).forEach(instanceKey => {
            if (singleModeViews[instanceKey] && singleModeViews[instanceKey].enabled && singleModeViews[instanceKey].view) {
                if (isVisible) {
                    try {
                        mainWindow.contentView.addChildView(singleModeViews[instanceKey].view);
                    } catch (e) {
                        console.error(`Failed to show single view for ${instanceKey}:`, e);
                    }
                } else {
                    try {
                        mainWindow.contentView.removeChildView(singleModeViews[instanceKey].view);
                    } catch (e) {
                        console.error(`Failed to hide single view for ${instanceKey}:`, e);
                    }
                }
            }
        });
    } else {
        // Multi AI Mode: Handle views
        Object.keys(views).forEach(service => {
            if (views[service] && views[service].enabled && views[service].view) {
                if (isVisible) {
                    try {
                        mainWindow.contentView.addChildView(views[service].view);
                    } catch (e) {
                        console.error(`Failed to show view for ${service}:`, e);
                    }
                } else {
                    try {
                        mainWindow.contentView.removeChildView(views[service].view);
                    } catch (e) {
                        console.error(`Failed to hide view for ${service}:`, e);
                    }
                }
            }
        });
    }
});

app.whenReady().then(() => {
    // Load saved session state (SESS-003)
    const savedState = store.get('sessionState', defaultSessionState);
    currentLayout = savedState.layout || '1x4';
    savedSessionUrls = savedState.serviceUrls || {}; // Load saved URLs for createServiceView
    isAnonymousMode = savedState.isAnonymousMode || false;
    
    // Restore Chat Mode state
    chatMode = savedState.chatMode || 'multi';
    if (chatMode === 'single' && savedState.singleAiConfig) {
        singleAiService = savedState.singleAiConfig.service;
        // Ensure max 3 instances (migration from older 4-instance sessions)
        const restored = savedState.singleAiConfig.activeInstances || [true, true, true];
        singleAiActiveInstances = restored.slice(0, SINGLE_MODE_MAX_INSTANCES);
        
        // Pre-populate lastKnownInstanceUrls with saved URLs to enable URL protection
        if (savedState.singleAiConfig.urls) {
            for (const [instanceKey, url] of Object.entries(savedState.singleAiConfig.urls)) {
                lastKnownInstanceUrls[instanceKey] = url;
                console.log(`[Session] Pre-populated lastKnownInstanceUrls[${instanceKey}] = ${url}`);
            }
        }
    }
    
    console.log('[Session] Loaded saved state:', savedState);
    console.log('[Session] Chat mode:', chatMode, 'singleAiService:', singleAiService);

    createWindow();

    // Send saved state to renderer after window is ready
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('apply-saved-state', savedState);
    });

    // Initialize auto-updater (only in production/packaged mode)
    if (app.isPackaged) {
        initAutoUpdater(mainWindow);
        
        // Check for updates 3 seconds after app starts
        setTimeout(() => {
            console.log('[Updater] Starting initial update check...');
            checkForUpdates();
        }, 3000);
    } else {
        console.log('[Updater] Skipping update check in development mode');
    }
});

// Save session state function (reusable for close and quit events)
function saveSessionState() {
    const sessionState = {
        serviceUrls: {},
        layout: currentLayout,
        activeServices: [],
        isAnonymousMode: isAnonymousMode,
        isScrollSyncEnabled: isScrollSyncEnabled,
        // Chat Mode state
        chatMode: chatMode,
        singleAiConfig: null,
        multiAiConfig: null
    };

    if (chatMode === 'single' && singleAiService) {
        // Single AI Mode: Save instance URLs (limited to SINGLE_MODE_MAX_INSTANCES)
        const instanceUrls = {};
        Object.entries(singleModeViews).forEach(([instanceKey, viewObj]) => {
            if (viewObj && viewObj.view && !viewObj.view.webContents.isDestroyed()) {
                // Only save instances within the limit
                const idx = parseInt(instanceKey.split('-').pop(), 10);
                if (idx < SINGLE_MODE_MAX_INSTANCES) {
                    instanceUrls[instanceKey] = viewObj.view.webContents.getURL();
                }
            }
        });
        
        sessionState.singleAiConfig = {
            service: singleAiService,
            // Ensure only SINGLE_MODE_MAX_INSTANCES are saved
            activeInstances: singleAiActiveInstances.slice(0, SINGLE_MODE_MAX_INSTANCES),
            urls: instanceUrls
        };
        console.log('[Session] Single AI Mode config:', sessionState.singleAiConfig);
    } else {
        // Multi AI Mode: Collect URLs from all WebContentsViews (SESS-002)
        services.forEach(service => {
            if (views[service] && views[service].view && !views[service].view.webContents.isDestroyed()) {
                sessionState.serviceUrls[service] = views[service].view.webContents.getURL();
                if (views[service].enabled) {
                    sessionState.activeServices.push(service);
                }
            }
        });

        // Enforce max 4 active services for persisted state
        if (sessionState.activeServices.length > 4) {
            sessionState.activeServices = services.filter(s => sessionState.activeServices.includes(s)).slice(0, 4);
        }
        
        sessionState.multiAiConfig = {
            activeServices: [...sessionState.activeServices],
            urls: { ...sessionState.serviceUrls }
        };
    }

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
    const cappedActive = Array.isArray(uiState.activeServices) ? uiState.activeServices.slice(0, 4) : uiState.activeServices;
    store.set('sessionState', {
        ...savedState,
        isAnonymousMode: uiState.isAnonymousMode,
        isScrollSyncEnabled: uiState.isScrollSyncEnabled,
        layout: uiState.layout,
        activeServices: cappedActive
    });
});

// IPC handler to get current saved state (SESS-003)
ipcMain.handle('get-saved-session', () => {
    return store.get('sessionState', defaultSessionState);
});

// Capture a region of the renderer as image and write to clipboard
ipcMain.handle('capture-element-image', async (event, rect) => {
    try {
        const image = await event.sender.capturePage({
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        });
        if (image.isEmpty()) return false;
        clipboard.writeImage(image);
        return true;
    } catch (err) {
        console.error('capture-element-image error:', err);
        return false;
    }
});

// Renderer calls this when it finished saving IndexedDB history during app close.
ipcMain.handle('app-close-ready', async () => {
    ipcMain.emit('__app-close-ready__');
    return { ok: true };
});

/* ─── BYOK Task System (Main Process) ─── */

const BYOK_STORE_KEY = 'byokApiKeys';
const runningTasks = new Map(); // sessionId -> { abortController, result }

/** Encrypt and store an API key */
ipcMain.handle('byok-save-api-key', async (event, providerId, apiKey) => {
    try {
        const keys = store.get(BYOK_STORE_KEY, {});
        if (!apiKey || apiKey.trim() === '') {
            delete keys[providerId];
        } else {
            if (safeStorage.isEncryptionAvailable()) {
                keys[providerId] = safeStorage.encryptString(apiKey).toString('base64');
            } else {
                keys[providerId] = Buffer.from(apiKey).toString('base64');
            }
        }
        store.set(BYOK_STORE_KEY, keys);
        return true;
    } catch (err) {
        console.error('byok-save-api-key error:', err);
        return false;
    }
});

/** Check if an API key exists for a provider */
ipcMain.handle('byok-has-api-key', async (event, providerId) => {
    // ChatGPT Subscription uses OAuth token stored separately
    if (providerId === 'chatgpt-sub') {
        return !!store.get('chatgptSubAccessToken');
    }
    const keys = store.get(BYOK_STORE_KEY, {});
    return !!keys[providerId];
});

/** Decrypt and return an API key (internal use only) */
function getDecryptedApiKey(providerId) {
    const keys = store.get(BYOK_STORE_KEY, {});
    const encrypted = keys[providerId];
    if (!encrypted) return null;
    try {
        if (safeStorage.isEncryptionAvailable()) {
            return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
        }
        return Buffer.from(encrypted, 'base64').toString('utf8');
    } catch {
        return null;
    }
}

/** Validate an API key by attempting a lightweight call */
ipcMain.handle('byok-validate-key', async (event, providerId, apiKey) => {
    try {
        const endpoints = {
            openai: { url: 'https://api.openai.com/v1/models', headers: { 'Authorization': `Bearer ${apiKey}` } },
            anthropic: { url: 'https://api.anthropic.com/v1/models', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } },
            xai: { url: 'https://api.x.ai/v1/models', headers: { 'Authorization': `Bearer ${apiKey}` } },
            deepseek: { url: 'https://api.deepseek.com/v1/models', headers: { 'Authorization': `Bearer ${apiKey}` } },
            openrouter: { url: 'https://openrouter.ai/api/v1/models', headers: { 'Authorization': `Bearer ${apiKey}` } },
        };
        const cfg = endpoints[providerId];
        if (!cfg) return true; // Cannot validate, assume valid

        const resp = await fetch(cfg.url, { headers: cfg.headers, signal: AbortSignal.timeout(10000) });
        return resp.ok;
    } catch {
        return false;
    }
});

/** Get available models for a provider */
ipcMain.handle('byok-get-models', async (event, providerId) => {
    const apiKey = getDecryptedApiKey(providerId);
    if (!apiKey) return [];

    try {
        const endpoints = {
            openai: { url: 'https://api.openai.com/v1/models', headers: { 'Authorization': `Bearer ${apiKey}` } },
            xai: { url: 'https://api.x.ai/v1/models', headers: { 'Authorization': `Bearer ${apiKey}` } },
            deepseek: { url: 'https://api.deepseek.com/v1/models', headers: { 'Authorization': `Bearer ${apiKey}` } },
            openrouter: { url: 'https://openrouter.ai/api/v1/models', headers: { 'Authorization': `Bearer ${apiKey}` } },
        };
        const cfg = endpoints[providerId];
        if (!cfg) return [];

        const resp = await fetch(cfg.url, { headers: cfg.headers, signal: AbortSignal.timeout(10000) });
        if (!resp.ok) return [];
        const data = await resp.json();
        let ids = (data.data || []).map((m) => m.id);

        // Filter chat-capable models for OpenAI (exclude embedding, whisper, tts, dall-e, etc.)
        if (providerId === 'openai') {
            ids = ids
                .filter(id => /^(gpt-|o[0-9]|chatgpt-)/.test(id) && !/(embed|whisper|tts|dall-e|audio|realtime|search)/.test(id))
                .sort((a, b) => {
                    const score = (v) => v.includes('5.4') ? 100 : v.includes('5.3') ? 95 : v.includes('5.2') ? 90 : v.includes('5.1') ? 85 : v.includes('5.') ? 80 : v.includes('4o') ? 70 : v.includes('o3') ? 60 : v.includes('o1') ? 50 : 0;
                    return score(b) - score(a) || a.localeCompare(b);
                });
        }

        // OpenRouter: filter to popular/known providers, sort by name
        if (providerId === 'openrouter') {
            const models = (data.data || []);
            const topProviders = ['openai', 'anthropic', 'google', 'meta-llama', 'deepseek', 'mistralai', 'cohere', 'qwen', 'x-ai'];
            ids = models
                .filter(m => {
                    const id = m.id || '';
                    return topProviders.some(p => id.startsWith(p + '/')) && !/(embed|whisper|tts|dall-e|audio|vision-preview|instruct$)/.test(id);
                })
                .sort((a, b) => {
                    // Sort by provider then by name (newest first)
                    const pa = (a.id || '').split('/')[0];
                    const pb = (b.id || '').split('/')[0];
                    if (pa !== pb) return topProviders.indexOf(pa) - topProviders.indexOf(pb);
                    return (b.id || '').localeCompare(a.id || '');
                })
                .map(m => m.id)
                .slice(0, 80);
        }

        return ids.slice(0, 50);
    } catch {
        return [];
    }
});

/** Fallback subscription models — used when Codex CLI models_cache.json is unavailable.
 *  IDs MUST match actual Codex CLI model slugs exactly. */
const FALLBACK_SUBSCRIPTION_MODELS = [
    { id: 'gpt-5.4', name: 'GPT-5.4' },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini' },
    { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex' },
    { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex' },
    { id: 'gpt-5.2', name: 'GPT-5.2' },
    { id: 'gpt-5.1-codex-max', name: 'GPT-5.1 Codex Max' },
    { id: 'gpt-5.1-codex-mini', name: 'GPT-5.1 Codex Mini' },
];

/** Generate display name from model slug: gpt-5.2-codex → GPT-5.2 Codex */
function formatModelDisplayName(slug) {
    return slug
        .replace(/^gpt-/, 'GPT-')
        .replace(/(GPT-[\d.]+)-(.+)/, (_, prefix, rest) =>
            `${prefix} ${rest.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`
        );
}

/** Read models from Codex CLI's models_cache.json (dynamic discovery) */
function readCodexModelsCache() {
    try {
        const fs = require('fs');
        const path = require('path');
        const codexDir = path.join(require('os').homedir(), '.codex');
        const cacheFile = path.join(codexDir, 'models_cache.json');
        if (!fs.existsSync(cacheFile)) return null;

        const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (!data.models || !Array.isArray(data.models)) return null;

        return data.models
            .filter(m => m.visibility === 'list')
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))
            .map(m => ({ id: m.slug, name: formatModelDisplayName(m.slug) }));
    } catch { return null; }
}

/** Get models available via ChatGPT Subscription — dynamic from Codex CLI or fallback */
ipcMain.handle('chatgpt-sub-get-models', async () => {
    const encrypted = store.get('chatgptSubAccessToken');
    if (!encrypted) return [];
    let token;
    try {
        token = safeStorage.isEncryptionAvailable()
            ? safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
            : Buffer.from(encrypted, 'base64').toString('utf8');
    } catch { return []; }
    if (!token) return [];

    // Try Codex CLI models_cache.json first (dynamic), fall back to hardcoded
    const codexModels = readCodexModelsCache();
    return codexModels || FALLBACK_SUBSCRIPTION_MODELS;
});

/** Start a task execution (streaming from BYOK API) */
/** Select workspace directory dialog */
ipcMain.handle('select-workspace-dir', async (event) => {
    const { dialog } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
        title: 'Select Workspace Directory',
    });
    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
    return null;
});

/** Open a file with the native default application */
ipcMain.handle('open-file-native', async (event, filePath) => {
    const { shell } = require('electron');
    try { await shell.openPath(filePath); return true; } catch { return false; }
});

/** Open the folder containing a file in Finder/Explorer */
ipcMain.handle('open-containing-folder', async (event, filePath) => {
    const { shell } = require('electron');
    shell.showItemInFolder(filePath);
    return true;
});

/** Check if Codex CLI or OpenAI CLI is installed */
ipcMain.handle('check-codex-cli', async () => {
    const { execSync } = require('child_process');
    const check = (cmd) => {
        try {
            const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim();
            return result || null;
        } catch { return null; }
    };
    const isWin = process.platform === 'win32';
    const codexPath = check(isWin ? 'where codex 2>nul' : 'which codex 2>/dev/null');
    const openaiPath = check(isWin ? 'where openai 2>nul' : 'which openai 2>/dev/null');
    return {
        codexInstalled: !!codexPath,
        openaiInstalled: !!openaiPath,
        codexPath: codexPath?.split('\n')[0] || openaiPath?.split('\n')[0] || null,
    };
});

/* ─── Skills & Connectors IPC ─── */
ipcMain.handle('skills-list', async (event, workspaceDir) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const skills = [];
        const disabled = store.get('skillsDisabled') || [];
        const scanDir = (d, source) => {
            if (!fs.existsSync(d)) return;
            try {
                const entries = fs.readdirSync(d, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;
                    const sf = path.join(d, entry.name, 'SKILL.md');
                    if (!fs.existsSync(sf)) continue;
                    try {
                        const content = fs.readFileSync(sf, 'utf8');
                        const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                        let name = entry.name, description = '';
                        if (fmMatch) {
                            const fm = fmMatch[1];
                            const nm = fm.match(/^name:\s*["']?(.+?)["']?\s*$/m);
                            const dm = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m);
                            if (nm) name = nm[1];
                            if (dm) description = dm[1];
                        }
                        skills.push({ name, description, location: sf, source, enabled: !disabled.includes(name) });
                    } catch {}
                }
            } catch {}
        };
        // Bundled skills (shipped with app)
        const appPath = app.getAppPath();
        scanDir(path.join(appPath, 'src', 'data', 'skills'), 'bundled');
        // Global user skills
        scanDir(path.join(require('os').homedir(), '.openyak', 'skills'), 'global');
        // Project-specific skills
        const dir = workspaceDir || process.cwd();
        if (dir) scanDir(path.join(dir, '.openyak', 'skills'), 'project');
        return skills;
    } catch { return []; }
});

ipcMain.handle('skills-list-files', async (event, skillLocation) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const skillDir = path.dirname(skillLocation);
        if (!fs.existsSync(skillDir)) return [];
        const result = [];
        const walk = (dir, prefix) => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        result.push({ name: entry.name, path: relPath, fullPath, type: 'directory' });
                        walk(fullPath, relPath);
                    } else {
                        const stat = fs.statSync(fullPath);
                        result.push({ name: entry.name, path: relPath, fullPath, type: 'file', size: stat.size, ext: path.extname(entry.name).toLowerCase() });
                    }
                }
            } catch {}
        };
        walk(skillDir, '');
        return result;
    } catch { return []; }
});

ipcMain.handle('skills-read-file', async (event, filePath) => {
    try {
        const fs = require('fs');
        const path = require('path');
        if (!fs.existsSync(filePath)) return { error: 'File not found' };
        const ext = path.extname(filePath).toLowerCase();
        const stat = fs.statSync(filePath);
        const binaryExts = ['.ttf', '.otf', '.woff', '.woff2', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.tar', '.gz', '.tgz', '.exe', '.dll', '.so', '.dylib'];
        if (binaryExts.includes(ext) || (ext === '.gz' && filePath.endsWith('.tar.gz')) || stat.size > 512 * 1024) {
            return { binary: true, name: path.basename(filePath), size: stat.size, ext };
        }
        return { binary: false, content: fs.readFileSync(filePath, 'utf8'), ext, name: path.basename(filePath) };
    } catch (err) { return { error: err.message }; }
});

ipcMain.handle('skills-toggle', async (event, name, enabled) => {
    const disabled = store.get('skillsDisabled') || [];
    if (enabled) {
        store.set('skillsDisabled', disabled.filter(n => n !== name));
    } else {
        if (!disabled.includes(name)) store.set('skillsDisabled', [...disabled, name]);
    }
    return { success: true };
});

ipcMain.handle('connectors-list', async () => {
    const catalog = [
        { id: 'slack', name: 'Slack', description: 'Send messages, search conversations, and manage channels', category: 'Communication' },
        { id: 'notion', name: 'Notion', description: 'Search pages, create databases, and manage workspace content', category: 'Productivity' },
        { id: 'ms365', name: 'Microsoft 365', description: 'Outlook, Teams, OneDrive, and Office apps access', category: 'Productivity' },
        { id: 'google-workspace', name: 'Google Workspace', description: 'Gmail, Google Calendar, Drive, and Docs access', category: 'Productivity' },
        { id: 'linear', name: 'Linear', description: 'Track issues, manage projects, and plan sprints', category: 'Productivity' },
        { id: 'asana', name: 'Asana', description: 'Manage tasks, projects, and team workflows', category: 'Productivity' },
        { id: 'github', name: 'GitHub', description: 'Manage repos, issues, pull requests, and code search', category: 'Developer Tools' },
        { id: 'atlassian', name: 'Atlassian', description: 'Access Jira issues, Confluence pages, and Bitbucket repos', category: 'Developer Tools' },
        { id: 'pagerduty', name: 'PagerDuty', description: 'Manage incidents, on-call schedules, and alerts', category: 'Developer Tools' },
        { id: 'datadog', name: 'Datadog', description: 'Query metrics, logs, and monitor infrastructure', category: 'Developer Tools' },
        { id: 'figma', name: 'Figma', description: 'Read designs, inspect components, and access design tokens', category: 'Design' },
        { id: 'canva', name: 'Canva', description: 'Create and manage designs, templates, and brand assets', category: 'Design' },
        { id: 'intercom', name: 'Intercom', description: 'Manage conversations, contacts, and help articles', category: 'CRM' },
        { id: 'hubspot', name: 'HubSpot', description: 'Access CRM contacts, deals, and marketing data', category: 'CRM' },
        { id: 'amplitude', name: 'Amplitude', description: 'Query product analytics, user behavior, and funnels', category: 'Analytics' },
        { id: 'similarweb', name: 'SimilarWeb', description: 'Access website traffic, competitor analysis, and market data', category: 'Analytics' },
    ];
    const enabled = store.get('connectorsEnabled') || [];
    return catalog.map(c => ({ ...c, enabled: enabled.includes(c.id) }));
});

ipcMain.handle('connectors-toggle', async (event, id, enabled) => {
    const list = store.get('connectorsEnabled') || [];
    if (enabled && !list.includes(id)) {
        store.set('connectorsEnabled', [...list, id]);
    } else if (!enabled) {
        store.set('connectorsEnabled', list.filter(c => c !== id));
    }
    return { success: true };
});

/* ─── ChatGPT Subscription OAuth PKCE ─── */
const http = require('http');
const OAUTH_CALLBACK_PORT = 1455;

const CHATGPT_OAUTH = {
    CLIENT_ID: 'app_EMoamEEZ73f0CkXaXp7hrann',
    AUTH_URL: 'https://auth.openai.com/oauth/authorize',
    TOKEN_URL: 'https://auth.openai.com/oauth/token',
    SCOPES: 'openid profile email offline_access',
    REDIRECT_URI: `http://localhost:${OAUTH_CALLBACK_PORT}/auth/callback`,
};

let _pendingOAuthFlow = null;
let _oauthCallbackServer = null;

function generatePKCE() {
    const crypto = require('crypto');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
}

/** Exchange authorization code for tokens and store them */
async function completeOAuthTokenExchange(code, codeVerifier) {
    const tokenResp = await fetch(CHATGPT_OAUTH.TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: CHATGPT_OAUTH.CLIENT_ID,
            code,
            redirect_uri: CHATGPT_OAUTH.REDIRECT_URI,
            code_verifier: codeVerifier,
        }),
    });

    if (!tokenResp.ok) {
        const errText = await tokenResp.text();
        throw new Error(`Token exchange failed: ${tokenResp.status} ${errText}`);
    }

    const tokens = await tokenResp.json();
    const accessToken = tokens.access_token;
    const idToken = tokens.id_token;

    let email = '';
    let accountId = '';
    if (idToken) {
        try {
            const parts = idToken.split('.');
            let b64 = parts[1];
            b64 += '='.repeat((4 - b64.length % 4) % 4);
            const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
            email = payload.email || '';
            // Extract chatgpt_account_id with 4-tier fallback (matches OpenYak)
            const authClaim = payload['https://api.openai.com/auth'] || {};
            accountId = authClaim.chatgpt_account_id
                || (authClaim.organizations?.[0]?.chatgpt_account_id)
                || (authClaim.organizations?.[0]?.id)
                || payload.chatgpt_account_id
                || authClaim.user_id
                || payload.sub
                || '';
        } catch {}
    }

    // Store tokens securely
    const encrypt = (str) => {
        if (safeStorage.isEncryptionAvailable()) return safeStorage.encryptString(str).toString('base64');
        return Buffer.from(str).toString('base64');
    };
    store.set('chatgptSubAccessToken', encrypt(accessToken));
    if (tokens.refresh_token) store.set('chatgptSubRefreshToken', encrypt(tokens.refresh_token));
    store.set('chatgptSubAccountId', accountId);
    store.set('chatgptSubEmail', email);

    return { email, accessToken, accountId };
}

/** Stop the OAuth callback HTTP server if running */
function stopOAuthCallbackServer() {
    if (_oauthCallbackServer) {
        _oauthCallbackServer.close();
        _oauthCallbackServer = null;
    }
}

/** Start a one-shot HTTP server on port 1455 for OAuth callback (like OpenYak) */
function startOAuthCallbackServer() {
    return new Promise((resolve) => {
        stopOAuthCallbackServer();

        const server = http.createServer(async (req, res) => {
            const reqUrl = new URL(req.url, `http://localhost:${OAUTH_CALLBACK_PORT}`);

            if (reqUrl.pathname === '/auth/callback') {
                const code = reqUrl.searchParams.get('code');
                const state = reqUrl.searchParams.get('state');

                if (!code || !_pendingOAuthFlow) {
                    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<html><body><h2>Authentication failed</h2><p>No authorization code received. Please try again.</p></body></html>');
                    return;
                }

                if (state && state !== _pendingOAuthFlow.state) {
                    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<html><body><h2>Authentication failed</h2><p>State mismatch. Please try again.</p></body></html>');
                    return;
                }

                try {
                    const result = await completeOAuthTokenExchange(code, _pendingOAuthFlow.codeVerifier);
                    _pendingOAuthFlow = null;

                    // Notify renderer of success
                    const wins = BrowserWindow.getAllWindows();
                    wins.forEach(w => w.webContents.send('chatgpt-sub-auth-complete', { success: true, ...result }));

                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`<html><body style="font-family:system-ui;text-align:center;padding:60px;">
                        <h2 style="color:#10a37f;">Authentication successful!</h2>
                        <p>Signed in as <strong>${result.email}</strong></p>
                        <p>You can close this tab and return to Sync Multi Chat.</p>
                        <script>setTimeout(()=>window.close(),3000)</script>
                    </body></html>`);
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`<html><body><h2>Authentication failed</h2><p>${err.message}</p></body></html>`);
                }

                // Close server after handling (one-shot)
                setTimeout(() => stopOAuthCallbackServer(), 1000);
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        server.on('error', (err) => {
            console.error('OAuth callback server error:', err.message);
            resolve(false);
        });

        server.listen(OAUTH_CALLBACK_PORT, '127.0.0.1', () => {
            console.log(`OAuth callback server listening on port ${OAUTH_CALLBACK_PORT}`);
            _oauthCallbackServer = server;
            resolve(true);
        });

        // Auto-close after 5 minutes
        setTimeout(() => stopOAuthCallbackServer(), 300000);
    });
}

ipcMain.handle('chatgpt-sub-login', async () => {
    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = require('crypto').randomBytes(16).toString('hex');

    // Start callback server BEFORE opening auth URL
    const serverStarted = await startOAuthCallbackServer();

    const params = new URLSearchParams({
        client_id: CHATGPT_OAUTH.CLIENT_ID,
        redirect_uri: CHATGPT_OAUTH.REDIRECT_URI,
        response_type: 'code',
        scope: CHATGPT_OAUTH.SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        id_token_add_organizations: 'true',
        codex_cli_simplified_flow: 'true',
        originator: 'codex',
    });

    const authUrl = `${CHATGPT_OAUTH.AUTH_URL}?${params.toString()}`;
    _pendingOAuthFlow = { codeVerifier, state };

    return { authUrl, callbackServerRunning: serverStarted };
});

/** Manual callback fallback (user pastes redirect URL) */
ipcMain.handle('chatgpt-sub-callback', async (event, callbackUrl) => {
    if (!_pendingOAuthFlow) return { success: false, error: 'No pending OAuth flow' };

    try {
        const url = new URL(callbackUrl);
        const code = url.searchParams.get('code');
        if (!code) return { success: false, error: 'No authorization code in URL' };

        const state = url.searchParams.get('state');
        if (state && state !== _pendingOAuthFlow.state) {
            return { success: false, error: 'State mismatch' };
        }

        const result = await completeOAuthTokenExchange(code, _pendingOAuthFlow.codeVerifier);
        _pendingOAuthFlow = null;
        stopOAuthCallbackServer();
        return { success: true, ...result };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

/** Start a task execution (multi-turn messages) */
ipcMain.on('task-start', async (event, params) => {
    const { sessionId, providerId, modelId, messages, executionMode, workspaceDir, activeSkills } = params;
    llmLog('START', `session=${sessionId}`, `provider=${providerId}`, `model=${modelId}`, `mode=${executionMode}`, `cwd=${workspaceDir || '(default)'}`, `msgs=${messages?.length || 0}`, `skills=${(activeSkills || []).join(',')}`);

    // Handle ChatGPT Subscription provider
    let apiKey;
    if (providerId === 'chatgpt-sub') {
        const encrypted = store.get('chatgptSubAccessToken');
        if (encrypted) {
            try {
                apiKey = safeStorage.isEncryptionAvailable()
                    ? safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
                    : Buffer.from(encrypted, 'base64').toString('utf8');
            } catch { apiKey = null; }
        }
    } else {
        apiKey = getDecryptedApiKey(providerId);
    }

    const win = BrowserWindow.fromWebContents(event.sender);

    if (!apiKey) {
        win?.webContents.send('task-stream-error', { sessionId, error: 'No API key configured for this provider.' });
        return;
    }

    const abortController = new AbortController();
    runningTasks.set(sessionId, { abortController, result: '', createdFiles: [] });

    // Build system prompt based on execution mode + environment context
    const modeInstructions = {
        plan: 'You are in plan mode. Explore and analyze only. Do not make any file changes. Describe what you would do.',
        ask: 'You are in ask-before-edits mode. Propose changes clearly and wait for user approval before making modifications.',
        auto: 'You are in auto-edit mode. You may make changes directly. Describe what you changed.',
    };
    const modeText = modeInstructions[executionMode] || modeInstructions.ask;
    const cwd = workspaceDir || process.cwd();
    const now = new Date();
    const envContext = [
        `Platform: ${process.platform} (${require('os').release()})`,
        `Working directory: ${cwd}`,
        `Current date: ${now.toISOString().split('T')[0]}`,
        `Current time: ${now.toTimeString().split(' ')[0]}`,
    ].join('\n');

    // Inject active skill content directly into system prompt
    let activeSkillSection = '';
    if (activeSkills && activeSkills.length > 0) {
        for (const name of activeSkills) {
            const skill = getSkillContent(name);
            if (skill) {
                activeSkillSection += `\n\n# Active Skill: ${skill.name}\n${skill.description ? `> ${skill.description}\n\n` : ''}${skill.content}`;
            }
        }
    }

    // List remaining available skills (not already active) for on-demand loading
    const allSkillNames = getActiveSkillNames(cwd);
    const remainingSkills = allSkillNames.filter(n => !(activeSkills || []).includes(n));
    const onDemandSection = remainingSkills.length > 0 ? `\n\n# Available Skills (on-demand)\nUse the 'skill' tool to load: ${remainingSkills.join(', ')}` : '';

    const systemPrompt = `You are a capable AI coding assistant. Act first, talk later. Be concise.\n\n${modeText}\n\n# Environment\n${envContext}${activeSkillSection}${onDemandSection}`;

    // Build API messages with system prompt
    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...(messages || []),
    ];

    try {
        if (providerId === 'chatgpt-sub') {
            // ChatGPT Subscription — uses WHAM Responses API, not standard OpenAI API
            const accountId = store.get('chatgptSubAccountId') || '';
            await streamWhamInMain(win, sessionId, apiKey, accountId, modelId, apiMessages, abortController.signal, executionMode);
        } else if (providerId === 'anthropic') {
            await streamAnthropicInMain(win, sessionId, apiKey, modelId, apiMessages, abortController.signal);
        } else if (providerId === 'google') {
            await streamGoogleInMain(win, sessionId, apiKey, modelId, apiMessages, abortController.signal);
        } else {
            const baseUrls = {
                openai: 'https://api.openai.com/v1/chat/completions',
                xai: 'https://api.x.ai/v1/chat/completions',
                deepseek: 'https://api.deepseek.com/v1/chat/completions',
                openrouter: 'https://openrouter.ai/api/v1/chat/completions',
            };
            const endpoint = baseUrls[providerId] || baseUrls.openai;
            await streamOpenAICompatInMain(win, sessionId, endpoint, apiKey, modelId, apiMessages, abortController.signal);
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            win?.webContents.send('task-stream-error', { sessionId, error: err.message });
        }
    } finally {
        runningTasks.delete(sessionId);
    }
});

/** Stop a running task */
ipcMain.on('task-stop', (event, sessionId) => {
    const task = runningTasks.get(sessionId);
    if (task?.abortController) {
        task.abortController.abort();
    }
});

/** Get state of a running task */
ipcMain.handle('task-get-state', (event, sessionId) => {
    const task = runningTasks.get(sessionId);
    if (task) return { state: 'running', result: task.result };
    return { state: 'done', result: '' };
});

async function streamOpenAICompatInMain(win, sessionId, endpoint, apiKey, modelId, messages, signal) {
    const reqHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    const reqBody = { model: modelId, messages: messages, stream: true };
    llmLog('REQ', 'POST', endpoint);
    llmLog('REQ-H', JSON.stringify(_maskHeaders(reqHeaders)));
    llmLog('REQ-B', JSON.stringify({ ...reqBody, messages: `[${messages.length} msgs]` }));

    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(reqBody),
        signal,
    });
    llmLog('RES', resp.status, resp.statusText);
    llmLog('RES-H', JSON.stringify(Object.fromEntries(resp.headers.entries())));
    if (!resp.ok) throw new Error(`API error: ${resp.status} ${resp.statusText}`);

    const task = runningTasks.get(sessionId);
    for await (const chunk of resp.body) {
        if (signal.aborted) break;
        const text = (chunk instanceof Uint8Array || Buffer.isBuffer(chunk)) ? Buffer.from(chunk).toString('utf8') : String(chunk);
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                        if (task) task.result += content;
                        win?.webContents.send('task-stream-chunk', { sessionId, chunk: content });
                    }
                } catch { /* skip malformed SSE */ }
            }
        }
    }
    win?.webContents.send('task-stream-done', { sessionId });
}

/** Refresh ChatGPT subscription OAuth token using refresh_token */
async function refreshChatGPTSubToken() {
    const encrypted = store.get('chatgptSubRefreshToken');
    if (!encrypted) throw new Error('No refresh token available');

    let refreshToken;
    try {
        refreshToken = safeStorage.isEncryptionAvailable()
            ? safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
            : Buffer.from(encrypted, 'base64').toString('utf8');
    } catch { throw new Error('Failed to decrypt refresh token'); }
    if (!refreshToken) throw new Error('Empty refresh token');

    const resp = await fetch(CHATGPT_OAUTH.TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: CHATGPT_OAUTH.CLIENT_ID,
            refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`Token refresh failed: HTTP ${resp.status}`);
    const tokens = await resp.json();

    // Persist refreshed tokens
    const encrypt = (str) => {
        if (safeStorage.isEncryptionAvailable()) return safeStorage.encryptString(str).toString('base64');
        return Buffer.from(str).toString('base64');
    };
    store.set('chatgptSubAccessToken', encrypt(tokens.access_token));
    if (tokens.refresh_token) store.set('chatgptSubRefreshToken', encrypt(tokens.refresh_token));

    return tokens.access_token;
}

/* ═══════════════════════════════════════════════════════════════
   LLM Session Debug Logging (SMC_LLM_SESSION_DEBUG=1)
   ═══════════════════════════════════════════════════════════════ */

const _llmDebug = process.env.SMC_LLM_SESSION_DEBUG === '1';

function _maskSecret(val) {
    if (!val || typeof val !== 'string') return val;
    if (val.length <= 12) return '***';
    return val.slice(0, 5) + '...' + val.slice(-4);
}

function _maskHeaders(headers) {
    const safe = { ...headers };
    if (safe['Authorization']) safe['Authorization'] = 'Bearer ' + _maskSecret(safe['Authorization'].replace('Bearer ', ''));
    if (safe['ChatGPT-Account-Id']) safe['ChatGPT-Account-Id'] = _maskSecret(safe['ChatGPT-Account-Id']);
    return safe;
}

function llmLog(tag, ...args) {
    if (!_llmDebug) return;
    const ts = new Date().toISOString().slice(11, 23);
    console.log(`[SMC-LLM ${ts}] [${tag}]`, ...args);
}

/* ═══════════════════════════════════════════════════════════════
   Permission Engine, Tool Registry, Skill System, Workspace Guard
   ═══════════════════════════════════════════════════════════════ */

/** Permission evaluation — last-match-wins algorithm (matches OpenYak permission.py) */
const PERMISSION_DEFAULTS = [
    { action: 'allow', permission: '*', pattern: '*' },
    { action: 'ask', permission: 'bash', pattern: '*' },
    { action: 'ask', permission: 'code_execute', pattern: '*' },
    { action: 'ask', permission: 'write', pattern: '*' },
    { action: 'ask', permission: 'edit', pattern: '*' },
];

const MODE_PERMISSION_PRESETS = {
    plan: [
        { action: 'deny', permission: 'bash', pattern: '*' },
        { action: 'deny', permission: 'code_execute', pattern: '*' },
        { action: 'deny', permission: 'write', pattern: '*' },
        { action: 'deny', permission: 'edit', pattern: '*' },
    ],
    ask: [
        { action: 'ask', permission: 'bash', pattern: '*' },
        { action: 'ask', permission: 'code_execute', pattern: '*' },
        { action: 'ask', permission: 'write', pattern: '*' },
        { action: 'ask', permission: 'edit', pattern: '*' },
    ],
    auto: [
        { action: 'allow', permission: 'bash', pattern: '*' },
        { action: 'allow', permission: 'code_execute', pattern: '*' },
        { action: 'allow', permission: 'write', pattern: '*' },
        { action: 'allow', permission: 'edit', pattern: '*' },
    ],
};

function _globMatch(value, pattern) {
    if (pattern === '*') return true;
    return value === pattern;
}

function evaluatePermission(toolName, executionMode, sessionOverrides) {
    const rules = [
        ...PERMISSION_DEFAULTS,
        ...(MODE_PERMISSION_PRESETS[executionMode] || MODE_PERMISSION_PRESETS.ask),
        ...(sessionOverrides || []),
    ];
    let result = 'deny';
    for (const rule of rules) {
        if (_globMatch(toolName, rule.permission) && _globMatch('*', rule.pattern)) {
            result = rule.action;
        }
    }
    return result;
}

/** Pending permission requests (IPC round-trip with renderer) */
const _pendingPermissions = new Map();

ipcMain.on('permission-respond', (event, reqId, decision, remember) => {
    const pending = _pendingPermissions.get(reqId);
    if (pending) {
        clearTimeout(pending.timer);
        _pendingPermissions.delete(reqId);
        const allowed = decision === 'allow';
        // Save override for this session if "Remember" was checked
        if (remember && pending.sessionId && pending.toolName) {
            const task = runningTasks.get(pending.sessionId);
            if (task) {
                if (!task.permissionOverrides) task.permissionOverrides = [];
                task.permissionOverrides.push({
                    action: allowed ? 'allow' : 'deny',
                    permission: pending.toolName,
                    pattern: '*',
                });
            }
        }
        pending.resolve(allowed);
    }
});

function askPermission(win, sessionId, toolName, args) {
    return new Promise((resolve) => {
        const reqId = require('crypto').randomBytes(8).toString('hex');
        const timer = setTimeout(() => {
            _pendingPermissions.delete(reqId);
            resolve(false); // auto-deny after 5 min
        }, 300000);
        _pendingPermissions.set(reqId, { resolve, timer, sessionId, toolName });
        const preview = toolName === 'bash' ? (args.command || '').slice(0, 500)
            : toolName === 'code_execute' ? (args.code || '').slice(0, 500)
            : toolName === 'write' ? `Write to: ${args.file_path || '?'}`
            : toolName === 'edit' ? `Edit: ${args.file_path || '?'}`
            : JSON.stringify(args).slice(0, 300);
        win?.webContents.send('permission-request', { reqId, sessionId, toolName, preview });
    });
}

/** Workspace path validation */
function validateWorkspacePath(filePath, workspaceDir) {
    if (!workspaceDir) return true;
    const path = require('path');
    const resolved = path.resolve(workspaceDir, filePath);
    return resolved.startsWith(path.resolve(workspaceDir));
}

/** ─── Skill Registry ─── */
let _skillCache = null;

function scanSkills(workspaceDir) {
    const fs = require('fs');
    const path = require('path');
    const skills = [];
    const disabled = store.get('skillsDisabled') || [];

    const scanDir = (dir, source) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const skillFile = path.join(dir, entry.name, 'SKILL.md');
            if (!fs.existsSync(skillFile)) continue;
            try {
                const content = fs.readFileSync(skillFile, 'utf8');
                const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                let name = entry.name;
                let description = '';
                if (fmMatch) {
                    const fm = fmMatch[1];
                    const nameMatch = fm.match(/^name:\s*["']?(.+?)["']?\s*$/m);
                    const descMatch = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m);
                    if (nameMatch) name = nameMatch[1];
                    if (descMatch) description = descMatch[1];
                }
                const body = fmMatch ? content.slice(fmMatch[0].length).trim() : content;
                skills.push({ name, description, location: skillFile, source, content: body, enabled: !disabled.includes(name) });
            } catch { /* skip unreadable skills */ }
        }
    };

    // Scan in priority order
    const appPath = app.getAppPath();
    scanDir(path.join(appPath, 'src', 'data', 'skills'), 'bundled');
    scanDir(path.join(require('os').homedir(), '.openyak', 'skills'), 'global');
    if (workspaceDir) {
        scanDir(path.join(workspaceDir, '.openyak', 'skills'), 'project');
    }

    _skillCache = skills;
    return skills;
}

function getActiveSkillNames(workspaceDir) {
    const skills = _skillCache || scanSkills(workspaceDir);
    return skills.filter(s => s.enabled).map(s => s.name);
}

function getSkillContent(name) {
    if (!_skillCache) return null;
    return _skillCache.find(s => s.name === name && s.enabled);
}

/** ─── Dynamic Tool Registry ─── */
const BUILTIN_TOOL_DEFS = [
    {
        type: 'function', name: 'bash',
        description: 'Execute a shell command locally and return stdout/stderr. Use for file system operations, git commands, installing packages, running scripts.',
        parameters: { type: 'object', properties: { command: { type: 'string', description: 'Shell command to execute' } }, required: ['command'] },
    },
    {
        type: 'function', name: 'code_execute',
        description: 'Execute Python code locally and return the output. Use for computations, data processing, file operations, and scripting tasks.',
        parameters: { type: 'object', properties: { code: { type: 'string', description: 'Python code to execute' } }, required: ['code'] },
    },
    {
        type: 'function', name: 'read',
        description: 'Read a file from the local filesystem. Returns file content with line numbers. Use offset and limit for large files.',
        parameters: { type: 'object', properties: { file_path: { type: 'string', description: 'Absolute or relative path to read' }, offset: { type: 'integer', description: 'Line number to start from (1-based)' }, limit: { type: 'integer', description: 'Max lines to read' } }, required: ['file_path'] },
    },
    {
        type: 'function', name: 'write',
        description: 'Write content to a file. Creates the file if it does not exist, overwrites if it does.',
        parameters: { type: 'object', properties: { file_path: { type: 'string', description: 'Path to write' }, content: { type: 'string', description: 'Content to write' } }, required: ['file_path', 'content'] },
    },
    {
        type: 'function', name: 'edit',
        description: 'Replace a specific string in a file. The old_string must match exactly.',
        parameters: { type: 'object', properties: { file_path: { type: 'string', description: 'Path to the file' }, old_string: { type: 'string', description: 'Text to find (exact match)' }, new_string: { type: 'string', description: 'Replacement text' } }, required: ['file_path', 'old_string', 'new_string'] },
    },
    {
        type: 'function', name: 'glob',
        description: 'Find files matching a glob pattern (e.g., "**/*.js"). Returns file paths.',
        parameters: { type: 'object', properties: { pattern: { type: 'string', description: 'Glob pattern' }, path: { type: 'string', description: 'Directory to search in' } }, required: ['pattern'] },
    },
    {
        type: 'function', name: 'grep',
        description: 'Search file contents for a regex pattern. Returns matching lines with file paths and line numbers.',
        parameters: { type: 'object', properties: { pattern: { type: 'string', description: 'Regex pattern to search' }, path: { type: 'string', description: 'Directory to search' }, glob: { type: 'string', description: 'Filter files by glob (e.g., "*.js")' } }, required: ['pattern'] },
    },
];

function getActiveToolDefinitions(workspaceDir) {
    const skillNames = getActiveSkillNames(workspaceDir);
    const tools = [...BUILTIN_TOOL_DEFS];
    if (skillNames.length > 0) {
        tools.push({
            type: 'function', name: 'skill',
            description: `Load a skill's detailed instructions by name. Available skills: ${skillNames.join(', ')}`,
            parameters: { type: 'object', properties: { name: { type: 'string', description: 'Skill name to load' } }, required: ['name'] },
        });
    }
    tools.push({ type: 'web_search' });
    return tools;
}

/** Execute a local tool call and return the output string */
async function executeLocalTool(name, args, workingDir) {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    const cwd = workingDir || process.cwd();
    const timeout = 30000;
    const maxOutput = 50000;

    // On Windows, force UTF-8 codepage for proper Korean/CJK output
    const isWin = process.platform === 'win32';
    const execOpts = { cwd, timeout, maxBuffer: 2 * 1024 * 1024, encoding: 'buffer' };

    const decodeOutput = (buf) => {
        if (!buf || buf.length === 0) return '(no output)';
        // Try UTF-8 first, fall back to system encoding
        return buf.toString('utf8').slice(0, maxOutput);
    };

    try {
        if (name === 'bash') {
            const cmd = args.command || '';
            const prefix = isWin ? 'chcp 65001 >nul && ' : '';
            const buf = execSync(`${prefix}${cmd}`, { ...execOpts, stdio: ['pipe', 'pipe', 'pipe'] });
            return decodeOutput(buf);
        } else if (name === 'code_execute') {
            const code = args.code || '';
            const pyCmd = isWin ? 'python' : 'python3';
            const prefix = isWin ? 'chcp 65001 >nul && ' : '';
            const buf = execSync(`${prefix}${pyCmd} -c ${JSON.stringify(code)}`, execOpts);
            return decodeOutput(buf);
        } else if (name === 'read') {
            const filePath = path.resolve(cwd, args.file_path || '');
            if (!validateWorkspacePath(filePath, workingDir)) return 'Error: Path outside workspace';
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            const offset = Math.max(0, (args.offset || 1) - 1);
            const limit = args.limit || 200;
            return lines.slice(offset, offset + limit).map((l, i) => `${offset + i + 1}\t${l}`).join('\n').slice(0, maxOutput);
        } else if (name === 'write') {
            const filePath = path.resolve(cwd, args.file_path || '');
            if (!validateWorkspacePath(filePath, workingDir)) return 'Error: Path outside workspace';
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, args.content || '', 'utf8');
            return `File written: ${filePath}`;
        } else if (name === 'edit') {
            const filePath = path.resolve(cwd, args.file_path || '');
            if (!validateWorkspacePath(filePath, workingDir)) return 'Error: Path outside workspace';
            const content = fs.readFileSync(filePath, 'utf8');
            if (!content.includes(args.old_string)) return 'Error: old_string not found in file';
            fs.writeFileSync(filePath, content.replace(args.old_string, args.new_string), 'utf8');
            return `File edited: ${filePath}`;
        } else if (name === 'glob') {
            const { globSync } = require('fs');
            const searchPath = args.path ? path.resolve(cwd, args.path) : cwd;
            // Use simple recursive readdir as globSync may not be available
            const results = [];
            const walk = (dir, depth) => {
                if (depth > 8 || results.length > 500) return;
                try {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const e of entries) {
                        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
                        const full = path.join(dir, e.name);
                        if (e.isDirectory()) walk(full, depth + 1);
                        else if (_simpleGlobMatch(e.name, args.pattern)) results.push(path.relative(cwd, full));
                    }
                } catch {}
            };
            walk(searchPath, 0);
            return results.join('\n').slice(0, maxOutput) || '(no matches)';
        } else if (name === 'grep') {
            const searchPath = args.path ? path.resolve(cwd, args.path) : cwd;
            const regex = new RegExp(args.pattern, 'gi');
            const fileGlob = args.glob || '*';
            const results = [];
            const walk = (dir, depth) => {
                if (depth > 6 || results.length > 200) return;
                try {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const e of entries) {
                        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
                        const full = path.join(dir, e.name);
                        if (e.isDirectory()) walk(full, depth + 1);
                        else if (_simpleGlobMatch(e.name, fileGlob)) {
                            try {
                                const lines = fs.readFileSync(full, 'utf8').split('\n');
                                lines.forEach((line, i) => {
                                    if (regex.test(line) && results.length < 200) {
                                        results.push(`${path.relative(cwd, full)}:${i + 1}: ${line.trim()}`);
                                    }
                                    regex.lastIndex = 0;
                                });
                            } catch {}
                        }
                    }
                } catch {}
            };
            walk(searchPath, 0);
            return results.join('\n').slice(0, maxOutput) || '(no matches)';
        } else if (name === 'skill') {
            const skill = getSkillContent(args.name);
            if (!skill) return `Skill '${args.name}' not found or disabled. Available: ${getActiveSkillNames(cwd).join(', ')}`;
            return `# Skill: ${skill.name}\n${skill.description ? `> ${skill.description}\n\n` : ''}${skill.content}`;
        }
        return `Unknown tool: ${name}`;
    } catch (err) {
        return `Error: ${err.message || err}`.slice(0, maxOutput);
    }
}

/** Snapshot files in workspace directory (shallow, non-recursive for speed) */
function snapshotWorkspaceFiles(workingDir) {
    const fs = require('fs');
    const path = require('path');
    const cwd = workingDir || process.cwd();
    const snapshot = new Map();
    try {
        const walk = (dir, depth) => {
            if (depth > 3) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
                if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__pycache__') continue;
                const full = path.join(dir, e.name);
                if (e.isDirectory()) { walk(full, depth + 1); continue; }
                try {
                    const stat = fs.statSync(full);
                    snapshot.set(full, stat.mtimeMs);
                } catch {}
            }
        };
        walk(cwd, 0);
    } catch {}
    return snapshot;
}

/** Track files created/modified by tool execution for artifact cards */
function trackCreatedFile(sessionId, toolName, args, output, workingDir, preSnapshot) {
    if (!output || output.startsWith('Error:')) return;
    const task = runningTasks.get(sessionId);
    if (!task) return;
    const fs = require('fs');
    const pathMod = require('path');
    const cwd = workingDir || process.cwd();

    if (toolName === 'write' || toolName === 'edit') {
        const filePath = args.file_path || '';
        if (!filePath) return;
        const resolvedPath = pathMod.resolve(cwd, filePath);
        _addTrackedFile(task, resolvedPath, toolName === 'write' ? 'created' : 'edited');
        return;
    }

    // For bash/code_execute: compare filesystem snapshot to detect new/modified files
    if ((toolName === 'bash' || toolName === 'code_execute') && preSnapshot) {
        try {
            const postSnapshot = snapshotWorkspaceFiles(workingDir);
            for (const [filePath, mtime] of postSnapshot) {
                const prevMtime = preSnapshot.get(filePath);
                if (prevMtime === undefined || mtime > prevMtime) {
                    _addTrackedFile(task, filePath, prevMtime === undefined ? 'created' : 'edited');
                }
            }
        } catch {}
    }
}

function _addTrackedFile(task, resolvedPath, action) {
    const fs = require('fs');
    const pathMod = require('path');
    if (!fs.existsSync(resolvedPath)) return;
    const alreadyTracked = task.createdFiles.some(f => f.path === resolvedPath);
    if (alreadyTracked) return;
    try {
        const stat = fs.statSync(resolvedPath);
        if (!stat.isFile()) return;
        task.createdFiles.push({
            path: resolvedPath,
            name: pathMod.basename(resolvedPath),
            ext: pathMod.extname(resolvedPath).toLowerCase(),
            size: stat.size,
            action,
        });
    } catch {}
}

function _simpleGlobMatch(filename, pattern) {
    if (pattern === '*') return true;
    // Simple *.ext matching
    if (pattern.startsWith('*.')) return filename.endsWith(pattern.slice(1));
    if (pattern.startsWith('**/*.')) return filename.endsWith(pattern.slice(3));
    return filename.includes(pattern.replace(/\*/g, ''));
}

/** Parse WHAM SSE stream — returns { toolCalls[], error } */
async function parseWhamStream(resp, win, sessionId, signal) {
    const task = runningTasks.get(sessionId);
    // item_id -> { id (fc_xxx), call_id (call_xxx), name, arguments }
    const toolCallAccumulators = {};
    const pendingToolCalls = [];
    let lineBuf = '';

    for await (const chunk of resp.body) {
        if (signal?.aborted) return { toolCalls: [], error: true };
        const text = (chunk instanceof Uint8Array || Buffer.isBuffer(chunk)) ? Buffer.from(chunk).toString('utf8') : String(chunk);
        lineBuf += text;
        const lines = lineBuf.split('\n');
        lineBuf = lines.pop() || '';

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
                const event = JSON.parse(data);
                const eventType = event.type || '';

                llmLog('SSE', eventType, eventType.includes('delta') ? `[${(event.delta || '').length} chars]` : '');

                // Reasoning / thinking events
                if (eventType === 'response.created' || eventType === 'response.in_progress') {
                    win?.webContents.send('task-stream-thinking', { sessionId, chunk: '', event: 'start' });
                } else if (eventType === 'response.reasoning_summary_text.delta'
                    || eventType === 'response.reasoning_summary_part.delta'
                    || eventType === 'response.reasoning.delta') {
                    const delta = event.delta || '';
                    if (delta) {
                        win?.webContents.send('task-stream-thinking', { sessionId, chunk: delta });
                    }
                } else if (eventType === 'response.output_text.delta') {
                    const delta = event.delta || '';
                    if (delta) {
                        if (task) task.result += delta;
                        win?.webContents.send('task-stream-chunk', { sessionId, chunk: delta });
                    }
                } else if (eventType === 'response.output_item.added') {
                    const item = event.item || {};
                    if (item.type === 'function_call') {
                        win?.webContents.send('task-stream-thinking', { sessionId, chunk: `\nTool: ${item.name || 'unknown'}...\n` });
                        toolCallAccumulators[item.id] = {
                            id: item.id,
                            call_id: item.call_id || item.id,
                            name: item.name || '',
                            arguments: '',
                        };
                    }
                } else if (eventType === 'response.function_call_arguments.delta') {
                    const acc = toolCallAccumulators[event.item_id];
                    if (acc) acc.arguments += (event.delta || '');
                } else if (eventType === 'response.function_call_arguments.done') {
                    const acc = toolCallAccumulators[event.item_id];
                    if (acc) {
                        pendingToolCalls.push({ id: acc.id, call_id: acc.call_id, name: acc.name, arguments: acc.arguments });
                        delete toolCallAccumulators[event.item_id];
                    }
                } else if (eventType === 'response.completed') {
                    const output = event.response?.output || [];
                    for (const item of output) {
                        if (item.type === 'function_call' && !pendingToolCalls.find(tc => tc.id === item.id)) {
                            pendingToolCalls.push({ id: item.id, call_id: item.call_id || item.id, name: item.name, arguments: item.arguments || '{}' });
                        }
                    }
                } else if (eventType === 'error') {
                    const errMsg = event.error?.message || event.error || 'Unknown WHAM error';
                    win?.webContents.send('task-stream-error', { sessionId, error: errMsg });
                    return { toolCalls: [], error: true };
                }
            } catch { /* skip malformed SSE */ }
        }
    }
    return { toolCalls: pendingToolCalls, error: false };
}

/** Stream from ChatGPT WHAM Responses API with tool-call loop */
async function streamWhamInMain(win, sessionId, accessToken, accountId, modelId, messages, signal, executionMode) {
    const WHAM_URL = 'https://chatgpt.com/backend-api/codex/responses';
    const MAX_TOOL_ROUNDS = 10;

    // Build WHAM request body — separate system instructions from input messages
    const systemParts = [];
    const inputMessages = [];
    for (const msg of messages) {
        if (msg.role === 'system') {
            systemParts.push(msg.content);
        } else {
            inputMessages.push({ role: msg.role, content: msg.content });
        }
    }

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'ChatGPT-Account-Id': accountId,
        'Content-Type': 'application/json',
    };

    // Initial request
    let whamInput = [...inputMessages];
    const instructions = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;
    // Extract workspaceDir from system prompt for tool execution context
    const cwdMatch = systemParts.join('\n').match(/Working directory:\s*(.+)/);
    const workingDir = cwdMatch ? cwdMatch[1].trim() : process.cwd();

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const whamBody = {
            model: modelId,
            store: false,
            stream: true,
            ...(instructions && { instructions }),
            input: whamInput,
            reasoning: { effort: 'medium', summary: 'auto' },
            tools: getActiveToolDefinitions(workingDir),
            include: ['web_search_call.action.sources'],
        };

        // Signal new thinking round to renderer
        if (round > 0) {
            win?.webContents.send('task-stream-thinking', { sessionId, chunk: '', event: 'new-round' });
        }

        llmLog('WHAM-REQ', `Round ${round}`, 'POST', WHAM_URL);
        llmLog('WHAM-REQ-H', JSON.stringify(_maskHeaders(headers)));
        llmLog('WHAM-REQ-B', JSON.stringify({ ...whamBody, input: `[${whamInput.length} items]`, tools: `[${whamBody.tools?.length || 0} tools]`, instructions: instructions ? `[${instructions.length} chars]` : 'none' }));

        let resp = await fetch(WHAM_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(whamBody),
            signal,
        });

        llmLog('WHAM-RES', `Round ${round}`, resp.status, resp.statusText);
        llmLog('WHAM-RES-H', JSON.stringify(Object.fromEntries(resp.headers.entries())));

        // Handle 401 — refresh token and retry once
        if (resp.status === 401 && round === 0) {
            try {
                const newToken = await refreshChatGPTSubToken();
                headers['Authorization'] = `Bearer ${newToken}`;
                resp = await fetch(WHAM_URL, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(whamBody),
                    signal,
                });
            } catch {
                throw new Error('Authentication failed. Please re-authorize your ChatGPT subscription in Settings.');
            }
        }

        if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            throw new Error(`WHAM API error: ${resp.status} — ${errText.slice(0, 200)}`);
        }

        const { toolCalls, error } = await parseWhamStream(resp, win, sessionId, signal);
        if (error) return;

        // If no tool calls, we're done
        if (toolCalls.length === 0) break;

        // Check abort before executing tool calls
        if (signal.aborted) return;

        // Execute tool calls locally with permission checks
        llmLog('TOOLS', `${toolCalls.length} tool call(s):`, toolCalls.map(tc => tc.name).join(', '));
        const sessionOverrides = runningTasks.get(sessionId)?.permissionOverrides || [];
        for (const tc of toolCalls) {
            let parsedArgs = {};
            try { parsedArgs = JSON.parse(tc.arguments); } catch {}
            llmLog('TOOL-CALL', tc.name, `id=${tc.id}`, JSON.stringify(parsedArgs).slice(0, 300));

            // Permission check
            const perm = evaluatePermission(tc.name, executionMode || 'ask', sessionOverrides);
            let output;
            if (perm === 'deny') {
                output = `Permission denied: '${tc.name}' is not allowed in ${executionMode || 'ask'} mode.`;
                win?.webContents.send('task-stream-chunk', { sessionId, chunk: `\n> Permission denied for \`${tc.name}\`\n` });
            } else if (perm === 'ask') {
                const allowed = await askPermission(win, sessionId, tc.name, parsedArgs);
                if (!allowed) {
                    output = `Permission denied by user for '${tc.name}'.`;
                    win?.webContents.send('task-stream-chunk', { sessionId, chunk: `\n> User denied \`${tc.name}\`\n` });
                } else {
                    const preview = tc.name === 'bash' ? (parsedArgs.command || '') : tc.name === 'code_execute' ? (parsedArgs.code || '') : `${tc.name}(${JSON.stringify(parsedArgs).slice(0, 200)})`;
                    win?.webContents.send('task-stream-tool', { sessionId, tool: tc.name, preview, phase: 'start' });
                    const needsSnapshot = tc.name === 'bash' || tc.name === 'code_execute';
                    const preSnap = needsSnapshot ? snapshotWorkspaceFiles(workingDir) : null;
                    output = await executeLocalTool(tc.name, parsedArgs, workingDir);
                    win?.webContents.send('task-stream-tool', { sessionId, tool: tc.name, output: output.slice(0, 3000), phase: 'done' });
                    trackCreatedFile(sessionId, tc.name, parsedArgs, output, workingDir, preSnap);
                }
            } else {
                const preview = tc.name === 'bash' ? (parsedArgs.command || '') : tc.name === 'code_execute' ? (parsedArgs.code || '') : `${tc.name}(${JSON.stringify(parsedArgs).slice(0, 200)})`;
                win?.webContents.send('task-stream-tool', { sessionId, tool: tc.name, preview, phase: 'start' });
                const needsSnapshot = tc.name === 'bash' || tc.name === 'code_execute';
                const preSnap = needsSnapshot ? snapshotWorkspaceFiles(workingDir) : null;
                output = await executeLocalTool(tc.name, parsedArgs, workingDir);
                win?.webContents.send('task-stream-tool', { sessionId, tool: tc.name, output: output.slice(0, 3000), phase: 'done' });
                trackCreatedFile(sessionId, tc.name, parsedArgs, output, workingDir, preSnap);
            }

            // Append function_call + function_call_output to input for next WHAM round
            // id must be fc_xxx (WHAM item ID), call_id is call_xxx (model call ID)
            whamInput.push({ type: 'function_call', id: tc.id, call_id: tc.call_id, name: tc.name, arguments: tc.arguments });
            whamInput.push({ type: 'function_call_output', call_id: tc.call_id, output });
            llmLog('TOOL-OUT', tc.name, `[${(output || '').length} chars]`, (output || '').slice(0, 200));
        }
    }

    const taskData = runningTasks.get(sessionId);
    win?.webContents.send('task-stream-done', { sessionId, createdFiles: taskData?.createdFiles || [] });
}

async function streamAnthropicInMain(win, sessionId, apiKey, modelId, messages, signal) {
    // Anthropic needs messages without system role in the messages array; system goes to top-level
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMsgs = messages.filter(m => m.role !== 'system');
    const body = { model: modelId, max_tokens: 8192, messages: chatMsgs, stream: true };
    if (systemMsg) body.system = systemMsg.content;
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal,
    });
    if (!resp.ok) throw new Error(`API error: ${resp.status} ${resp.statusText}`);

    const task = runningTasks.get(sessionId);
    for await (const chunk of resp.body) {
        if (signal.aborted) break;
        const text = (chunk instanceof Uint8Array || Buffer.isBuffer(chunk)) ? Buffer.from(chunk).toString('utf8') : String(chunk);
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const parsed = JSON.parse(line.slice(6));
                    if (parsed.type === 'content_block_delta') {
                        const content = parsed.delta?.text;
                        if (content) {
                            if (task) task.result += content;
                            win?.webContents.send('task-stream-chunk', { sessionId, chunk: content });
                        }
                    }
                } catch { /* skip */ }
            }
        }
    }
    win?.webContents.send('task-stream-done', { sessionId });
}

async function streamGoogleInMain(win, sessionId, apiKey, modelId, messages, signal) {
    // Convert messages to Google format
    const contents = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));
    const systemInstruction = messages.find(m => m.role === 'system');
    const body = { contents };
    if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    });
    if (!resp.ok) throw new Error(`API error: ${resp.status} ${resp.statusText}`);

    const task = runningTasks.get(sessionId);
    for await (const chunk of resp.body) {
        if (signal.aborted) break;
        const text = (chunk instanceof Uint8Array || Buffer.isBuffer(chunk)) ? Buffer.from(chunk).toString('utf8') : String(chunk);
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const parsed = JSON.parse(line.slice(6));
                    const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (content) {
                        if (task) task.result += content;
                        win?.webContents.send('task-stream-chunk', { sessionId, chunk: content });
                    }
                } catch { /* skip */ }
            }
        }
    }
    win?.webContents.send('task-stream-done', { sessionId });
}

app.on('window-all-closed', () => {
    // Abort all running tasks on app close
    for (const [, task] of runningTasks) {
        task.abortController?.abort();
    }
    runningTasks.clear();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
