# 백그라운드 워크플로우 자동화 — 심화 아이데이션 (v2)

> 작성일: 2026-03-10  
> 선행 문서: ideation_20260310_120000_background_workflow_automation.md (v1)  
> 목적: v1의 비판적 검토 + 실제 코드베이스 대조 분석 + 사용자 관점 UX 심화

---

## 1. 이전 아이데이션(v1)에 대한 비판적 검토

v1은 다중 AI 기술 검토 의견을 잘 통합했으나, 실제 코드베이스를 대조하면 **낙관적·추상적인 부분**이 확인된다. 아래는 코드 기반으로 식별한 gap과 보강 포인트다.

### 1.1 "기존 코드 50줄 수정"은 과소 추정

v1은 main.js 약 50줄 수정을 언급하나, 실제로는 다음이 필요하다.

- **`createServiceView()` 복제/확장**: 현재 이 함수는 `mainWindow.addBrowserView(view)`를 하드코딩하고 있다(line 425). 백그라운드 전용 뷰는 `bgWindow`에 부착해야 하므로 `targetWindow` 파라미터를 추가하거나 별도 함수를 만들어야 한다. 또한 `onHeadersReceived` 핸들러(line 459~477), User-Agent 설정(line 428~431), 외부 링크 핸들링 등도 그대로 적용해야 해서 상당한 코드가 동반된다.
- **`extractLastResponseFromService()` 리팩터링**: 현재 이 함수는 내부에서 `views[service].view.webContents`를 직접 참조한다(line 2209~2440). `__wcOverride` 옵션이 존재하지만 Single AI 전용이다. 워크플로우 엔진에서 사용하려면 임의의 webContents를 깔끔하게 전달하는 인터페이스 정리가 필요하다.
- **`send-prompt` 핸들러 분기**: 현재 `send-prompt`(line 1073~1466)는 renderer 이벤트 기반이며 `activeServices` 맵을 받는다. 워크플로우 엔진은 main process 내부에서 특정 webContents에 직접 `inject-prompt`를 보내야 하므로, 기존 핸들러를 재사용하기보다 **내부 함수로 추출**(예: `injectPromptToWebContents(wc, text, selectors, options)`)해야 한다.

**보정 추정**: main.js 수정 150~200줄 + 리팩터링, 신규 모듈 3~4개.

### 1.2 "응답 완료 감지 3단계" — 서비스별 현실 미반영

v1의 스트리밍 인디케이터 감지 전략은 이론적으로 좋으나, 실제 `selectors.json`을 보면:

- **Claude만** `[data-is-streaming]` 속성이 확인됨.
- **ChatGPT, Gemini, Grok, Perplexity, Genspark**은 스트리밍 전용 selector가 `selectors.json`에 없다.
- 따라서 Phase 1에서는 **모든 서비스 공통으로 content stability polling이 주력**이 되어야 하며, 스트리밍 인디케이터는 점진적으로 서비스별 selector를 추가하는 방식이 현실적이다.

### 1.3 "세션 공유" 낙관적 판단 — 포그라운드 동시 사용 충돌 미검증

v1은 동일 파티션 공유가 "자연스럽다"고 했으나, 실제 우려 포인트:

- **ChatGPT**: 같은 계정·같은 세션에서 두 개의 대화가 동시에 진행되면, 하나의 응답이 다른 대화에 나타나거나 "Something went wrong" 에러가 발생할 수 있다. 현재 Single AI 모드에서도 각 인스턴스가 **별도 URL(대화 스레드)**을 열어 회피하고 있다.
- **결론**: 워크플로우 백그라운드 뷰는 항상 **새 대화 페이지(clean URL)**로 시작해야 한다. 기존 대화에 끼어들면 사용자 포그라운드 대화가 오염된다.

### 1.4 Cross-Check 패턴과의 관계 미정리

현재 cross-check(line 2837~2941)는 이미 **"다른 서비스 응답 추출 → 프롬프트 구성 → 주입"** 패턴을 구현하고 있다. 이것은 사실상 **단일 스텝 워크플로우**다. v1에서 이 관계를 명시하지 않았는데, 이를 인지하면:

- Cross-check는 워크플로우 엔진의 **프리셋 워크플로우 #1**로 편입 가능하다.
- 기존 cross-check 코드를 워크플로우 엔진으로 마이그레이션하면, 추후 "cross-check + 요약" 같은 체인 워크플로우가 자연스럽게 가능해진다.

### 1.5 UX 부분 부재

v1은 기술 구현에 집중하며 **사용자가 실제로 워크플로우를 어떻게 만들고, 실행하고, 모니터링하고, 결과를 활용하는지**에 대한 UX 아이데이션이 전혀 없다. 이것이 가장 큰 gap이다.

---

## 2. 코드베이스 현황 대조표

| 영역 | 현재 구현 | 워크플로우 구현 시 필요 조치 |
|------|-----------|---------------------------|
| **BrowserView 생성** | `createServiceView()` — mainWindow에 부착, `backgroundThrottling` 미설정 | bgWindow용 `createBackgroundView()` 신규 생성, `backgroundThrottling: false` 추가 |
| **프롬프트 주입** | `inject-prompt` IPC → `service-preload.js` `injectPrompt()` | 그대로 재사용 가능 (wc.send) |
| **응답 추출** | `extractLastResponseFromService()` — views 맵/wc 직접 참조 | webContents 파라미터화 리팩터링 필요 |
| **Cross-Check** | extract → prompt 구성 → inject (Multi/Single 모두) | 워크플로우 엔진 내부 함수로 추출/일반화 |
| **세션/파티션** | `persist:service-{name}` per service | 동일 파티션 공유 기본, 새 대화 URL로 시작 |
| **Anti-detection** | webdriver 제거, UA 스푸핑, plugins/languages 스푸핑 | 자동 상속 (동일 preload 사용) |
| **UI (레이아웃)** | `update-view-bounds` — views/singleModeViews만 대상 | bgWindow는 완전 독립, 영향 없음 |
| **UI (모달/팝업)** | `set-service-visibility` — views 맵 순회 | bgWindow 뷰는 별도 맵이므로 영향 없음 |
| **CPB (커스텀 프롬프트)** | 시스템 변수(`chat_thread`, `last_response`), 프롬프트 저장/검색 | 워크플로우 빌더와 CPB 통합 가능 |
| **스트리밍 감지 selector** | Claude만 `[data-is-streaming]`, 나머지 없음 | 서비스별 streaming selector 추가 필요 (점진적) |
| **워크플로우 UI** | 없음 | Workflow Builder + Monitor 신규 |

---

## 3. 기능 설계 심화

### 3.1 워크플로우 정의 스키마 (v2)

v1의 JSON 스키마를 실 사용 관점에서 보강한다.

```json
{
  "id": "wf-001",
  "name": "딥 리서치 + 팩트체크 + 요약",
  "description": "Perplexity로 조사 → ChatGPT·Claude로 팩트체크 → Gemini로 최종 요약",
  "trigger": "manual",
  "steps": [
    {
      "id": "research",
      "type": "single",
      "service": "perplexity",
      "prompt": "다음 주제에 대해 최신 정보를 조사해줘:\n{{user_query}}",
      "outputVar": "research_result",
      "timeout": 120,
      "newConversation": true
    },
    {
      "id": "factcheck",
      "type": "parallel",
      "services": ["chatgpt", "claude"],
      "prompt": "다음 조사 결과의 사실 여부를 검증하고, 잘못된 정보가 있으면 지적해줘:\n\n{{research_result}}",
      "outputVar": "factcheck_results",
      "timeout": 120,
      "newConversation": true
    },
    {
      "id": "summary",
      "type": "single",
      "service": "gemini",
      "prompt": "다음 조사 결과와 팩트체크 결과를 종합해서 핵심을 요약해줘:\n\n[조사 결과]\n{{research_result}}\n\n[팩트체크]\n{{factcheck_results}}",
      "outputVar": "final_summary",
      "timeout": 120,
      "newConversation": true
    }
  ],
  "output": {
    "display": "panel",
    "copyToClipboard": false,
    "variables": ["research_result", "factcheck_results", "final_summary"]
  }
}
```

**v1 대비 추가/변경 사항**:
- `newConversation: true` — 기존 대화 오염 방지를 위해 항상 새 대화 URL로 시작 여부 명시.
- `trigger` — 수동 실행(`manual`), 예약(`scheduled`), 프롬프트 연동(`on-prompt`) 등 확장 여지.
- `output.display` — 결과 표시 방식(패널, 토스트, 클립보드 등).
- 각 스텝에 `timeout` 개별 설정.

### 3.2 `extractLastResponseFromService()` 리팩터링 방안

현재:
```javascript
async function extractLastResponseFromService(service, opts) {
    // 내부에서 views[service], singleModeViews 직접 참조
    let wc = opts.__wcOverride || views[service]?.view?.webContents;
    // ...
}
```

제안:
```javascript
async function extractLastResponse(wc, service) {
    // webContents와 서비스명만 받아 순수하게 추출
    // views 맵 참조 없음
}

// 기존 호환 래퍼
async function extractLastResponseFromService(service, opts) {
    const wc = opts.__wcOverride || resolveWebContents(service);
    return extractLastResponse(wc, service);
}
```

이렇게 하면 워크플로우 엔진에서 `extractLastResponse(bgViewWc, 'chatgpt')`로 깔끔하게 호출 가능하다.

### 3.3 상태 머신 설계

```
[idle] → workflow:execute → [initializing]
    → 뷰 생성/획득 → [step-running]
        → inject-prompt → [waiting-response]
            ├── 응답 완료 → extract → [step-complete]
            │   ├── 다음 스텝 있음 → [step-running]
            │   └── 마지막 스텝 → [completed] → 결과 전달 → [idle]
            ├── CAPTCHA/로그인 → [paused-human-action]
            │   └── 사용자 해결 → [waiting-response]
            ├── 타임아웃 → [step-failed]
            │   └── 재시도 가능 → [step-running]
            │   └── 재시도 불가 → [failed] → 부분 결과 전달 → [idle]
            └── 사용자 취소 → [cancelled] → 부분 결과 전달 → [idle]
```

---

## 4. 사용자 관점 UX 설계

기술 구현이 가능하더라도, **사용자가 쉽게 쓸 수 없으면 의미 없다**. 이 섹션은 v1에서 완전히 빠진 부분이다.

### 4.1 워크플로우 빌더 (Workflow Builder)

#### 4.1.1 설계 원칙

- **CPB(Custom Prompt Builder) 패턴과 통일**: 이미 사용자가 CPB의 프롬프트 저장/검색/변수 시스템에 익숙하다. 워크플로우 빌더도 동일한 IA와 디자인 언어를 사용한다.
- **No-Code 우선**: JSON을 직접 편집하지 않아도 워크플로우를 구성할 수 있어야 한다.
- **프리셋 제공**: 처음부터 빈 캔버스가 아니라, "딥 리서치", "팩트체크", "요약 체인" 등 프리셋 워크플로우를 제공해 진입 장벽을 낮춘다.

#### 4.1.2 UI 구성안

```
┌─────────────────────────────────────────────────────────┐
│ Workflow Builder                                    [X] │
├─────────────┬───────────────────────────────────────────┤
│             │  워크플로우명: [딥 리서치 + 팩트체크     ] │
│  워크플로우  │  설명: [Perplexity 조사 → ...           ] │
│  목록       │                                           │
│             │  ┌─ Step 1 ──────────────────────────────┐│
│  📋 딥 리서치│  │ [🔍 Perplexity ▼]  타입: [순차 ▼]    ││
│  📋 팩트체크 │  │                                       ││
│  📋 요약만  │  │ 프롬프트:                              ││
│             │  │ ┌────────────────────────────────────┐ ││
│  [+ 새로만들기]│ │ │다음 주제에 대해 최신 정보를 조사해줘:│ ││
│             │  │ │{{user_query}}                      │ ││
│             │  │ └────────────────────────────────────┘ ││
│             │  │ 결과 변수: [research_result         ]  ││
│             │  │ 타임아웃: [120]초                      ││
│             │  └────────────────────────────────────────┘│
│             │         ↓                                 │
│             │  ┌─ Step 2 ──────────────────────────────┐│
│             │  │ [💬 ChatGPT ▼] [🤖 Claude ▼] [+]     ││
│             │  │ 타입: [병렬 ▼]                         ││
│             │  │                                       ││
│             │  │ 프롬프트:                              ││
│             │  │ ┌────────────────────────────────────┐ ││
│             │  │ │팩트 검증해줘: {{research_result}}   │ ││
│             │  │ └────────────────────────────────────┘ ││
│             │  └────────────────────────────────────────┘│
│             │         ↓                                 │
│             │  [+ 스텝 추가]                            │
│             │                                           │
│             │  [💾 저장]  [▶ 테스트 실행]  [삭제]       │
└─────────────┴───────────────────────────────────────────┘
```

#### 4.1.3 CPB 연동 포인트

- 워크플로우 스텝의 프롬프트 편집기에서 **CPB 저장 프롬프트를 불러오기** 가능.
- CPB의 `{{변수}}` 시스템을 워크플로우 변수와 통합.
- CPB 시스템 변수(`chat_thread`, `last_response`)는 워크플로우에서도 사용 가능하되, 의미가 달라짐(포그라운드 대화가 아닌 워크플로우 컨텍스트 기준).

### 4.2 워크플로우 실행 UX

#### 4.2.1 실행 트리거

| 트리거 | 설명 |
|--------|------|
| **메인 입력창 연동** | 메인 입력창에 프롬프트 입력 후 "Send" 대신 "Run Workflow" 선택 → `{{user_query}}`에 입력 내용 바인딩 |
| **전용 실행 버튼** | 하단 컨트롤바에 워크플로우 드롭다운 추가 → 저장된 워크플로우 선택 후 실행 |
| **Slash 커맨드** | 메인 입력창에서 `/wf [워크플로우명]` 입력 (향후 Phase 2~3) |
| **Cross-Check 확장** | 기존 Cross-Check 버튼에 "Cross-Check + 요약" 등 체인 옵션 추가 |

#### 4.2.2 실행 전 확인

- 실행 전 **변수 입력 모달**: `{{user_query}}` 등 사용자 입력이 필요한 변수만 한 번에 표시.
- **서비스 로그인 상태 프리체크**: 워크플로우에 사용되는 서비스가 로그인되어 있는지 확인. 미로그인 시 경고 + "해당 서비스 열기" 바로가기 제공.

### 4.3 워크플로우 모니터링 (Workflow Monitor)

v1에서 "실행 모니터 패널"을 언급만 했는데, 구체적 설계가 필요하다.

#### 4.3.1 인라인 상태 표시 (최소 침범)

사용자는 워크플로우 실행 중에도 **기존 웹뷰로 정상 채팅**을 해야 하므로, 모니터는 최소 공간을 차지해야 한다.

```
┌─────────────────────────────────────────────────────┐
│  기존 레이아웃 (1x4, 2x2 등)                         │
│                                                      │
│  [ChatGPT] [Claude] [Gemini] [Perplexity]           │
│                                                      │
│                                                      │
│                                                      │
├──────────────────────────────────────────────────────┤
│ ⚙ 딥 리서치 실행 중  [Step 2/3: 팩트체크]  ██░░ 67% │
│ Perplexity ✅ → ChatGPT ⏳ Claude ⏳ → Gemini ⏸    │
│                                   [상세보기] [취소]   │
└──────────────────────────────────────────────────────┘
```

- **위치**: 하단 컨트롤 영역 또는 그 위에 **접이식 스트립** (높이 ~40px).
- **최소 정보**: 워크플로우명, 현재 스텝, 진행률, 서비스별 상태 아이콘.
- **상호작용**: "상세보기" 클릭 시 사이드 패널 또는 모달로 전체 로그 표시. "취소" 버튼.

#### 4.3.2 상세 모니터 패널 (옵트인)

"상세보기" 클릭 시:

```
┌── Workflow Monitor ──────────────────────────────────┐
│                                                      │
│  📋 딥 리서치 + 팩트체크 + 요약                       │
│  상태: 실행 중 (2/3 스텝 완료)                        │
│  시작: 14:32:05  |  경과: 2분 15초                    │
│                                                      │
│  ✅ Step 1: 리서치 (Perplexity)                      │
│     소요: 45초  |  응답 길이: 2,340자                  │
│     [응답 보기]                                       │
│                                                      │
│  ⏳ Step 2: 팩트체크 (ChatGPT, Claude)               │
│     ChatGPT: 응답 대기 중... (32초)                   │
│     Claude: 응답 수신 중... ████░ ~80%                │
│                                                      │
│  ⏸ Step 3: 요약 (Gemini)                            │
│     대기 중 (Step 2 완료 후 시작)                      │
│                                                      │
│  [전체 취소]  [현재 스텝 건너뛰기]                      │
└──────────────────────────────────────────────────────┘
```

#### 4.3.3 CAPTCHA/에러 알림

- **토스트 알림**: "ChatGPT에서 인증이 필요합니다. [해결하기]"
- "[해결하기]" 클릭 → 해당 서비스의 포그라운드 웹뷰로 전환 (또는 bgWindow를 일시적으로 `show: true`로 표시).
- 사용자 해결 후 → "계속 실행" 또는 자동 감지 후 재개.

### 4.4 워크플로우 결과 표시

#### 4.4.1 결과 패널

```
┌── Workflow Result ───────────────────────────────────┐
│                                                      │
│  📋 딥 리서치 + 팩트체크 + 요약  ✅ 완료              │
│  총 소요: 3분 22초                                    │
│                                                      │
│  [요약 결과]  [리서치 원문]  [팩트체크 상세]            │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  (선택된 탭의 마크다운 렌더링 결과)                     │
│                                                      │
│  ...                                                 │
│                                                      │
│  [📋 복사]  [💬 메인 입력창에 붙여넣기]  [💾 저장]     │
└──────────────────────────────────────────────────────┘
```

#### 4.4.2 결과 활용 동선

- **복사**: 최종 요약 또는 특정 스텝 결과를 클립보드에 복사.
- **메인 입력창 연동**: "메인 입력창에 붙여넣기" → 사용자가 결과를 바탕으로 추가 질문 가능.
- **히스토리 저장**: 워크플로우 실행 이력을 `electron-store` 또는 IndexedDB에 보관.
- **재실행**: 동일 워크플로우를 다른 쿼리로 다시 실행.

---

## 5. 기존 코드와의 통합 전략

### 5.1 main.js 영향 상세

```
변경 파일: src/main/main.js
─────────────────────────────────
[1] 신규 import (상단)
    - const WorkflowEngine = require('./workflow-engine');
    - const WorkflowStore = require('./workflow-store');

[2] bgWindow 생성 (createWindow 함수 내, ready-to-show 이후)
    - let bgWindow = new BrowserWindow({ show: false, ... });
    - WorkflowEngine.init(bgWindow, selectorsConfig, ...);

[3] extractLastResponse 리팩터링
    - 기존 함수에서 "순수 추출 로직"을 extractLastResponse(wc, service)로 분리
    - 기존 extractLastResponseFromService()는 래퍼로 유지

[4] IPC 핸들러 등록
    - 'workflow:execute', 'workflow:cancel', 'workflow:get-status'
    - 'workflow:get-presets', 'workflow:save', 'workflow:delete'

[5] app.on('before-quit') 정리
    - bgWindow 및 워크플로우 뷰 정리
```

### 5.2 renderer 영향

```
변경 파일: src/renderer/renderer.js, index.html, styles.css
───────────────────────────────────────────────────
[1] 하단 컨트롤바에 워크플로우 드롭다운/버튼 추가
[2] 워크플로우 모니터 스트립 HTML + CSS
[3] 워크플로우 결과 패널 모달 HTML + CSS
[4] IPC 리스너: 'workflow:progress', 'workflow:completed', 'workflow:error', 'workflow:paused'

신규 파일:
- src/renderer/workflow-builder.js  (빌더 모달 로직)
- src/renderer/workflow-monitor.js  (모니터 스트립 + 상세 패널)
- src/renderer/workflow-result.js   (결과 표시 + 마크다운 렌더링)
```

### 5.3 Cross-Check 마이그레이션 경로

**Phase 1**: 기존 cross-check 코드 유지, 워크플로우 엔진은 별도로 동작.  
**Phase 2**: cross-check를 워크플로우 프리셋 #1로 편입. 기존 `ipcMain.on('cross-check', ...)` 핸들러는 내부적으로 `WorkflowEngine.executePreset('cross-check', ...)` 를 호출하는 형태로 전환. 사용자 UI는 변경 없음.  
**Phase 3**: cross-check + 추가 스텝 체인 기능 지원(예: "비교 분석 후 요약까지 자동 실행").

---

## 6. 구현 로드맵 (v2)

### Phase 0 — 사전 리팩터링 (1주)

이 단계는 v1에 없었으나, 코드베이스 분석 결과 **워크플로우 엔진 구현 전에 반드시 필요**하다.

- [ ] `extractLastResponseFromService()` → `extractLastResponse(wc, service)` 분리
- [ ] `createServiceView()`에서 `targetWindow` 파라미터 추출 또는 `createBackgroundView()` 함수 분리
- [ ] 내부 함수 `injectPromptToWebContents(wc, text, selectors, options)` 추출
- [ ] `selectors.json`에 서비스별 `streamingIndicatorSelector` 필드 추가 (있는 서비스만)

### Phase 1 — 엔진 MVP + 최소 UI (2주)

- [ ] `bgWindow` 생성 (`show: false`, `backgroundThrottling: false`)
- [ ] `BackgroundViewPool` — acquire/release, 동시 2뷰 제한
- [ ] `WorkflowEngine` — 순차 실행, content stability 기반 응답 완료 감지, 취소 지원
- [ ] 하드코딩 프리셋 워크플로우 3개 (딥 리서치, 팩트체크, 리서치+팩트체크+요약)
- [ ] 하단 컨트롤바 워크플로우 드롭다운 + 실행 버튼
- [ ] 인라인 모니터 스트립 (진행률 + 취소)
- [ ] 결과 토스트 + 간단한 결과 패널

### Phase 2 — 워크플로우 빌더 + 고도화 (2주)

- [ ] 워크플로우 빌더 모달 (CPB 패턴 기반)
- [ ] 사용자 정의 워크플로우 저장/불러오기/삭제
- [ ] 병렬 실행 (`type: 'parallel'`)
- [ ] 변수 입력 모달 (실행 전 `{{user_query}}` 등 입력)
- [ ] 상세 모니터 패널 (스텝별 상태, 경과 시간, 응답 미리보기)
- [ ] CAPTCHA/로그인 만료 Human Fallback UX (토스트 + 해결하기 동선)

### Phase 3 — 안정화 + 확장 (이후)

- [ ] Cross-check를 워크플로우 프리셋으로 편입
- [ ] 워크플로우 실행 이력 관리 (히스토리)
- [ ] 결과 마크다운 렌더링 + 탭별 보기
- [ ] 서비스별 스트리밍 감지 selector 고도화
- [ ] 서비스별 파티션 분리 옵션 (`persist:bg-service-*`)
- [ ] 조건부 분기/반복 (if/loop)
- [ ] Slash 커맨드 연동 (`/wf`)

---

## 7. 리스크 재평가

v1의 리스크 테이블에 **코드베이스 분석에서 드러난 실제 리스크**를 추가한다.

| 리스크 | 심각도 | 근거 | 완화 |
|--------|--------|------|------|
| **포그라운드 대화 오염** | 높음 | 같은 파티션 + 같은 대화 URL 시 응답이 섞임 | `newConversation: true` 기본값, 항상 서비스 기본 URL로 로드 |
| **views 맵 오염** | 높음 | `set-service-visibility`가 views 맵 전체를 순회 | bgWindow 뷰는 별도 `workflowViews` 맵으로 완전 분리 |
| **createServiceView 부작용** | 중간 | mainWindow에 addBrowserView 하드코딩 | 별도 createBackgroundView 함수 또는 targetWindow 파라미터화 |
| **extractLastResponse 커플링** | 중간 | views 맵 직접 참조 | wc 파라미터화 리팩터링 |
| **Content stability 오탐/미탐** | 중간 | 일부 서비스는 응답 후 추천 질문 등이 동적으로 추가됨 | `lastResponseSelector` 범위 내에서만 해시 비교, 전체 DOM 해시 아님 |
| **메모리 (Electron 39 기준)** | 중간 | BrowserView당 200~400MB 추정 | 동시 2뷰 제한 + 스텝 완료 즉시 `about:blank` 이동 후 release |
| 서비스 약관/봇 탐지 | 높음 | (v1과 동일) | 실행 횟수 제한, 딜레이, Human Fallback |
| DOM 셀렉터 변경 | 중간 | (v1과 동일) | selectors.json 업데이트 + 추출 실패 시 사용자 알림 |

---

## 8. 결론

### v1 대비 핵심 보강 사항

1. **코드베이스 실사 기반**: "50줄 수정" → "150~200줄 + 사전 리팩터링 필요" 현실 보정.
2. **Phase 0 추가**: 워크플로우 엔진 전에 추출/주입 함수의 결합도를 먼저 낮추는 리팩터링 단계 도입.
3. **포그라운드 대화 오염 문제**: 새 대화 URL 강제 정책 추가.
4. **스트리밍 감지 현실**: Claude 외 서비스는 selector 미보유. content stability polling 주력 + 점진적 selector 추가.
5. **Cross-Check 연계**: 기존 cross-check를 워크플로우 프리셋 #1로 편입하는 마이그레이션 경로 제시.
6. **UX 전면 추가**: Workflow Builder, Monitor, Result Panel, 실행 트리거, Human Fallback 동선 구체화.

### 다음 단계

- Phase 0 리팩터링부터 착수.
- Phase 1에서 하드코딩 프리셋 + 최소 UI로 **실 사용 가능한 MVP**를 빠르게 검증.
- Phase 2에서 빌더 UI를 붙여 사용자 자유도 확보.

본 문서는 아이데이션 심화 단계이며, 구현 착수 시에는 Phase 0의 리팩터링 범위를 상세 spec으로 먼저 정의해야 한다.
