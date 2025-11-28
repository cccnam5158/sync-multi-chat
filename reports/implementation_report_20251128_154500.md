# 구현 보고서: v0.4 (Grok, Perplexity 및 고급 레이아웃)

**작성일**: 2025-11-28  
**작성자**: Antigravity (AI Assistant)  
**버전**: v0.4  

## 1. 개요
본 보고서는 Multi-AI Chat 애플리케이션의 v0.4 업데이트에 대한 구현 결과를 기술한다. 이번 업데이트의 핵심 목표는 새로운 AI 서비스(Grok, Perplexity)의 통합과 사용자 경험을 향상시키는 고급 레이아웃(2x2, 리사이징) 기능의 구현이다.

## 2. 주요 구현 사항

### 2.1 신규 AI 서비스 통합 (APP-004, APP-006)
- **Grok (grok.com)** 및 **Perplexity (perplexity.ai)** 서비스가 추가되었다.
- `selectors.json`에 각 서비스의 DOM 구조(Input, Send Button, Login Status, Content)를 정의하였다.
- 초기 실행 시 ChatGPT, Claude, Gemini, Perplexity 4개 서비스가 기본 활성화되도록 설정하였다.

### 2.2 동적 레이아웃 및 리사이징 (LAYOUT-002, LAYOUT-004)
- **1x4 레이아웃**: 4개 서비스 활성화 시 기본 수평 분할 레이아웃.
- **2x2 레이아웃**: 4개 이상 서비스 활성화 시 선택 가능한 그리드 레이아웃.
- **리사이징 기능**:
  - **수직 스플리터**: 패널 간 너비 조절 (1xN 및 2x2 내부).
  - **수평 스플리터**: 2x2 레이아웃의 상/하 행 높이 조절.
  - **안정성 강화**: 드래그 중에는 DOM 요소의 크기만 변경하고, 드래그 종료 시 `BrowserView` 경계를 업데이트하여 화면 깨짐 현상을 방지하였다.

### 2.3 입력 시스템 안정화 (INPUT)
- **Perplexity 입력 개선**:
  - 초기 로딩 시 입력 필드를 찾지 못하는 문제를 해결하기 위해 `service-preload.js`에 **재시도(Retry) 로직**을 추가하였다. (최대 3초 대기)
  - Lexical 에디터 활성화를 위해 입력 전 **Click 이벤트**와 **500ms 대기** 로직을 추가하여 첫 번째 입력(Ctrl+Enter) 실패 문제를 해결하였다.
- **비동기 전송**: `main.js`의 전송 로직을 비동기로 분리하고 개별 에러 핸들링을 적용하여, 한 서비스의 지연/실패가 다른 서비스에 영향을 주지 않도록 하였다.

### 2.4 UI/UX 개선
- **Copy Chat Thread 버튼 (COPY-001)**: 배경색을 **Teal (#2b5c5c)**로 변경하여 시인성을 높였다.
- **개별 리로드 (ERR-001)**: 각 패널의 Reload 버튼 클릭 시 전체가 아닌 해당 패널만 새로고침되도록 `ipcMain` 핸들러를 수정하였다.
- **레이아웃 제어**: 활성 서비스가 3개일 경우 `1x4`, `2x2` 레이아웃 버튼을 비활성화하여 사용자 혼란을 방지하였다.
- **Grok 대화 복사**: `contentSelector`를 최적화하여 대화 내용이 빈 값으로 복사되는 문제를 해결하였다.

## 3. 기술적 세부 사항

### 3.1 Renderer Process (renderer.js)
- **Layout Rendering**: `renderLayout` 함수에서 `2x2` 모드일 경우 중첩된 Flexbox 구조(`Column > Row > Slot`)를 동적으로 생성한다.
- **Resizing Logic**: `initResize` 함수는 드래그 방향(수평/수직)에 따라 `width` 또는 `height`를 픽셀 단위로 제어하며, `flex-grow` 속성을 일시적으로 비활성화하여 정확한 크기 조절을 보장한다.

### 3.2 Main Process (main.js)
- **View Bounds Update**: `update-view-bounds` IPC 메시지를 통해 Renderer로부터 계산된 좌표와 크기를 수신하고, `BrowserView.setBounds()`를 호출하여 뷰를 배치한다.
- **Isolated Reload**: `reload-active-view` 이벤트 수신 시 `event.sender.reload()`를 호출하여 요청한 WebContents만 리로드한다.

### 3.3 Preload Script (service-preload.js)
- **Robust Injection**: `injectPrompt` 함수는 `waitForSelector` 패턴을 사용하여 동적으로 로딩되는 SPA(Single Page Application) 환경에서도 안정적으로 입력 요소를 탐색한다.

## 4. 결론
v0.4 업데이트를 통해 사용자는 5개의 주요 AI 서비스(ChatGPT, Claude, Gemini, Grok, Perplexity)를 하나의 인터페이스에서 효율적으로 활용할 수 있게 되었다. 특히 2x2 레이아웃과 리사이징 기능은 다중 패널 작업의 편의성을 크게 높였으며, Perplexity 등 까다로운 DOM 구조를 가진 서비스에 대한 입력 안정성도 확보되었다.
