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

ipcRenderer.on('inject-prompt', (event, { text, selectors, autoSend }) => {
    console.log('Received prompt:', text, 'AutoSend:', autoSend);
    injectPrompt(text, selectors);
});

function injectPrompt(text, selectors) {
    // Try to find input element using provided selectors
    let inputEl = null;
    for (const selector of selectors.inputSelector) {
        inputEl = document.querySelector(selector);
        if (inputEl) break;
    }

    if (!inputEl) {
        console.error('Input element not found with selectors:', selectors.inputSelector);
        return;
    }

    // 1. Focus
    inputEl.focus();

    // 2. Set Value based on element type
    if (inputEl.classList.contains('ProseMirror')) {
        // Claude / ProseMirror specific handling
        inputEl.innerHTML = `<p>${text}</p>`;

        // Dispatch specific input events for ProseMirror
        const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: text,
            view: window
        });
        inputEl.dispatchEvent(inputEvent);
    } else if (inputEl.contentEditable === 'true') {
        // Generic contenteditable (Gemini)
        inputEl.innerText = text;
        inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    } else {
        // Textarea (ChatGPT)
        // React/Vue compatible setter for textarea
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(inputEl, text);

        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 3. Trigger Enter key if needed or Click Send
    // Some apps (like Claude) might need a small delay for the state to update before the button becomes enabled
    setTimeout(() => {
        let btn = null;
        for (const selector of selectors.sendButtonSelector) {
            btn = document.querySelector(selector);
            if (btn) break;
        }

        if (btn && !btn.disabled) {
            btn.click();
        } else {
            console.log('Send button not found or disabled, trying Enter key...');

            // Fallback: Try sending Enter key event
            // For Claude, sometimes Enter just adds a newline, so we try Ctrl+Enter as well
            const enterEvent = {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
                view: window
            };

            // Standard Enter
            inputEl.dispatchEvent(new KeyboardEvent('keydown', enterEvent));
            inputEl.dispatchEvent(new KeyboardEvent('keypress', enterEvent));
            inputEl.dispatchEvent(new KeyboardEvent('keyup', enterEvent));

            // Ctrl+Enter (often forces send)
            const ctrlEnterEvent = {
                ...enterEvent,
                ctrlKey: true,
                metaKey: true // For Mac support if needed, though we are on Windows
            };

            inputEl.dispatchEvent(new KeyboardEvent('keydown', ctrlEnterEvent));
            inputEl.dispatchEvent(new KeyboardEvent('keypress', ctrlEnterEvent));
            inputEl.dispatchEvent(new KeyboardEvent('keyup', ctrlEnterEvent));
        }
    }, 1000); // Increased delay to 1000ms to ensure button state updates
}

// Login Status Detection
let currentConfig = null;
let currentService = '';

ipcRenderer.on('set-config', (event, { config, service }) => {
    currentConfig = config;
    currentService = service;
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
    const badgeId = 'multi-ai-chat-login-badge';
    let badge = document.getElementById(badgeId);

    if (!isLoggedIn) {
        if (!badge) {
            badge = document.createElement('div');
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
    const badge = document.getElementById('multi-ai-chat-login-badge');
    if (badge) {
        const btn = badge.querySelector('button');
        if (btn) {
            btn.innerText = 'Chrome으로 로그인';
            btn.disabled = false;
        }
    }
});

// Reload Button
function createReloadButton() {
    const btnId = 'multi-ai-chat-reload-btn';
    if (document.getElementById(btnId)) return;

    const btn = document.createElement('button');
    btn.id = btnId;
    btn.innerText = '🔄';
    btn.title = 'Reload Page';
    btn.style.position = 'fixed';
    btn.style.top = '50px';
    btn.style.right = '10px';
    btn.style.zIndex = '999998';
    btn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '50%';
    btn.style.width = '30px';
    btn.style.height = '30px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '16px';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';

    btn.onclick = () => {
        ipcRenderer.send('reload-active-view');
    };

    document.body.appendChild(btn);
}

// Copy Button
function createCopyButton() {
    const btnId = 'multi-ai-chat-copy-btn';
    if (document.getElementById(btnId)) return;

    const btn = document.createElement('button');
    btn.id = btnId;
    btn.innerText = '📋';
    btn.title = 'Copy Chat Thread';
    btn.style.position = 'fixed';
    btn.style.top = '90px'; // Below the reload button (50px + 30px + 10px gap)
    btn.style.right = '10px';
    btn.style.zIndex = '999998';
    btn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '50%';
    btn.style.width = '30px';
    btn.style.height = '30px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '16px';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';

    btn.onclick = () => {
        // Extract text
        let content = '';
        if (currentConfig && currentConfig.contentSelector) {
            for (const selector of currentConfig.contentSelector) {
                const el = document.querySelector(selector);
                if (el) {
                    content = el.innerText;
                    break;
                }
            }
        }
        if (!content) {
            content = document.body.innerText;
        }

        ipcRenderer.send('copy-single-chat-thread', content);
    };

    document.body.appendChild(btn);
}

ipcRenderer.on('single-chat-thread-copied', () => {
    const btn = document.getElementById('multi-ai-chat-copy-btn');
    if (btn) {
        const originalText = btn.innerText;
        btn.innerText = '✅';
        setTimeout(() => {
            btn.innerText = originalText;
        }, 2000);
    }
});

// Call it
// Call it
window.addEventListener('DOMContentLoaded', () => {
    createReloadButton();
    createCopyButton();
});

// Also call it periodically in case the DOM is wiped
setInterval(() => {
    createReloadButton();
    createCopyButton();
}, 2000);
