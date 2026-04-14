# Chat History 기능 개선 계획

## Context

Chat History에서 세션 타이틀을 수정하려면 현재 연필 아이콘 클릭 → 모달 팝업으로 진행해야 하며, 각 세션에 실제 대화 내용이 저장되지 않아 어떤 대화였는지 기억하기 어렵다. 이 개선은 (1) 인라인 타이틀 편집, (2) 대화 내용 자동 저장, (3) 미리보기 기능을 추가한다.

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| [main.js](src/main/main.js) | `get-chat-thread-json` IPC 핸들러 추가 |
| [preload.js](src/main/preload.js) | `getChatThreadJson` API 노출 |
| [renderer.js](src/renderer/renderer.js) | 인라인 편집, chatThread 저장, 미리보기 모달 |
| [index.html](src/renderer/index.html) | 미리보기 모달 HTML 추가 |
| [styles.css](src/renderer/styles.css) | 인라인 편집 입력, 미리보기 모달 스타일 |

---

## Feature 1: 더블클릭으로 타이틀 인라인 편집

### Step 1.1 — 더블클릭 이벤트 추가
- [renderer.js:3951](src/renderer/renderer.js#L3951) 부근, 기존 이벤트 리스너 블록 뒤에 `.history-title`에 `dblclick` 핸들러 추가

### Step 1.2 — `startInlineEdit(item, session)` 함수 구현
- [renderer.js:4807](src/renderer/renderer.js#L4807) 부근 (기존 Rename Modal Logic 영역)에 추가
- `.history-title`의 innerHTML을 `<input class="history-inline-edit-input">`으로 교체
- 자동 포커스 및 텍스트 전체 선택
- `keydown` 리스너: Enter → 저장, Escape → 취소
- `blur` 리스너: 저장 (포커스 이탈 시)
- 이미 편집 중이면 중복 실행 방지

### Step 1.3 — `commitInlineEdit` / `cancelInlineEdit` 함수
- `commitInlineEdit`: 새 타이틀이 비어있거나 동일하면 취소, 아니면 `historyManager.saveSession()` 호출 후 `loadHistoryList({ preserveScroll: true })`
- `cancelInlineEdit`: `loadHistoryList({ preserveScroll: true })`로 원래 상태 복원

### Step 1.4 — CSS 스타일
- [styles.css](src/renderer/styles.css)에 `.history-inline-edit-input` 스타일 추가

---

## Feature 2: Chat Thread 내용 저장

### Step 2.1 — IPC 핸들러 추가 (Main Process)
- [main.js:3181](src/main/main.js#L3181) 부근에 `ipcMain.handle('get-chat-thread-json')` 추가
- 기존 `buildChatThreadJsonForCPB()` 함수를 재사용하여 대화 내용 추출
- `JSON.parse()`하여 배열 객체로 반환

### Step 2.2 — Preload API 노출
- [preload.js:37](src/main/preload.js#L37) 부근에 추가:
  ```js
  getChatThreadJson: () => ipcRenderer.invoke('get-chat-thread-json'),
  ```

### Step 2.3 — `saveCurrentSession()` 수정
- [renderer.js:4262](src/renderer/renderer.js#L4262)의 `saveCurrentSession`에 `extractChatThread` 옵션 파라미터 추가
- `extractChatThread: true`일 때만 `window.electronAPI.getChatThreadJson()` 호출
- [renderer.js:4452](src/renderer/renderer.js#L4452) 부근, `sessionData` 객체 구성 후 `historyManager.saveSession()` 호출 전에 chatThread 삽입
- 추출 실패 시 기존 `existingSession.chatThread` 보존

### Step 2.4 — 호출 지점 (extractChatThread: true)
- `loadSession()` 내 세션 전환 시 ([renderer.js:4494](src/renderer/renderer.js#L4494)): `saveCurrentSession({ extractChatThread: true })`
- `app-will-close` 핸들러: `saveCurrentSession({ extractChatThread: true })`
- 그 외 일반 저장 호출은 `extractChatThread: false` (기본값) — 성능 보호

### 참고: IndexedDB 스키마
- 별도 마이그레이션 불필요 — `chatThread` 필드는 기존 `store.put()`에 자동 포함됨

---

## Feature 3: 눈 모양 아이콘 미리보기 버튼

### Step 3.1 — 눈 아이콘 버튼 HTML 추가
- [renderer.js:3921](src/renderer/renderer.js#L3921) 부근, rename 버튼과 delete 버튼 사이에 눈 아이콘 SVG 버튼 추가
- 클래스: `history-icon-btn history-preview-btn`

### Step 3.2 — 클릭 핸들러 추가
- [renderer.js:3949](src/renderer/renderer.js#L3949) 부근에 `showChatThreadPreview(session)` 호출

### Step 3.3 — 미리보기 모달 HTML
- [index.html:890](src/renderer/index.html#L890) 뒤에 `#chat-thread-preview-modal` 모달 추가
- 제목 표시, 스크롤 가능한 본문 영역, 닫기 버튼

### Step 3.4 — `showChatThreadPreview(session)` 함수 구현
- `session.chatThread` 배열을 서비스별로 렌더링
- 각 항목: 서비스명, 타임스탬프, 대화 내용 (`<pre>` 태그로 안전하게 표시)
- chatThread가 없으면 "저장된 대화 내용이 없습니다" 메시지 표시

### Step 3.5 — 모달 닫기 이벤트 연결
- DOMContentLoaded 블록 ([renderer.js:4863](src/renderer/renderer.js#L4863) 부근)에서 닫기 버튼 이벤트 바인딩

### Step 3.6 — CSS 스타일
- `.chat-thread-preview-content`, `.chat-thread-entry`, `.chat-thread-entry-header`, `.chat-thread-entry-content` 등 스타일
- `.history-preview-btn` 버튼 호버 스타일

---

## 구현 순서

1. **Feature 2** (백엔드 우선): IPC 핸들러 → preload → saveCurrentSession 수정
2. **Feature 1** (독립적): 인라인 편집 (렌더러 전용)
3. **Feature 3** (Feature 2 의존): 미리보기 버튼 및 모달

## 검증 방법

1. 앱 실행 후 Chat History 열기
2. **Feature 1 검증**: 타이틀 더블클릭 → 인라인 입력 필드 표시 → 새 타이틀 입력 후 Enter → 타이틀 변경 확인, Escape → 취소 확인
3. **Feature 2 검증**: AI 서비스에서 대화 진행 → 다른 세션으로 전환 → DevTools에서 IndexedDB 확인하여 `chatThread` 필드에 대화 내용 저장 확인
4. **Feature 3 검증**: Chat History에서 눈 아이콘 클릭 → 미리보기 모달에 저장된 대화 내용 표시 확인
