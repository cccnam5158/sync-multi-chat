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

// Handle New Chat Button Click
newChatBtn.addEventListener('click', async () => {
    // Save current session first (if there is one)
    if (currentSessionId) {
        await saveCurrentSession();
    }

    // Collect current URLs BEFORE resetting webviews
    const activeServices = Object.entries(toggles).filter(([_, t]) => t.checked).map(([k]) => k);
    const currentUrls = {};
    activeServices.forEach(service => {
        const urlEl = document.getElementById(`url-text-${service}`);
        if (urlEl && urlEl.dataset && urlEl.dataset.url) {
            currentUrls[service] = urlEl.dataset.url;
        }
    });

    // Generate new session ID and create new history entry
    currentSessionId = generateId();
    const newSessionData = {
        id: currentSessionId,
        title: `Chat ${new Date().toLocaleTimeString()}`,
        layout: currentLayout,
        activeServices: activeServices,
        prompt: '',
        isAnonymousMode: isAnonymousMode,
        isScrollSyncEnabled: isScrollSyncEnabled,
        urls: currentUrls, // Save current URLs (base chat URLs)
        createdAt: new Date().toISOString(),
    };

    // Save new session to history
    await historyManager.saveSession(newSessionData);

    // Persist new session ID to localStorage
    localStorage.setItem(currentSessionIdKey, currentSessionId);

    // Refresh history list to show new active chat
    loadHistoryList();

    // Notify main process to reset webviews (navigates to base URLs)
    window.electronAPI.newChat();
});

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

const crossCheckBtn = document.getElementById('cross-check-btn');
crossCheckBtn.addEventListener('click', () => {
    openCrossCheckModal();
});

const anonymousBtn = document.getElementById('anonymous-btn');
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

    updateServiceToggles();

    // Report state change to main process for session persistence (SESS-002)
    if (typeof reportCurrentUIState === 'function') {
        reportCurrentUIState();
    }
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

// Handle Send Button Click
sendBtn.addEventListener('click', () => {
    sendPrompt();
});

// Handle Enter Key (Ctrl+Enter to send)
masterInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            // Ctrl+Shift+Enter: New Chat
            e.preventDefault();
            window.electronAPI.newChat();
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl+Enter: Send Prompt
            e.preventDefault();
            sendPrompt();
        }
    }
});

let pendingConfirmation = false;

// Modal Logic
function showModal(message, duration = 3000) {
    let modal = document.getElementById('confirmation-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirmation-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-text"></div>
                <div class="modal-timer"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const textEl = modal.querySelector('.modal-text');
    const timerEl = modal.querySelector('.modal-timer');

    textEl.textContent = message;
    modal.classList.add('visible');

    let timeLeft = duration / 1000;
    timerEl.textContent = timeLeft;

    const interval = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            timerEl.textContent = timeLeft;
        } else {
            clearInterval(interval);
            modal.classList.remove('visible');
            // Enable inputs and set placeholder for confirmation
            setInputsEnabled(true);
            masterInput.placeholder = "Press Ctrl+Enter to confirm send...";
            masterInput.focus();
        }
    }, 1000);
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
        showModal("파일 업로드 완료 확인 후, Ctrl + Enter를 입력하여 진행해주세요.", 3000);
    });
}

async function sendPrompt() {
    console.log('sendPrompt called. pendingConfirmation:', pendingConfirmation);

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
        masterInput.placeholder = "Type your prompt here... (Ctrl+Enter to Send, Ctrl+Shift+Enter for New Chat)";
        masterInput.focus();
        return;
    }

    const text = masterInput.value.trim();
    console.log('Sending prompt. Text length:', text.length, 'Files:', attachedFiles.length);

    if (!text && attachedFiles.length === 0) {
        console.log('No text and no files, ignoring.');
        return;
    }

    const activeServices = {
        chatgpt: toggles.chatgpt.checked,
        claude: toggles.claude.checked,
        gemini: toggles.gemini.checked,
        grok: toggles.grok.checked,
        perplexity: toggles.perplexity.checked,
        genspark: toggles.genspark.checked
    };

    // Get file paths
    const filePaths = attachedFiles.map(f => f.path);

    // If files are attached, we enter "upload only" mode first
    window.electronAPI.sendPrompt(text, activeServices, filePaths);

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
        masterInput.placeholder = "Type your prompt here... (Ctrl+Enter to Send, Ctrl+Shift+Enter for New Chat)";
        masterInput.focus();
    }
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
            const lineCount = textContent.split('\n').length;
            const MULTI_LINE_THRESHOLD = 200; // Convert to file if 200+ lines

            // If text has many lines, convert to file
            if (lineCount >= MULTI_LINE_THRESHOLD) {
                e.preventDefault(); // Prevent default paste

                const timestamp = Date.now();
                const fileName = `paste-${timestamp}.txt`;

                // Convert text to buffer
                const encoder = new TextEncoder();
                const buffer = encoder.encode(textContent);

                try {
                    const filePath = await window.electronAPI.saveTempFile(Array.from(buffer), fileName);
                    attachedFiles.push({ name: fileName, path: filePath });
                    renderFilePreview();
                    console.log(`Multi-line text (${lineCount} lines) converted to file: ${fileName}`);
                } catch (err) {
                    console.error('Failed to save pasted text as file:', err);
                    // Fallback: insert text into textarea anyway
                    masterInput.value += textContent;
                }
            }
            // If text is short (< 5 lines), let browser handle normal paste
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
    // 1. Determine active services
    const activeToggles = Object.entries(toggles).filter(([_, t]) => t.checked);
    const activeCount = activeToggles.length;
    activeServiceKeys = activeToggles.map(([k]) => k);

    // 2. Constraint: Max 4 services - disable UNCHECKED toggles only
    if (activeCount >= 4) {
        for (const toggle of Object.values(toggles)) {
            // Only disable unchecked toggles, never disable checked ones
            toggle.disabled = !toggle.checked;
        }
    } else {
        for (const toggle of Object.values(toggles)) {
            toggle.disabled = false;
        }
    }

    // 3. Layout Buttons Logic (LAYOUT-002-1)
    // Disable all layout buttons when fewer than 3 services are active
    if (activeCount < 3) {
        // < 3 services: Disable all layout buttons
        Object.values(layoutBtns).forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
        });
        // Don't change current layout, just let it use whatever is current
    } else if (activeCount === 3) {
        // 3 services: Enable 1x3 and 3x1, disable others
        layoutBtns['1x3'].disabled = false;
        layoutBtns['1x3'].classList.remove('disabled');
        layoutBtns['3x1'].disabled = false;
        layoutBtns['3x1'].classList.remove('disabled');
        layoutBtns['1x4'].disabled = true;
        layoutBtns['1x4'].classList.add('disabled');
        layoutBtns['2x2'].disabled = true;
        layoutBtns['2x2'].classList.add('disabled');
        // If current layout is not valid for 3 services, switch to 1x3
        if (currentLayout === '1x4' || currentLayout === '2x2') {
            setLayout('1x3');
        }
    } else {
        // >= 4 services: Enable 1x4 and 2x2, disable 1x3 and 3x1
        layoutBtns['1x3'].disabled = true;
        layoutBtns['1x3'].classList.add('disabled');
        layoutBtns['3x1'].disabled = true;
        layoutBtns['3x1'].classList.add('disabled');
        layoutBtns['1x4'].disabled = false;
        layoutBtns['1x4'].classList.remove('disabled');
        layoutBtns['2x2'].disabled = false;
        layoutBtns['2x2'].classList.remove('disabled');
        // If current layout is not valid for 4 services, switch to 1x4
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

function createSlot(container, service) {
    const slot = document.createElement('div');
    slot.className = 'view-slot';
    slot.id = `slot-${service}`;
    slot.style.flex = '1';

    // Create header bar above BrowserView
    const header = document.createElement('div');
    header.className = 'view-header';

    // Left side: service name with proper display name
    const serviceNames = {
        'chatgpt': 'ChatGPT',
        'claude': 'Claude',
        'gemini': 'Gemini',
        'grok': 'Grok',
        'perplexity': 'Perplexity',
        'genspark': 'Genspark'
    };
    const baseDisplayName = serviceNames[service] || service;
    const name = baseDisplayName;
    const icon = SERVICE_ICONS[service] || '';

    const serviceName = document.createElement('span');
    serviceName.className = 'service-name';

    let headerContent = `<span class="service-icon-wrapper header-icon">${icon}</span> ${name}`;
    if (isAnonymousMode && SERVICE_ALIASES[service]) {
        headerContent += ` <span class="service-alias">${SERVICE_ALIASES[service]}</span>`;
    }
    serviceName.innerHTML = headerContent;

    // Header only contains service name (buttons moved to URL bar)
    header.appendChild(serviceName);

    // Header Buttons Container (Restored for Maximize button)
    const headerBtns = document.createElement('div');
    headerBtns.className = 'header-buttons';

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
        toggleMaximize(service, maxBtn, maxIcon, restoreIcon);
    });

    headerBtns.appendChild(maxBtn);
    header.appendChild(headerBtns);

    slot.appendChild(header);

    // Create URL bar below header (URLBAR-001)
    const urlBar = document.createElement('div');
    urlBar.className = 'url-bar';
    urlBar.id = `url-bar-${service}`;

    // URL text display (URLBAR-002)
    const urlText = document.createElement('span');
    urlText.className = 'url-text';
    urlText.id = `url-text-${service}`;
    urlText.textContent = 'Loading...';

    // URL bar buttons container
    const urlBtnsContainer = document.createElement('div');
    urlBtnsContainer.className = 'url-bar-buttons';

    // Reload button - SVG refresh icon with spin animation
    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'url-bar-btn';
    const reloadSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    reloadBtn.innerHTML = reloadSvg;
    reloadBtn.title = 'Reload';
    reloadBtn.addEventListener('click', () => {
        reloadBtn.classList.add('spinning');
        setTimeout(() => reloadBtn.classList.remove('spinning'), 500);
        window.electronAPI.reloadService(service);
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
        window.electronAPI.copySingleChatThread(service, { format, anonymousMode: isAnonymousMode });
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

    // Order: Reload, Copy URL, Copy Chat, Open in browser
    urlBtnsContainer.appendChild(reloadBtn);
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

function updateBounds() {
    const HEADER_HEIGHT = 32; // Height for header bar with buttons
    const URL_BAR_HEIGHT = 32; // Height for URL bar (URLBAR-001) - same as header
    const TOTAL_TOP_HEIGHT = HEADER_HEIGHT + URL_BAR_HEIGHT;
    const bounds = {};
    activeServiceKeys.forEach(service => {
        const slot = document.getElementById(`slot-${service}`);
        if (slot) {
            const rect = slot.getBoundingClientRect();
            // BrowserView starts below header bar and URL bar
            bounds[service] = {
                x: Math.round(rect.x),
                y: Math.round(rect.y) + TOTAL_TOP_HEIGHT,
                width: Math.round(rect.width),
                height: Math.round(rect.height) - TOTAL_TOP_HEIGHT
            };
        }
    });

    window.electronAPI.updateViewBounds(bounds);
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
        setLayout(layout);
    });
});

for (const [service, toggle] of Object.entries(toggles)) {
    toggle.addEventListener('change', (e) => {
        window.electronAPI.toggleService(service, e.target.checked);
        updateLayoutState();
    });
}

// URL Bar: Listen for URL changes from main process (URLBAR-003)
// Also save session on URL changes for history persistence
let urlChangeDebounceTimer = null;
let isSessionLoading = false; // Flag to prevent URL saves during session loading

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
const closeCrossCheckBtn = document.getElementById('close-cross-check-btn');
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
const promptDeleteModal = document.getElementById('prompt-delete-modal');
const promptDeleteName = document.getElementById('prompt-delete-name');
const btnConfirmDeletePrompt = document.getElementById('btn-confirm-delete-prompt');
const btnCancelDeletePrompt = document.getElementById('btn-cancel-delete-prompt');
const btnClosePromptDelete = document.getElementById('close-prompt-delete-btn');

// Predefined Prompt Edit Elements
const predefinedPromptEditView = document.getElementById('predefined-prompt-edit-view');
const btnEditPredefined = document.getElementById('edit-predefined-btn');
const predefinedPromptInput = document.getElementById('predefined-prompt-input');
const btnCancelPredefined = document.getElementById('btn-cancel-predefined');
const btnSavePredefined = document.getElementById('btn-save-predefined');
const predefinedPromptPreviewText = document.getElementById('predefined-prompt-preview-text');
const btnBackToOptionsPredefined = document.getElementById('back-to-options-predefined-btn');
const btnClosePredefinedEdit = document.getElementById('close-predefined-edit-btn');

let customPrompts = [];
let currentSort = {
    column: 'lastUsedAt',
    direction: 'desc' // 'asc' or 'desc'
};
let pendingDeletePromptIndex = null;

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

function updatePredefinedPromptPreview() {
    if (predefinedPromptPreviewText) {
        predefinedPromptPreviewText.textContent = `"${currentPredefinedPrompt}"`;
    }
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
    crossCheckModal.classList.remove('visible');
    // Show services again
    window.electronAPI.setServiceVisibility(true);
}

function showOptionsView() {
    crossCheckOptions.classList.remove('hidden');
    customPromptView.classList.add('hidden');
    if (predefinedPromptEditView) predefinedPromptEditView.classList.add('hidden');

    // Reset inputs
    resetCustomPromptForm();
}

function showCustomPromptView() {
    crossCheckOptions.classList.add('hidden');
    customPromptView.classList.remove('hidden');
    renderSavedPrompts();
    customPromptInput.focus();
    updateSendButtonState();
}

function showPredefinedEditView() {
    crossCheckOptions.classList.add('hidden');
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
    if (!promptDeleteModal) {
        performPromptDeletion(index);
        return;
    }

    pendingDeletePromptIndex = index;
    const prompt = customPrompts[index];
    if (promptDeleteName) {
        promptDeleteName.textContent = prompt?.title || 'this prompt';
    }
    promptDeleteModal.classList.add('visible');
    forceEnableCustomPromptInputs();
}

function closePromptDeleteModal() {
    pendingDeletePromptIndex = null;
    if (promptDeleteModal) {
        promptDeleteModal.classList.remove('visible');
    }
    forceEnableCustomPromptInputs();
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
closeCrossCheckBtn.addEventListener('click', closeCrossCheckModal);
crossCheckModal.addEventListener('click', (e) => {
    if (e.target === crossCheckModal) closeCrossCheckModal();
});

btnCompareResponses.addEventListener('click', (e) => {
    // If clicked on edit button, don't trigger compare
    if (e.target.closest('.edit-icon-container')) return;

    window.electronAPI.crossCheck(isAnonymousMode, currentPredefinedPrompt);
    closeCrossCheckModal();
});

if (btnEditPredefined) {
    btnEditPredefined.addEventListener('click', (e) => {
        e.stopPropagation();
        showPredefinedEditView();
    });
}

if (btnCancelPredefined) {
    btnCancelPredefined.addEventListener('click', showOptionsView);
}

if (btnBackToOptionsPredefined) {
    btnBackToOptionsPredefined.addEventListener('click', showOptionsView);
}

if (btnClosePredefinedEdit) {
    btnClosePredefinedEdit.addEventListener('click', showOptionsView);
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

btnCustomPrompt.addEventListener('click', showCustomPromptView);
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

if (btnCancelDeletePrompt) {
    btnCancelDeletePrompt.addEventListener('click', () => {
        closePromptDeleteModal();
        updateSendButtonState();
    });
}

if (btnClosePromptDelete) {
    btnClosePromptDelete.addEventListener('click', () => {
        closePromptDeleteModal();
        updateSendButtonState();
    });
}

if (btnConfirmDeletePrompt) {
    btnConfirmDeletePrompt.addEventListener('click', () => {
        if (pendingDeletePromptIndex === null) return;
        performPromptDeletion(pendingDeletePromptIndex);
        closePromptDeleteModal();
    });
}

if (promptDeleteModal) {
    promptDeleteModal.addEventListener('click', (e) => {
        if (e.target === promptDeleteModal) {
            closePromptDeleteModal();
            updateSendButtonState();
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initial state setup on load
window.addEventListener('DOMContentLoaded', () => {
    // Perplexity should start checked, Grok unchecked
    const initialActiveServices = {
        chatgpt: toggles.chatgpt.checked,
        claude: toggles.claude.checked,
        gemini: toggles.gemini.checked,
        grok: toggles.grok.checked,
        perplexity: toggles.perplexity.checked
    };

    // Notify main process of initial state
    Object.keys(initialActiveServices).forEach(service => {
        if (!initialActiveServices[service]) {
            window.electronAPI.toggleService(service, false);
        } else {
            window.electronAPI.toggleService(service, true);
        }
    });

    // Update layout state based on initial toggles
    updateLayoutState();
    updateServiceToggles();
});

// Session Persistence: Listen for saved state restoration (SESS-003)
if (window.electronAPI.onApplySavedState) {
    window.electronAPI.onApplySavedState((savedState) => {
        console.log('[Session] Applying saved state:', savedState);

        // Restore active services (toggles)
        if (savedState.activeServices && Array.isArray(savedState.activeServices)) {
            const allServices = ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity'];
            allServices.forEach(service => {
                const shouldBeActive = savedState.activeServices.includes(service);
                if (toggles[service]) {
                    toggles[service].checked = shouldBeActive;
                    window.electronAPI.toggleService(service, shouldBeActive);
                }
            });
        }

        // Restore layout
        if (savedState.layout && layoutBtns[savedState.layout]) {
            setLayout(savedState.layout);
        }

        // Restore anonymous mode
        if (savedState.isAnonymousMode && !isAnonymousMode) {
            toggleAnonymousMode();
        } else {
            // Even if not toggling, update header names to match current state
            updateServiceToggles();
        }

        // Restore scroll sync
        if (savedState.isScrollSyncEnabled && scrollSyncToggle) {
            scrollSyncToggle.checked = true;
            isScrollSyncEnabled = true;
            window.electronAPI.toggleScrollSync(true);
        }

        // Update layout after restoring state
        updateLayoutState();
    });
}

// Report UI state changes to main process for persistence
function reportCurrentUIState() {
    if (window.electronAPI.reportUiState) {
        const activeServices = Object.entries(toggles)
            .filter(([_, toggle]) => toggle.checked)
            .map(([service, _]) => service);

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
        } else {
            viewsPlaceholder.classList.remove('has-maximized-view');
            btn.innerHTML = maxIcon;
            btn.title = 'Maximize';
            btn.classList.remove('maximized-btn');
            // Auto expand prompt input when restored
            setPromptCollapsed(false);
        }

        // Send updated bounds to main process
        updateBounds();
    }
}


// ==========================================
// History & Sidebar Logic
// ==========================================
const historySidebar = document.getElementById('history-sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const historySelectModeBtn = document.getElementById('history-select-mode-btn');
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

let isHistorySelectionMode = false;
const selectedHistorySessionIds = new Set();
let pendingBulkDeleteIds = [];

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

function setHistorySelectionMode(enabled) {
    isHistorySelectionMode = !!enabled;
    if (!isHistorySelectionMode) {
        selectedHistorySessionIds.clear();
    }
    updateHistorySelectionUI();
    // Re-render items to switch interaction mode & show/hide checkboxes
    loadHistoryList({ preserveScroll: true });
}

function updateHistorySelectionUI() {
    const selectedCount = selectedHistorySessionIds.size;

    if (historyBulkActions) {
        historyBulkActions.classList.toggle('hidden', !isHistorySelectionMode);
    }
    if (clearHistoryBtn) {
        clearHistoryBtn.classList.toggle('hidden', isHistorySelectionMode);
    }
    if (historySelectedCountEl) {
        historySelectedCountEl.textContent = String(selectedCount);
    }
    if (historyBulkDeleteBtn) {
        historyBulkDeleteBtn.disabled = selectedCount === 0;
    }
    if (historySelectModeBtn) {
        historySelectModeBtn.title = isHistorySelectionMode ? 'Cancel selection' : 'Select multiple';
        historySelectModeBtn.classList.toggle('active', isHistorySelectionMode);
    }
}

function toggleHistorySelection(sessionId) {
    if (!sessionId) return;
    if (selectedHistorySessionIds.has(sessionId)) {
        selectedHistorySessionIds.delete(sessionId);
    } else {
        selectedHistorySessionIds.add(sessionId);
    }
    updateHistorySelectionUI();
}

function clearHistorySelection() {
    selectedHistorySessionIds.clear();
    updateHistorySelectionUI();
    // Keep selection mode, but update styles
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
    const modal = document.getElementById('history-bulk-delete-modal');
    const countEl = document.getElementById('history-bulk-delete-count');
    if (!modal || !countEl) return;

    pendingBulkDeleteIds = Array.from(new Set(ids)).filter(Boolean);
    countEl.textContent = String(pendingBulkDeleteIds.length);

    window.electronAPI.setServiceVisibility(false);
    modal.classList.add('visible');
}

function closeHistoryBulkDeleteModal() {
    const modal = document.getElementById('history-bulk-delete-modal');
    if (modal) modal.classList.remove('visible');
    pendingBulkDeleteIds = [];
    window.electronAPI.setServiceVisibility(true);
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

        // Exit selection mode after bulk delete
        setHistorySelectionMode(false);
        loadHistoryList({ preserveScroll: true, ensureActiveVisible: true });
    } catch (e) {
        console.error('Failed to bulk delete sessions:', e);
    }
}

async function setupHistory() {
    try {
        await historyManager.init();

        if (!historySidebar || !sidebarToggleBtn) return;

        // Toggle Sidebar - NOW toggles the 'collapsed' class instead of hiding/showing separate buttons
        sidebarToggleBtn.addEventListener('click', () => {
            historySidebar.classList.toggle('collapsed');
            // Adjust icon based on state if desired, but hamburger is fine for both
            if (historySidebar.classList.contains('collapsed')) {
                saveHistoryScrollState();
            } else {
                restoreHistoryScrollAfterExpand();
            }
        });

        if (historySelectModeBtn) {
            historySelectModeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setHistorySelectionMode(!isHistorySelectionMode);
            });
        }

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
                setHistorySelectionMode(false);
            });
        }
        if (historyBulkDeleteBtn) {
            historyBulkDeleteBtn.addEventListener('click', () => {
                showHistoryBulkDeleteModal(Array.from(selectedHistorySessionIds));
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isHistorySelectionMode) {
                setHistorySelectionMode(false);
            }
        });

        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                showClearAllModal();
            });
        }

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
        const queryOffset = append ? historyOffset : 0;
        const baseLimit = Math.max(HISTORY_PAGE_SIZE, restoreSavedScroll?.offset || historyOffset || 0);
        const queryLimit = append ? HISTORY_PAGE_SIZE : baseLimit;
        const sessions = await historyManager.getSessions(queryLimit, queryOffset);

        // Empty state
        if (!append && sessions.length === 0) {
            listContainer.innerHTML = '<div style="padding:10px; text-align:center; color:#666;">No history yet</div>';
            historyHasMore = false;
            historyLoading = false;
            return;
        }

        sessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.dataset.sessionId = session.id;

            if (session.id === currentSessionId) {
                item.classList.add('active');
            }
            if (isHistorySelectionMode) {
                item.classList.add('selection-mode');
            }
            if (selectedHistorySessionIds.has(session.id)) {
                item.classList.add('selected');
            }

            const title = session.title || 'Untitled Session';
            const createdAtStr = session.createdAt ? new Date(session.createdAt).toLocaleString() : 'Unknown';
            const updatedAtStr = session.updatedAt ? new Date(session.updatedAt).toLocaleString() : 'Unknown';

            // Tooltip with full info
            const tooltip = `title: ${title}\ncreatedAt: ${createdAtStr}\nupdatedAt: ${updatedAtStr}`;

            if (isHistorySelectionMode) {
                item.innerHTML = `
                    <div class="history-select">
                        <input class="history-item-checkbox" type="checkbox" ${selectedHistorySessionIds.has(session.id) ? 'checked' : ''} />
                        <div class="history-item-content" title="${tooltip.replace(/"/g, '&quot;')}">
                            <div class="history-title">${title}</div>
                            <div class="history-date">${createdAtStr}</div>
                        </div>
                    </div>
                `;

                const checkbox = item.querySelector('.history-item-checkbox');
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleHistorySelection(session.id);
                    syncHistorySelectionStyles();
                });

                item.onclick = () => {
                    toggleHistorySelection(session.id);
                    syncHistorySelectionStyles();
                };
            } else {
                item.innerHTML = `
                    <div class="history-item-content" title="${tooltip.replace(/"/g, '&quot;')}">
                        <div class="history-title">${title}</div>
                        <div class="history-date">${createdAtStr}</div>
                    </div>
                    <div class="history-actions">
                         <button class="history-btn-mini context-menu-btn" title="Options">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                         </button>
                    </div>
                `;

                // Click to load
                item.onclick = (e) => {
                    if (e.target.closest('.history-actions')) return;
                    loadSession(session);
                };

                // Context Menu Logic
                const menuBtn = item.querySelector('.context-menu-btn');
                menuBtn.onclick = (e) => {
                    e.stopPropagation();
                    showCustomContextMenu(e, session);
                };
            }

            listContainer.appendChild(item);
        });

        updateHistorySelectionUI();

        historyOffset = queryOffset + sessions.length;
        historyHasMore = sessions.length >= queryLimit;

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

// History Delete Modal Handler
let pendingDeleteSession = null;

function showHistoryDeleteModal(session) {
    const modal = document.getElementById('history-delete-modal');
    const nameEl = document.getElementById('history-delete-name');

    if (!modal) {
        // Fallback if modal doesn't exist
        if (confirm(`Delete session "${session.title}"?`)) {
            performHistoryDelete(session);
        }
        return;
    }

    pendingDeleteSession = session;
    if (nameEl) {
        nameEl.textContent = session.title || 'Untitled Session';
    }

    // Hide webviews so modal is visible
    window.electronAPI.setServiceVisibility(false);
    modal.classList.add('visible');

    // Add ESC key handler
    document.addEventListener('keydown', handleHistoryModalEsc);
}

function handleHistoryModalEsc(e) {
    if (e.key === 'Escape') {
        closeHistoryDeleteModal();
    }
}

function closeHistoryDeleteModal() {
    const modal = document.getElementById('history-delete-modal');
    if (modal) {
        modal.classList.remove('visible');
    }
    pendingDeleteSession = null;

    // Show webviews again
    window.electronAPI.setServiceVisibility(true);

    // Remove ESC handler
    document.removeEventListener('keydown', handleHistoryModalEsc);
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
        }

    loadHistoryList({ preserveScroll: true, ensureActiveVisible: true });
    } catch (err) {
        console.error('Failed to delete session:', err);
    }
}

// Setup History Delete Modal Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-history-delete-btn');
    const cancelBtn = document.getElementById('btn-cancel-history-delete');
    const confirmBtn = document.getElementById('btn-confirm-history-delete');

    if (closeBtn) closeBtn.onclick = closeHistoryDeleteModal;
    if (cancelBtn) cancelBtn.onclick = closeHistoryDeleteModal;
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            if (pendingDeleteSession) {
                await performHistoryDelete(pendingDeleteSession);
                closeHistoryDeleteModal();
            }
        };
    }

    // Bulk Delete Modal Event Listeners
    const closeBulkBtn = document.getElementById('close-history-bulk-delete-btn');
    const cancelBulkBtn = document.getElementById('btn-cancel-history-bulk-delete');
    const confirmBulkBtn = document.getElementById('btn-confirm-history-bulk-delete');

    if (closeBulkBtn) closeBulkBtn.onclick = closeHistoryBulkDeleteModal;
    if (cancelBulkBtn) cancelBulkBtn.onclick = closeHistoryBulkDeleteModal;
    if (confirmBulkBtn) {
        confirmBulkBtn.onclick = async () => {
            const ids = pendingBulkDeleteIds;
            closeHistoryBulkDeleteModal();
            await performHistoryBulkDelete(ids);
        };
    }

    // Clear All Modal Event Listeners
    const closeClearAllBtn = document.getElementById('close-clear-all-btn');
    const cancelClearAllBtn = document.getElementById('btn-cancel-clear-all');
    const confirmClearAllBtn = document.getElementById('btn-confirm-clear-all');

    if (closeClearAllBtn) closeClearAllBtn.onclick = closeClearAllModal;
    if (cancelClearAllBtn) cancelClearAllBtn.onclick = closeClearAllModal;
    if (confirmClearAllBtn) {
        confirmClearAllBtn.onclick = async () => {
            await performClearAll();
            closeClearAllModal();
        };
    }
});

// Clear All Modal Handler
function showClearAllModal() {
    const modal = document.getElementById('history-clear-all-modal');
    if (!modal) {
        // Fallback if modal doesn't exist
        if (confirm('Are you sure you want to delete all chat history? This cannot be undone.')) {
            performClearAll();
        }
        return;
    }

    // Hide webviews so modal is visible
    window.electronAPI.setServiceVisibility(false);
    modal.classList.add('visible');

    // Add ESC key handler
    document.addEventListener('keydown', handleClearAllModalEsc);
}

function handleClearAllModalEsc(e) {
    if (e.key === 'Escape') {
        closeClearAllModal();
    }
}

function closeClearAllModal() {
    const modal = document.getElementById('history-clear-all-modal');
    if (modal) {
        modal.classList.remove('visible');
    }

    // Show webviews again
    window.electronAPI.setServiceVisibility(true);

    // Remove ESC handler
    document.removeEventListener('keydown', handleClearAllModalEsc);
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

        // Gather state
        const activeServices = Object.entries(toggles)
            .filter(([_, toggle]) => toggle.checked)
            .map(([service, _]) => service);

        // Collect current URLs from url-text elements (populated by onWebviewUrlChanged)
        const urls = {};
        activeServices.forEach(service => {
            const urlEl = document.getElementById(`url-text-${service}`);
            if (urlEl && urlEl.dataset && urlEl.dataset.url) {
                urls[service] = urlEl.dataset.url;
            }
        });

        // Check if session already exists to preserve its title
        let existingSession = null;
        try {
            existingSession = await historyManager.getSession(currentSessionId);
        } catch (e) {
            // Session doesn't exist yet, that's fine
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
            activeServices: activeServices,
            prompt: masterInput.value,
            isAnonymousMode: isAnonymousMode,
            isScrollSyncEnabled: isScrollSyncEnabled,
            urls: urls,
            createdAt: existingSession?.createdAt || new Date().toISOString(),
        };

        await historyManager.saveSession(sessionData);
        // Refresh list if open
        const sidebar = document.getElementById('history-sidebar');
        if (sidebar && !sidebar.classList.contains('collapsed')) {
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

    console.log('[History] Switching to session:', session.id);

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

    // FIX: Pre-reset URLs to prevent stale data from overwriting new session
    const allServices = ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'genspark'];
    allServices.forEach(service => {
        const urlEl = document.getElementById(`url-text-${service}`);
        if (urlEl) {
            // Pre-fill with new session URL or clear
            const storedUrls = session.urls || session.serviceUrls || {};
            const newUrl = storedUrls[service] || '';
            const displayUrl = newUrl.length > 80 ? newUrl.substring(0, 77) + '...' : newUrl;

            urlEl.textContent = displayUrl;
            urlEl.dataset.url = newUrl;
            urlEl.title = newUrl;
        }
    });

    // Update currentSessionId and persist it ONLY if session.id is present
    if (session.id) {
        currentSessionId = session.id;
        localStorage.setItem(currentSessionIdKey, currentSessionId);
    }

    // Refresh history list to show updated active state (preserve scroll/loaded pages)
    loadHistoryList({ preserveScroll: true, ensureActiveVisible: true });

    // Restore Prompt
    if (session.prompt !== undefined) {
        masterInput.value = session.prompt;
        // Trigger input event to resize if needed
        masterInput.dispatchEvent(new Event('input'));
    }

    // Restore Layout
    if (session.layout && layoutBtns[session.layout]) {
        setLayout(session.layout);
    }

    // Restore Services
    if (session.activeServices) {
        // First turn off all
        // First turn off all
        ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'genspark'].forEach(s => {
            if (toggles[s]) toggles[s].checked = false;
            window.electronAPI.toggleService(s, false);
        });

        // Then turn on saved
        session.activeServices.forEach(s => {
            if (toggles[s]) toggles[s].checked = true;
            window.electronAPI.toggleService(s, true);
        });
    }

    // Restore Modes
    if (session.isAnonymousMode !== undefined && session.isAnonymousMode !== isAnonymousMode) {
        toggleAnonymousMode();
    }

    if (session.isScrollSyncEnabled !== undefined && session.isScrollSyncEnabled !== isScrollSyncEnabled) {
        const syncToggle = document.getElementById('scroll-sync-toggle');
        if (syncToggle) {
            syncToggle.checked = session.isScrollSyncEnabled;
            isScrollSyncEnabled = session.isScrollSyncEnabled;
            window.electronAPI.toggleScrollSync(session.isScrollSyncEnabled);
        }
    }

    updateLayoutState();

    // Navigate webviews to saved URLs (with delay for service initialization)
    const storedUrls = session.urls || session.serviceUrls;
    if (storedUrls && Object.keys(storedUrls).length > 0) {
        setTimeout(() => {
            Object.entries(storedUrls).forEach(([service, url]) => {
                if (url && session.activeServices && session.activeServices.includes(service)) {
                    console.log(`[History] Navigating ${service} to saved URL: ${url}`);
                    window.electronAPI.navigateToUrl(service, url);
                }
            });
            // Clear loading flag after navigation completes
            isSessionLoading = false;
        }, 500); // Delay to allow services to initialize
    } else {
        // Clear loading flag if no URLs to navigate
        isSessionLoading = false;
    }

    // Close sidebar on mobile/small screens? Optional.
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
// Also catch Ctrl+Enter on masterInput
if (masterInput) {
    masterInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
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

        // Use initial height as minimum (prevents scrollbar), max 60% of viewport
        const minHeight = initialControlsHeight || 200;
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
    window.electronAPI.setServiceVisibility(true);
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

function setupSessionPersistence() {
    // 1. Listen for Apply Saved State from Main Process (Startup)
    if (window.electronAPI.onApplySavedState) {
        window.electronAPI.onApplySavedState((state) => {
            console.log('[Session] Applying saved state from Main:', state);
            if (state) {
                // Use loadSession logic but adapt for Main's state structure
                // Main sends 'serviceUrls', renderer expects 'urls'. 
                // We already patched loadSession to handle 'serviceUrls'.

                // We construct a pseudo-session object
                const restorationSession = {
                    id: currentSessionId || localStorage.getItem(currentSessionIdKey), // Use existing ID if available
                    activeServices: state.activeServices,
                    layout: state.layout,
                    urls: state.serviceUrls,
                    isAnonymousMode: state.isAnonymousMode,
                    isScrollSyncEnabled: state.isScrollSyncEnabled
                };

                // Set flag to prevent setupHistory from overwriting
                hasAppliedMainState = true;

                loadSession(restorationSession);
            }
        });
    }

    // 2. Listen for Toggle Changes to Save Session
    // This ensures that when user toggles Genspark (or others), it saves to IndexedDB/History
    for (const [service, toggle] of Object.entries(toggles)) {
        if (toggle) {
            toggle.addEventListener('change', () => {
                // Update layout first (existing logic might be attached, but we ensure it runs)
                updateLayoutState();
                window.electronAPI.toggleService(service, toggle.checked);

                // Save session state
                saveCurrentSession();
            });
        }
    }
}
