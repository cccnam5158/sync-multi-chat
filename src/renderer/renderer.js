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

const toggles = {
    chatgpt: document.getElementById('toggle-chatgpt'),
    claude: document.getElementById('toggle-claude'),
    gemini: document.getElementById('toggle-gemini')
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
        gemini: toggles.gemini.checked
    };

    window.electronAPI.sendPrompt(text, activeServices);
    // Optional: Clear input or keep it? Spec doesn't strictly say to clear on send, but usually yes.
    // SHORT-002 says Escape clears it.
    // Let's keep it for now or clear it? "INPUT-001... capture current text".
    // Usually chat apps clear input. I'll clear it.
    masterInput.value = '';
}

// Handle Toggles
for (const [service, toggle] of Object.entries(toggles)) {
    toggle.addEventListener('change', (e) => {
        window.electronAPI.toggleService(service, e.target.checked);
    });
}
