# 백그라운드 워크플로우 자동화 — 제품화 관점 심화 아이데이션 (v3)

> 작성일: 2026-03-10  
> 선행 문서: `ideation_20260310_120000_background_workflow_automation.md` (v1), `ideation_20260310_150000_background_workflow_automation_v2.md` (v2)  
> 목적: v1의 기초 아이디어와 v2의 코드 대조 분석을 바탕으로, **실제 코드베이스에 맞는 구현 현실성**, **v2 자체에 대한 비판적 검토**, **실사용자 관점 UX/IA**, **단계별 제품화 전략**까지 포함한 v3 정리

---

## 1. 문서 목적

v1은 기술 검토 결과를 통합한 기초 아이디어였다. v2는 이를 코드베이스와 대조하고 UX 초안을 추가했다.  
하지만 실제 제품 기능으로 이어지려면 다음 질문에 더 명확히 답해야 한다.

- 현재 코드 구조에서 **무엇을 먼저 바꾸고 무엇은 건드리지 말아야 하는가**
- 사용자는 워크플로우를 **어디서 발견하고, 어떻게 실행하고, 어떤 피드백을 받는가**
- 기존 `Cross Check`, `Custom Prompt Builder`, `master-input slash command`와 **어떻게 충돌 없이 공존하는가**
- 지금 단계에서 **과한 설계**와 **바로 가치가 나는 설계**를 어떻게 구분할 것인가

본 문서는 위 질문에 답하기 위해, 기술 설계보다 한 단계 더 제품/UX 관점으로 구체화한다.

---

## 2. 현재 코드베이스 기준 핵심 사실

현재 앱 구조를 기준으로 워크플로우 기능은 "새 시스템"이라기보다, 이미 있는 기능을 **재조합**하는 형태가 더 현실적이다.

### 2.1 이미 있는 핵심 자산

- `src/main/main.js`
  - 서비스별 `BrowserView` 생성: `createServiceView()`
  - 서비스별 세션 파티션: `persist:service-{service}`
  - 프롬프트 전송: `send-prompt`
  - 전체 스레드 추출: `extractContentFromService()`
  - 마지막 응답 추출: `extractLastResponseFromService()`
  - 응답 비교형 자동화: `cross-check`
- `src/preload/service-preload.js`
  - `inject-prompt`
  - `humanLikeTyping()` / `instant` 입력
  - anti-detection 스푸핑
- `src/renderer/index.html`
  - 이미 과밀한 `#controls-container`
  - `Cross Check` 모달
  - `master-input`의 slash command / `{{` 변수 삽입
  - CPB 모달과 인라인 프리뷰
- `src/main/preload.js`
  - renderer에서 main으로 노출된 `electronAPI`

즉, 워크플로우 기능의 본질은 다음 4개를 연결하는 것이다.

1. **새 webContents 확보**
2. **프롬프트 주입**
3. **응답 완료 대기**
4. **결과를 다음 스텝 변수로 전달**

### 2.2 현재 구조가 주는 제약

- `createServiceView()`는 `mainWindow.addBrowserView()`에 묶여 있다.
- `extractLastResponseFromService()`는 `views` 맵과 결합되어 있다.
- `#controls-container`는 이미 버튼, 토글, 레이아웃, 서비스 체크박스로 밀도가 높다.
- CPB/슬래시 메뉴에서 이미 `main-popup-layer-active`와 z-index 문제가 존재한다.
- `backgroundThrottling`이 별도로 꺼져 있지 않다.
- 서비스별 스트리밍 selector는 Claude 외에는 부족하다.

이 제약 때문에, v3의 핵심 원칙은 다음과 같다.

> **새 기능을 추가하되, 기존 입력 흐름과 레이아웃 시스템을 깨지 않는 방향으로 붙여야 한다.**

---

## 3. v2 문서에 대한 비판적 검토

v2는 v1보다 훨씬 현실적이었지만, 여전히 몇 가지 한계가 있다.

### 3.1 강점

- 코드베이스 실사를 반영해 구현 난이도를 현실화했다.
- `Phase 0` 리팩터링 필요성을 짚었다.
- `Workflow Builder`, `Monitor`, `Result Panel` 등 UX 요소를 처음으로 제안했다.
- `Cross Check`를 워크플로우 프리셋으로 보는 관점이 유용하다.

### 3.2 부족한 점

#### A. UI 표면이 너무 많다

v2는 `Builder`, `Monitor`, `Result Panel`, 실행 드롭다운, 슬래시 커맨드, Cross Check 확장 등을 동시에 제안한다.  
문제는 현재 앱의 주 사용자 동선이 이미 복잡하다는 점이다.

- `New Chat`
- `Copy Chat Thread`
- `Copy Last Response`
- `Cross Check`
- `Anonymous`
- `Scroll Sync`
- 레이아웃 버튼
- 서비스 토글
- Chat Mode Settings
- Prompt Expand / Preview / Slash / CPB

여기에 또 다른 1급 버튼과 패널을 추가하면 **발견성은 올라가도 인지 부하는 커질 수 있다.**

#### B. “첫 번째로 유용한 사용자 여정”이 없다

v2는 설계가 풍부하지만, 사용자가 처음 접했을 때 가장 먼저 써야 할 흐름이 무엇인지 분명하지 않다.

실제 제품에서는 다음 질문이 중요하다.

- 사용자가 첫날 바로 이해할 수 있는가
- 기존 `Cross Check` 사용자에게 자연스럽게 확장으로 느껴지는가
- 빈 캔버스 대신 즉시 가치가 나는 프리셋이 있는가

#### C. Builder 우선순위가 다소 높게 잡혀 있다

지금 단계에서 가장 큰 가치는 “빌더”가 아니라 다음 3가지다.

1. 프리셋 워크플로우 실행
2. 실행 중 상태 가시성
3. 결과 재사용

즉, **Builder는 Phase 2**가 맞고, **Phase 1은 Quick Run + Monitor + Result**가 핵심이어야 한다.

#### D. 기존 모달/레이어 시스템과의 통합 전략이 약하다

현재 CPB 쪽 코드에는 다음 코멘트가 이미 있다.

```3398:3424:src/renderer/custom-prompt-builder.js
// Always close slash menu FIRST to deactivate popup layer
// (popup layer raises #controls-container to z-index 12010, which can cover modals)
```

또 스타일에서도:

```589:594:src/renderer/styles.css
body.main-popup-layer-active #controls-container,
body.main-popup-layer-active #input-area,
body.main-popup-layer-active .prompt-card {
    position: relative;
    z-index: 12010;
}
```

즉, 새 Builder/Result 모달을 설계할 때는 **기존 모달 레이어 유틸을 재사용**해야 하며, 독립 구현하면 또다시 webview 가림 이슈가 발생할 가능성이 높다.

#### E. “신뢰”와 “투명성” UX가 약하다

백그라운드 자동화는 사용자에게 불안감을 줄 수 있다.

- 지금 무엇이 실행 중인지
- 어떤 서비스가 쓰였는지
- 내 현재 대화는 안전한지
- 결과가 어디서 왔는지

v2는 기술적으로는 설명했지만, **사용자 신뢰를 위한 UI 장치**는 더 구체화가 필요하다.

---

## 4. v3 제품 방향: “워크플로우 기능”이 아니라 “Automation Layer”

v3에서는 기능을 하나 더 추가하는 방식보다, 기존 앱 위에 **Automation Layer**를 얹는 관점이 더 적절하다고 본다.

### 4.1 사용자에게 보이는 개념

사용자에게는 다음처럼 설명되어야 한다.

- `Cross Check`는 “응답 비교 자동화”
- `Workflow`는 “여러 단계를 이어서 실행하는 자동화”
- 둘은 별개 기능이 아니라, 같은 Automation 범주 안의 두 수준이다

즉 제품 개념상:

- **Quick Automation**: 프리셋 실행
- **Advanced Automation**: 직접 빌드

### 4.2 정보 구조(IA) 제안

v3는 화면 표면을 다음 3개로 단순화한다.

1. **Automation Entry**
   - 어디서 실행을 시작하는가
2. **Automation Run Visibility**
   - 실행 중 무엇이 보이는가
3. **Automation Result Reuse**
   - 결과를 어떻게 다시 쓸 수 있는가

Builder는 4번째로 본다.

---

## 5. UX/IA 제안

## 5.1 Entry: 어디서 시작할 것인가

현재 `#controls-container`는 이미 매우 조밀하다. 새 버튼을 무작정 추가하는 것은 좋지 않다.

### 권장안 A: `Cross Check`를 Automation 진입점으로 확장

현재 `cross-check-modal`은 이미 “응답 기반 후속 자동화”에 가장 가까운 진입점이다.  
따라서 Phase 1에서는 다음이 가장 자연스럽다.

- `Cross Check` 버튼은 유지
- 모달 제목/정보구조만 확장:
  - `Compare Responses`
  - `Quick Workflows`
  - `Build Workflow`

즉, 기존 모달을 **Automation Hub Lite**로 바꾸는 방식이다.

이 방식의 장점:

- 새 상단 버튼 추가 없음
- 사용자 학습 비용 낮음
- 기존 Cross Check 사용자가 자연스럽게 확장 기능으로 이해 가능

### 권장안 B: Phase 2에서 별도 `Automation` 버튼 도입

Phase 2 이후 프리셋 사용량이 충분히 높아지면, 그때 `Cross Check` 옆에 `Automation` 버튼을 분리할 수 있다.

#### 이유

지금은 기능이 충분히 검증되지 않았다.  
초기에는 기존 진입점을 확장하고, 사용량이 생긴 뒤 독립 승격하는 것이 안전하다.

---

## 5.2 Quick Run: 첫 번째로 유용한 사용자 여정

Phase 1에서 사용자가 반드시 바로 이해할 수 있어야 하는 흐름은 다음 3개다.

### 프리셋 1. `Compare + Summarize`

- 현재 활성 서비스들의 마지막 응답을 모은다
- 비교 프롬프트를 돌린다
- 결과를 하나의 요약으로 정리한다

이 프리셋은 기존 `Cross Check` 사용자에게 가장 자연스럽다.

### 프리셋 2. `Research → Verify → Summarize`

- `Perplexity/Genspark`로 조사
- `ChatGPT/Claude`로 검증
- `Gemini`로 요약

이 프리셋은 “백그라운드 워크플로우”라는 컨셉을 가장 잘 보여준다.

### 프리셋 3. `Summarize Current Thread`

- 현재 `chat_thread`를 읽고
- 지정 서비스 하나로 요약/액션 아이템 생성

이 프리셋은 구현 복잡도가 낮고 즉시 가치가 있다.

### Quick Run UI

초기 모달에서는 카드 3개만 노출한다.

```text
┌─ Automation Hub ───────────────────────────┐
│ Quick Actions                              │
│                                            │
│ [Compare + Summarize]                      │
│ [Research → Verify → Summarize]           │
│ [Summarize Current Thread]                │
│                                            │
│ [최근 실행] [고급 빌드]                     │
└────────────────────────────────────────────┘
```

핵심은 **“빈 빌더”보다 “즉시 가치 카드”**를 먼저 보여주는 것이다.

---

## 5.3 Builder: CPB와 어떤 관계로 둘 것인가

Builder는 별도의 새로운 편집기가 아니라, CPB의 정신모델을 계승해야 한다.

### 설계 원칙

- 왼쪽: 워크플로우 목록
- 오른쪽: 단계 편집
- 프롬프트 입력부는 CPB와 유사한 변수 자동완성/미리보기
- “프롬프트 저장”과 “워크플로우 저장”은 다르지만, **스텝 프롬프트에서 CPB 템플릿을 참조 가능**해야 한다

### Builder를 바로 내놓지 말아야 하는 이유

직접 빌더를 먼저 내놓으면 사용자는 아래 문제를 겪는다.

- 어떤 서비스를 어떤 순서로 넣어야 하는지 모름
- 어떤 변수를 써야 하는지 모름
- 실패 원인을 Builder 탓으로 오해함

그래서 Phase 1에는:

- **읽기 가능한 프리셋**
- **복제 가능한 프리셋**
- **아주 제한된 편집**만 허용

Phase 2에:

- 빈 워크플로우 생성
- 병렬 스텝 추가
- 출력 변수 수동 지정

이 더 적절하다.

---

## 5.4 Monitor: 어디에 보여줄 것인가

모니터는 “보이되 거슬리지 않아야” 한다.

### 권장 위치

현재 DOM 구조는:

- `#views-placeholder`
- `#prompt-resize-handle`
- `#controls-container`

따라서 새 요소 `#workflow-run-strip`를 **`prompt-resize-handle` 아래, `controls-container` 위**에 두는 것이 가장 적절하다.

이유:

- 기존 뷰 레이아웃 계산에 영향이 적다
- prompt collapse 여부와 독립적으로 보일 수 있다
- 하단 입력과 가깝지만, 입력 영역 자체를 차지하지 않는다

### Strip의 기본 역할

- 워크플로우명
- 현재 스텝
- 진행률
- 서비스별 상태 점 표시
- `상세` / `취소`

예시:

```text
⚙ Research → Verify → Summarize   Step 2/3   64%
Perplexity ● done   ChatGPT ● running   Claude ● running   Gemini ○ pending
[상세] [취소]
```

### 상세 뷰

상세는 모달보다 **우측 시트(side sheet)**가 더 낫다.

이유:

- 사용자는 메인 웹뷰를 계속 보고 싶다
- 모달은 현재 작업을 중단시키는 느낌이 강하다
- 사이드 시트는 “관찰”에 더 적합하다

---

## 5.5 Result: 결과는 “닫는 문서”가 아니라 “재사용 가능한 자산”

결과 표시의 핵심은 읽기보다 **재사용**이다.

### Result Panel에서 필요한 액션

- `최종 요약 복사`
- `메인 입력창에 붙여넣기`
- `새 CPB 프롬프트로 저장`
- `실행 이력으로 저장`
- `세부 스텝 응답 보기`

### 중요한 UX 원칙

결과 패널은 “완료 알림”이 아니라 **후속 작업 출발점**이어야 한다.

예:

- “이 요약을 기반으로 추가 질문”
- “팩트체크 결과만 다시 검토”
- “이번 실행을 템플릿으로 저장”

즉 결과 패널은 `Done`이 아니라 `Next`를 제공해야 한다.

---

## 5.6 Human Fallback UX

기술적으로 CAPTCHA/로그인 만료를 감지하는 것만으로는 부족하다.  
사용자가 어떻게 문제를 해결하는지가 중요하다.

### 권장 흐름

1. 실행 중 오류 감지
2. 하단 strip에 경고 상태 표시
3. 우측 상단 토스트:
   - `Claude requires attention`
   - `[해결하기] [이번 실행 중단]`
4. `해결하기` 클릭 시:
   - 해당 서비스 foreground view로 포커스 이동
   - 필요하면 해당 서비스만 크게 보기
5. 사용자가 해결 후:
   - `계속 실행` 버튼
   - 자동 재개

### 중요한 점

이 흐름은 사용자에게 “몰래 자동화”가 아니라 “안전한 보조 자동화”라는 인상을 준다.

---

## 6. 기술 설계 구체화

## 6.1 새로 필요한 API 표면

현재 `src/main/preload.js`에 노출된 API 패턴을 따르면 다음 정도가 적절하다.

```javascript
executeWorkflow: (workflowId, payload) => ipcRenderer.invoke('workflow:execute', { workflowId, payload }),
cancelWorkflow: (runId) => ipcRenderer.send('workflow:cancel', runId),
getWorkflowList: () => ipcRenderer.invoke('workflow:list'),
saveWorkflow: (workflow) => ipcRenderer.invoke('workflow:save', workflow),
deleteWorkflow: (workflowId) => ipcRenderer.invoke('workflow:delete', workflowId),
getWorkflowRuns: () => ipcRenderer.invoke('workflow:runs'),
onWorkflowProgress: (callback) => ipcRenderer.on('workflow:progress', (event, data) => callback(data)),
onWorkflowCompleted: (callback) => ipcRenderer.on('workflow:completed', (event, data) => callback(data)),
onWorkflowPaused: (callback) => ipcRenderer.on('workflow:paused', (event, data) => callback(data)),
onWorkflowFailed: (callback) => ipcRenderer.on('workflow:failed', (event, data) => callback(data))
```

초기에는 `invoke + send/on` 혼합 패턴이 현재 코드와 가장 잘 맞는다.

## 6.2 저장 모델

### Workflow 정의

```json
{
  "id": "wf_compare_summarize",
  "name": "Compare + Summarize",
  "version": 1,
  "isPreset": true,
  "steps": [],
  "createdAt": "2026-03-10T16:30:00.000Z",
  "updatedAt": "2026-03-10T16:30:00.000Z"
}
```

### Workflow Run 이력

```json
{
  "runId": "run_1741595400_xxx",
  "workflowId": "wf_compare_summarize",
  "status": "completed",
  "startedAt": "2026-03-10T16:31:00.000Z",
  "finishedAt": "2026-03-10T16:34:20.000Z",
  "steps": [
    {
      "stepId": "step_1",
      "service": "claude",
      "status": "completed",
      "latencyMs": 48210,
      "outputPreview": "핵심 차이는 다음과 같습니다..."
    }
  ],
  "result": {
    "summary": "...",
    "artifacts": []
  }
}
```

초기에는 `electron-store` 기반으로도 충분하고, 나중에 필요하면 IndexedDB나 파일 저장으로 확장할 수 있다.

## 6.3 구현 순서 재정의

v2의 Phase 0~3는 방향은 좋지만, 제품 가치 기준으로 다시 정렬할 필요가 있다.

### Phase A — 내부 기반 정리

- `extractLastResponse(wc, service)` 분리
- `injectPromptToWebContents()` 추출
- `createBackgroundView()` 구현
- `backgroundThrottling: false`
- 새 대화 URL 강제 정책

### Phase B — Quick Automation MVP

- 프리셋 3개
- Automation Hub Lite (기존 Cross Check 모달 확장)
- Run Strip
- 기본 Result Sheet
- 실행 취소 / 오류 처리

### Phase C — Reuse 강화

- 최근 실행
- 결과 재주입
- 히스토리 저장
- 프리셋 복제

### Phase D — Builder

- 스텝 편집
- 병렬 스텝
- 변수 입력
- 사용자 정의 저장

즉, Builder는 마지막이다.

---

## 7. 구체적 파일 영향 제안

### `src/main/main.js`

- `createBackgroundView(service, options)`
- `extractLastResponse(wc, service)`
- `workflow` IPC 핸들러
- `bgWindow` 생명주기

### `src/main/preload.js`

- workflow API 노출 추가

### `src/renderer/index.html`

- `cross-check-modal`을 확장할지, `automation-modal`을 별도 추가할지 결정
- `workflow-run-strip`
- `workflow-result-sheet`

### `src/renderer/renderer.js`

- Automation Hub 열기/닫기
- run strip 업데이트
- result sheet 표시

### `src/renderer/custom-prompt-builder.js`

- CPB 프롬프트를 워크플로우 스텝에 삽입하는 브리지 함수
- 기존 모달 레이어 유틸 재사용

### 신규 파일 권장

- `src/main/workflow-engine.js`
- `src/main/workflow-store.js`
- `src/renderer/workflow-hub.js`
- `src/renderer/workflow-runs.js`

---

## 8. 제품 KPI / 검증 기준

이 기능은 “구현됐다”보다 “실제로 쓰인다”가 중요하다.

### 핵심 KPI

- 워크플로우 실행률
  - 전체 세션 중 워크플로우를 1회 이상 실행한 비율
- 재실행률
  - 동일 프리셋 재사용 비율
- 결과 재사용률
  - 결과를 복사/메인 입력창 재주입한 비율
- 실패 가시성
  - 실패했을 때 사용자가 원인을 이해한 비율
- 사용자 중단률
  - 실행 후 바로 취소하는 비율

### UX 검증 질문

- 사용자는 Cross Check와 Workflow의 차이를 이해하는가
- 사용자는 백그라운드 자동화가 실행 중이라는 사실을 신뢰하는가
- 사용자는 “이 기능이 내 현재 채팅을 망치지 않는다”는 확신을 가지는가

---

## 9. 최종 권장안

### 제품 관점 결론

`Background Workflow Automation`은 **독립 대기능**으로 바로 넣기보다,  
기존 `Cross Check`와 `CPB` 사이에 있는 **Automation Layer**로 설계하는 것이 가장 자연스럽다.

### 구현 관점 결론

가장 현실적인 첫 단계는 다음 조합이다.

- `Hidden bgWindow`
- `createBackgroundView()`
- `extractLastResponse(wc, service)` 리팩터링
- 기존 Cross Check 모달을 확장한 **Automation Hub Lite**
- `workflow-run-strip`
- `result side sheet`

### UX 관점 결론

사용자가 처음 접하는 경험은 “빌더”가 아니라:

1. `Quick Run`
2. `실행 상태 확인`
3. `결과 재사용`

이어야 한다.

### v3의 핵심 차별점

- v1보다 현실적이다
- v2보다 제품 흐름 중심이다
- 기능 추가가 아니라 **현재 앱에 자연스럽게 스며드는 방식**을 제안한다

---

## 10. 다음 단계

실제 구현 전 다음 순서로 상세 spec을 분리하는 것이 적절하다.

1. **Tech Spec**
   - `bgWindow`, `createBackgroundView`, `extractLastResponse(wc, service)`
2. **UX Spec**
   - Automation Hub Lite, Run Strip, Result Side Sheet
3. **Preset Spec**
   - Compare + Summarize
   - Research → Verify → Summarize
   - Summarize Current Thread
4. **Phase 1 Acceptance Criteria**
   - 현재 채팅 오염 없이
   - 1개 프리셋 이상 성공적으로 완료
   - 진행 상태와 실패 원인이 사용자에게 보일 것

본 문서는 v3 아이데이션이며, 구현 착수 시에는 위 4개 spec 문서로 쪼개는 것이 가장 안전하다.
