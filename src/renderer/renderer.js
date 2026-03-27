const masterInput = document.getElementById('master-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');

// File Upload Elements
const clipBtn = document.getElementById('clip-btn');
const fileInput = document.getElementById('file-input');
const filePreviewArea = document.getElementById('file-preview-area');
const clearFilesBtn = document.getElementById('clear-files-btn');
const inputArea = document.getElementById('input-area');
const controlsContainer = document.getElementById('controls-container');
const promptToggleBtn = document.getElementById('prompt-toggle-btn');
let isPromptCollapsed = false;
let attachedFiles = [];

// History Manager
const historyManager = new window.HistoryManager();

// Base/reset URLs (must match main process reset behavior)
const SERVICE_RESET_URLS = {
    chatgpt: 'https://chatgpt.com/',
    claude: 'https://claude.ai/new',
    gemini: 'https://gemini.google.com/app',
    grok: 'https://grok.com/',
    perplexity: 'https://www.perplexity.ai/',
    genspark: 'https://www.genspark.ai/agents?type=ai_chat'
};

function getServiceResetUrl(service) {
    return SERVICE_RESET_URLS[service] || '';
}

// Gemini idle refresh timer (shown in header left of reload button)
const GEMINI_IDLE_TIMER_SECONDS = 5 * 60; // 5 min (matches main GEMINI_IDLE_THRESHOLD_MS)
const geminiIdleTimerState = {}; // slotKey -> { remainingSeconds, isPaused }

function isGeminiSlot(slotKey) {
    return slotKey === 'gemini' || (typeof slotKey === 'string' && slotKey.startsWith('gemini-'));
}

function ensureGeminiTimerState(slotKey) {
    if (!isGeminiSlot(slotKey)) return;
    if (!geminiIdleTimerState[slotKey]) {
        geminiIdleTimerState[slotKey] = { remainingSeconds: GEMINI_IDLE_TIMER_SECONDS, isPaused: false, isTypingPaused: false };
    }
}

function formatGeminiIdleTimerLabel(remainingSeconds, isPaused) {
    if (isPaused) return 'Responding';
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    return `Refresh in ${m}:${String(s).padStart(2, '0')}`;
}

function updateGeminiIdleTimerDisplay(slotKey) {
    const state = geminiIdleTimerState[slotKey];
    const el = document.getElementById(`gemini-idle-timer-${slotKey}`);
    if (!state || !el) return;
    el.textContent = formatGeminiIdleTimerLabel(state.remainingSeconds, state.isPaused);
    el.classList.toggle('typing-paused', !!state.isTypingPaused && !state.isPaused);
    el.title = state.isPaused
        ? 'Response in progress — refresh timer paused'
        : state.isTypingPaused
            ? 'Typing detected — refresh timer paused'
            : 'Auto-refresh after this time when idle';
}

function setAllGeminiTimersTypingPause(paused) {
    Object.keys(geminiIdleTimerState).forEach(slotKey => {
        geminiIdleTimerState[slotKey].isTypingPaused = paused;
        updateGeminiIdleTimerDisplay(slotKey);
    });
}

function tickGeminiIdleTimers() {
    Object.keys(geminiIdleTimerState).forEach(slotKey => {
        const state = geminiIdleTimerState[slotKey];
        if (!state.isPaused && !state.isTypingPaused && state.remainingSeconds > 0) {
            state.remainingSeconds -= 1;
            updateGeminiIdleTimerDisplay(slotKey);
        }
    });
}

let geminiIdleTimerTickId = null;
function startGeminiIdleTimerTick() {
    if (geminiIdleTimerTickId != null) return;
    geminiIdleTimerTickId = setInterval(tickGeminiIdleTimers, 1000);
}

/** Reset idle timer for one Gemini slot (e.g. after reload or per-slot new chat). */
function resetGeminiIdleTimerForSlot(slotKey) {
    if (!isGeminiSlot(slotKey)) return;
    ensureGeminiTimerState(slotKey);
    const state = geminiIdleTimerState[slotKey];
    state.remainingSeconds = GEMINI_IDLE_TIMER_SECONDS;
    state.isPaused = false;
    updateGeminiIdleTimerDisplay(slotKey);
}

/** Reset idle timer for all Gemini slots (e.g. after global new chat or history load). */
function resetAllGeminiIdleTimers() {
    Object.keys(geminiIdleTimerState).forEach(slotKey => {
        geminiIdleTimerState[slotKey].remainingSeconds = GEMINI_IDLE_TIMER_SECONDS;
        geminiIdleTimerState[slotKey].isPaused = false;
        updateGeminiIdleTimerDisplay(slotKey);
    });
}

function getResetUrlsForCurrentMode(onlySlotKey = null) {
    const resetUrls = {};
    if (chatMode === 'single') {
        const base = getServiceResetUrl(singleAiService);
        if (!base) return resetUrls;
        for (let i = 0; i < SINGLE_MODE_MAX_INSTANCES; i++) {
            if (!singleAiActiveInstances[i]) continue;
            const instanceKey = `${singleAiService}-${i}`;
            if (onlySlotKey && instanceKey !== onlySlotKey) continue;
            resetUrls[instanceKey] = base;
        }
        return resetUrls;
    }

    const activeServices = enforceMultiToggleLimit();
    activeServices.forEach(service => {
        if (onlySlotKey && service !== onlySlotKey) return;
        const base = getServiceResetUrl(service);
        if (base) resetUrls[service] = base;
    });
    return resetUrls;
}

async function applyResetUrlsToCurrentSession(resetUrls) {
    const keys = Object.keys(resetUrls || {});
    if (keys.length === 0 || !currentSessionId) return;

    try {
        const existingSession = await historyManager.getSession(currentSessionId);
        if (!existingSession) return;

        const nextUrls = { ...(existingSession.urls || {}) };
        keys.forEach((k) => { nextUrls[k] = resetUrls[k]; });

        const nextSingleAiConfig = existingSession.singleAiConfig
            ? { ...existingSession.singleAiConfig, urls: { ...(existingSession.singleAiConfig.urls || {}), ...resetUrls } }
            : null;
        const nextMultiAiConfig = existingSession.multiAiConfig
            ? { ...existingSession.multiAiConfig, urls: { ...(existingSession.multiAiConfig.urls || {}), ...resetUrls } }
            : null;

        await historyManager.saveSession({
            ...existingSession,
            id: currentSessionId,
            prompt: masterInput?.value ?? existingSession.prompt ?? '',
            isAnonymousMode,
            isScrollSyncEnabled,
            urls: nextUrls,
            singleAiConfig: nextSingleAiConfig,
            multiAiConfig: nextMultiAiConfig,
        });

        loadHistoryList({ preserveScroll: true });
    } catch (e) {
        console.error('[History] Failed to apply reset URLs to current session:', e);
    }
}

async function resetCurrentSessionViews({ onlySlotKey = null } = {}) {
    const resetUrls = getResetUrlsForCurrentMode(onlySlotKey);
    await applyResetUrlsToCurrentSession(resetUrls);

    if (onlySlotKey) {
        if (chatMode === 'single') {
            window.electronAPI.newChatForInstance(onlySlotKey);
        } else {
            window.electronAPI.newChatForService(onlySlotKey);
        }
        if (isGeminiSlot(onlySlotKey)) resetGeminiIdleTimerForSlot(onlySlotKey);
        return;
    }

    window.electronAPI.newChat();
    resetAllGeminiIdleTimers();
}

async function triggerNewChatWorkflow() {
    // Save current session first (if there is one)
    if (currentSessionId) {
        await saveCurrentSession();
    }

    let activeServices = [];
    const resetUrls = {};
    if (chatMode === 'single') {
        const base = getServiceResetUrl(singleAiService);
        for (let i = 0; i < SINGLE_MODE_MAX_INSTANCES; i++) {
            if (!singleAiActiveInstances[i]) continue;
            resetUrls[`${singleAiService}-${i}`] = base;
        }
    } else {
        activeServices = enforceMultiToggleLimit();
        activeServices.forEach(service => {
            resetUrls[service] = getServiceResetUrl(service);
        });
    }

    currentSessionId = generateId();
    const newSessionData = {
        id: currentSessionId,
        title: `Chat ${new Date().toLocaleTimeString()}`,
        layout: currentLayout,
        chatMode: chatMode,
        activeServices: chatMode === 'multi' ? activeServices : [],
        singleAiConfig: chatMode === 'single' ? {
            service: singleAiService,
            activeInstances: [...singleAiActiveInstances],
            urls: resetUrls
        } : null,
        multiAiConfig: chatMode === 'multi' ? {
            activeServices: activeServices,
            urls: resetUrls
        } : null,
        prompt: '',
        isAnonymousMode: isAnonymousMode,
        isScrollSyncEnabled: isScrollSyncEnabled,
        urls: resetUrls,
        createdAt: new Date().toISOString(),
    };

    await historyManager.saveSession(newSessionData);
    localStorage.setItem(currentSessionIdKey, currentSessionId);
    loadHistoryList();
    window.electronAPI.newChat();
    resetAllGeminiIdleTimers();
}

newChatBtn.addEventListener('click', () => triggerNewChatWorkflow());

if (promptToggleBtn) {
    promptToggleBtn.title = isPromptCollapsed ? 'Expand controls' : 'Collapse controls';
}

// Store user preference height
let userPreferredHeight = '';

function setPromptCollapsed(collapsed) {
    if (collapsed === isPromptCollapsed) return; // No change

    isPromptCollapsed = collapsed;

    if (inputArea) inputArea.classList.toggle('collapsed', isPromptCollapsed);
    if (controlsContainer) {
        controlsContainer.classList.toggle('collapsed', isPromptCollapsed);

        // Handle inline height interference with collapse
        if (collapsed) {
            if (controlsContainer.style.height) {
                userPreferredHeight = controlsContainer.style.height;
                controlsContainer.style.height = ''; // Reset to let CSS handle collapsed state
            }
        } else {
            if (userPreferredHeight) {
                controlsContainer.style.height = userPreferredHeight;
            }
        }
    }

    if (promptToggleBtn) {
        promptToggleBtn.setAttribute('aria-expanded', (!isPromptCollapsed).toString());
        promptToggleBtn.title = isPromptCollapsed ? 'Expand controls' : 'Collapse controls';
        // Rotate icon
        const icon = promptToggleBtn.querySelector('.toggle-icon');
        if (icon) {
            // CSS handles rotation via class on container, but let's ensure icon state if needed
            // styles.css: #controls-container.collapsed .toggle-icon { transform: rotate(180deg); }
        }
    }

    // Notify other renderer modules (e.g. CPB prompt expand handler)
    window.dispatchEvent(new CustomEvent('smc:prompt-collapsed-changed', {
        detail: { collapsed: isPromptCollapsed }
    }));
}

if (promptToggleBtn) {
    promptToggleBtn.addEventListener('click', () => {
        setPromptCollapsed(!isPromptCollapsed);
    });
}

clearFilesBtn?.addEventListener('click', () => {
    attachedFiles = [];
    renderFilePreview();
});

const copyChatBtn = document.getElementById('copy-chat-btn');
const copyFormatSelect = document.getElementById('copy-format-select');
const copyLastResponseBtn = document.getElementById('copy-last-response-btn');
const crossCheckBtn = document.getElementById('cross-check-btn');
const anonymousBtn = document.getElementById('anonymous-btn');

if (crossCheckBtn) {
    crossCheckBtn.addEventListener('click', () => {
        openCrossCheckModal();
    });
}

function setBottomControlsDisabled(disabled) {
    const chatModeSettingsControl = document.getElementById('chat-mode-settings-btn');
    const singleModeToggleInputs = Array.from(
        document.querySelectorAll('#single-ai-toggles input[type="checkbox"]')
    );
    const viewToggleInputs = Object.values(toggles || {}).filter(Boolean);
    const layoutButtons = Object.values(layoutBtns || {}).filter(Boolean);
    const controls = [
        newChatBtn,
        copyChatBtn,
        copyLastResponseBtn,
        crossCheckBtn,
        anonymousBtn,
        copyFormatSelect,
        scrollSyncToggle,
        promptToggleBtn,
        clipBtn,
        clearFilesBtn,
        sendBtn,
        masterInput,
        fileInput,
        chatModeSettingsControl,
        ...viewToggleInputs,
        ...layoutButtons,
        ...singleModeToggleInputs
    ].filter(Boolean);

    controls.forEach(el => {
        try {
            el.disabled = !!disabled;
        } catch (e) { /* ignore */ }
        if (disabled) {
            el.setAttribute?.('aria-disabled', 'true');
        } else {
            el.removeAttribute?.('aria-disabled');
        }
    });
}

function isAnyViewMaximized() {
    return !!document.querySelector('.view-slot.maximized');
}

function restoreAllMaximizedViews() {
    const maximizedBtns = document.querySelectorAll('.maximized-btn');
    maximizedBtns.forEach((btn) => btn.click());
}

function isBlockedBottomControlTarget(target) {
    if (!target) return false;
    const blockedSelectors = [
        '#new-chat-btn',
        '#copy-format-select',
        '#copy-chat-btn',
        '#copy-last-response-btn',
        '#cross-check-btn',
        '#anonymous-btn',
        '#scroll-sync-toggle',
        '#chat-mode-settings-btn',
        '.layout-btn',
        '#multi-ai-toggles .service-toggle-label',
        '#multi-ai-toggles input[type="checkbox"]',
        '#single-ai-toggles .service-toggle-label',
        '#single-ai-toggles input[type="checkbox"]'
    ];
    return !!target.closest(blockedSelectors.join(', '));
}

/**
 * After a confirm/modal that toggled BrowserViews, restore visibility only when the main chat workspace should show them.
 * Custom Prompt Builder (`#cpb-modal.visible`) and Session Custom Prompt Builder (`.session-prompt-modal.visible`)
 * keep views detached so they do not stack above those overlays (e.g. after exiting Mermaid fullscreen).
 */
function applySmcPreferredServiceVisibility() {
    try {
        const cpb = document.getElementById('cpb-modal');
        if (cpb && cpb.classList.contains('visible')) {
            window.electronAPI?.setServiceVisibility?.(false);
            return;
        }
        const sessionSpb = document.querySelector('.session-prompt-modal.visible');
        if (sessionSpb) {
            window.electronAPI?.setServiceVisibility?.(false);
            return;
        }
        const crossCheck = document.getElementById('cross-check-modal');
        if (crossCheck && crossCheck.classList.contains('visible')) {
            window.electronAPI?.setServiceVisibility?.(false);
            return;
        }
        const controls = document.getElementById('controls-container');
        if (controls && controls.classList.contains('prompt-expanded')) {
            window.electronAPI?.setServiceVisibility?.(false);
            return;
        }
        window.electronAPI?.setServiceVisibility?.(true);
    } catch (_) {}
}
window.applySmcPreferredServiceVisibility = applySmcPreferredServiceVisibility;

/**
 * Themed confirm dialog (replaces window.confirm). Pass a string or { title, message, confirmText, cancelText, danger }.
 * @param {string|{title?:string,message:string,confirmText?:string,cancelText?:string,danger?:boolean}} input
 * @returns {Promise<boolean>}
 */
function showSmcConfirm(input) {
    const opts = typeof input === 'string' ? { message: input } : (input && typeof input === 'object' ? input : { message: '' });
    return new Promise((resolve) => {
        const modal = document.getElementById('smc-confirm-modal');
        const titleEl = document.getElementById('smc-confirm-title');
        const msgEl = document.getElementById('smc-confirm-message') || document.getElementById('smc-confirm-msg');
        const okBtn = document.getElementById('smc-confirm-ok');
        const cancelBtn = document.getElementById('smc-confirm-cancel');
        const closeBtn = document.getElementById('smc-confirm-close');
        if (!modal || !msgEl || !okBtn || !cancelBtn) { resolve(false); return; }

        if (titleEl) titleEl.textContent = opts.title || 'Confirm';
        msgEl.textContent = opts.message || '';
        okBtn.textContent = opts.confirmText || 'OK';
        cancelBtn.textContent = opts.cancelText || 'Cancel';
        okBtn.className = 'btn-primary';
        if (opts.danger) okBtn.classList.add('smc-confirm-danger');

        try { window.electronAPI.setServiceVisibility(false); } catch (_) {}
        modal.classList.add('visible');

        const cleanup = (result) => {
            modal.classList.remove('visible');
            applySmcPreferredServiceVisibility();
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            if (closeBtn) closeBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKey);
            resolve(result);
        };
        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onBackdrop = (e) => {
            if (e.target === modal) onCancel();
        };
        const onKey = (e) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') onOk();
        };
        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        if (closeBtn) closeBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKey);
        okBtn.focus();
    });
}

async function requestRestoreForBottomControl() {
    const shouldRestore = await showSmcConfirm('A view is maximized.\nRestore it to use this control?');
    if (!shouldRestore) return;
    restoreAllMaximizedViews();
}

if (controlsContainer) {
    controlsContainer.addEventListener('pointerdown', (e) => {
        if (!isAnyViewMaximized()) return;
        if (!isBlockedBottomControlTarget(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        requestRestoreForBottomControl();
    }, true);
}

copyChatBtn.addEventListener('click', () => {
    const format = copyFormatSelect ? copyFormatSelect.value : 'markdown';
    window.electronAPI.copyChatThread({ format, anonymousMode: isAnonymousMode });
});

window.electronAPI.onChatThreadCopied((data) => {
    const originalText = copyChatBtn.innerText;

    if (data && data.failed && data.failed.length > 0) {
        // Show partial success
        copyChatBtn.innerText = `Partial Copy (${data.success.length}/${data.success.length + data.failed.length})`;
        console.warn('Failed to copy from:', data.failed.join(', '));
        // You could add a toast here if you had a toast component
    } else {
        copyChatBtn.innerText = 'Copied!';
    }

    setTimeout(() => {
        copyChatBtn.innerText = originalText;
    }, 2000);
});

// Copy Last Response Button (copies last response from ALL active services)
if (copyLastResponseBtn) {
    copyLastResponseBtn.addEventListener('click', () => {
        const format = copyFormatSelect ? copyFormatSelect.value : 'markdown';
        window.electronAPI.copyLastResponse({ format, anonymousMode: isAnonymousMode });
    });

    window.electronAPI.onLastResponseCopied((data) => {
        const originalText = copyLastResponseBtn.innerText;

        if (data && data.failed && data.failed.length > 0) {
            copyLastResponseBtn.innerText = `Partial (${data.success.length}/${data.success.length + data.failed.length})`;
        } else {
            copyLastResponseBtn.innerText = 'Copied!';
        }

        setTimeout(() => {
            copyLastResponseBtn.innerText = originalText;
        }, 2000);
    });
}

// Handle single-service copy button callbacks
window.electronAPI.onSingleChatThreadCopied((data) => {
    const btn = document.querySelector(`#slot-${data.service} .slot-copy-btn`);
    if (btn) {
        const originalText = btn.innerText;
        btn.innerText = data.success ? '✓' : '✗';
        setTimeout(() => {
            btn.innerText = originalText;
        }, 1500);
    }
});

let isAnonymousMode = false;
const SERVICE_ALIASES = {
    'chatgpt': '(A)',
    'claude': '(B)',
    'gemini': '(C)',
    'grok': '(D)',
    'perplexity': '(E)',
    'genspark': '(F)'
};

const SERVICE_ICONS = {
    chatgpt: '<svg fill="#FFFFFF" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>OpenAI</title><path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path></svg>',
    claude: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#D77655" d="M4.709 15.955l4.71-2.644.08-.23-.08-.128-.23-.001-.787-.048-2.693-.073-2.336-.097-2.263-.121-.57-.121-.534-.704.055-.351.479-.322.686.06 1.516.103 2.275.157 1.65.097 2.444.254h.388l.055-.157-.133-.097-.103-.097-2.354-1.595-2.549-1.686-1.334-.971-.722-.492-.364-.461-.157-1.006.655-.721.88.06.225.06.891.686 1.904 1.474 2.487 1.831.364.302.146-.103.018-.073-.163-.273-1.353-2.444-1.443-2.487-.642-1.031-.17-.618c-.06-.254-.103-.467-.103-.728l.746-1.013.412-.133.995.133.42.364.618 1.414 1.001 2.227 1.553 3.026.455.898.243.832.09.254.157-.001v-.146l.128-1.705.236-2.094.23-2.693.079-.759.375-.909.746-.492.582.278.479.686-.066.443-.285 1.85-.558 2.9-.364 1.941h.212l.243-.243.982-1.304 1.65-2.064.728-.819.849-.905.545-.43 1.031-.001.758 1.128-.34 1.165-1.062 1.346-.88 1.14-1.262 1.699-.788 1.359.073.108.188-.018 2.851-.607 1.54-.278 1.838-.315.832.388.09.395-.327.807-1.966.486-2.306.461-3.433.812-.042.031.048.06 1.547.146.662.035h1.62l3.016.225.788.521.472.637-.08.486-1.213.618-1.638-.388-3.82-.909-1.31-.327-.181-.001v.108l1.092 1.068 2.001 1.807 2.506 2.33.128.576-.322.455-.34-.048-2.202-1.656-.849-.746-1.924-1.62-.128-.001v.17l.443.649 2.34 3.519.121 1.08-.17.351-.607.212-.667-.121-1.37-1.924-1.414-2.166-1.14-1.941-.139.079-.673 7.249-.315.37-.728.278-.607-.461-.322-.746.322-1.474.388-1.924.315-1.529.285-1.899.17-.631-.011-.042-.139.018-1.432 1.966-2.178 2.943-1.723 1.844-.412.164-.715-.37.066-.662.4-.588 2.385-3.033 1.438-1.88.929-1.086-.006-.157h-.055l-6.335 4.113-1.128.146-.486-.455.06-.746.23-.243 1.904-1.31-.006.006.001.007z"/></svg>',
    gemini: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 24c0-6.627-5.373-12-12-12 6.627 0 12-5.373 12-12 0 6.627 5.373 12 12 12-6.627 0-12 5.373-12 12z" fill="#4285F4"/></svg>',
    grok: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M7.5 12.5l7.5-5.5c.367-.273.893-.166 1.07.256.92 2.226.51 4.9-1.326 6.74-1.834 1.838-4.387 2.24-6.72 1.322l-2.548 1.182c3.655 2.501 8.094 1.882 10.868-.896 2.2-2.203 2.882-5.205 2.244-7.913l.006.007c-.924-3.977.227-5.57 2.584-8.82.056-.077.113-.154.168-.233l-3.102 3.107v-.009L7.5 12.5zm-1.545 1.345c-2.624-2.51-2.171-6.392.067-8.632 1.655-1.657 4.367-2.334 6.735-1.34l2.542-1.174a7.34 7.34 0 0 0-1.719-.94A8.437 8.437 0 0 0 4.41 3.607c-2.38 2.383-3.13 6.048-1.843 9.176.96 2.338-.614 3.991-2.199 5.66C.154 18.65-.045 19.24 0 19.866l7.163-6.404-.708.383z"/></svg>',
    perplexity: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.785 0v7.272H22.5V17.62h-2.935V24l-7.037-6.194v6.145h-1.091v-6.152L4.392 24v-6.465H1.5V7.188h2.884V0l7.053 6.494V.19h1.09v6.49L19.786 0zm-7.257 9.044v7.319l5.946 5.234V14.44l-5.946-5.397zm-1.099-.08l-5.946 5.398v7.235l5.946-5.234V8.965zm8.136 7.58h1.844V8.349H13.46l6.105 5.54v2.655zm-8.982-8.28H2.59v8.195h1.8v-2.576l6.192-5.62zM5.475 2.476v4.71h5.115l-5.115-4.71zm13.219 0l-5.115 4.71h5.115v-4.71z" fill="#22B8CD" fill-rule="nonzero"/></svg>',
    genspark: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#1a1a2e"/><path fill="#fff" d="M19.8 18H4.1c-.33 0-.6.27-.6.6v1.27c0 .33.27.6.6.6h15.7c.33 0 .6-.27.6-.6V18.6c0-.33-.27-.6-.6-.6zM8.7 15.4c-.1 0-.18-.07-.19-.17-.62-4.1-1.07-4.46-5.14-5.08a.26.26 0 0 1 0-.51c4.05-.61 4.41-.97 5.02-5.02a.26.26 0 0 1 .51 0c.61 4.05.97 4.41 5.02 5.02.12.02.22.13.22.25 0 .13-.09.24-.22.25-4.07.61-4.42.98-5.03 5.08-.01.09-.1.17-.19.17zM16.5 10.1a.12.12 0 0 1-.12-.1c-.39-2.56-.67-2.79-3.21-3.17-.08-.01-.14-.08-.14-.16 0-.08.06-.15.14-.16 2.53-.38 2.76-.61 3.14-3.14.01-.08.08-.14.16-.14.08 0 .15.06.16.14.38 2.53.61 2.76 3.14 3.14.08.01.14.08.14.16 0 .08-.06.15-.14.16-2.54.38-2.76.61-3.15 3.17-.01.06-.05.1-.12.1zM16.48 16.5c-.04 0-.07-.03-.08-.07-.25-1.63-.43-1.77-2.04-2.02-.05-.01-.09-.05-.09-.1s.04-.09.09-.1c1.61-.24 1.75-.39 2-2a.1.1 0 0 1 .1-.09c.05 0 .09.04.1.09.24 1.61.39 1.75 2 2 .04.01.09.05.09.1s-.04.09-.09.1c-1.62.24-1.76.39-2 2-.01.04-.04.07-.08.07z"/></svg>'
};

if (anonymousBtn) {
    anonymousBtn.addEventListener('click', toggleAnonymousMode);
}

function toggleAnonymousMode() {
    isAnonymousMode = !isAnonymousMode;

    if (isAnonymousMode) {
        anonymousBtn.classList.add('active');
    } else {
        anonymousBtn.classList.remove('active');
    }

    // Keep CPB and previews in sync with Anonymous toggle (send/substitute use this)
    window._cpb_isAnonymousMode = isAnonymousMode;
    window.dispatchEvent(new CustomEvent('smc:anonymous-mode-changed', { detail: { anonymousMode: isAnonymousMode } }));

    updateServiceToggles();
    // In Single Mode, also update instance toggle labels and per-view headers
    if (chatMode === 'single') {
        renderSingleAiToggles();
        updateSingleModeHeaders();
    }

    // Report state change to main process for session persistence (SESS-002)
    if (typeof reportCurrentUIState === 'function') {
        reportCurrentUIState();
    }
}

function updateSingleModeHeaders() {
    if (chatMode !== 'single') return;
    if (!singleAiService) return;
    // Update per-slot header titles (e.g. ChatGPT (A) vs ChatGPT #1)
    activeServiceKeys.forEach((slotKey) => {
        const match = slotKey.match(/^(.+)-(\d)$/);
        if (!match) return;
        const serviceKey = match[1];
        const idx = parseInt(match[2], 10);
        const serviceName = SERVICE_NAMES[serviceKey] || serviceKey;
        const icon = SERVICE_ICONS[serviceKey] || '';
        const displayName = isAnonymousMode ? `${serviceName} ${INSTANCE_ALIASES[idx]}` : `${serviceName} #${idx + 1}`;
        const headerName = document.querySelector(`#slot-${slotKey} .service-name`);
        if (headerName) {
            headerName.innerHTML = `<span class="service-icon-wrapper header-icon">${icon}</span> ${displayName}`;
        }
    });
}

function updateServiceToggles() {
    const names = {
        'chatgpt': 'ChatGPT',
        'claude': 'Claude',
        'gemini': 'Gemini',
        'grok': 'Grok',
        'perplexity': 'Perplexity',
        'genspark': 'Genspark'
    };

    for (const [service, toggle] of Object.entries(toggles)) {
        // The label text is now in a span with class 'label-text'
        const labelText = toggle.parentElement.querySelector('.label-text');
        const name = names[service] || service;
        const icon = SERVICE_ICONS[service] || '';

        // Chat Input Prompt Area Logic
        // Improvement: "Service Icon" + "Anonymous (e.g. (A)) Identifier"
        // This implies Name is removed and replaced by Icon.
        let checkboxContent = `<span class="service-icon-wrapper" title="${name}">${icon}</span>`;
        if (isAnonymousMode && SERVICE_ALIASES[service]) {
            checkboxContent += ` <span class="service-alias">${SERVICE_ALIASES[service]}</span>`;
        }

        if (labelText) {
            labelText.innerHTML = checkboxContent;
        }

        // Web View Title Logic
        // Improvement: "Service Icon" + "Service Name" + "Anonymous (e.g. (A)) Identifier"
        const headerName = document.querySelector(`#slot-${service} .service-name`);
        if (headerName) {
            let headerContent = `<span class="service-icon-wrapper header-icon">${icon}</span> ${name}`;
            if (isAnonymousMode && SERVICE_ALIASES[service]) {
                headerContent += ` <span class="service-alias">${SERVICE_ALIASES[service]}</span>`;
            }
            headerName.innerHTML = headerContent;
        }
    }

    // Single AI Mode: update instance headers too (handles cases like Grok showing #1~#4 in anonymous)
    if (chatMode === 'single') {
        updateSingleModeHeaders();
    }
}

const scrollSyncToggle = document.getElementById('scroll-sync-toggle');
let isScrollSyncEnabled = false;

if (scrollSyncToggle) {
    scrollSyncToggle.addEventListener('change', (e) => {
        isScrollSyncEnabled = e.target.checked;
        window.electronAPI.toggleScrollSync(isScrollSyncEnabled);
    });
}

const toggles = {
    chatgpt: document.getElementById('toggle-chatgpt'),
    claude: document.getElementById('toggle-claude'),
    gemini: document.getElementById('toggle-gemini'),
    grok: document.getElementById('toggle-grok'),
    perplexity: document.getElementById('toggle-perplexity'),
    genspark: document.getElementById('toggle-genspark')
};

// Multi AI Mode constraints
const MULTI_SERVICE_ORDER = ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'genspark'];
const MAX_MULTI_ACTIVE = 4;
let isApplyingMultiToggleClamp = false;

function getCheckedMultiServicesInOrder() {
    return MULTI_SERVICE_ORDER.filter(svc => toggles[svc] && toggles[svc].checked);
}

function clampMultiActiveServices(list) {
    if (!Array.isArray(list)) return [];
    const dedup = [];
    for (const s of list) {
        if (MULTI_SERVICE_ORDER.includes(s) && !dedup.includes(s)) dedup.push(s);
    }
    return dedup.slice(0, MAX_MULTI_ACTIVE);
}

function enforceMultiToggleLimit() {
    if (chatMode !== 'multi') return getCheckedMultiServicesInOrder();
    const checked = getCheckedMultiServicesInOrder();
    const clamped = clampMultiActiveServices(checked);
    if (checked.length <= MAX_MULTI_ACTIVE) return checked;

    // Turn off extras to satisfy "max 4"
    isApplyingMultiToggleClamp = true;
    try {
        MULTI_SERVICE_ORDER.forEach(svc => {
            const shouldBeOn = clamped.includes(svc);
            if (toggles[svc]) toggles[svc].checked = shouldBeOn;
            window.electronAPI.toggleService(svc, shouldBeOn);
        });
    } finally {
        isApplyingMultiToggleClamp = false;
    }
    return clamped;
}

// ========================================
// Chat Mode State (Single AI / Multi AI)
// ========================================
let chatMode = 'multi'; // 'multi' | 'single'
let singleAiService = null; // 'chatgpt' | 'claude' | etc.
const SINGLE_MODE_MAX_INSTANCES = 3; // Reduced to 3 for bot detection mitigation
let singleAiActiveInstances = [true, true, true]; // 3 instances max
let selectedServiceForSingleMode = null; // Temp selection in modal

// Remember last Multi-mode selection so switching Single -> Multi doesn't clear toggles.
let lastMultiActiveServices = null;
let isRestoringMultiToggles = false;

function snapshotCurrentMultiSelection() {
    const active = Object.entries(toggles)
        .filter(([_, t]) => t && t.checked)
        .map(([k]) => k);
    lastMultiActiveServices = active;
    try {
        localStorage.setItem('lastMultiActiveServices', JSON.stringify(active));
    } catch (e) { /* ignore */ }
}

async function restoreMultiSelectionAfterModeSwitch() {
    if (isRestoringMultiToggles) return;
    isRestoringMultiToggles = true;
    try {
        let desired = lastMultiActiveServices;
        if (!desired || desired.length === 0) {
            try {
                const raw = localStorage.getItem('lastMultiActiveServices');
                desired = raw ? JSON.parse(raw) : null;
            } catch (e) { /* ignore */ }
        }
        if (!desired || desired.length === 0) {
            // Fall back to main-process persisted sessionState
            const saved = await window.electronAPI.getSavedSession?.();
            desired = saved?.activeServices || [];
        }

        desired = clampMultiActiveServices(desired);

        const allServices = Object.keys(toggles);
        allServices.forEach(svc => {
            const shouldBeOn = desired.includes(svc);
            if (toggles[svc]) toggles[svc].checked = shouldBeOn;
            window.electronAPI.toggleService(svc, shouldBeOn);
        });

        updateLayoutState();
        updateServiceToggles();
    } finally {
        isRestoringMultiToggles = false;
    }
}

const SERVICE_NAMES = {
    'chatgpt': 'ChatGPT',
    'claude': 'Claude',
    'gemini': 'Gemini',
    'grok': 'Grok',
    'perplexity': 'Perplexity',
    'genspark': 'Genspark'
};

// Instance aliases for Anonymous Mode
const INSTANCE_ALIASES = ['(A)', '(B)', '(C)', '(D)'];

// Chat Mode Modal Elements
const multiAiToggles = document.getElementById('multi-ai-toggles');
const singleAiToggles = document.getElementById('single-ai-toggles');
const chatModeModal = document.getElementById('chat-mode-modal');
const chatModeSettingsBtn = document.getElementById('chat-mode-settings-btn');
const closeChatModeBtn = document.getElementById('close-chat-mode-btn');
const btnMultiAiMode = document.getElementById('btn-multi-ai-mode');
const btnSingleAiMode = document.getElementById('btn-single-ai-mode');
const chatModeOptions = document.getElementById('chat-mode-options');
const singleAiSelection = document.getElementById('single-ai-selection');
const serviceSelectionGrid = document.getElementById('service-selection-grid');
const btnBackToModes = document.getElementById('btn-back-to-modes');
const btnApplySingleAi = document.getElementById('btn-apply-single-ai');
const currentModeText = document.getElementById('current-mode-text');

// Chat Mode Modal Functions
function openChatModeModal() {
    if (!chatModeModal) return;
    
    // Reset to mode selection view
    if (chatModeOptions) chatModeOptions.classList.remove('hidden');
    if (singleAiSelection) singleAiSelection.classList.add('hidden');
    
    // Update active state
    if (btnMultiAiMode) btnMultiAiMode.classList.toggle('active', chatMode === 'multi');
    if (btnSingleAiMode) btnSingleAiMode.classList.toggle('active', chatMode === 'single');
    
    // Update current mode text
    if (currentModeText) {
        if (chatMode === 'single' && singleAiService) {
            currentModeText.textContent = `Single AI (${SERVICE_NAMES[singleAiService]})`;
        } else {
            currentModeText.textContent = 'Multi AI';
        }
    }
    
    // Reset selection
    selectedServiceForSingleMode = singleAiService;
    
    chatModeModal.classList.add('visible');
    
    // Hide services to show modal (like Cross Check)
    window.electronAPI.setServiceVisibility(false);
}

function closeChatModeModal() {
    if (chatModeModal) {
        chatModeModal.classList.remove('visible');
    }
    // Show services again
    window.electronAPI.setServiceVisibility(true);
}

// Chat Mode Event Listeners
if (chatModeSettingsBtn) {
    chatModeSettingsBtn.addEventListener('click', openChatModeModal);
}

if (closeChatModeBtn) {
    closeChatModeBtn.addEventListener('click', closeChatModeModal);
}

if (chatModeModal) {
    chatModeModal.addEventListener('click', (e) => {
        if (e.target === chatModeModal) closeChatModeModal();
    });
}

if (btnMultiAiMode) {
    btnMultiAiMode.addEventListener('click', async () => {
        if (chatMode === 'multi') {
            closeChatModeModal();
            return;
        }
        
        const result = await window.electronAPI.setChatMode('multi');
        if (result.success) {
            chatMode = 'multi';
            singleAiService = null;
            updateToggleUI();
            // Restore last Multi selection (fix: all toggles unchecked when coming from Single)
            await restoreMultiSelectionAfterModeSwitch();
            closeChatModeModal();
        }
    });
}

if (btnSingleAiMode) {
    btnSingleAiMode.addEventListener('click', () => {
        if (chatModeOptions) chatModeOptions.classList.add('hidden');
        if (singleAiSelection) singleAiSelection.classList.remove('hidden');
        renderServiceSelectionGrid();
    });
}

if (btnBackToModes) {
    btnBackToModes.addEventListener('click', () => {
        if (singleAiSelection) singleAiSelection.classList.add('hidden');
        if (chatModeOptions) chatModeOptions.classList.remove('hidden');
    });
}

if (btnApplySingleAi) {
    btnApplySingleAi.addEventListener('click', async () => {
        if (!selectedServiceForSingleMode) return;

        // Snapshot Multi-mode selection before switching into Single mode
        if (chatMode === 'multi') {
            snapshotCurrentMultiSelection();
        }
        
        const result = await window.electronAPI.setChatMode('single', {
            service: selectedServiceForSingleMode,
            activeInstances: [true, true, true] // SINGLE_MODE_MAX_INSTANCES
        });
        
        if (result.success) {
            chatMode = 'single';
            singleAiService = selectedServiceForSingleMode;
            // Ensure max 3 instances
            const restored = result.activeInstances || [true, true, true];
            singleAiActiveInstances = restored.slice(0, SINGLE_MODE_MAX_INSTANCES);
            updateToggleUI();
            closeChatModeModal();
        }
    });
}

// Render service selection grid
function renderServiceSelectionGrid() {
    if (!serviceSelectionGrid) return;
    
    serviceSelectionGrid.innerHTML = '';
    const allServices = ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'genspark'];
    
    allServices.forEach(service => {
        const option = document.createElement('div');
        option.className = 'service-option' + (selectedServiceForSingleMode === service ? ' selected' : '');
        option.dataset.service = service;
        option.innerHTML = `
            <div class="service-icon">${SERVICE_ICONS[service] || ''}</div>
            <div class="service-name">${SERVICE_NAMES[service]}</div>
        `;
        option.addEventListener('click', () => {
            // Update selection
            serviceSelectionGrid.querySelectorAll('.service-option').forEach(el => el.classList.remove('selected'));
            option.classList.add('selected');
            selectedServiceForSingleMode = service;
            if (btnApplySingleAi) btnApplySingleAi.disabled = false;
        });
        serviceSelectionGrid.appendChild(option);
    });
    
    // Update apply button state
    if (btnApplySingleAi) btnApplySingleAi.disabled = !selectedServiceForSingleMode;
}

// Update Toggle UI based on Chat Mode
function updateToggleUI() {
    if (chatMode === 'single') {
        // Hide Multi AI toggles, show Single AI toggles
        if (multiAiToggles) multiAiToggles.classList.add('hidden');
        if (singleAiToggles) {
            singleAiToggles.classList.remove('hidden');
            renderSingleAiToggles();
        }
    } else {
        // Show Multi AI toggles, hide Single AI toggles
        if (multiAiToggles) multiAiToggles.classList.remove('hidden');
        if (singleAiToggles) singleAiToggles.classList.add('hidden');
    }
    
    // Update current mode text
    if (currentModeText) {
        if (chatMode === 'single' && singleAiService) {
            currentModeText.textContent = `Single AI (${SERVICE_NAMES[singleAiService]})`;
        } else {
            currentModeText.textContent = 'Multi AI';
        }
    }
    
    // Update layout state
    updateLayoutState();
}

// Render Single AI Mode instance toggles
function renderSingleAiToggles() {
    if (!singleAiToggles || !singleAiService) return;
    
    singleAiToggles.innerHTML = '';
    const icon = SERVICE_ICONS[singleAiService] || '';
    const name = SERVICE_NAMES[singleAiService] || singleAiService;
    
    for (let i = 0; i < SINGLE_MODE_MAX_INSTANCES; i++) {
        const label = document.createElement('label');
        label.className = 'service-toggle-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `toggle-single-${i}`;
        checkbox.checked = singleAiActiveInstances[i];
        checkbox.addEventListener('change', (e) => {
            singleAiActiveInstances[i] = e.target.checked;
            window.electronAPI.toggleSingleInstance(i, e.target.checked);
            updateLayoutState();
        });
        
        const labelText = document.createElement('span');
        labelText.className = 'label-text';
        
        const instanceLabel = isAnonymousMode ? INSTANCE_ALIASES[i] : `#${i + 1}`;
        labelText.innerHTML = `<span class="service-icon-wrapper" title="${name}">${icon}</span> <span class="instance-number">${instanceLabel}</span>`;
        
        label.appendChild(checkbox);
        label.appendChild(labelText);
        singleAiToggles.appendChild(label);
    }
}

// Listen for chat mode changes from main process
if (window.electronAPI.onChatModeChanged) {
    window.electronAPI.onChatModeChanged((data) => {
        console.log('[ChatMode] Mode changed:', data);
        chatMode = data.mode;
        singleAiService = data.service;
        if (data.activeInstances) {
            singleAiActiveInstances = data.activeInstances;
        }
        updateToggleUI();
        resetAllGeminiIdleTimers();
    });
}

// Listen for Single AI instance URL changes
if (window.electronAPI.onSingleInstanceUrlChanged) {
    window.electronAPI.onSingleInstanceUrlChanged((data) => {
        console.log('[SingleAI] URL changed:', data);
        // Update URL display if needed (similar to multi-AI mode)
        const urlEl = document.getElementById(`url-text-${data.instanceKey}`);
        if (urlEl) {
            urlEl.textContent = data.url;
            urlEl.dataset.url = data.url;
        }
    });
}

// Handle Send Button Click
sendBtn.addEventListener('click', () => {
    sendPrompt();
});

// Handle Enter Key shortcuts for chat reset/new chat
masterInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            // Ctrl+Shift+Enter: Reset current session views to new-chat URLs (no new history entry)
            e.preventDefault();
            await resetCurrentSessionViews();
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl+Enter: Broadcast prompt to active webviews
            e.preventDefault();
            sendPrompt();
        }
    }
});

let pendingConfirmation = false;
const MAIN_INPUT_PLACEHOLDER = `Type your prompt here... (Ctrl+Enter for send, Ctrl+Shift+Enter for Reset Chat)

· Type "/" slash command to load and insert a saved custom prompt template.
· Type "{{" to insert global/system variable.`;
let confirmationModalIntervalId = null;
let confirmationModalLayerState = {
    hadModalLayer: false,
    hadPopupLayer: false,
    serviceVisibilityOverridden: false
};

function activateConfirmationModalLayer() {
    const body = document.body;
    if (!body) return;

    confirmationModalLayerState.hadModalLayer = body.classList.contains('main-modal-layer-active');
    confirmationModalLayerState.hadPopupLayer = body.classList.contains('main-popup-layer-active');
    confirmationModalLayerState.serviceVisibilityOverridden = false;

    if (!confirmationModalLayerState.hadModalLayer) {
        body.classList.add('main-modal-layer-active');
    }

    // BrowserView is rendered above DOM in Electron, so hide services while this modal is visible.
    if (!confirmationModalLayerState.hadModalLayer && !confirmationModalLayerState.hadPopupLayer) {
        try {
            window.electronAPI.setServiceVisibility(false);
            confirmationModalLayerState.serviceVisibilityOverridden = true;
        } catch (_) { }
    }
}

function deactivateConfirmationModalLayer() {
    const body = document.body;

    if (body && !confirmationModalLayerState.hadModalLayer) {
        body.classList.remove('main-modal-layer-active');
    }

    if (confirmationModalLayerState.serviceVisibilityOverridden) {
        try { window.electronAPI.setServiceVisibility(true); } catch (_) { }
    }

    confirmationModalLayerState = {
        hadModalLayer: false,
        hadPopupLayer: false,
        serviceVisibilityOverridden: false
    };
}

// Modal Logic
function showModal(message, duration = 3000) {
    let modal = document.getElementById('confirmation-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirmation-modal';
        modal.className = 'modal upload-confirm-modal';
        modal.innerHTML = `
            <div class="modal-content upload-confirm-modal-content">
                <div class="upload-confirm-body">
                    <div class="upload-confirm-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <p class="upload-confirm-title">Files are attached to each prompt form</p>
                    <p class="upload-confirm-text"></p>
                    <div class="upload-confirm-countdown" aria-live="polite">
                        <span class="upload-confirm-timer"></span>
                        <span class="upload-confirm-hint">Time remaining before confirmation step</span>
                    </div>
                    <div class="upload-confirm-progress" role="progressbar" aria-label="Upload confirmation waiting progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                        <div class="upload-confirm-progress-fill"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const textEl = modal.querySelector('.upload-confirm-text');
    const timerEl = modal.querySelector('.upload-confirm-timer');
    const progressEl = modal.querySelector('.upload-confirm-progress-fill');
    const progressWrapEl = modal.querySelector('.upload-confirm-progress');

    if (confirmationModalIntervalId) {
        clearInterval(confirmationModalIntervalId);
        confirmationModalIntervalId = null;
        modal.classList.remove('visible');
        deactivateConfirmationModalLayer();
    }

    activateConfirmationModalLayer();
    textEl.textContent = message;
    modal.classList.add('visible');

    const totalDuration = Math.max(500, Number(duration) || 3000);
    const startedAt = Date.now();

    const updateCountdownUi = () => {
        const elapsedMs = Date.now() - startedAt;
        const remainingMs = Math.max(0, totalDuration - elapsedMs);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const progress = Math.min(100, (elapsedMs / totalDuration) * 100);

        if (timerEl) timerEl.textContent = `${remainingSeconds}s`;
        if (progressEl) progressEl.style.width = `${progress}%`;
        if (progressWrapEl) progressWrapEl.setAttribute('aria-valuenow', String(Math.round(progress)));

        if (remainingMs <= 0) {
            clearInterval(confirmationModalIntervalId);
            confirmationModalIntervalId = null;
            modal.classList.remove('visible');
            deactivateConfirmationModalLayer();
            // Enable inputs and set placeholder for confirmation
            setInputsEnabled(true);
            masterInput.placeholder = "Press Ctrl+Enter to confirm send...";
            masterInput.focus();
        }
    };

    updateCountdownUi();

    confirmationModalIntervalId = setInterval(updateCountdownUi, 100);
}

function setInputsEnabled(enabled) {
    masterInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
    clipBtn.disabled = !enabled;
    fileInput.disabled = !enabled;
}

// Listen for file upload completion
if (window.electronAPI.onFileUploadComplete) {
    window.electronAPI.onFileUploadComplete(() => {
        pendingConfirmation = true;
        showModal("Please verify upload completion in each AI service view,\nthen press Ctrl + Enter to send.", 3000);
    });
}

window.sendPrompt = sendPrompt;
async function sendPrompt() {
    console.log('sendPrompt called. pendingConfirmation:', pendingConfirmation, 'chatMode:', chatMode);

    // If pending confirmation, send confirm signal
    if (pendingConfirmation) {
        console.log('Sending confirm-send signal');
        window.electronAPI.confirmSend();
        pendingConfirmation = false;

        // Reset UI
        masterInput.value = '';
        attachedFiles = [];
        renderFilePreview();

        // Ensure inputs are enabled and reset placeholder
        setInputsEnabled(true);
        masterInput.placeholder = MAIN_INPUT_PLACEHOLDER;
        masterInput.focus();
        return;
    }

    const text = masterInput.value.trim();
    console.log('Sending prompt. Text length:', text.length, 'Files:', attachedFiles.length);

    if (!text && attachedFiles.length === 0) {
        console.log('No text and no files, ignoring.');
        return;
    }

    // Get file paths
    const filePaths = attachedFiles.map(f => f.path);

    // Handle based on Chat Mode
    if (chatMode === 'single') {
        // Single AI Mode: Send to active instances
        const instanceKeys = singleAiActiveInstances
            .map((active, i) => active ? `${singleAiService}-${i}` : null)
            .filter(Boolean);
        
        console.log('[SingleAI] Sending to instances:', instanceKeys);
        window.electronAPI.sendPromptToInstances(text, instanceKeys, filePaths);
    } else {
        // Multi AI Mode: Send to active services
        const activeServices = {
            chatgpt: toggles.chatgpt.checked,
            claude: toggles.claude.checked,
            gemini: toggles.gemini.checked,
            grok: toggles.grok.checked,
            perplexity: toggles.perplexity.checked,
            genspark: toggles.genspark.checked
        };
        
        window.electronAPI.sendPrompt(text, activeServices, filePaths);
    }

    // If files are present, disable inputs and wait for upload complete
    if (filePaths.length > 0) {
        console.log('Files present, waiting for upload confirmation...');
        masterInput.value = '';
        attachedFiles = [];
        renderFilePreview();
        setInputsEnabled(false);
        masterInput.placeholder = "Uploading files. Once the prompt box is active again, press Ctrl + Enter to send.";
    } else {
        console.log('No files, clearing input.');
        masterInput.value = '';
        attachedFiles = [];
        renderFilePreview();
        setInputsEnabled(true);
        masterInput.placeholder = MAIN_INPUT_PLACEHOLDER;
        masterInput.focus();
    }

    // Collapse expanded prompt area so user can see responses (CPB listens for this)
    window.dispatchEvent(new CustomEvent('smc:collapse-prompt-expanded'));
}

//===========================================
// File Upload Logic
//===========================================

// Clip Button Click
clipBtn.addEventListener('click', () => {
    fileInput.click();
});

// File Input Change
fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => addFile(file));
    fileInput.value = ''; // Reset input
});

// Drag & Drop
inputArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    inputArea.classList.add('drag-over');
});

inputArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    inputArea.classList.remove('drag-over');
});

inputArea.addEventListener('drop', (e) => {
    e.preventDefault();
    inputArea.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => addFile(file));
});

const MULTI_LINE_THRESHOLD = 200;
const TEXT_ATTACHMENT_CHARS_PER_LINE_EQUIVALENT = 120;
const MULTI_LINE_CHAR_THRESHOLD = MULTI_LINE_THRESHOLD * TEXT_ATTACHMENT_CHARS_PER_LINE_EQUIVALENT;

function getTextLineCount(text) {
    return (text || '').split('\n').length;
}

function getTextCharCount(text) {
    return Array.from(text || '').length;
}

function shouldConvertTextToAttachment(textContent, options = {}) {
    const lineThreshold = options.lineThreshold ?? MULTI_LINE_THRESHOLD;
    const charThreshold = options.charThreshold ?? (lineThreshold * TEXT_ATTACHMENT_CHARS_PER_LINE_EQUIVALENT);
    const lineCount = getTextLineCount(textContent);
    const charCount = getTextCharCount(textContent);

    const lineExceeded = lineCount >= lineThreshold;
    const charExceeded = charCount >= charThreshold;

    return {
        shouldConvert: Boolean(textContent) && (lineExceeded || charExceeded),
        lineCount,
        charCount,
        lineThreshold,
        charThreshold,
        reason: lineExceeded ? 'line-threshold' : (charExceeded ? 'char-threshold' : 'below-threshold')
    };
}

async function convertLongTextToAttachment(textContent, options = {}) {
    const {
        threshold = MULTI_LINE_THRESHOLD,
        charThreshold = MULTI_LINE_CHAR_THRESHOLD,
        filePrefix = 'paste',
        source = 'text',
        clearInputWhenConverted = false
    } = options;

    const evalResult = shouldConvertTextToAttachment(textContent, {
        lineThreshold: threshold,
        charThreshold
    });
    if (!evalResult.shouldConvert) {
        return { converted: false, ...evalResult };
    }

    const timestamp = Date.now();
    const fileName = `${filePrefix}-${timestamp}.txt`;
    const encoder = new TextEncoder();
    const buffer = encoder.encode(textContent);

    try {
        const filePath = await window.electronAPI.saveTempFile(Array.from(buffer), fileName);
        attachedFiles.push({ name: fileName, path: filePath });
        renderFilePreview();
        if (clearInputWhenConverted && masterInput) {
            masterInput.value = '';
        }
        console.log(`[Attachment Convert] ${source}: ${evalResult.lineCount} lines / ${evalResult.charCount} chars (${evalResult.reason}) -> ${fileName}`);
        return { converted: true, ...evalResult, fileName, filePath };
    } catch (err) {
        console.error(`[Attachment Convert] Failed for ${source}:`, err);
        return { converted: false, ...evalResult, error: err };
    }
}

window.convertLongTextToAttachment = convertLongTextToAttachment;
window.shouldConvertTextToAttachment = shouldConvertTextToAttachment;

// Paste Handler
document.addEventListener('paste', async (e) => {
    const activeElement = document.activeElement;
    const isTextareaFocused = activeElement === masterInput;

    const items = e.clipboardData.items;
    let hasImage = false;
    let textContent = '';

    // First pass: check for images
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            hasImage = true;
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob) {
                const timestamp = Date.now();
                const ext = blob.type.split('/')[1] || 'png';
                const fileName = `paste-${timestamp}.${ext}`;

                // Save to temp file
                const buffer = await blob.arrayBuffer();
                try {
                    const filePath = await window.electronAPI.saveTempFile(Array.from(new Uint8Array(buffer)), fileName);
                    attachedFiles.push({ name: fileName, path: filePath });
                    renderFilePreview();
                    console.log('Image pasted and added to attachments');
                } catch (err) {
                    console.error('Failed to save pasted image:', err);
                }
            }
            break; // Stop processing other items after finding an image
        }
    }

    // Second pass: handle text if no image was found
    if (!hasImage && isTextareaFocused) {
        // Get text from clipboard
        textContent = e.clipboardData.getData('text/plain');

        if (textContent) {
            const decision = shouldConvertTextToAttachment(textContent);
            if (decision.shouldConvert) {
                e.preventDefault(); // Prevent default paste
                const result = await convertLongTextToAttachment(textContent, {
                    source: 'clipboard-paste',
                    filePrefix: 'paste'
                });
                if (!result.converted) {
                    // Fallback: insert text into textarea anyway
                    masterInput.value += textContent;
                }
            }
        }
    }
});

function addFile(file) {
    // file is a File object, it has a 'path' property in Electron
    // BUT in recent Electron versions (web security), we must use webUtils to get the path
    const filePath = window.electronAPI.pathForFile(file);
    attachedFiles.push({ name: file.name, path: filePath });
    renderFilePreview();
}

function removeFile(index) {
    attachedFiles.splice(index, 1);
    renderFilePreview();
}

function renderFilePreview() {
    filePreviewArea.innerHTML = '';

    if (attachedFiles.length === 0) {
        filePreviewArea.style.display = 'none';
        if (clearFilesBtn) clearFilesBtn.style.display = 'none';
        return;
    }

    filePreviewArea.style.display = 'flex';
    if (clearFilesBtn) {
        clearFilesBtn.style.display = 'inline-flex';
    }

    attachedFiles.forEach((file, index) => {
        const chip = document.createElement('div');
        chip.className = 'file-chip';
        chip.innerHTML = `
            <span>${file.name}</span>
            <span class="remove-file" data-index="${index}">&times;</span>
        `;

        chip.querySelector('.remove-file').addEventListener('click', () => {
            removeFile(index);
        });

        filePreviewArea.appendChild(chip);
    });
}

//===========================================
// Layout & Resizing Logic
//===========================================

const viewsPlaceholder = document.getElementById('views-placeholder');
const layoutBtns = {
    '1x3': document.getElementById('layout-1x3'),
    '3x1': document.getElementById('layout-3x1'),
    '1x4': document.getElementById('layout-1x4'),
    '2x2': document.getElementById('layout-2x2')
};

let activeServiceKeys = []; // Track order of active services
let currentLayout = '1x4';

function updateLayoutState() {
    let activeCount;
    
    // 1. Determine active views based on Chat Mode
    if (chatMode === 'single') {
        // Single AI Mode: Count active instances
        activeCount = singleAiActiveInstances.filter(Boolean).length;
        activeServiceKeys = singleAiActiveInstances
            .map((active, i) => active ? `${singleAiService}-${i}` : null)
            .filter(Boolean);
    } else {
        // Multi AI Mode: enforce max 4 + keep deterministic order
        const activeServices = enforceMultiToggleLimit();
        activeCount = activeServices.length;
        activeServiceKeys = [...activeServices];

        // 2. Constraint: Max 4 services - disable UNCHECKED toggles only (Multi AI Mode only)
        if (activeCount >= 4) {
            for (const toggle of Object.values(toggles)) {
                toggle.disabled = !toggle.checked;
            }
        } else {
            for (const toggle of Object.values(toggles)) {
                toggle.disabled = false;
            }
        }
    }

    // 3. Layout Buttons Logic (LAYOUT-002-1) - applies to both modes
    if (activeCount < 3) {
        // < 3 views: Disable all layout buttons
        Object.values(layoutBtns).forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
        });
    } else if (activeCount === 3) {
        // 3 views: Enable 1x3 and 3x1, disable others
        layoutBtns['1x3'].disabled = false;
        layoutBtns['1x3'].classList.remove('disabled');
        layoutBtns['3x1'].disabled = false;
        layoutBtns['3x1'].classList.remove('disabled');
        layoutBtns['1x4'].disabled = true;
        layoutBtns['1x4'].classList.add('disabled');
        layoutBtns['2x2'].disabled = true;
        layoutBtns['2x2'].classList.add('disabled');
        if (currentLayout === '1x4' || currentLayout === '2x2') {
            setLayout('1x3');
        }
    } else {
        // >= 4 views: Enable 1x4 and 2x2, disable 1x3 and 3x1
        layoutBtns['1x3'].disabled = true;
        layoutBtns['1x3'].classList.add('disabled');
        layoutBtns['3x1'].disabled = true;
        layoutBtns['3x1'].classList.add('disabled');
        layoutBtns['1x4'].disabled = false;
        layoutBtns['1x4'].classList.remove('disabled');
        layoutBtns['2x2'].disabled = false;
        layoutBtns['2x2'].classList.remove('disabled');
        if (currentLayout === '1x3' || currentLayout === '3x1') {
            setLayout('1x4');
        }
    }

    // 4. Render the Layout
    renderLayout();

    // 5. Request current URLs from main process to update URL bars (fix Loading... display)
    if (window.electronAPI.requestCurrentUrls) {
        setTimeout(() => window.electronAPI.requestCurrentUrls(), 100);
    }

    // Keep control lock stable if some other action triggered layout refresh while maximized.
    setBottomControlsDisabled(isAnyViewMaximized());
}

function setLayout(layout) {
    currentLayout = layout;
    Object.values(layoutBtns).forEach(btn => btn.classList.remove('active'));
    layoutBtns[layout].classList.add('active');

    // Notify Main (just for state, bounds are sent separately)
    window.electronAPI.setLayout(layout);

    // Re-render
    renderLayout();

    // Request current URLs from main process to update URL bars after layout change
    if (window.electronAPI.requestCurrentUrls) {
        setTimeout(() => window.electronAPI.requestCurrentUrls(), 100);
    }
}

function renderLayout() {
    viewsPlaceholder.innerHTML = ''; // Clear existing
    viewsPlaceholder.style = ''; // Reset styles

    if (activeServiceKeys.length === 0) {
        updateBounds(); // Send empty bounds
        return;
    }

    if (currentLayout === '2x2' && activeServiceKeys.length >= 4) {
        // 2x2 Layout
        viewsPlaceholder.style.flexDirection = 'column';

        // Row 1
        const row1 = document.createElement('div');
        row1.className = 'row-container';
        // Initial Flex
        row1.style.flex = '1';

        createSlot(row1, activeServiceKeys[0]);
        createSplitter(row1, 'horizontal'); // Vertical bar moving horizontally
        createSlot(row1, activeServiceKeys[1]);

        viewsPlaceholder.appendChild(row1);

        // Horizontal Splitter (Between Rows)
        const hSplitter = document.createElement('div');
        hSplitter.className = 'splitter splitter-horizontal';
        hSplitter.addEventListener('mousedown', (e) => initResize(e, row1, hSplitter, 'vertical'));
        viewsPlaceholder.appendChild(hSplitter);

        // Row 2
        const row2 = document.createElement('div');
        row2.className = 'row-container';
        row2.style.flex = '1';

        createSlot(row2, activeServiceKeys[2]);
        createSplitter(row2, 'horizontal'); // Vertical bar moving horizontally
        createSlot(row2, activeServiceKeys[3]);

        viewsPlaceholder.appendChild(row2);

    } else if (currentLayout === '3x1') {
        // 3x1 Layout (Vertical Stack - 3 rows stacked on top of each other)
        viewsPlaceholder.style.flexDirection = 'column';

        activeServiceKeys.forEach((service, index) => {
            createSlot(viewsPlaceholder, service);
            if (index < activeServiceKeys.length - 1) {
                // Add horizontal splitter between rows
                const splitter = document.createElement('div');
                splitter.className = 'splitter splitter-horizontal';
                const prevSlot = viewsPlaceholder.lastElementChild.previousElementSibling || viewsPlaceholder.lastElementChild;
                splitter.addEventListener('mousedown', (e) => {
                    const prev = splitter.previousElementSibling;
                    initResize(e, prev, splitter, 'vertical');
                });
                viewsPlaceholder.appendChild(splitter);
            }
        });

    } else {
        // 1xN Layout (Horizontal Split - side by side)
        viewsPlaceholder.style.flexDirection = 'row';

        activeServiceKeys.forEach((service, index) => {
            createSlot(viewsPlaceholder, service);
            if (index < activeServiceKeys.length - 1) {
                createSplitter(viewsPlaceholder, 'horizontal');
            }
        });
    }

    // Wait for DOM to settle then send bounds
    requestAnimationFrame(() => {
        updateBounds();
    });
}

function createSlot(container, slotKey) {
    const slot = document.createElement('div');
    slot.className = 'view-slot';
    slot.id = `slot-${slotKey}`;
    slot.style.flex = '1';

    // Create header bar above BrowserView
    const header = document.createElement('div');
    header.className = 'view-header';

    // Determine if this is a Single AI Mode instance or Multi AI service
    let serviceName, displayName, icon, serviceKey;
    const instanceMatch = slotKey.match(/^(.+)-(\d)$/);
    
    if (chatMode === 'single' && instanceMatch) {
        // Single AI Mode: e.g., "chatgpt-0" -> ChatGPT #1 or (A)
        serviceKey = instanceMatch[1];
        const instanceIndex = parseInt(instanceMatch[2]);
        serviceName = SERVICE_NAMES[serviceKey] || serviceKey;
        displayName = isAnonymousMode 
            ? `${serviceName} ${INSTANCE_ALIASES[instanceIndex]}` 
            : `${serviceName} #${instanceIndex + 1}`;
        icon = SERVICE_ICONS[serviceKey] || '';
    } else {
        // Multi AI Mode: e.g., "chatgpt" -> ChatGPT
        serviceKey = slotKey;
        serviceName = SERVICE_NAMES[slotKey] || slotKey;
        displayName = serviceName;
        icon = SERVICE_ICONS[slotKey] || '';
    }
    
    const name = displayName;

    const serviceNameEl = document.createElement('span');
    serviceNameEl.className = 'service-name';

    // For Single AI Mode, we already included the instance alias in displayName
    let headerContent = `<span class="service-icon-wrapper header-icon">${icon}</span> ${name}`;
    // Only add SERVICE_ALIASES for Multi AI Mode anonymous
    if (chatMode === 'multi' && isAnonymousMode && SERVICE_ALIASES[serviceKey]) {
        headerContent += ` <span class="service-alias">${SERVICE_ALIASES[serviceKey]}</span>`;
    }
    serviceNameEl.innerHTML = headerContent;

    // Header only contains service name (buttons moved to URL bar)
    header.appendChild(serviceNameEl);

    // Header Buttons Container (Restored for Maximize button)
    const headerBtns = document.createElement('div');
    headerBtns.className = 'header-buttons';

    // Gemini idle refresh timer (left of reload) — only for Gemini slots
    if (isGeminiSlot(slotKey)) {
        ensureGeminiTimerState(slotKey);
        const timerEl = document.createElement('span');
        timerEl.id = `gemini-idle-timer-${slotKey}`;
        timerEl.className = 'gemini-idle-timer';
        timerEl.textContent = formatGeminiIdleTimerLabel(GEMINI_IDLE_TIMER_SECONDS, false);
        timerEl.title = 'Auto-refresh after this time when idle';
        headerBtns.appendChild(timerEl);
        startGeminiIdleTimerTick();
    }

    // Clear cookies & site data for this service partition (clean slate before Sign in with Chrome/Edge)
    const clearSiteBtn = document.createElement('button');
    clearSiteBtn.className = 'header-btn header-btn-clear-site';
    clearSiteBtn.innerHTML = '<svg class="header-trash-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    clearSiteBtn.title = 'Clear cookies & site data for this service (then sign in again via Chrome or Edge)';
    clearSiteBtn.addEventListener('click', async () => {
        const confirmed = await showSmcConfirm({
            title: 'Clear site data',
            message: `Clear all cookies and site data for ${serviceName}?\nYou will need to sign in again (e.g. Sign in with Chrome or Edge).`,
            confirmText: 'Clear',
            cancelText: 'Cancel',
            danger: true
        });
        if (!confirmed) return;
        try {
            const r = await window.electronAPI.clearServicePartitionStorage(serviceKey);
            if (!r || !r.ok) {
                console.warn('[clear-service-partition-storage]', r);
            }
        } catch (e) {
            console.warn('clearServicePartitionStorage failed', e);
        }
        if (isGeminiSlot(slotKey)) resetGeminiIdleTimerForSlot(slotKey);
    });

    // Reload button - moved from URL bar to header (left of maximize button)
    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'header-btn';
    const reloadSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    reloadBtn.innerHTML = reloadSvg;
    reloadBtn.title = 'Reload';
    reloadBtn.addEventListener('click', () => {
        reloadBtn.classList.add('spinning');
        setTimeout(() => reloadBtn.classList.remove('spinning'), 500);
        // Use appropriate API based on chat mode
        if (chatMode === 'single') {
            window.electronAPI.reloadInstance(slotKey);
        } else {
            window.electronAPI.reloadService(slotKey);
        }
        if (isGeminiSlot(slotKey)) resetGeminiIdleTimerForSlot(slotKey);
    });

    // Maximize/Restore Button
    const maxBtn = document.createElement('button');
    maxBtn.className = 'header-btn';
    maxBtn.title = 'Maximize';
    // Maximize Icon (Expand)
    const maxIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
    // Restore Icon (Compress)
    const restoreIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';

    maxBtn.innerHTML = maxIcon;

    maxBtn.addEventListener('click', () => {
        toggleMaximize(slotKey, maxBtn, maxIcon, restoreIcon);
    });

    headerBtns.appendChild(clearSiteBtn);
    headerBtns.appendChild(reloadBtn);
    headerBtns.appendChild(maxBtn);
    header.appendChild(headerBtns);

    slot.appendChild(header);

    // Create URL bar below header (URLBAR-001)
    const urlBar = document.createElement('div');
    urlBar.className = 'url-bar';
    urlBar.id = `url-bar-${slotKey}`;

    // URL text display (URLBAR-002)
    const urlText = document.createElement('span');
    urlText.className = 'url-text';
    urlText.id = `url-text-${slotKey}`;
    urlText.textContent = 'Loading...';

    // URL bar buttons container
    const urlBtnsContainer = document.createElement('div');
    urlBtnsContainer.className = 'url-bar-buttons';

    // New Chat button - replaced reload button position
    const newChatBtn = document.createElement('button');
    newChatBtn.className = 'url-bar-btn';
    const newChatSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
    newChatBtn.innerHTML = newChatSvg;
    newChatBtn.title = 'New Chat';
    newChatBtn.addEventListener('click', async () => {
        // URL bar New Chat resets only this slot and must not create a new history entry.
        await resetCurrentSessionViews({ onlySlotKey: slotKey });
    });

    // Copy URL button - overlapping squares icon
    const copyUrlBtn = document.createElement('button');
    copyUrlBtn.className = 'url-bar-btn';
    copyUrlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    copyUrlBtn.title = 'Copy URL';
    copyUrlBtn.addEventListener('click', () => {
        const currentUrl = urlText.dataset.url || urlText.textContent;
        if (currentUrl && currentUrl !== 'Loading...') {
            navigator.clipboard.writeText(currentUrl).then(() => {
                copyUrlBtn.innerHTML = '<span style="color:#22c55e;">✓</span>';
                setTimeout(() => { copyUrlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'; }, 1500);
            }).catch(err => {
                console.error('Failed to copy URL:', err);
            });
        }
    });

    // Copy Chat Thread button (moved from header) - clipboard icon
    const copyChatBtn = document.createElement('button');
    copyChatBtn.className = 'url-bar-btn';
    copyChatBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>';
    copyChatBtn.title = 'Copy Chat Thread';
    copyChatBtn.addEventListener('click', function () {
        const button = this;
        const format = copyFormatSelect ? copyFormatSelect.value : 'markdown';
        // Multi: serviceKey (chatgpt/claude/...), Single: slotKey (chatgpt-0/...)
        const targetKey = (chatMode === 'single') ? slotKey : serviceKey;
        window.electronAPI.copySingleChatThread(targetKey, { format, anonymousMode: isAnonymousMode });
        button.innerHTML = '<span style="color:#22c55e;font-weight:bold;">✓</span>';
        setTimeout(function () {
            button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>';
        }, 2000);
    });

    // Open in external browser button - external link icon
    const chromeBtn = document.createElement('button');
    chromeBtn.className = 'url-bar-btn';
    chromeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
    chromeBtn.title = 'Open in external browser';
    chromeBtn.addEventListener('click', () => {
        const currentUrl = urlText.dataset.url || urlText.textContent;
        if (currentUrl && currentUrl !== 'Loading...') {
            window.electronAPI.openUrlInChrome(currentUrl);
        }
    });

    // Order: New Chat, Copy URL, Copy Chat, Open in browser
    urlBtnsContainer.appendChild(newChatBtn);
    urlBtnsContainer.appendChild(copyUrlBtn);
    urlBtnsContainer.appendChild(copyChatBtn);
    urlBtnsContainer.appendChild(chromeBtn);

    urlBar.appendChild(urlText);
    urlBar.appendChild(urlBtnsContainer);
    slot.appendChild(urlBar);

    container.appendChild(slot);
    return slot;
}

function createSplitter(container, type) {
    const splitter = document.createElement('div');
    if (type === 'horizontal') {
        // Vertical bar, moves horizontally (resizes width)
        splitter.className = 'splitter splitter-vertical';
        splitter.addEventListener('mousedown', (e) => {
            const prev = splitter.previousElementSibling;
            initResize(e, prev, splitter, 'horizontal');
        });
    } else {
        // Horizontal bar, moves vertically (resizes height)
        // This case is handled manually in renderLayout for the middle splitter
    }
    container.appendChild(splitter);
}

// Resizing Logic
function initResize(e, prevElement, splitter, direction) {
    e.preventDefault();
    splitter.classList.add('dragging');

    const nextElement = splitter.nextElementSibling;
    if (!nextElement) return;

    const startX = e.clientX;
    const startY = e.clientY;

    const prevRect = prevElement.getBoundingClientRect();
    const nextRect = nextElement.getBoundingClientRect();

    const startPrevSize = direction === 'horizontal' ? prevRect.width : prevRect.height;
    const startNextSize = direction === 'horizontal' ? nextRect.width : nextRect.height;
    const totalSize = startPrevSize + startNextSize;

    // Freeze flex during drag
    const container = splitter.parentElement;
    // If horizontal resize (vertical splitter), we are in a row (viewsPlaceholder or row-container)
    // If vertical resize (horizontal splitter), we are in viewsPlaceholder (column)

    // Freeze all children of the container to pixels
    Array.from(container.children).forEach(child => {
        if (child.classList.contains('splitter')) return;
        const rect = child.getBoundingClientRect();
        if (direction === 'horizontal') {
            child.style.flex = 'none';
            child.style.width = `${rect.width}px`;
        } else {
            child.style.flex = 'none';
            child.style.height = `${rect.height}px`;
        }
    });

    function onMouseMove(e) {
        e.preventDefault();

        if (direction === 'horizontal') {
            const deltaX = e.clientX - startX;
            let newPrevWidth = startPrevSize + deltaX;
            let newNextWidth = startNextSize - deltaX;

            // Constraints
            if (newPrevWidth < 100) {
                newPrevWidth = 100;
                newNextWidth = totalSize - 100;
            }
            if (newNextWidth < 100) {
                newNextWidth = 100;
                newPrevWidth = totalSize - 100;
            }

            prevElement.style.width = `${newPrevWidth}px`;
            nextElement.style.width = `${newNextWidth}px`;
        } else {
            const deltaY = e.clientY - startY;
            let newPrevHeight = startPrevSize + deltaY;
            let newNextHeight = startNextSize - deltaY;

            if (newPrevHeight < 100) {
                newPrevHeight = 100;
                newNextHeight = totalSize - 100;
            }
            if (newNextHeight < 100) {
                newNextHeight = 100;
                newPrevHeight = totalSize - 100;
            }

            prevElement.style.height = `${newPrevHeight}px`;
            nextElement.style.height = `${newNextHeight}px`;
        }

        // Update bounds in real-time during drag for smooth sync with BrowserView content
        updateBounds();
    }

    function onMouseUp() {
        splitter.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // Update bounds only after drag finishes to prevent visual glitching
        updateBounds();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

/** When set, full-screen sidebar panels are open; BrowserViews must stay at zero bounds (they sit above HTML in Electron). */
let smcOpenFullPanel = null;

function setMainWorkspaceWebviewsObscured(obscured) {
    if (!window.electronAPI?.updateViewBounds) return;
    if (obscured) {
        const bounds = {};
        activeServiceKeys.forEach((key) => {
            bounds[key] = { x: 0, y: 0, width: 0, height: 0 };
        });
        window.electronAPI.updateViewBounds(bounds);
    } else {
        requestAnimationFrame(() => updateBounds());
    }
}

function syncSmcOverlayStackState() {
    const stack = document.getElementById('smc-panel-overlay-stack');
    if (!stack) return;
    const open = !!smcOpenFullPanel;
    stack.classList.toggle('has-open-panel', open);
    stack.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.classList.toggle('smc-full-panel-open', open);
}

function openSmcFullPanel(panel) {
    const map = {
        dashboard: 'smc-overlay-dashboard',
        'prompt-hub': 'smc-overlay-prompt-hub',
        history: 'smc-overlay-history',
    };
    const id = map[panel];
    if (!id) return;
    document.querySelectorAll('.smc-full-panel').forEach((el) => {
        const on = el.id === id;
        el.classList.toggle('is-open', on);
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    smcOpenFullPanel = panel;
    syncSmcOverlayStackState();
    setMainWorkspaceWebviewsObscured(true);
    const sb = document.getElementById('history-sidebar');
    if (sb) sb.setAttribute('data-active-panel', panel);
    document.querySelectorAll('.sidebar-rail-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-sidebar-panel') === panel);
    });
    if (panel === 'prompt-hub' && typeof window.renderPromptHub === 'function') window.renderPromptHub();
    if (panel === 'dashboard') refreshDashboard();
}

function closeSmcFullPanels() {
    if (!smcOpenFullPanel) return;
    smcOpenFullPanel = null;
    document.querySelectorAll('.smc-full-panel').forEach((el) => {
        el.classList.remove('is-open');
        el.setAttribute('aria-hidden', 'true');
    });
    syncSmcOverlayStackState();
    setMainWorkspaceWebviewsObscured(false);
    /* Modals may have called setServiceVisibility(false); restore only if CPB is not covering the workspace */
    applySmcPreferredServiceVisibility();
    const confirmM = document.getElementById('smc-confirm-modal');
    if (confirmM) confirmM.classList.remove('visible');
    const catM = document.getElementById('smc-category-modal');
    if (catM) catM.classList.remove('visible');
    const sb = document.getElementById('history-sidebar');
    if (sb) sb.setAttribute('data-active-panel', 'none');
    document.querySelectorAll('.sidebar-rail-btn').forEach((b) => b.classList.remove('active'));
}

window.closeSmcFullPanels = closeSmcFullPanels;

function updateBounds() {
    if (smcOpenFullPanel && window.electronAPI?.updateViewBounds) {
        const z = {};
        activeServiceKeys.forEach((key) => {
            z[key] = { x: 0, y: 0, width: 0, height: 0 };
        });
        window.electronAPI.updateViewBounds(z);
        return;
    }
    const HEADER_HEIGHT = 32; // Height for header bar with buttons
    const URL_BAR_HEIGHT = 32; // Height for URL bar (URLBAR-001) - same as header
    const TOTAL_TOP_HEIGHT = HEADER_HEIGHT + URL_BAR_HEIGHT;
    const bounds = {};
    
    activeServiceKeys.forEach(key => {
        const slot = document.getElementById(`slot-${key}`);
        if (slot) {
            const rect = slot.getBoundingClientRect();
            // BrowserView starts below header bar and URL bar
            bounds[key] = {
                x: Math.round(rect.x),
                y: Math.round(rect.y) + TOTAL_TOP_HEIGHT,
                width: Math.round(rect.width),
                height: Math.round(rect.height) - TOTAL_TOP_HEIGHT
            };
        }
    });

    // Send bounds to appropriate IPC based on chat mode
    if (chatMode === 'single') {
        // Single AI Mode uses update-single-view-bounds
        if (window.electronAPI.updateViewBounds) {
            // For now, use the same IPC but main process will handle it
            // We'll add a separate handler in the future if needed
            window.electronAPI.updateViewBounds(bounds);
        }
    } else {
        window.electronAPI.updateViewBounds(bounds);
    }
}

// Window Resize Observer
const resizeObserver = new ResizeObserver(() => {
    // Debounce or throttle could be added here
    requestAnimationFrame(updateBounds);
});
resizeObserver.observe(viewsPlaceholder);

// Initialize Layout Buttons
Object.keys(layoutBtns).forEach(layout => {
    layoutBtns[layout].addEventListener('click', () => {
        if (isAnyViewMaximized()) return;
        setLayout(layout);
    });
});

for (const [service, toggle] of Object.entries(toggles)) {
    toggle.addEventListener('change', (e) => {
        if (isAnyViewMaximized()) {
            e.target.checked = activeServiceKeys.includes(service);
            return;
        }
        // Enforce max 4 services in Multi mode (spec)
        if (chatMode === 'multi' && e.target.checked && !isApplyingMultiToggleClamp) {
            const checkedNow = getCheckedMultiServicesInOrder();
            if (checkedNow.length > MAX_MULTI_ACTIVE) {
                // Revert this toggle
                e.target.checked = false;
                window.electronAPI.toggleService(service, false);
                updateLayoutState();
                return;
            }
        }

        window.electronAPI.toggleService(service, e.target.checked);
        if (chatMode === 'multi' && !isRestoringMultiToggles) {
            snapshotCurrentMultiSelection();
        }
        updateLayoutState();
    });
}

// URL Bar: Listen for URL changes from main process (URLBAR-003)
// Also save session on URL changes for history persistence
let urlChangeDebounceTimer = null;
let isSessionLoading = false; // Flag to prevent URL saves during session loading

if (window.electronAPI.onGeminiIdleTimer) {
    window.electronAPI.onGeminiIdleTimer(({ slotKey, action }) => {
        if (!slotKey || !isGeminiSlot(slotKey)) return;
        ensureGeminiTimerState(slotKey);
        const state = geminiIdleTimerState[slotKey];
        if (action === 'reset') {
            state.remainingSeconds = GEMINI_IDLE_TIMER_SECONDS;
            state.isPaused = false;
        } else if (action === 'pause') {
            state.isPaused = true;
        }
        updateGeminiIdleTimerDisplay(slotKey);
    });
}

// Pause Gemini idle refresh while user is actively typing in master input (3s debounce)
const TYPING_PAUSE_DEBOUNCE_MS = 3000;
let _typingPauseDebounceId = null;
let _typingPauseActive = false;

if (masterInput && window.electronAPI.setGeminiTypingPause) {
    masterInput.addEventListener('input', () => {
        if (!_typingPauseActive) {
            _typingPauseActive = true;
            setAllGeminiTimersTypingPause(true);
            window.electronAPI.setGeminiTypingPause(true);
        }
        if (_typingPauseDebounceId != null) clearTimeout(_typingPauseDebounceId);
        _typingPauseDebounceId = setTimeout(() => {
            _typingPauseActive = false;
            _typingPauseDebounceId = null;
            setAllGeminiTimersTypingPause(false);
            window.electronAPI.setGeminiTypingPause(false);
        }, TYPING_PAUSE_DEBOUNCE_MS);
    });
}

// Preserve caret/selection state across Gemini idle refresh reload
let _savedMasterInputState = null;

if (window.electronAPI.onGeminiIdleRefreshStarting && masterInput) {
    window.electronAPI.onGeminiIdleRefreshStarting(() => {
        if (document.activeElement === masterInput) {
            _savedMasterInputState = {
                selectionStart: masterInput.selectionStart,
                selectionEnd: masterInput.selectionEnd,
                scrollTop: masterInput.scrollTop,
            };
        } else {
            _savedMasterInputState = null;
        }
    });
}

if (window.electronAPI.onGeminiIdleRefreshDone && masterInput) {
    window.electronAPI.onGeminiIdleRefreshDone(() => {
        setTimeout(() => {
            if (!masterInput || masterInput.disabled) return;
            masterInput.focus();
            if (_savedMasterInputState) {
                try {
                    masterInput.setSelectionRange(
                        _savedMasterInputState.selectionStart,
                        _savedMasterInputState.selectionEnd
                    );
                    masterInput.scrollTop = _savedMasterInputState.scrollTop;
                } catch (_) { /* ignore */ }
                _savedMasterInputState = null;
            }
        }, 50);
    });
}

if (window.electronAPI.onWebviewUrlChanged) {
    window.electronAPI.onWebviewUrlChanged(({ service, url }) => {
        const urlTextEl = document.getElementById(`url-text-${service}`);
        if (urlTextEl && url) {
            // Truncate URL for display if necessary
            const displayUrl = url.length > 80 ? url.substring(0, 77) + '...' : url;
            urlTextEl.textContent = displayUrl;
            urlTextEl.dataset.url = url; // Store full URL for copy/chrome buttons
            urlTextEl.title = url; // Show full URL on hover

            // Skip saving during session loading to prevent race conditions
            if (isSessionLoading) {
                console.log('[History] Skipping URL save during session loading');
                return;
            }

            // Debounced save on URL change (only if session exists)
            if (typeof currentSessionId !== 'undefined' && currentSessionId) {
                if (urlChangeDebounceTimer) {
                    clearTimeout(urlChangeDebounceTimer);
                }
                urlChangeDebounceTimer = setTimeout(() => {
                    console.log('[History] URL changed, saving session');
                    saveCurrentSession();
                }, 1000);
            }
        }
    });
}

//===========================================
// Cross Check Modal Logic
//===========================================

const crossCheckModal = document.getElementById('cross-check-modal');
const crossCheckModalTitle = document.getElementById('cross-check-modal-title');
const closeCrossCheckBtn = document.getElementById('close-cross-check-btn');
const CROSS_CHECK_TITLE_OPTIONS = 'Cross Check Options';
const CROSS_CHECK_TITLE_EDIT_PREDEFINED = 'Edit Predefined Prompt';
const crossCheckOptions = document.getElementById('cross-check-options');
const customPromptView = document.getElementById('custom-prompt-view');
const btnCompareResponses = document.getElementById('btn-compare-responses');
const btnCustomPrompt = document.getElementById('btn-custom-prompt');
const backToOptionsBtn = document.getElementById('back-to-options-btn');
const customPromptInput = document.getElementById('custom-prompt-input');
const customPromptTitle = document.getElementById('custom-prompt-title');
const savePromptCheckbox = document.getElementById('save-prompt-checkbox');
const btnSendCustom = document.getElementById('btn-send-custom');
const btnAddCustom = document.getElementById('btn-add-custom');
if (btnAddCustom) btnAddCustom.disabled = true;
if (btnSendCustom) btnSendCustom.disabled = true;

const savedPromptsBody = document.getElementById('saved-prompts-body');
const savedPromptsEmpty = document.getElementById('saved-prompts-empty');
const savedPromptsTable = document.getElementById('saved-prompts-table');
// Predefined Prompt Edit Elements
const predefinedPromptEditView = document.getElementById('predefined-prompt-edit-view');
const btnEditPredefined = document.getElementById('edit-predefined-btn');
const predefinedPromptInput = document.getElementById('predefined-prompt-input');
const btnCancelPredefined = document.getElementById('btn-cancel-predefined');
const btnSavePredefined = document.getElementById('btn-save-predefined');
const crossCheckPredefinedPreviewLayer = document.getElementById('cross-check-predefined-preview-layer');
const crossCheckPredefinedPreviewText = document.getElementById('cross-check-predefined-preview-text');
const btnPredefinedPromptPreview = document.getElementById('predefined-prompt-preview-btn');
const crossCheckPredefinedPreviewClose = document.getElementById('cross-check-predefined-preview-close');
const crossCheckPredefinedPreviewBackdrop = document.getElementById('cross-check-predefined-preview-backdrop');
let customPrompts = [];
let currentSort = {
    column: 'lastUsedAt',
    direction: 'desc' // 'asc' or 'desc'
};
// Default Predefined Prompt
const DEFAULT_PREDEFINED_PROMPT = "Below are responses from different AI models. Please compare and analyze them for accuracy, completeness, and logic. Identify any discrepancies and suggest the best answer.";
let currentPredefinedPrompt = DEFAULT_PREDEFINED_PROMPT;

async function loadCustomPrompts() {
    const storedLocal = localStorage.getItem('customPrompts');
    let storedStore = null;

    try {
        if (window.electronAPI?.getCustomPrompts) {
            storedStore = await window.electronAPI.getCustomPrompts();
        }
    } catch (e) {
        console.error('Failed to load custom prompts from store', e);
    }

    let loaded = [];
    if (Array.isArray(storedStore) && storedStore.length > 0) {
        loaded = storedStore;
    } else if (storedLocal) {
        try {
            loaded = JSON.parse(storedLocal);
        } catch (e) {
            console.error('Failed to parse custom prompts from localStorage', e);
        }
    }

    // Migration: Ensure fields exist
    customPrompts = (loaded || []).map(p => ({
        ...p,
        createdAt: p.createdAt || new Date().toISOString(),
        lastUsedAt: p.lastUsedAt || new Date().toISOString()
    }));

    // Persist back to store/local if we had only local data
    if ((!Array.isArray(storedStore) || storedStore.length === 0) && customPrompts.length > 0) {
        try {
            await window.electronAPI?.saveCustomPrompts?.(customPrompts);
        } catch (e) {
            console.error('Failed to persist custom prompts to store', e);
        }
    }

    localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
    renderSavedPrompts();
}

function loadPredefinedPrompt() {
    (async () => {
        const storedLocal = localStorage.getItem('predefinedPrompt');
        let storedStore = null;
        try {
            storedStore = await window.electronAPI?.getPredefinedPrompt?.();
        } catch (e) {
            console.error('Failed to load predefined prompt from store', e);
        }

        if (typeof storedStore === 'string' && storedStore.length > 0) {
            currentPredefinedPrompt = storedStore;
        } else if (storedLocal) {
            currentPredefinedPrompt = storedLocal;
            // Persist migration into store if store was empty
            if (!storedStore) {
                try {
                    await window.electronAPI?.savePredefinedPrompt?.(storedLocal);
                } catch (e) {
                    console.error('Failed to persist predefined prompt to store', e);
                }
            }
        } else {
            currentPredefinedPrompt = DEFAULT_PREDEFINED_PROMPT;
        }

        localStorage.setItem('predefinedPrompt', currentPredefinedPrompt);
        updatePredefinedPromptPreview();
    })();
}

function savePredefinedPrompt(content) {
    currentPredefinedPrompt = content;
    localStorage.setItem('predefinedPrompt', content);
    try {
        window.electronAPI?.savePredefinedPrompt?.(content);
    } catch (e) {
        console.error('Failed to save predefined prompt to store', e);
    }
    updatePredefinedPromptPreview();
}

function formatCrossCheckPredefinedPromptForDisplay(text) {
    return String(text || '')
        .replace(/\.\s+/g, '.\n')
        .replace(/\?\s+/g, '?\n')
        .replace(/!\s+/g, '!\n');
}

function openCrossCheckPredefinedPreviewModal() {
    if (!crossCheckPredefinedPreviewLayer || !crossCheckPredefinedPreviewText) return;
    crossCheckPredefinedPreviewText.textContent = formatCrossCheckPredefinedPromptForDisplay(currentPredefinedPrompt);
    crossCheckPredefinedPreviewLayer.classList.add('is-open');
    crossCheckPredefinedPreviewLayer.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onCrossCheckPredefinedPreviewKeydown, true);
}

function closeCrossCheckPredefinedPreviewModal() {
    if (!crossCheckPredefinedPreviewLayer) return;
    crossCheckPredefinedPreviewLayer.classList.remove('is-open');
    crossCheckPredefinedPreviewLayer.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onCrossCheckPredefinedPreviewKeydown, true);
    /* Clear focus on Compare card eye icon so :focus-visible ring does not persist after Esc/close */
    if (btnPredefinedPromptPreview) {
        try {
            btnPredefinedPromptPreview.blur();
        } catch (_) { /* ignore */ }
    }
}

function onCrossCheckPredefinedPreviewKeydown(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeCrossCheckPredefinedPreviewModal();
    }
}

function updatePredefinedPromptPreview() {
    /* Hover tooltip removed; modal fills from currentPredefinedPrompt on open. */
}

function setCrossCheckModalMainTitle(text) {
    if (crossCheckModalTitle) crossCheckModalTitle.textContent = text;
}

function resetCrossCheckModalMainTitle() {
    setCrossCheckModalMainTitle(CROSS_CHECK_TITLE_OPTIONS);
}

function onCrossCheckPredefinedEditEscapeKeydown(e) {
    if (e.key !== 'Escape') return;
    if (!crossCheckModal?.classList.contains('visible')) return;
    if (!predefinedPromptEditView || predefinedPromptEditView.classList.contains('hidden')) return;
    if (crossCheckPredefinedPreviewLayer?.classList.contains('is-open')) return;
    e.preventDefault();
    e.stopPropagation();
    showOptionsView();
}

let crossCheckPredefinedEditEscapeBound = false;
function bindCrossCheckPredefinedEditEscape() {
    if (crossCheckPredefinedEditEscapeBound) return;
    document.addEventListener('keydown', onCrossCheckPredefinedEditEscapeKeydown, true);
    crossCheckPredefinedEditEscapeBound = true;
}

function unbindCrossCheckPredefinedEditEscape() {
    if (!crossCheckPredefinedEditEscapeBound) return;
    document.removeEventListener('keydown', onCrossCheckPredefinedEditEscapeKeydown, true);
    crossCheckPredefinedEditEscapeBound = false;
}

function saveCustomPromptsToStorage() {
    localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
    // Fire-and-forget persistence to electron-store
    try {
        window.electronAPI?.saveCustomPrompts?.(customPrompts);
    } catch (e) {
        console.error('Failed to save custom prompts to store', e);
    }
}

function openCrossCheckModal() {
    crossCheckModal.classList.add('visible');
    showOptionsView();
    loadCustomPrompts();
    loadPredefinedPrompt();
    // Hide services to show modal
    window.electronAPI.setServiceVisibility(false);
}

function closeCrossCheckModal() {
    unbindCrossCheckPredefinedEditEscape();
    resetCrossCheckModalMainTitle();
    crossCheckModal.classList.remove('visible');
    closeCrossCheckPredefinedPreviewModal();
    applySmcPreferredServiceVisibility();
}

function showOptionsView() {
    unbindCrossCheckPredefinedEditEscape();
    resetCrossCheckModalMainTitle();
    crossCheckOptions.classList.remove('hidden');
    customPromptView.classList.add('hidden');
    if (predefinedPromptEditView) predefinedPromptEditView.classList.add('hidden');

    // Reset inputs
    resetCustomPromptForm();
}

function showCustomPromptView() {
    unbindCrossCheckPredefinedEditEscape();
    resetCrossCheckModalMainTitle();
    crossCheckOptions.classList.add('hidden');
    customPromptView.classList.remove('hidden');
    renderSavedPrompts();
    customPromptInput.focus();
    updateSendButtonState();
}

function showPredefinedEditView() {
    crossCheckOptions.classList.add('hidden');
    setCrossCheckModalMainTitle(CROSS_CHECK_TITLE_EDIT_PREDEFINED);
    bindCrossCheckPredefinedEditEscape();
    if (predefinedPromptEditView) {
        predefinedPromptEditView.classList.remove('hidden');
        predefinedPromptInput.value = currentPredefinedPrompt;
        btnSavePredefined.disabled = true; // Disable initially
        predefinedPromptInput.focus();
    }
}

function ensureCustomPromptInputsEnabled() {
    [customPromptInput, customPromptTitle].forEach(field => {
        if (field) {
            field.disabled = false;
            field.removeAttribute('disabled');
        }
    });
}

function isCustomPromptFormValid() {
    const title = customPromptTitle.value.trim();
    const content = customPromptInput.value.trim();
    return title.length > 0 && content.length > 0;
}

function updateSendButtonState() {
    ensureCustomPromptInputsEnabled();
    const isValid = isCustomPromptFormValid();

    btnSendCustom.disabled = !isValid;
    btnAddCustom.disabled = !isValid; // Add Custom Prompt button validation
}

function forceEnableCustomPromptInputs() {
    ensureCustomPromptInputsEnabled();
    requestAnimationFrame(ensureCustomPromptInputsEnabled);
    setTimeout(ensureCustomPromptInputsEnabled, 0);
}

const customPromptFieldObserver = new MutationObserver(() => {
    forceEnableCustomPromptInputs();
});

[customPromptTitle, customPromptInput].forEach(field => {
    if (field) {
        customPromptFieldObserver.observe(field, {
            attributes: true,
            attributeFilter: ['disabled']
        });
    }
});

window.addEventListener('focus', forceEnableCustomPromptInputs);

function openPromptDeleteModal(index) {
    const prompt = customPrompts[index];
    if (!prompt) return;
    showSmcConfirm({
        title: 'Delete Saved Prompt',
        message: `Are you sure you want to delete "${prompt.title || 'this prompt'}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        danger: true,
    }).then((ok) => {
        if (ok) performPromptDeletion(index);
    });
}

function applyCustomPromptValues(title = '', content = '') {
    customPromptTitle.value = title;
    customPromptInput.value = content;
    updateSendButtonState();
}

function resetCustomPromptForm(options = {}) {
    const {
        title = '',
        content = '',
        preserveSaveCheckbox = false
    } = options;

    if (!preserveSaveCheckbox) {
        savePromptCheckbox.checked = false;
    }

    applyCustomPromptValues(title, content);
}

// Input Listeners for Validation
customPromptTitle.addEventListener('input', updateSendButtonState);
customPromptInput.addEventListener('input', updateSendButtonState);

// Predefined Prompt Input Listener
if (predefinedPromptInput) {
    predefinedPromptInput.addEventListener('input', () => {
        const content = predefinedPromptInput.value.trim();
        // Enable if content is different from current and not empty
        btnSavePredefined.disabled = (content === currentPredefinedPrompt) || (content === '');
    });
}

// Event Listeners
closeCrossCheckBtn.addEventListener('click', () => {
    if (predefinedPromptEditView && !predefinedPromptEditView.classList.contains('hidden')) {
        showOptionsView();
        return;
    }
    closeCrossCheckModal();
});
crossCheckModal.addEventListener('click', (e) => {
    if (e.target === crossCheckModal) closeCrossCheckModal();
});

btnCompareResponses.addEventListener('click', (e) => {
    if (e.target.closest('.cc-compare-card-actions')) return;

    window.electronAPI.crossCheck(isAnonymousMode, currentPredefinedPrompt);
    closeCrossCheckModal();
});

function wireCcCompareIconActivation(el, handler) {
    if (!el) return;
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        handler(e);
    });
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            handler(e);
        }
    });
}

wireCcCompareIconActivation(btnPredefinedPromptPreview, () => {
    openCrossCheckPredefinedPreviewModal();
});

if (crossCheckPredefinedPreviewClose) {
    crossCheckPredefinedPreviewClose.addEventListener('click', () => closeCrossCheckPredefinedPreviewModal());
}
if (crossCheckPredefinedPreviewBackdrop) {
    crossCheckPredefinedPreviewBackdrop.addEventListener('click', () => closeCrossCheckPredefinedPreviewModal());
}

if (btnEditPredefined) {
    btnEditPredefined.addEventListener('click', (e) => {
        e.stopPropagation();
        showPredefinedEditView();
    });
    btnEditPredefined.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            showPredefinedEditView();
        }
    });
}

if (btnCancelPredefined) {
    btnCancelPredefined.addEventListener('click', showOptionsView);
}

if (btnSavePredefined) {
    btnSavePredefined.addEventListener('click', () => {
        const newContent = predefinedPromptInput.value.trim();
        if (newContent) {
            savePredefinedPrompt(newContent);
        }
        showOptionsView();
    });
}

btnCustomPrompt.addEventListener('click', () => {
    // Store anonymous mode for CPB to use when sending
    window._cpb_isAnonymousMode = isAnonymousMode;
    // Open CPB in new-prompt editor (not list-first)
    if (typeof window.openCustomPromptBuilderNew === 'function') {
        window.openCustomPromptBuilderNew();
    } else if (typeof window.openCustomPromptBuilder === 'function') {
        window.openCustomPromptBuilder();
    } else {
        showCustomPromptView();
    }
});
backToOptionsBtn.addEventListener('click', showOptionsView);

// Add Custom Prompt Button
btnAddCustom.addEventListener('click', () => {
    ensureCustomPromptInputsEnabled();
    const title = customPromptTitle.value.trim();
    const content = customPromptInput.value.trim();
    const isValid = isCustomPromptFormValid();

    if (!isValid) {
        alert('Please enter both Title and Content.');
        updateSendButtonState();
        customPromptTitle.focus();
        return;
    }

    // Check uniqueness
    const existingIndex = customPrompts.findIndex(p => p.title === title);
    if (existingIndex !== -1) {
        // Show overwrite confirmation modal instead of alert
        showOverwriteConfirmModal(title, content, existingIndex);
        return;
    }

    saveCustomPrompt(title, content);

    // Clear inputs
    resetCustomPromptForm({ preserveSaveCheckbox: true });
});

// Overwrite Confirmation Modal
function showOverwriteConfirmModal(title, content, existingIndex) {
    // Create modal if not exists
    let overwriteModal = document.getElementById('overwrite-confirm-modal');
    if (!overwriteModal) {
        overwriteModal = document.createElement('div');
        overwriteModal.id = 'overwrite-confirm-modal';
        overwriteModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        overwriteModal.innerHTML = `
            <div style="background: hsl(220 15% 18%); border-radius: 12px; padding: 24px; max-width: 400px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.4); position: relative;">
                <button id="overwrite-close-btn" style="position: absolute; top: 12px; right: 12px; background: transparent; border: none; color: #888; cursor: pointer; font-size: 1.2rem; padding: 4px; line-height: 1;">&times;</button>
                <h3 style="margin: 0 0 16px 0; color: #fff;">Overwrite Prompt?</h3>
                <p style="margin: 0 0 24px 0; color: #888;">A custom prompt with this title already exists. Do you want to overwrite it?</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="overwrite-cancel-btn" style="padding: 8px 24px; background: #444; color: #fff; border: none; border-radius: 6px; cursor: pointer;">No</button>
                    <button id="overwrite-confirm-btn" style="padding: 8px 24px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Yes</button>
                </div>
            </div>
        `;
        document.body.appendChild(overwriteModal);
    }

    // Reset button state whenever modal opens
    const confirmBtn = document.getElementById('overwrite-confirm-btn');
    const cancelBtn = document.getElementById('overwrite-cancel-btn');
    if (confirmBtn) {
        confirmBtn.innerHTML = 'Yes';
        confirmBtn.style.background = '#3b82f6';
        confirmBtn.disabled = false;
    }
    if (cancelBtn) {
        cancelBtn.disabled = false;
    }

    // Show modal
    overwriteModal.style.display = 'flex';

    // Close modal function
    function closeOverwriteModal() {
        overwriteModal.style.display = 'none';
        // Re-enable inputs after modal closes
        ensureCustomPromptInputsEnabled();
    }

    // Get buttons - they are fresh each time since modal is reused
    // (Variables declared above already)

    // Setup Close Button
    const closeBtn = document.getElementById('overwrite-close-btn');
    if (closeBtn) {
        // Clone to clear old listeners
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.onclick = () => {
            closeOverwriteModal();
        };
    }

    // Clear old listeners by replacing with clones
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // Attach new listeners to the newly inserted buttons
    newConfirmBtn.onclick = () => {
        // Update existing prompt
        customPrompts[existingIndex] = {
            ...customPrompts[existingIndex],
            content: content,
            lastUsed: new Date().toISOString()
        };
        localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
        renderSavedPrompts();

        // Show success feedback
        newConfirmBtn.innerHTML = 'Saved!';
        newConfirmBtn.style.background = '#22c55e';
        newConfirmBtn.disabled = true;
        newCancelBtn.disabled = true;

        // Close modal after brief delay for user to see feedback
        setTimeout(() => {
            resetCustomPromptForm({ preserveSaveCheckbox: true });
            closeOverwriteModal();
        }, 800);
    };

    newCancelBtn.onclick = () => {
        closeOverwriteModal();
    };

    // Click outside to close (use a one-time handler)
    const outsideClickHandler = (e) => {
        if (e.target === overwriteModal) {
            closeOverwriteModal();
            overwriteModal.removeEventListener('click', outsideClickHandler);
        }
    };
    overwriteModal.addEventListener('click', outsideClickHandler);
}

btnSendCustom.addEventListener('click', () => {
    const prompt = customPromptInput.value.trim();
    const title = customPromptTitle.value.trim();

    if (!prompt || !title) {
        // Should be disabled, but just in case
        return;
    }

    if (savePromptCheckbox.checked) {
        // Check if exists, if so, maybe update? Or just warn?
        // User didn't specify behavior for "Send" with "Save" checked regarding uniqueness.
        // I'll assume if checked, we try to save. If duplicate, maybe we just proceed or warn.
        // Given the strict validation on "Add", I'll try to save if unique, otherwise just send.
        const exists = customPrompts.some(p => p.title === title);
        if (!exists) {
            saveCustomPrompt(title, prompt);
        }
    }

    window.electronAPI.crossCheck(isAnonymousMode, prompt);
    closeCrossCheckModal();
});

function saveCustomPrompt(title, content) {
    const now = new Date().toISOString();
    const newPrompt = {
        id: Date.now().toString(),
        title,
        content,
        createdAt: now,
        lastUsedAt: now
    };

    // Add to beginning
    customPrompts.unshift(newPrompt);

    // Limit to 10
    if (customPrompts.length > 10) {
        customPrompts = customPrompts.slice(0, 10);
    }

    // Sort by Last Updated (Last Used/Created) - User requested "Sort by Last Updated"
    // Actually, unshift adds to top, which is "Latest".
    // But if we want to enforce sort order in the list:
    // The user said: "automatically Last Updated가 최신 순으로 정렬해서 추가되었음을 인지할 수 있도록 해줘"
    // So we should set currentSort to lastUsedAt desc
    currentSort.column = 'createdAt';
    currentSort.direction = 'desc';

    saveCustomPromptsToStorage();
    renderSavedPrompts();
}

function performPromptDeletion(index) {
    const deletedPrompt = customPrompts[index];
    customPrompts.splice(index, 1);
    saveCustomPromptsToStorage();
    renderSavedPrompts();

    forceEnableCustomPromptInputs();

    const isDeletedPromptActive = deletedPrompt &&
        customPromptTitle.value.trim() === deletedPrompt.title &&
        customPromptInput.value.trim() === deletedPrompt.content;

    if (isDeletedPromptActive) {
        resetCustomPromptForm({ preserveSaveCheckbox: true });
    } else {
        updateSendButtonState();
    }
}

function deleteCustomPrompt(index, e) {
    e.stopPropagation(); // Prevent row click
    openPromptDeleteModal(index);
}

function formatDate(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr}<br>${timeStr}`;
}

function formatDateTooltip(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderSavedPrompts() {
    savedPromptsBody.innerHTML = '';

    if (customPrompts.length === 0) {
        savedPromptsTable.style.display = 'none';
        savedPromptsEmpty.classList.remove('hidden');
        savedPromptsEmpty.style.display = 'block';
        return;
    }

    savedPromptsTable.style.display = 'table';
    savedPromptsEmpty.classList.add('hidden');
    savedPromptsEmpty.style.display = 'none';

    // Sort
    const sortedPrompts = [...customPrompts].sort((a, b) => {
        const valA = a[currentSort.column] || '';
        const valB = b[currentSort.column] || '';

        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    sortedPrompts.forEach((prompt, index) => {
        // Find original index for deletion
        const originalIndex = customPrompts.findIndex(p => p.id === prompt.id);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td title="${escapeHtml(prompt.title)}">${escapeHtml(prompt.title)}</td>
            <td title="${escapeHtml(prompt.content)}">${escapeHtml(prompt.content)}</td>
            <td title="${formatDateTooltip(prompt.lastUsedAt)}">${formatDate(prompt.lastUsedAt)}</td>
            <td title="${formatDateTooltip(prompt.createdAt)}">${formatDate(prompt.createdAt)}</td>
            <td style="text-align: center;">
                <button class="delete-prompt-btn" title="Delete">✕</button>
            </td>
        `;

        // Row Click -> Load Prompt
        tr.addEventListener('click', () => {
            applyCustomPromptValues(prompt.title, prompt.content);
            // Update last used
            prompt.lastUsedAt = new Date().toISOString();
            saveCustomPromptsToStorage();
        });

        // Delete Button
        const deleteBtn = tr.querySelector('.delete-prompt-btn');
        deleteBtn.addEventListener('click', (e) => deleteCustomPrompt(originalIndex, e));

        savedPromptsBody.appendChild(tr);
    });

    updateSortIcons();
}

function updateSortIcons() {
    const headers = savedPromptsTable.querySelectorAll('th[data-sort]');
    headers.forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (th.dataset.sort === currentSort.column) {
            icon.textContent = currentSort.direction === 'asc' ? '▲' : '▼';
            th.style.color = 'hsl(var(--foreground))';
        } else {
            icon.textContent = '';
            th.style.color = '';
        }
    });
}

// Sorting Event Listeners
savedPromptsTable.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const column = th.dataset.sort;
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'desc'; // Default desc for new column
        }
        renderSavedPrompts();
    });
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initial state setup on load
window.addEventListener('DOMContentLoaded', () => {
    // Apply initial toggle state to main process (all services), while enforcing "max 4" in Multi mode.
    if (chatMode === 'multi') {
        // Clamp any accidental >4 checked (e.g. migrated data or manual edits)
        enforceMultiToggleLimit();
    }

    MULTI_SERVICE_ORDER.forEach(service => {
        if (toggles[service]) {
            window.electronAPI.toggleService(service, !!toggles[service].checked);
        }
    });

    // Ensure we render at least once on boot so BrowserViews get bounds
    updateLayoutState();
    updateServiceToggles();
});

// NOTE: apply-saved-state is handled in setupSessionPersistence() to support chatMode + singleAiConfig and avoid double-apply.

// Report UI state changes to main process for persistence
function reportCurrentUIState() {
    if (window.electronAPI.reportUiState) {
        const activeServices = (chatMode === 'multi') ? enforceMultiToggleLimit() : [];

        window.electronAPI.reportUiState({
            isAnonymousMode,
            isScrollSyncEnabled,
            layout: currentLayout,
            activeServices
        });
    }
}

// Call reportCurrentUIState on relevant changes (called from toggle handlers already via updateLayoutState)

function toggleMaximize(service, btn, maxIcon, restoreIcon) {
    const slot = document.getElementById('slot-' + service);
    const viewsPlaceholder = document.getElementById('views-placeholder');

    if (slot && viewsPlaceholder) {
        const isMaximized = slot.classList.toggle('maximized');

        if (isMaximized) {
            viewsPlaceholder.classList.add('has-maximized-view');
            btn.innerHTML = restoreIcon;
            btn.title = 'Restore';
            btn.classList.add('maximized-btn');
            // Auto collapse prompt input when maximized
            setPromptCollapsed(true);
            setBottomControlsDisabled(true);
        } else {
            viewsPlaceholder.classList.remove('has-maximized-view');
            btn.innerHTML = maxIcon;
            btn.title = 'Maximize';
            btn.classList.remove('maximized-btn');
            // Auto expand prompt input when restored
            setPromptCollapsed(false);
            const anyMaximized = document.querySelector('.view-slot.maximized');
            setBottomControlsDisabled(!!anyMaximized);
        }

        // Send updated bounds to main process
        updateBounds();
    }
}


// ==========================================
// History & Sidebar Logic
// ==========================================
const historySidebar = document.getElementById('history-sidebar');
const historyList = document.getElementById('history-list');
const historyBulkActions = document.getElementById('history-bulk-actions');
const historySelectedCountEl = document.getElementById('history-selected-count');
const historySelectAllBtn = document.getElementById('history-select-all-btn');
const historyClearSelectionBtn = document.getElementById('history-clear-selection-btn');
const historyBulkDeleteBtn = document.getElementById('history-bulk-delete-btn');
const historyExitSelectionBtn = document.getElementById('history-exit-selection-btn');
const currentSessionIdKey = 'multi_chat_current_session_id';
const historyScrollStateKey = 'multi_chat_history_scroll_state';
const HISTORY_PAGE_SIZE = 30;
let historyOffset = 0;
let historyHasMore = true;
let historyLoading = false;
let historyScrollAttached = false;
let savedHistoryScrollState = null;
let historyPendingReload = null;
let historySuppressScrollEvents = false;

const historyTitleSearchInput = document.getElementById('history-title-search');
const historySortSelect = document.getElementById('history-sort-select');
let historySortBy = 'updatedDesc';
let historySearchTitle = '';

const selectedHistorySessionIds = new Set();

function saveHistoryScrollState() {
    if (!historyList) return;
    const state = {
        scrollTop: historyList.scrollTop,
        offset: historyOffset,
        activeSessionId: currentSessionId,
    };
    try {
        localStorage.setItem(historyScrollStateKey, JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save history scroll state', e);
    }
}

function loadSavedHistoryScrollState() {
    try {
        const raw = localStorage.getItem(historyScrollStateKey);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('Failed to load history scroll state', e);
        return null;
    }
}

function scrollActiveHistoryItemIntoView() {
    if (!historyList) return;
    const active = historyList.querySelector('.history-item.active');
    if (active) {
        active.scrollIntoView({ block: 'nearest' });
    }
}

function ensureActiveHistoryItemVisible() {
    if (!historyList) return;
    const active = historyList.querySelector('.history-item.active');
    if (!active) return;
    const containerRect = historyList.getBoundingClientRect();
    const itemRect = active.getBoundingClientRect();
    if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) {
        active.scrollIntoView({ block: 'nearest' });
    }
}

function startOfLocalDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
}

/** Timestamp used for Today / Last week / Last month buckets — must match active sort (created vs updated). */
function historyBucketTimestamp(session) {
    if (historySortBy === 'createdDesc') {
        return new Date(session.createdAt || session.updatedAt || 0).getTime();
    }
    return new Date(session.updatedAt || session.createdAt || 0).getTime();
}

function historyTimeBucket(session) {
    const ts = historyBucketTimestamp(session);
    const today0 = startOfLocalDay(new Date());
    const day0 = startOfLocalDay(ts);
    const diffDays = Math.round((today0 - day0) / 86400000);
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays <= 7) return 'week';
    if (diffDays <= 30) return 'month';
    return 'older';
}

function historyListDateLine(session) {
    if (historySortBy === 'createdDesc') {
        const createdAtStr = session.createdAt ? new Date(session.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown';
        return `Created ${createdAtStr}`;
    }
    const updatedAtStr = session.updatedAt ? new Date(session.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    return updatedAtStr;
}

function historyBucketLabel(bucket) {
    const m = { today: 'Today', yesterday: 'Yesterday', week: 'Last week', month: 'Last month', older: 'Older' };
    return m[bucket] || bucket;
}

/** Dashboard chart: click-hit zones in canvas logical CSS pixels (same space as drawing). */
let dashChartClickZones = [];
let dashChartSessionsCache = [];
let dashChartGranularityCache = 'day';
let dashChartSelectedBucketKey = null;

function dateToChartBucketKey(d, granularity) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    if (granularity === 'day') {
        return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    if (granularity === 'week') {
        const w = new Date(d);
        const dow = w.getDay();
        w.setDate(w.getDate() - dow);
        return w.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    if (granularity === 'month') {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return String(d.getFullYear());
}

function sessionToChartBucketKey(session, granularity) {
    const t = new Date(session.updatedAt || session.createdAt || 0);
    return dateToChartBucketKey(t, granularity);
}

function aggregateSessionsForChart(sessions, granularity) {
    const map = {};
    sessions.forEach((s) => {
        const key = sessionToChartBucketKey(s, granularity);
        if (!key) return;
        map[key] = (map[key] || 0) + 1;
    });
    return map;
}

function hideDashBucketDetail() {
    const detail = document.getElementById('dash-bucket-detail');
    const tbody = document.getElementById('dash-bucket-tbody');
    if (detail) detail.classList.add('hidden');
    if (tbody) tbody.replaceChildren();
    dashChartSelectedBucketKey = null;
}

/** Parse dashboard chart bucket key back to a Date (local) for Period label formatting. */
function parseChartBucketKeyToDate(bucketKey, gran) {
    if (!bucketKey) return null;
    if (gran === 'month') {
        const m = String(bucketKey).match(/^(\d{4})-(\d{2})$/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1);
        return null;
    }
    if (gran === 'year') {
        const y = parseInt(String(bucketKey), 10);
        return Number.isFinite(y) ? new Date(y, 0, 1) : null;
    }
    const parts = String(bucketKey).match(/\d+/g);
    if (parts && parts.length >= 3) {
        let y; let mo; let d;
        if (parts[0].length === 4) {
            y = Number(parts[0]);
            mo = Number(parts[1]);
            d = Number(parts[2]);
        } else {
            mo = Number(parts[0]);
            d = Number(parts[1]);
            y = Number(parts[2]);
        }
        if (y < 100) y += 2000;
        const dt = new Date(y, mo - 1, d);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const t = Date.parse(String(bucketKey));
    if (!Number.isNaN(t)) return new Date(t);
    return null;
}

/** English period line matching Day / Week / Month / Year granularity. */
function formatDashBucketPeriodLabel(bucketKey, gran) {
    const d = parseChartBucketKeyToDate(bucketKey, gran);
    if (gran === 'month' && d) {
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (gran === 'year') {
        return `Year ${bucketKey}`;
    }
    if (gran === 'day' && d) {
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (gran === 'week' && d) {
        const start = new Date(d);
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        const a = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const b = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `Week of ${a} – ${b}`;
    }
    return bucketKey;
}

function formatDashSessionDate(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return String(iso);
        return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
        return String(iso);
    }
}

async function onDashSessionRowActivate(tr) {
    const id = tr.dataset.sessionId;
    if (!id) return;
    const session = await historyManager.getSession(id);
    if (session) loadSession(session);
}

function renderDashBucketDetail(bucketKey) {
    const detail = document.getElementById('dash-bucket-detail');
    const tbody = document.getElementById('dash-bucket-tbody');
    const titleEl = document.getElementById('dash-bucket-title');
    const countEl = document.getElementById('dash-bucket-count');
    if (!detail || !tbody || !titleEl || !countEl) return;
    const gran = dashChartGranularityCache;
    const filtered = dashChartSessionsCache.filter((s) => sessionToChartBucketKey(s, gran) === bucketKey);
    filtered.sort((a, b) => {
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        return tb - ta;
    });
    titleEl.textContent = `Period: ${formatDashBucketPeriodLabel(bucketKey, gran)}`;
    countEl.textContent = `${filtered.length} session(s)`;
    tbody.replaceChildren();
    filtered.forEach((s) => {
        const tr = document.createElement('tr');
        tr.className = 'dash-session-row';
        tr.dataset.sessionId = s.id;
        tr.setAttribute('tabindex', '0');
        tr.setAttribute('role', 'button');
        const tdTitle = document.createElement('td');
        tdTitle.textContent = s.title || 'Untitled';
        const tdWhen = document.createElement('td');
        tdWhen.textContent = formatDashSessionDate(s.updatedAt || s.createdAt);
        tr.appendChild(tdTitle);
        tr.appendChild(tdWhen);
        tr.addEventListener('click', () => onDashSessionRowActivate(tr));
        tr.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                onDashSessionRowActivate(tr);
            }
        });
        tbody.appendChild(tr);
    });
    detail.classList.remove('hidden');
}

function onDashboardChartClick(e) {
    const canvas = e.currentTarget;
    if (!dashChartClickZones.length) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const logicalW = canvas.width / dpr;
    const logicalH = canvas.height / dpr;
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * logicalW;
    const y = ((e.clientY - rect.top) / rect.height) * logicalH;
    for (let i = 0; i < dashChartClickZones.length; i++) {
        const z = dashChartClickZones[i];
        if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) {
            dashChartSelectedBucketKey = z.key;
            renderDashBucketDetail(z.key);
            drawDashboardChart(dashChartSessionsCache, dashChartGranularityCache, dashChartSelectedBucketKey);
            return;
        }
    }
}

function setupDashboardChartInteraction() {
    const canvas = document.getElementById('dash-chart');
    if (!canvas || canvas.dataset.smcDashBound) return;
    canvas.dataset.smcDashBound = '1';
    canvas.addEventListener('click', onDashboardChartClick);
}

function drawDashboardChart(sessions, granularity, selectedBucketKey) {
    const canvas = document.getElementById('dash-chart');
    if (!canvas || !canvas.getContext) return;
    const wrap = canvas.closest('.dashboard-chart-canvas-wrap');
    const dpr = window.devicePixelRatio || 1;
    const wrapRect = wrap ? wrap.getBoundingClientRect() : canvas.getBoundingClientRect();
    const cssW = Math.max(280, Math.floor(wrapRect.width) || 420);
    const cssH = 214;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    const w = cssW;
    const h = cssH;
    ctx.clearRect(0, 0, w, h);
    dashChartClickZones = [];
    const counts = aggregateSessionsForChart(sessions, granularity);
    const todayK = dateToChartBucketKey(new Date(), granularity);
    if (todayK) counts[todayK] = counts[todayK] ?? 0;
    const keys = Object.keys(counts).sort();
    const xLabelHost = document.getElementById('dash-chart-x-labels');
    if (xLabelHost) {
        xLabelHost.replaceChildren();
    }
    if (keys.length === 0) {
        canvas.style.cursor = 'default';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText('No data', 12, 28);
        return;
    }
    canvas.style.cursor = 'pointer';
    const max = Math.max(1, ...keys.map((k) => counts[k]));
    const padL = 36;
    const padR = 8;
    const padB = 14;
    const padT = 8;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    let showKeys;
    if (keys.length <= 18) {
        showKeys = keys;
    } else if (todayK != null && keys.includes(todayK)) {
        const ti = keys.indexOf(todayK);
        const start = Math.max(0, Math.min(ti, keys.length - 18));
        showKeys = keys.slice(start, start + 18);
    } else {
        showKeys = keys.slice(-18);
    }
    const n = showKeys.length;
    const barGap = 3;
    const barW = n > 0 ? Math.max(3, (chartW - barGap * (n - 1)) / n) : 3;
    const baselineY = padT + chartH;

    ctx.strokeStyle = 'hsl(215 16% 38%)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, baselineY);
    ctx.lineTo(padL + chartW, baselineY);
    ctx.stroke();

    ctx.fillStyle = 'hsl(217 10% 64%)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(max), padL - 6, padT + 10);
    ctx.fillText('0', padL - 6, baselineY + 3);

    showKeys.forEach((k, i) => {
        const v = counts[k];
        const bh = (v / max) * chartH;
        const x = padL + i * (barW + barGap);
        const y = baselineY - bh;
        const selected = selectedBucketKey === k;
        const grad = ctx.createLinearGradient(0, y, 0, baselineY);
        if (selected) {
            grad.addColorStop(0, 'hsl(280 75% 62%)');
            grad.addColorStop(1, 'hsl(280 70% 48%)');
        } else {
            grad.addColorStop(0, 'hsl(263 70% 58%)');
            grad.addColorStop(1, 'hsl(263 70% 42%)');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, bh);
        if (selected) {
            ctx.strokeStyle = 'hsl(48 96% 58%)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 0.5, y - 0.5, barW + 1, bh + 1);
        }
        if (v > 0) {
            const label = String(v);
            ctx.font = 'bold 10px system-ui, sans-serif';
            ctx.textAlign = 'center';
            const cx = x + barW / 2;
            if (bh >= 22) {
                ctx.fillStyle = 'rgba(255,255,255,0.92)';
                ctx.fillText(label, cx, y + 13);
            } else {
                ctx.fillStyle = 'hsl(217 10% 64%)';
                ctx.fillText(label, cx, y - 3);
            }
        }
        const minHit = 10;
        const hitH = Math.max(bh, minHit);
        const hitY = baselineY - hitH;
        dashChartClickZones.push({ key: k, x, y: hitY, w: barW, h: hitH });
    });

    if (xLabelHost) {
        xLabelHost.style.display = 'flex';
        xLabelHost.style.flexDirection = 'row';
        xLabelHost.style.alignItems = 'flex-start';
        xLabelHost.style.justifyContent = 'flex-start';
        xLabelHost.style.gap = `${barGap}px`;
        xLabelHost.style.paddingLeft = `${padL}px`;
        xLabelHost.style.paddingRight = `${padR}px`;
        xLabelHost.style.boxSizing = 'border-box';
        xLabelHost.style.width = '100%';
        showKeys.forEach((k) => {
            const span = document.createElement('span');
            span.className = 'dashboard-chart-xlab';
            let short = k;
            if (granularity === 'month' && k.match(/^\d{4}-\d{2}$/)) {
                const dt = parseChartBucketKeyToDate(k, 'month');
                short = dt ? dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : k;
            } else if (granularity === 'year') {
                short = String(k);
            } else {
                const dt = parseChartBucketKeyToDate(k, granularity);
                short = dt
                    ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : (k.length > 12 ? `${k.slice(0, 11)}…` : k);
            }
            span.textContent = short;
            span.title = formatDashBucketPeriodLabel(k, granularity);
            span.style.flex = '1 1 0';
            span.style.minWidth = '0';
            xLabelHost.appendChild(span);
        });
    }
}

async function refreshDashboard() {
    const modeEl = document.getElementById('dash-chat-mode');
    const svcEl = document.getElementById('dash-services');
    const catEl = document.getElementById('dash-prompt-cats');
    const prEl = document.getElementById('dash-prompt-total');
    const hiEl = document.getElementById('dash-history-total');
    try {
        if (modeEl) modeEl.textContent = chatMode === 'single' ? 'Single AI' : 'Multi AI';
        if (svcEl) {
            if (chatMode === 'single') {
                const n = singleAiActiveInstances ? singleAiActiveInstances.filter(Boolean).length : 0;
                svcEl.textContent = `${singleAiService || '—'} · ${n} active instance(s)`;
            } else {
                const names = Object.entries(toggles || {}).filter(([, t]) => t && t.checked).map(([k]) => k);
                svcEl.textContent = names.length ? names.join(', ') : '—';
            }
        }
        let catCount = 0;
        let promptTotal = 0;
        if (window.SMCPromptLibrary) {
            catCount = window.SMCPromptLibrary.loadCategories().filter((c) => !c.parentId).length;
            promptTotal = window.SMCPromptLibrary.loadPromptsRaw().length;
        }
        if (catEl) catEl.textContent = String(catCount);
        if (prEl) prEl.textContent = String(promptTotal);
        const allSess = await historyManager.getAllSessions({ sortBy: 'updatedDesc' });
        if (hiEl) hiEl.textContent = String(allSess.length);
        const granSel = document.getElementById('dash-chart-granularity');
        const g = granSel && granSel.value ? granSel.value : 'day';
        dashChartSessionsCache = allSess;
        dashChartGranularityCache = g;
        hideDashBucketDetail();
        drawDashboardChart(allSess, g, null);
        const todayKey = dateToChartBucketKey(new Date(), g);
        let pickKey = null;
        if (todayKey && dashChartClickZones.some((z) => z.key === todayKey)) {
            pickKey = todayKey;
        } else if (dashChartClickZones.length) {
            pickKey = dashChartClickZones[dashChartClickZones.length - 1].key;
        }
        if (pickKey) {
            dashChartSelectedBucketKey = pickKey;
            renderDashBucketDetail(pickKey);
            drawDashboardChart(allSess, g, pickKey);
        }
    } catch (e) {
        console.warn('[Dashboard]', e);
    }
}

function initSidebarNavigation() {
    const sb = document.getElementById('history-sidebar');
    const hamburger = document.getElementById('sidebar-toggle-btn');
    if (!sb) return;

    if (hamburger) {
        const syncHamburgerAria = () => {
            const exp = sb.classList.contains('rail-expanded');
            hamburger.setAttribute('aria-expanded', exp ? 'true' : 'false');
            hamburger.title = exp ? 'Collapse menu' : 'Expand menu';
        };
        syncHamburgerAria();
        hamburger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            sb.classList.toggle('rail-expanded');
            if (sb.classList.contains('rail-expanded')) {
                restoreHistoryScrollAfterExpand();
            } else {
                saveHistoryScrollState();
            }
            syncHamburgerAria();
        });
    }

    document.querySelectorAll('.sidebar-rail-btn[data-sidebar-panel]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const p = btn.getAttribute('data-sidebar-panel');
            if (p === 'new-chat') {
                e.preventDefault();
                closeSmcFullPanels();
                triggerNewChatWorkflow();
                return;
            }
            e.preventDefault();
            openSmcFullPanel(p);
        });
    });

    const stack = document.getElementById('smc-panel-overlay-stack');
    if (stack) {
        stack.addEventListener('click', (e) => {
            if (e.target.closest('[data-smc-close-panel]')) {
                closeSmcFullPanels();
                return;
            }
            if (e.target.closest('#smc-ph-new-prompt-btn')) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.openCustomPromptBuilderNew === 'function') window.openCustomPromptBuilderNew();
                else if (typeof window.openCustomPromptBuilder === 'function') window.openCustomPromptBuilder();
            }
        });
    }

    const granSel = document.getElementById('dash-chart-granularity');
    if (granSel) {
        granSel.addEventListener('change', () => refreshDashboard());
    }

    setupDashboardChartInteraction();

    const dashRoot = document.getElementById('dashboard-root');
    if (dashRoot && typeof ResizeObserver !== 'undefined') {
        let dashResizeT;
        const ro = new ResizeObserver(() => {
            const dashOv = document.getElementById('smc-overlay-dashboard');
            if (!dashOv || !dashOv.classList.contains('is-open')) return;
            clearTimeout(dashResizeT);
            dashResizeT = setTimeout(() => {
                refreshDashboard();
            }, 150);
        });
        ro.observe(dashRoot);
    }

    if (typeof window.initPromptHubShell === 'function') {
        window.initPromptHubShell({ historyManager });
    }
}

function restoreHistoryScrollAfterExpand() {
    if (!historyList) return;
    const state = loadSavedHistoryScrollState();
    if (state && typeof state.offset === 'number') {
        historyOffset = state.offset;
    }

    // Wait for display:none -> visible layout to settle
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (state && typeof state.scrollTop === 'number') {
                historyList.scrollTop = state.scrollTop;
            }
            ensureActiveHistoryItemVisible();
        });
    });
}

function updateHistorySelectionUI() {
    const selectedCount = selectedHistorySessionIds.size;

    if (historyBulkActions) {
        historyBulkActions.classList.toggle('hidden', selectedCount === 0);
    }
    if (historySelectedCountEl) {
        historySelectedCountEl.textContent = String(selectedCount);
    }
    if (historyBulkDeleteBtn) {
        historyBulkDeleteBtn.disabled = selectedCount === 0;
    }
}

function clearHistorySelection() {
    selectedHistorySessionIds.clear();
    updateHistorySelectionUI();
    syncHistorySelectionStyles();
}

function selectAllLoadedHistoryItems() {
    const items = document.querySelectorAll('#history-list .history-item[data-session-id]');
    items.forEach((el) => {
        const id = el.dataset.sessionId;
        if (id) selectedHistorySessionIds.add(id);
    });
    updateHistorySelectionUI();
    syncHistorySelectionStyles();
}

function syncHistorySelectionStyles() {
    const items = document.querySelectorAll('#history-list .history-item[data-session-id]');
    items.forEach((el) => {
        const id = el.dataset.sessionId;
        const selected = id && selectedHistorySessionIds.has(id);
        el.classList.toggle('selected', !!selected);
        const checkbox = el.querySelector('input[type="checkbox"].history-item-checkbox');
        if (checkbox) checkbox.checked = !!selected;
    });
}

function showHistoryBulkDeleteModal(ids) {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return;
    showSmcConfirm({
        title: 'Delete Selected Sessions',
        message: `Are you sure you want to delete ${uniqueIds.length} sessions?\nThis cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        danger: true,
    }).then(async (ok) => {
        if (ok) await performHistoryBulkDelete(uniqueIds);
    });
}

async function resetToNewSessionAfterDelete() {
    // Create a new session like New Chat (same behavior as single delete/clear all)
    const activeServices = Object.entries(toggles).filter(([_, t]) => t.checked).map(([k]) => k);
    const currentUrls = {};
    activeServices.forEach(service => {
        const urlEl = document.getElementById(`url-text-${service}`);
        if (urlEl && urlEl.dataset && urlEl.dataset.url) {
            currentUrls[service] = urlEl.dataset.url;
        }
    });

    currentSessionId = generateId();
    const newSessionData = {
        id: currentSessionId,
        title: `Chat ${new Date().toLocaleTimeString()}`,
        layout: currentLayout,
        activeServices: activeServices,
        prompt: '',
        isAnonymousMode: isAnonymousMode,
        isScrollSyncEnabled: isScrollSyncEnabled,
        urls: currentUrls,
        createdAt: new Date().toISOString(),
    };
    await historyManager.saveSession(newSessionData);
    localStorage.setItem(currentSessionIdKey, currentSessionId);

    window.electronAPI.newChat();
    resetAllGeminiIdleTimers();
}

async function performHistoryBulkDelete(ids) {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return;

    const deletingCurrent = uniqueIds.includes(currentSessionId);

    try {
        await historyManager.deleteSessions(uniqueIds);

        // If deleted sessions include the current one, reset like New Chat
        if (deletingCurrent) {
            await resetToNewSessionAfterDelete();
        }

        selectedHistorySessionIds.clear();
        updateHistorySelectionUI();
        loadHistoryList({ preserveScroll: true, ensureActiveVisible: true });
    } catch (e) {
        console.error('Failed to bulk delete sessions:', e);
    }
}

async function setupHistory() {
    try {
        await historyManager.init();

        if (!historySidebar) return;

        if (historySelectAllBtn) {
            historySelectAllBtn.addEventListener('click', () => {
                selectAllLoadedHistoryItems();
            });
        }
        if (historyClearSelectionBtn) {
            historyClearSelectionBtn.addEventListener('click', () => {
                clearHistorySelection();
            });
        }
        if (historyExitSelectionBtn) {
            historyExitSelectionBtn.addEventListener('click', () => {
                clearHistorySelection();
            });
        }
        if (historyBulkDeleteBtn) {
            historyBulkDeleteBtn.addEventListener('click', () => {
                showHistoryBulkDeleteModal(Array.from(selectedHistorySessionIds));
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const sb = document.getElementById('history-sidebar');
            const historyPanelOpen = sb && sb.getAttribute('data-active-panel') === 'history';
            if (historyPanelOpen && selectedHistorySessionIds.size > 0) {
                clearHistorySelection();
                return;
            }
            if (smcOpenFullPanel) {
                e.preventDefault();
                closeSmcFullPanels();
            }
        });

        // Attach infinite scroll once
        if (historyList && !historyScrollAttached) {
            historyList.addEventListener('scroll', handleHistoryScroll);
            historyScrollAttached = true;
        }

        // Load saved scroll state (for restoring list position on reopen)
        savedHistoryScrollState = loadSavedHistoryScrollState();
        if (savedHistoryScrollState && typeof savedHistoryScrollState.offset === 'number') {
            historyOffset = savedHistoryScrollState.offset;
        }

        // Check if there are any sessions in DB
        const sessions = await historyManager.getSessions(1);

        // Restore saved session ID from localStorage
        const savedSessionId = localStorage.getItem(currentSessionIdKey);

        // If main process already applied state via onApplySavedState, don't overwrite currentSessionId
        // Just ensure loadHistoryList shows the correct active item
        if (!hasAppliedMainState) {
            if (sessions.length === 0) {
                // No sessions in DB - create initial session
                console.log('[History] No sessions found, creating initial session');
                const activeServices = Object.entries(toggles).filter(([_, t]) => t.checked).map(([k]) => k);
                const initialUrls = {};
                activeServices.forEach(service => {
                    const urlEl = document.getElementById(`url-text-${service}`);
                    if (urlEl && urlEl.dataset && urlEl.dataset.url) {
                        initialUrls[service] = urlEl.dataset.url;
                    }
                });

                currentSessionId = generateId();
                const initialSession = {
                    id: currentSessionId,
                    title: `Chat ${new Date().toLocaleTimeString()}`,
                    layout: currentLayout,
                    activeServices: activeServices,
                    prompt: '',
                    isAnonymousMode: isAnonymousMode,
                    isScrollSyncEnabled: isScrollSyncEnabled,
                    urls: initialUrls,
                    createdAt: new Date().toISOString(),
                };
                await historyManager.saveSession(initialSession);
                localStorage.setItem(currentSessionIdKey, currentSessionId);
            } else if (savedSessionId) {
                // Restore saved session ID
                const savedSession = await historyManager.getSession(savedSessionId);
                if (savedSession) {
                    console.log('[History] Restoring saved session:', savedSessionId);
                    currentSessionId = savedSessionId;
                    // Don't call loadSession here - let main.js handle URL restoration
                } else {
                    // Saved session doesn't exist anymore, use first available
                    currentSessionId = sessions[0].id;
                    localStorage.setItem(currentSessionIdKey, currentSessionId);
                }
            } else {
                // Use first session
                currentSessionId = sessions[0].id;
                localStorage.setItem(currentSessionIdKey, currentSessionId);
            }
        } else {
            console.log('[History] Main state already applied, skipping session ID assignment');
        }

        initSidebarNavigation();

        if (historyTitleSearchInput) {
            let searchDebounce;
            historyTitleSearchInput.addEventListener('input', () => {
                clearTimeout(searchDebounce);
                searchDebounce = setTimeout(() => {
                    historySearchTitle = historyTitleSearchInput.value || '';
                    historyOffset = 0;
                    loadHistoryList();
                }, 200);
            });
        }
        if (historySortSelect) {
            historySortSelect.addEventListener('change', () => {
                historySortBy = historySortSelect.value || 'updatedDesc';
                historyOffset = 0;
                loadHistoryList();
            });
        }

        loadHistoryList({ preserveScroll: true, restoreSavedScroll: savedHistoryScrollState, ensureActiveVisible: true });

    } catch (e) {
        console.error('Failed to setup history:', e);
    }
}

function handleHistoryScroll() {
    if (!historyList) return;
    if (historySuppressScrollEvents || historyLoading) return;
    const nearBottom = historyList.scrollTop + historyList.clientHeight >= historyList.scrollHeight - 80;
    if (nearBottom) {
        loadHistoryList({ append: true });
    }
    saveHistoryScrollState();
}

async function loadHistoryList(options = {}) {
    const { append = false, preserveScroll = false, restoreSavedScroll = null, ensureActiveVisible = false } = options;
    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;

    // Guard BEFORE mutating DOM/state:
    // - If an append call comes while loading, ignore it.
    // - If a non-append (full re-render) is requested while loading, queue it and run after current load finishes.
    if (historyLoading) {
        if (!append) {
            historyPendingReload = options;
        }
        return;
    }

    // Only block when appending; even if hasMore=false we still want to be able to re-render the current list.
    if (append && !historyHasMore) return;

    const prevScrollTop = preserveScroll ? listContainer.scrollTop : 0;

    // Prevent programmatic scrollTop changes during render from triggering infinite-scroll logic
    // (e.g., re-render while near bottom can fire scroll and accidentally append).
    historySuppressScrollEvents = true;

    // Reset state when not appending (full reload)
    if (!append) {
        // keep offset/hasMore when preserving to avoid losing already loaded pages
        if (!preserveScroll) {
            historyOffset = 0;
            historyHasMore = true;
        }
        listContainer.innerHTML = '';
    }
    historyLoading = true;

    // Show loading indicator (non-blocking)
    let loadingEl = listContainer.querySelector('.history-loading');
    if (!loadingEl) {
        loadingEl = document.createElement('div');
        loadingEl.className = 'history-loading';
        loadingEl.style.padding = '10px';
        loadingEl.style.textAlign = 'center';
        loadingEl.style.color = '#666';
        loadingEl.textContent = 'Loading...';
        listContainer.appendChild(loadingEl);
    }

    try {
        const searchQ = (historySearchTitle || '').trim().toLowerCase();
        const useSearch = searchQ.length > 0;

        let sessions;
        let queryOffset = append ? historyOffset : 0;
        const baseLimit = Math.max(HISTORY_PAGE_SIZE, restoreSavedScroll?.offset || historyOffset || 0);
        const queryLimit = append ? HISTORY_PAGE_SIZE : baseLimit;

        if (useSearch) {
            const all = await historyManager.getAllSessions({ sortBy: historySortBy });
            const filtered = all.filter((s) => String(s.title || '').toLowerCase().includes(searchQ));
            sessions = filtered.slice(queryOffset, queryOffset + queryLimit);
            historyOffset = queryOffset + sessions.length;
            historyHasMore = historyOffset < filtered.length;
        } else {
            sessions = await historyManager.getSessions(queryLimit, queryOffset, { sortBy: historySortBy });
            historyOffset = queryOffset + sessions.length;
            historyHasMore = sessions.length >= queryLimit;
        }

        // Empty state
        if (!append && sessions.length === 0) {
            listContainer.innerHTML = '<div style="padding:10px; text-align:center; color:#666;">No history yet</div>';
            historyHasMore = false;
            historyLoading = false;
            return;
        }

        let lastBucket = null;
        if (append) {
            const items = [...listContainer.querySelectorAll('.history-item[data-session-id]')];
            const last = items[items.length - 1];
            if (last && last.dataset.historyBucket) lastBucket = last.dataset.historyBucket;
        }

        sessions.forEach(session => {
            const bucket = historyTimeBucket(session);
            if (bucket !== lastBucket) {
                lastBucket = bucket;
                const gh = document.createElement('div');
                gh.className = 'history-group-header';
                gh.textContent = historyBucketLabel(bucket);
                listContainer.appendChild(gh);
            }

            const item = document.createElement('div');
            item.className = 'history-item history-item-with-actions';
            item.dataset.sessionId = session.id;
            item.dataset.historyBucket = bucket;

            if (session.id === currentSessionId) {
                item.classList.add('active');
            }
            if (selectedHistorySessionIds.has(session.id)) {
                item.classList.add('selected');
            }

            const title = session.title || 'Untitled Session';
            const createdAtStr = session.createdAt ? new Date(session.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown';
            const updatedAtStr = session.updatedAt ? new Date(session.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
            const dateLine = historyListDateLine(session);
            const chk = selectedHistorySessionIds.has(session.id) ? 'checked' : '';

            // Tooltip with full info
            const tooltip = `title: ${title}\ncreatedAt: ${createdAtStr}\nupdatedAt: ${updatedAtStr}`;

            item.innerHTML = `
                <label class="history-item-check-label" title="Select session">
                    <input class="history-item-checkbox" type="checkbox" data-session-id="${escapeHtml(session.id)}" ${chk} aria-label="Select session" />
                </label>
                <div class="history-item-content" title="${tooltip.replace(/"/g, '&quot;')}">
                    <div class="history-title">${escapeHtml(title)}</div>
                    <div class="history-date">${escapeHtml(dateLine)}</div>
                </div>
                <div class="history-item-actions" role="group" aria-label="Session actions">
                    <button type="button" class="history-icon-btn history-open-session-btn" title="Open session" aria-label="Open session">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></svg>
                    </button>
                    <button type="button" class="history-icon-btn history-rename-btn" title="Rename" aria-label="Rename">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button type="button" class="history-icon-btn history-delete-btn-danger" title="Delete" aria-label="Delete">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"/></svg>
                    </button>
                </div>
            `;

            const checkbox = item.querySelector('.history-item-checkbox');
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const want = !!checkbox.checked;
                const has = selectedHistorySessionIds.has(session.id);
                if (want && !has) selectedHistorySessionIds.add(session.id);
                if (!want && has) selectedHistorySessionIds.delete(session.id);
                item.classList.toggle('selected', want);
                updateHistorySelectionUI();
            });
            checkbox.addEventListener('click', (e) => e.stopPropagation());

            item.querySelector('.history-open-session-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                loadSession(session);
            });
            item.querySelector('.history-rename-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                window.electronAPI?.setServiceVisibility?.(false);
                showRenameModal(session);
            });
            item.querySelector('.history-delete-btn-danger')?.addEventListener('click', (e) => {
                e.stopPropagation();
                window.electronAPI?.setServiceVisibility?.(false);
                showHistoryDeleteModal(session);
            });

            listContainer.appendChild(item);
        });

        updateHistorySelectionUI();

        // restore scroll if requested
        const targetScrollTop =
            (restoreSavedScroll && typeof restoreSavedScroll.scrollTop === 'number')
                ? restoreSavedScroll.scrollTop
                : (preserveScroll ? prevScrollTop : null);

        if (targetScrollTop !== null) {
            // Apply after DOM paint to avoid intermediate scroll events with stale scrollHeight.
            requestAnimationFrame(() => {
                listContainer.scrollTop = targetScrollTop;
            });
        }

        if (ensureActiveVisible) {
            requestAnimationFrame(() => scrollActiveHistoryItemIntoView());
        }

        requestAnimationFrame(() => saveHistoryScrollState());
    } catch (e) {
        console.error('Error loading history list:', e);
        if (!append) {
            listContainer.innerHTML = '<div style="padding:10px; color:red;">Error loading history</div>';
        }
    } finally {
        if (loadingEl && loadingEl.parentNode) {
            loadingEl.remove();
        }
        historyLoading = false;
        // Re-enable scroll handling after paint
        requestAnimationFrame(() => {
            historySuppressScrollEvents = false;
        });

        // If a re-render was requested mid-flight, run it now.
        const pending = historyPendingReload;
        historyPendingReload = null;
        if (pending) {
            loadHistoryList(pending);
        }
    }
}

// Custom Context Menu Helper
function showCustomContextMenu(event, session) {
    // Remove existing menus
    const existing = document.querySelector('.custom-context-menu');
    if (existing) {
        const isSameSession = existing.dataset.sessionId === session.id;
        existing.remove();
        // If clicking the same button that opened the menu, just close it (toggle)
        if (isSameSession) return;
    }

    const target = event.currentTarget || event.target;
    // Get the button rect to position relative to it
    const rect = target.getBoundingClientRect();

    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    menu.dataset.sessionId = session.id; // Store ID for toggle logic
    menu.style.position = 'fixed';

    // Position menu: Below the button, right-aligned
    menu.style.top = `${rect.bottom + 3}px`; // 3px gap
    menu.style.backgroundColor = 'hsl(var(--popover))';
    menu.style.border = '1px solid hsl(var(--border))';
    menu.style.borderRadius = 'var(--radius)';
    menu.style.padding = '4px';
    menu.style.zIndex = '100000';
    menu.style.minWidth = '140px';
    menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';

    // DO NOT hide webviews (User request)
    // window.electronAPI.setServiceVisibility(false);

    // Track if we should restore webviews on close
    let keepWebviewsHidden = false;

    const createOption = (text, iconSvg, handler, hideWebviewsAfter = false) => {
        const option = document.createElement('div');
        option.style.padding = '8px 12px';
        option.style.cursor = 'pointer';
        option.style.display = 'flex';
        option.style.alignItems = 'center';
        option.style.gap = '10px';
        option.style.color = 'hsl(var(--popover-foreground))';
        option.style.fontSize = '0.9rem';
        option.style.borderRadius = 'var(--radius)';

        option.onmouseover = () => option.style.backgroundColor = 'hsl(var(--accent))';
        option.onmouseout = () => option.style.backgroundColor = 'transparent';

        option.innerHTML = `${iconSvg} <span>${text}</span>`;
        option.onclick = (e) => {
            e.stopPropagation();
            if (hideWebviewsAfter) {
                keepWebviewsHidden = true;
                // Temporarily hide webviews for modals
                window.electronAPI.setServiceVisibility(false);
            }
            closeMenu();
            handler();
        };
        return option;
    };

    // Rename Option - use custom modal (title in English)
    menu.appendChild(createOption(
        'Rename',
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
        () => {
            showRenameModal(session);
        },
        true // Hide webviews for modal
    ));

    // Delete Option - use custom modal instead of confirm() (keep webviews hidden for modal)
    menu.appendChild(createOption(
        'Delete',
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
        () => {
            showHistoryDeleteModal(session);
        },
        true // Keep webviews hidden for delete modal
    ));

    document.body.appendChild(menu);

    // Adjust position - anchor right edge to right edge of button
    const menuRect = menu.getBoundingClientRect();
    menu.style.left = `${rect.right - menuRect.width}px`;

    // Close menu on click outside
    const closeMenu = () => {
        if (document.body.contains(menu)) menu.remove();
        document.removeEventListener('click', closeMenuHandler);
        document.removeEventListener('keydown', closeMenuEscHandler);
        // Only if we are NOT opening a modal do we need to worry about visibility, 
        // but here we never set it to false initially, so we don't need to restore it to true 
        // unless we hit an option that set it false (handled in click).
    };

    const closeMenuHandler = (e) => {
        if (menu.contains(e.target)) return;
        closeMenu();
    };

    // Close on ESC
    const closeMenuEscHandler = (e) => {
        if (e.key === 'Escape') closeMenu();
    };

    // Delay slightly to prevent immediate trigger
    setTimeout(() => {
        document.addEventListener('click', closeMenuHandler);
        document.addEventListener('keydown', closeMenuEscHandler);
    }, 0);
}

async function showHistoryDeleteModal(session) {
    if (!session) return;
    const title = session.title || 'Untitled Session';
    const ok = await showSmcConfirm({
        title: 'Delete Session',
        message: `Are you sure you want to delete\n${JSON.stringify(title)}?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        danger: true,
    });
    if (ok) await performHistoryDelete(session);
}

async function performHistoryDelete(session) {
    try {
        const wasCurrentSession = (session.id === currentSessionId);

        await historyManager.deleteSession(session.id);

        // If deleted session is the current one, trigger New Chat behavior
        if (wasCurrentSession) {
            const idKey = 'multi_chat_current_session_id';
            sessionStorage.removeItem(idKey);

            // Create a new session like New Chat
            const activeServices = Object.entries(toggles).filter(([_, t]) => t.checked).map(([k]) => k);
            const currentUrls = {};
            activeServices.forEach(service => {
                const urlEl = document.getElementById(`url-text-${service}`);
                if (urlEl && urlEl.dataset && urlEl.dataset.url) {
                    currentUrls[service] = urlEl.dataset.url;
                }
            });

            currentSessionId = generateId();
            const newSessionData = {
                id: currentSessionId,
                title: `Chat ${new Date().toLocaleTimeString()}`,
                layout: currentLayout,
                activeServices: activeServices,
                prompt: '',
                isAnonymousMode: isAnonymousMode,
                isScrollSyncEnabled: isScrollSyncEnabled,
                urls: currentUrls,
                createdAt: new Date().toISOString(),
            };
            await historyManager.saveSession(newSessionData);

            // Reset webviews
            window.electronAPI.newChat();
            resetAllGeminiIdleTimers();
        }

        loadHistoryList({ preserveScroll: true, ensureActiveVisible: true });
    } catch (err) {
        console.error('Failed to delete session:', err);
    }
}

function showClearAllModal() {
    showSmcConfirm({
        title: 'Clear All History',
        message: 'Are you sure you want to delete all chat history?\nThis cannot be undone.',
        confirmText: 'Clear All',
        cancelText: 'Cancel',
        danger: true,
    }).then(async (ok) => {
        if (ok) await performClearAll();
    });
}

async function performClearAll() {
    try {
        await historyManager.clearAll();
        const idKey = 'multi_chat_current_session_id';
        sessionStorage.removeItem(idKey);

        // Create a new session like New Chat
        const activeServices = Object.entries(toggles).filter(([_, t]) => t.checked).map(([k]) => k);
        const currentUrls = {};
        activeServices.forEach(service => {
            const urlEl = document.getElementById(`url-text-${service}`);
            if (urlEl && urlEl.dataset && urlEl.dataset.url) {
                currentUrls[service] = urlEl.dataset.url;
            }
        });

        currentSessionId = generateId();
        const newSessionData = {
            id: currentSessionId,
            title: `Chat ${new Date().toLocaleTimeString()}`,
            layout: currentLayout,
            activeServices: activeServices,
            prompt: '',
            isAnonymousMode: isAnonymousMode,
            isScrollSyncEnabled: isScrollSyncEnabled,
            urls: currentUrls,
            createdAt: new Date().toISOString(),
        };
        await historyManager.saveSession(newSessionData);

        // Reset webviews
        window.electronAPI.newChat();
        resetAllGeminiIdleTimers();

        loadHistoryList();
    } catch (err) {
        console.error('Failed to clear history:', err);
    }
}

// Global variable to track current session ID
let currentSessionId = null;
// Flag to track if main process state has been applied (prevents race condition)
let hasAppliedMainState = false;
// Generate a simple UUID-like string
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

async function saveCurrentSession() {
    try {
        if (!currentSessionId) {
            currentSessionId = generateId();
        }

        // Load existing session early so we can preserve URLs on partial updates (prevents URL keys "disappearing")
        let existingSession = null;
        try {
            existingSession = await historyManager.getSession(currentSessionId);
        } catch (e) {
            // Session doesn't exist yet, that's fine
        }

        // Gather state based on current Chat Mode
        let urls = {};
        let activeServices = [];
        let multiAiConfig = null;
        let singleAiConfig = null;

        const filterInstanceUrlsForService = (service, obj) => {
            if (!service || !obj) return {};
            const out = {};
            for (let i = 0; i < SINGLE_MODE_MAX_INSTANCES; i++) {
                const k = `${service}-${i}`;
                if (typeof obj[k] === 'string' && obj[k]) out[k] = obj[k];
            }
            return out;
        };

        const filterMultiUrls = (obj) => {
            if (!obj) return {};
            const out = {};
            MULTI_SERVICE_ORDER.forEach((svc) => {
                if (typeof obj[svc] === 'string' && obj[svc]) out[svc] = obj[svc];
            });
            return out;
        };

        // Check if a URL is a "conversation URL" (has /c/, /chat/, conversation ID, etc.)
        const isConversationUrl = (url) => {
            if (!url || typeof url !== 'string') return false;
            // ChatGPT: /c/..., Claude: /chat/..., Gemini: ...
            // Check for common conversation patterns
            return /\/c\/[a-f0-9-]+/i.test(url) ||       // ChatGPT
                   /\/chat\/[a-f0-9-]+/i.test(url) ||    // Claude
                   /conversation.*[a-f0-9-]{8,}/i.test(url) || // General pattern
                   /\/share\/[a-f0-9-]+/i.test(url);     // Shared conversations
        };

        // Smart merge: prefer conversation URLs over base URLs
        const smartMergeUrls = (oldUrls, newUrls) => {
            const merged = { ...oldUrls };
            Object.keys(newUrls).forEach(key => {
                const newUrl = newUrls[key];
                const oldUrl = oldUrls[key];
                // If new URL is a conversation URL, always use it
                if (isConversationUrl(newUrl)) {
                    merged[key] = newUrl;
                }
                // If new URL is base URL but old URL is conversation URL, keep old
                else if (isConversationUrl(oldUrl) && !isConversationUrl(newUrl)) {
                    // Keep old conversation URL
                    console.log(`[Session] Preserving conversation URL for ${key}:`, oldUrl, 'over base:', newUrl);
                }
                // Otherwise use new URL
                else {
                    merged[key] = newUrl;
                }
            });
            return merged;
        };

        if (chatMode === 'single') {
            // Single AI Mode: collect instance URLs (prefer main process webContents for accuracy)
            let mainUrls = null;
            try {
                mainUrls = await window.electronAPI.getCurrentUrls?.();
                console.log('[Session Save] getCurrentUrls response:', JSON.stringify(mainUrls));
            } catch (e) { 
                console.error('[Session Save] getCurrentUrls failed:', e);
            }
            const map = (mainUrls && mainUrls.mode === 'single' && mainUrls.urls) ? mainUrls.urls : null;
            console.log('[Session Save] URL map for Single mode:', JSON.stringify(map));

            // IMPORTANT: do not rely on activeServiceKeys here (can be stale during app close).
            // Build instance keys from state to ensure we always attempt to save all active instances.
            const instanceKeys = (singleAiService ? Array.from({length: SINGLE_MODE_MAX_INSTANCES}, (_, i) => `${singleAiService}-${i}`) : []);
            instanceKeys.forEach((key, idx) => {
                if (!singleAiActiveInstances[idx]) return;
                const v = map && map[key] ? map[key] : null;
                if (v) {
                    urls[key] = v;
                    return;
                }
                const urlEl = document.getElementById(`url-text-${key}`);
                if (urlEl && urlEl.dataset && urlEl.dataset.url) {
                    urls[key] = urlEl.dataset.url;
                }
            });

            // Preserve previous URLs if this save is partial (prevents losing chatgpt-2/chatgpt-3)
            // IMPORTANT: filter by instanceKey only (avoid mixing multi keys like 'chatgpt'/'claude')
            // Use smart merge to prefer conversation URLs over base URLs
            const prevSingleUrls = filterInstanceUrlsForService(
                singleAiService,
                existingSession?.singleAiConfig?.urls || existingSession?.urls || {}
            );
            console.log('[Session Save] prevSingleUrls:', JSON.stringify(prevSingleUrls));
            console.log('[Session Save] urls before merge:', JSON.stringify(urls));
            urls = smartMergeUrls(prevSingleUrls, filterInstanceUrlsForService(singleAiService, urls));
            console.log('[Session Save] urls after smart merge:', JSON.stringify(urls));
            
            singleAiConfig = {
                service: singleAiService,
                activeInstances: [...singleAiActiveInstances],
                urls: urls
            };

            // Backwards compatibility field: keep only instance URLs in single mode
            // (avoid contaminating session.urls with multi keys)
            urls = singleAiConfig.urls;
        } else {
            // Multi AI Mode: collect service URLs
            activeServices = enforceMultiToggleLimit();

            let mainUrls = null;
            try {
                mainUrls = await window.electronAPI.getCurrentUrls?.();
            } catch (e) { /* ignore */ }
            const map = (mainUrls && mainUrls.mode === 'multi' && mainUrls.urls) ? mainUrls.urls : null;

            activeServices.forEach(service => {
                const v = map && map[service] ? map[service] : null;
                if (v) {
                    urls[service] = v;
                } else {
                    const urlEl = document.getElementById(`url-text-${service}`);
                    if (urlEl && urlEl.dataset && urlEl.dataset.url) {
                        urls[service] = urlEl.dataset.url;
                    }
                }
            });

            // Preserve previous URLs on partial updates (safe; activeServices already capped to 4)
            // Use smart merge to prefer conversation URLs over base URLs
            const prevMultiUrls = filterMultiUrls(existingSession?.multiAiConfig?.urls || existingSession?.urls || {});
            urls = smartMergeUrls(prevMultiUrls, filterMultiUrls(urls));
            
            multiAiConfig = {
                activeServices: activeServices,
                urls: urls
            };

            // Backwards compatibility field: keep only service URLs in multi mode
            urls = multiAiConfig.urls;
        }

        // Use existing title if available, otherwise generate from prompt or timestamp
        let title;
        if (existingSession && existingSession.title) {
            title = existingSession.title; // Preserve existing title (including renamed ones)
        } else {
            title = masterInput.value.trim().substring(0, 50) || `Chat ${new Date().toLocaleTimeString()}`;
        }

        const sessionData = {
            id: currentSessionId,
            title: title,
            layout: currentLayout,
            chatMode: chatMode,
            activeServices: activeServices, // For backwards compatibility
            singleAiConfig: singleAiConfig,
            multiAiConfig: multiAiConfig,
            prompt: masterInput.value,
            isAnonymousMode: isAnonymousMode,
            isScrollSyncEnabled: isScrollSyncEnabled,
            urls: urls, // For backwards compatibility
            createdAt: existingSession?.createdAt || new Date().toISOString(),
        };

        await historyManager.saveSession(sessionData);
        // Refresh list if open
        const sidebar = document.getElementById('history-sidebar');
        if (sidebar && sidebar.getAttribute('data-active-panel') === 'history') {
            // For background refreshes (e.g., toggles/auto-save), preserve scroll exactly.
            // Do not force scrollIntoView here, as it can nudge the history scroll position.
            loadHistoryList({ preserveScroll: true });
        }
    } catch (e) {
        console.error('Error saving session:', e);
    }
}

async function loadSession(session) {
    if (!session) return;

    closeSmcFullPanels();

    console.log('[History] Switching to session:', session.id, 'chatMode:', session.chatMode || 'multi');

    // Set loading flag to prevent URL change saves during transition
    isSessionLoading = true;

    // Save current session before switching (if different session)
    if (currentSessionId && currentSessionId !== session.id) {
        // Cancel any pending debounce timer to prevent race conditions
        if (urlChangeDebounceTimer) {
            clearTimeout(urlChangeDebounceTimer);
            urlChangeDebounceTimer = null;
        }
        // Synchronously save current session before switching
        await saveCurrentSession();
        console.log('[History] Saved previous session before switching');
    }

    // FIX: Reset maximized view state if active to prevent "black screen" on new session
    const maximizedBtns = document.querySelectorAll('.maximized-btn');
    if (maximizedBtns.length > 0) {
        maximizedBtns.forEach(btn => btn.click());
    }

    // Update currentSessionId and persist it ONLY if session.id is present
    if (session.id) {
        currentSessionId = session.id;
        localStorage.setItem(currentSessionIdKey, currentSessionId);
    }

    // Determine session chat mode (legacy sessions without chatMode are treated as Multi AI)
    const sessionChatMode = session.chatMode || 'multi';
    
    // Handle Chat Mode switching (REQ-MODE-060~066)
    if (sessionChatMode === 'single') {
        // Single AI Mode Session
        const singleConfig = session.singleAiConfig || {};
        const targetService = singleConfig.service;
        // Ensure max SINGLE_MODE_MAX_INSTANCES (migration from older 4-instance sessions)
        const rawInstances = singleConfig.activeInstances || [true, true, true];
        const targetInstances = rawInstances.slice(0, SINGLE_MODE_MAX_INSTANCES);
        const instanceUrls = singleConfig.urls || session.urls || {};
        
        if (targetService) {
            console.log(`[History] Restoring Single AI Mode: ${targetService}, instances:`, targetInstances, 'urls:', instanceUrls);
            
            // Switch to Single AI Mode via API with URLs for session restoration
            // This sets lastKnownInstanceUrls in main process to prevent stale URL issues
            const result = await window.electronAPI.setChatMode('single', {
                service: targetService,
                activeInstances: targetInstances,
                urls: instanceUrls  // Pass saved URLs to main process
            });
            
            if (result.success) {
                chatMode = 'single';
                singleAiService = targetService;
                singleAiActiveInstances = targetInstances;
                updateToggleUI();
                
                // Navigate instances to saved URLs after delay
                // NOTE: Single Mode instances are created with staggered delays in main to reduce bot-detection bursts.
                // Wait long enough so instances exist before sending navigate.
                setTimeout(() => {
                    Object.entries(instanceUrls).forEach(([instanceKey, url]) => {
                        if (url) {
                            console.log(`[History] Navigating ${instanceKey} to saved URL: ${url}`);
                            window.electronAPI.navigateInstance(instanceKey, url);
                        }
                    });
                    // Refresh URL bars after navigation requests (allow time for page load)
                    if (window.electronAPI.requestCurrentUrls) {
                        setTimeout(() => window.electronAPI.requestCurrentUrls(), 1000);
                        // Second refresh for slow-loading pages
                        setTimeout(() => window.electronAPI.requestCurrentUrls(), 3000);
                    }
                    isSessionLoading = false;
                }, 1400);
            } else {
                console.error('[History] Failed to switch to Single AI Mode:', result.error);
                isSessionLoading = false;
            }
        } else {
            console.error('[History] Single AI session missing service config');
            isSessionLoading = false;
        }
    } else {
        // Multi AI Mode Session (including legacy sessions)
        console.log('[History] Restoring Multi AI Mode session');
        
        // If currently in Single AI Mode, switch back to Multi AI
        if (chatMode === 'single') {
            const result = await window.electronAPI.setChatMode('multi');
            if (result.success) {
                chatMode = 'multi';
                singleAiService = null;
                updateToggleUI();
            }
        }
        
        // Pre-reset URLs
        const allServices = ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'genspark'];
        const storedUrls = session.urls || session.serviceUrls || session.multiAiConfig?.urls || {};
        allServices.forEach(service => {
            const urlEl = document.getElementById(`url-text-${service}`);
            if (urlEl) {
                const newUrl = storedUrls[service] || '';
                const displayUrl = newUrl.length > 80 ? newUrl.substring(0, 77) + '...' : newUrl;
                urlEl.textContent = displayUrl;
                urlEl.dataset.url = newUrl;
                urlEl.title = newUrl;
            }
        });

        // Restore Services (cap to 4 as per spec)
        const activeServices = clampMultiActiveServices(session.activeServices || session.multiAiConfig?.activeServices || []);
        if (activeServices.length > 0) {
            // First turn off all
            allServices.forEach(s => {
                if (toggles[s]) toggles[s].checked = false;
                window.electronAPI.toggleService(s, false);
            });

            // Then turn on saved
            activeServices.forEach(s => {
                if (toggles[s]) toggles[s].checked = true;
                window.electronAPI.toggleService(s, true);
            });
        }

        // Navigate webviews to saved URLs (with delay for service initialization)
        if (storedUrls && Object.keys(storedUrls).length > 0) {
            setTimeout(() => {
                Object.entries(storedUrls).forEach(([service, url]) => {
                    if (url && activeServices.includes(service)) {
                        console.log(`[History] Navigating ${service} to saved URL: ${url}`);
                        window.electronAPI.navigateToUrl(service, url);
                    }
                });
                isSessionLoading = false;
            }, 500);
        } else {
            isSessionLoading = false;
        }
    }

    resetAllGeminiIdleTimers();

    // Refresh history list to show updated active state (preserve scroll/loaded pages)
    loadHistoryList({ preserveScroll: true, ensureActiveVisible: true });

    // Restore Prompt
    if (session.prompt !== undefined) {
        masterInput.value = session.prompt;
        masterInput.dispatchEvent(new Event('input'));
    }

    // Restore Layout
    if (session.layout && layoutBtns[session.layout]) {
        setLayout(session.layout);
    }

    // Restore Anonymous Mode
    if (session.isAnonymousMode !== undefined && session.isAnonymousMode !== isAnonymousMode) {
        toggleAnonymousMode();
    }
    // Keep CPB in sync with current Anonymous state after session load
    window._cpb_isAnonymousMode = isAnonymousMode;

    // Restore Scroll Sync
    if (session.isScrollSyncEnabled !== undefined && session.isScrollSyncEnabled !== isScrollSyncEnabled) {
        const syncToggle = document.getElementById('scroll-sync-toggle');
        if (syncToggle) {
            syncToggle.checked = session.isScrollSyncEnabled;
            isScrollSyncEnabled = session.isScrollSyncEnabled;
            window.electronAPI.toggleScrollSync(session.isScrollSyncEnabled);
        }
    }

    updateLayoutState();
}

// Hook into Send Action to save session
// Save immediately for state, then again after delay for updated URLs
if (sendBtn) {
    sendBtn.addEventListener('click', () => {
        saveCurrentSession();
        // Save again after delay to capture URL changes
        setTimeout(() => saveCurrentSession(), 2000);
    });
}
// Keep autosave on Ctrl+Enter broadcast path.
if (masterInput) {
    masterInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
            saveCurrentSession();
            // Save again after delay to capture URL changes
            setTimeout(() => saveCurrentSession(), 2000);
        }
    });
}

// ==========================================
// Resize Handle Logic
// ==========================================
let initialControlsHeight = null; // Track initial height to use as minimum


// ==========================================
// Sidebar Resize Handle Logic
// ==========================================
function setupSidebarResizeHandle() {
    const handle = document.getElementById('sidebar-resize-handle');
    const sidebar = document.getElementById('history-sidebar');

    if (!handle || !sidebar) return;

    let startX, startWidth;

    handle.addEventListener('mousedown', initDrag);

    function initDrag(e) {
        startX = e.clientX;
        startWidth = sidebar.offsetWidth;
        document.documentElement.addEventListener('mousemove', doDrag, false);
        document.documentElement.addEventListener('mouseup', stopDrag, false);
        handle.classList.add('dragging');

        // Prevent iframe captures during drag
        const webviews = document.getElementById('views-placeholder');
        if (webviews) webviews.style.pointerEvents = 'none';
    }

    function doDrag(e) {
        const deltaX = e.clientX - startX;
        let newWidth = startWidth + deltaX;

        // Constraints
        const MIN_SIDEBAR_WIDTH = 150;
        const MAX_SIDEBAR_WIDTH = 400;

        if (newWidth < MIN_SIDEBAR_WIDTH) newWidth = MIN_SIDEBAR_WIDTH;
        if (newWidth > MAX_SIDEBAR_WIDTH) newWidth = MAX_SIDEBAR_WIDTH;

        sidebar.style.width = `${newWidth}px`;
    }

    function stopDrag(e) {
        document.documentElement.removeEventListener('mousemove', doDrag, false);
        document.documentElement.removeEventListener('mouseup', stopDrag, false);
        handle.classList.remove('dragging');

        const webviews = document.getElementById('views-placeholder');
        if (webviews) webviews.style.pointerEvents = '';

        // Update webview bounds after resize
        if (window.electronAPI && window.electronAPI.setBounds) {
            updateBounds();
        }
    }
}

// Initialize Sidebar Resize
setupSidebarResizeHandle();

function setupResizeHandle() {
    const handle = document.getElementById('prompt-resize-handle');
    const inputContainer = document.getElementById('controls-container');

    if (!handle || !inputContainer) return;

    // Capture initial height on first load (this is the "default" minimum)
    if (initialControlsHeight === null) {
        initialControlsHeight = inputContainer.offsetHeight;
    }

    let startY, startHeight;

    handle.addEventListener('mousedown', initDrag);

    function initDrag(e) {
        // If currently collapsed, expand first so input form becomes visible
        if (isPromptCollapsed) {
            setPromptCollapsed(false);
        }

        startY = e.clientY;
        startHeight = inputContainer.offsetHeight;
        document.documentElement.addEventListener('mousemove', doDrag, false);
        document.documentElement.addEventListener('mouseup', stopDrag, false);
        handle.classList.add('dragging');

        // Prevent iframe captures
        const webviews = document.getElementById('views-placeholder');
        if (webviews) webviews.style.pointerEvents = 'none';
    }

    function doDrag(e) {
        const deltaY = startY - e.clientY;
        const newHeight = startHeight + deltaY;

        // Do not allow shrinking below the launch-time default height.
        // This prevents toolbar controls from being clipped when dragging down.
        const defaultMinHeight = initialControlsHeight || 200;
        const minHeight = Math.max(200, defaultMinHeight);
        const maxHeight = window.innerHeight * 0.6;
        if (newHeight >= minHeight && newHeight < maxHeight) {
            inputContainer.style.height = `${newHeight}px`;
            userPreferredHeight = `${newHeight}px`;
        }
    }

    function stopDrag(e) {
        document.documentElement.removeEventListener('mousemove', doDrag, false);
        document.documentElement.removeEventListener('mouseup', stopDrag, false);
        handle.classList.remove('dragging');

        const webviews = document.getElementById('views-placeholder');
        if (webviews) webviews.style.pointerEvents = '';

        updateBounds();
    }
}

// ==========================================
// Rename Modal Logic
// ==========================================
let pendingRenameSession = null;

function showRenameModal(session) {
    pendingRenameSession = session;
    const modal = document.getElementById('rename-session-modal');
    const input = document.getElementById('rename-session-input');

    if (modal && input) {
        input.value = session.title || '';
        window.electronAPI.setServiceVisibility(false);
        modal.classList.add('visible');
        input.focus();
        input.select();

        // Handle Enter key in input
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                performRename();
            } else if (e.key === 'Escape') {
                closeRenameModal();
            }
        };
    }
}

function closeRenameModal() {
    const modal = document.getElementById('rename-session-modal');
    if (modal) {
        modal.classList.remove('visible');
    }
    pendingRenameSession = null;
    applySmcPreferredServiceVisibility();
}

async function performRename() {
    if (!pendingRenameSession) return;

    const input = document.getElementById('rename-session-input');
    const newTitle = input.value.trim();

    if (newTitle && newTitle !== pendingRenameSession.title) {
        pendingRenameSession.title = newTitle;
        pendingRenameSession.updatedAt = new Date().toISOString();

        try {
            await historyManager.saveSession(pendingRenameSession);
            loadHistoryList({ preserveScroll: true, ensureActiveVisible: true });
        } catch (e) {
            console.error('Failed to save rename:', e);
        }
    }

    closeRenameModal();
}

// Rename Modal Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-rename-session-btn');
    const cancelBtn = document.getElementById('btn-cancel-rename-session');
    const saveBtn = document.getElementById('btn-save-rename-session');

    if (closeBtn) closeBtn.onclick = closeRenameModal;
    if (cancelBtn) cancelBtn.onclick = closeRenameModal;
    if (saveBtn) saveBtn.onclick = performRename;
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupHistory();
    setupResizeHandle();
    setupSessionPersistence();
});

window.addEventListener('beforeunload', saveHistoryScrollState);

// Ensure we persist the latest session URLs on app close (main will wait briefly via app-will-close handshake).
if (window.electronAPI.onAppWillClose) {
    window.electronAPI.onAppWillClose(async () => {
        try {
            // Force one last save with URLs fetched from main webContents
            await saveCurrentSession();
        } catch (e) {
            console.error('[Session] Final saveCurrentSession failed:', e);
        } finally {
            try {
                await window.electronAPI.appCloseReady?.();
            } catch (e) { /* ignore */ }
        }
    });
}

function setupSessionPersistence() {
    // 1. Listen for Apply Saved State from Main Process (Startup)
    if (window.electronAPI.onApplySavedState) {
        window.electronAPI.onApplySavedState((state) => {
            console.log('[Session] Applying saved state from Main:', state);
            if (state) {
                // Set flag to prevent setupHistory from overwriting
                hasAppliedMainState = true;
                
                // Restore Chat Mode state first
                const savedChatMode = state.chatMode || 'multi';
                console.log('[Session] Restoring chat mode:', savedChatMode);
                
                if (savedChatMode === 'single' && state.singleAiConfig) {
                    // Restore Single AI Mode
                    chatMode = 'single';
                    singleAiService = state.singleAiConfig.service;
                    // Ensure max 3 instances (migration from older 4-instance sessions)
                    const restoredInstances = state.singleAiConfig.activeInstances || [true, true, true];
                    singleAiActiveInstances = restoredInstances.slice(0, SINGLE_MODE_MAX_INSTANCES);
                    
                    console.log('[Session] Restored Single AI Mode:', singleAiService, singleAiActiveInstances);
                    
                    // Update UI for Single AI Mode
                    updateToggleUI();
                    
                    // Construct a pseudo-session object for Single AI Mode
                    const restorationSession = {
                        id: currentSessionId || localStorage.getItem(currentSessionIdKey),
                        chatMode: 'single',
                        singleAiConfig: state.singleAiConfig,
                        layout: state.layout,
                        isAnonymousMode: state.isAnonymousMode,
                        isScrollSyncEnabled: state.isScrollSyncEnabled
                    };
                    
                    loadSession(restorationSession);
                } else {
                    // Restore Multi AI Mode
                    chatMode = 'multi';
                    singleAiService = null;
                    
                    // Update UI for Multi AI Mode
                    updateToggleUI();
                    
                    // Construct a pseudo-session object for Multi AI Mode
                    const restorationSession = {
                        id: currentSessionId || localStorage.getItem(currentSessionIdKey),
                        chatMode: 'multi',
                        activeServices: clampMultiActiveServices(state.activeServices || []),
                        layout: state.layout,
                        urls: state.serviceUrls,
                        isAnonymousMode: state.isAnonymousMode,
                        isScrollSyncEnabled: state.isScrollSyncEnabled
                    };
                    
                    loadSession(restorationSession);
                }
            }
        });
    }

    // 2. Listen for Toggle Changes to Save Session
    // This ensures that when user toggles Genspark (or others), it saves to IndexedDB/History
    for (const [service, toggle] of Object.entries(toggles)) {
        if (toggle) {
            toggle.addEventListener('change', () => {
                if (isAnyViewMaximized()) {
                    toggle.checked = activeServiceKeys.includes(service);
                    return;
                }
                // Update layout first (existing logic might be attached, but we ensure it runs)
                updateLayoutState();
                window.electronAPI.toggleService(service, toggle.checked);

                // Save session state
                saveCurrentSession();
            });
        }
    }
}

