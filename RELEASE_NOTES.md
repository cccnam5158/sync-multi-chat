# Release Notes

## v0.5.0 (2025-12-02)

### 🚀 New Features
*   **File Upload Support**:
    *   **Multi-Service Broadcasting**: Upload files (images, text) to ChatGPT, Claude, Gemini, and Perplexity simultaneously. (Grok is temporarily excluded due to Cloudflare issues).
    *   **Two-Step Verification**: Implemented a safe "Upload -> Confirm -> Send" workflow to ensure files are fully attached before sending the prompt.
    *   **Drag & Drop**: Simply drag files into the input area to attach them.
    *   **Clipboard Paste**: Paste images directly from clipboard. Long text pastes (>5 lines) are automatically converted to text files.
*   **UI Improvements**:
    *   Added file preview chips with remove capability.
    *   Added a confirmation modal to guide users during the file upload process.

### 🔧 Fixes & Improvements
*   **Gemini File Upload**: Implemented advanced logic to handle Gemini's dynamic UI, including simulating clicks to reveal the file input and searching within Shadow DOMs.
*   **Grok Cloudflare Issue**: File upload for Grok is temporarily disabled due to persistent Cloudflare verification challenges. We are investigating a workaround.
*   **Prompt Reliability**: Fixed an issue where prompts might not send if the file upload took too long, by separating the upload and send actions.

---

## v0.4.2 (2025-12-02)

### 🔧 Fixes
*   **Gemini Login on Windows**: Resolved the "Couldn't sign you in" error by standardizing stealth mode configuration.
    *   Reverted Windows-specific evasion overrides that were triggering Google's automation detection.
    *   Applied consistent `puppeteer-extra-plugin-stealth` settings and `--disable-blink-features=AutomationControlled` flag across all platforms (Windows/Mac).

---

## v0.4.1 (2025-12-01)

### 🔧 Fixes & Improvements
*   **Robust External Login**:
    *   **Cloudflare Bypass**: Implemented `puppeteer-extra-plugin-stealth` to successfully bypass "Verify you are human" checks on ChatGPT.
    *   **Cookie Synchronization**: Added logic to capture session cookies from the external Chrome login window and inject them into the Electron app, ensuring persistent login state.
    *   **Manual Close Workflow**: The external Chrome window now stays open after login detection, allowing users to manually close it when ready, preventing premature closure.
    *   **Gemini Login Detection**: Updated DOM selectors to correctly detect Gemini's logged-in state and remove the "Login Required" badge.
*   **Stability**:
    *   Fixed `blink.mojom.WidgetHost` startup error by optimizing `BrowserView` initialization sequence.
    *   Fixed `__Host-` cookie prefix violation errors during sync.

---

## v0.4.0 (2025-11-28)

### 🚀 New Features
*   **New AI Services**: Added support for **Grok** and **Perplexity**. You can now broadcast prompts to 5 major AI services (ChatGPT, Claude, Gemini, Grok, Perplexity) simultaneously.
*   **Advanced Layout Options**:
    *   **2x2 Grid Layout**: Perfect for viewing 4 services at once in a balanced grid.
    *   **1x4 Horizontal Layout**: View 4 services side-by-side.
    *   **Dynamic Layout Switching**: Automatically enables/disables layout options based on the number of active services.
*   **Resizable Panels**:
    *   Added draggable splitters between panels.
    *   Supports both vertical resizing (width adjustment) and horizontal resizing (height adjustment in 2x2 mode).
    *   Layout remains stable during resizing with minimum width constraints.

### ✨ Improvements
*   **Perplexity Stability**: Implemented robust input injection logic (Retry & Click-to-Activate) to ensure prompts are delivered reliably, even if the service loads slowly.
*   **UI Enhancements**:
    *   **Copy Chat Thread Button**: Updated with a distinct Teal color (#2b5c5c) for better visibility.
    *   **Splitter Design**: Thinner (3px) and cleaner splitters for a modern look.
*   **Isolated Reload**: Clicking the reload button (🔄) on a service panel now refreshes **only** that specific panel, preventing unnecessary reloads of other active services.
*   **Grok Integration**: Improved content extraction logic to correctly copy chat history from Grok.

### 🐛 Bug Fixes
*   Fixed an issue where the first prompt sent to Perplexity (Ctrl+Enter) would be ignored.
*   Fixed "Copy Chat Thread" returning empty content for Grok.
*   Fixed layout breaking or panels disappearing when dragging splitters.
*   Fixed layout selection buttons not updating correctly when 3 services were active.

---

## v0.3.0 (2025-11-27)
*   Added "Copy Chat Thread" feature.
*   Added "Cross Check" feature.
*   Implemented Scroll Sync.

## v0.2.0 (2025-11-26)
*   Added "New Chat" button and shortcut (Ctrl+Shift+Enter).
*   Added "Login in Chrome" fallback for authentication.

## v0.1.0 (2025-11-25)
*   Initial Release with ChatGPT, Claude, Gemini support.
