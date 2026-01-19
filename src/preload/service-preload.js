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

ipcRenderer.on('inject-prompt', (event, { text, selectors, autoSend }) => {
    console.log('[inject-prompt] Received:', { text, selectors, autoSend, service: currentService });
    injectPrompt(text, selectors, autoSend);
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

async function injectPrompt(text, selectors, autoSend = false) {
    console.log('[injectPrompt] Starting injection. Service:', currentService);
    console.log('[injectPrompt] Text length:', text.length);
    console.log('[injectPrompt] Selectors:', selectors);

    // Try to find input element using provided selectors with retry
    let inputEl = null;
    for (let i = 0; i < 15; i++) { // Retry up to 3 seconds
        for (const selector of selectors.inputSelector) {
            inputEl = document.querySelector(selector);
            if (inputEl) {
                console.log('[injectPrompt] Input element found with selector:', selector);
                console.log('[injectPrompt] Element type:', inputEl.tagName, 'contentEditable:', inputEl.contentEditable, 'classList:', Array.from(inputEl.classList || []));
                break;
            }
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
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    inputEl.focus();
    console.log('[injectPrompt] Input focused');
    
    // Small delay after focus (human behavior)
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

    // 2. Set Value based on element type with human-like typing
    const isProseMirror = inputEl.classList.contains('ProseMirror');
    const isContentEditable = inputEl.getAttribute('contenteditable') === 'true';
    
    if (isProseMirror || isContentEditable) {
        // ContentEditable (Claude, Gemini, Grok, Perplexity)
        console.log('[injectPrompt] Detected ContentEditable element');

        // Clear existing content first
        inputEl.innerHTML = '';
        
        // Use human-like typing
        await humanLikeTyping(inputEl, text, isProseMirror, isContentEditable);
        console.log('[injectPrompt] Human-like typing completed for ContentEditable');
    } else {
        // Textarea (ChatGPT)
        console.log('[injectPrompt] Using Textarea injection (for ChatGPT)');
        
        // Clear existing content
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(inputEl, '');
        
        // Use human-like typing
        await humanLikeTyping(inputEl, text, false, false);
        console.log('[injectPrompt] Human-like typing completed for Textarea');
    }

    // 3. Trigger Enter key if needed or Click Send
    if (autoSend) {
        clickSendButton(selectors, inputEl);
    } else {
        console.log('[injectPrompt] autoSend is false, skipping send button click');
    }

    console.log('[injectPrompt] Injection complete');
}

ipcRenderer.on('click-send-button', (event, { selectors }) => {
    console.log('[click-send-button] Received request to click send button');
    // Find input element again for context
    let inputEl = null;
    for (const selector of selectors.inputSelector) {
        inputEl = document.querySelector(selector);
        if (inputEl) break;
    }
    clickSendButton(selectors, inputEl);
});

function clickSendButton(selectors, providedInputEl = null) {
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
    }, 1000); // Increased delay to 1000ms to ensure button state updates
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

setInterval(() => {
    if (!currentConfig) return;

    let isLoggedIn = false;

    // 1. Check for explicit loggedInSelector if available (Best)
    if (currentConfig.loggedInSelector) {
        for (const selector of currentConfig.loggedInSelector) {
            if (document.querySelector(selector)) {
                isLoggedIn = true;
                break;
            }
        }
    }

    // 2. Fallback to inputSelector if not determined yet
    if (!isLoggedIn) {
        for (const selector of currentConfig.inputSelector) {
            if (document.querySelector(selector)) {
                isLoggedIn = true;
                break;
            }
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
