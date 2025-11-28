# Ideation: Add Grok, Perplexity and Layout Options

## 1. Feature Summary
- **Add New Services**: Integrate **Grok** (https://grok.com/) and **Perplexity** (https://www.perplexity.ai/) into the Multi-AI Chat application.
- **Layout Options**: Add layout selection buttons (**1x3**, **1x4**, **2x2**) to the control bar.
- **Dynamic Layout Logic**:
    - Automatically select **1x3** if < 3 services are active.
    - Enable **1x4** and **2x2** only if >= 4 services are active.
    - Limit active services to a maximum of 4. If a 5th is selected, show a warning or disable the remaining toggles.

## 2. Implementation Plan

### A. Configuration (`src/config/selectors.json`)
- Add entries for `grok` and `perplexity`.
- **Selectors (Tentative)**:
    - **Grok**:
        - `inputSelector`: `["textarea[placeholder*='Ask Grok']", "textarea"]`
        - `sendButtonSelector`: `["button[aria-label='Send']", "button[type='submit']"]`
    - **Perplexity**:
        - `inputSelector`: `["textarea[placeholder*='Ask']", "textarea"]`
        - `sendButtonSelector`: `["button[aria-label='Submit']", "button[type='submit']"]`

### B. Main Process (`src/main/main.js`)
- **Update Services List**: Add `'grok'` and `'perplexity'` to the `services` array.
- **Update URLs**: Add URLs to `serviceUrls`.
- **Layout Management**:
    - Introduce `currentLayout` state (default: `'1x3'`).
    - Update `updateLayout()` function to calculate view bounds based on `currentLayout` and `enabledServices.length`.
        - **1x3 / 1x4**: Horizontal split (existing logic, just different divisor).
        - **2x2**: Grid split.
            - Index 0: Top-Left
            - Index 1: Top-Right
            - Index 2: Bottom-Left
            - Index 3: Bottom-Right
    - **IPC Handlers**:
        - `set-layout`: Receive layout change requests from renderer.

### C. Renderer Process (`src/renderer/index.html` & `src/renderer/renderer.js`)
- **UI Updates**:
    - Add Toggle Buttons for Grok and Perplexity in `#toggles`.
    - Add Layout Buttons group (1x3, 1x4, 2x2) next to Scroll Sync button.
- **Logic Updates**:
    - **Service Toggling**:
        - Monitor number of checked toggles.
        - If count < 3: Force Layout to 1x3 (or auto-fit).
        - If count >= 4: Enable 1x4 and 2x2 buttons.
        - **Constraint**: Max 4 services. If user tries to enable 5th, prevent it and alert/notify.
    - **Layout Switching**:
        - specific buttons for 1x3, 1x4, 2x2.
        - Send `set-layout` IPC message.

### D. Preload (`src/preload/service-preload.js`)
- No major changes expected, assuming generic selectors work.
- May need specific handling for Grok/Perplexity if they use non-standard inputs (e.g. `contenteditable` divs without clear classes).

## 3. Constraints & Risks
- **Selectors**: Exact selectors for Grok and Perplexity are unknown without inspection. Will use generic ones and refine.
- **Iframe/BrowserView Compatibility**:
    - Perplexity might have Cloudflare protection.
    - Grok might require login (X.com account).
    - **Mitigation**: Use the existing "Login in Chrome" flow if they block embedded login or have CAPTCHAs.
- **Screen Real Estate**: 1x4 might be too narrow on smaller screens. 2x2 is better for 4 services.

## 4. Timeline
1.  Update Config & Main Process (Services & Layout Logic).
2.  Update Renderer UI (Toggles & Layout Buttons).
3.  Implement Renderer Logic (Max 4 limit, Auto-layout).
4.  Test & Refine Selectors.
