# Ideation: Copy Chat Thread Improvements (Hybrid Extraction & Enhanced UX)

## 1. Executive Summary
The current "Copy Chat Thread" feature relies on simple text extraction (`innerText`), which leads to loss of formatting (code blocks, tables, LaTeX). This proposal aims to implement a **Hybrid Extraction Strategy** that prioritizes high-fidelity copying using AI services' native copy buttons, falls back to HTML-to-Markdown conversion (Turndown), and finally to structured text. It also introduces format selection (Markdown/JSON/Text) and improved UX feedback.

## 2. Core Features & Improvements

### 2.1 Hybrid Extraction Strategy
To ensure the highest quality export, we will implement a tiered approach:

1.  **Tier 1: Native Copy Button (Best Quality)**
    *   **Mechanism**: Programmatically click the service's own "Copy" button (e.g., `button[data-testid="copy-turn-action-button"]` for ChatGPT) and read from the clipboard.
    *   **Pros**: Preserves perfect formatting, including LaTeX, complex tables, and syntax highlighting as rendered by the service.
    *   **Cons**: Requires clipboard access, slightly slower (sequential interaction), depends on UI stability.

2.  **Tier 2: Turndown Conversion (High Quality)**
    *   **Mechanism**: Extract the `innerHTML` of the message container and convert it to Markdown using the `turndown` library with GFM (GitHub Flavored Markdown) plugin.
    *   **Pros**: Fast, reliable for standard formatting (headers, lists, code blocks).
    *   **Cons**: May miss complex custom rendering (specific LaTeX implementations) unless custom rules are added.

3.  **Tier 3: Structured Text (Fallback)**
    *   **Mechanism**: The current implementation (parsing DOM for specific text nodes).
    *   **Pros**: Failsafe, works even if UI changes drastically.
    *   **Cons**: Loss of rich formatting.

### 2.2 Export Formats
Users will be able to select the desired output format via a setting or UI toggle:
*   **Markdown (Default)**: Best for documentation and sharing.
*   **JSON**: Structured data (role, content, timestamp) for programmatic use or dataset creation.
*   **Plain Text**: Simple text dump (legacy behavior).

### 2.3 UX Enhancements
*   **Granular Feedback**: Instead of a single "Copied!" message, show status per service (e.g., "ChatGPT: Success, Claude: Failed").
*   **Progress Indication**: Visual indicator while iterating through services (especially for Native Copy which takes time).
*   **Anonymous Mode Integration**: If Anonymous Mode is active, replace service names (e.g., "ChatGPT" -> "Service A") in the exported content.

## 3. Technical Implementation

### 3.1 Architecture Changes
*   **`src/config/selectors.json`**: Expand to include:
    *   `copyButtonSelector`: Selector for the native copy button.
    *   `markdownContainerSelector`: Selector for the container to pass to Turndown.
    *   `copyStrategy`: Preferred strategy (`native`, `turndown`, `hybrid`).
*   **`src/main/main.js`**:
    *   Refactor `extractTextFromService` to `extractContentFromService`.
    *   Implement the Hybrid Strategy logic.
    *   Handle format conversion (JSON/Markdown construction).
*   **`src/preload/service-preload.js`**:
    *   Inject `turndown` library (or handle conversion in Main process if possible/performant).
    *   Add helper functions to click buttons and read clipboard.

### 3.2 Data Structure (Internal)
Regardless of the output format, we should aim to extract data into an intermediate structure:
```json
[
  {
    "service": "ChatGPT",
    "messages": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." }
    ],
    "metadata": { "model": "GPT-4", "timestamp": "..." }
  }
]
```

### 3.3 Turndown Integration
*   Use `turndown` and `turndown-plugin-gfm`.
*   Since `require` might not be available in the renderer (depending on `nodeIntegration`), we might need to:
    1.  Bundle Turndown into the preload script.
    2.  Or, send HTML to Main process and convert there (safer, keeps Renderer light). **Decision: Convert in Main Process to avoid bloating preload.**

## 4. Risks & Mitigations
*   **Clipboard Interference**: Native Copy uses the system clipboard. We must ensure we save/restore the user's clipboard or block user interaction during the process.
    *   *Mitigation*: Use `navigator.clipboard` API where possible, or inform user "Copying..." to prevent manual interference.
*   **Selector Fragility**: Native buttons and DOM structures change.
    *   *Mitigation*: Keep the Tier 3 (Text) fallback robust. Add a "Selector Health Check" feature in the future.
*   **Performance**: Native copy is slower.
    *   *Mitigation*: Run in parallel where possible, but clipboard access is usually a singleton resource. We may need to serialize the Native Copy part (Service A -> Copy -> Read -> Service B...). Turndown is fast and can be parallel.

## 5. Roadmap
1.  **Phase 1**: Implement Turndown conversion (Tier 2) and JSON/Markdown formatting. Update `selectors.json`.
2.  **Phase 2**: Implement Native Copy (Tier 1) for services where it's reliable (ChatGPT, Gemini).
3.  **Phase 3**: UI updates for Format selection and detailed feedback.
