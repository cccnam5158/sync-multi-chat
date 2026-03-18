# Service A

좋습니다. 주신 \*\*기술 검토 의견(기준안)\*\*을 중심으로, 다른 AI 응답들(Service A/B/C/E)과 첨부 설계 문서의 내용(중복 제거)까지 합쳐서 **실제로 구현 가능한지 / 어떤 방식이 가장 현실적인지 / 무엇을 추가로 검토해야 하는지**를 기술적으로 재검토한 최종안을 정리드리겠습니다.  
첨부 설계 문서에는 이미 `BackgroundViewPool`, `WorkflowManager`, IPC/로드맵/리스크 초안이 잘 정리되어 있어, 이를 기반으로 보강하는 방향이 가장 효율적입니다.

* * *

# 최종 결론 (구현 가능성)

## 1) 구현 가능성 판단: **가능 (높음)**

주신 기준안의 핵심 판단이 맞습니다.

*   **Electron에서 “완전 headless”가 아니라도**,  
    **숨은 창(hidden `BrowserWindow`) 또는 비가시 `BrowserView`/뷰**로 백그라운드 워크플로우를 구현하는 것은 충분히 가능합니다.
    
*   현재 구조가 이미
    
    *   서비스별 파티션(`persist:service-*`)
        
    *   프롬프트 주입
        
    *   응답 추출
        
    *   셀렉터 관리
        
    *   크로스체크 패턴  
        을 갖추고 있어, **확장 비용이 낮은 편**입니다.
        

다만, **“기술적으로 가능”과 “운영 안정성”은 별개**이므로, 아래의 추가 고려사항(세션 충돌/탐지/응답 완료 감지/취소/오류 복구)을 반영해야 상용 품질에 근접합니다.

* * *

# 중복 제거 후 핵심 합의점 (여러 응답의 공통분모)

아래 항목들은 서로 다른 응답들이 사실상 동일하게 지적한 핵심입니다.

## 2) 공통 합의사항

### A. 포그라운드와 백그라운드 실행 컨텍스트 분리 필요

*   **같은 사용자용 웹뷰를 재사용하면 충돌 위험이 큼**
    
    *   입력 충돌
        
    *   포커스/스크롤 충돌
        
    *   DOM 상태 오염
        
    *   동시 요청으로 세션/레이트리밋 이슈
        
*   따라서 **백그라운드 전용 뷰/창(별도 webContents)** 로 분리해야 함
    

➡️ 이 부분은 주신 기준안과 Service A/C가 동일한 결론입니다.

* * *

### B. 동일 partition 기반 세션 공유는 유효한 전략

*   `persist:service-{name}`를 백그라운드 뷰에도 동일하게 쓰면
    
    *   쿠키 / localStorage / 세션 상태 공유 가능
        
    *   별도 로그인 없이 워크플로우 수행 가능
        
*   다만 서비스별로 **동시 세션 감지/재인증**이 발생할 수 있으므로 폴백 전략 필요 (아래 보강안 참조)
    

첨부 설계 문서도 동일 내용을 권장/폴백 구조로 제안하고 있습니다.

* * *

### C. 응답 완료 감지가 핵심 난제

*   단순 `extractLastResponse...` 호출만으로는 부족
    
*   스트리밍 UI에서는 “완료 시점” 판단 로직이 별도 필요
    
*   첨부 문서의 **content stability + streaming indicator + timeout** 전략은 매우 타당합니다.
    

* * *

### D. 리소스 관리/동시성 제한 필요

*   백그라운드 웹뷰 다수 동시 실행 시 메모리/CPU 급증
    
*   동시 실행 개수 제한 + 스텝 후 즉시 해제 + 재사용 풀 전략 필요
    
*   첨부 문서의 “동시 2개 제한”은 MVP 기준으로 현실적입니다.
    

* * *

# 추가로 면밀히 재검토해야 할 기술 사항 (중요)

여기부터가 “마지막 답변 기준 + 다른 AI 관점 반영” 시 **실제로 추가 고려가 필요한 부분**입니다.

## 3) 추가 고려사항 (기존안 보강 포인트)

## 3-1. “숨은 BrowserView” vs “숨은 BrowserWindow” 우선순위 재정리

주신 기준안에서는 **A. 숨은 창(Hidden Window)** 를 더 안전한 방식으로 보셨는데, 이 판단은 실무적으로 타당합니다.

### 권장 우선순위

*   **MVP/빠른 통합**: 숨은 `BrowserWindow` + 내부 워크플로우 전용 뷰
    
*   **최소 변경 PoC**: mainWindow에 0x0 뷰 부착 (기존 구조 재사용 극대화)
    
*   **장기 안정화/상용**: 외부 워커(예: Playwright sidecar) 분리 검토
    

### 왜 숨은 창이 더 안전한가

*   mainWindow 레이아웃/모드 전환 로직과 분리
    
*   실수로 `switchToSingleAiMode`/`switchToMultiAiMode`에 휘말릴 가능성 감소
    
*   디버깅/생명주기 관리(워크플로우 창 생성→종료)가 명확
    

즉, **당장 구현은 가능하지만**, 제품 품질 관점에서는 **숨은 창 기반이 기본값**이 더 안전합니다.

* * *

## 3-2. 세션 공유 전략은 “서비스별 정책화”가 필요 (일괄 정책 X)

현재 안은 “같은 partition 공유”를 기본으로 잘 잡으셨습니다. 다만 실제로는 서비스별 거동이 달라서 **정책 테이블**이 필요합니다.

### 서비스별 세션 정책 권장 (예시)

*   **Policy A (shared)**: 동일 partition 사용
    
*   **Policy B (isolated)**: 별도 partition + 필요 시 수동 로그인
    
*   **Policy C (shared but serialized)**: 동일 partition 공유하되 **해당 서비스는 동시 실행 금지**
    
    *   예: 같은 서비스의 foreground + background 동시 요청 차단
        
    *   큐 직렬화
        

➡️ 특히 Service A/Service B 계열은 `shared + serialized`가 더 안정적일 수 있습니다.

**핵심**: “동일 partition 공유” 자체는 맞지만, **서비스별 동시성 정책**까지 붙여야 운영 안정성이 올라갑니다.

* * *

## 3-3. 응답 완료 감지에 “취소/중단 조건”이 반드시 추가되어야 함

첨부 문서의 완료 감지 전략은 좋지만, 실무에서는 아래 3개가 더 필요합니다.

### 반드시 추가할 조건

1.  **사용자 취소(cancel token)**
    
    *   `workflow:cancel` IPC가 들어오면
        
    *   폴링 루프/타임아웃/현재 스텝 즉시 중단
        
    *   뷰 release 및 상태 `cancelled`
        
2.  **에러 페이지/로그인 리다이렉트 감지**
    
    *   로그인 페이지로 튕김 / CAPTCHA / rate-limit 페이지 감지 시
        
    *   “완료 대기”가 아니라 “실패(재인증 필요)”로 종료
        
3.  **부분 성공 허용 기준**
    
    *   병렬 팩트체크에서 2개 중 1개만 성공해도 다음 스텝 진행할지 정책 필요
        

첨부 문서에 `workflow:cancel` 채널은 정의되어 있으나 실제 실행 루프의 중단 구조까지는 더 구체화가 필요합니다.

* * *

## 3-4. 병렬 스텝 결과 구조(`parallel`)가 현재 설계대로면 템플릿 치환에서 깨질 수 있음

첨부 문서의 `parallel` 스텝 반환값은 객체(`{ type, results: [...] }`)인데, 이후 `outputVar`에 `result.content`를 넣는 흐름으로 보입니다.  
그런데 `parallel` 결과에는 일반적으로 `content` 필드가 없고 `results[]` 배열이 있으므로, 현재 샘플 코드 로직은 그대로 쓰면 **템플릿 입력값에 `undefined`가 들어갈 가능성**이 있습니다.

### 보강 필요

*   스텝 결과 표준화:
    
    *   `single` 결과도
        
    *   `parallel` 결과도  
        **공통 필드 `normalizedText`** 를 반드시 생성
        
*   예:
    
    *   `parallel.normalizedText = results.map(...).join("\n\n")`
        

이건 구현 가능성 자체를 낮추는 이슈는 아니지만, **초기 구현 시 바로 부딪히는 버그 포인트**입니다.

* * *

## 3-5. `extractContentFromService` 재사용 시 `webContents` 오버라이드 경로의 안정성 점검 필요

주신 기준안/첨부 문서에서 매우 좋은 방향으로 `__wcOverride`를 언급하셨습니다. 다만 다음을 확인해야 합니다.

### 체크포인트

*   기존 함수가 내부에서
    
    *   전역 view map을 참조하는지
        
    *   현재 활성 탭 상태를 참조하는지
        
    *   renderer IPC roundtrip 전제를 갖는지
        
*   만약 그렇다면 단순 `webContents` 주입만으로는 부족하고,  
    **추출기(extractor)를 순수 함수화** 해야 합니다.
    

### 권장 리팩터링

*   `extractLastResponseFromService(service, opts)` 내부를
    
    *   `resolveTargetWebContents(...)`
        
    *   `extractWithSelectors(wc, selectors)`  
        로 분리
        
*   이렇게 해야 foreground/background 공용화가 깨지지 않습니다.
    

* * *

## 3-6. 백그라운드 자동화의 “운영 리스크”는 기능 설계에 내장해야 함

다른 응답(Service A/E)에서 강조한 포인트 중 기술적으로 중요한 것은 **약관/탐지/DOM 변경 리스크를 런타임 정책으로 관리**해야 한다는 점입니다.

### 기능에 내장해야 할 운영 제어

*   **일일 실행 횟수 제한**
    
*   **서비스별 최소 간격**
    
*   **재시도 횟수**
    
*   **실패 원인 분류**
    
    *   timeout / selector-fail / auth / captcha / rate-limit
        
*   **사용자 동의/가시성**
    
    *   “백그라운드 워크플로우 실행” 토글
        
    *   실행 중 상태 패널 (첨부 문서 안과 일치)
        

이 부분은 단순 정책 문구가 아니라, **실행 엔진의 상태 머신에 필드로 들어가야** 합니다.

* * *

# 최종 구현 방안 (권장안)

아래는 **실행 가능성 + 안정성 + 기존 코드 재사용**을 균형화한 최종 구현안입니다.

## 4) 권장 구현 아키텍처 (현 시점 최적안)

## 옵션 1 (권장, 현실적): **Hidden Window + Workflow Engine (Electron 내부)**

### 구성

*   **Foreground**
    
    *   기존 mainWindow + 기존 BrowserView들 그대로 유지
        
*   **Background**
    
    *   `workflowWindow` (`show:false`)
        
    *   이 창에 워크플로우 전용 뷰들을 붙여 실행
        
*   **Main Process**
    
    *   `WorkflowManager`
        
    *   `BackgroundViewPool`
        
    *   `WorkflowPolicy` (동시성/레이트/재시도/세션정책)
        
    *   `WorkflowStore` (정의/실행이력)
        

### 장점

*   기존 로직 재사용 최댓값
    
*   UI 영향 최소화
    
*   구현 속도 빠름
    

### 단점

*   Electron 프로세스 내부에서 자동화 실패가 앱 안정성에 영향 가능
    
*   장기적으로 서비스별 변화 대응 비용 증가
    

➡️ **지금 하시려는 Sync Multi Chat 진화 단계에는 가장 적합**합니다.

* * *

## 옵션 2 (상용 안정화 단계): **Playwright Sidecar Worker + Electron Orchestrator**

Service A 관점(외부 워커 분리)은 장기적으로 매우 좋은 방향입니다.

### 권장 시점

*   워크플로우 사용량이 늘고
    
*   병렬성/안정성/로그 수집/재시작 분리가 중요해질 때
    

### 지금 바로 채택하지 않아도 되는 이유

*   현재는 Electron 내부 자산(프롬프트 주입/응답 추출/셀렉터/세션 분할)이 이미 강력함
    
*   초기에 sidecar까지 넣으면 복잡도 급증
    

➡️ **결론**:  
**1차 릴리즈는 Electron 내부 숨은 창 구조**,  
**2차 안정화에서 Playwright sidecar 전환 가능하도록 인터페이스만 분리**해 두는 것이 최적입니다.

* * *

# 구현 상세 설계 (실행 가능한 수준으로 정리)

## 5) 구현 단계별 방안

## Phase 1 — 엔진 MVP (기능 검증)

첨부 문서의 로드맵 방향이 적절합니다.  
다만 아래 순서로 하면 실패율이 낮습니다.

### 1단계: 숨은 워크플로우 창 생성

*   `workflowWindow = new BrowserWindow({ show:false, ... })`
    
*   워크플로우용 뷰는 모두 이 창에만 attach
    
*   foreground 모드 전환 로직과 완전 분리
    

### 2단계: BackgroundViewPool 구현

*   `acquire(service, policy)`
    
*   `release(viewId)`
    
*   `releaseAll(workflowId)`
    
*   정책 필드 포함:
    
    *   `sessionMode: shared|isolated`
        
    *   `maxConcurrencyPerService`
        
    *   `reuseTTL`
        

### 3단계: WorkflowManager 순차 실행

*   `single` 스텝만 먼저 구현
    
*   취소 토큰 포함 (`AbortController` 유사 구조)
    
*   실패 분류 코드 도입:
    
    *   `TIMEOUT`, `AUTH_REQUIRED`, `CAPTCHA`, `SELECTOR_BROKEN`, `RATE_LIMIT`
        

### 4단계: 응답 완료 감지 고도화

*   1차: streaming indicator
    
*   2차: content stability hash
    
*   3차: 최대 타임아웃
    
*   4차: 로그인/오류 페이지 감지
    

### 5단계: 결과 전달

*   `workflow:progress`, `workflow:completed`, `workflow:error`
    
*   renderer에는 미니 패널만 우선 적용 (빌더 UI는 후순위)
    

* * *

## Phase 2 — 병렬 팩트체크 + 결과 정규화

여기서 중요한 건 **결과 스키마 표준화**입니다.

### 스텝 결과 공통 스키마 (권장)

JavaScript

{  
  stepId,  
  type: "single" | "parallel",  
  status: "success" | "partial" | "failed",  
  outputs: \[  
    {  
      service: "Service A",  
      status: "success",  
      content: "...",  
      meta: { durationMs, retries, capturedAt, url }  
    }  
  \],  
  normalizedText: "...",   // 다음 스텝 템플릿에 넣는 문자열  
  error: null  
}

### 이유

*   `single`/`parallel` 모두 동일 인터페이스로 다음 스텝 템플릿에 전달 가능
    
*   추후 API 기반 실행으로 바꾸더라도 스키마 유지 가능
    

* * *

## Phase 3 — 운영 안정화(상용 준비)

*   서비스별 정책 파일 분리 (`service-policies.json`)
    
*   selector profile 버전 관리
    
*   실행 로그/스크린샷/원문 증적 저장
    
*   실패 재현 도구(디버그 모드에서 숨은 창 표시)
    
*   sidecar 인터페이스 추상화 (`ExecutorAdapter`)
    

* * *

# 최종적으로 권장하는 구현 원칙 (압축판)

## 6) 실무 기준 최종 권장안

1.  **가능성**: 구현 가능 (높음)
    
2.  **MVP 방식**: `Hidden BrowserWindow` + `BackgroundViewPool` + `WorkflowManager`
    
3.  **세션 전략**: 기본 `shared partition`, 서비스별 `serialized`/`isolated` 폴백
    
4.  **핵심 난제 대응**: 응답 완료 감지 + 취소/인증/캡차/레이트리밋 감지
    
5.  **구조적 포인트**: 결과 스키마 표준화(특히 `parallel` 결과 정규화)
    
6.  **장기 전략**: 내부 엔진으로 시작하되, 추후 Playwright sidecar로 이행 가능한 인터페이스 설계
    

* * *

# 바로 적용 가능한 수정/보강 체크리스트 (우선순위)

## 7) 우선순위 높은 보강 항목 (필수)

*    `workflowWindow` 분리 (mainWindow와 독립)
    
*    `workflow:cancel` 실제 중단 경로 구현
    
*    병렬 결과 `normalizedText` 추가
    
*    `extract...` 로직의 foreground 의존성 제거(순수 extractor화)
    
*    인증/캡차/레이트리밋 감지 분기 추가
    
*    서비스별 동시성 정책(`shared/serialized/isolated`) 도입
    

## 8) 우선순위 중간 (권장)

*    실행 이력/증적 저장 (`raw text`, timestamp, service, step)
    
*    디버그 모드에서 숨은 창 표시 토글
    
*    selector 실패 시 프로파일 버전 fallback
    
*    사용자 상태 패널(진행률 + 취소)
    

* * *

정리하면, 주신 기준안은 **핵심 방향이 매우 정확**하고, 첨부 설계 문서도 구조적으로 좋습니다.  
최종 성공 여부는 \*\*“숨은 뷰를 띄울 수 있느냐”가 아니라, “실행 엔진의 상태/정책/취소/오류 복구를 얼마나 잘 설계하느냐”\*\*에 달려 있습니다. 첨부 문서의 기본 설계(풀, 매니저, IPC, 로드맵)를 유지하되, 위 보강 포인트를 반영하면 실제 제품 기능으로 구현 가능한 수준입니다.

**Q1.**

현재 `extractLastResponseFromService()`를 기준으로, foreground/background 공용으로 쓰기 위한 **추출기 리팩터링 인터페이스(함수 시그니처/의존성 분리 구조)** 를 제가 바로 적용 가능한 형태로 설계해드릴까요?

**Q2.**

`shared / serialized / isolated` 세션 정책을 서비스별(Service A/Service B/Service C/Service E)로 나눈 **실행 정책 테이블 초안**을 만들어드릴까요?

**Q3.**

MVP 기준으로 `WorkflowManager`에 들어갈 **상태 머신 전이도(Started → StepRunning → WaitingResponse → Partial/Failed/Completed/Cancelled)** 를 코드 구현 관점에서 정리해드릴까요?

---

# Service B

The user wants me to:

1.  Review the technical review opinions from multiple AI services
2.  Remove duplicates
3.  Consider additional perspectives from other AIs that my previous answer didn't cover
4.  Provide a final consolidated analysis of implementation feasibility and approach
5.  Output in chat, not as a separate file

Let me read through all the opinions and identify:

*   Common consensus points (to deduplicate)
*   New/unique perspectives I should incorporate
*   Technical considerations I may have missed

Let me analyze each source:

**My previous answer (Service B):** BrowserView with bounds 0,0,0,0; shared partition; BackgroundViewPool + WorkflowManager modules; streaming detection; anti-bot; memory management.

Now I'm seeing some important alternatives and warnings I hadn't fully considered. The hidden window approach using `show:false` on a BrowserWindow is actually safer than the zero-bounds trick since it avoids layout and mode switching issues entirely. More critically, Service A flagged some real dangers with reusing the same webview—input focus and scroll state can bleed between tasks, which my previous design didn't adequately address. The suggestion to use separate partitions for background work (`persist:bg-Service A-worker-01`) rather than a shared one makes sense for isolation, and there's also a compelling case for Playwright as a sidecar for long-term maintainability. The task graph plus state machine pattern is worth incorporating for cleaner orchestration.

Beyond the technical architecture, there are significant legal and operational considerations I need to account for. Terms of service violations are a real risk with automated access, and I should plan for human intervention on CAPTCHAs rather than trying to solve them automatically. Building an evidence bundle with screenshots and source attribution could help with transparency and compliance. For Service C, the off-screen coordinate approach (-1000, -1000) is another positioning option, though the hidden window still seems cleaner. Service E's recommendations around Puppeteer integration via WebSocket, disabling background throttling and dev tools, and using offscreen rendering for testing are all practical optimizations I should evaluate, especially given the memory footprint estimate of 1-2GB. I'm now consolidating these insights into a more complete answer that addresses the gaps—particularly the hidden window isolation approach, Playwright's sidecar mode as a longer-term option, why partition separation matters for detecting simultaneous sessions, and the importance of building in fallback mechanisms for CAPTCHA detection and audit logging for traceability.

첨부 파일과 모든 리뷰 의견을 꼼꼼히 분석했습니다. 중복을 제거하고, 제 이전 답변에서 부족했거나 다른 AI들이 제기한 추가 관점을 반영하여 최종 정리합니다.

* * *

## 최종 구현 가능성 판정

**결론: 기술적으로 충분히 가능하며, 현재 MAPB 아키텍처가 핵심 인프라를 이미 갖추고 있어 확장이 자연스럽습니다.**

모든 리뷰어(5개 AI)가 "가능하다"에 만장일치입니다. 다만 **구현 방식과 리스크 관리 수준**에서 관점 차이가 있었고, 이를 아래에 통합 정리합니다.

* * *

## 1\. 핵심 합의 사항 (전원 동의, 중복 제거)

모든 리뷰에서 공통으로 언급된 사항:

*   **숨겨진 BrowserView/Window로 headless-like 구현 가능** — Electron의 BrowserView는 화면에 표시하지 않아도 JS 실행, DOM 조작이 정상 동작함
*   **`persist:service-{name}` 파티션 공유로 별도 로그인 불필요** — 동일 파티션 사용 시 포그라운드의 쿠키/세션을 그대로 공유
*   **기존 인프라 재사용 가능** — `inject-prompt`, `extractLastResponseFromService()`, `selectorsConfig`, anti-detection 메커니즘 모두 재활용
*   **응답 완료 감지가 핵심 과제** — streaming 인디케이터 + content stability polling 조합 필요
*   **봇 감지/Rate Limit 회피 필수** — 스텝 간 딜레이, 동시 실행 제한
*   **메모리 관리** — 스텝 완료 즉시 뷰 해제, 동시 활성 뷰 수 제한

* * *

## 2\. 제 이전 답변 대비 추가 고려 필요 사항

다른 AI들의 관점을 면밀히 검토한 결과, 제 이전 설계에서 **부족했거나 보강해야 할 기술적 포인트**는 다음과 같습니다:

### 2.1 숨김 방식: Hidden BrowserWindow가 더 안전 ⚠️

**이전 답변:** `mainWindow.addBrowserView()` + `setBounds(0,0,0,0)`

**보강 사항 (Review 1, Service A 지적):**

`setBounds(0,0,0,0)` 방식은 mainWindow에 뷰가 붙어 있어서, `switchToSingleAiMode()` / `switchToMultiAiMode()` 등 기존 레이아웃/모드 전환 로직이 백그라운드 뷰를 의도치 않게 건드릴 수 있습니다. 실제로 현재 코드의 `set-service-visibility` 핸들러가 `Object.keys(views).forEach(...)`로 모든 뷰를 순회하는 패턴이 있어서, 백그라운드 뷰가 `views` 맵에 섞이면 문제가 됩니다.

**권장 수정:**

javascript

```javascript
// 방식 A (권장): 별도 Hidden BrowserWindow
const bgWindow = new BrowserWindow({
  show: false,           // 화면에 표시하지 않음
  width: 1280,
  height: 800,           // 실제 렌더링 영역 확보 (일부 서비스는 viewport 체크)
  webPreferences: { /* ... */ }
});
// 이 창에 워크플로우 전용 BrowserView를 붙임
bgWindow.addBrowserView(bgView);
```

**이유:** 포그라운드의 `mainWindow`와 물리적으로 분리되므로, 기존 레이아웃 로직(`update-view-bounds`, `shrink-views-for-popup` 등)과 완전히 독립됩니다. 별도 `workflowViews` 맵으로 관리하면 기존 `views` / `singleModeViews`와 충돌할 여지가 없습니다.

### 2.2 파티션 전략 재검토 ⚠️

**이전 답변:** 동일 파티션 공유를 기본 권장

**Service A의 반론:** 동일 세션에서 동시 요청 시 다중 세션 탐지, rate limit, anti-bot 유발 가능. 파티션 자체를 분리해야 브라우징 상태가 격리된다.

**면밀한 재검토 결과:**

이 부분은 **서비스별로 다르게 접근**해야 합니다:

| 서비스 | 동일 파티션 공유 가능성 | 근거 |
| --- | --- | --- |
| **Service E** | ✅ 비교적 안전 | 검색 특화, 동시 탭 사용 패턴 일반적 |
| **Service C** | ✅ 비교적 안전 | Google 계정 기반, 멀티탭 관대 |
| **Service A** | ⚠️ 주의 필요 | 동시 대화 감지 가능, 하지만 현재 다중 탭 허용 |
| **Service B** | ⚠️ 주의 필요 | 동시 요청 시 rate limit 민감 |
| **Service D** | ⚠️ 주의 필요 | Cloudflare 보호 적극적 |

**권장 전략 (하이브리드):**

*   **기본:** 동일 파티션 공유 (사용자 편의, 별도 로그인 불필요)
*   **폴백:** 문제 발생 시 서비스별로 별도 파티션(`persist:bg-service-{name}`)으로 전환 가능한 설정 옵션 제공
*   **구현 시:** 파티션 이름을 하드코딩하지 말고 설정으로 관리

javascript

```javascript
function getPartitionForBgView(service) {
  const useSeparatePartition = store.get(`bg.separatePartition.${service}`, false);
  return useSeparatePartition 
    ? `persist:bg-service-${service}` 
    : `persist:service-${service}`;
}
```

### 2.3 `backgroundThrottling: false` 명시 필수 ⚠️

**이전 답변:** 언급은 했으나 강조 부족

**Service A, E 모두 강조:** Chromium은 보이지 않는 페이지의 타이머/렌더링을 스로틀링합니다. 숨겨진 웹뷰에서 `setInterval`, `setTimeout`, `requestAnimationFrame` 등이 정상 동작하지 않을 수 있어서, 응답 완료 감지 로직이 작동하지 않는 원인이 됩니다.

javascript

````javascript
const bgView = new BrowserView({
  webPreferences: {
    backgroundThrottling: false,  // ★ 필수
    // ...
  }
});
```

이것은 단순 최적화가 아니라 **기능 정상 동작의 전제조건**입니다.

### 2.4 CAPTCHA/장애 시 Human Fallback 메커니즘 ⚠️

**이전 답변:** 리스크 테이블에서 언급만 하고 구체적 대응 없음

**Service A 지적:** CAPTCHA 감지 시 자동 중단 + 사용자 알림 + 포그라운드에서 수동 해결 유도 필요

**보강 설계:**
```
워크플로우 스텝 실행 중 이상 감지:
├── CAPTCHA 감지 (특정 DOM 요소/URL 패턴)
│   └── 워크플로우 일시 중지
│       └── 사용자에게 알림: "Service E에서 인증이 필요합니다"
│           └── 사용자가 포그라운드에서 해결 후 "계속" 버튼
│               └── 워크플로우 재개
├── 로그인 만료 감지
│   └── 포그라운드 웹뷰에서 재로그인 유도
├── Rate Limit 감지 (429 응답 or 특정 에러 메시지)
│   └── 자동 대기 (exponential backoff) 후 재시도
└── 타임아웃 (120초 무응답)
    └── 해당 스텝 스킵 또는 워크플로우 중단, 부분 결과 반환
```

이것은 **반자동(semi-automated)** 접근인데, Service A가 지적한 대로 처음부터 "완전 무인 자동화"보다는 이 방식이 현실적입니다.

### 2.5 BrowserView 디프리케이션 이슈

**Service A 지적:** `BrowserView`는 Electron에서 deprecated이며 `WebContentsView`로 대체되는 방향

**재검토 결과:** 이 지적은 사실이지만, 현재 MAPB 전체가 `BrowserView` 기반이므로 BWE만 `WebContentsView`로 전환하는 것은 비합리적입니다. **향후 앱 전체를 `WebContentsView`로 마이그레이션할 때 BWE도 함께 전환**하는 것이 맞습니다. 현 시점에서는 `BrowserView`로 구현하되, 인터페이스를 추상화해두면 됩니다.

### 2.6 Playwright Sidecar 옵션

**Service A가 강력 권장:** Electron 내부 숨김 웹뷰 대신 Playwright 워커 프로세스를 별도로 돌리는 방식

**면밀한 재검토:**

| 기준 | Electron 내부 (Hidden View) | Playwright Sidecar |
|------|---------------------------|-------------------|
| **구현 난이도** | 낮음 (기존 코드 90% 재사용) | 높음 (새 아키텍처) |
| **안정성** | 중간 (앱 크래시 시 같이 죽음) | 높음 (프로세스 분리) |
| **세션 공유** | 자연스러움 (동일 파티션) | 별도 세션 관리 필요 |
| **병렬 실행** | 제한적 (메모리) | 유리 |
| **디버깅** | Electron DevTools 활용 | Playwright trace/screenshot |
| **배포 크기** | 변화 없음 | +Chromium 바이너리 (~150MB) |
| **현재 앱과의 정합성** | 높음 | 낮음 (이질적 구조) |

**최종 판단:** 

Service A의 Playwright 권장은 **범용적 브라우저 자동화 관점**에서는 타당하지만, MAPB의 현재 상황에서는 과도한 아키텍처 전환입니다. 이유:

1. 이미 `puppeteer-extra-plugin-stealth`, `service-preload.js`, `selectorsConfig` 등 Electron 내부 자동화 인프라가 성숙해 있음
2. Playwright 도입 시 세션(로그인) 공유 문제를 별도로 해결해야 함 (쿠키 export/import)
3. 앱 배포 크기가 ~150MB 증가

**권장:** Phase 1은 Electron 내부 Hidden Window로 구현하고, 안정성/확장성 한계에 부딪히면 Phase 3에서 Playwright sidecar로 전환 고려. 이는 Service A도 "PoC: Electron 숨김 웹뷰 → 상용: Playwright"로 동의한 바 있음.

### 2.7 응답 완료 감지 보강

**Service E 추가 제안:** `devTools: false` 최적화, Puppeteer debugger WebSocket 연동 가능

**Service A 추가 제안:** 정적 sleep 대신 selector-based wait + 네트워크 idle 조건 조합

**보강된 3단계 감지 전략:**
```
응답 완료 감지 (우선순위):
1단계: Streaming 인디케이터 확인 (가장 정확)
  ├── Service B: [data-is-streaming="true"] 소멸 감지
  ├── Service A: .result-streaming 클래스 소멸
  ├── Service C: model-response streaming 속성 변화
  └── Service E: .animate-spin 소멸

2단계: Content Stability (1단계 실패 시 폴백)
  ├── 2초 간격 DOM content 해시 비교
  └── 3회 연속 동일 → 완료 판정

3단계: Network Idle (2단계 보완)
  ├── webContents.session.webRequest.onCompleted 모니터링
  └── 5초간 새 XHR/fetch 없으면 완료 보조 신호

타임아웃: 120초 (서비스별 조정 가능)
````

### 2.8 감사 로그 및 Evidence Bundle

**Service A 독자적 관점:** 워크플로우 실행 결과를 단순 텍스트가 아닌 구조화된 증거 번들로 저장

이 부분은 제 이전 답변에 없었고, **팩트체크 워크플로우의 신뢰성** 측면에서 중요합니다:

javascript

````javascript
// 각 스텝 결과 저장 스키마
{
  stepId: "step-2",
  service: "Service A",
  inputPrompt: "...",           // 실제 전송된 프롬프트
  outputText: "...",            // 추출된 응답
  capturedAt: "2026-02-24T...",
  responseLatencyMs: 15230,     // 응답 소요 시간
  sourceUrl: "https://Service A.com/c/abc123",  // 대화 URL
  selectorVersion: "v2.1",     // 사용된 셀렉터 버전
  extractionMethod: "lastResponse", // 추출 방식
  retryCount: 0,               // 재시도 횟수
  warnings: []                 // CAPTCHA 감지, 부분 추출 등
}
```

---

## 3. 최종 구현 방안 (통합)

### 3.1 아키텍처
```
┌─────────────────────────────────────────────────────────┐
│                     Main Process                         │
│                                                          │
│  ┌─────────────────┐     ┌────────────────────────────┐ │
│  │  mainWindow      │     │  bgWindow (show: false)    │ │
│  │  (포그라운드)     │     │  (백그라운드 전용)          │ │
│  │                  │     │                            │ │
│  │  views{} 맵      │     │  workflowViews{} 맵       │ │
│  │  singleModeViews│     │  - 동적 생성/파괴          │ │
│  │                  │     │  - backgroundThrottling:   │ │
│  │  ※ 기존 코드     │     │    false                   │ │
│  │    변경 없음      │     │  - 동일 또는 별도 파티션   │ │
│  └─────────────────┘     └─────────┬──────────────────┘ │
│          │                          │                    │
│  ┌───────┴──────────────────────────┴──────────────────┐│
│  │            WorkflowEngine (신규 모듈)                ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐││
│  │  │ViewPool      │  │StepRunner    │  │ResultStore │││
│  │  │- acquire()   │  │- 순차/병렬   │  │- evidence  │││
│  │  │- release()   │  │- 템플릿 치환  │  │  bundle    │││
│  │  │- 동시 2개    │  │- 완료 감지   │  │- 로그      │││
│  │  │  제한        │  │- CAPTCHA     │  │            │││
│  │  └──────────────┘  │  fallback    │  └────────────┘││
│  │                     └──────────────┘                 ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 3.2 기존 코드 영향 범위
```
변경 없음 (그대로 유지):
├── service-preload.js
├── selectors.json  
├── renderer.js (포그라운드 UI)
├── 기존 BrowserView 생성/관리 로직
├── cross-check, copy-chat-thread 등 기존 기능
└── custom-prompt-builder.js

최소 수정 (~50줄):
├── main.js
│   ├── bgWindow 생성 (createWindow 내, ~15줄)
│   ├── WorkflowEngine import + 초기화 (~5줄)
│   ├── IPC 핸들러 등록 (~20줄)
│   └── app close 시 bgWindow 정리 (~10줄)
└── index.html: 워크플로우 빌더 모달 HTML

신규 모듈:
├── src/main/workflow-engine.js (ViewPool + StepRunner 통합)
├── src/main/workflow-store.js (정의 저장/로드)
├── src/renderer/workflow-builder.js (UI)
└── src/renderer/workflow-monitor.js (실행 상태 표시)
````

### 3.3 구현 로드맵

**Phase 1 — Core Engine (MVP, ~2주)**

*   Hidden `BrowserWindow` + `BackgroundViewPool` 구현
*   순차 실행 (single step) 검증
*   응답 완료 감지 (3단계 전략)
*   하드코딩된 워크플로우로 E2E 테스트

**Phase 2 — UI + 반자동화 (~2주)**

*   워크플로우 빌더 모달 (CPB 패턴 활용)
*   실행 모니터 패널 (하단 상태바)
*   CAPTCHA/장애 시 Human Fallback
*   결과 표시 + 메인 입력창 연동

**Phase 3 — 고도화 (이후)**

*   병렬 실행 (`type: 'parallel'`)
*   조건부 분기 (if/else)
*   Evidence Bundle + 감사 로그
*   서비스별 파티션 분리 옵션
*   (필요시) Playwright sidecar 전환 검토

* * *

## 4\. 리스크 매트릭스 (전체 리뷰 통합)

| 리스크 | 심각도 | 발생 가능성 | 완화 전략 |
| --- | --- | --- | --- |
| 서비스 약관 위반/계정 차단 | 🔴 높음 | 중간 | 일일 실행 횟수 제한, 사용자 동의 플로우, 장기적으로 공식 API 전환 |
| CAPTCHA 발생 | 🟡 중간 | 높음 | Human Fallback (일시중지→사용자 해결→재개) |
| 동시 세션 탐지 | 🟡 중간 | 중간 | 서비스별 파티션 분리 옵션, 동시 요청 간격 확보 |
| 메모리 과다 사용 | 🟡 중간 | 중간 | 동시 2뷰 제한, 즉시 해제, 1280x800 최소 viewport |
| DOM 셀렉터 변경 | 🟡 중간 | 높음 | 기존 selectors.json 업데이트 체계 + 추출 실패 시 사용자 알림 |
| 응답 완료 미감지 | 🟡 중간 | 낮음 | 3단계 감지 전략 + 120초 타임아웃 |
| 앱 성능 저하 | 🟢 낮음 | 낮음 | bgWindow 분리로 mainWindow 영향 최소화 |

* * *

## 5\. 각 리뷰 의견의 채택/불채택 정리

| 의견 | 출처 | 채택 여부 | 이유 |
| --- | --- | --- | --- |
| Hidden BrowserWindow 분리 | Review 1, Service A | ✅ 채택 | 기존 레이아웃 로직과 완전 분리 |
| 동일 파티션 기본 + 별도 파티션 옵션 | 통합 판단 | ✅ 채택 | 편의성과 안전성 절충 |
| Playwright sidecar | Service A | ❌ 현시점 불채택 | 기존 인프라 활용도가 높고 배포 크기 증가, Phase 3 검토 |
| backgroundThrottling: false 필수 | Service A, E | ✅ 채택 | 기능 전제조건 |
| CAPTCHA Human Fallback | Service A | ✅ 채택 | 현실적 필수 요소 |
| Evidence Bundle/감사 로그 | Service A | ✅ Phase 3 채택 | 팩트체크 신뢰성 강화 |
| Task Graph + 상태 머신 | Service A | ✅ 설계 반영 | StepRunner에 상태 관리 내장 |
| WebContentsView 전환 | Service A | ❌ 현시점 불채택 | 앱 전체 마이그레이션과 동시 진행이 합리적 |
| Off-screen 좌표 (-1000,-1000) | Service C | ❌ 불채택 | Hidden Window가 더 깔끔 |
| Puppeteer debugger 연동 | Service E | 🔄 참고만 | 특수 케이스에서 유용할 수 있으나 기본 구현에는 불필요 |
| 공식 API 장기 전환 | Service A | ✅ 로드맵 반영 | BWE의 서비스 추상화 레이어 설계 시 고려 |

* * *

**최종 요약:** 현재 MAPB 코드베이스에서 `Hidden BrowserWindow` + 기존 `inject-prompt`/`extractLastResponse` 재사용 + `backgroundThrottling: false` + CAPTCHA Human Fallback 조합으로 구현하는 것이 가장 현실적이고 효과적인 접근입니다. Phase 1 MVP는 기존 코드 ~50줄 수정 + 신규 모듈 2~3개로 달성 가능합니다.

---

# Service C

제시해주신 기술 검토 의견들과 기존 코드베이스, 그리고 BWE(Background Workflow Engine) 설계 문서를 종합적으로 분석하여, 중복된 내용을 제외하고 **기술적 사각지대 및 실질적인 구현 방안**을 면밀히 재검토하여 정리해 드립니다.

* * *

### 1\. 최종 구현 가능성: **매우 높음 (Highly Feasible)**

현재 'Sync Multi Chat'의 구조는 이미 `BrowserView`와 `Session Partition`을 기반으로 설계되어 있어, 백그라운드 워크플로우를 추가하는 데 최적의 조건을 갖추고 있습니다. 기술 검토 의견들에서 공통적으로 언급하듯, 사용자에게 보이지 않는 뷰를 통해 기존 세션을 공유하며 자동화를 수행하는 것은 즉시 구현 가능한 수준입니다.

* * *

### 2\. 기술적 재검토 및 추가 고려 사항 (Deep Dive)

단순히 "보이지 않는 웹뷰를 띄운다"를 넘어, 실제 운영 시 발생할 수 있는 병목과 리스크를 기반으로 한 심층 검토 결과입니다.

#### ① 세션 동시성 및 레이스 컨디션 (Session Concurrency)

*   **문제**: 동일한 `persist:service-{name}` 파티션을 공유할 때, 사용자가 포그라운드에서 채팅 중인데 백그라운드 엔진이 동일 서비스(예: Service A)에 동시에 요청을 보내면 세션 충돌이나 "이미 다른 대화가 진행 중"이라는 에러가 발생할 수 있습니다.
    
*   **대책**: 서비스별로 **'실행 잠금(Execution Lock)'** 메커니즘이 필요합니다. 백그라운드 워크플로우가 구동될 때는 포그라운드 입력을 잠시 제한하거나, 반대로 사용자가 입력 중일 때는 백그라운드 큐를 대기시키는 스케줄링 로직이 필수적입니다.
    

#### ② 백그라운드 스로틀링 (Background Throttling)

*   **문제**: Electron/Chromium은 리소스 절약을 위해 보이지 않는 탭이나 뷰의 JS 실행 속도를 늦춥니다. 이로 인해 응답 완료 감지가 늦어지거나 타임아웃이 발생할 수 있습니다.
    
*   **대책**: 백그라운드용 `BrowserView` 생성 시 `webPreferences`에서 \*\*`backgroundThrottling: false`\*\*를 명시적으로 설정해야 합니다.
    

#### ③ 응답 완료 감지의 고도화 (Detection Strategy)

*   **문제**: 단순히 `did-finish-load` 이벤트는 페이지 로딩만 의미하며, AI의 '타이핑(Streaming)' 완료를 보장하지 않습니다.
    
*   **대책**:
    
    *   **이중 검증**: 서비스별 `selectors.json`에 정의된 '전송 버튼 활성화 상태'와 '마지막 응답 텍스트의 변화 멈춤(Stability check)'을 동시에 모니터링해야 합니다.
        
    *   **추출 실패 대응**: 백그라운드 뷰에서 캡차(CAPTCHA)나 로그인 만료 팝업이 뜰 경우, 이를 감지하여 즉시 사용자에게 해당 뷰를 포그라운드로 전환(Pop-up)시켜 해결하게 하는 'Human-in-the-loop' 구조가 필요합니다.
        

#### ④ 메모리 파편화 및 라이프사이클 관리

*   **문제**: 워크플로우마다 뷰를 생성하고 삭제하는 과정에서 Chromium 프로세스가 좀비처럼 남거나 메모리 누수가 발생할 수 있습니다.
    
*   **대책**: **'Background View Pool'** 방식을 권장합니다. 워크플로우 시작 시 최대 N개의 뷰만 생성하고, 완료 후에는 `about:blank`로 이동시켜 메모리를 비운 뒤 다음 워크플로우를 위해 대기 상태로 둡니다.
    

* * *

### 3\. 최종 구현 방안 (Architecture Design)

#### A. 구조적 설계: **Dedicated Hidden Window 방식**

메인 윈도우(`mainWindow`)의 레이아웃 로직과 충돌하지 않도록, `show: false` 상태의 \*\*`workflowManagerWindow`\*\*를 별도로 생성하여 백그라운드 전용 `BrowserView`들을 관리합니다.

#### B. 핵심 모듈 구성

1.  **Workflow Engine (Main Process)**:
    
    *   `steps` 배열을 순회하며 각 단계의 서비스를 할당합니다.
        
    *   이전 단계의 `output`을 다음 단계 프롬프트의 `variable`로 치환합니다. (예: `{{RESEARCH_RESULT}}`)
        
2.  **Shared Session Manager**:
    
    *   포그라운드 서비스의 `partition` 정보를 백그라운드 뷰에 주입하여 별도 로그인 없이 세션을 즉시 상속합니다.
        
3.  **Stateful Extractor (Preload Script)**:
    
    *   `DOMObserver`를 사용하여 실시간으로 응답 텍스트를 스트리밍 수집하고, '완료' 상태가 되면 메인 프로세스로 최종 텍스트를 전달합니다.
        

#### C. 워크플로우 실행 흐름 (Sequence)

1.  **Trigger**: 사용자가 포그라운드 입력창에 특정 명령어(예: `/research [주제]`) 입력.
    
2.  **Step 1**: 백그라운드 Service E 뷰 생성 -> 주제 입력 -> 응답 수집 완료.
    
3.  **Step 2**: 수집된 데이터를 Service A와 Service B 뷰(병렬)에 주입 -> 팩트 체크 프롬프트 실행.
    
4.  **Step 3**: 두 응답을 취합하여 Service C 뷰에 전달 -> 요약 요청.
    
5.  **Completion**: 최종 결과물을 `mainWindow`로 전달하여 사용자에게 알림 및 출력.
    

* * *

### 4\. 구현 로드맵 (Phase)

*   **Phase 1 (기초)**: `BrowserView`를 숨긴 상태에서 수동으로 프롬프트를 주입하고 텍스트를 추출하는 `WorkflowRunner` 클래스 구현.
    
*   **Phase 2 (연쇄)**: JSON 기반 워크플로우 정의 파일(`workflow.json`)에 따라 순차적(Sequential) 실행 로직 구현.
    
*   **Phase 3 (지능형)**: 병렬(Parallel) 실행 처리 및 서비스별 '응답 완료' 상태를 판단하는 정밀 로직 강화.
    
*   **Phase 4 (안정화)**: 봇 탐지 회피를 위한 랜덤 타이핑 딜레이 적용 및 메모리 풀링 시스템 최적화.
    

### 5\. 결론 및 제언

제안하신 기능은 현재 앱의 아키텍처와 **100% 호환**됩니다. 특히 이미 `selectors.json`을 통해 서비스별 DOM 구조를 관리하고 계시므로, 이를 백그라운드용 모듈에서 임포트하여 사용하기만 하면 구현 난이도가 대폭 낮아집니다.

가장 먼저 착수하실 부분은 **`main.js`에서 백그라운드 전용 뷰를 생성하고, 기존의 `inject-prompt` IPC 통신이 해당 뷰에서도 정상 작동하는지 확인하는 PoC(개념 증명)** 단계입니다. 이후 세션 공유 여부만 확인되면 워크플로우 오케스트레이션은 순수 JS 로직의 영역이 될 것입니다.

---

# Service E

네, 기술 검토 의견과 다른 AI 응답(첨부 파일 포함)을 종합 재검토한 결과, Electron 앱에서 기존 UI 웹뷰를 유지하며 백그라운드에 숨겨진 추가 BrowserView로 워크플로우(Service E 조사 → Service A/Service B 팩트체크 → Service C 요약)를 동적으로 구동하는 것이 **완전히 가능**합니다. 중복(예: partition 공유, bounds 숨김)은 제거하고, Playwright 전환 제안 등 추가 관점을 반영해 리스크 중심으로 보강했습니다.paste-1771890127119.txt+1

## 최종 가능성

현재 Sync Multi Chat(MAPB) 아키텍처가 BrowserView, persist partition, inject-prompt/extract 로직을 이미 갖춰 확장이 용이합니다. 숨은 창/뷰로 완전 headless-like 동작 가능하며, UI 충돌 없이 사용자 채팅 유지. 단, B2C 서비스 봇탐지/ToS 위반 리스크로 **PoC 후 운영 정책 필요**.repomix-output-cccnam5158-sync-multi-chat-4.xml+1github​

## 구현 방안

**권장: 숨은 BrowserWindow + 전용 BrowserView 풀** (기존 코드 재사용 max). Playwright sidecar는 장기 대안(분리 안정성).paste-1771890127119.txt​

## 아키텍처 개요

| 컴포넌트 | 역할 | 기존 재사용 |
| --- | --- | --- |
| **Foreground Views** | 사용자 UI 채팅 (mainWindow) | 그대로 유지repomix-output-cccnam5158-sync-multi-chat-4.xml​ |
| **BackgroundViewPool** | 서비스별 숨김 BrowserView 생성/재사용 (bounds: {x:0,y:0,w:0,h:0}, backgroundThrottling: false) | createServiceView 확장paste-1771890127119.txt​ |
| **WorkflowManager** | 스텝 체인 실행 (single/parallel), 템플릿 resolve, 응답 대기paste-1771890127119.txt​ |  |
| **Renderer UI** | 워크플로우 빌더/모니터 (CPB 확장, progress IPC)paste-1771890127119.txt​ |  |

## 워크플로우 예시 (JSON 스키마)

`{   "name": "Deep Research",  "steps": [    {"id": "step1", "type": "single", "service": "Service E", "prompt": "{{userquery}} 최신 자료 조사", "outputVar": "research"},    {"id": "step2", "type": "parallel", "services": ["Service A", "Service B"], "prompt": "팩트체크: {{research}}", "outputVar": "facts"},    {"id": "step3", "type": "single", "service": "Service C", "prompt": "요약: {{research}} + {{facts}}", "outputVar": "summary"}  ] }`

IPC: `workflow-execute`로 main에서 실행, `workflow-progress`로 renderer에 실시간 피드백.paste-1771890127119.txt​

## 단계별 구현 로드맵

1.  **Core Engine (1주)**: BackgroundViewPool (acquire/release), WorkflowManager (executeStep with waitForStableResponse: stability polling + streaming 체크).paste-1771890127119.txt​
    
2.  **Integration (3일)**: main.js에 import, IPC 핸들러 추가 (workflow-execute 등). selectorsConfig 재사용.repomix-output-cccnam5158-sync-multi-chat-4.xml+1
    
3.  **UI (1주)**: renderer에 Workflow Builder (CPB 확장), Monitor 패널 (진행률/취소).paste-1771890127119.txt​
    
4.  **Advanced (옵션)**: 병렬 스텝 지연, 재시도, 결과 저장 (electron-store).paste-1771890127119.txt​
    

## 추가 고려사항

*   **성능/안정**: 뷰 풀 max 4개, 스텝 후 release. stableCount=3으로 응답 완료 (content hash 동일).github​paste-1771890127119.txt​
    
*   **탐지 회피**: human-like typing (기존), 랜덤 딜레이(2-5s), stealth UA. partition bg-접두사로 세션 분리 옵션.repomix-output-cccnam5158-sync-multi-chat-4.xml+1
    
*   **리스크 관리**:
    
    | 리스크 | 대응 |
    | --- | --- |
    | Rate limit/CAPTCHA | 스텝 딜레이, CAPTCHA selector 체크 → 사용자 알림github​ |
    | ToS 위반 | 사용자 동의 토글, 로그 저장 (audit trail)paste-1771890127119.txt​ |
    | DOM 변경 | selectors.json 버전링, fallback promptrepomix-output-cccnam5158-sync-multi-chat-4.xml​ |
    | 메모리 | destroy() + clearCache(), offscreen 캡처 테스트electronjs​ |
    
*   **마이그레이션**: WebContentsView(deprecated 아님, BrowserView 유지 가능). Playwright 전환 시 worker 프로세스 분리 (장기).paste-1771890127119.txt​
    

이 설계로 **사용자 인지 없이 백그라운드 워크플로우** 구현. 실제 코드 삽입 필요 시 main.js 위치 지정해 주세요!repomix-output-cccnam5158-sync-multi-chat-4.xml+1

---

