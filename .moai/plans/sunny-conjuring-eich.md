# Computer Use & Browser Use 기능 추가 - 기술 검토 및 구현 계획

## Context

현재 Sync Multi Chat 앱의 "+New Task" 워크스페이스에 **Computer Use**(데스크톱 자율 제어)와 **Browser Use**(브라우저 자율 제어) 기능을 추가하고자 함. Task 시스템은 이미 Anthropic API 스트리밍 + 로컬 tool_use(bash, read, write, edit, glob, grep, code_execute) 구조를 갖추고 있으나, **Anthropic 스트리밍 함수에 tool_use 루프가 미구현**된 상태로 이것이 선결 과제임.

---

## 1. 현재 아키텍처 요약

| 항목 | 상태 |
|------|------|
| Electron 39 + Vanilla JS | 안정 |
| Anthropic API 스트리밍 (`streamAnthropicInMain`) | text 스트리밍만 구현, **tool_use 루프 없음** |
| WHAM(OpenAI) API 스트리밍 | tool_use 루프 완전 구현 (참조 구현) |
| Permission Engine | `evaluatePermission()` - allow/ask/deny 3단계 |
| puppeteer-core + stealth | 설치 완료, 외부 로그인 자동화에 사용 중 |
| robotjs 0.6.0 | 설치 완료, ESC 키 입력에만 사용 중 |
| macOS 권한 | Screen Recording, Accessibility 미포함 |

### 핵심 발견: Anthropic tool_use 미구현

`src/main/main.js:6525` - `streamAnthropicInMain()` 함수는 `content_block_delta`의 text만 처리하며, `tool_use` 블록을 완전히 무시함. WHAM 함수(`streamWhamInMain`, line 6386)에는 최대 10라운드 tool 루프가 구현되어 있어 참조 패턴으로 사용 가능.

---

## 2. 기술적 가능 여부

### A. Computer Use (Claude computer-use-2025-01-24)

| 항목 | 판정 | 설명 |
|------|------|------|
| 스크린샷 캡처 | **가능** | macOS: `screencapture -x -t jpg`, Windows: PowerShell |
| 마우스/키보드 제어 | **가능 (리스크 있음)** | robotjs 0.6.0 사용 가능하나 Apple Silicon 불안정. @nut-tree/nut-js 대안 |
| API 연동 | **가능** | `anthropic-beta: computer-use-2025-01-24` 헤더 + `computer_20250124` tool type |
| 좌표 매핑 | **가능** | Retina 디스플레이 → API 해상도 스케일링 필요 |

### B. Browser Use (Puppeteer 기반)

| 항목 | 판정 | 설명 |
|------|------|------|
| 브라우저 런칭 | **가능** | puppeteer-core + stealth 이미 설치됨 |
| 페이지 제어 | **가능** | navigate, click, type, screenshot, extract 모두 가능 |
| Bot 탐지 우회 | **가능** | puppeteer-extra stealth plugin 이미 사용 중 |
| 세션 관리 | **가능** | `runningTasks` Map에 브라우저 인스턴스 저장 |

### C. 선결 과제: Anthropic Tool Loop

| 항목 | 판정 | 설명 |
|------|------|------|
| tool_use 파싱 | **미구현** | `content_block_start` type=tool_use 미처리 |
| 멀티턴 루프 | **미구현** | tool_result → 재요청 루프 없음 |
| Permission 연동 | **미구현** | WHAM에만 구현됨 |

---

## 3. 제약사항 및 리스크

### 3.1 OS 권한 (CRITICAL)

**macOS:**
- Screen Recording 권한 필요 (시스템 환경설정 > 개인정보 > 화면 녹화)
- Accessibility 권한 필요 (마우스/키보드 제어용)
- 앱 첫 사용 시 시스템 프롬프트 발생 → 사용자 가이드 필요
- 현재 `build/entitlements.mac.plist`에 해당 entitlement 없음 (OS 레벨 권한이므로 entitlement 불필요, 런타임 감지 필요)

**Windows:**
- 특별한 권한 불필요 (Win32 GDI + SendInput API는 사용자 레벨에서 동작)
- UAC 상승 윈도우와의 상호작용 불가

### 3.2 보안 리스크 (HIGH)

- AI가 잘못된 버튼 클릭, 민감 데이터 입력, 악성 사이트 접근 가능
- 파일 삭제, 소프트웨어 설치 등 비가역적 작업 수행 가능
- **필수 완화 조치:** 세션별 명시적 동의, 킬 스위치, 타임아웃, 작업 로그

### 3.3 API 비용

- 스크린샷 1장 (1280x800 JPEG): ~1,500-2,500 입력 토큰
- 일반적인 세션 (20-50 스크린샷): 30,000-125,000 토큰
- 비용 추정: 세션당 $0.10-0.40 (이미지만, Sonnet 4 기준)
- **완화:** 해상도 축소, JPEG 압축, 필요 시에만 캡처

### 3.4 성능

- 스크린샷 캡처: ~50-200ms
- API 왕복: 1-5초/tool cycle
- **병목:** API 레이턴시 (로컬 작업은 빠름)
- 액션-스크린샷-API 사이클: 2-7초/회

### 3.5 robotjs 안정성

- 0.6.0 버전은 사실상 유지보수 중단
- Apple Silicon(ARM64) 세그폴트 보고 존재
- Unicode 입력 제한
- **대안:** @nut-tree/nut-js (활발히 유지보수), 또는 macOS AppleScript / Windows PowerShell 폴백

---

## 4. UX 설계 제안

### 4.1 토글 위치

Task Workspace 하단 툴바 (`task-chat-input-toolbar`, index.html:388)에 두 개의 토글 추가:

```
[+ 첨부] [폴더선택] [실행모드 ▾] [🖥 Computer Use] [🌐 Browser Use]
```

- 기본값: 둘 다 OFF
- ON 전환 시 경고 확인 다이얼로그 표시

### 4.2 권한 모델 (3단계)

1. **세션 수준:** Computer/Browser Use 토글 ON 시 명시적 동의 필요
2. **액션 수준 (ask 모드):** 각 액션(클릭, 입력, 네비게이션)에 대해 스크린샷 + 의도 표시 후 승인/거부
3. **자동 모드:** "위험을 이해합니다" 체크박스 확인 후에만 활성화

### 4.3 시각적 피드백

- **스크린샷 미리보기:** 채팅 메시지 영역에 AI가 보는 화면 인라인 표시
- **제어 표시:** Computer Use 활성 시 화면 테두리 반투명 색상 오버레이
- **액션 로그:** 각 동작(마우스 이동, 클릭, 입력)이 tool 실행 카드로 표시
- **상태 배지:** 헤더에 "AI Controlling" 상태 표시

### 4.4 안전장치

- **킬 스위치:** `Cmd+Shift+Escape` (전역 단축키) → 즉시 중단
- **타임아웃:** 기본 3분, 최대 10분 (설정 가능)
- **앱 제외 목록:** 특정 앱/윈도우 상호작용 차단 (사용자 설정)
- **URL 차단 목록 (Browser Use):** 뱅킹, 이메일 등 기본 차단
- **속도 제한:** 초당 최대 1 액션

### 4.5 Browser Use vs Computer Use 가이드

| 기준 | Browser Use 권장 | Computer Use 권장 |
|------|-----------------|-----------------|
| 대상 | 웹 앱, 웹사이트 | 네이티브 데스크톱 앱 |
| 안전성 | 높음 (샌드박스) | 낮음 (전체 데스크톱) |
| 속도 | 빠름 (DOM 직접 조작) | 느림 (스크린샷 기반) |
| 비용 | 낮음 (텍스트 추출 가능) | 높음 (스크린샷 토큰) |
| 신뢰도 | 높음 (CSS 셀렉터) | 중간 (픽셀 좌표) |

**UI에서 Browser Use를 기본 권장 옵션으로, Computer Use를 "고급" 옵션으로 배치**

---

## 5. 구현 아키텍처

### 5.1 핵심 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/main/main.js` | Anthropic tool loop 구현, computer/browser tool 실행기 추가 |
| `src/renderer/index.html` | Computer/Browser Use 토글 UI 추가 |
| `src/renderer/renderer.js` | 스크린샷 렌더링, 토글 이벤트, 상태 관리 |
| `src/main/preload.js` | 새 IPC 채널 노출 |
| `build/entitlements.mac.plist` | 변경 불필요 (OS 런타임 권한) |

### 5.2 Computer Use Tool 정의

```javascript
// Anthropic 전용 - computer_20250124 tool type
const ANTHROPIC_COMPUTER_TOOL = {
    type: 'computer_20250124',
    name: 'computer',
    display_width_px: 1280,  // 동적 감지
    display_height_px: 800,
    display_number: 1,
};
```

### 5.3 Browser Use Tool 정의

```javascript
// 표준 function tool - 모든 프로바이더 호환
{
    type: 'function',
    name: 'browser_use',
    description: 'Control a web browser...',
    parameters: {
        action: { enum: ['navigate', 'click', 'type', 'screenshot', 'extract_text', 'scroll', 'close'] },
        url: { type: 'string' },
        selector: { type: 'string' },
        text: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' }
    }
}
```

### 5.4 스크린샷 파이프라인

```
screencapture -x -t jpg /tmp/smc-screenshot-{ts}.jpg  (macOS)
→ Electron nativeImage.createFromPath() 
→ resize(1280, 800)
→ toJPEG(75)
→ base64 인코딩
→ tool_result { type: "image", source: { type: "base64", media_type: "image/jpeg", data: ... } }
```

---

## 6. 구현 단계

### Phase 0: 선결 과제 - Anthropic Tool Loop (3-5일)

**`streamAnthropicInMain()` 완전 재작성** (WHAM 패턴 참조)

- `content_block_start` type=tool_use 파싱
- `input_json_delta` 누적
- `message_stop` 시 tool 실행
- `tool_result` 메시지로 재요청 루프 (최대 10라운드)
- Permission 체크 연동
- `task-stream-tool` IPC 이벤트 발송

### Phase 1: Browser Use MVP (5-7일)

1. `browser_use` tool 정의 추가 (`BUILTIN_TOOL_DEFS`)
2. `executeBrowserTool()` 구현 (puppeteer 세션 관리)
3. 브라우저 세션 생명주기 (launch → track → cleanup on task-stop)
4. Task Workspace UI에 Browser Use 토글 추가
5. Permission 시스템에 `browser_use` 추가 (기본: ask)
6. 스크린샷 base64 → 채팅 메시지 인라인 렌더링

### Phase 2: Computer Use (2-3주)

1. 스크린샷 파이프라인 (캡처 → 리사이즈 → base64)
2. macOS 권한 감지 + 사용자 가이드 다이얼로그
3. `computer_20250124` tool type + beta 헤더 추가
4. 액션 실행기 (mouse_move, click, type, key, scroll, screenshot)
5. 좌표 스케일링 (API 해상도 ↔ 실제 디스플레이)
6. 안전 레이어: 킬 스위치, 타임아웃, 제어 오버레이
7. UI: Computer Use 토글, 상태 배지, 액션 로그

### Phase 3: 폴리시 (1-2주)

- 앱/URL 제외 목록
- 비용 추정 표시
- 멀티 모니터 지원
- robotjs → @nut-tree/nut-js 교체 (ARM64 안정성)
- 작업 리플레이/감사 로그

---

## 7. 검증 방법

### Phase 0 검증
- Task Workspace에서 Anthropic 모델 선택 후 "src 폴더의 파일 목록을 보여줘" 입력
- AI가 `glob` tool을 사용하여 결과 반환하는지 확인

### Phase 1 검증
- Browser Use 토글 ON → "google.com에서 'Electron' 검색해줘" 입력
- puppeteer 브라우저 열림 → 네비게이션 → 검색 → 스크린샷 반환 확인

### Phase 2 검증
- Computer Use 토글 ON → "메모장(TextEdit)을 열고 'Hello World' 입력해줘"
- 스크린샷 캡처 → AI 분석 → 마우스/키보드 제어 → 결과 스크린샷 확인

---

## 8. 결론

| 항목 | 결론 |
|------|------|
| 기술적 가능성 | **가능** - 기존 인프라(puppeteer, robotjs, Anthropic API) 활용 가능 |
| 최대 장벽 | Anthropic tool_use 루프 미구현 (선결 과제) |
| 권장 우선순위 | Phase 0 (tool loop) → Phase 1 (Browser Use) → Phase 2 (Computer Use) |
| Browser Use | **즉시 구현 가능**, 안전하고 비용 효율적 |
| Computer Use | **구현 가능하나 주의 필요**, macOS 권한 + 보안 리스크 관리 필수 |
| 예상 총 기간 | 4-7주 (Phase 0-2) |
