# Ideation: Conversation History Sidebar & Session Persistence

## 1. Goal
Implement a "Conversation History" feature similar to standard AI services (ChatGPT, Claude), allowing users to:
- Save and view past conversation sessions.
- Restore previous sessions (Webviews, Prompt settings, Active URLs).
- Manage history (Rename, Delete).
- Persist state across app restarts.

## 2. Feature Description

### 2.1 UI Components
- **Hamburger Menu**: Located at the top-left (or appropriate position) to toggle the sidebar.
- **Sidebar**:
  - **State**: Collapsed by default on first launch; remembers state during session.
  - **Content**: List of conversation history items sorted by recency (newest first).
  - **Scrolling**: Infinite scroll or "load more" on scroll for performance with large history.
- **History Item**:
  - **Title**: Default format "YYYY-MM-DD HH:mm:ss".
  - **Interactions**:
    - **Click**: Switch to that conversation (restore state) and collapse sidebar.
    - **Hover**: Highlight background, show "..." menu trigger.
  - **Context Menu ("...")**:
    - **Change Conversation Title**: Inline edit or modal input to rename.
    - **Delete**: Red background/white text. Triggers confirmation modal.

### 2.2 Functional Logic
- **New Chat**:
  - Trigger: "New Chat" button click.
  - Action: Save *current* state to history (if changed/dirty), clear current view for new session.
  - Note: The user request says "New Chat saves the current conversation to history". This implies the *active* session is "live" and only explicitly "archived" or "saved" when moving to a new one, OR the current session is auto-saved and "New Chat" just starts a fresh one. 
  - *Refinement*: To match standard behavior (ChatGPT):
    - Current session is auto-saved as we go (or on significant actions).
    - "New Chat" creates a NEW empty session ID.
    - Switching history items loads that session ID.
  - *Constraint from prompt*: "When New Chat is clicked, save *current* state info to history lists... then start new".
- **App Start**:
  - Action: Restore the *last active* conversation.
  - Initial run: Create an empty conversation or specific "Welcome" state, but treat as first history item if used.
  - DB Creation: Initialize IndexedDB on first run.

### 2.3 Data Model (IndexedDB)
**Database**: `SyncMultiChatDB`
**Store**: `conversations`
**Schema**:
```json
{
  "id": "uuid-v4",
  "title": "2025-12-11 15:30:00",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "webViews": [
    { "service": "chatgpt", "url": "...", "isActive": true },
    { "service": "claude", "url": "...", "isActive": false }
  ],
  "promptState": {
    "text": "...", 
    "files": [...],
    "options": {
      "anonymous": false,
      "scrollSync": true,
      "layout": "2x2",
      "activeServices": ["chatgpt", "claude"]
    }
  }
}
```

## 3. Implementation Details

### 3.1 Dependencies
- **IndexedDB**: Use native `indexedDB` API or a lightweight wrapper like `idb` (if permissible to add) to simplify Promise handling. *Decision*: Use native helper class to avoid unexpected dependencies unless `idb` is already present.

### 3.2 Constraints & Solutions
- **Constraint**: `BrowserView` URLs are managed in Main process, UI is in Renderer.
  - **Solution**: Renderer requests state from Main via IPC before saving. Main returns current URLs of valid WebViews.
- **Constraint**: Large history performance.
  - **Solution**: Pagination/Lazy loading in sidebar. Load only titles/IDs initially. Load full state only on click.
- **Constraint**: IndexedDB Schema changes.
  - **Solution**: Use `onupgradeneeded` versioning to handle migrations.

### 3.3 Execution Steps
1. **DB Layer**: Create `HistoryService.js` handling `open`, `add`, `getAll`, `delete`, `update`.
2. **Main Process**: Ensure IPC handlers exist to `get-all-webview-urls` and `get-window-state`.
3. **Renderer UI**:
    - Add Sidebar HTML to `index.html`.
    - Add logic to `renderer.js` for Sidebar toggle, rendering list.
4. **Integration**:
    - `Ctrl+Enter` / Send: Update current session `updatedAt`.
    - "New Chat": `HistoryService.add(currentState) -> clearUI()`.
    - App Launch: `HistoryService.getMostRecent() -> restoreState()`.

## 4. Verification
- Verify Sidebar toggle works.
- Verify "New Chat" adds item to list.
- Verify Clicking item restores exact URLs and Prompt Layout.
- Verify Rename and Delete persistence.
- Verify Data persists after Quit & Relaunch.
