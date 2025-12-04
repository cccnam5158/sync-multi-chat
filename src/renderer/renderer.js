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
copyChatBtn.addEventListener('click', () => {
    window.electronAPI.copyChatThread();
});

window.electronAPI.onChatThreadCopied(() => {
    const originalText = copyChatBtn.innerText;
    copyChatBtn.innerText = 'Copied!';
    setTimeout(() => {
        copyChatBtn.innerText = originalText;
    }, 2000);
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
        if (labelText) {
            const name = names[service] || service;
            if (isAnonymousMode) {
                // Format: Name (Alias)
                labelText.innerText = `${name} ${SERVICE_ALIASES[service] || ''}`;
            } else {
                // Format: Name
                labelText.innerText = name;
            }
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

    // 2. Constraint: Max 4 services
    if (activeCount >= 4) {
        for (const toggle of Object.values(toggles)) {
            if (!toggle.checked) toggle.disabled = true;
        }
    } else {
        for (const toggle of Object.values(toggles)) {
            toggle.disabled = false;
        }
    }

    // 3. Layout Buttons Logic
    if (activeCount < 3) {
        // < 3 services: Force 1x3
        if (currentLayout !== '1x3') setLayout('1x3');
        layoutBtns['1x3'].disabled = false;
        layoutBtns['1x4'].disabled = true;
        layoutBtns['2x2'].disabled = true;
    } else if (activeCount === 3) {
        // 3 services: Only 1x3 available (User request)
        if (currentLayout !== '1x3') setLayout('1x3');
        layoutBtns['1x3'].disabled = false;
        layoutBtns['1x4'].disabled = true;
        layoutBtns['2x2'].disabled = true;
    } else {
        // >= 4 services
        layoutBtns['1x3'].disabled = true;
        layoutBtns['1x4'].disabled = false;
        layoutBtns['2x2'].disabled = false;
        if (currentLayout === '1x3') setLayout('1x4');
    }

    // 4. Render the Layout
    renderLayout();
}

function setLayout(layout) {
    currentLayout = layout;
    Object.values(layoutBtns).forEach(btn => btn.classList.remove('active'));
    layoutBtns[layout].classList.add('active');

    // Notify Main (just for state, bounds are sent separately)
    window.electronAPI.setLayout(layout);

    // Re-render
    renderLayout();
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

    } else {
        // 1xN Layout (Horizontal Split)
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
    slot.style.flex = '1'; // Default equal width
    slot.innerHTML = `<div class="view-label">${service}</div>`;
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

        // Optional: Update bounds during drag if performance allows
        // requestAnimationFrame(updateBounds); 
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
    const bounds = {};
    activeServiceKeys.forEach(service => {
        const slot = document.getElementById(`slot-${service}`);
        if (slot) {
            const rect = slot.getBoundingClientRect();
            bounds[service] = {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
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
    const exists = customPrompts.some(p => p.title === title);
    if (exists) {
        alert('A prompt with this title already exists. Please use a different title.');
        return;
    }

    saveCustomPrompt(title, content);

    // Clear inputs
    resetCustomPromptForm({ preserveSaveCheckbox: true });
});

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
