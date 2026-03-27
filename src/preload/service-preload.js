const { ipcRenderer } = require('electron');

// =============================================
// ANTI-BOT-DETECTION: Browser Fingerprint Normalization
// Makes Electron WebContentsView indistinguishable from real Chrome
// for Cloudflare Turnstile / bot-management systems.
// =============================================

// 1. Remove navigator.webdriver (Automation flag)
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
});

// 2. Spoof navigator.plugins with realistic Chrome PluginArray
// Real Chrome has named Plugin objects; raw numbers like [1,2,3,4,5] are trivially fingerprinted.
(function spoofPlugins() {
    function FakePlugin(name, description, filename, mimeType) {
        return { name, description, filename, length: 1, item: () => ({ type: mimeType }), namedItem: () => null, [Symbol.iterator]: function*() { yield { type: mimeType }; } };
    }
    const pluginList = [
        FakePlugin('Chrome PDF Plugin', 'Portable Document Format', 'internal-pdf-viewer', 'application/x-google-chrome-pdf'),
        FakePlugin('Chrome PDF Viewer', '', 'mhjfbmdgcfjbbpaeojofohoefgiehjai', 'application/pdf'),
        FakePlugin('Native Client', '', 'internal-nacl-plugin', 'application/x-nacl'),
    ];
    const fakePlugins = {
        length: pluginList.length,
        item: (i) => pluginList[i] || null,
        namedItem: (name) => pluginList.find(p => p.name === name) || null,
        refresh: () => {},
        [Symbol.iterator]: function*() { for (const p of pluginList) yield p; }
    };
    for (let i = 0; i < pluginList.length; i++) fakePlugins[i] = pluginList[i];
    Object.defineProperty(navigator, 'plugins', { get: () => fakePlugins });
})();

// 3. Spoof navigator.mimeTypes (Chrome has entries matching plugins)
(function spoofMimeTypes() {
    const mimeList = [
        { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        { type: 'application/pdf', suffixes: 'pdf', description: '' },
    ];
    const fakeMimeTypes = {
        length: mimeList.length,
        item: (i) => mimeList[i] || null,
        namedItem: (type) => mimeList.find(m => m.type === type) || null,
        [Symbol.iterator]: function*() { for (const m of mimeList) yield m; }
    };
    for (let i = 0; i < mimeList.length; i++) fakeMimeTypes[i] = mimeList[i];
    Object.defineProperty(navigator, 'mimeTypes', { get: () => fakeMimeTypes });
})();

// 4. Spoof languages
Object.defineProperty(navigator, 'languages', {
    get: () => ['ko-KR', 'ko', 'en-US', 'en'],
});

// 5. Spoof window.chrome (critical for Cloudflare)
// Real Chrome exposes window.chrome with runtime, csi, loadTimes etc.
// Electron does not have this — Cloudflare detects the absence.
if (!window.chrome) {
    const fakeRuntime = {
        connect: function() { return { onMessage: { addListener: function() {} }, postMessage: function() {}, disconnect: function() {} }; },
        sendMessage: function() {},
        onMessage: { addListener: function() {}, removeListener: function() {}, hasListeners: function() { return false; } },
        onConnect: { addListener: function() {}, removeListener: function() {} },
        id: undefined,
        getManifest: function() { return undefined; },
        getURL: function(path) { return ''; },
        PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' }
    };
    window.chrome = {
        app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } },
        runtime: fakeRuntime,
        csi: function() { return { pageT: Date.now(), startE: Date.now(), onloadT: Date.now(), tran: 15 }; },
        loadTimes: function() { return { commitLoadTime: Date.now() / 1000, connectionInfo: 'h2', finishDocumentLoadTime: Date.now() / 1000, finishLoadTime: Date.now() / 1000, firstPaintAfterLoadTime: 0, firstPaintTime: Date.now() / 1000, navigationType: 'Other', npnNegotiatedProtocol: 'h2', requestTime: Date.now() / 1000, startLoadTime: Date.now() / 1000, wasAlternateProtocolAvailable: false, wasFetchedViaSpdy: true, wasNpnNegotiated: true }; }
    };
}

// 6. Spoof navigator.connection (NetworkInformation API)
// Real Chrome exposes this; Electron may not. Cloudflare fingerprints its absence.
if (!navigator.connection) {
    const fakeConnection = {
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false,
        onchange: null,
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
    };
    Object.defineProperty(navigator, 'connection', { get: () => fakeConnection, configurable: true });
}

// 7. Normalize Notification.permission
// Electron may return unexpected values; Chrome defaults to 'default'.
try {
    if (typeof Notification !== 'undefined') {
        const origPermission = Object.getOwnPropertyDescriptor(Notification, 'permission');
        if (!origPermission || origPermission.get) {
            Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true });
        }
    }
} catch (e) { /* ignore in contexts where Notification is restricted */ }

// 8. Spoof navigator.permissions.query for 'notifications'
// Cloudflare checks if permissions.query resolves consistently with Notification.permission.
try {
    const origQuery = navigator.permissions && navigator.permissions.query;
    if (origQuery) {
        navigator.permissions.query = function(desc) {
            if (desc && desc.name === 'notifications') {
                return Promise.resolve({ state: 'prompt', onchange: null, addEventListener: function() {}, removeEventListener: function() {} });
            }
            return origQuery.call(navigator.permissions, desc);
        };
    }
} catch (e) { /* ignore */ }

// 9. Prevent iframe-based Electron detection
// Some bot detectors create an iframe and check properties inside it.
// Ensure toString() of key functions returns native-looking strings.
try {
    const origToString = Function.prototype.toString;
    Function.prototype.toString = function() {
        // For our spoofed functions, return a native-looking string
        if (this === Function.prototype.toString) return 'function toString() { [native code] }';
        if (this === navigator.permissions?.query) return 'function query() { [native code] }';
        return origToString.call(this);
    };
} catch (e) { /* ignore */ }

//===========================================
// CLOUDFLARE CHALLENGE DETECTION
//===========================================

let cfChallengeDetectedAt = 0;
let cfChallengeReportedCount = 0;

function isCloudflareChallengePage() {
    try {
        const title = (document.title || '').toLowerCase();
        if (title.includes('just a moment') || title.includes('checking your browser') || title.includes('attention required')) return true;
        if (document.querySelector('#challenge-running, #challenge-stage, .cf-browser-verification, #cf-challenge-running')) return true;
        if (document.querySelector('#turnstile-wrapper, [data-ray], .cf-turnstile')) return true;
        const bodyText = (document.body && document.body.innerText || '').substring(0, 500).toLowerCase();
        if (bodyText.includes('verify you are human') || bodyText.includes('checking if the site connection is secure')) return true;
        return false;
    } catch (e) {
        return false;
    }
}

// Poll for challenge state and notify main process
setInterval(() => {
    if (!currentService) return;
    const isChallenge = isCloudflareChallengePage();
    if (isChallenge) {
        const now = Date.now();
        // Report challenge detection (throttled: once per 10s per occurrence)
        if (now - cfChallengeDetectedAt > 10000) {
            cfChallengeDetectedAt = now;
            cfChallengeReportedCount++;
            console.log(`[Preload] Cloudflare challenge detected for ${currentService} (count: ${cfChallengeReportedCount})`);
            ipcRenderer.send('cloudflare-challenge-detected', {
                service: currentService,
                instanceKey: currentInstanceKey,
                count: cfChallengeReportedCount
            });
        }
    } else if (cfChallengeDetectedAt > 0) {
        // Challenge resolved — notify main process
        console.log(`[Preload] Cloudflare challenge resolved for ${currentService}`);
        cfChallengeDetectedAt = 0;
        cfChallengeReportedCount = 0;
        ipcRenderer.send('cloudflare-challenge-resolved', {
            service: currentService,
            instanceKey: currentInstanceKey
        });
    }
}, 3000);

//===========================================
// PROMPT INJECTION
//===========================================

let currentConfig = null;
let currentService = '';
let currentInstanceKey = null;

//===========================================
// SPA URL OBSERVER (fix: ChatGPT pushState doesn't trigger did-navigate)
//===========================================

let lastReportedUrl = null;
function reportUrlIfChanged(force = false) {
    try {
        const url = window.location.href;
        if (!force && url === lastReportedUrl) return;
        lastReportedUrl = url;
        console.log(`[Preload URL] Reporting URL change: service=${currentService}, instanceKey=${currentInstanceKey}, url=${url}`);
        ipcRenderer.send('service-url-updated', {
            service: currentService,
            instanceKey: currentInstanceKey,
            url
        });
    } catch (e) {
        console.error('[Preload URL] Error reporting URL:', e);
    }
}

function installSpaUrlHooks() {
    try {
        const wrap = (fnName) => {
            const orig = history[fnName];
            if (!orig || orig.__syncMultiChatWrapped) return;
            const wrapped = function (...args) {
                const ret = orig.apply(this, args);
                setTimeout(() => reportUrlIfChanged(false), 0);
                return ret;
            };
            wrapped.__syncMultiChatWrapped = true;
            history[fnName] = wrapped;
        };
        wrap('pushState');
        wrap('replaceState');
        window.addEventListener('popstate', () => reportUrlIfChanged(false));
        window.addEventListener('hashchange', () => reportUrlIfChanged(false));
    } catch (e) {
        // ignore
    }
}

installSpaUrlHooks();
// Low-frequency poll as a safety net (covers frameworks that mutate location in unusual ways)
setInterval(() => reportUrlIfChanged(false), 1000);

ipcRenderer.on('inject-prompt', (event, { text, selectors, autoSend, typingMode = 'human' }) => {
    console.log('[inject-prompt] Received:', { text, selectors, autoSend, typingMode, service: currentService });
    injectPrompt(text, selectors, autoSend, { typingMode });
});

/**
 * Human-like typing simulation with random delays between characters
 * This helps avoid bot detection by mimicking natural typing patterns
 * 
 * Strategy: Type first ~15 words character-by-character, then paste the rest
 * This balances human-like behavior with reasonable speed for long texts
 * 
 * Note: For ProseMirror (Gemini) and contentEditable elements, we use execCommand
 * or textContent to avoid line break issues with innerHTML
 */
async function humanLikeTyping(element, text, isProseMirror = false, isContentEditable = false) {
    console.log('[humanLikeTyping] Starting human-like typing simulation...');
    console.log('[humanLikeTyping] isProseMirror:', isProseMirror, 'isContentEditable:', isContentEditable);
    
    // Sanitize text: replace newlines with spaces to prevent unwanted line breaks
    const sanitizedText = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('[humanLikeTyping] Sanitized text length:', sanitizedText.length);
    
    const MIN_CHAR_DELAY = 25;  // Minimum ms between characters
    const MAX_CHAR_DELAY = 70;  // Maximum ms between characters
    const PAUSE_CHANCE = 0.06;  // 6% chance of longer pause
    const MIN_PAUSE = 100;
    const MAX_PAUSE = 300;
    
    // Type first ~15 words character-by-character, paste the rest
    const WORDS_TO_TYPE = 15;
    const words = sanitizedText.split(' ');
    const typingPart = words.slice(0, WORDS_TO_TYPE).join(' ');
    const pastePart = words.length > WORDS_TO_TYPE ? ' ' + words.slice(WORDS_TO_TYPE).join(' ') : '';
    
    console.log('[humanLikeTyping] Typing part:', typingPart.length, 'chars, Paste part:', pastePart.length, 'chars');
    
    // For ProseMirror/contentEditable: Use execCommand or direct text manipulation
    // This avoids the line break issues caused by innerHTML with <p> tags
    if (isProseMirror || isContentEditable) {
        // Focus and place cursor at the end
        element.focus();
        
        // Clear existing content
        element.textContent = '';
        
        // Phase 1: Type first part character-by-character using execCommand
        for (let i = 0; i < typingPart.length; i++) {
            const char = typingPart[i];
            
            // Random delay between characters
            const charDelay = MIN_CHAR_DELAY + Math.random() * (MAX_CHAR_DELAY - MIN_CHAR_DELAY);
            await new Promise(r => setTimeout(r, charDelay));
            
            // Simulate keydown event
            element.dispatchEvent(new KeyboardEvent('keydown', {
                key: char,
                code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
                bubbles: true,
                cancelable: true,
                view: window
            }));
            
            // Use execCommand for text insertion (works better with contentEditable)
            // Falls back to direct textContent manipulation if execCommand fails
            const inserted = document.execCommand('insertText', false, char);
            if (!inserted) {
                // Fallback: append to textContent
                element.textContent = (element.textContent || '') + char;
            }
            
            // Dispatch input event
            element.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: char,
                view: window
            }));
            
            // Simulate keyup event
            element.dispatchEvent(new KeyboardEvent('keyup', {
                key: char,
                code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
                bubbles: true,
                cancelable: true,
                view: window
            }));
            
            // Occasional longer pause
            if (Math.random() < PAUSE_CHANCE) {
                const pauseDuration = MIN_PAUSE + Math.random() * (MAX_PAUSE - MIN_PAUSE);
                await new Promise(r => setTimeout(r, pauseDuration));
            }
        }
        
        // Phase 2: Paste remaining text at once
        if (pastePart.length > 0) {
            console.log('[humanLikeTyping] Pasting remaining text for contentEditable...');
            await new Promise(r => setTimeout(r, 100 + Math.random() * 150));
            
            const inserted = document.execCommand('insertText', false, pastePart);
            if (!inserted) {
                element.textContent = (element.textContent || '') + pastePart;
            }
            
            element.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertFromPaste',
                data: pastePart,
                view: window
            }));
        }
    } else {
        // For textarea/input elements
        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
        )?.set || Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        )?.set;
        
        // Phase 1: Type first part character-by-character
        for (let i = 0; i < typingPart.length; i++) {
            const char = typingPart[i];
            
            const charDelay = MIN_CHAR_DELAY + Math.random() * (MAX_CHAR_DELAY - MIN_CHAR_DELAY);
            await new Promise(r => setTimeout(r, charDelay));
            
            element.dispatchEvent(new KeyboardEvent('keydown', {
                key: char,
                code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
                bubbles: true,
                cancelable: true,
                view: window
            }));
            
            const currentValue = element.value || '';
            if (nativeSetter) {
                nativeSetter.call(element, currentValue + char);
            } else {
                element.value = currentValue + char;
            }
            
            element.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: char,
                view: window
            }));
            
            element.dispatchEvent(new KeyboardEvent('keyup', {
                key: char,
                code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
                bubbles: true,
                cancelable: true,
                view: window
            }));
            
            if (Math.random() < PAUSE_CHANCE) {
                const pauseDuration = MIN_PAUSE + Math.random() * (MAX_PAUSE - MIN_PAUSE);
                await new Promise(r => setTimeout(r, pauseDuration));
            }
        }
        
        // Phase 2: Paste remaining text at once
        if (pastePart.length > 0) {
            console.log('[humanLikeTyping] Pasting remaining text for textarea...');
            await new Promise(r => setTimeout(r, 100 + Math.random() * 150));
            
            const currentValue = element.value || '';
            if (nativeSetter) {
                nativeSetter.call(element, currentValue + pastePart);
            } else {
                element.value = currentValue + pastePart;
            }
            
            element.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertFromPaste',
                data: pastePart,
                view: window
            }));
        }
    }
    
    // Final change event
    element.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('[humanLikeTyping] Typing simulation complete');
}

async function injectPrompt(text, selectors, autoSend = false, options = {}) {
    console.log('[injectPrompt] Starting injection. Service:', currentService);
    console.log('[injectPrompt] Text length:', text.length);
    console.log('[injectPrompt] Selectors:', selectors);
    const typingMode = options.typingMode || 'human';
    const useHumanTyping = typingMode !== 'instant';

    // Try to find input element using provided selectors with retry
    // Perplexity can expose both hidden textarea and visible lexical editor.
    // Prefer the visible contenteditable editor to avoid duplicated text insertion.
    const isPerplexityService = currentService === 'perplexity';
    let inputEl = null;
    let fallbackInputEl = null;
    for (let i = 0; i < 15; i++) { // Retry up to 3 seconds
        for (const selector of selectors.inputSelector) {
            const candidate = document.querySelector(selector);
            if (!candidate) continue;

            if (isPerplexityService) {
                const isEditable = candidate.isContentEditable || candidate.getAttribute('contenteditable') === 'true';
                const rect = candidate.getBoundingClientRect();
                const style = window.getComputedStyle(candidate);
                const isVisible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';

                if (!fallbackInputEl) fallbackInputEl = candidate;
                if (isEditable && isVisible) {
                    inputEl = candidate;
                }
            } else {
                inputEl = candidate;
            }

            if (inputEl) {
                console.log('[injectPrompt] Input element found with selector:', selector);
                console.log('[injectPrompt] Element type:', inputEl.tagName, 'contentEditable:', inputEl.contentEditable, 'classList:', Array.from(inputEl.classList || []));
                break;
            }
        }
        if (!inputEl && isPerplexityService && fallbackInputEl) {
            inputEl = fallbackInputEl;
            console.log('[injectPrompt] Perplexity fallback input selected:', inputEl.tagName);
        }
        if (inputEl) break;
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (!inputEl) {
        console.error('[injectPrompt] Input element not found with selectors:', selectors.inputSelector);
        return;
    }

    // 1. Focus
    // Perplexity specific: Click to activate editor and wait
    if (currentService === 'perplexity') {
        console.log('[injectPrompt] Perplexity detected: Clicking and waiting for editor activation...');
        inputEl.click();
        const perplexityActivationDelayMs = useHumanTyping ? 300 : 80;
        await new Promise(resolve => setTimeout(resolve, perplexityActivationDelayMs));
    }

    inputEl.focus();
    console.log('[injectPrompt] Input focused');
    
    // Small delay after focus only for human-like typing mode
    if (useHumanTyping) {
        await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
    }

    // 2. Set Value based on element type with human-like typing
    const isProseMirror = inputEl.classList.contains('ProseMirror');
    const isContentEditable = inputEl.getAttribute('contenteditable') === 'true';
    
    if (isProseMirror || isContentEditable) {
        // ContentEditable (Claude, Gemini, Grok, Perplexity)
        console.log('[injectPrompt] Detected ContentEditable element');

        // Clear existing content first
        inputEl.innerHTML = '';

        if (useHumanTyping) {
            // Use human-like typing
            await humanLikeTyping(inputEl, text, isProseMirror, isContentEditable);
            console.log('[injectPrompt] Human-like typing completed for ContentEditable');
        } else {
            // Multi mode: set text immediately for fast injection
            if (isPerplexityService) {
                // Perplexity (Lexical): Send button enables only when editor sees a proper input (e.g. insertFromPaste).
                // Fire InputEvent with insertFromPaste + data so Lexical updates state and enables Send; avoid
                // execCommand first so we don't get duplicate text (execCommand + Lexical applying event.data).
                inputEl.dispatchEvent(new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertFromPaste',
                    data: text,
                    view: window
                }));
                await new Promise(r => requestAnimationFrame(r));
                const hasContent = (inputEl.textContent || '').trim().length > 0;
                if (!hasContent) {
                    // Fallback if Lexical doesn't insert from event: insert via execCommand then notify
                    const inserted = document.execCommand('insertText', false, text);
                    if (!inserted) inputEl.textContent = text;
                    inputEl.dispatchEvent(new InputEvent('input', {
                        bubbles: true,
                        cancelable: true,
                        inputType: 'insertText',
                        data: text,
                        view: window
                    }));
                }
            } else {
                const inserted = document.execCommand('insertText', false, text);
                if (!inserted) inputEl.textContent = text;
                inputEl.dispatchEvent(new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertFromPaste',
                    data: text,
                    view: window
                }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            console.log('[injectPrompt] Instant injection completed for ContentEditable');
        }
    } else {
        // Textarea (ChatGPT)
        console.log('[injectPrompt] Using Textarea injection (for ChatGPT)');

        // Clear existing content
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(inputEl, '');

        if (useHumanTyping) {
            // Use human-like typing
            await humanLikeTyping(inputEl, text, false, false);
            console.log('[injectPrompt] Human-like typing completed for Textarea');
        } else {
            nativeInputValueSetter.call(inputEl, text);
            inputEl.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertFromPaste',
                data: text,
                view: window
            }));
            if (!isPerplexityService) inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[injectPrompt] Instant injection completed for Textarea');
        }
    }

    // 3. Trigger Enter key if needed or Click Send
    if (autoSend) {
        // Perplexity: Lexical enables send only after it recognizes content; give it time and allow retry.
        const sendDelayMs = isPerplexityService
            ? (useHumanTyping ? 1000 : 350)
            : (useHumanTyping ? 1000 : 0);
        clickSendButton(selectors, inputEl, { sendDelayMs });
    } else {
        console.log('[injectPrompt] autoSend is false, skipping send button click');
    }

    console.log('[injectPrompt] Injection complete');
}

ipcRenderer.on('click-send-button', (event, { selectors, sendDelayMs } = {}) => {
    console.log('[click-send-button] Received request to click send button');
    // Find input element again for context
    let inputEl = null;
    for (const selector of selectors.inputSelector) {
        inputEl = document.querySelector(selector);
        if (inputEl) break;
    }
    clickSendButton(selectors, inputEl, { sendDelayMs });
});

function isSendButtonDisabled(btn) {
    if (!btn) return true;
    if (btn.disabled === true) return true;
    const ariaDisabled = btn.getAttribute && btn.getAttribute('aria-disabled');
    if (ariaDisabled === 'true' || ariaDisabled === '') return true;
    return false;
}

function clickSendButton(selectors, providedInputEl = null, options = {}) {
    const delayMs = Number.isFinite(options.sendDelayMs) ? Math.max(0, options.sendDelayMs) : 1000;
    const isPerplexity = currentService === 'perplexity';
    const retryIntervalMs = 200;
    const maxRetries = isPerplexity ? 5 : 0;

    function tryClickOnce() {
        let btn = null;
        for (const selector of selectors.sendButtonSelector) {
            btn = document.querySelector(selector);
            if (btn) break;
        }
        return { btn, disabled: isSendButtonDisabled(btn) };
    }

    function doFallback() {
        console.log('[clickSendButton] Send button not found or disabled, trying keyboard events...');
        let inputEl = providedInputEl;
        if (!inputEl || !document.contains(inputEl)) {
            for (const selector of selectors.inputSelector) {
                inputEl = document.querySelector(selector);
                if (inputEl) break;
            }
        }
        if (inputEl) {
            if (document.activeElement !== inputEl) {
                try { inputEl.focus(); } catch (e) { console.error('[clickSendButton] Failed to focus input:', e); }
            }
            const eventProps = {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                bubbles: true, cancelable: true, view: window, composed: true
            };
            inputEl.dispatchEvent(new KeyboardEvent('keydown', eventProps));
            inputEl.dispatchEvent(new KeyboardEvent('keypress', eventProps));
            inputEl.dispatchEvent(new KeyboardEvent('keyup', eventProps));
            const ctrlEnterProps = { ...eventProps, ctrlKey: true, metaKey: true };
            inputEl.dispatchEvent(new KeyboardEvent('keydown', ctrlEnterProps));
            inputEl.dispatchEvent(new KeyboardEvent('keypress', ctrlEnterProps));
            inputEl.dispatchEvent(new KeyboardEvent('keyup', ctrlEnterProps));
            console.log('[clickSendButton] Keyboard events dispatched');
        } else {
            console.error('[clickSendButton] Could not find input element for keyboard fallback');
        }
    }

    setTimeout(() => {
        let attempt = 0;
        function runAttempt() {
            const { btn, disabled } = tryClickOnce();
            console.log(`[clickSendButton] Attempt ${attempt + 1}: send button Found:`, !!btn, 'Disabled:', disabled);
            if (btn && !disabled) {
                console.log('[clickSendButton] Send button found and enabled, clicking...');
                btn.click();
                console.log('[clickSendButton] Send button clicked');
                return;
            }
            if (isPerplexity && maxRetries > 0 && attempt < maxRetries) {
                attempt++;
                setTimeout(runAttempt, retryIntervalMs);
                return;
            }
            doFallback();
        }
        runAttempt();
    }, delayMs);
}

//===========================================
// LOGIN STATUS DETECTION
//===========================================

ipcRenderer.on('set-config', (event, payload) => {
    const { config, service, instanceKey } = payload || {};
    console.log(`[Preload] set-config received: service=${service}, instanceKey=${instanceKey}`);
    currentConfig = config;
    currentService = service || currentService;
    if (instanceKey) currentInstanceKey = instanceKey;
    console.log(`[Preload] After set-config: currentService=${currentService}, currentInstanceKey=${currentInstanceKey}`);
    reportUrlIfChanged(true);
});

// Request config immediately (Handshake)
ipcRenderer.send('request-config');

let lastStableLoggedInState = false;
let consecutiveLoggedOutChecks = 0;
const GEMINI_LOGOUT_GRACE_CHECKS = 3; // 2s interval * 3 = up to ~6s grace for transient DOM misses
const PERPLEXITY_LOGOUT_GRACE_CHECKS = 2; // 2s interval * 2 = up to ~4s grace for transient DOM misses

function isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (!style) return false;
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    if (el.closest('[aria-hidden="true"], [hidden], [inert]')) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function queryAnyVisible(selectors) {
    if (!Array.isArray(selectors)) return false;
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (isElementVisible(el)) return true;
    }
    return false;
}

function detectLoggedInBySelectors(config) {
    if (!config) return false;

    // 1. Check for explicit loggedInSelector if available (Best)
    if (config.loggedInSelector) {
        if (queryAnyVisible(config.loggedInSelector)) return true;
    }

    // 2. Fallback to inputSelector
    if (config.inputSelector) {
        if (queryAnyVisible(config.inputSelector)) return true;
    }

    return false;
}

// Gemini login state: prefer DOM of header bar (login button vs profile icon) over full-page text
// to avoid false positives and our own badge text affecting detection. Based on user-provided
// before_login / after_login HTML: login = a[aria-label="로그인"] or "Sign in"; logged-in = profile link/icon.

/** True when the header "Login" / "로그인" link is present (Gemini top bar). */
function hasGeminiHeaderLoginButton() {
    const selectors = [
        'a[aria-label="로그인"]',
        'a[aria-label="Sign in"]'
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && (el.closest('#gb') || el.closest('[id="gb"]'))) return true;
        if (el) return true; // fallback without #gb in case structure changes
    }
    return false;
}

/** True when the header profile link/icon is present (Google 계정). */
function hasGeminiHeaderProfileIcon() {
    const selectors = [
        'a[aria-label^="Google 계정:"]',
        'a[aria-label^="Google Account:"]',
        'img.gb_Q.gbii'
    ];
    for (const sel of selectors) {
        if (document.querySelector(sel)) return true;
    }
    return false;
}

/** Get body text excluding our injected login badge so badge text does not trigger logged-out detection. */
function getPageTextExcludingBadge() {
    try {
        const badge = document.getElementById('sync-multi-chat-login-badge');
        if (!badge || !document.body) return (document.body.innerText || '').toLowerCase();
        const clone = document.body.cloneNode(true);
        const badgeClone = clone.querySelector && clone.querySelector('#sync-multi-chat-login-badge');
        if (badgeClone) badgeClone.remove();
        return (clone.innerText || '').toLowerCase();
    } catch (e) {
        return (document.body?.innerText || '').toLowerCase();
    }
}

function isGeminiExplicitlyLoggedOut() {
    // Primary: header has "로그인" / "Sign in" button (reliable DOM from user-provided HTML)
    if (hasGeminiHeaderLoginButton()) return true;
    // Fallback: only very explicit logged-out phrases (no "로그인"/"sign in" to avoid badge/false positives)
    const pageText = getPageTextExcludingBadge();
    const explicitLoggedOutHints = [
        '로그아웃된 상태입니다',
        '다시 로그인하세요',
        'signed out',
        'sign in again'
    ];
    for (const hint of explicitLoggedOutHints) {
        if (pageText.includes(hint)) return true;
    }
    return false;
}

function isGeminiLikelyLoggedIn() {
    // Primary: header has profile icon/link (Google 계정)
    if (hasGeminiHeaderProfileIcon()) return true;
    // Legacy/fallback selectors
    const hints = [
        "button[aria-label*='Google 계정']",
        "button[aria-label*='Google Account']",
        "button[aria-label*='계정']",
        "img[alt*='Google Account']",
        "img[alt*='프로필']",
        "div[data-test-id='chat-history-button']",
        "bard-sidenav button",
        "chat-window"
    ];
    for (const selector of hints) {
        if (document.querySelector(selector)) return true;
    }
    // If on app URL and no explicit logged-out signal, treat as likely logged-in
    const onGeminiApp = window.location.hostname.includes('gemini.google.com') &&
        window.location.pathname.startsWith('/app');
    if (onGeminiApp && !isGeminiExplicitlyLoggedOut()) return true;
    return false;
}

function hasPerplexityTextHint(hints) {
    const pageText = getPageTextExcludingBadge();
    for (const hint of hints) {
        if (pageText.includes(hint)) return true;
    }
    return false;
}

function hasPerplexityVisibleCtaText(hints) {
    const nodes = document.querySelectorAll('button, a, [role="button"], h1, h2, p, span');
    for (const node of nodes) {
        if (!isElementVisible(node)) continue;
        const txt = (node.textContent || '').trim().toLowerCase();
        if (!txt) continue;
        for (const hint of hints) {
            if (txt.includes(hint)) return true;
        }
    }
    return false;
}

function isPerplexityExplicitlyLoggedOut() {
    const host = (window.location.hostname || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();
    if (!host.includes('perplexity.ai')) return false;

    if (path.includes('/auth') || path.includes('/login') || path.includes('/signin')) return true;

    const ctaSelectors = [
        'a[href*="/login"]',
        'a[href*="/signin"]',
        'button[data-testid*="login"]',
        'button[data-testid*="signin"]'
    ];
    if (queryAnyVisible(ctaSelectors)) return true;

    const hints = [
        // Korean
        'google로 계속하기',
        'apple로 계속하기',
        '아래에서 가입하여',
        '로그인',
        '로그 인',
        // English
        'continue with google',
        'continue with apple',
        'sign up with email',
        'by continuing, you agree to perplexity',
        'terms of service',
        'privacy policy',
        'log in',
        'login',
        'sign in'
    ];
    return hasPerplexityTextHint(hints) || hasPerplexityVisibleCtaText(hints);
}

function isPerplexityLikelyLoggedIn() {
    const host = (window.location.hostname || '').toLowerCase();
    if (!host.includes('perplexity.ai')) return false;

    const selectors = [
        'button[aria-label*="Account"]',
        'button[aria-label*="account"]',
        'button[aria-label*="프로필"]',
        'button[aria-label*="계정"]',
        'img[alt*="Profile"]',
        'img[alt*="profile"]',
        'img[alt*="Avatar"]',
        'img[alt*="avatar"]'
    ];
    return queryAnyVisible(selectors);
}

setInterval(() => {
    if (!currentConfig) return;

    let isLoggedIn = detectLoggedInBySelectors(currentConfig);
    let forceLoggedOut = false;

    if (currentService === 'gemini') {
        if (window.location.hostname && window.location.hostname.includes('accounts.google.com')) {
            isLoggedIn = false;
            forceLoggedOut = true;
        } else if (isGeminiExplicitlyLoggedOut()) {
            isLoggedIn = false;
            forceLoggedOut = true;
        } else if (isGeminiLikelyLoggedIn()) {
            isLoggedIn = true;
        }
    } else if (currentService === 'perplexity') {
        if (isPerplexityExplicitlyLoggedOut()) {
            isLoggedIn = false;
            forceLoggedOut = true;
        } else if (isPerplexityLikelyLoggedIn()) {
            isLoggedIn = true;
        }
    }

    // 3. Double check with login button selector (Negative Check)
    if (isLoggedIn && currentConfig.loginButtonSelector) {
        for (const selector of currentConfig.loginButtonSelector) {
            if (document.querySelector(selector)) {
                // If login button is present, we are NOT logged in
                isLoggedIn = false;
                break;
            }
        }
    }

    // 4. Hysteresis for Gemini/Perplexity: avoid immediate false-negative during transient DOM states
    if (currentService === 'gemini' || currentService === 'perplexity') {
        const graceChecks = currentService === 'gemini' ? GEMINI_LOGOUT_GRACE_CHECKS : PERPLEXITY_LOGOUT_GRACE_CHECKS;
        if (isLoggedIn) {
            lastStableLoggedInState = true;
            consecutiveLoggedOutChecks = 0;
        } else if (lastStableLoggedInState && !forceLoggedOut) {
            consecutiveLoggedOutChecks += 1;
            if (consecutiveLoggedOutChecks < graceChecks) {
                isLoggedIn = true;
            } else {
                lastStableLoggedInState = false;
            }
        } else {
            lastStableLoggedInState = false;
        }
    } else {
        lastStableLoggedInState = isLoggedIn;
        consecutiveLoggedOutChecks = 0;
    }

    ipcRenderer.send('status-update', { isLoggedIn });
    updateLoginStatusUI(isLoggedIn);
}, 2000);

//===========================================
// GEMINI RESPONSE-IN-PROGRESS (for idle refresh skip)
//===========================================
// (1) Send button: mat-icon[data-mat-icon-name="send"] / fonticon="send"
// (2) Stop button (response in progress): mat-icon[data-mat-icon-name="stop"] / fonticon="stop"
//
// If Gemini team changes DOM, alternative strategies:
// - Fallback 1: aria-label containing "Stop"/"중단" (already used)
// - Fallback 2: extend selectors in stopSelectors (e.g. [data-testid*="stop"], .stop-button)
// - Fallback 3: detect "send" button disabled + loading spinner/aria-busy on chat container
// - Fallback 4: config-driven selectors from main (e.g. selectorsConfig.gemini.responseInProgressSelector)
// - Fallback 5: time-based guard only — skip refresh for N min after last prompt (no DOM), less accurate
function isGeminiResponseInProgress() {
    if (currentService !== 'gemini') return false;
    try {
        const host = window.location.hostname || '';
        if (!host.includes('gemini.google.com') || window.location.pathname.indexOf('/app') !== 0) return false;
        // Primary: stop icon visible = response in progress (user can stop)
        const stopSelectors = [
            'mat-icon[data-mat-icon-name="stop"]',
            'mat-icon[fonticon="stop"]',
            '[fonticon="stop"]',
            'mat-icon[data-mat-icon-type="font"][data-mat-icon-name="stop"]'
        ];
        for (const sel of stopSelectors) {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) return true;
            }
        }
        // Fallback: button with aria-label containing "stop" or "중단"
        const stopBtn = document.querySelector('button[aria-label*="Stop"], button[aria-label*="stop"], button[aria-label*="중단"]');
        if (stopBtn && stopBtn.offsetParent !== null) {
            const rect = stopBtn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

let lastGeminiResponseInProgress = false;
setInterval(() => {
    if (currentService !== 'gemini') return;
    const inProgress = isGeminiResponseInProgress();
    if (inProgress !== lastGeminiResponseInProgress) {
        lastGeminiResponseInProgress = inProgress;
        ipcRenderer.send('gemini-response-in-progress', { inProgress });
    }
}, 2500);

function updateLoginStatusUI(isLoggedIn) {
    const badgeId = 'sync-multi-chat-login-badge';
    const badge = document.getElementById('sync-multi-chat-login-badge');

    // Gemini: show login-required badge when on app URL or Google account/sign-in page
    const hostname = typeof window.location !== 'undefined' && window.location.hostname ? window.location.hostname : '';
    const pathname = (typeof window.location !== 'undefined' && window.location.pathname) ? window.location.pathname : '';
    const isGeminiAppUrl = currentService === 'gemini' && hostname.includes('gemini.google.com') && pathname.indexOf('/app') === 0;
    const isGeminiAccountsUrl = currentService === 'gemini' && hostname.includes('accounts.google.com');
    // On accounts.google.com (account chooser/sign-in) always show badge; on app URL show when not logged in
    const showLoginBadge = (currentService === 'gemini' && isGeminiAccountsUrl) ||
        (!isLoggedIn && (currentService !== 'gemini' || isGeminiAppUrl || isGeminiAccountsUrl));

    if (showLoginBadge) {
        if (!badge) {
            injectLoginBadgeStyles();
            const badgeEl = document.createElement('div');
            badgeEl.id = badgeId;
            badgeEl.className = 'smc-login-badge-wrap';
            badgeEl.style.position = 'fixed';
            badgeEl.style.top = '10px';
            badgeEl.style.right = '10px';
            badgeEl.style.zIndex = '999999';
            badgeEl.style.pointerEvents = 'auto';
            badgeEl.style.display = 'flex';
            badgeEl.style.alignItems = 'center';
            badgeEl.style.gap = '12px';
            badgeEl.style.padding = '10px 14px';
            badgeEl.style.borderRadius = '8px';
            badgeEl.style.backgroundColor = '#e0f2fe';
            badgeEl.style.border = '2px solid #0284c7';
            badgeEl.style.boxShadow = '0 2px 10px rgba(2, 132, 199, 0.2)';
            badgeEl.style.fontFamily = 'sans-serif';

            const label = document.createElement('span');
            label.className = 'smc-login-badge-label';
            label.textContent = 'Login required';
            label.style.color = '#0c4a6e';
            label.style.fontSize = '14px';
            label.style.fontWeight = '600';

            const signInBtn = document.createElement('button');
            signInBtn.type = 'button';
            signInBtn.setAttribute('aria-label', 'Sign in with Chrome or Edge');
            signInBtn.className = 'smc-signin-chrome-btn';
            signInBtn.textContent = 'Sign in with Chrome or Edge';
            signInBtn.style.cursor = 'pointer';
            signInBtn.style.fontSize = '13px';
            signInBtn.style.padding = '8px 14px';
            signInBtn.style.borderRadius = '6px';
            signInBtn.style.fontWeight = '600';
            signInBtn.style.fontFamily = 'sans-serif';
            signInBtn.style.color = '#fff';
            signInBtn.style.backgroundColor = '#0284c7';
            signInBtn.style.border = 'none';
            signInBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';

            signInBtn.onclick = () => {
                if (currentService) {
                    ipcRenderer.send('external-login', currentService);
                    const browserName = signInBtn.dataset.externalBrowser || 'browser';
                    signInBtn.textContent = browserName === 'edge' ? 'Opening Edge...' : 'Opening Chrome...';
                    signInBtn.disabled = true;
                }
            };

            badgeEl.appendChild(label);
            badgeEl.appendChild(signInBtn);
            document.body.appendChild(badgeEl);

            // Resolve which browser is available and update button (Chrome first, then Edge). Label stays "Login required".
            ipcRenderer.invoke('get-external-login-browser').then((result) => {
                const lbl = badgeEl.querySelector('.smc-login-badge-label');
                const btn = badgeEl.querySelector('.smc-signin-chrome-btn');
                if (!lbl || !btn) return;
                if (result && result.browser) {
                    const name = result.browser === 'chrome' ? 'Chrome' : 'Edge';
                    lbl.textContent = 'Login required';
                    btn.textContent = `Sign in with ${name}`;
                    btn.setAttribute('aria-label', `Sign in with ${name}`);
                    btn.dataset.externalBrowser = result.browser;
                    btn.disabled = false;
                } else {
                    lbl.textContent = 'Login required';
                    btn.textContent = 'Chrome or Edge not found';
                    btn.setAttribute('aria-label', 'Chrome or Edge not found');
                    btn.disabled = true;
                }
            });
        }
    } else {
        if (badge) {
            badge.remove();
        }
    }
}

function injectLoginBadgeStyles() {
    if (document.getElementById('smc-login-badge-styles')) return;
    const style = document.createElement('style');
    style.id = 'smc-login-badge-styles';
    style.textContent = `
        @keyframes smc-border-blink {
            0%, 100% { border-color: #0284c7; }
            50% { border-color: rgba(2, 132, 199, 0.4); }
        }
        .smc-login-badge-wrap {
            animation: smc-border-blink 2s ease-in-out infinite;
        }
        .smc-signin-chrome-btn:hover {
            background-color: #0369a1;
            box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);
        }
        .smc-signin-chrome-btn:active {
            background-color: #075985;
        }
    `;
    (document.head || document.documentElement).appendChild(style);
}

ipcRenderer.on('external-login-closed', () => {
    const badge = document.getElementById('sync-multi-chat-login-badge');
    if (badge) {
        const btn = badge.querySelector('.smc-signin-chrome-btn');
        if (btn) {
            ipcRenderer.invoke('get-external-login-browser').then((result) => {
                if (result && result.browser) {
                    const name = result.browser === 'chrome' ? 'Chrome' : 'Edge';
                    btn.textContent = `Sign in with ${name}`;
                } else {
                    btn.textContent = 'Chrome or Edge not found';
                }
                btn.disabled = !result || !result.browser;
            });
        }
    }
});

ipcRenderer.on('external-login-unavailable', () => {
    const badge = document.getElementById('sync-multi-chat-login-badge');
    if (badge) {
        const btn = badge.querySelector('.smc-signin-chrome-btn');
        const lbl = badge.querySelector('.smc-login-badge-label');
        if (btn) {
            btn.textContent = 'Chrome or Edge not found';
            btn.disabled = true;
        }
        if (lbl) lbl.textContent = 'Login required';
    }
});

// NOTE: Reload and Copy buttons are now in the header bar (renderer.js createSlot function)
// The old overlay buttons have been removed to avoid duplication.

//===========================================
// SCROLL SYNC
//===========================================

let scrollSyncEnabled = false;

ipcRenderer.on('scroll-sync-state', (event, isEnabled) => {
    scrollSyncEnabled = isEnabled;
    console.log('Scroll Sync State:', isEnabled);
});

ipcRenderer.on('apply-scroll', (event, { deltaX, deltaY }) => {
    // 1. Try scrolling window first
    window.scrollBy(deltaX, deltaY);

    // 2. Find the likely main scroll container
    // Chat apps usually have a main div with overflow-y: auto/scroll
    const scrollableElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        // Check for overflow-y explicitly
        const isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll');

        // Also check if it actually has content to scroll
        const canScroll = el.scrollHeight > el.clientHeight;

        return isScrollable && canScroll;
    });

    if (scrollableElements.length > 0) {
        // Sort by scrollHeight (largest content usually means main chat)
        scrollableElements.sort((a, b) => b.scrollHeight - a.scrollHeight);

        // Scroll the largest scrollable element
        const target = scrollableElements[0];
        target.scrollBy(deltaX, deltaY);

        // Fallback: If there are multiple large containers, try the second one too.
        if (scrollableElements.length > 1) {
            scrollableElements[1].scrollBy(deltaX, deltaY);
        }
    } else {
        // Fallback for Gemini if it uses document body scrolling but reported as hidden/special
        document.documentElement.scrollBy(deltaX, deltaY);
        document.body.scrollBy(deltaX, deltaY);
    }
});

window.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
        // Zoom
        event.preventDefault();
        const direction = event.deltaY < 0 ? 'in' : 'out';
        ipcRenderer.send('zoom-sync', direction);
    } else if (scrollSyncEnabled) {
        // Scroll Sync
        // We don't prevent default here because we want the user to scroll THIS view naturally.
        // We just notify others.
        ipcRenderer.send('sync-scroll', { deltaX: event.deltaX, deltaY: event.deltaY });
    }
}, { passive: false });
