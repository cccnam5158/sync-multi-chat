# File Upload Feasibility Study

## 1. Overview
This document outlines the feasibility and technical approach for implementing a simultaneous file upload feature in the Sync Multi Chat application. The goal is to allow users to upload a file via the main chat interface and have it automatically injected and uploaded to all active AI services (ChatGPT, Claude, Gemini, etc.) along with the prompt.

## 2. Current Architecture
- **Renderer**: The chat interface (`renderer.js`) captures text input and sends it via IPC (`send-prompt`) to the main process.
- **Main Process**: `main.js` receives the text and broadcasts it to active `BrowserView` instances using `webContents.send('inject-prompt')`.
- **Preload**: `service-preload.js` receives the text and injects it into the target website's DOM using selectors defined in `selectors.json`.
- **Limitation**: Currently, only text string injection is supported. There is no mechanism to pass binary file data or trigger file inputs.

## 3. Proposed Solution
To support file uploads, we need to extend the current pipeline to handle file data.

### 3.1. Renderer Layer
- Add a file input button (clip icon) to the chat interface.
- When a file is selected, read it as an `ArrayBuffer` or Base64 string.
- Update `sendPrompt` to accept an optional `attachment` object `{ name, type, data }`.

### 3.2. IPC Layer
- Modify the `send-prompt` IPC channel to accept the attachment data.
- Ensure efficient transfer of binary data (Electron handles Buffer serialization well).

### 3.3. Preload Layer
- Update `inject-prompt` listener to receive the attachment.
- Implement a `uploadFile(fileData)` function that:
    1. Converts the raw data back to a `File` object.
    2. Creates a `DataTransfer` object.
    3. Locates the hidden `<input type="file">` element on the target website.
    4. Assigns `dataTransfer.files` to the input's `files` property.
    5. Dispatches a `change` event to trigger the website's upload logic.

## 4. Technical Implementation Details

### 4.1. Finding the File Input
Most AI services use a hidden file input for uploads. We need to identify the CSS selectors for these inputs.

**Anticipated Selectors (Subject to Verification):**
- **ChatGPT**: `input[type="file"]` (usually present in the DOM).
- **Claude**: `input[type="file"]` (often associated with the attachment button).
- **Gemini**: `input[type="file"]` (usually hidden within the rich text editor wrapper).
- **Grok/Perplexity**: Need investigation, but likely similar.

### 4.2. Handling Upload State
- **Async Uploads**: Uploading a file takes time. The application should ideally wait for the upload to complete before sending the prompt.
- **Visual Feedback**: The user needs to know if the upload failed on any service.
- **Strategy**: 
    - Inject the file first.
    - Wait for a short delay or observe the DOM for "upload complete" indicators (e.g., a thumbnail appearing).
    - Then inject the text and submit.

## 5. Service-Specific Considerations

| Service | Feasibility | Complexity | Notes |
| :--- | :--- | :--- | :--- |
| **ChatGPT** | High | Medium | Standard file input. Need to handle potential "analyzing" state. |
| **Claude** | High | Medium | Supports PDF/Text/Images. Strict file size/type limits. |
| **Gemini** | High | Medium | Image/PDF support. |
| **Grok** | Medium | Unknown | Need to verify if file upload is available in the web UI. |
| **Perplexity** | Medium | Unknown | Primarily for search, but "Pro" mode allows uploads. |

## 6. Risks and Challenges
- **DOM Changes**: Services frequently update their DOM. Selectors must be robust and easily updatable (`selectors.json`).
- **Security Restrictions**: Browsers prevent programmatic setting of file inputs for security, but Electron's `preload` script has enough privilege to use `DataTransfer` to bypass this for automation purposes.
- **File Size Limits**: Each service has different limits. We should enforce a conservative limit (e.g., 10MB) in our app.

## 7. Conclusion
Implementing simultaneous file upload is **FEASIBLE**. The core mechanism relies on standard HTML5 `DataTransfer` APIs within the preload script, which is a proven technique for Electron automation.

## 8. Next Steps
1.  **Update `selectors.json`**: Add `fileInputSelector` for all services.
2.  **Update Renderer**: Add UI for file selection.
3.  **Update Main/Preload**: Implement the `DataTransfer` logic.
4.  **Testing**: Verify with various file types (images, PDFs) across all services.
