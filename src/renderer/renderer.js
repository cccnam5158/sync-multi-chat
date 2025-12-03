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
    window.electronAPI.crossCheck(isAnonymousMode);
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
