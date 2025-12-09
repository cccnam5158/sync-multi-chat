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

// Handle New Chat Button Click
newChatBtn.addEventListener('click', () => {
    window.electronAPI.newChat();
});

if (promptToggleBtn) {
    promptToggleBtn.addEventListener('click', () => {
        isPromptCollapsed = !isPromptCollapsed;
        if (inputArea) inputArea.classList.toggle('collapsed', isPromptCollapsed);
        if (controlsContainer) controlsContainer.classList.toggle('collapsed', isPromptCollapsed);
        // promptToggleBtn.textContent = isPromptCollapsed ? '△' : '▽'; // Removed to preserve SVG
        promptToggleBtn.setAttribute('aria-expanded', (!isPromptCollapsed).toString());
        promptToggleBtn.title = isPromptCollapsed ? 'Expand controls' : 'Collapse controls';
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
    'perplexity': '(E)'
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
        'perplexity': 'Perplexity'
    };

    for (const [service, toggle] of Object.entries(toggles)) {
        // The label text is now in a span with class 'label-text'
        const labelText = toggle.parentElement.querySelector('.label-text');
        const name = names[service] || service;
        const displayName = isAnonymousMode ? `${name} ${SERVICE_ALIASES[service] || ''}` : name;

        if (labelText) {
            labelText.innerText = displayName;
        }

        // Also update webview header name
        const headerName = document.querySelector(`#slot-${service} .service-name`);
        if (headerName) {
            headerName.textContent = displayName;
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
    perplexity: document.getElementById('toggle-perplexity')
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
        perplexity: toggles.perplexity.checked
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
            const MULTI_LINE_THRESHOLD = 100; // Convert to file if 100+ lines

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
    attachedFiles.push({ name: file.name, path: file.path });
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
        'perplexity': 'Perplexity'
    };
    const baseDisplayName = serviceNames[service] || service;
    const displayName = isAnonymousMode ? `${baseDisplayName} ${SERVICE_ALIASES[service] || ''}` : baseDisplayName;

    const serviceName = document.createElement('span');
    serviceName.className = 'service-name';
    serviceName.textContent = displayName;

    // Header only contains service name (buttons moved to URL bar)
    header.appendChild(serviceName);
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
if (window.electronAPI.onWebviewUrlChanged) {
    window.electronAPI.onWebviewUrlChanged(({ service, url }) => {
        const urlTextEl = document.getElementById(`url-text-${service}`);
        if (urlTextEl && url) {
            // Truncate URL for display if necessary
            const displayUrl = url.length > 80 ? url.substring(0, 77) + '...' : url;
            urlTextEl.textContent = displayUrl;
            urlTextEl.dataset.url = url; // Store full URL for copy/chrome buttons
            urlTextEl.title = url; // Show full URL on hover
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

function loadCustomPrompts() {
    const stored = localStorage.getItem('customPrompts');
    if (stored) {
        try {
            customPrompts = JSON.parse(stored);
            // Migration: Ensure fields exist
            customPrompts = customPrompts.map(p => ({
                ...p,
                createdAt: p.createdAt || new Date().toISOString(),
                lastUsedAt: p.lastUsedAt || new Date().toISOString()
            }));
        } catch (e) {
            console.error('Failed to parse custom prompts', e);
            customPrompts = [];
        }
    }
}

function loadPredefinedPrompt() {
    const stored = localStorage.getItem('predefinedPrompt');
    if (stored) {
        currentPredefinedPrompt = stored;
    } else {
        currentPredefinedPrompt = DEFAULT_PREDEFINED_PROMPT;
    }
    updatePredefinedPromptPreview();
}

function savePredefinedPrompt(content) {
    currentPredefinedPrompt = content;
    localStorage.setItem('predefinedPrompt', content);
    updatePredefinedPromptPreview();
}

function updatePredefinedPromptPreview() {
    if (predefinedPromptPreviewText) {
        predefinedPromptPreviewText.textContent = `"${currentPredefinedPrompt}"`;
    }
}

function saveCustomPromptsToStorage() {
    localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
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
            <td>${escapeHtml(prompt.title)}</td>
            <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(prompt.content)}">${escapeHtml(prompt.content)}</td>
            <td>${formatDate(prompt.lastUsedAt)}</td>
            <td>${formatDate(prompt.createdAt)}</td>
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
