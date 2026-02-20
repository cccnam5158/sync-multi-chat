const { ipcRenderer } = require('electron');

// Anti-detection: Remove navigator.webdriver
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
});

// Anti-detection: Spoof plugins (Chrome usually has some, Electron has 0)
if (navigator.plugins.length === 0) {
    Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
    });
}

// Anti-detection: Spoof languages
Object.defineProperty(navigator, 'languages', {
    get: () => ['ko-KR', 'ko', 'en-US', 'en'],
});

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
            const inserted = document.execCommand('insertText', false, text);
            if (!inserted) inputEl.textContent = text;

            if (isPerplexityService) {
                // Perplexity lexical editor can duplicate text when synthetic InputEvent carries full data payload.
                inputEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            } else {
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
            if (isPerplexityService) {
                inputEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            } else {
                inputEl.dispatchEvent(new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertFromPaste',
                    data: text,
                    view: window
                }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            console.log('[injectPrompt] Instant injection completed for Textarea');
        }
    }

    // 3. Trigger Enter key if needed or Click Send
    if (autoSend) {
        clickSendButton(selectors, inputEl, { sendDelayMs: useHumanTyping ? 1000 : 0 });
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

function clickSendButton(selectors, providedInputEl = null, options = {}) {
    const delayMs = Number.isFinite(options.sendDelayMs) ? Math.max(0, options.sendDelayMs) : 1000;
    // Some apps (like Claude) might need a small delay for the state to update before the button becomes enabled
    setTimeout(() => {
        console.log('[clickSendButton] Looking for send button...');
        let btn = null;
        for (const selector of selectors.sendButtonSelector) {
            btn = document.querySelector(selector);
            console.log(`[clickSendButton] Trying send button selector: "${selector}" -> Found:`, !!btn, 'Disabled:', btn?.disabled);
            if (btn) break;
        }

        if (btn && !btn.disabled) {
            console.log('[clickSendButton] Send button found and enabled, clicking...');
            btn.click();
            console.log('[clickSendButton] Send button clicked');
        } else {
            console.log('[clickSendButton] Send button not found or disabled, trying keyboard events...');

            // Fallback: Try sending Enter key event
            let inputEl = providedInputEl;

            // If not provided or lost, try to find it again
            if (!inputEl || !document.contains(inputEl)) {
                for (const selector of selectors.inputSelector) {
                    inputEl = document.querySelector(selector);
                    if (inputEl) break;
                }
            }

            if (inputEl) {
                // Only focus if not already focused to avoid disrupting cursor/selection
                if (document.activeElement !== inputEl) {
                    try {
                        inputEl.focus();
                    } catch (e) {
                        console.error('[clickSendButton] Failed to focus input:', e);
                    }
                }

                const eventProps = {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    composed: true
                };

                // Standard Enter
                console.log('[clickSendButton] Dispatching Enter key events...');
                inputEl.dispatchEvent(new KeyboardEvent('keydown', eventProps));
                inputEl.dispatchEvent(new KeyboardEvent('keypress', eventProps));
                inputEl.dispatchEvent(new KeyboardEvent('keyup', eventProps));

                // Ctrl+Enter (often forces send)
                const ctrlEnterProps = {
                    ...eventProps,
                    ctrlKey: true,
                    metaKey: true
                };

                console.log('[clickSendButton] Dispatching Ctrl+Enter key events...');
                inputEl.dispatchEvent(new KeyboardEvent('keydown', ctrlEnterProps));
                inputEl.dispatchEvent(new KeyboardEvent('keypress', ctrlEnterProps));
                inputEl.dispatchEvent(new KeyboardEvent('keyup', ctrlEnterProps));
                console.log('[clickSendButton] Keyboard events dispatched');
            } else {
                console.error('[clickSendButton] Could not find input element for keyboard fallback');
            }
        }
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

function detectLoggedInBySelectors(config) {
    if (!config) return false;

    // 1. Check for explicit loggedInSelector if available (Best)
    if (config.loggedInSelector) {
        for (const selector of config.loggedInSelector) {
            if (document.querySelector(selector)) {
                return true;
            }
        }
    }

    // 2. Fallback to inputSelector
    if (config.inputSelector) {
        for (const selector of config.inputSelector) {
            if (document.querySelector(selector)) {
                return true;
            }
        }
    }

    return false;
}

function isGeminiExplicitlyLoggedOut() {
    const pageText = (document.body?.innerText || '').toLowerCase();
    const loggedOutTextHints = [
        '로그아웃된 상태입니다',
        '다시 로그인하세요',
        'signed out',
        'sign in again'
    ];

    for (const hint of loggedOutTextHints) {
        if (pageText.includes(hint)) return true;
    }
    return false;
}

function isGeminiLikelyLoggedIn() {
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

    // If we're on Gemini app URL and no explicit logged-out signal is present,
    // treat it as likely logged-in to avoid false "로그인 필요" badge flicker.
    const onGeminiApp = window.location.hostname.includes('gemini.google.com') &&
        window.location.pathname.startsWith('/app');
    if (onGeminiApp && !isGeminiExplicitlyLoggedOut()) return true;

    return false;
}

setInterval(() => {
    if (!currentConfig) return;

    let isLoggedIn = detectLoggedInBySelectors(currentConfig);
    let forceLoggedOut = false;

    if (currentService === 'gemini') {
        if (isGeminiExplicitlyLoggedOut()) {
            isLoggedIn = false;
            forceLoggedOut = true;
        } else if (isGeminiLikelyLoggedIn()) {
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

    // 4. Hysteresis for Gemini: avoid immediate false-negative during SPA rerender/transient DOM states
    if (currentService === 'gemini') {
        if (isLoggedIn) {
            lastStableLoggedInState = true;
            consecutiveLoggedOutChecks = 0;
        } else if (lastStableLoggedInState && !forceLoggedOut) {
            consecutiveLoggedOutChecks += 1;
            if (consecutiveLoggedOutChecks < GEMINI_LOGOUT_GRACE_CHECKS) {
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

function updateLoginStatusUI(isLoggedIn) {
    const badgeId = 'sync-multi-chat-login-badge';
    const badge = document.getElementById('sync-multi-chat-login-badge');

    if (!isLoggedIn) {
        if (!badge) {
            const badge = document.createElement('div');
            badge.id = badgeId;
            badge.style.position = 'fixed';
            badge.style.top = '10px';
            badge.style.right = '10px';
            badge.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
            badge.style.color = 'white';
            badge.style.padding = '5px 10px';
            badge.style.borderRadius = '5px';
            badge.style.zIndex = '999999';
            badge.style.fontFamily = 'sans-serif';
            badge.style.fontSize = '14px';
            badge.style.pointerEvents = 'auto'; // Enable clicking

            const textSpan = document.createElement('span');
            textSpan.innerText = '로그인 필요 ';
            badge.appendChild(textSpan);

            const loginBtn = document.createElement('button');
            loginBtn.innerText = 'Chrome으로 로그인';
            loginBtn.style.marginLeft = '5px';
            loginBtn.style.cursor = 'pointer';
            loginBtn.style.fontSize = '12px';
            loginBtn.style.padding = '2px 5px';
            loginBtn.style.border = 'none';
            loginBtn.style.borderRadius = '3px';
            loginBtn.style.backgroundColor = 'white';
            loginBtn.style.color = 'black';

            loginBtn.onclick = () => {
                if (currentService) {
                    ipcRenderer.send('external-login', currentService);
                    loginBtn.innerText = 'Chrome 실행 중...';
                    loginBtn.disabled = true;
                }
            };

            badge.appendChild(loginBtn);
            document.body.appendChild(badge);
        }
    } else {
        if (badge) {
            badge.remove();
        }
    }
}

ipcRenderer.on('external-login-closed', () => {
    const badge = document.getElementById('sync-multi-chat-login-badge');
    if (badge) {
        const btn = badge.querySelector('button');
        if (btn) {
            btn.innerText = 'Chrome으로 로그인';
            btn.disabled = false;
        }
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
