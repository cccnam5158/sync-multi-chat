# Ideation: Integrate Genspark Service

## 1. Feature Summary
- **Add New Service**: Integrate **Genspark** (https://www.genspark.ai/agents?type=ai_chat) into the Multi-AI Chat application.
- **Placement**: Add "Genspark" toggle button after "Perplexity".
- **Anonymous Mode**: Use "(F)" as the anonymous alias for Genspark.
- **Layout**: Maintain existing layout options; Genspark will be just another service that can be toggled.

## 2. Implementation Plan

### A. Configuration (`src/config/selectors.json`)
- Add entry for `genspark`.
- **Selectors**:
    - **Input**: `textarea[name='query']`, `textarea.search-input`
    - **Send Button**: `div.enter-icon-wrapper`, `div.input-icon`
    - **Content**: `div.conversation-statement.assistant.plain-text` or `div.model-response-wrapper`
    - **Response Extraction**: Focus on capturing the aggregate response or the specific model responses within the container.
    - **Url**: `https://www.genspark.ai/agents?type=ai_chat`

### B. Renderer Process (`src/renderer/renderer.js` & `src/index.html`)
- **Webview Initialization**: Update the list of services to include 'genspark'.
- **Order**: Ensure 'genspark' comes after 'perplexity'.
- **Anonymous Mapping**: Map 'genspark' to "(F)".
- **Toggle UI**: Add the HTML toggle switch for Genspark in `index.html`.

### C. Cookie & Element Handling
- **Cookies**: Ensure proper cookie persistence for `genspark.ai`.
- **Input Element**: The input is a `textarea` with class `search-input`.
- **Response Element**: The response is likely in `div.conversation-statement.assistant` or similar.

## 3. HTML Structure Analysis (from User)
**Chat Input**:
```html
<textarea name="query" class="search-input ..."></textarea>
<div class="enter-icon-wrapper ...">...</div>
```
**Response**:
```html
<div class="conversation-statement assistant plain-text">
  ... <div class="model-response"> ... </div>
</div>
```

## 4. Verification
- Verify Genspark loads correctly.
- Verify messaging works (input/send).
- Verify response extraction works for "Copy Last Response".
- Verify Anonymous mode shows "(F)".
