# Multi-AI Chat Service - Unified Software Requirements Specification (SRS)

## 1. Introduction
This document defines the unified software requirements for the Multi-AI Chat application. It consolidates requirements from initial concepts through recent feature additions including Conversation History, Session Persistence, Advanced Cross Check, File Uploads, and comprehensive UI enhancements.
The requirements are written using **EARS** (Easy Approach to Requirements Syntax) to ensure clarity and testability.

## 2. Terminology
- **Service**: An individual AI provider (ChatGPT, Claude, Gemini, Grok, Perplexity).
- **Webview**: The BrowserView instance rendering a specific Service.
- **Prompt Input**: The unified text entry area at the bottom of the application.
- **Cross Check**: The feature allowing users to send the same prompt to multiple services or compare their responses.
- **Anonymous Mode**: A mode where service names are masked (e.g., "(A)", "(B)") to reduce bias.
- **Session**: A specific state of the application including active services, layouts, URLs, and prompt history.
- **History Sidebar**: The UI component displaying the list of saved sessions.

## 3. Functional Requirements

### 3.1 Core Multi-Service Management
- **REQ-CORE-001**: The system shall support the following AI services: ChatGPT, Claude, Gemini, Grok, Perplexity, and Genspark.
- **REQ-CORE-002**: When the application launches, the system shall restore the previously active services and their last visited URLs (Session Persistence).
- **REQ-CORE-003**: While a service requires authentication, if the user cannot log in via the embedded view, the system shall provide an "Open in Chrome" or "External Login" option to facilitate authentication using a separate browser instance.

### 3.2 Layout & View Controls
- **REQ-LAYOUT-001**: The system shall provide the following layout options: **1x3** (Vertical Stack), **3x1** (Horizontal Stack), **1x4** (Horizontal Stack), and **2x2** (Grid).
- **REQ-LAYOUT-002**: When the number of active services is less than 3, the system shall disable the 3x1 layout button.
- **REQ-LAYOUT-003**: When the number of active services is less than 4, the system shall disable the 1x4 and 2x2 layout buttons.
- **REQ-LAYOUT-004**: While in any layout, existing services shall be distributed to fill available slots, prioritizing top-left to bottom-right order.
- **REQ-LAYOUT-005 (Maximize/Restore)**: The system shall provide a "Maximize" button on each Webview header.
- **REQ-LAYOUT-006**: When the "Maximize" button is clicked, the system shall expand the selected Webview to fill the entire application window (excluding the prompts area if configured) and change the button to "Restore".
- **REQ-LAYOUT-007**: When the "Restore" button is clicked, the system shall revert the Webview to its original dimensions within the active layout.
- **REQ-LAYOUT-008 (Scroll Sync)**: The system shall provide a "Scroll Sync" toggle.
- **REQ-LAYOUT-009**: While "Scroll Sync" is **enabled**, when the user scrolls in one Webview, the system shall indiscriminately scroll all other active Webviews by a proportional amount.
- **REQ-LAYOUT-010 (Resize)**: The system shall provide a draggable handle above the Prompt Input area to allow the user to resize the height of the prompt input relative to the Webviews.

### 3.3 Prompt Input & File Handling
- **REQ-INPUT-001**: The system shall provide a unified text input area that sends text to all active services simultaneously.
- **REQ-INPUT-002 (File Upload)**: The system shall allow users to attach files (images, text) to the prompt.
- **REQ-INPUT-003**: When files are attached, the system shall display them as visual "chips" in a File Preview Area.
- **REQ-INPUT-004 (Drag & Drop)**: When a user drags and drops a file into the application, the system shall add it to the attachment list.
- **REQ-INPUT-005**: When a user drags and drops text selection into the application, the system shall insert the text into the Prompt Input area.
- **REQ-INPUT-006 (Clipboard Pacing)**: When a user pastes an image from the clipboard, the system shall automatically convert it to a file attachment.
- **REQ-INPUT-007**: When a user pastes text from the clipboard, the system shall insert it as text into the Prompt Input area (unless explicitly pasted into the File Preview Area, if supported).
- **REQ-INPUT-008 (Two-Step Send)**: When files are attached, clicking "Send" or pressing Ctrl+Enter shall first trigger an "Upload & Inject" phase (Pending Confirmation State).
- **REQ-INPUT-009**: While in the **Pending Confirmation State**, the system shall display a toast notification (e.g., "Files uploaded. Press Ctrl+Enter to send.") and update the input placeholder.
- **REQ-INPUT-010**: When the user presses Ctrl+Enter while in the Pending Confirmation State, the system shall trigger the final submission (clicking the Service's internal Send button).

### 3.4 Cross Check & Anonymous Mode
- **REQ-CROSS-001**: The system shall provide a "Cross Check" features menu.
- **REQ-CROSS-002 (Anonymous Mode)**: The system shall provide an "Anonymous" toggle.
- **REQ-CROSS-003**: While **Anonymous Mode** is enabled, the system shall replace service names in the UI and in generated prompts with aliases (e.g., "ChatGPT" -> "(A)", "Claude" -> "(B)").
- **REQ-CROSS-004 (Compare AI)**: When "Compare AI Responses" is selected, the system shall collect the latest response from each active service, combine them, and prepend a predefined comparison prompt.
- **REQ-CROSS-005**: The system shall allow the user to edit the Predefined Comparison Prompt and persist changes.
- **REQ-CROSS-006 (Custom Prompts)**: The system shall allow users to create, save, edit, and delete Custom Prompts for cross-checking.
- **REQ-CROSS-007**: The system shall display Saved Custom Prompts in a sortable table (by Title, Created Date, Last Used).
- **REQ-CROSS-008**: When a Custom Prompt is selected, the system shall populate the prompt input with the saved content.

### 3.5 Conversation History & Sidebar
- **REQ-HIST-001 (Persistence)**: The system shall automatically save the current session details (Active Services, Layout, URLs, Prompt Input State) to the local database upon significant interactions (e.g., sending a prompt) or application exit.
- **REQ-HIST-002 (Sidebar Toggle)**: The system shall provide a "Hamburger Menu" button to toggle the visibility of the Conversation History Sidebar.
- **REQ-HIST-003 (Sidebar State)**: When the application restarts, the system shall restore the sidebar to its last state (collapsed or expanded).
- **REQ-HIST-004 (History List)**: The system shall display a list of past conversation sessions in the sidebar, sorted by "Last Updated" timestamp (newest first).
- **REQ-HIST-005 (Lazy Loading)**: When scrolling through a large number of history items, the system shall load additional items dynamically (infinite scroll or pagination) to maintain performance.
- **REQ-HIST-006 (History Item Display)**: The system shall display each history item with a Title (defaulting to "YYYY-MM-DD HH:mm:ss" of creation/update) and a Context Menu trigger ("..." button).
- **REQ-HIST-007 (Item Interaction)**: When a history item is clicked, the system shall restore the full state of that session (URLs, Prompt, Layout) and collapse the sidebar (if configured to do so).
- **REQ-HIST-008 (Context Menu)**: When the user hovers over a history item or clicks the context menu trigger, the system shall provide options to "Rename" and "Delete" the session.
- **REQ-HIST-009 (Rename)**: When "Rename" is selected, the system shall allow the user to modify the title of the history item inline or via a modal.
- **REQ-HIST-010 (Delete)**: When "Delete" is selected, the system shall require confirmation before permanently removing the session from the database.
- **REQ-HIST-011 (New Chat)**: When the "New Chat" button is clicked, the system shall save the current session state (ensuring the latest changes are persisted) and then reset the workspace to a fresh, default state (New Session ID).

### 3.6 External Interaction
- **REQ-EXT-001 (URL Bar)**: The system shall display the current URL of each Webview in a dedicated bar.
- **REQ-EXT-002**: The system shall allow the user to Copy the current URL or Open it in the system default browser (Chrome).
- **REQ-EXT-003 (Link Navigation)**: When a user clicks a link within a Webview that targets a domain not belonging to the Service (i.e., external link), the system shall intercept the navigation and open the URL in the system default browser.

## 4. Technical Architecture

### 4.1 Data Persistence
- **Session Store**: `electron-store` for lightweight configuration (toggles, window bounds, last active session ID).
- **History Database**: `IndexedDB` (via **idb** or similar wrapper) for storing robust conversation records.
  - **Store Name**: `conversations`
  - **Schema**: Includes `id` (UUID), `title`, `createdAt`, `updatedAt`, `webViews` (array of service/url/active state), and `promptState` (text, files, options).

### 4.2 Inter-Process Communication (IPC)
- **Renderer-to-Main**:
  - `set-layout`, `send-prompt-with-files`, `save-temp-file`, `cross-check`, `get-all-webview-urls`, `open-external-link`.
  - **New IPCs**: `history-get-all`, `history-save`, `history-delete`, `history-rename`. (Implied by functionality, though implementation choice may vary).
- **Main-to-Renderer**:
  - `file-upload-complete`, `url-changed`.

### 4.3 External Login Implementation
- Uses **Puppeteer** with `puppeteer-extra-plugin-stealth` for resilient external login flows.
- Cookie synchronization from Puppeteer Chrome instance to Electron BrowserViews.

## 5. Non-Functional Requirements
- **NFR-001 (Performance)**: The application shall not freeze during file uploads or large history loading; database operations shall be asynchronous.
- **NFR-002 (Encoding)**: All persisted text files and database entries shall be **UTF-8** encoded to support international characters.
- **NFR-003 (Privacy)**: No user data shall be transmitted to third parties other than the direct AI service providers.
- **NFR-004 (UX)**: The UI shall follow modern design principles with responsive animations (e.g., Sidebar transitions) and intuitive interactions.
