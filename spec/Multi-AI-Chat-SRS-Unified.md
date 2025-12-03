# Multi-AI Chat Desktop Application
## Software Requirements Specification (SRS)
### EARS (Easy Approach to Requirements Syntax) 기반 통합 요구사항 명세서

**문서 버전**: 0.6.0 (익명 교차 검증 및 Modern UI 구현)  
**작성일**: 2025-12-03  
**프로젝트명**: Multi-AI Chat (코드명: MAPB - Multi AI Prompt Broadcaster / Clash of LLMs)

---

## 1. 개요

### 1.1 목적

본 문서는 Windows 환경에서 동작하는 Electron 기반 데스크톱 애플리케이션의 요구사항을 정의한다. 본 시스템의 목표는 사용자가 하나의 통합 입력창(Master Input)에 프롬프트를 입력하면, 이를 ChatGPT, Claude, Gemini 웹 클라이언트에 동시에 전송하고, 각 서비스의 응답을 한 화면에서 비교할 수 있도록 지원하는 것이다.

### 1.2 범위

#### 1.2.1 대상 플랫폼
- Windows 10/11 (64-bit)
- Electron 기반 데스크톱 앱
- 기술 스택: Electron, Node.js, HTML/CSS/JavaScript

#### 1.2.2 지원 서비스 (Phase 1)
- ChatGPT (chat.openai.com 또는 chatgpt.com)
- Claude (claude.ai)
- Gemini (gemini.google.com/app)
- Grok (grok.com)
- Perplexity (perplexity.ai)

#### 1.2.3 범위에 포함
- 멀티 패널 UI(최소 3분할): 각 패널에 서비스 웹 화면 로딩
- 마스터 입력창에서의 프롬프트 동시 전송
- 서비스별 전송 대상 on/off 토글
- 응답 상태(진행 중/완료) 표시
- 세션 영속성 및 자동 재로그인

#### 1.2.4 범위에 제외
- 각 서비스의 API 직접 호출
- 계정 생성/관리 (각 서비스 공급자의 로그인 UI 사용)
- 프롬프트/응답의 장기 저장 및 클라우드 동기화 기능

### 1.3 용어 정의

| 용어 | 정의 |
|------|------|
| MAPB | Multi AI Prompt Broadcaster (본 Electron 앱) |
| Master Input | 모든 AI 서비스에 동시 전송되는 통합 입력창 |
| Service Panel / 패널(Panel) | 개별 AI 서비스가 표시되는 BrowserView 영역 |
| Selector Config | 각 AI 서비스의 DOM 요소를 식별하는 설정 정보 |
| Session Partition | 서비스별로 격리된 쿠키/세션 저장 영역 |
| Typing Simulation | Bot 탐지 우회를 위한 인간 유사 타이핑 시뮬레이션 |
| 타겟(Target) | 프롬프트를 실제로 전송할 서비스 집합 |

### 1.4 EARS 패턴 표기

본 문서에서 사용하는 EARS 패턴:

| 패턴 | 형식 | 설명 |
|------|------|------|
| **[Ubiquitous]** | `The system shall <response>.` | 항상 적용되는 요구사항 |
| **[Event-driven]** | `When <trigger>, the system shall <response>.` | 특정 이벤트 발생 시 동작 |
| **[State-driven]** | `While <state>, the system shall <response>.` | 특정 상태 유지 중 동작 |
| **[Optional]** | `Where <feature>, the system shall <response>.` | 선택적/조건부 기능 |
| **[Unwanted]** | `If <undesired trigger>, then the system shall <response>.` | 원치 않는 상황 대응 |

### 1.5 참조 문서
- Electron 공식 문서 (https://www.electronjs.org/docs)
- Chrome DevTools Protocol (CDP)
- 각 AI 서비스 Terms of Service

---

## 2. 이해관계자 및 사용자

### 2.1 최종 사용자 (End User)
- 여러 AI 서비스를 동시에 사용하는 개인/전문가
- 한 번의 프롬프트로 여러 모델의 응답을 비교하고 싶은 사용자

### 2.2 운영·개발자 (Developer/Maintainer)
- 앱 유지보수 및 기능 개선 담당
- 서비스 DOM 변경에 따른 셀렉터 업데이트 담당

---

## 3. 시스템 아키텍처

### 3.1 컴포넌트 구조

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Window    │  │   Session   │  │   IPC Message       │  │
│  │   Manager   │  │   Manager   │  │   Router            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  BrowserView    │ │  BrowserView    │ │  BrowserView    │
│  (ChatGPT)      │ │  (Claude)       │ │  (Gemini)       │
│  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │
│  │ Preload   │  │ │  │ Preload   │  │ │  │ Preload   │  │
│  │ Script    │  │ │  │ Script    │  │ │  │ Script    │  │
│  └───────────┘  │ │  └───────────┘  │ │  └───────────┘  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          ▲                   ▲                   ▲
          └───────────────────┼───────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Master Input Component                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 프로세스 역할

| 프로세스 | 역할 |
|----------|------|
| Main Process | 애플리케이션 수명 주기 관리, BrowserWindow 생성, Global Shortcut 처리 |
| Renderer Process | Master Input UI, 레이아웃 제어 UI |
| Preload Scripts | contextBridge를 사용한 IPC 통신 채널 확보, 각 AI 사이트 내부 Content Script 역할 |

### 3.3 서비스 엔드포인트

| 서비스 | URL | 비고 |
|--------|-----|------|
| ChatGPT | https://chat.openai.com 또는 https://chatgpt.com | OpenAI 계정 또는 Google SSO |
| Claude | https://claude.ai | Anthropic 계정 또는 Google SSO |
| Gemini | https://gemini.google.com/app | Google 계정 필수 |
| Grok | https://grok.com | X(Twitter) 계정 필수 |
| Perplexity | https://www.perplexity.ai | Google SSO 또는 이메일 로그인 |

---

## 4. 기능 요구사항 (EARS 형식)

### 4.1 애플리케이션 초기화 (APP)

#### APP-001: 애플리케이션 시작
**[Ubiquitous]**  
The system shall create a main window with dimensions 1400x900 pixels (minimum) upon application launch.

#### APP-002: 레이아웃 초기화
**[Event-Driven]**  
When the main window is created, the system shall divide the window into a 4-panel grid layout (1x4) by default, activating ChatGPT, Claude, Gemini, and Perplexity.

#### APP-003: Master Input 영역
**[Ubiquitous]**  
The system shall display a Master Input area at the bottom of the main window with a minimum height of 80 pixels.

#### APP-004: 서비스 토글 컨트롤
**[Ubiquitous]**  
The system shall provide, adjacent to the Master Input, toggle controls that allow the user to enable or disable each target service (ChatGPT, Claude, Gemini, Grok, Perplexity) individually.

#### APP-004-1: 새 대화 버튼
**[Ubiquitous]**  
The system shall display a "New" button to the left of the service toggle controls to allow users to quickly reset conversations.

#### APP-005: 전송 버튼
**[Ubiquitous]**  
The system shall display a "Send" button associated with the Master Input.

#### APP-006: BrowserView 생성
**[Event-Driven]**  
When the layout is initialized, the system shall create separate BrowserView instances for all enabled services (ChatGPT, Claude, Gemini, Grok, Perplexity), each with isolated sandbox environment.

#### APP-007: 서비스 페이지 로딩
**[Ubiquitous]**  
The system shall load the official web UI of each service into its assigned panel using a dedicated BrowserView.

---

### 4.2 세션 및 인증 관리 (AUTH)

#### AUTH-001: 세션 파티션 분리
**[Ubiquitous]**  
The system shall create isolated session partitions for each AI service using the naming convention `persist:service-{serviceName}`.

#### AUTH-002: 쿠키 영속성
**[Ubiquitous]**  
The system shall persist session cookies across application restarts by using persistent partition storage.

#### AUTH-003: 세션 보존
**[State-driven]**  
While the application is running, the system shall preserve each BrowserView's session (Cookie, LocalStorage) to maintain the user's login state.

#### AUTH-004: 로그인 상태 감지
**[Event-Driven]**  
When a Service Panel completes page loading, the system shall detect login status by checking for service-specific DOM elements.

| 서비스 | 로그인 완료 셀렉터 (예시) |
|--------|---------------------------|
| ChatGPT | `textarea[id="prompt-textarea"]` 존재 |
| Claude | `div[contenteditable="true"]` 존재 |
| Gemini | `div[contenteditable="true"]` 또는 입력 영역 존재 |
| Grok | `div.ProseMirror` 또는 `div[contenteditable="true"]` 존재 |
| Perplexity | `div[data-lexical-editor="true"]` 또는 `#ask-input` 존재 |

#### AUTH-005: 로그인 필요 표시
**[State-Driven]**  
While a service is in logged-out state, the system shall display a visual indicator (overlay badge) on the corresponding Service Panel indicating "로그인 필요".

#### AUTH-006: 미로그인 상태 처리
**[State-driven]**  
While the user has not logged in to a service, the system shall display a "로그인 필요" badge with a "Chrome으로 로그인" button. Clicking this button opens an external Chrome window for authentication.

#### AUTH-007: Google SSO 지원
**[Event-Driven]**  
When a user initiates Google OAuth flow within any Service Panel, the system shall allow popup windows for authentication and properly handle OAuth redirects.

#### AUTH-008: 로그인 세션 저장
**[Event-driven]**  
When the user successfully logs in to a service within a panel (or via external Chrome), the system shall persist the session cookies in the associated Electron session partition to allow automatic re-login on subsequent launches.

#### AUTH-009: 세션 만료 감지
**[Event-Driven]**  
When a service redirects to a login page during use, the system shall detect this and update the panel status to "재로그인 필요".

#### AUTH-010: 로컬 데이터 초기화
**[Event-driven]**  
When the user requests a "Clear local data" operation, the system shall clear all cookies and local storage for each service's session partition.

---

### 4.3 보안 및 우회 (SEC)

#### SEC-001: X-Frame-Options 우회
**[Ubiquitous]**  
The system shall intercept and modify HTTP response headers to remove 'X-Frame-Options' and 'Content-Security-Policy' headers that prevent embedding.

```javascript
// 구현 참조
session.webRequest.onHeadersReceived((details, callback) => {
  const headers = details.responseHeaders;
  delete headers['x-frame-options'];
  delete headers['content-security-policy'];
  callback({ responseHeaders: headers });
});
```

#### SEC-002: User-Agent 변조
**[Ubiquitous]**  
The system shall set the User-Agent to a standard Chrome browser string to minimize bot detection by AI services.

#### SEC-003: 세션 격리
**[Ubiquitous]**  
The system shall ensure complete session isolation between Service Panels to prevent cross-service data leakage.

#### SEC-004: 외부 통신 제한
**[Ubiquitous]**  
The system shall not transmit any user data to external servers other than the three configured AI services.

#### SEC-005: Preload 스크립트 격리
**[Ubiquitous]**  
The system shall enable context isolation for all BrowserView instances and disable Node.js integration in renderer processes.

```javascript
// 구현 참조
new BrowserView({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
});
```

#### SEC-006: 자격증명 미저장
**[Ubiquitous]**  
The system shall not store user account credentials for any AI service; all authentication shall occur within the official service web pages.

#### SEC-007: 로컬 저장소 암호화
**[Optional]**  
Where sensitive data protection is enabled, the system shall encrypt session data stored on disk using the operating system's credential storage API.

#### SEC-008: 외부 로그인 보안 검증
**[Ubiquitous]**  
When using the "Login in Chrome" feature, the system shall verify that the external browser URL matches the service's main domain (not a login page) before syncing cookies, ensuring only valid sessions are captured.

---

### 4.4 프롬프트 입력 및 전송 (INPUT)

#### INPUT-001: 전송 버튼 클릭
**[Event-Driven]**  
When the user clicks the "Send" button, the system shall capture the current text in the Master Input as the prompt.

#### INPUT-002: 키보드 전송 (Enter)
**[Event-Driven]**  
When the user presses Enter (without Shift) in the Master Input, the system shall broadcast the input text to all enabled Service Panels.

#### INPUT-003: 키보드 전송 (Ctrl+Enter)
**[Event-driven]**  
When the user presses `Ctrl+Enter` inside the Master Input, the system shall behave as if the "Send" button were clicked, triggering the delivery of both the prompt text and any attached files.

#### INPUT-004: 멀티라인 입력
**[Event-Driven]**  
When the user presses Shift+Enter in the Master Input, the system shall insert a newline character without triggering broadcast.

#### INPUT-005: 빈 입력 방지
**[Unwanted]**  
If the Master Input is empty when the user attempts to send, then the system shall not broadcast any prompt and shall show a non-blocking warning to the user.

#### INPUT-006: 타겟 서비스 결정
**[Event-driven]**  
When the user sends a prompt, the system shall determine the active target services based on the user's toggle selections.

#### INPUT-007: IPC 브로드캐스트
**[Event-Driven]**  
When the user triggers send from the Master Input, the system shall use IPC (Inter-Process Communication) to broadcast the text data to all enabled BrowserViews.

#### INPUT-008: DOM 셀렉터 설정
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

#### INPUT-009: 다중 셀렉터 폴백
**[State-Driven]**  
While attempting to locate an input field, the system shall try each selector in the configured array sequentially until a valid element is found.

#### INPUT-010: DOM 요소 탐색
**[State-driven]**  
While each AI service page is loading, the system shall inject a predefined preload script to search for the input field selector and send button selector appropriate for that domain.

#### INPUT-011: 프롬프트 주입
**[Event-driven]**  
When a target service is selected, the system shall programmatically locate the primary text input element (textarea or equivalent) in the corresponding panel and set its value to the prompt.

#### INPUT-012: React/Vue 호환 입력
**[Ubiquitous]**  
The system shall trigger appropriate DOM events (input, change, keydown synthetic events) after setting input values to ensure React/Vue/Angular frameworks detect the change.

```javascript
// 구현 참조: textarea 요소
function setTextareaValue(element, text) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  ).set;
  nativeInputValueSetter.call(element, text);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

// 구현 참조: contenteditable 요소
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

#### INPUT-013: 이벤트 트리거
**[Event-driven]**  
When the prompt value has been injected into the service's input element, the system shall trigger an appropriate input event (e.g., `input`, `change`) so that the service recognizes the updated value.

#### INPUT-014: 타이핑 시뮬레이션
**[Optional]**  
Where typing simulation is enabled, the system shall input text character by character with a random delay of 20-80ms between keystrokes to avoid bot detection.

#### INPUT-015: 자동 전송
**[Event-Driven]**  
When text input is complete in a Service Panel, the system shall automatically click the send button after a configurable delay (default: 100ms).

#### INPUT-016: 전송 버튼 활성화
**[Event-driven]**  
When the service input has been updated, the system shall locate and activate the service's "Send" or "Submit" control to initiate message generation.

#### INPUT-017: DOM 요소 미발견 처리
**[Unwanted]**  
If the system cannot find the input element or send button for a selected service, then the system shall skip broadcasting to that service and show a visible but non-blocking status message (e.g., "ChatGPT DOM not found") and allow manual text input via clipboard paste as fallback.

#### INPUT-018: 전송 실패 처리
**[Unwanted]**  
If the send button is not found or is disabled, then the system shall log the error and display a notification "전송 실패: {서비스명}".

---

### 4.5 응답 감지 및 상태 관리 (RESP)

#### RESP-001: 진행 상태 설정
**[Event-driven]**  
When a prompt is sent to a target service, the system shall set the status of that service to "In progress" and start monitoring for response generation using MutationObserver.

#### RESP-002: 진행 상태 유지
**[State-driven]**  
While the service is generating a response, the system shall maintain the "In progress" status indicator (e.g., spinner, badge) for that service on the corresponding Service Panel header.

#### RESP-003: 응답 완료 감지
**[Event-driven]**  
When the service's send button becomes re-enabled or when a defined DOM indicator shows that generation has finished (stop button disappearance, loading indicator removal), the system shall set the status of that service to "Completed".

```javascript
// 구현 참조
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

#### RESP-004: 타임아웃 처리
**[Unwanted]**  
If the service's status does not change to "Completed" within a configurable timeout period (default: 5 minutes), then the system shall mark the status as "타임아웃" and stop monitoring, optionally presenting a hint to the user to manually inspect the panel.

#### RESP-005: 전체 완료 알림
**[Event-Driven]**  
When all enabled services have completed response generation, the system shall provide a visual/audio notification to the user.

---

### 4.6 레이아웃 및 UI (LAYOUT)

#### LAYOUT-001: 기본 패널 표시
**[Ubiquitous]**  
The system shall display panels for enabled services (default: ChatGPT, Claude, Gemini, Perplexity).

#### LAYOUT-002: 레이아웃 모드
**[Ubiquitous]**  
The system shall support the following layout configurations:
- 1x3 (Horizontal Split) - 3개 서비스 활성화 시 강제
- 1x4 (Horizontal Split) - 4개 이상 서비스 활성화 시 기본값
- 2x2 (Grid Layout) - 4개 이상 서비스 활성화 시 선택 가능

#### LAYOUT-003: 동적 레이아웃 재조정
**[Event-driven]**  
When the user clicks the 'layout change' button, the system shall automatically readjust the screen split (Grid Layout) according to the number of currently enabled AI services. (e.g., 2 services = 2-split, 3-4 services = 4-split)

#### LAYOUT-004: 패널 크기 조절
**[Event-Driven]**  
When the user drags a panel divider (vertical or horizontal), the system shall resize adjacent panels in real-time or upon drag completion, maintaining a minimum panel width/height of 100 pixels.

#### LAYOUT-004-1: 2x2 리사이징
**[Event-Driven]**
When in 2x2 layout, the system shall provide a central horizontal splitter to resize row heights and vertical splitters within each row to resize column widths.

#### LAYOUT-005: 패널 활성화/비활성화
**[Event-Driven]**  
When the user clicks a service toggle button, the system shall enable/disable the corresponding Service Panel and redistribute layout space.

#### LAYOUT-006: 전체화면 모드
**[Event-Driven]**  
When the user double-clicks a Service Panel header, the system shall expand that panel to full window size. Double-clicking again shall restore the original layout.

#### LAYOUT-007: 윈도우 크기 조절
**[Event-Driven]**  
When the main window is resized, the system shall proportionally adjust all Service Panel and Master Input dimensions so that all panels and the Master Input remain fully visible without overlap.

#### LAYOUT-008: 최소 윈도우 크기
**[Ubiquitous]**  
The system shall enforce a minimum window size of 1200x700 pixels.

#### LAYOUT-009: 비활성화 서비스 표시
**[Optional]**  
Where a service is disabled in the configuration, the system shall hide or grey out the corresponding panel and toggle.

#### LAYOUT-010: Modern UI (shadcn/ui Style)
**[Ubiquitous]**
The system shall implement a modern user interface for the Master Input and control area, replicating the design aesthetics of the **shadcn/ui** design system (clean typography, subtle borders, specific color palette, and component styling) using vanilla CSS.

---

### 4.7 설정 관리 (CONFIG)

#### CONFIG-001: 설정 저장
**[Ubiquitous]**  
The system shall persist user settings in a JSON configuration file located at `%APPDATA%/multi-ai-chat/config.json`.

#### CONFIG-002: 설정 항목
**[Ubiquitous]**  
The system shall support the following configurable options:

| 설정 항목 | 타입 | 기본값 | 설명 |
|-----------|------|--------|------|
| layout.mode | string | "horizontal-3" | 레이아웃 모드 |
| layout.panelOrder | array | ["chatgpt","claude","gemini"] | 패널 순서 |
| input.typingSimulation | boolean | false | 타이핑 시뮬레이션 활성화 |
| input.typingDelayMin | number | 20 | 최소 타이핑 딜레이 (ms) |
| input.typingDelayMax | number | 80 | 최대 타이핑 딜레이 (ms) |
| input.autoSendDelay | number | 100 | 자동 전송 딜레이 (ms) |
| response.timeout | number | 300000 | 응답 타임아웃 (ms) |
| notification.sound | boolean | true | 완료 알림음 |
| notification.visual | boolean | true | 시각적 완료 알림 |
| services.enabled | object | {chatgpt:true, claude:true, gemini:true, grok:false, perplexity:true} | 서비스 활성화 상태 |

#### CONFIG-003: 외부 셀렉터 설정
**[Optional]**  
Where a configuration file exists defining DOM selectors and behaviors for each service, the system shall use these definitions instead of hard-coded selectors.

#### CONFIG-004: 설정 적용
**[Event-driven]**  
When the configuration file is updated and the system is restarted, the system shall apply the new selectors and behaviors without requiring code changes.

#### CONFIG-005: 셀렉터 원격 업데이트
**[Optional]**  
Where remote selector update is enabled, the system shall check for updated Selector Config from a configured URL on application startup.

#### CONFIG-006: 설정 UI
**[Event-Driven]**  
When the user opens the settings dialog (Ctrl+,), the system shall display a modal window with all configurable options.

---

### 4.8 키보드 단축키 (SHORT)

#### SHORT-001: 글로벌 단축키
**[Ubiquitous]**  
The system shall support the following keyboard shortcuts:

| 단축키 | 동작 |
|--------|------|
| Ctrl+1, 2, 3 | 해당 순번 Service Panel로 포커스 이동 |
| Ctrl+Enter | Master Input에서 즉시 전송 (Enter와 동일) |
| Ctrl+Shift+Enter | 모든 대화 초기화 (새 대화 시작) |
| Ctrl+, | 설정 창 열기 |
| Ctrl+L | Master Input으로 포커스 이동 |
| F11 | 전체화면 토글 |
| Ctrl+R | 현재 포커스된 Service Panel 새로고침 |
| Ctrl+Shift+R | 모든 Service Panel 새로고침 |

#### SHORT-002: Master Input 입력창 초기화
**[Event-Driven]**  
When the Master Input is focused and the user presses Escape, the system shall clear the input field.

#### SHORT-003: 패널 포커스 이동
**[Optional]**  
Where the user presses `Ctrl+1`, `Ctrl+2`, or `Ctrl+3`, the system shall bring the corresponding service panel into focus and scroll to the latest conversation area if necessary.

---

### 4.9 에러 처리 및 복구 (ERR)

#### ERR-001: 네트워크 오류 및 새로고침
**[Event-Driven]**  
If a Service Panel fails to load or becomes unresponsive, the system shall provide a "Refresh" button (🔄) on the panel header. Clicking this button shall reload ONLY the specific service view where the button was clicked.

#### ERR-002: DOM 셀렉터 실패
**[Unwanted]**  
If all configured selectors fail to locate an input field, then the system shall:
1. Log detailed error information including current page HTML snapshot
2. Display a notification "입력창을 찾을 수 없습니다. 셀렉터 업데이트가 필요합니다."
3. Allow manual text input via clipboard paste (fallback)

#### ERR-003: 크래시 및 윈도우 복구
**[Event-Driven]**  
When a service view is closed, crashed, or missing, toggling the service OFF and then ON via the checkbox controls shall automatically recreate and restore the service view.

#### ERR-004: Captcha/Cloudflare 감지
**[Unwanted]**  
If bot detection triggers a Captcha challenge, then the system shall pause DOM manipulation and notify the user with "보안 확인 필요" status.

---

### 4.10 대화 관리 (CONV)

#### CONV-001: 새 대화 시작 (버튼)
**[Event-Driven]**  
When the user clicks the "New" button, the system shall initiate a new conversation for all currently enabled AI services.

#### CONV-002: 새 대화 시작 (단축키)
**[Event-Driven]**  
When the user presses `Ctrl+Shift+Enter` in the Master Input, the system shall initiate a new conversation for all currently enabled AI services.

#### CONV-003: 서비스별 초기화 URL
**[Ubiquitous]**  
The system shall use the following URLs to reset conversations:
- ChatGPT: `https://chatgpt.com/`
- Claude: `https://claude.ai/new`
- Gemini: `https://gemini.google.com/app`
- Grok: `https://grok.com`
- Perplexity: `https://www.perplexity.ai`

#### CONV-004: DOM 기반 초기화 (Fallback)
**[Optional]**  
Where URL navigation fails to start a new chat (e.g., redirects to old chat), the system shall attempt to find and click the "New Chat" button within the service's DOM.

---

### 4.11 대화 내용 복사 (COPY)

#### COPY-001: 복사 버튼 표시
**[Ubiquitous]**  
The system shall display a "Copy Chat Thread" button in the control panel with a distinct background color (e.g., Teal #2b5c5c) to distinguish it from other controls.

#### COPY-002: 대화 내용 추출
**[Event-Driven]**  
When the user clicks the "Copy Chat Thread" button, the system shall extract the text content from all currently enabled Service Panels.

#### COPY-003: 클립보드 저장
**[Event-Driven]**  
When the text content has been extracted from all enabled services, the system shall format the content with service headers and write it to the system clipboard.

#### COPY-004: 추출 셀렉터 설정
**[Ubiquitous]**  
The system shall use the `contentSelector` defined in `selectors.json` to identify the chat container element for each service.

#### COPY-005: 추출 폴백
**[Unwanted]**  
If the configured `contentSelector` fails to find an element, then the system shall fall back to extracting `document.body.innerText`.

#### COPY-006: 비동기 병렬 처리
**[Ubiquitous]**  
The system shall execute content extraction for all enabled services in parallel to minimize waiting time.

#### COPY-007: 타임아웃
**[Unwanted]**  
If a service fails to return content within a configurable timeout (default: 2 seconds), then the system shall exclude that service's content and proceed with the rest.

#### COPY-008: 데이터 포맷팅
**[Ubiquitous]**  
The system shall format the copied text as follows:
```text
=== {ServiceName} ===
{Content}

=== {ServiceName} ===
{Content}
```

#### COPY-009: 복사 완료 피드백
**[Event-Driven]**
When the copy operation is successful, the system shall temporarily change the "Copy Chat Thread" button text to "Copied!" for 2 seconds before reverting to the original text.

#### COPY-010: 개별 패널 복사 버튼
**[Ubiquitous]**
The system shall display a floating "Copy" button below the "Reload" button in each Service Panel. Clicking this button shall copy only that specific service's chat thread to the clipboard with visual feedback.

---

### 4.12 교차 검증 (CROSS)

#### CROSS-001: 교차 검증 버튼
**[Ubiquitous]**
The system shall display a "Cross Check" button in the control panel, adjacent to the "Copy Chat Thread" button.

#### CROSS-002: 교차 검증 로직
**[Event-Driven]**
When the user clicks the "Cross Check" button, the system shall:
1. Extract chat history from all currently enabled and active Service Panels.
2. Construct a specific prompt for each enabled service that includes the chat history of *other* enabled services.
3. Inject the constructed prompt into each service's input field.
4. Automatically trigger the send action.

#### CROSS-003: 프롬프트 구성
**[Ubiquitous]**
The system shall construct the prompt for a target service (e.g., Service A) as follows:
```text
[Service B Thread]
...
[Service C Thread]
...
```
It shall exclude the target service's own thread from its input.

#### CROSS-004: 비활성 패널 처리
**[State-Driven]**
While a service panel is disabled or closed, the system shall exclude its content from the cross-check context and shall not send a prompt to that service.

#### CROSS-005: 빈 컨텐츠 처리
**[Unwanted]**
If a service's thread is empty, then the system shall exclude it from the context provided to other services.

---

### 4.13 파일 업로드 (FILE)

#### FILE-001: 파일 첨부 UI
**[Ubiquitous]**
The system shall display a "Clip" icon button within or adjacent to the Master Input area.

#### FILE-002: 파일 선택 다이얼로그
**[Event-Driven]**
When the user clicks the "Clip" icon, the system shall open a native file selection dialog allowing multiple file selection.

#### FILE-003: 파일 미리보기 및 관리
**[State-Driven]**
While files are attached, the system shall display a list of attached files (chips or list view) showing the filename and a "Remove" (X) button for each.

#### FILE-004: 드래그 앤 드롭
**[Event-Driven]**
When the user drags and drops files into the Master Input area, the system shall add them to the attached file list.

#### FILE-005: 클립보드 이미지 붙여넣기
**[Event-Driven]**
When the user pastes an image from the clipboard into the Master Input area, the system shall automatically convert it to an image file (e.g., `paste-{timestamp}.png`) and add it to the attached file list.

#### FILE-006: 클립보드 텍스트 파일 변환
**[Event-Driven]**
When the user pastes text into the **File Preview Area** (or uses a specific "Paste as File" action), the system shall automatically convert the text content into a text file (e.g., `paste-{timestamp}.txt`) and add it to the attached file list.
*Note: Standard pasting into the text input field shall remain as text insertion.*

#### FILE-007: 2단계 전송 프로세스 (Two-Step Send)
**[Event-Driven]**
When the user triggers the "Send" action with attached files, the system shall:
1. Upload files to all enabled Service Panels.
2. Display a confirmation modal ("파일 업로드 완료 확인 후, Ctrl + Enter를 입력하여 진행해주세요.").
3. Wait for the user to press `Ctrl+Enter` again to confirm and trigger the final send action.

#### FILE-008: 파일 업로드 메커니즘
**[Ubiquitous]**
The system shall use the Chrome DevTools Protocol (CDP) `DOM.setFileInputFiles` method to programmatically attach files. For services like Gemini where the file input is dynamic, the system shall simulate necessary UI interactions (e.g., clicking upload buttons) to reveal the input field.

#### FILE-009: 파일 입력 셀렉터
**[Ubiquitous]**
The system shall maintain `fileInputSelector`, `uploadIconSelector`, and `uploadMenuButtonSelector` in `selectors.json` to handle various service-specific upload UI patterns.

#### FILE-010: 업로드 대기 및 검증
**[State-Driven]**
While files are being uploaded, the system shall wait for UI indicators (defined in `uploadedFileSelector`) to confirm successful attachment before allowing the final send action.

#### FILE-011: 클립보드 붙여넣기 (이미지/텍스트)
**[Event-Driven]**
- **Image**: When an image is pasted, it is converted to a PNG file.
- **Text**: When long text (>5 lines) is pasted into the file preview area or when explicitly requested, it is converted to a TXT file.

#### FILE-012: 드래그 앤 드롭
**[Event-Driven]**
The system shall support dragging and dropping files directly into the Master Input area to attach them.

---

### 4.14 익명 모드 (ANON)

#### ANON-001: 익명 모드 토글
**[Ubiquitous]**
The system shall display an "Anonymous" (익명) toggle button adjacent to the "Cross Check" button in the control panel.

#### ANON-002: 서비스 별칭 표시
**[State-Driven]**
While Anonymous mode is ON, the system shall display service toggle buttons with aliases instead of their full names:
- ChatGPT -> **(A)**
- Claude -> **(B)**
- Gemini -> **(C)**
- Grok -> **(D)**
- Perplexity -> **(E)**

#### ANON-003: 익명 프롬프트 구성
**[State-Driven]**
While Anonymous mode is ON and a Cross Check is initiated, the system shall replace all occurrences of service names in the generated prompt with their corresponding aliases (e.g., replace "Claude" with "(B)").

#### ANON-004: 익명 교차 검증 실행
**[Event-Driven]**
When the user executes a Cross Check with Anonymous mode ON, the system shall send the anonymized prompts to each service, ensuring that no service receives explicit names of other services in the context.

---

## 5. 비기능 요구사항 (NFR)

### 5.1 성능 (PERF)

#### NFR-PERF-001: 초기 로딩 시간
**[State-driven]**  
While the host machine meets the minimum hardware specification (e.g., 8 GB RAM, modern CPU with SSD storage), the system shall open and render all three service panels within 10 seconds after launch under normal network conditions.

#### NFR-PERF-002: 프롬프트 주입 속도
**[Event-driven]**  
When the user sends a prompt to all three services, the system shall inject the prompt into all selected services within 1 second (200ms per service), excluding network latency and service-side processing time.

#### NFR-PERF-003: 메모리 사용량
**[Ubiquitous]**  
The system shall consume no more than 1.5GB of RAM under normal operation with all three Service Panels active.

#### NFR-PERF-004: 시작 시간
**[Ubiquitous]**  
The system shall complete initial loading and display the main window within 5 seconds on a system with SSD storage.

### 5.2 사용성 (USAB)

#### NFR-USAB-001: 일관된 시각적 레이아웃
**[Ubiquitous]**  
The system shall provide a consistent visual layout, using clear labels and icons for each service and status indicator.

#### NFR-USAB-002: 자연어 에러 메시지
**[Ubiquitous]**  
The system shall provide basic error messages in natural language explaining failures such as "service not loaded" or "DOM not found".

#### NFR-USAB-003: 첫 사용 가이드
**[Event-Driven]**  
The system shall display a first-run tutorial overlay explaining basic operations (including that users must manually log in to each service once) on initial launch.

#### NFR-USAB-004: 상태 표시
**[Ubiquitous]**  
The system shall provide clear visual feedback for all operations (loading, sending, generating, complete).

### 5.3 유지보수성 (MAINT)

#### NFR-MAINT-001: 로깅
**[Ubiquitous]**  
The system shall log all significant events and errors to a rotating log file at `%APPDATA%/multi-ai-chat/logs/`.

#### NFR-MAINT-002: 셀렉터 외부화
**[Optional]**  
Where selectors or DOM structures change for a service, the system shall allow maintainers to update service-specific DOM configuration without rebuilding the entire application.

#### NFR-MAINT-003: 모듈화
**[Ubiquitous]**  
The system shall separate service-agnostic logic (broadcast, UI layout, IPC) from service-specific DOM-handling logic to facilitate future addition of new services.

---

## 6. 시스템 제약 조건

### 6.1 OS 제약
- 초기 버전은 Windows 10/11 (64-bit)만 지원한다.

### 6.2 네트워크 제약
- 모든 기능은 사용자의 네트워크 환경에서 각 서비스 도메인에 접근 가능하다는 전제 하에 동작한다.

### 6.3 법적/정책 제약
- 각 서비스의 이용 약관(ToS) 및 자동화 관련 정책을 위반하지 않는 범위에서 DOM 자동 입력을 수행해야 한다.
- 본 애플리케이션은 개인 생산성 도구로 사용되며, 상업적 목적이나 대량 자동화에는 사용되지 않음을 전제로 한다.

### 6.4 의존성

| 의존성 | 버전 | 용도 |
|--------|------|------|
| Electron | ^28.0.0 | 데스크톱 앱 프레임워크 |
| electron-store | ^8.1.0 | 설정 저장 |
| electron-log | ^5.0.0 | 로깅 |

---

## 7. 기술적 제약사항 및 리스크

### 7.1 DOM 셀렉터 변경 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| AI 서비스 UI 업데이트로 셀렉터 무효화 | 높음 | 다중 셀렉터 폴백, 원격 업데이트 기능, 시맨틱 속성 우선 사용 |
| 새로운 Bot 탐지 도입 | 중간 | 타이핑 시뮬레이션, 실제 KeyboardEvent 사용, User-Agent 변조 |
| CSP 정책 강화 | 중간 | Electron 헤더 조작으로 우회 가능 |

### 7.2 셀렉터 탐색 우선순위

각 서비스의 입력창을 찾을 때 다음 순서로 셀렉터를 시도합니다:

1. `data-testid` 속성 (가장 안정적)
2. `aria-label` 속성
3. `id` 속성
4. `placeholder` 속성
5. `class` 기반 복합 셀렉터 (가장 불안정)

---

## 8. 오픈 이슈

| ID | 이슈 | 설명 |
|----|------|------|
| OI-001 | 생성 완료 감지 기준 | 각 서비스별 "생성 완료" 상태를 어떤 DOM 이벤트/패턴으로 감지할지 구체적인 기준이 필요하다. |
| OI-002 | 응답 비교 기능 | 추후 응답 내용 비교(하이라이트, diff, 토큰 수, 응답 시간 측정)를 기능 범위에 포함할지 여부가 결정되지 않았다. |
| OI-003 | 헬스 체크 메커니즘 | 서비스 DOM 변경에 대한 자동 감지 또는 헬스 체크 메커니즘(예: 셀렉터 실패 시 로그/리포트)을 어느 수준까지 구현할지 논의가 필요하다. |
| OI-004 | 스크롤 동기화 | 스크롤 동기화 기능은 각 답변의 길이가 다르므로 UX 저해 가능성이 있어 초기 스펙에서 제외 여부 결정 필요. |

---

## 9. 향후 확장 계획

### Phase 2
- DeepSeek, Perplexity, Copilot 등 추가 서비스 지원
- 응답 내용 비교 (Diff View) 기능

### Phase 3
- 프롬프트 템플릿 저장 및 불러오기
- 대화 히스토리 로컬 저장
- 응답 품질 평가 및 통계

### Phase 4
- API 기반 직접 연동 모드 (웹 UI 우회)
- 맞춤 프롬프트 자동 변환 (서비스별 최적화)

---

## 10. 부록

### 10.1 프롬프트 주입 로직 (Preload Script)

```javascript
// Spec for Preload Script Logic
function injectPrompt(text) {
    const inputEl = document.querySelector(CURRENT_CONFIG.inputSelector);
    
    if (inputEl) {
        // 1. 포커스
        inputEl.focus();
        
        // 2. 값 설정 (ContentEditable vs Textarea 분기 처리)
        if (inputEl.contentEditable === 'true') {
            inputEl.innerText = text;
        } else {
            // React 호환 setter 사용
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, 'value'
            ).set;
            nativeInputValueSetter.call(inputEl, text);
        }

        // 3. React/Framework Change Detection 트리거 (필수)
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 4. 전송 버튼 클릭 (약간의 딜레이 권장)
        setTimeout(() => {
            const btn = document.querySelector(CURRENT_CONFIG.btnSelector);
            if (btn && !btn.disabled) btn.click();
        }, 100);
    }
}
```

### 10.2 이벤트 디스패치 순서

프레임워크 호환성을 위한 이벤트 발생 순서:

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
// 또는
element.textContent = text;
element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
```

### 10.3 응답 완료 감지 로직

```javascript
const observer = new MutationObserver((mutations) => {
  const sendButton = document.querySelector(sendButtonSelector);
  const stopButton = document.querySelector(stopButtonSelector);
  
  if (sendButton && !sendButton.disabled && !stopButton) {
    // 응답 완료
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

**문서 끝**
