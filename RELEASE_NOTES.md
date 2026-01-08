# Release Notes

## v0.5.11 (2026-01-08)

### 🔧 Fixes & Improvements
*   **Gemini Login Persistence**: Fixed Gemini login not persisting on app restart by syncing accounts.google.com cookies and improving cookie name detection (supports both `_Secure-` and `__Secure-` variants).
*   **UI Improvements**:
    *   **Reload Button Repositioned**: Moved reload button from URL bar to header (left of maximize button) for better accessibility.
    *   **Per-Service New Chat**: Added "New Chat" button (plus icon) in URL bar for each service panel, allowing individual service chat resets without affecting others.

## v0.5.10 (2026-01-07)

### ✨ New Features
*   **Conversation History - Bulk Delete**: Added Selection Mode to the History Sidebar to select and delete multiple sessions at once (with confirmation).

### ⬆️ Improvements
*   **History Sidebar UX**: Improved infinite scroll stability and scroll position restoration for large history lists.
*   **Modern UI**: Refined selection toolbar styling (pill buttons, clearer layout, hover feedback) for a more modern and consistent UX.

## v0.5.9 (2026-01-06)

### ✨ Improvements
*   **Custom Prompt Persistence**: Saved prompts now sync to electron-store (app data) with migration from localStorage to avoid loss after reinstall.
*   **Login Badge Reset Fix**: Fixed Chrome login badge ID mismatch so the “Chrome으로 로그인” button clears correctly after external login closes.
*   **Cookie Sync Hardening**: SameSite mapping and default path fixes to keep ChatGPT/Claude/Gemini/Grok sessions stable, especially on Windows 11.

## v0.5.8 (2026-01-06)

### ✨ New Features
*   **Installer Distribution**: Now distributed as a Windows installer (.exe) for easier installation.
*   **Auto-Update**: Automatic update support via electron-updater. Get the latest features without manual downloads.
*   **GitHub Actions CI/CD**: Automated build and release pipeline for faster deployments.

---

## v0.5.7 (2026-01-05)

### ⬆️ Improvements
*   **Grok**: Grok login state information sync with Google/X cookies.

## v0.5.6 (2025-12-18)

### ✨ New Features
*   **New AI Service: Genspark**:
    *   **Genspark Integration**: Added support for **Genspark** (https://www.genspark.ai/agents?type=ai_chat).
    *   **Placement**: Positioned after Perplexity in the service list.
    *   **Anonymous Mode**: Maps to alias "(F)" when Anonymous Mode is active.
    *   **Full Feature Support**: Supports all core features including Layouts, Scroll Sync, and File Uploads.

### ⬆️ Improvements
*   **Documentation**: Updated README and requirements specifications to reflect the new service addition.

## v0.5.5 (2025-12-15)

### ✨ New Features
*   **Conversation History**:
    *   **Sidebar Interface**: New collapsible sidebar on the left for easy history access.
    *   **Auto-Save**: Automatically saves your chat session including active services, layouts, and URLs.
    *   **Session Restore**: Click any history item to instantly restore your exact working environment.
    *   **History Management**: Delete individual sessions or clear all history with a single click.

### ⬆️ Improvements
*   **Performance**: Optimized session loading and saving with asynchronous IndexedDB operations.
*   **Responsiveness**: Improved sidebar animation and layout handling when toggling history view.

---

## v0.5.4 (2025-12-09)

### ✨ New Features
*   **Session Persistence (Full State)**:
    *   Automatically saves and restores: **active services**, **layout mode**, **anonymous mode**, **scroll sync state**, and **current URLs** for each service.
    *   Continue exactly where you left off on app restart.
    *   Session is saved on **window close** (X button, Alt+F4, etc.) ensuring state is preserved even on unexpected closes.
*   **WebView URL Bar**:
    *   Each panel now has a dedicated URL bar below the header showing the current page URL.
    *   **Reload**: Refresh the current page with a spinning animation feedback.
    *   **Copy URL**: Copy the current URL to clipboard with a green checkmark confirmation.
    *   **Copy Chat Thread**: Moved from header to URL bar for consolidated actions.
    *   **Open in Browser**: Open the current URL in your default external browser.
    *   **URL Truncation**: Long URLs are truncated with "..." and full URL shown on hover.
*   **External Link Handling**:
    *   Links to external websites (outside the AI service domain) automatically open in your default browser.
    *   Keeps you focused on the AI services while still allowing access to referenced content.
*   **3x1 Vertical Layout**:
    *   New layout option for viewing 3 services stacked vertically.
    *   Layout buttons dynamically enable/disable based on active service count.

### 🔧 Fixes & Improvements
*   **Button Click Feedback**:
    *   **Reload**: Arrow spins for 0.5s when clicked.
    *   **Copy buttons**: Show green checkmark (✓) for 2 seconds before returning to original icon.
*   **Splitter Improvements**:
    *   **Real-time Sync**: Header, URL bar, and content now move together smoothly during resize.
    *   **Thinner Splitters**: Reduced from 8px to 4px hit area for a cleaner look.
    *   **Hover Visual**: Splitter line thickens to 3px with dark gray (#555) color on hover.
*   **Toggle Button Fix**: Fixed bug where the 4th checked toggle was incorrectly disabled on app startup.
*   **Header Title Fix**: Service names now display correctly (e.g., "ChatGPT (A)" instead of "Chatgpt") based on anonymous mode state.
*   **URL Update on Layout Change**: URL bars now correctly update when switching between layouts (e.g., 1x3 ↔ 3x1).
*   **Unified UI Padding**: Header and URL bar now use consistent padding (8px) for cleaner alignment.

---

## v0.5.3 (2025-12-05)

### ✨ New Features
*   **Enhanced Copy Chat Thread**:
    *   **Full Conversation Extraction**: Now extracts the complete conversation thread (all user prompts and all AI responses) from all 5 services.
    *   **Role Distinction**: User messages are prefixed with `## 👤 User` and AI responses with `## 🤖 [Service Name]` for clear visual separation.
    *   **Service-Specific DOM Traversal**: Implemented tailored extraction logic for each AI service to accurately capture conversation content:
        - **ChatGPT**: Uses `article[data-testid^="conversation-turn"]` with role detection
        - **Claude**: Uses `[data-testid="user-message"]` and `[data-is-streaming]` with fallback selectors
        - **Gemini**: Uses `user-query` and `model-response` custom elements
        - **Grok**: Uses `div[id^="response-"]` with `items-end`/`items-start` class for role distinction
        - **Perplexity**: Uses `[class*="query"]` and `.prose` patterns with alternating message detection
*   **Copy Last Response Button**:
    *   Added a new "Copy Last Response" button in the control panel.
    *   Copies the **last AI response only** from all currently active services simultaneously.
    *   Useful for quick comparisons without including full conversation history.
    *   Respects format selection (Markdown/JSON/Text) and Anonymous mode.
*   **Per-Service Header Bar with Buttons**:
    *   Each AI service panel now has a **dedicated header bar** (28px) above the BrowserView.
    *   The header displays the **service name** on the left side.
    *   **Reload (🔄)** and **Copy (📋)** buttons are positioned on the right side of the header.
    *   The Copy button extracts the full chat thread using the same enhanced Markdown formatting as the main "Copy Chat Thread" button.
    *   Removed old overlay-style floating buttons that were injected into the BrowserView.

### 🔧 Fixes & Improvements
*   **Grok Cross Check Fix**: Updated `lastResponseSelector` to correctly extract the last AI response from Grok using `div[id^='response-'].items-start:last-of-type .response-content-markdown`.
*   **Markdown Formatting**: Fixed Turndown processing to only convert HTML parts while preserving the markdown structure (headings and separators).
*   **Claude Extraction Stability**: Added fallback selectors for Claude to handle dynamic DOM structure changes.

---

## v0.5.2 (2025-12-04)

### ✨ New Features
*   **Enhanced Cross Check - User Prompt Management**:
    *   **Editable Predefined Prompt**: Hover over "Compare AI Responses" to see a preview tooltip. Click the edit icon to customize the default comparison prompt. Changes are persisted across sessions.
    *   **Custom Prompt Management**: Create, save, and manage up to 10 custom prompts with required Title and Content fields.
    *   **Sortable Saved Prompts Table**: View saved prompts in a sortable table showing Title, Preview, Last Used, and Created dates. Click headers to sort by any column.
    *   **Delete Confirmation Modal**: Safe prompt deletion with a confirmation dialog showing the prompt title.
    *   **Smart Validation**: "Add Custom Prompt" and "Send Cross Check" buttons automatically enable/disable based on field completion. Title uniqueness is enforced.
    *   **Two Save Options**: 
        - "Add Custom Prompt" button: Save without sending
        - "Send Cross Check" with "Save this prompt" checkbox: Optionally save while sending

### 🔧 Fixes & Improvements
*   **Robust Input State Management**: 
    *   Implemented MutationObserver to prevent input fields from becoming disabled unexpectedly.
    *   Multiple re-enablement strategies ensure Title and Content fields remain editable after all operations (deletion, clearing, modal interactions).
*   **BrowserView Visibility Control**: AI service views are now temporarily hidden while the Cross Check modal is open for better focus and performance.
*   **Improved User Experience**:
    *   Initial button states correctly reflect validation requirements
    *   Removed duplicate event listeners for better performance
    *   Date formatting for creation and last-used timestamps
    *   Visual feedback for button states (disabled/enabled styling)

---

## v0.5.1 (2025-12-03)

### ✨ New Features
*   **Anonymous Cross Check**:
    *   Added an "Anonymous" toggle button to the Cross Check controls.
    *   When enabled, service names are replaced with aliases (e.g., ChatGPT -> (A), Claude -> (B)) in the prompts sent to other AIs.
    *   Helps reduce bias and potential context leakage between models during cross-referencing.
*   **Modern UI Enhancements**:
    *   **Scroll Sync Toggle**: Replaced the button with a sleek toggle switch for better usability.
    *   **Layout Icons**: Replaced text buttons (1x3, 1x4, 2x2) with intuitive SVG icons.
    *   **Refined Styling**: Reduced button heights and font sizes for a more compact and modern look.
    *   **Distinct Actions**: Applied unique colors to "New Chat" and "Copy Chat Thread" buttons for quick identification.

---

## v0.5.0 (2025-12-02)

### ✨ New Features
*   **File Upload Support**:
    *   **Multi-Service Broadcasting**: Upload files (images, text) to ChatGPT, Claude, Gemini, and Perplexity simultaneously. (Grok is temporarily excluded due to Cloudflare issues).
    *   **Two-Step Verification**: Implemented a safe "Upload -> Confirm -> Send" workflow to ensure files are fully attached before sending the prompt.
    *   **Drag & Drop**: Simply drag files into the input area to attach them.
    *   **Clipboard Paste**: Paste images directly from clipboard. Long text pastes (>100 lines) are automatically converted to text files.
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

### ✨ New Features
*   **New AI Services**: Added support for **Grok** and **Perplexity**. You can now broadcast prompts to 5 major AI services (ChatGPT, Claude, Gemini, Grok, Perplexity) simultaneously.
*   **Advanced Layout Options**:
    *   **2x2 Grid Layout**: Perfect for viewing 4 services at once in a balanced grid.
    *   **1x4 Horizontal Layout**: View 4 services side-by-side.
    *   **Dynamic Layout Switching**: Automatically enables/disables layout options based on the number of active services.
*   **Resizable Panels**:
    *   Added draggable splitters between panels.
    *   Supports both vertical resizing (width adjustment) and horizontal resizing (height adjustment in 2x2 mode).
    *   Layout remains stable during resizing with minimum width constraints.

### ⬆️ Improvements
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