# Ideation: Copy Chat Thread Feature

## Feature Summary
Implement a "Copy Chat Thread" functionality that allows users to copy the entire conversation history (user prompts and AI responses) from all active AI service panels to the system clipboard with a single click.

## User Story
As a user, I want to easily capture the full context of my conversations across different AI models so that I can save, compare, or share the results without manually copying text from each panel.

## Implementation Plan

### 1. User Interface (Renderer)
- **Location**: Add a "Copy Chat Thread" button in the control panel, specifically to the left of the service toggle buttons (adjacent to the "New Chat" button).
- **Styling**: Use a style consistent with the existing "New Chat" button but potentially a different color (e.g., Blue or Gray) to distinguish it.
- **Interaction**: Clicking the button triggers an IPC message to the main process.

### 2. IPC Communication
- **Channel**: `copy-chat-thread`
- **Flow**: Renderer -> Main -> (Extract Data) -> Main (Write to Clipboard) -> Renderer (Optional: Success Notification)

### 3. Content Extraction (Main Process)
The main process will iterate through all *active* (enabled) service views and execute JavaScript to extract the text content.

#### Extraction Strategy
To ensure robustness against 3rd-party UI changes, we will use a tiered strategy:
1.  **Configured Selector**: Check `selectors.json` for a specific `contentSelector` for the service.
2.  **Semantic Tag**: Try to find a `<main>` tag or an element with `role="main"`.
3.  **Fallback**: Use `document.body.innerText` (least desirable due to noise).

#### Data Formatting
The copied text will be formatted to clearly distinguish between services:

```text
=== ChatGPT ===
[User]: ...
[AI]: ...

=== Claude ===
...
```
*Note: Distinguishing User vs AI specifically might be hard without complex parsing. For MVP, we will capture the raw text of the chat container, which usually preserves the visual order of the conversation.*

### 4. Configuration Updates (`selectors.json`)
We need to investigate and add `contentSelector` for each service.

- **ChatGPT**: Usually `<main>` or `.flex-1.overflow-hidden` container.
- **Claude**: Often a specific `div` inside the main layout.
- **Gemini**: `<main>` or specific scrollable container.

## Constraints & Challenges

### 1. DOM Instability
**Challenge**: AI providers frequently update their DOM structure (class names, IDs).
**Mitigation**:
- Use robust selectors where possible (e.g., `main`, `role`).
- Allow selectors to be configurable via `selectors.json` so they can be updated without code changes.
- Implement the fallback mechanism (`document.body.innerText`) so the feature still works (albeit with some noise) even if selectors break.

### 2. Asynchronous Execution
**Challenge**: `executeJavaScript` is asynchronous. One slow service could delay the clipboard operation.
**Mitigation**:
- Use `Promise.all` to run extractions in parallel.
- Implement a timeout for each service (e.g., 2 seconds) so one hung service doesn't block the whole action.

### 3. Content "Noise"
**Challenge**: Simply grabbing `innerText` might include "Regenerate", "Copy", or "Bad response" buttons/text.
**Mitigation**:
- Ideally, target the specific message bubbles, but that requires complex list selectors.
- For MVP, accept some noise.
- Future improvement: Use specific selectors to exclude `.sr-only` or button text if possible.

## Proposed Solution Steps
1.  **Update `selectors.json`**: Add `contentSelector` for ChatGPT, Claude, and Gemini.
2.  **Update `index.html`**: Add the `<button id="copy-chat-btn">`.
3.  **Update `renderer.js`**: Add click listener and IPC call.
4.  **Update `preload.js`**: Expose `copyChatThread` API.
5.  **Update `main.js`**:
    - Implement `ipcMain.on('copy-chat-thread', ...)` handler.
    - Implement the extraction logic using `Promise.all` over active views.
    - Format and write to clipboard.
