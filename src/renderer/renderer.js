const masterInput = document.getElementById('master-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');

// Handle New Chat Button Click
newChatBtn.addEventListener('click', () => {
    window.electronAPI.newChat();
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
    window.electronAPI.crossCheck();
});

const scrollSyncBtn = document.getElementById('scroll-sync-btn');
let isScrollSyncEnabled = false;
scrollSyncBtn.addEventListener('click', () => {
    isScrollSyncEnabled = !isScrollSyncEnabled;
    window.electronAPI.toggleScrollSync(isScrollSyncEnabled);

    if (isScrollSyncEnabled) {
        scrollSyncBtn.classList.add('active');
        scrollSyncBtn.innerText = '📜 Scroll Sync: ON';
    } else {
        scrollSyncBtn.classList.remove('active');
        scrollSyncBtn.innerText = '📜 Scroll Sync: OFF';
    }
});

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

function sendPrompt() {
    const text = masterInput.value.trim();
    if (!text) return;

    const activeServices = {
        chatgpt: toggles.chatgpt.checked,
        claude: toggles.claude.checked,
        gemini: toggles.gemini.checked,
        grok: toggles.grok.checked,
        perplexity: toggles.perplexity.checked
    };

    window.electronAPI.sendPrompt(text, activeServices);
    masterInput.value = '';
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
