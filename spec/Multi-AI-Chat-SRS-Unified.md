# Multi-AI Chat Service - Unified Software Requirements Specification (SRS)

## 1. Introduction
This document defines the unified software requirements for the Multi-AI Chat application. It consolidates requirements from initial concepts through recent feature additions including Conversation History, Session Persistence, Advanced Cross Check, File Uploads, Chat Mode (Single AI / Multi AI), Custom Prompt Builder, and comprehensive UI enhancements.
The requirements are written using **EARS** (Easy Approach to Requirements Syntax) to ensure clarity and testability.

## 2. Terminology
- **Service**: An individual AI provider (ChatGPT, Claude, Gemini, Grok, Perplexity, Genspark).
- **Webview**: The BrowserView instance rendering a specific Service.
- **Prompt Input**: The unified text entry area at the bottom of the application.
- **Cross Check**: The feature allowing users to send the same prompt to multiple services or compare their responses.
- **Anonymous Mode**: A mode where service names are masked (e.g., "(A)", "(B)") to reduce bias.
- **Session**: A specific state of the application including active services, layouts, URLs, and prompt history.
- **History Sidebar**: The UI component displaying the list of saved sessions.
- **Chat Mode**: The operational mode determining how Webviews are configured; either **Multi AI Mode** or **Single AI Mode**.
- **Multi AI Mode**: The default mode where users can select up to 4 different AI services simultaneously.
- **Single AI Mode**: A mode where users select one AI service and create up to 4 independent instances of that service.
- **Instance**: In Single AI Mode, an individual Webview of the selected AI service (e.g., "ChatGPT #1", "ChatGPT #2").
- **Custom Prompt Builder**: An advanced editor modal for creating, managing, and sending custom prompts with variable substitution support.
- **System Variable**: A runtime-injected variable (e.g., `{{chat_thread}}`, `{{last_response}}`) whose value is automatically populated by the application at send time.
- **Global Variable**: A user-defined variable (e.g., `{{output_format}}`, `{{role}}`) shared across all custom prompts.
- **Local Variable**: A user-defined variable specific to a single custom prompt (e.g., `{{analysis_depth}}`, `{{topic}}`).

## 3. Functional Requirements

### 3.1 Core Multi-Service Management
- **REQ-CORE-001**: The system shall support the following AI services: ChatGPT, Claude, Gemini, Grok, Perplexity, and Genspark.
- **REQ-CORE-002**: When the application launches, the system shall restore the previously active Chat Mode, services/instances, and their last visited URLs (Session Persistence).
- **REQ-CORE-003**: While a service requires authentication, if the user cannot log in via the embedded view, the system shall provide an "Open in Chrome" or "External Login" option to facilitate authentication using a separate browser instance.
- **REQ-CORE-004 (Chat Mode)**: The system shall support two operational modes: **Multi AI Mode** (default) and **Single AI Mode**.
- **REQ-CORE-005**: The system shall provide a "Chat Mode Settings" button (gear icon) in the service toggle area to access mode configuration.
- **REQ-CORE-006**: When the "Chat Mode Settings" button is clicked, the system shall display a modal with options to select Multi AI Mode or Single AI Mode.

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
- **REQ-INPUT-011 (Slash Command Entry)**: When the user types `/` in the Prompt Input, the system shall open a Slash Command list for loading saved custom prompts.
- **REQ-INPUT-012 (Slash Filtering)**: While the Slash Command list is open, when the user types additional text after `/`, the system shall filter prompt results in real time by title and content.
- **REQ-INPUT-013 (Slash Selection)**: While the Slash Command list is open, the system shall support keyboard navigation (↑/↓/Enter/Tab/Esc) and mouse selection to insert the selected custom prompt into the Prompt Input.
- **REQ-INPUT-014 (Mini Variable Form)**: When the Prompt Input contains `{{variable}}` tokens after a custom prompt insertion or user edit, the system shall auto-generate an inline mini variable form for detected non-system variables.
- **REQ-INPUT-015 (Unresolved Variable Decision)**: When the user attempts to send a Prompt Input that includes unresolved variables, the system shall show an English confirmation dialog offering: review variables before send, send anyway, or cancel.
- **REQ-INPUT-016 (Review Focus)**: When the user chooses "review variables before send", the system shall move focus to the first unresolved variable field in the inline mini variable form.
- **REQ-INPUT-017 (Main Input Shortcut Compatibility)**: While using Slash Command or inline variable editing, Ctrl+Enter shall preserve the existing send behavior as the primary send shortcut.
- **REQ-INPUT-018 (Popup Layer Visibility)**: When input context UI (Slash list, variable autocomplete, unresolved-variable dialog) is open, the system shall present that UI above webview layers without relying on temporary BrowserView resize/shrink.
- **REQ-INPUT-019 (Popup Layer Backdrop)**: While input context UI is open, the system shall apply an application-level dim/blur treatment over the webview region to maintain popup readability and interaction priority.

### 3.4 Cross Check & Anonymous Mode
- **REQ-CROSS-001**: The system shall provide a "Cross Check" features menu.
- **REQ-CROSS-002 (Anonymous Mode)**: The system shall provide an "Anonymous" toggle.
- **REQ-CROSS-003**: While **Anonymous Mode** is enabled, the system shall replace service names in the UI and in generated prompts with aliases (e.g., "ChatGPT" -> "(A)", "Claude" -> "(B)").
- **REQ-CROSS-004 (Compare AI)**: When "Compare AI Responses" is selected, the system shall collect the latest response from each active service, combine them, and prepend a predefined comparison prompt.
- **REQ-CROSS-005**: The system shall allow the user to edit the Predefined Comparison Prompt and persist changes.
- **REQ-CROSS-006 (Custom Prompts)**: The system shall allow users to create, save, edit, and delete Custom Prompts for cross-checking.
- **REQ-CROSS-007**: The system shall display Saved Custom Prompts in a sortable table (by Title, Created Date, Last Used).
- **REQ-CROSS-008**: When a Custom Prompt is selected, the system shall populate the prompt input with the saved content.

#### 3.4.1 Custom Prompt Builder

##### 3.4.1.1 Layout & Navigation

- **REQ-CPB-001 (3-Panel Layout)**: When the "Add Custom Prompt" option is selected in the Cross Check modal, the system shall display the Custom Prompt Builder as a full-screen modal with a 3-panel layout: **Saved Prompts Sidebar** (left), **Editor** (center), and **Variables Panel** (right).
- **REQ-CPB-002 (Sidebar Panel)**: The Saved Prompts Sidebar shall display a list of saved custom prompts as card items, each showing the prompt title, a content preview (up to 80 characters), last updated date, and last used date.
- **REQ-CPB-003 (Editor Panel)**: The Editor panel shall provide a monospace text area for editing prompt content and shall support switching between **Edit** and **Preview** modes.
- **REQ-CPB-004 (Variables Panel)**: The Variables Panel shall display variables organized into three tabs: **Global** (🌐), **Local** (📌), and **System** (🔧).
- **REQ-CPB-005 (Topbar)**: The Topbar shall display the prompt title input (center), save status indicator with dirty/saved state (left), and action buttons including Save, Preview, Send, and Copy Prompt to Input (right).
- **REQ-CPB-006 (Panel Collapse)**: The system shall allow the user to collapse and expand the Sidebar and Variables panels independently, reducing them to a minimal width (54px) when collapsed.
- **REQ-CPB-007 (Panel Resize)**: The system shall allow the user to drag-resize the Sidebar (240px–520px) and Variables panel (280px–520px) widths, persisting the widths across sessions.
- **REQ-CPB-008 (Zen Mode)**: When Zen mode is activated, the system shall collapse both the Sidebar and Variables panels simultaneously to maximize the editor area.
- **REQ-CPB-009 (Responsive Layout)**: Where the screen width is below 980px, the system shall hide the Variables panel to preserve editor usability.

##### 3.4.1.2 Prompt Management (CRUD)

- **REQ-CPB-010 (Create)**: When the "+ New" button is clicked, the system shall create a new empty prompt and switch to edit mode. If unsaved changes exist, the system shall prompt the user to save before proceeding.
- **REQ-CPB-011 (Save)**: When the "Save" button is clicked or Ctrl+S is pressed, the system shall persist the current prompt's title, content, and local variables, and update the `updatedAt` timestamp.
- **REQ-CPB-012 (Save Button State)**: While no unsaved changes exist, the Save button shall be disabled. While unsaved changes exist, the status indicator shall display a "dirty" state.
- **REQ-CPB-013 (Duplicate)**: When "Duplicate" is selected, the system shall create a deep copy of the current prompt with a "(복제)" suffix appended to the title.
- **REQ-CPB-014 (Delete)**: When "Delete" is selected, the system shall display a confirmation dialog before permanently removing the prompt. After deletion, the system shall switch to the first remaining prompt in the list.
- **REQ-CPB-015 (Search)**: The system shall provide a real-time search input that filters the prompt list by matching title or content. When no results match, the system shall display "검색 결과가 없습니다".
- **REQ-CPB-016 (Sort)**: The system shall provide a sort toggle between "최근" (by `updatedAt` descending) and "제목" (by title in locale-aware alphabetical order).
- **REQ-CPB-017 (Unsaved Guard)**: When the user attempts to switch to another prompt while unsaved changes exist, the system shall display a confirmation dialog asking whether to save before switching.
- **REQ-CPB-018 (More Menu)**: The system shall provide a "More" menu (⋯) offering Zen mode, Duplicate, and Delete actions.

##### 3.4.1.3 Editor

- **REQ-CPB-020 (Text Editing)**: The Editor shall provide a monospace textarea for prompt content editing with syntax highlighting support for `{{variable}}` patterns.
- **REQ-CPB-021 (Edit/Preview Toggle)**: The system shall support toggling between Edit mode (raw text editing) and Preview mode (variable-substituted rendered output).
- **REQ-CPB-022 (Preview Rendering)**: While in Preview mode, the system shall render the prompt content with all variables substituted according to the variable substitution rules (REQ-CPB-040).
- **REQ-CPB-023 (Variable Highlight)**: While in Preview mode and the "변수 하이라이트" option is enabled, the system shall visually highlight substituted variable values with a distinct style.
- **REQ-CPB-024 (Unresolved Highlight)**: While in Preview mode and the "미해결만" option is enabled, the system shall highlight only variables that have no assigned value, using a warning style.
- **REQ-CPB-025 (Format/Cleanup)**: When the "정리" button is clicked, the system shall remove trailing whitespace from each line, collapse 3+ consecutive blank lines to 2, and trim leading/trailing whitespace from the entire text.

##### 3.4.1.4 Variable System

- **REQ-CPB-030 (Three-Tier Variables)**: The system shall support three tiers of variables: **System Variables** (runtime-injected), **Global Variables** (shared across all prompts), and **Local Variables** (per-prompt).
- **REQ-CPB-031 (System Variables)**: The system shall provide the following built-in system variables:
  - `{{chat_thread}}`: The full conversation thread (JSON) from open webviews
  - `{{last_response}}`: The last response from open webviews
  - `{{current_time}}`: The current time in ISO 8601 format
- **REQ-CPB-032 (System Variable Display)**: The System Variables tab shall display each system variable with its name, description, and a quick-insert chip. System variables shall be read-only (not editable by the user).
- **REQ-CPB-033 (Global Variables)**: The Global Variables tab shall allow the user to add, edit, and delete global variables as name-value pairs. Global variables shall be persisted independently and shared across all prompts.
- **REQ-CPB-034 (Global Variable Seed)**: When no global variables exist, the system shall seed default variables: `output_format`, `role`, and `lang` with sensible default values.
- **REQ-CPB-035 (Local Variables)**: The Local Variables tab shall allow the user to add, edit, and delete variables specific to the currently selected prompt. Local variables shall be stored as part of the prompt data.
- **REQ-CPB-036 (Quick Insert Chips)**: Each variable tab shall display clickable chips for quick insertion of `{{variable_name}}` at the editor cursor position.
- **REQ-CPB-037 (Variable Insert Palette)**: When the "⚡ 변수 삽입" button is clicked, the system shall display a grouped palette of all available variables (System, Global, Local) for selection and insertion at the cursor position.
- **REQ-CPB-038 (Autocomplete)**: When the user types `{{` in the editor, the system shall display an autocomplete dropdown near the cursor showing all matching variables grouped by tier (🔧 System, 🌐 Global, 📌 Local), with real-time filtering, keyboard navigation (↑/↓/Enter/Tab/Esc), and mouse selection.
- **REQ-CPB-039 (Variable Name Sanitization)**: When a variable name is entered, the system shall sanitize it by replacing special characters with underscores, removing leading/trailing underscores, and enforcing a maximum length of 40 characters.

##### 3.4.1.5 Variable Substitution

- **REQ-CPB-040 (Substitution Priority)**: When variables are substituted, the system shall apply the following priority order (lowest to highest): **System < Global < Local**. If the same variable name exists in multiple tiers, the higher-priority tier's value shall take precedence.
- **REQ-CPB-041 (Substitution Pattern)**: The system shall match variables using the pattern `{{alphanumeric_underscore}}` and replace each occurrence with the resolved value.

##### 3.4.1.6 Send & Copy Actions

- **REQ-CPB-050 (Send via Button)**: When the "Send" button is clicked, the system shall perform variable substitution on the prompt content, close the Custom Prompt Builder modal, and send the fully resolved prompt to all active AI webviews.
- **REQ-CPB-051 (Send via Shortcut)**: When Ctrl+Enter is pressed while the Custom Prompt Builder is open, the system shall execute the same send behavior as clicking the Send button (REQ-CPB-050).
- **REQ-CPB-052 (Send Variable Resolution)**: When sending a prompt, the system shall resolve all variables as follows:
  - System variables shall be replaced with their runtime values (e.g., actual chat thread, last response, current time, active services).
  - Global variables shall be replaced with their stored values.
  - Local variables shall be replaced with their stored values.
- **REQ-CPB-053 (Unresolved Local Variable Prompt)**: When sending a prompt and one or more Local variables have no assigned value, the system shall display a popup dialog allowing the user to enter values for each unresolved local variable before proceeding with the send.
- **REQ-CPB-054 (Auto-Save on Send)**: When sending a prompt and unsaved changes exist, the system shall automatically save the prompt before executing the send.
- **REQ-CPB-055 (Last Used Timestamp)**: When a prompt is sent, the system shall update the prompt's `lastUsedAt` timestamp.
- **REQ-CPB-055A (System Variable Attachment Parity)**: When `{{chat_thread}}` or `{{last_response}}` is resolved during CPB send or main-input send from CPB context, the system shall apply the same text-to-attachment conversion rule used by existing large-text send logic (line/character threshold parity).
- **REQ-CPB-056 (Copy Prompt to Input)**: When the "Copy Prompt to Input" button is clicked, the system shall copy the prompt content to the main application's Prompt Input area with the following substitution rules:
  - System variables (`{{chat_thread}}`, `{{last_response}}`, `{{current_time}}`) shall **NOT** be substituted; they shall remain as `{{variable_name}}` placeholders.
  - Global variables shall **NOT** be substituted; they shall remain as `{{variable_name}}` placeholders.
  - Local variables that have assigned values shall be substituted with their stored values.
  - Local variables without assigned values shall remain as `{{variable_name}}` placeholders.
- **REQ-CPB-057 (Copy Prompt Modal Close)**: When the "Copy Prompt to Input" button is clicked and the prompt is successfully copied, the system shall close the Custom Prompt Builder modal and return focus to the main Prompt Input area.
- **REQ-CPB-058 (Copy Prompt Rationale)**: The system shall not substitute System and Global variable values into the Prompt Input area to prevent excessively long text (e.g., full chat threads) from being injected into the input field, which could trigger file-attachment conversion logic and degrade response quality.

##### 3.4.1.7 Import / Export

- **REQ-CPB-060 (Export)**: When the "Export" button is clicked, the system shall export all saved prompts and global variables as a JSON file. The exported data shall preserve variable placeholders (`{{variable_name}}`) as-is without substituting them with actual values. The filename shall follow the format `smc-prompts-{prompt_title}-{YYYYMMDD_HHmmss}.json`, where `{prompt_title}` is the currently selected prompt's title (sanitized for filesystem safety) and `{YYYYMMDD_HHmmss}` is the export timestamp.
- **REQ-CPB-061 (Import)**: When the "Import" button is clicked and a valid JSON file is selected, the system shall validate the file format (requiring `prompts` and `globalVars` keys) and overwrite the current data after user confirmation.
- **REQ-CPB-062 (Import Validation)**: When an imported file does not contain the required keys (`prompts`, `globalVars`) or fails JSON parsing, the system shall display an error message and abort the import.

##### 3.4.1.8 Backward Compatibility

- **REQ-CPB-070 (Legacy Prompt Compatibility)**: When the Custom Prompt Builder is opened, the system shall load and display any prompts previously saved by the existing "Add Custom Prompt" feature. Legacy prompts (without `localVars` or variable metadata) shall be treated as prompts with no local variables.
- **REQ-CPB-071 (Data Migration)**: Where legacy custom prompts exist in the old storage format (array of `{id, title, content, createdAt, lastUsedAt}`), the system shall migrate them to the new format by adding empty `localVars` arrays and `updatedAt` timestamps.
- **REQ-CPB-072 (Dual Storage)**: The system shall maintain backward-compatible storage by saving prompt data to both `electron-store` and `localStorage`, ensuring data availability regardless of access method.

##### 3.4.1.9 Data Persistence

- **REQ-CPB-080 (Prompt Storage)**: The system shall persist custom prompts with the following schema: `id` (UUID), `title` (string), `content` (string), `localVars` (array of `{name, value}`), `createdAt` (timestamp), `updatedAt` (timestamp), `lastUsedAt` (timestamp).
- **REQ-CPB-081 (Global Variable Storage)**: The system shall persist global variables independently from prompts using a dedicated storage key, with the schema: array of `{name, value}`.
- **REQ-CPB-082 (UI State Persistence)**: The system shall persist Custom Prompt Builder UI state including: sidebar collapsed state, variables panel collapsed state, panel widths, sort mode, and Zen mode state.
- **REQ-CPB-083 (Debounced Saving)**: When prompt or variable data changes, the system shall debounce save operations (approximately 250ms) to prevent excessive storage writes during rapid input.
- **REQ-CPB-084 (Auto-Save on Close)**: When the Custom Prompt Builder modal is closed and unsaved changes exist, the system shall automatically save the current prompt.
- **REQ-CPB-085 (Seed Data)**: When the prompt list is empty (first use), the system shall create sample prompts (e.g., "Fact Check 프롬프트", "천재적 사고 모드") to demonstrate the variable system.

### 3.5 Conversation History & Sidebar
- **REQ-HIST-001 (Persistence)**: The system shall automatically save the current session details (Active Services, Layout, URLs, Prompt Input State) to the local database upon significant interactions (e.g., sending a prompt) or application exit.
- **REQ-HIST-002 (Sidebar Toggle)**: The system shall provide a "Hamburger Menu" button to toggle the visibility of the Conversation History Sidebar.
- **REQ-HIST-003 (Sidebar State)**: When the application restarts, the system shall restore the sidebar to its last state (collapsed or expanded).
- **REQ-HIST-004 (History List)**: The system shall display a list of past conversation sessions in the sidebar, sorted by "Last Updated" timestamp (newest first).
- **REQ-HIST-005 (Lazy Loading)**: When scrolling through a large number of history items, the system shall load additional items dynamically (infinite scroll or pagination) to maintain performance.
- **REQ-HIST-006 (History Item Display)**: The system shall display each history item with a Title (defaulting to "YYYY-MM-DD HH:mm:ss" of creation/update) and a Context Menu trigger ("..." button).
- **REQ-HIST-007 (Item Interaction)**: When a history item is clicked, the system shall restore the full state of that session (Chat Mode, URLs, Prompt, Layout) and collapse the sidebar (if configured to do so). See REQ-MODE-060~066 for mode switching behavior.
- **REQ-HIST-008 (Context Menu)**: When the user hovers over a history item or clicks the context menu trigger, the system shall provide options to "Rename" and "Delete" the session.
- **REQ-HIST-009 (Rename)**: When "Rename" is selected, the system shall allow the user to modify the title of the history item inline or via a modal.
- **REQ-HIST-010 (Delete)**: When "Delete" is selected, the system shall require confirmation before permanently removing the session from the database.
- **REQ-HIST-011 (New Chat)**: When the "New Chat" button is clicked, the system shall save the current session state (ensuring the latest changes are persisted) and then reset the workspace to a fresh, default state (New Session ID).
- **REQ-HIST-012 (Bulk Selection Mode Entry)**: When the user activates "Selection Mode" in the History Sidebar, the system shall switch History Item clicks from "Open Session" to "Toggle Selection".
- **REQ-HIST-013 (Bulk Selection UI)**: While Selection Mode is enabled, the system shall display a selection control for each History Item and shall indicate selected items visually.
- **REQ-HIST-014 (Selected Count & Actions)**: While Selection Mode is enabled, the system shall display the number of selected History Items and shall provide actions to "Delete Selected" and "Cancel Selection Mode".
- **REQ-HIST-015 (Select All Loaded)**: While Selection Mode is enabled, when the user selects "Select All", the system shall select all currently loaded History Items in the sidebar list.
- **REQ-HIST-016 (Bulk Delete Confirmation)**: When the user triggers "Delete Selected", the system shall require confirmation before permanently deleting the selected sessions.
- **REQ-HIST-017 (Cancel / Escape)**: While Selection Mode is enabled, when the user cancels or presses Escape, the system shall exit Selection Mode and clear the current selection.
- **REQ-HIST-018 (Bulk Delete Persistence)**: When sessions are deleted via Bulk Delete, the system shall remove them from persistent storage and update the History Sidebar list.

### 3.6 External Interaction
- **REQ-EXT-001 (URL Bar)**: The system shall display the current URL of each Webview in a dedicated bar.
- **REQ-EXT-002**: The system shall allow the user to Copy the current URL or Open it in the system default browser (Chrome).
- **REQ-EXT-003 (Link Navigation)**: When a user clicks a link within a Webview that targets a domain not belonging to the Service (i.e., external link), the system shall intercept the navigation and open the URL in the system default browser.

### 3.7 Chat Mode (Single AI / Multi AI)

#### 3.7.1 Multi AI Mode (Default)
- **REQ-MODE-001**: While in **Multi AI Mode**, the system shall display service toggles for all supported AI services (ChatGPT, Claude, Gemini, Grok, Perplexity, Genspark).
- **REQ-MODE-002**: While in **Multi AI Mode**, the system shall allow the user to activate up to 4 different AI services simultaneously.
- **REQ-MODE-003**: While in **Multi AI Mode**, when more than 4 services are attempted to be activated, the system shall disable unchecked service toggles.

#### 3.7.2 Single AI Mode
- **REQ-MODE-010 (Mode Selection)**: When **Single AI Mode** is selected in the Chat Mode Settings modal, the system shall display a service selection interface (icon grid or dropdown).
- **REQ-MODE-011**: The system shall allow the user to select exactly one AI service for Single AI Mode.
- **REQ-MODE-012**: When an AI service is selected and "Apply" is clicked, the system shall switch to Single AI Mode with the chosen service.
- **REQ-MODE-013 (Instance Toggles)**: While in **Single AI Mode**, the system shall replace the multi-service toggles with up to 4 instance toggles for the selected service (e.g., "ChatGPT #1", "ChatGPT #2", "ChatGPT #3", "ChatGPT #4").
- **REQ-MODE-014**: While in **Single AI Mode**, the system shall display the selected service's icon alongside each instance label.
- **REQ-MODE-015 (Instance Activation)**: While in **Single AI Mode**, the system shall allow the user to activate or deactivate individual instances via their respective toggles.
- **REQ-MODE-016**: While in **Single AI Mode**, the system shall enforce a maximum of 4 active instances.
- **REQ-MODE-017 (Instance Webviews)**: While in **Single AI Mode**, for each active instance, the system shall create an independent BrowserView loading the selected service's URL.
- **REQ-MODE-018 (Session Partition)**: While in **Single AI Mode**, the system shall use a shared session partition (e.g., `persist:service-{service}`) by default, allowing all instances to share login state.
- **REQ-MODE-019 (Optional Independent Sessions)**: Where independent sessions are configured, the system shall use separate partitions (e.g., `persist:service-{service}-{index}`) for each instance.

#### 3.7.3 Mode Switching
- **REQ-MODE-020**: When switching from **Single AI Mode** to **Multi AI Mode**, the system shall remove all Single AI instances and restore the Multi AI service toggles.
- **REQ-MODE-021**: When switching from **Multi AI Mode** to **Single AI Mode**, the system shall hide the multi-service toggles and display instance toggles for the newly selected service.
- **REQ-MODE-022**: When the Chat Mode is switched, the system shall preserve the current layout selection if compatible with the new active view count.

#### 3.7.4 Feature Compatibility in Single AI Mode
- **REQ-MODE-030 (Prompt Sync)**: While in **Single AI Mode**, when the user sends a prompt, the system shall deliver the prompt text to all active instances simultaneously.
- **REQ-MODE-031 (File Upload Sync)**: While in **Single AI Mode**, when files are attached and uploaded, the system shall upload files to all active instances.
- **REQ-MODE-032 (Layout Compatibility)**: While in **Single AI Mode**, the system shall apply the same layout rules as Multi AI Mode based on the number of active instances.
- **REQ-MODE-033 (Scroll Sync)**: While in **Single AI Mode** and **Scroll Sync** is enabled, when the user scrolls in one instance, the system shall scroll all other active instances proportionally.
- **REQ-MODE-034 (Cross Check)**: While in **Single AI Mode**, when "Cross Check" is triggered, the system shall collect responses from all active instances and combine them for comparison.
- **REQ-MODE-035**: While in **Single AI Mode** and **Cross Check** is performed, the system shall label instance responses as "Instance #1", "Instance #2", etc. (or "(A)", "(B)" in Anonymous Mode).
- **REQ-MODE-036 (Anonymous Mode)**: While in **Single AI Mode** and **Anonymous Mode** is enabled, the system shall replace instance labels with aliases (e.g., "#1" -> "(A)", "#2" -> "(B)").
- **REQ-MODE-037 (Copy Chat Thread)**: While in **Single AI Mode**, when "Copy Chat Thread" is triggered, the system shall copy chat content from all active instances.
- **REQ-MODE-038 (Copy Last Response)**: While in **Single AI Mode**, when "Copy Last Response" is triggered, the system shall copy the last response from all active instances.
- **REQ-MODE-039 (New Chat)**: While in **Single AI Mode**, when "New Chat" is clicked, the system shall reset all active instances to their base service URL.
- **REQ-MODE-040 (WebView Header)**: While in **Single AI Mode**, each instance Webview shall display the standard header bar with URL display, Copy URL, Open in Chrome, Refresh, and Home buttons.

#### 3.7.5 Session Persistence for Single AI Mode
- **REQ-MODE-050**: When in **Single AI Mode** and the application exits, the system shall persist the current Chat Mode, selected service, active instances, and their URLs.
- **REQ-MODE-051**: When the application launches and the last session was in **Single AI Mode**, the system shall restore Single AI Mode with the previously selected service and instance states.
- **REQ-MODE-052**: When a history session recorded in **Single AI Mode** is restored, the system shall switch to Single AI Mode and load the saved instance URLs.
- **REQ-MODE-053**: The system shall store Chat Mode configuration in the session schema with fields: `chatMode`, `singleAiConfig.service`, `singleAiConfig.activeInstances`, and `singleAiConfig.urls`.

#### 3.7.6 History Session Restoration & Mode Switching
- **REQ-MODE-060 (Mode Detection)**: When a history session is selected for restoration, the system shall read the `chatMode` field from the session data to determine the required mode.
- **REQ-MODE-061 (Legacy Session Handling)**: When a history session does not contain a `chatMode` field (legacy session), the system shall treat it as a **Multi AI Mode** session.
- **REQ-MODE-062 (Multi to Single Transition)**: When the current mode is **Multi AI Mode** and a **Single AI Mode** history session is restored, the system shall:
  1. Switch to Single AI Mode with the session's saved service
  2. Restore the saved instance states and URLs
  3. Update the toggle UI to display instance toggles
- **REQ-MODE-063 (Single to Multi Transition)**: When the current mode is **Single AI Mode** and a **Multi AI Mode** history session is restored, the system shall:
  1. Switch to Multi AI Mode
  2. Restore the saved active services and URLs
  3. Update the toggle UI to display service toggles
- **REQ-MODE-064 (Same Mode Restoration)**: When the current mode matches the history session's mode, the system shall restore the session state without mode switching overhead.
- **REQ-MODE-065 (Confirmation on Mode Change)**: When restoring a history session would trigger a mode change, the system may optionally display a confirmation dialog informing the user of the mode switch.
- **REQ-MODE-066 (History Item Mode Indicator)**: The system shall visually indicate the Chat Mode of each history item in the History Sidebar (e.g., icon badge or label showing "Multi" or "Single").

## 4. Technical Architecture

### 4.1 Data Persistence
- **Session Store**: `electron-store` for lightweight configuration (toggles, window bounds, last active session ID, chat mode settings, custom prompts, global variables).
- **History Database**: `IndexedDB` (via **idb** or similar wrapper) for storing robust conversation records.
  - **Store Name**: `conversations`
  - **Schema (v2)**: Includes:
    - `id` (UUID), `title`, `createdAt`, `updatedAt`
    - `chatMode` ("multi" | "single")
    - `multiAiConfig`: { `activeServices` (array), `urls` (object) }
    - `singleAiConfig`: { `service` (string), `activeInstances` (boolean[4]), `urls` (object) }
    - `layout` (string)
    - `controls`: { `anonymousMode` (boolean), `scrollSync` (boolean) }
    - `promptState` (text, files, options)
- **Custom Prompt Builder Storage**:
  - **electron-store keys**:
    - `customPrompts`: Array of prompt objects `{ id, title, content, localVars: [{name, value}], createdAt, updatedAt, lastUsedAt }`
    - `customPromptGlobalVars`: Array of global variable objects `{ name, value }`
    - `customPromptUIState`: Object `{ sidebarCollapsed, varsCollapsed, sidebarWidth, varsWidth, sortMode, zen }`
  - **localStorage keys** (dual persistence for renderer-side access):
    - `smc_prompts_v1`: Same schema as electron-store `customPrompts`
    - `smc_global_vars_v1`: Same schema as electron-store `customPromptGlobalVars`
    - `smc_ui_v1`: Same schema as electron-store `customPromptUIState`

### 4.2 Inter-Process Communication (IPC)
- **Renderer-to-Main**:
  - `set-layout`, `send-prompt-with-files`, `save-temp-file`, `cross-check`, `get-all-webview-urls`, `open-external-link`.
  - **History IPCs**: `history-get-all`, `history-save`, `history-delete`, `history-rename`.
  - **Chat Mode IPCs**: `set-chat-mode`, `set-single-ai-config`, `toggle-single-instance`, `get-chat-mode`.
  - **Custom Prompt Builder IPCs**:
    - `get-custom-prompts`: Retrieve all saved custom prompts from electron-store.
    - `save-custom-prompts`: Persist the entire custom prompts array to electron-store.
    - `get-custom-prompt-global-vars`: Retrieve global variables from electron-store.
    - `save-custom-prompt-global-vars`: Persist global variables to electron-store.
    - `cross-check-with-custom-prompt`: Send a fully-resolved custom prompt to all active webviews (with variable substitution performed in renderer, system variables resolved via main process).
- **Main-to-Renderer**:
  - `file-upload-complete`, `url-changed`, `chat-mode-changed`, `single-ai-instance-url-changed`.
  - `custom-prompt-system-vars`: Response containing runtime system variable values (chat_thread, last_response, current_time, active_services) for variable substitution.

### 4.3 External Login Implementation
- Uses **Puppeteer** with `puppeteer-extra-plugin-stealth` for resilient external login flows.
- Cookie synchronization from Puppeteer Chrome instance to Electron BrowserViews.

### 4.4 Single AI Mode View Management
- **Multi AI Views**: Managed in `views` object keyed by service name (e.g., `{ chatgpt: BrowserView, claude: BrowserView }`).
- **Single AI Views**: Managed in `singleModeViews` object keyed by instance identifier (e.g., `{ 'chatgpt-0': BrowserView, 'chatgpt-1': BrowserView }`).
- **Partition Strategy**:
  - Shared Session (default): `persist:service-{service}` - all instances share login state.
  - Independent Session (optional): `persist:service-{service}-{index}` - each instance has separate cookies/storage.

## 5. Non-Functional Requirements
- **NFR-001 (Performance)**: The application shall not freeze during file uploads or large history loading; database operations shall be asynchronous.
- **NFR-002 (Encoding)**: All persisted text files and database entries shall be **UTF-8** encoded to support international characters.
- **NFR-003 (Privacy)**: No user data shall be transmitted to third parties other than the direct AI service providers.
- **NFR-004 (UX)**: The UI shall follow modern design principles with responsive animations (e.g., Sidebar transitions) and intuitive interactions.
- **NFR-005 (Memory)**: While in Single AI Mode with multiple instances, the application shall manage BrowserView resources efficiently to minimize memory overhead.
- **NFR-006 (Backward Compatibility)**: Sessions saved in previous versions (without Chat Mode) shall be treated as Multi AI Mode sessions when restored.
- **NFR-007 (Mode Clarity)**: The UI shall clearly indicate the current Chat Mode (Multi AI or Single AI) to prevent user confusion.
- **NFR-008 (Custom Prompt Builder Performance)**: The Custom Prompt Builder shall respond to user interactions (search, sort, variable substitution, autocomplete) within 200ms to ensure fluid editing experience.
- **NFR-009 (Variable Substitution Safety)**: System and Global variable values shall not be injected into the main Prompt Input area via "Copy Prompt to Input" to prevent excessively long text from triggering unintended file-attachment conversion and degrading AI response quality.

## 6. Revision History

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2025-12-01 | Initial unified SRS |
| 2.0 | 2026-01-08 | Added Chat Mode (Single AI / Multi AI) requirements (REQ-MODE-001~053) |
| 2.1 | 2026-01-08 | Added History Session Restoration & Mode Switching requirements (REQ-MODE-060~066), Updated REQ-HIST-007 |
| 3.0 | 2026-02-06 | Added Custom Prompt Builder requirements (REQ-CPB-001~085): 3-panel editor layout, 3-tier variable system (System/Global/Local), variable substitution engine, Send with full resolution, Copy Prompt to Input with selective resolution, Import/Export, backward compatibility with legacy prompts. Added NFR-008~009. Updated terminology, data persistence schema, and IPC channels. Removed `{{active_services}}` system variable. Updated Export to preserve variable placeholders and include prompt title + timestamp in filename. |