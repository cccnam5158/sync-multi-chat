# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sync Multi Chat (code name: MAPB - Multi AI Prompt Broadcaster) is an Electron desktop application that broadcasts prompts to multiple AI services (ChatGPT, Claude, Gemini, Grok, Perplexity, Genspark) simultaneously and displays responses side-by-side.

## Development Commands

```bash
npm install          # Install dependencies (runs electron-rebuild automatically)
npm start            # Launch in development mode
npm run build:portable  # Create portable Windows executable (dist-packager/)
npm run build        # Create NSIS installer (dist/)
```

## Architecture

### Process Model (Electron)
- **Main Process** (`src/main/main.js`): Creates BrowserWindow + multiple BrowserViews (one per AI service), handles IPC, manages session persistence via `electron-store`
- **Renderer Process** (`src/renderer/renderer.js`): UI logic, user input handling, history management
- **Preload Scripts**:
  - `src/main/preload.js`: Main window API bridge
  - `src/preload/service-preload.js`: Injected into each AI service webview for DOM manipulation

### Key Components
- **BrowserViews**: Each AI service runs in an isolated BrowserView with its own partition (`persist:service-{name}`) for cookie/session isolation
- **Selectors Config** (`src/config/selectors.json`): CSS selectors for interacting with each AI service's DOM (input fields, send buttons, response elements)
- **History Manager** (`src/renderer/history-manager.js`): IndexedDB-based conversation history using the `idb` library

### IPC Communication Pattern
- Renderer → Main: `window.electronAPI.{method}()` calls defined in preload
- Main → Renderer: `mainWindow.webContents.send()` / `view.webContents.send()`
- Key channels: `send-prompt`, `new-chat`, `copy-chat-thread`, `cross-check`, `set-layout`, `toggle-service`

### Data Persistence
- **electron-store**: Session state (active services, layout, URLs, toggles)
- **IndexedDB**: Conversation history (store: `conversations`)

## Service Integration

When adding or modifying AI service support:
1. Add service URL to `serviceUrls` in main.js
2. Add domain whitelist to `serviceDomains` for external link handling
3. Create selector configuration in `src/config/selectors.json` with:
   - `inputSelector`: Text input element
   - `sendButtonSelector`: Submit button
   - `fileInputSelector`: File upload input
   - `lastResponseSelector`: Latest AI response element
   - `copyStrategy`: Either `"turndown"` (HTML→Markdown) or `"text"`

## Notes

- Uses `puppeteer-extra-plugin-stealth` and various Chrome flags to avoid bot detection
- File uploads use a two-step flow: inject files first, then send prompt
- Anonymous mode replaces service names with aliases (A, B, C...) for unbiased cross-checking
- Always use Context7 MCP tools for code generation, setup steps, or library documentation
