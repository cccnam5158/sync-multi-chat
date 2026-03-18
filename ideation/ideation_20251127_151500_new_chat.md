# Ideation: New Chat Feature

**Date:** 2025-11-27
**Feature:** Start New Chat in All Panels

## 1. Objective
Add a "New" button to the UI that, when clicked, initiates a new conversation in all active AI service panels (ChatGPT, Claude, Gemini).

## 2. Implementation Plan

### 2.1 UI Changes
- **Location:** Add a "New" button to the left of the service toggle buttons in the `#controls-container` (specifically inside or before `#toggles`).
- **Styling:** Use existing button styles or create a new style to match the "Send" button but potentially smaller or distinct.

### 2.2 Logic Changes
- **Renderer Process (`renderer.js`):**
  - Add an event listener to the "New" button.
  - Call `window.electronAPI.newChat()` when clicked.
- **Preload Script (`src/main/preload.js`):**
  - Expose `newChat` function in `electronAPI` which sends an IPC message `new-chat` to the main process.
- **Main Process (`src/main/main.js`):**
  - Listen for `new-chat` IPC event.
  - Iterate through all active service views.
  - For each service, navigate the `BrowserView` to its specific "New Chat" URL.

### 2.3 Service-Specific "New Chat" URLs
Based on research, the following URLs should trigger a new conversation:

| Service | New Chat URL | Notes |
| :--- | :--- | :--- |
| **ChatGPT** | `https://chatgpt.com/` | Usually redirects to a new chat. If it redirects to an old one, we may need to use a DOM selector fallback. |
| **Claude** | `https://claude.ai/new` | Standard URL for new chat. |
| **Gemini** | `https://gemini.google.com/app` | Main app URL usually starts a new chat or shows the welcome screen. |

## 3. Constraints & Solutions

### 3.1 URL Navigation Behavior
- **Constraint:** Navigating to the root URL might sometimes restore the previous session instead of starting a new one (especially for ChatGPT and Gemini).
- **Solution:** 
  - **Primary Approach:** Use the URLs listed above.
  - **Fallback Approach:** If URL navigation proves unreliable (i.e., keeps user in old chat), implement DOM manipulation to find and click the "New Chat" button within the webview.
    - *ChatGPT Selector:* `a[href='/']` or `button[aria-label='New chat']` (needs verification).
    - *Gemini Selector:* `div[data-test-id='new-chat-button']` or similar (needs verification).

### 3.2 State Synchronization
- **Constraint:** The "New Chat" action is global.
- **Solution:** The button will trigger the action for *all* enabled services. If a service is disabled, it will be skipped (or reset when re-enabled, depending on preference). Current plan is to reset only active services.

## 4. Proposed Code Changes

### `src/renderer/index.html`
```html
<div id="toggles">
    <button id="new-chat-btn">New</button> <!-- Added -->
    <label><input type="checkbox" ...> ...</label>
    ...
</div>
```

### `src/main/preload.js`
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
    ...
    newChat: () => ipcRenderer.send('new-chat') // Added
});
```

### `src/main/main.js`
```javascript
ipcMain.on('new-chat', () => {
    services.forEach(service => {
        if (views[service] && views[service].enabled) {
            let url = serviceUrls[service];
            if (service === 'claude') url = 'https://claude.ai/new';
            // ChatGPT and Gemini use base URL for now
            views[service].view.webContents.loadURL(url);
        }
    });
});
```
