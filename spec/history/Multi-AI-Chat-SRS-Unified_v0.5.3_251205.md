# Sync Multi Chat Desktop Application
## Software Requirements Specification (SRS)
### EARS (Easy Approach to Requirements Syntax) ê¸°ë°˜ ?µí•© ?”êµ¬?¬í•­ ëª…ì„¸??
**ë¬¸ì„œ ë²„ì „**: 0.9.0 (Copy Last Response ë°??œë¹„?¤ë³„ ?¤ë” ë°?ì¶”ê?)  
**?‘ì„±??*: 2025-12-05  
**?„ë¡œ?íŠ¸ëª?*: Sync Multi Chat (ì½”ë“œëª? MAPB - Multi AI Prompt Broadcaster / Clash of LLMs)

---

## 1. ê°œìš”

### 1.1 ëª©ì 

ë³?ë¬¸ì„œ??Windows ?˜ê²½?ì„œ ?™ì‘?˜ëŠ” Electron ê¸°ë°˜ ?°ìŠ¤?¬í†± ? í”Œë¦¬ì??´ì…˜???”êµ¬?¬í•­???•ì˜?œë‹¤. ë³??œìŠ¤?œì˜ ëª©í‘œ???¬ìš©?ê? ?˜ë‚˜???µí•© ?…ë ¥ì°?Master Input)???„ë¡¬?„íŠ¸ë¥??…ë ¥?˜ë©´, ?´ë? ChatGPT, Claude, Gemini ???´ë¼?´ì–¸?¸ì— ?™ì‹œ???„ì†¡?˜ê³ , ê°??œë¹„?¤ì˜ ?‘ë‹µ?????”ë©´?ì„œ ë¹„êµ?????ˆë„ë¡?ì§€?í•˜??ê²ƒì´??

### 1.2 ë²”ìœ„

#### 1.2.1 ?€???Œë«??- Windows 10/11 (64-bit)
- Electron ê¸°ë°˜ ?°ìŠ¤?¬í†± ??- ê¸°ìˆ  ?¤íƒ: Electron, Node.js, HTML/CSS/JavaScript

#### 1.2.2 ì§€???œë¹„??(Phase 1)
- ChatGPT (chat.openai.com ?ëŠ” chatgpt.com)
- Claude (claude.ai)
- Gemini (gemini.google.com/app)
- Grok (grok.com)
- Perplexity (perplexity.ai)

#### 1.2.3 ë²”ìœ„???¬í•¨
- ë©€???¨ë„ UI(ìµœì†Œ 3ë¶„í• ): ê°??¨ë„???œë¹„?????”ë©´ ë¡œë”©
- ë§ˆìŠ¤???…ë ¥ì°½ì—?œì˜ ?„ë¡¬?„íŠ¸ ?™ì‹œ ?„ì†¡
- ?œë¹„?¤ë³„ ?„ì†¡ ?€??on/off ? ê?
- ?‘ë‹µ ?íƒœ(ì§„í–‰ ì¤??„ë£Œ) ?œì‹œ
- ?¸ì…˜ ?ì†??ë°??ë™ ?¬ë¡œê·¸ì¸

#### 1.2.4 ë²”ìœ„???œì™¸
- ê°??œë¹„?¤ì˜ API ì§ì ‘ ?¸ì¶œ
- ê³„ì • ?ì„±/ê´€ë¦?(ê°??œë¹„??ê³µê¸‰?ì˜ ë¡œê·¸??UI ?¬ìš©)
- ?„ë¡¬?„íŠ¸/?‘ë‹µ???¥ê¸° ?€??ë°??´ë¼?°ë“œ ?™ê¸°??ê¸°ëŠ¥

### 1.3 ?©ì–´ ?•ì˜

| ?©ì–´ | ?•ì˜ |
|------|------|
| MAPB | Multi AI Prompt Broadcaster (ë³?Electron ?? |
| Master Input | ëª¨ë“  AI ?œë¹„?¤ì— ?™ì‹œ ?„ì†¡?˜ëŠ” ?µí•© ?…ë ¥ì°?|
| Service Panel / ?¨ë„(Panel) | ê°œë³„ AI ?œë¹„?¤ê? ?œì‹œ?˜ëŠ” BrowserView ?ì—­ |
| Selector Config | ê°?AI ?œë¹„?¤ì˜ DOM ?”ì†Œë¥??ë³„?˜ëŠ” ?¤ì • ?•ë³´ |
| Session Partition | ?œë¹„?¤ë³„ë¡?ê²©ë¦¬??ì¿ í‚¤/?¸ì…˜ ?€???ì—­ |
| Typing Simulation | Bot ?ì? ?°íšŒë¥??„í•œ ?¸ê°„ ? ì‚¬ ?€?´í•‘ ?œë??ˆì´??|
| ?€ê²?Target) | ?„ë¡¬?„íŠ¸ë¥??¤ì œë¡??„ì†¡???œë¹„??ì§‘í•© |

### 1.4 EARS ?¨í„´ ?œê¸°

ë³?ë¬¸ì„œ?ì„œ ?¬ìš©?˜ëŠ” EARS ?¨í„´:

| ?¨í„´ | ?•ì‹ | ?¤ëª… |
|------|------|------|
| **[Ubiquitous]** | `The system shall <response>.` | ??ƒ ?ìš©?˜ëŠ” ?”êµ¬?¬í•­ |
| **[Event-driven]** | `When <trigger>, the system shall <response>.` | ?¹ì • ?´ë²¤??ë°œìƒ ???™ì‘ |
| **[State-driven]** | `While <state>, the system shall <response>.` | ?¹ì • ?íƒœ ? ì? ì¤??™ì‘ |
| **[Optional]** | `Where <feature>, the system shall <response>.` | ? íƒ??ì¡°ê±´ë¶€ ê¸°ëŠ¥ |
| **[Unwanted]** | `If <undesired trigger>, then the system shall <response>.` | ?ì¹˜ ?ŠëŠ” ?í™© ?€??|

### 1.5 ì°¸ì¡° ë¬¸ì„œ
- Electron ê³µì‹ ë¬¸ì„œ (https://www.electronjs.org/docs)
- Chrome DevTools Protocol (CDP)
- ê°?AI ?œë¹„??Terms of Service

---

## 2. ?´í•´ê´€ê³„ì ë°??¬ìš©??
### 2.1 ìµœì¢… ?¬ìš©??(End User)
- ?¬ëŸ¬ AI ?œë¹„?¤ë? ?™ì‹œ???¬ìš©?˜ëŠ” ê°œì¸/?„ë¬¸ê°€
- ??ë²ˆì˜ ?„ë¡¬?„íŠ¸ë¡??¬ëŸ¬ ëª¨ë¸???‘ë‹µ??ë¹„êµ?˜ê³  ?¶ì? ?¬ìš©??
### 2.2 ?´ì˜Â·ê°œë°œ??(Developer/Maintainer)
- ??? ì?ë³´ìˆ˜ ë°?ê¸°ëŠ¥ ê°œì„  ?´ë‹¹
- ?œë¹„??DOM ë³€ê²½ì— ?°ë¥¸ ?€?‰í„° ?…ë°?´íŠ¸ ?´ë‹¹

---

## 3. ?œìŠ¤???„í‚¤?ì²˜

### 3.1 ì»´í¬?ŒíŠ¸ êµ¬ì¡°

```
?Œâ??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€????                     Main Process                           ???? ?Œâ??€?€?€?€?€?€?€?€?€?€?€?€?? ?Œâ??€?€?€?€?€?€?€?€?€?€?€?€?? ?Œâ??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?? ???? ??  Window    ?? ??  Session   ?? ??  IPC Message       ?? ???? ??  Manager   ?? ??  Manager   ?? ??  Router            ?? ???? ?”â??€?€?€?€?€?€?€?€?€?€?€?€?? ?”â??€?€?€?€?€?€?€?€?€?€?€?€?? ?”â??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?? ???”â??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€??                              ??          ?Œâ??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?¼â??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€??          ??                  ??                  ???Œâ??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€???Œâ??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€???Œâ??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€???? BrowserView    ???? BrowserView    ???? BrowserView    ???? (ChatGPT)      ???? (Claude)       ???? (Gemini)       ???? ?Œâ??€?€?€?€?€?€?€?€?€?€?? ???? ?Œâ??€?€?€?€?€?€?€?€?€?€?? ???? ?Œâ??€?€?€?€?€?€?€?€?€?€?? ???? ??Preload   ?? ???? ??Preload   ?? ???? ??Preload   ?? ???? ??Script    ?? ???? ??Script    ?? ???? ??Script    ?? ???? ?”â??€?€?€?€?€?€?€?€?€?€?? ???? ?”â??€?€?€?€?€?€?€?€?€?€?? ???? ?”â??€?€?€?€?€?€?€?€?€?€?? ???”â??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€???”â??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€???”â??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€??          ??                  ??                  ??          ?”â??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?¼â??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€??                              ???Œâ??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€????                   Renderer Process                         ???? ?Œâ??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€??  ???? ??             Master Input Component                  ??  ???? ?”â??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€??  ???”â??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€??```

### 3.2 ?„ë¡œ?¸ìŠ¤ ??• 

| ?„ë¡œ?¸ìŠ¤ | ??•  |
|----------|------|
| Main Process | ? í”Œë¦¬ì??´ì…˜ ?˜ëª… ì£¼ê¸° ê´€ë¦? BrowserWindow ?ì„±, Global Shortcut ì²˜ë¦¬ |
| Renderer Process | Master Input UI, ?ˆì´?„ì›ƒ ?œì–´ UI |
| Preload Scripts | contextBridgeë¥??¬ìš©??IPC ?µì‹  ì±„ë„ ?•ë³´, ê°?AI ?¬ì´???´ë? Content Script ??•  |

### 3.3 ?œë¹„???”ë“œ?¬ì¸??
| ?œë¹„??| URL | ë¹„ê³  |
|--------|-----|------|
| ChatGPT | https://chat.openai.com ?ëŠ” https://chatgpt.com | OpenAI ê³„ì • ?ëŠ” Google SSO |
| Claude | https://claude.ai | Anthropic ê³„ì • ?ëŠ” Google SSO |
| Gemini | https://gemini.google.com/app | Google ê³„ì • ?„ìˆ˜ |
| Grok | https://grok.com | X(Twitter) ê³„ì • ?„ìˆ˜ |
| Perplexity | https://www.perplexity.ai | Google SSO ?ëŠ” ?´ë©”??ë¡œê·¸??|

---

## 4. ê¸°ëŠ¥ ?”êµ¬?¬í•­ (EARS ?•ì‹)

### 4.1 ? í”Œë¦¬ì??´ì…˜ ì´ˆê¸°??(APP)

#### APP-001: ? í”Œë¦¬ì??´ì…˜ ?œì‘
**[Ubiquitous]**  
The system shall create a main window with dimensions 1400x900 pixels (minimum) upon application launch.

#### APP-002: ?ˆì´?„ì›ƒ ì´ˆê¸°??**[Event-Driven]**  
When the main window is created, the system shall divide the window into a 4-panel grid layout (1x4) by default, activating ChatGPT, Claude, Gemini, and Perplexity.

#### APP-003: Master Input ?ì—­
**[Ubiquitous]**  
The system shall display a Master Input area at the bottom of the main window with a minimum height of 80 pixels.

#### APP-004: ?œë¹„??? ê? ì»¨íŠ¸ë¡?**[Ubiquitous]**  
The system shall provide, adjacent to the Master Input, toggle controls that allow the user to enable or disable each target service (ChatGPT, Claude, Gemini, Grok, Perplexity) individually.

#### APP-004-1: ???€??ë²„íŠ¼
**[Ubiquitous]**  
The system shall display a "New" button to the left of the service toggle controls to allow users to quickly reset conversations.

#### APP-005: ?„ì†¡ ë²„íŠ¼
**[Ubiquitous]**  
The system shall display a "Send" button associated with the Master Input.

#### APP-006: BrowserView ?ì„±
**[Event-Driven]**  
When the layout is initialized, the system shall create separate BrowserView instances for all enabled services (ChatGPT, Claude, Gemini, Grok, Perplexity), each with isolated sandbox environment.

#### APP-007: ?œë¹„???˜ì´ì§€ ë¡œë”©
**[Ubiquitous]**  
The system shall load the official web UI of each service into its assigned panel using a dedicated BrowserView.

---

### 4.2 ?¸ì…˜ ë°??¸ì¦ ê´€ë¦?(AUTH)

#### AUTH-001: ?¸ì…˜ ?Œí‹°??ë¶„ë¦¬
**[Ubiquitous]**  
The system shall create isolated session partitions for each AI service using the naming convention `persist:service-{serviceName}`.

#### AUTH-002: ì¿ í‚¤ ?ì†??**[Ubiquitous]**  
The system shall persist session cookies across application restarts by using persistent partition storage.

#### AUTH-003: ?¸ì…˜ ë³´ì¡´
**[State-driven]**  
While the application is running, the system shall preserve each BrowserView's session (Cookie, LocalStorage) to maintain the user's login state.

#### AUTH-004: ë¡œê·¸???íƒœ ê°ì?
**[Event-Driven]**  
When a Service Panel completes page loading, the system shall detect login status by checking for service-specific DOM elements.

| ?œë¹„??| ë¡œê·¸???„ë£Œ ?€?‰í„° (?ˆì‹œ) |
|--------|---------------------------|
| ChatGPT | `textarea[id="prompt-textarea"]` ì¡´ì¬ |
| Claude | `div[contenteditable="true"]` ì¡´ì¬ |
| Gemini | `div[contenteditable="true"]` ?ëŠ” ?…ë ¥ ?ì—­ ì¡´ì¬ |
| Grok | `div.ProseMirror` ?ëŠ” `div[contenteditable="true"]` ì¡´ì¬ |
| Perplexity | `div[data-lexical-editor="true"]` ?ëŠ” `#ask-input` ì¡´ì¬ |

#### AUTH-005: ë¡œê·¸???„ìš” ?œì‹œ
**[State-Driven]**  
While a service is in logged-out state, the system shall display a visual indicator (overlay badge) on the corresponding Service Panel indicating "ë¡œê·¸???„ìš”".

#### AUTH-006: ë¯¸ë¡œê·¸ì¸ ?íƒœ ì²˜ë¦¬
**[State-driven]**  
While the user has not logged in to a service, the system shall display a "ë¡œê·¸???„ìš”" badge with a "Chrome?¼ë¡œ ë¡œê·¸?? button. Clicking this button opens an external Chrome window for authentication.

#### AUTH-007: Google SSO ì§€??**[Event-Driven]**  
When a user initiates Google OAuth flow within any Service Panel, the system shall allow popup windows for authentication and properly handle OAuth redirects.

#### AUTH-008: ë¡œê·¸???¸ì…˜ ?€??**[Event-driven]**  
When the user successfully logs in to a service within a panel (or via external Chrome), the system shall persist the session cookies in the associated Electron session partition to allow automatic re-login on subsequent launches.

#### AUTH-009: ?¸ì…˜ ë§Œë£Œ ê°ì?
**[Event-Driven]**  
When a service redirects to a login page during use, the system shall detect this and update the panel status to "?¬ë¡œê·¸ì¸ ?„ìš”".

#### AUTH-010: ë¡œì»¬ ?°ì´??ì´ˆê¸°??**[Event-driven]**  
When the user requests a "Clear local data" operation, the system shall clear all cookies and local storage for each service's session partition.

---

### 4.3 ë³´ì•ˆ ë°??°íšŒ (SEC)

#### SEC-001: X-Frame-Options ?°íšŒ
**[Ubiquitous]**  
The system shall intercept and modify HTTP response headers to remove 'X-Frame-Options' and 'Content-Security-Policy' headers that prevent embedding.

```javascript
// êµ¬í˜„ ì°¸ì¡°
session.webRequest.onHeadersReceived((details, callback) => {
  const headers = details.responseHeaders;
  delete headers['x-frame-options'];
  delete headers['content-security-policy'];
  callback({ responseHeaders: headers });
});
```

#### SEC-002: User-Agent ë³€ì¡?**[Ubiquitous]**  
The system shall set the User-Agent to a standard Chrome browser string to minimize bot detection by AI services.

#### SEC-003: ?¸ì…˜ ê²©ë¦¬
**[Ubiquitous]**  
The system shall ensure complete session isolation between Service Panels to prevent cross-service data leakage.

#### SEC-004: ?¸ë? ?µì‹  ?œí•œ
**[Ubiquitous]**  
The system shall not transmit any user data to external servers other than the three configured AI services.

#### SEC-005: Preload ?¤í¬ë¦½íŠ¸ ê²©ë¦¬
**[Ubiquitous]**  
The system shall enable context isolation for all BrowserView instances and disable Node.js integration in renderer processes.

```javascript
// êµ¬í˜„ ì°¸ì¡°
new BrowserView({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
});
```

#### SEC-006: ?ê²©ì¦ëª… ë¯¸ì???**[Ubiquitous]**  
The system shall not store user account credentials for any AI service; all authentication shall occur within the official service web pages.

#### SEC-007: ë¡œì»¬ ?€?¥ì†Œ ?”í˜¸??**[Optional]**  
Where sensitive data protection is enabled, the system shall encrypt session data stored on disk using the operating system's credential storage API.

#### SEC-008: ?¸ë? ë¡œê·¸??ë³´ì•ˆ ê²€ì¦?**[Ubiquitous]**  
When using the "Login in Chrome" feature, the system shall verify that the external browser URL matches the service's main domain (not a login page) before syncing cookies, ensuring only valid sessions are captured.

---

### 4.4 ?„ë¡¬?„íŠ¸ ?…ë ¥ ë°??„ì†¡ (INPUT)

#### INPUT-001: ?„ì†¡ ë²„íŠ¼ ?´ë¦­
**[Event-Driven]**  
When the user clicks the "Send" button, the system shall capture the current text in the Master Input as the prompt.

#### INPUT-002: ?¤ë³´???„ì†¡ (Enter)
**[Event-Driven]**  
When the user presses Enter (without Shift) in the Master Input, the system shall broadcast the input text to all enabled Service Panels.

#### INPUT-003: ?¤ë³´???„ì†¡ (Ctrl+Enter)
**[Event-driven]**  
When the user presses `Ctrl+Enter` inside the Master Input, the system shall behave as if the "Send" button were clicked, triggering the delivery of both the prompt text and any attached files.

#### INPUT-004: ë©€?°ë¼???…ë ¥
**[Event-Driven]**  
When the user presses Shift+Enter in the Master Input, the system shall insert a newline character without triggering broadcast.

#### INPUT-005: ë¹??…ë ¥ ë°©ì?
**[Unwanted]**  
If the Master Input is empty when the user attempts to send, then the system shall not broadcast any prompt and shall show a non-blocking warning to the user.

#### INPUT-006: ?€ê²??œë¹„??ê²°ì •
**[Event-driven]**  
When the user sends a prompt, the system shall determine the active target services based on the user's toggle selections.

#### INPUT-007: IPC ë¸Œë¡œ?œìº?¤íŠ¸
**[Event-Driven]**  
When the user triggers send from the Master Input, the system shall use IPC (Inter-Process Communication) to broadcast the text data to all enabled BrowserViews.

#### INPUT-008: DOM ?€?‰í„° ?¤ì •
**[Ubiquitous]**  
The system shall maintain a Selector Config file containing DOM selectors for each service's input field, send button, login indicators, and content area.

```json
{
  "chatgpt": {
    "inputSelector": [
      "textarea#prompt-textarea",
      "div[contenteditable='true'][data-placeholder]"
    ],
    "sendButtonSelector": [
      "button[data-testid='send-button']",
      "button[aria-label='Send prompt']"
    ],
    "loggedInSelector": [
      "div#prompt-textarea"
    ],
    "loginButtonSelector": [
      "button[data-testid='login-button']",
      "div[class*='btn']"
    ],
    "contentSelector": [
      "main",
      ".flex-1.overflow-hidden"
    ]
  },
  "claude": {
    "inputSelector": [
      "div.ProseMirror[contenteditable='true']",
      "div[contenteditable='true']"
    ],
    "sendButtonSelector": [
      "button[aria-label='Send message']",
      "button[data-testid='send-button']"
    ],
    "loggedInSelector": [
      "div.ProseMirror[contenteditable='true']"
    ],
    "contentSelector": [
      "div.flex-1.overflow-y-auto",
      "main"
    ]
  },
  "gemini": {
    "inputSelector": [
      "div[contenteditable='true']",
      "rich-textarea div[contenteditable]"
    ],
    "sendButtonSelector": [
      "button[aria-label='Send message']",
      "button.send-button"
    ],
    "loggedInSelector": [
      "div[contenteditable='true']"
    ],
    "contentSelector": [
      "main",
      "div[role='main']"
    ]
  }
}
  },
  "grok": {
    "inputSelector": ["div.ProseMirror"],
    "sendButtonSelector": ["button[aria-label='Submit']"],
    "loggedInSelector": ["div.ProseMirror"],
    "contentSelector": ["main", "div[class*='message-container']"]
  },
  "perplexity": {
    "inputSelector": ["#ask-input", "div[data-lexical-editor='true']"],
    "sendButtonSelector": ["button[aria-label='Submit']"],
    "loggedInSelector": ["#ask-input"],
    "contentSelector": ["main"]
  }
}
```

#### INPUT-009: ?¤ì¤‘ ?€?‰í„° ?´ë°±
**[State-Driven]**  
While attempting to locate an input field, the system shall try each selector in the configured array sequentially until a valid element is found.

#### INPUT-010: DOM ?”ì†Œ ?ìƒ‰
**[State-driven]**  
While each AI service page is loading, the system shall inject a predefined preload script to search for the input field selector and send button selector appropriate for that domain.

#### INPUT-011: ?„ë¡¬?„íŠ¸ ì£¼ì…
**[Event-driven]**  
When a target service is selected, the system shall programmatically locate the primary text input element (textarea or equivalent) in the corresponding panel and set its value to the prompt.

#### INPUT-012: React/Vue ?¸í™˜ ?…ë ¥
**[Ubiquitous]**  
The system shall trigger appropriate DOM events (input, change, keydown synthetic events) after setting input values to ensure React/Vue/Angular frameworks detect the change.

```javascript
// êµ¬í˜„ ì°¸ì¡°: textarea ?”ì†Œ
function setTextareaValue(element, text) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  ).set;
  nativeInputValueSetter.call(element, text);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

// êµ¬í˜„ ì°¸ì¡°: contenteditable ?”ì†Œ
function setContentEditableValue(element, text) {
  element.focus();
  element.textContent = text;
  element.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: text
  }));
}
```

#### INPUT-013: ?´ë²¤???¸ë¦¬ê±?**[Event-driven]**  
When the prompt value has been injected into the service's input element, the system shall trigger an appropriate input event (e.g., `input`, `change`) so that the service recognizes the updated value.

#### INPUT-014: ?€?´í•‘ ?œë??ˆì´??**[Optional]**  
Where typing simulation is enabled, the system shall input text character by character with a random delay of 20-80ms between keystrokes to avoid bot detection.

#### INPUT-015: ?ë™ ?„ì†¡
**[Event-Driven]**  
When text input is complete in a Service Panel, the system shall automatically click the send button after a configurable delay (default: 100ms).

#### INPUT-016: ?„ì†¡ ë²„íŠ¼ ?œì„±??**[Event-driven]**  
When the service input has been updated, the system shall locate and activate the service's "Send" or "Submit" control to initiate message generation.

#### INPUT-017: DOM ?”ì†Œ ë¯¸ë°œê²?ì²˜ë¦¬
**[Unwanted]**  
If the system cannot find the input element or send button for a selected service, then the system shall skip broadcasting to that service and show a visible but non-blocking status message (e.g., "ChatGPT DOM not found") and allow manual text input via clipboard paste as fallback.

#### INPUT-018: ?„ì†¡ ?¤íŒ¨ ì²˜ë¦¬
**[Unwanted]**  
If the send button is not found or is disabled, then the system shall log the error and display a notification "?„ì†¡ ?¤íŒ¨: {?œë¹„?¤ëª…}".

---

### 4.5 ?‘ë‹µ ê°ì? ë°??íƒœ ê´€ë¦?(RESP)

#### RESP-001: ì§„í–‰ ?íƒœ ?¤ì •
**[Event-driven]**  
When a prompt is sent to a target service, the system shall set the status of that service to "In progress" and start monitoring for response generation using MutationObserver.

#### RESP-002: ì§„í–‰ ?íƒœ ? ì?
**[State-driven]**  
While the service is generating a response, the system shall maintain the "In progress" status indicator (e.g., spinner, badge) for that service on the corresponding Service Panel header.

#### RESP-003: ?‘ë‹µ ?„ë£Œ ê°ì?
**[Event-driven]**  
When the service's send button becomes re-enabled or when a defined DOM indicator shows that generation has finished (stop button disappearance, loading indicator removal), the system shall set the status of that service to "Completed".

```javascript
// êµ¬í˜„ ì°¸ì¡°
const completionIndicators = {
  chatgpt: {
    generating: 'button[aria-label="Stop generating"]',
    complete: 'button[data-testid="send-button"]:not([disabled])'
  },
  claude: {
    generating: 'button[aria-label="Stop response"]',
    complete: 'button[aria-label="Send message"]:not([disabled])'
  },
  gemini: {
    generating: '.loading-indicator',
    complete: 'button.send-button:not([disabled])'
  }
};
```

#### RESP-004: ?€?„ì•„??ì²˜ë¦¬
**[Unwanted]**  
If the service's status does not change to "Completed" within a configurable timeout period (default: 5 minutes), then the system shall mark the status as "?€?„ì•„?? and stop monitoring, optionally presenting a hint to the user to manually inspect the panel.

#### RESP-005: ?„ì²´ ?„ë£Œ ?Œë¦¼
**[Event-Driven]**  
When all enabled services have completed response generation, the system shall provide a visual/audio notification to the user.

---

### 4.6 ?ˆì´?„ì›ƒ ë°?UI (LAYOUT)

#### LAYOUT-001: ê¸°ë³¸ ?¨ë„ ?œì‹œ
**[Ubiquitous]**  
The system shall display panels for enabled services (default: ChatGPT, Claude, Gemini, Perplexity).

#### LAYOUT-002: ?ˆì´?„ì›ƒ ëª¨ë“œ
**[Ubiquitous]**  
The system shall support the following layout configurations:
- 1x3 (Horizontal Split) - 3ê°??œë¹„???œì„±????ê°•ì œ
- 1x4 (Horizontal Split) - 4ê°??´ìƒ ?œë¹„???œì„±????ê¸°ë³¸ê°?- 2x2 (Grid Layout) - 4ê°??´ìƒ ?œë¹„???œì„±????? íƒ ê°€??
#### LAYOUT-003: ?™ì  ?ˆì´?„ì›ƒ ?¬ì¡°??**[Event-driven]**  
When the user clicks the 'layout change' button, the system shall automatically readjust the screen split (Grid Layout) according to the number of currently enabled AI services. (e.g., 2 services = 2-split, 3-4 services = 4-split)

#### LAYOUT-004: ?¨ë„ ?¬ê¸° ì¡°ì ˆ
**[Event-Driven]**  
When the user drags a panel divider (vertical or horizontal), the system shall resize adjacent panels in real-time or upon drag completion, maintaining a minimum panel width/height of 100 pixels.

#### LAYOUT-004-1: 2x2 ë¦¬ì‚¬?´ì§•
**[Event-Driven]**
When in 2x2 layout, the system shall provide a central horizontal splitter to resize row heights and vertical splitters within each row to resize column widths.

#### LAYOUT-005: ?¨ë„ ?œì„±??ë¹„í™œ?±í™”
**[Event-Driven]**  
When the user clicks a service toggle button, the system shall enable/disable the corresponding Service Panel and redistribute layout space.

#### LAYOUT-006: ?„ì²´?”ë©´ ëª¨ë“œ
**[Event-Driven]**  
When the user double-clicks a Service Panel header, the system shall expand that panel to full window size. Double-clicking again shall restore the original layout.

#### LAYOUT-007: ?ˆë„???¬ê¸° ì¡°ì ˆ
**[Event-Driven]**  
When the main window is resized, the system shall proportionally adjust all Service Panel and Master Input dimensions so that all panels and the Master Input remain fully visible without overlap.

#### LAYOUT-008: ìµœì†Œ ?ˆë„???¬ê¸°
**[Ubiquitous]**  
The system shall enforce a minimum window size of 1200x700 pixels.

#### LAYOUT-009: ë¹„í™œ?±í™” ?œë¹„???œì‹œ
**[Optional]**  
Where a service is disabled in the configuration, the system shall hide or grey out the corresponding panel and toggle.

#### LAYOUT-010: Modern UI (shadcn/ui Style)
**[Ubiquitous]**
The system shall implement a modern user interface for the Master Input and control area, replicating the design aesthetics of the **shadcn/ui** design system (clean typography, subtle borders, specific color palette, and component styling) using vanilla CSS.

---

### 4.7 ?¤ì • ê´€ë¦?(CONFIG)

#### CONFIG-001: ?¤ì • ?€??**[Ubiquitous]**  
The system shall persist user settings in a JSON configuration file located at `%APPDATA%/multi-ai-chat/config.json`.

#### CONFIG-002: ?¤ì • ??ª©
**[Ubiquitous]**  
The system shall support the following configurable options:

| ?¤ì • ??ª© | ?€??| ê¸°ë³¸ê°?| ?¤ëª… |
|-----------|------|--------|------|
| layout.mode | string | "horizontal-3" | ?ˆì´?„ì›ƒ ëª¨ë“œ |
| layout.panelOrder | array | ["chatgpt","claude","gemini"] | ?¨ë„ ?œì„œ |
| input.typingSimulation | boolean | false | ?€?´í•‘ ?œë??ˆì´???œì„±??|
| input.typingDelayMin | number | 20 | ìµœì†Œ ?€?´í•‘ ?œë ˆ??(ms) |
| input.typingDelayMax | number | 80 | ìµœë? ?€?´í•‘ ?œë ˆ??(ms) |
| input.autoSendDelay | number | 100 | ?ë™ ?„ì†¡ ?œë ˆ??(ms) |
| response.timeout | number | 300000 | ?‘ë‹µ ?€?„ì•„??(ms) |
| notification.sound | boolean | true | ?„ë£Œ ?Œë¦¼??|
| notification.visual | boolean | true | ?œê°???„ë£Œ ?Œë¦¼ |
| services.enabled | object | {chatgpt:true, claude:true, gemini:true, grok:false, perplexity:true} | ?œë¹„???œì„±???íƒœ |

#### CONFIG-003: ?¸ë? ?€?‰í„° ?¤ì •
**[Optional]**  
Where a configuration file exists defining DOM selectors and behaviors for each service, the system shall use these definitions instead of hard-coded selectors.

#### CONFIG-004: ?¤ì • ?ìš©
**[Event-driven]**  
When the configuration file is updated and the system is restarted, the system shall apply the new selectors and behaviors without requiring code changes.

#### CONFIG-005: ?€?‰í„° ?ê²© ?…ë°?´íŠ¸
**[Optional]**  
Where remote selector update is enabled, the system shall check for updated Selector Config from a configured URL on application startup.

#### CONFIG-006: ?¤ì • UI
**[Event-Driven]**  
When the user opens the settings dialog (Ctrl+,), the system shall display a modal window with all configurable options.

---

### 4.8 ?¤ë³´???¨ì¶•??(SHORT)

#### SHORT-001: ê¸€ë¡œë²Œ ?¨ì¶•??**[Ubiquitous]**  
The system shall support the following keyboard shortcuts:

| ?¨ì¶•??| ?™ì‘ |
|--------|------|
| Ctrl+1, 2, 3 | ?´ë‹¹ ?œë²ˆ Service Panelë¡??¬ì»¤???´ë™ |
| Ctrl+Enter | Master Input?ì„œ ì¦‰ì‹œ ?„ì†¡ (Enter?€ ?™ì¼) |
| Ctrl+Shift+Enter | ëª¨ë“  ?€??ì´ˆê¸°??(???€???œì‘) |
| Ctrl+, | ?¤ì • ì°??´ê¸° |
| Ctrl+L | Master Input?¼ë¡œ ?¬ì»¤???´ë™ |
| F11 | ?„ì²´?”ë©´ ? ê? |
| Ctrl+R | ?„ì¬ ?¬ì»¤?¤ëœ Service Panel ?ˆë¡œê³ ì¹¨ |
| Ctrl+Shift+R | ëª¨ë“  Service Panel ?ˆë¡œê³ ì¹¨ |

#### SHORT-002: Master Input ?…ë ¥ì°?ì´ˆê¸°??**[Event-Driven]**  
When the Master Input is focused and the user presses Escape, the system shall clear the input field.

#### SHORT-003: ?¨ë„ ?¬ì»¤???´ë™
**[Optional]**  
Where the user presses `Ctrl+1`, `Ctrl+2`, or `Ctrl+3`, the system shall bring the corresponding service panel into focus and scroll to the latest conversation area if necessary.

---

### 4.9 ?ëŸ¬ ì²˜ë¦¬ ë°?ë³µêµ¬ (ERR)

#### ERR-001: ?¤íŠ¸?Œí¬ ?¤ë¥˜ ë°??ˆë¡œê³ ì¹¨
**[Event-Driven]**  
If a Service Panel fails to load or becomes unresponsive, the system shall provide a "Refresh" button (?”„) on the panel header. Clicking this button shall reload ONLY the specific service view where the button was clicked.

#### ERR-002: DOM ?€?‰í„° ?¤íŒ¨
**[Unwanted]**  
If all configured selectors fail to locate an input field, then the system shall:
1. Log detailed error information including current page HTML snapshot
2. Display a notification "?…ë ¥ì°½ì„ ì°¾ì„ ???†ìŠµ?ˆë‹¤. ?€?‰í„° ?…ë°?´íŠ¸ê°€ ?„ìš”?©ë‹ˆ??"
3. Allow manual text input via clipboard paste (fallback)

#### ERR-003: ?¬ë˜??ë°??ˆë„??ë³µêµ¬
**[Event-Driven]**  
When a service view is closed, crashed, or missing, toggling the service OFF and then ON via the checkbox controls shall automatically recreate and restore the service view.

#### ERR-004: Captcha/Cloudflare ê°ì?
**[Unwanted]**  
If bot detection triggers a Captcha challenge, then the system shall pause DOM manipulation and notify the user with "ë³´ì•ˆ ?•ì¸ ?„ìš”" status.

---

### 4.10 ?€??ê´€ë¦?(CONV)

#### CONV-001: ???€???œì‘ (ë²„íŠ¼)
**[Event-Driven]**  
When the user clicks the "New" button, the system shall initiate a new conversation for all currently enabled AI services.

#### CONV-002: ???€???œì‘ (?¨ì¶•??
**[Event-Driven]**  
When the user presses `Ctrl+Shift+Enter` in the Master Input, the system shall initiate a new conversation for all currently enabled AI services.

#### CONV-003: ?œë¹„?¤ë³„ ì´ˆê¸°??URL
**[Ubiquitous]**  
The system shall use the following URLs to reset conversations:
- ChatGPT: `https://chatgpt.com/`
- Claude: `https://claude.ai/new`
- Gemini: `https://gemini.google.com/app`
- Grok: `https://grok.com`
- Perplexity: `https://www.perplexity.ai`

#### CONV-004: DOM ê¸°ë°˜ ì´ˆê¸°??(Fallback)
**[Optional]**  
Where URL navigation fails to start a new chat (e.g., redirects to old chat), the system shall attempt to find and click the "New Chat" button within the service's DOM.

---

### 4.11 ?€???´ìš© ë³µì‚¬ (COPY)

#### COPY-001: ë³µì‚¬ ë²„íŠ¼ ?œì‹œ
**[Ubiquitous]**  
The system shall display a "Copy Chat Thread" button in the control panel with a distinct background color (e.g., Teal #2b5c5c) to distinguish it from other controls.

#### COPY-002: ?„ì²´ ?€???¤ë ˆ??ì¶”ì¶œ (Full Thread Extraction)
**[Event-Driven]**  
When the user clicks the "Copy Chat Thread" button, the system shall extract the **complete conversation thread** from each enabled service, including:
- All user prompts
- All AI responses
- Preserved formatting (code blocks, lists, headers)

The extraction shall use a tiered strategy:
1. **Tier 1 (Turndown)**: Extract the HTML of the conversation container and convert it to Markdown using the Turndown library to preserve formatting.
2. **Tier 2 (Text Fallback)**: If Tier 1 fails, fall back to extracting `innerText`.

#### COPY-003: ?´ë¦½ë³´ë“œ ?€??**[Event-Driven]**  
When the content has been extracted from all enabled services, the system shall format the content according to the selected format (Markdown/JSON/Text) and write it to the system clipboard.

#### COPY-004: ì¶”ì¶œ ?€?‰í„° ?¤ì • ?•ì¥
**[Ubiquitous]**  
The system shall use an expanded `selectors.json` configuration including:
- `copyButtonSelector`: Selector for the native copy button (Tier 1).
- `markdownContainerSelector`: Selector for the container to pass to Turndown (Tier 2).
- `contentSelector`: Selector for text extraction (Tier 3).

#### COPY-005: ì¶”ì¶œ ?´ë°± ë°??ëŸ¬ ì²˜ë¦¬
**[Unwanted]**  
If a specific extraction tier fails, the system shall automatically proceed to the next tier. If all tiers fail, the system shall return an error message for that service.

#### COPY-006: ë¹„ë™ê¸?ë³‘ë ¬ ì²˜ë¦¬
**[Ubiquitous]**  
The system shall execute content extraction for all enabled services in parallel where possible (Turndown/Text), while managing clipboard access sequentially for Native Copy operations.

#### COPY-007: ?€?„ì•„??**[Unwanted]**  
If a service fails to return content within a configurable timeout (default: 5 seconds for Native Copy, 2 seconds for others), then the system shall exclude that service's content and proceed with the rest.

#### COPY-008: ?°ì´???¬ë§·??ë°?? íƒ
**[Ubiquitous]**  
The system shall support multiple output formats selectable by the user:
- **Markdown (Default)**: Structured with headers (`# Service Name`), user/AI roles, and code blocks.
- **JSON**: Structured data array `[{ role, content, timestamp }]` for programmatic use.
- **Plain Text**: Simple text dump (legacy behavior).

#### COPY-009: ?ì„¸ ë³µì‚¬ ?¼ë“œë°?**[Event-Driven]**
When the copy operation completes, the system shall display a granular status message (e.g., "ChatGPT: Success, Claude: Failed") via a toast or status bar, instead of a generic "Copied!" message.

#### COPY-010: ?œë¹„?¤ë³„ ?¤ë” ë°?(Per-Service Header Bar)
**[Ubiquitous]**
The system shall display a fixed header bar (28px height) at the top of each Service Panel, above the BrowserView. The header bar shall contain:
- The **service name** on the left side.
- **Reload (?”„)** and **Copy (?“‹)** buttons on the right side.
Clicking the Copy button shall extract that specific service's full chat thread using the same Markdown formatting as the main "Copy Chat Thread" feature (with `## ?‘¤ User` and `## ?¤– [Service Name]` headings).

#### COPY-011: ?µëª… ëª¨ë“œ (Anonymous Mode)
**[Optional]**
Where "Anonymous Mode" is enabled, the system shall replace service names with aliases (e.g., "Service A", "Service B") in the exported content to facilitate blind comparison.

#### COPY-012: ?¬ë§· ? íƒ UI
**[Ubiquitous]**
The system shall provide a UI mechanism (e.g., dropdown or settings) to allow the user to select the desired copy format (Markdown, JSON, Text).

#### COPY-013: Copy Last Response ë²„íŠ¼
**[Ubiquitous]**
The system shall display a "Copy Last Response" button in the control panel, adjacent to the "Copy Chat Thread" button.

#### COPY-014: Copy Last Response ê¸°ëŠ¥
**[Event-Driven]**
When the user clicks the "Copy Last Response" button, the system shall:
1. Extract only the **last AI response** from each currently active Service Panel.
2. Format the combined responses according to the selected format (Markdown/JSON/Text).
3. Apply Anonymous mode aliases if enabled.
4. Write the formatted content to the system clipboard.
5. Display a granular status message indicating success/failure for each service.

---

### 4.12 êµì°¨ ê²€ì¦?(CROSS)

#### CROSS-001: êµì°¨ ê²€ì¦?ë²„íŠ¼
**[Ubiquitous]**
The system shall display a "Cross Check" button in the control panel, adjacent to the "Copy Chat Thread" button.

#### CROSS-002: êµì°¨ ê²€ì¦?ë¡œì§ (ë§ˆì?ë§??‘ë‹µ ì¶”ì¶œ)
**[Event-Driven]**
When the user clicks the "Cross Check" button, the system shall:
1. Extract the **last AI response only** from each currently enabled and active Service Panel.
2. Construct a specific prompt for each enabled service that includes the last responses of *other* enabled services.
3. Prepend a predefined or user-defined prompt at the top.
4. Inject the constructed prompt into each service's input field.
5. Automatically trigger the send action.

#### CROSS-003: ?„ë¡¬?„íŠ¸ êµ¬ì„±
**[Ubiquitous]**
The system shall construct the prompt for a target service (e.g., Service A) as follows:
```text
[User-defined or Predefined Prompt]

=== SERVICE B ===
[Last AI response from Service B]

=== SERVICE C ===
[Last AI response from Service C]
```
It shall exclude the target service's own response from its input.

#### CROSS-004: ë¹„í™œ???¨ë„ ì²˜ë¦¬
**[State-Driven]**
While a service panel is disabled or closed, the system shall exclude its content from the cross-check context and shall not send a prompt to that service.

#### CROSS-005: ë¹?ì»¨í…ì¸?ì²˜ë¦¬
**[Unwanted]**
If a service's thread is empty, then the system shall exclude it from the context provided to other services.

#### CROSS-006: êµì°¨ ê²€ì¦??ì—…
**[Event-Driven]**
When the user clicks the "Cross Check" button, the system shall display a modal popup offering two options: "ê°?AI ?‘ë‹µ ë¹„êµ" (Compare AI Responses) and "?¬ìš©???•ì˜ ?„ë¡¬?„íŠ¸ ì¶”ê?" (Add Custom Prompt).

#### CROSS-007: ?‘ë‹µ ë¹„êµ ëª¨ë“œ (ê¸°ë³¸)
**[Event-Driven]**
When the user selects "ê°?AI ?‘ë‹µ ë¹„êµ", the system shall prepend the current predefined comparison prompt to the collected AI responses and broadcast it to all enabled services.
*Default Predefined Prompt*: "Below are responses from different AI models. Please compare and analyze them for accuracy, completeness, and logic. Identify any discrepancies and suggest the best answer."

#### CROSS-008: ?¬ìš©???•ì˜ ?„ë¡¬?„íŠ¸ ëª¨ë“œ
**[Event-Driven]**
When the user selects "?¬ìš©???•ì˜ ?„ë¡¬?„íŠ¸ ì¶”ê?", the system shall display an input form with required Title and Content fields. Upon confirmation, the system shall prepend this custom prompt to the collected AI responses and broadcast it.

#### CROSS-009: ?¬ìš©???„ë¡¬?„íŠ¸ ?€??**[Ubiquitous]**
The system shall allow saving up to 10 custom prompts with a required "Title" and "Content". Saved prompts shall be stored in local storage with creation and last-used timestamps and persist across sessions.

#### CROSS-010: ?¬ìš©???„ë¡¬?„íŠ¸ ê´€ë¦?**[State-Driven]**
While in the "Add Custom Prompt" view, the system shall display a sortable table of saved prompts showing Title, Preview, Last Used, Created dates, and Delete actions. Users can click table headers to sort, select a prompt to populate the input fields, or delete prompts with confirmation.

#### CROSS-011: ?¬ì „ ?•ì˜ ?„ë¡¬?„íŠ¸ ?¸ì§‘
**[Event-Driven]**
When the user hovers over "Compare AI Responses" button, the system shall display a preview tooltip and an edit icon. When the edit icon is clicked, the system shall open an edit modal allowing modification of the predefined prompt with validation (Modify button enabled only when changes are made).

#### CROSS-012: ?…ë ¥ ?„ë“œ ? íš¨??ê²€??**[State-Driven]**
While in the "Add Custom Prompt" view, the system shall disable "Add Custom Prompt" and "Send Cross Check" buttons when either Title or Content fields are empty, and shall ensure Title uniqueness among saved prompts.

#### CROSS-013: ?„ë¡¬?„íŠ¸ ?? œ ?•ì¸
**[Event-Driven]**
When the user clicks the delete button on a saved prompt, the system shall display a confirmation modal showing the prompt title. The prompt shall only be deleted upon user confirmation.

#### CROSS-014: ?…ë ¥ ?íƒœ ê´€ë¦?**[Ubiquitous]**
The system shall ensure Title and Content input fields remain enabled at all times, using MutationObserver and multiple re-enablement strategies to prevent unwanted disabled states.

#### CROSS-015: BrowserView ê°€?œì„± ê´€ë¦?**[State-Driven]**
While the Cross Check modal is visible, the system shall temporarily hide all AI service BrowserViews. When the modal is closed, the system shall restore BrowserView visibility.



---

### 4.13 ?Œì¼ ?…ë¡œ??(FILE)

#### FILE-001: ?Œì¼ ì²¨ë? UI
**[Ubiquitous]**
The system shall display a "Clip" icon button within or adjacent to the Master Input area.

#### FILE-002: ?Œì¼ ? íƒ ?¤ì´?¼ë¡œê·?**[Event-Driven]**
When the user clicks the "Clip" icon, the system shall open a native file selection dialog allowing multiple file selection.

#### FILE-003: ?Œì¼ ë¯¸ë¦¬ë³´ê¸° ë°?ê´€ë¦?**[State-Driven]**
While files are attached, the system shall display a list of attached files (chips or list view) showing the filename and a "Remove" (X) button for each.

#### FILE-004: ?œë˜ê·????œë¡­
**[Event-Driven]**
When the user drags and drops files into the Master Input area, the system shall add them to the attached file list.

#### FILE-005: ?´ë¦½ë³´ë“œ ?´ë?ì§€ ë¶™ì—¬?£ê¸°
**[Event-Driven]**
When the user pastes an image from the clipboard into the Master Input area, the system shall automatically convert it to an image file (e.g., `paste-{timestamp}.png`) and add it to the attached file list.

#### FILE-006: ?´ë¦½ë³´ë“œ ?ìŠ¤???Œì¼ ë³€??**[Event-Driven]**
When the user pastes text into the **File Preview Area** (or uses a specific "Paste as File" action), the system shall automatically convert the text content into a text file (e.g., `paste-{timestamp}.txt`) and add it to the attached file list.
*Note: Standard pasting into the text input field shall remain as text insertion.*

#### FILE-007: 2?¨ê³„ ?„ì†¡ ?„ë¡œ?¸ìŠ¤ (Two-Step Send)
**[Event-Driven]**
When the user triggers the "Send" action with attached files, the system shall:
1. Upload files to all enabled Service Panels.
2. Display a confirmation modal ("?Œì¼ ?…ë¡œ???„ë£Œ ?•ì¸ ?? Ctrl + Enterë¥??…ë ¥?˜ì—¬ ì§„í–‰?´ì£¼?¸ìš”.").
3. Wait for the user to press `Ctrl+Enter` again to confirm and trigger the final send action.

#### FILE-008: ?Œì¼ ?…ë¡œ??ë©”ì»¤?ˆì¦˜
**[Ubiquitous]**
The system shall use the Chrome DevTools Protocol (CDP) `DOM.setFileInputFiles` method to programmatically attach files. For services like Gemini where the file input is dynamic, the system shall simulate necessary UI interactions (e.g., clicking upload buttons) to reveal the input field.

#### FILE-009: ?Œì¼ ?…ë ¥ ?€?‰í„°
**[Ubiquitous]**
The system shall maintain `fileInputSelector`, `uploadIconSelector`, and `uploadMenuButtonSelector` in `selectors.json` to handle various service-specific upload UI patterns.

#### FILE-010: ?…ë¡œ???€ê¸?ë°?ê²€ì¦?**[State-Driven]**
While files are being uploaded, the system shall wait for UI indicators (defined in `uploadedFileSelector`) to confirm successful attachment before allowing the final send action.

#### FILE-011: ?´ë¦½ë³´ë“œ ë¶™ì—¬?£ê¸° (?´ë?ì§€/?ìŠ¤??
**[Event-Driven]**
- **Image**: When an image is pasted, it is converted to a PNG file.
- **Text**: When long text (>5 lines) is pasted into the file preview area or when explicitly requested, it is converted to a TXT file.

#### FILE-012: ?œë˜ê·????œë¡­
**[Event-Driven]**
The system shall support dragging and dropping files directly into the Master Input area to attach them.

---

### 4.14 ?µëª… ëª¨ë“œ (ANON)

#### ANON-001: ?µëª… ëª¨ë“œ ? ê?
**[Ubiquitous]**
The system shall display an "Anonymous" (?µëª…) toggle button adjacent to the "Cross Check" button in the control panel.

#### ANON-002: ?œë¹„??ë³„ì¹­ ?œì‹œ
**[State-Driven]**
While Anonymous mode is ON, the system shall display service toggle buttons with aliases instead of their full names:
- ChatGPT -> **(A)**
- Claude -> **(B)**
- Gemini -> **(C)**
- Grok -> **(D)**
- Perplexity -> **(E)**

#### ANON-003: ?µëª… ?„ë¡¬?„íŠ¸ êµ¬ì„±
**[State-Driven]**
While Anonymous mode is ON and a Cross Check is initiated, the system shall replace all occurrences of service names in the generated prompt with their corresponding aliases (e.g., replace "Claude" with "(B)").

#### ANON-004: ?µëª… êµì°¨ ê²€ì¦??¤í–‰
**[Event-Driven]**
When the user executes a Cross Check with Anonymous mode ON, the system shall send the anonymized prompts to each service, ensuring that no service receives explicit names of other services in the context.

---

## 5. ë¹„ê¸°???”êµ¬?¬í•­ (NFR)

### 5.1 ?±ëŠ¥ (PERF)

#### NFR-PERF-001: ì´ˆê¸° ë¡œë”© ?œê°„
**[State-driven]**  
While the host machine meets the minimum hardware specification (e.g., 8 GB RAM, modern CPU with SSD storage), the system shall open and render all three service panels within 10 seconds after launch under normal network conditions.

#### NFR-PERF-002: ?„ë¡¬?„íŠ¸ ì£¼ì… ?ë„
**[Event-driven]**  
When the user sends a prompt to all three services, the system shall inject the prompt into all selected services within 1 second (200ms per service), excluding network latency and service-side processing time.

#### NFR-PERF-003: ë©”ëª¨ë¦??¬ìš©??**[Ubiquitous]**  
The system shall consume no more than 1.5GB of RAM under normal operation with all three Service Panels active.

#### NFR-PERF-004: ?œì‘ ?œê°„
**[Ubiquitous]**  
The system shall complete initial loading and display the main window within 5 seconds on a system with SSD storage.

### 5.2 ?¬ìš©??(USAB)

#### NFR-USAB-001: ?¼ê????œê°???ˆì´?„ì›ƒ
**[Ubiquitous]**  
The system shall provide a consistent visual layout, using clear labels and icons for each service and status indicator.

#### NFR-USAB-002: ?ì—°???ëŸ¬ ë©”ì‹œì§€
**[Ubiquitous]**  
The system shall provide basic error messages in natural language explaining failures such as "service not loaded" or "DOM not found".

#### NFR-USAB-003: ì²??¬ìš© ê°€?´ë“œ
**[Event-Driven]**  
The system shall display a first-run tutorial overlay explaining basic operations (including that users must manually log in to each service once) on initial launch.

#### NFR-USAB-004: ?íƒœ ?œì‹œ
**[Ubiquitous]**  
The system shall provide clear visual feedback for all operations (loading, sending, generating, complete).

### 5.3 ? ì?ë³´ìˆ˜??(MAINT)

#### NFR-MAINT-001: ë¡œê¹…
**[Ubiquitous]**  
The system shall log all significant events and errors to a rotating log file at `%APPDATA%/multi-ai-chat/logs/`.

#### NFR-MAINT-002: ?€?‰í„° ?¸ë???**[Optional]**  
Where selectors or DOM structures change for a service, the system shall allow maintainers to update service-specific DOM configuration without rebuilding the entire application.

#### NFR-MAINT-003: ëª¨ë“ˆ??**[Ubiquitous]**  
The system shall separate service-agnostic logic (broadcast, UI layout, IPC) from service-specific DOM-handling logic to facilitate future addition of new services.

---

## 6. ?œìŠ¤???œì•½ ì¡°ê±´

### 6.1 OS ?œì•½
- ì´ˆê¸° ë²„ì „?€ Windows 10/11 (64-bit)ë§?ì§€?í•œ??

### 6.2 ?¤íŠ¸?Œí¬ ?œì•½
- ëª¨ë“  ê¸°ëŠ¥?€ ?¬ìš©?ì˜ ?¤íŠ¸?Œí¬ ?˜ê²½?ì„œ ê°??œë¹„???„ë©”?¸ì— ?‘ê·¼ ê°€?¥í•˜?¤ëŠ” ?„ì œ ?˜ì— ?™ì‘?œë‹¤.

### 6.3 ë²•ì /?•ì±… ?œì•½
- ê°??œë¹„?¤ì˜ ?´ìš© ?½ê?(ToS) ë°??ë™??ê´€???•ì±…???„ë°˜?˜ì? ?ŠëŠ” ë²”ìœ„?ì„œ DOM ?ë™ ?…ë ¥???˜í–‰?´ì•¼ ?œë‹¤.
- ë³?? í”Œë¦¬ì??´ì…˜?€ ê°œì¸ ?ì‚°???„êµ¬ë¡??¬ìš©?˜ë©°, ?ì—…??ëª©ì ?´ë‚˜ ?€???ë™?”ì—???¬ìš©?˜ì? ?ŠìŒ???„ì œë¡??œë‹¤.

### 6.4 ?˜ì¡´??
| ?˜ì¡´??| ë²„ì „ | ?©ë„ |
|--------|------|------|
| Electron | ^28.0.0 | ?°ìŠ¤?¬í†± ???„ë ˆ?„ì›Œ??|
| electron-store | ^8.1.0 | ?¤ì • ?€??|
| electron-log | ^5.0.0 | ë¡œê¹… |

---

## 7. ê¸°ìˆ ???œì•½?¬í•­ ë°?ë¦¬ìŠ¤??
### 7.1 DOM ?€?‰í„° ë³€ê²?ë¦¬ìŠ¤??
| ë¦¬ìŠ¤??| ?í–¥??| ?€??ë°©ì•ˆ |
|--------|--------|-----------|
| AI ?œë¹„??UI ?…ë°?´íŠ¸ë¡??€?‰í„° ë¬´íš¨??| ?’ìŒ | ?¤ì¤‘ ?€?‰í„° ?´ë°±, ?ê²© ?…ë°?´íŠ¸ ê¸°ëŠ¥, ?œë§¨???ì„± ?°ì„  ?¬ìš© |
| ?ˆë¡œ??Bot ?ì? ?„ì… | ì¤‘ê°„ | ?€?´í•‘ ?œë??ˆì´?? ?¤ì œ KeyboardEvent ?¬ìš©, User-Agent ë³€ì¡?|
| CSP ?•ì±… ê°•í™” | ì¤‘ê°„ | Electron ?¤ë” ì¡°ì‘?¼ë¡œ ?°íšŒ ê°€??|

### 7.2 ?€?‰í„° ?ìƒ‰ ?°ì„ ?œìœ„

ê°??œë¹„?¤ì˜ ?…ë ¥ì°½ì„ ì°¾ì„ ???¤ìŒ ?œì„œë¡??€?‰í„°ë¥??œë„?©ë‹ˆ??

1. `data-testid` ?ì„± (ê°€???ˆì •??
2. `aria-label` ?ì„±
3. `id` ?ì„±
4. `placeholder` ?ì„±
5. `class` ê¸°ë°˜ ë³µí•© ?€?‰í„° (ê°€??ë¶ˆì•ˆ??

---

## 8. ?¤í”ˆ ?´ìŠˆ

| ID | ?´ìŠˆ | ?¤ëª… |
|----|------|------|
| OI-001 | ?ì„± ?„ë£Œ ê°ì? ê¸°ì? | ê°??œë¹„?¤ë³„ "?ì„± ?„ë£Œ" ?íƒœë¥??´ë–¤ DOM ?´ë²¤???¨í„´?¼ë¡œ ê°ì?? ì? êµ¬ì²´?ì¸ ê¸°ì????„ìš”?˜ë‹¤. |
| OI-002 | ?‘ë‹µ ë¹„êµ ê¸°ëŠ¥ | ì¶”í›„ ?‘ë‹µ ?´ìš© ë¹„êµ(?˜ì´?¼ì´?? diff, ? í° ?? ?‘ë‹µ ?œê°„ ì¸¡ì •)ë¥?ê¸°ëŠ¥ ë²”ìœ„???¬í•¨? ì? ?¬ë?ê°€ ê²°ì •?˜ì? ?Šì•˜?? |
| OI-003 | ?¬ìŠ¤ ì²´í¬ ë©”ì»¤?ˆì¦˜ | ?œë¹„??DOM ë³€ê²½ì— ?€???ë™ ê°ì? ?ëŠ” ?¬ìŠ¤ ì²´í¬ ë©”ì»¤?ˆì¦˜(?? ?€?‰í„° ?¤íŒ¨ ??ë¡œê·¸/ë¦¬í¬?????´ëŠ ?˜ì?ê¹Œì? êµ¬í˜„? ì? ?¼ì˜ê°€ ?„ìš”?˜ë‹¤. |
| OI-004 | ?¤í¬ë¡??™ê¸°??| ?¤í¬ë¡??™ê¸°??ê¸°ëŠ¥?€ ê°??µë???ê¸¸ì´ê°€ ?¤ë¥´ë¯€ë¡?UX ?€??ê°€?¥ì„±???ˆì–´ ì´ˆê¸° ?¤í™?ì„œ ?œì™¸ ?¬ë? ê²°ì • ?„ìš”. |

---

## 9. ?¥í›„ ?•ì¥ ê³„íš

### Phase 2
- DeepSeek, Perplexity, Copilot ??ì¶”ê? ?œë¹„??ì§€??- ?‘ë‹µ ?´ìš© ë¹„êµ (Diff View) ê¸°ëŠ¥

### Phase 3
- ?„ë¡¬?„íŠ¸ ?œí”Œë¦??€??ë°?ë¶ˆëŸ¬?¤ê¸°
- ?€???ˆìŠ¤? ë¦¬ ë¡œì»¬ ?€??- ?‘ë‹µ ?ˆì§ˆ ?‰ê? ë°??µê³„

### Phase 4
- API ê¸°ë°˜ ì§ì ‘ ?°ë™ ëª¨ë“œ (??UI ?°íšŒ)
- ë§ì¶¤ ?„ë¡¬?„íŠ¸ ?ë™ ë³€??(?œë¹„?¤ë³„ ìµœì ??

---

## 10. ë¶€ë¡?
### 10.1 ?„ë¡¬?„íŠ¸ ì£¼ì… ë¡œì§ (Preload Script)

```javascript
// Spec for Preload Script Logic
function injectPrompt(text) {
    const inputEl = document.querySelector(CURRENT_CONFIG.inputSelector);
    
    if (inputEl) {
        // 1. ?¬ì»¤??        inputEl.focus();
        
        // 2. ê°??¤ì • (ContentEditable vs Textarea ë¶„ê¸° ì²˜ë¦¬)
        if (inputEl.contentEditable === 'true') {
            inputEl.innerText = text;
        } else {
            // React ?¸í™˜ setter ?¬ìš©
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, 'value'
            ).set;
            nativeInputValueSetter.call(inputEl, text);
        }

        // 3. React/Framework Change Detection ?¸ë¦¬ê±?(?„ìˆ˜)
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 4. ?„ì†¡ ë²„íŠ¼ ?´ë¦­ (?½ê°„???œë ˆ??ê¶Œì¥)
        setTimeout(() => {
            const btn = document.querySelector(CURRENT_CONFIG.btnSelector);
            if (btn && !btn.disabled) btn.click();
        }, 100);
    }
}
```

### 10.2 ?´ë²¤???”ìŠ¤?¨ì¹˜ ?œì„œ

?„ë ˆ?„ì›Œ???¸í™˜?±ì„ ?„í•œ ?´ë²¤??ë°œìƒ ?œì„œ:

```javascript
// Textarea
element.focus();
element.value = text;
element.dispatchEvent(new Event('input', { bubbles: true }));
element.dispatchEvent(new Event('change', { bubbles: true }));

// ContentEditable
element.focus();
document.execCommand('selectAll', false, null);
document.execCommand('insertText', false, text);
// ?ëŠ”
element.textContent = text;
element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
```

### 10.3 ?‘ë‹µ ?„ë£Œ ê°ì? ë¡œì§

```javascript
const observer = new MutationObserver((mutations) => {
  const sendButton = document.querySelector(sendButtonSelector);
  const stopButton = document.querySelector(stopButtonSelector);
  
  if (sendButton && !sendButton.disabled && !stopButton) {
    // ?‘ë‹µ ?„ë£Œ
    observer.disconnect();
    notifyResponseComplete();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['disabled', 'aria-disabled']
});
```

---

**ë¬¸ì„œ ??*
