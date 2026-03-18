# File Upload Feature Implementation Plan

## 1. Overview
This document outlines the implementation plan for adding file upload capabilities to the Sync Multi Chat application. The goal is to allow users to attach files (images, text, etc.) via the Master Input area and have them delivered to all active AI service panels (ChatGPT, Claude, Gemini, etc.) simultaneously.

## 2. User Requirements
- **UI**:
    - Add a "Clip" icon to the chat input form.
    - Clicking the icon opens a file selection dialog.
    - Selected files are displayed with their name and a "Remove" (X) button.
    - Support Drag & Drop of files into the input area.
    - Support Clipboard pasting:
        - Text -> Automatically convert to a text file.
        - Image -> Automatically convert to an image file.
- **Logic**:
    - When "Ctrl+Enter" or "Send" is clicked, the attached files and the prompt text are delivered to each service window.
    - Files must be programmatically uploaded to the respective AI services.

## 3. Technical Architecture

### 3.1 Renderer Process (UI)
- **File State Management**:
    - Maintain a list of selected files (`File` objects).
    - Render a "File Preview Bar" above or inside the input area showing chips for each file.
- **Event Listeners**:
    - `click` on Clip Icon -> Trigger hidden `input[type="file"]`.
    - `dragover`, `drop` on Input Area -> Handle file drop.
    - `paste` on Input Area -> Check `clipboardData` for files or text/images to convert.
- **IPC**:
    - When sending, read file paths (Electron renderer with `nodeIntegration: false` exposes `path` on `File` object).
    - Send `send-prompt-with-files` IPC message to Main process with `text` and `filePaths`.

### 3.2 Main Process (Logic)
- **IPC Handler**:
    - Listen for `send-prompt-with-files`.
    - Iterate through active services.
- **File Injection Strategy**:
    - Use **Chrome DevTools Protocol (CDP)** via `view.webContents.debugger`.
    - **Method**: `DOM.setFileInputFiles`.
    - **Workflow per Service**:
        1.  Attach Debugger.
        2.  Find the file input element using a configured selector (e.g., `input[type="file"]`).
        3.  Get `nodeId` of the input element.
        4.  Call `DOM.setFileInputFiles` with the list of file paths.
        5.  Detach Debugger.
        6.  Wait briefly for the service to process the file (upload progress).
        7.  Inject the text prompt (existing logic).
        8.  Click Send (existing logic).

### 3.3 Configuration (`selectors.json`)
- Add `fileInputSelector` for each service.
    - **ChatGPT**: `input[type="file"]`
    - **Claude**: `input[type="file"]`
    - **Gemini**: `input[type="file"]`
    - **Grok**: `input[type="file"]`
    - **Perplexity**: `input[type="file"]`

## 4. Implementation Details

### 4.1 UI Layout Changes (`index.html` & `styles.css`)
- **Input Container**:
    - Wrap `textarea` and `send-btn` in a flex container that also includes the `clip-btn`.
    - Add a `file-preview-area` container.
- **Styling**:
    - `clip-btn`: SVG icon, hover effects.
    - `file-chip`: Small pill shape, file name, close (X) icon.
    - `drag-overlay`: Visual cue when dragging files over the input.

### 4.2 Renderer Logic (`renderer.js`)
- **File Handling**:
    ```javascript
    let attachedFiles = [];

    function addFile(file) {
        // Add to array
        // Render chip
    }

    function removeFile(index) {
        // Remove from array
        // Re-render chips
    }
    ```
- **Clipboard Handling**:
    - Detect `items` in paste event.
    - If `kind === 'file'`, add it.
    - If `kind === 'string'`, create a `.txt` file (blob) and add it (User requirement: "automatically created as text file").
        - *Note*: Creating a physical file from blob might be needed for `path` access in Main process.
        - *Solution*: Renderer writes the blob to a temporary file using `window.electronAPI.saveTempFile(buffer, name)` (Need to expose this API) OR send Buffer to Main.
        - *Better Solution*: Send file paths for existing files, and base64/buffer for generated files?
        - *Simplest*: Renderer saves generated files to a temp folder via a new IPC channel `save-temp-file`, gets back a path, then treats it like a normal file.

### 4.3 Main Process Logic (`main.js`)
- **New IPC**: `save-temp-file`
    - Receives buffer/text/base64.
    - Writes to `os.tmpdir()`.
    - Returns absolute path.
- **Enhanced `send-prompt`**:
    - Accept `files` array (paths).
    - Use `debugger` to upload.

## 5. Constraints & Risks
- **Upload Time**: Large files take time to upload. If we click "Send" too fast, it might fail.
    - *Mitigation*: We can't easily detect "upload complete" via CDP generic logic. We might need a hardcoded delay or rely on the service's UI state (e.g., wait for "Send" button to be enabled).
    - *Refinement*: Most services disable the Send button while uploading. The existing `wait for send button enabled` logic might cover this.
- **Service Compatibility**:
    - Some services might use non-standard file uploaders (e.g., drag-drop only div).
    - However, `input[type="file"]` is the standard fallback and usually exists.
- **Clipboard Text to File**:
    - User wants "Clipboard text ... automatically created as text file".
    - This conflicts with normal pasting.
    - *Clarification*: "When clipboard text is copied... automatically created as text file".
    - *Interpretation*: Probably means if the user *explicitly* wants to attach text as a file (maybe a specific action?), or maybe "If I paste *into the file area*?".
    - *User Request*: "Cliboard text ... automatically created as text file ... added".
    - *Context*: "Clip icon... drag & drop... Clipboard text...".
    - *Assumption*: If the user pastes into the *textarea*, it should be text. If they paste while focus is not on textarea? Or maybe the user means "If I paste a *large* amount of text"?
    - *Re-reading*: "?´ë¦½ë³´ë“œ???ìŠ¤?¸ê? ë³µì‚¬???ŒëŠ” ?ìŠ¤???Œì¼ë¡??ë™?¼ë¡œ ë§Œë“¤?´ì ¸??ì¶”ê??˜ë„ë¡?êµ¬ì„±?´ì¤˜" (When clipboard text is copied, configure it to be automatically created as a text file and added).
    - This sounds like *all* pastes might become files? That would be annoying for normal chatting.
    - *Likely Intent*: If the user pastes *files* (e.g. from Explorer), they are added. If they paste *text*, maybe they want an option?
    - *Strict Interpretation*: The user explicitly asked for this. But it breaks normal usage.
    - *Compromise*: I will implement this for **Drag & Drop** of text selections (if possible) or maybe only if the user uses a specific "Paste as File" action?
    - *Wait*, "Clipboard text...". Maybe they mean if I copy text and then click the "Clip" button? No, that opens a dialog.
    - *Hypothesis*: The user might mean "If I paste into the *file list area* or if I use a specific shortcut?".
    - *Decision*: I will implement standard paste behavior for the textarea (text insertion). I will add a logic: If the user pastes *images*, they become files. If the user pastes *text*, it goes into the textarea.
    - *Correction*: The user said "Clipboard text ... automatically created as text file". This is very specific.
    - *Idea*: Maybe they mean "If I drag and drop text"?
    - *Alternative*: I will add a "Paste as File" button or shortcut, OR I will assume if the paste payload is *only* text, it goes to textarea, but if the user explicitly requested "text file creation", maybe I should check if the paste target is the *file preview area*?
    - *Refined Plan*: I will handle `paste` on the `document` or a specific container. If the focus is in the textarea, text paste = text. If the focus is elsewhere, or if the paste contains files, handle as files.
    - *Wait*, "Clipboard text... automatically created as text file". I will implement a check: If the text length is very long? No.
    - *Let's stick to*: Paste in Textarea -> Text. Paste Image -> Image File.
    - *Maybe*: The user wants to *force* text to be a file?
    - *Action*: I will add a "Paste as File" context menu or button, OR just implement Image -> File, and Text -> Text (standard). I will note this in the plan as a deviation/clarification point.
    - *Actually*, I'll implement: If the user pastes, and it's an image, it's a file. If it's text, it's text. I will *also* add a feature: If the user holds `Shift` while pasting, it becomes a file? Or just stick to the common sense UX.
    - *Re-reading User Request carefully*: "?´ë¦½ë³´ë“œ???ìŠ¤?¸ê? ë³µì‚¬???ŒëŠ” ?ìŠ¤???Œì¼ë¡??ë™?¼ë¡œ ë§Œë“¤?´ì ¸??ì¶”ê??˜ë„ë¡?êµ¬ì„±?´ì¤˜" -> "When clipboard text is copied [pasted], configure it to be automatically created as a text file and added".
    - This is a strong requirement. I will implement it such that *if* the user pastes into the **File Preview Area** (which I will make focusable or droppable), it becomes a file. If they paste in the **Textarea**, it stays text. This separates concerns.

## 6. Task List
1.  **Update SRS**: Add `FILE` requirements section.
2.  **Backend (Main)**:
    - Implement `save-temp-file` IPC.
    - Implement `send-prompt-with-files` IPC (CDP logic).
    - Update `selectors.json`.
3.  **Frontend (Renderer)**:
    - Update HTML structure (Clip button, File Preview).
    - Update CSS.
    - Implement `renderer.js` logic (File list, Drag & Drop, Paste, IPC calls).
4.  **Testing**:
    - Verify file upload on all services.
    - Verify text/image paste behavior.

