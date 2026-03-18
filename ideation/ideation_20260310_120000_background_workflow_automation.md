# 백그라운드 워크플로우 자동화 아이데이션 (기술 검토 통합)

> 작성일: 2026-03-10  
> 대상: Electron 앱(Sync Multi Chat)에서 포그라운드 웹뷰 채팅을 유지한 채, 백그라운드에서 다중 AI 워크플로우(조사 → 팩트체크 → 요약)를 비가시적으로 구동하는 기능  
> 출처: feat_workflow_automation_poc 하위 논의 및 다중 AI 기술 검토 결과 통합

---

## 1. 목적과 범위

### 1.1 목적

- **요구사항 요약**: 여러 B2C 웹 기반 AI 서비스(Service A/B/C/E 등)를 웹뷰로 쓰는 Electron 앱에서, 사용자가 보는 웹뷰는 그대로 두고 **백그라운드에서만** “headless-like” 웹뷰를 띄워 특정 워크플로우를 자동 실행하고자 함.
- **예시 워크플로우**: Service E로 최신 자료 조사 → 해당 응답을 Service A·B에 넘겨 팩트체크 → 두 응답을 취합해 Service C에 요약 요청 → 최종 결과만 사용자에게 전달.
- **제약**: 사용자는 기존 웹뷰로 정상 채팅 가능해야 하며, 워크플로우는 사용자가 인지하지 못하는 백그라운드에서만 구동.

### 1.2 범위

- **포함**: 구현 가능성 판정, 권장 아키텍처(숨은 창/뷰 풀), 세션·파티션 전략, 응답 완료 감지, 취소/에러 처리, 리스크 및 완화, 구현 로드맵, 기존 코드 영향.
- **제외**: 실제 코드 구현, B2C 서비스별 selector·URL 상세, 상용 배포 후 운영 정책 최종안.

---

## 2. 최종 구현 가능성 판정

**결론: 기술적으로 충분히 가능하며, 현재 MAPB(Sync Multi Chat) 아키텍처가 핵심 인프라를 이미 갖춰 확장이 자연스럽다.**

- Electron에서 “완전 headless”는 아니나, **숨은 BrowserWindow** 또는 **비가시 BrowserView**(bounds 0x0 등)로 백그라운드 워크플로우 구현이 가능하다.
- 기존 구조가 서비스별 파티션(`persist:service-*`), 프롬프트 주입, 응답 추출, 셀렉터 관리, 크로스체크 패턴을 갖추고 있어 **확장 비용이 낮다.**
- 다만 **기술적 가능성과 운영 안정성은 별개**이므로, 세션 충돌·탐지·응답 완료 감지·취소·오류 복구를 반영해야 상용 품질에 근접한다.

---

## 3. 기술 검토 통합 (합의 및 추가 고려 사항)

### 3.1 핵심 합의 사항 (전원 동의, 중복 제거)

- **숨겨진 BrowserView/Window로 headless-like 구현 가능** — 화면에 표시하지 않아도 JS 실행·DOM 조작은 정상 동작.
- **`persist:service-{name}` 파티션 공유로 별도 로그인 불필요** — 동일 파티션 사용 시 포그라운드 쿠키/세션 공유.
- **기존 인프라 재사용** — `inject-prompt`, `extractContentFromService()`/`extractLastResponseFromService()`, `selectorsConfig`, anti-detection 메커니즘 재활용.
- **응답 완료 감지가 핵심 과제** — 스트리밍 인디케이터 + content stability polling 조합 필요.
- **봇 탐지/Rate Limit 회피 필수** — 스텝 간 딜레이, 동시 실행 제한.
- **메모리 관리** — 스텝 완료 즉시 뷰 해제, 동시 활성 뷰 수 제한.

### 3.2 추가 고려 사항 (기존안 보강)

#### 3.2.1 숨김 방식: Hidden BrowserWindow 권장

- **방식 A(권장)**: `show: false`인 별도 `BrowserWindow`에 워크플로 전용 `BrowserView`만 부착. mainWindow와 완전 분리되어 레이아웃/모드 전환(`switchToSingleAiMode` 등)과 충돌하지 않음.
- **방식 B**: mainWindow에 워크플로 뷰를 두고 `setBounds(0,0,0,0)`로 숨김. 창 하나로 관리 가능하나, 기존 뷰 맵/레이아웃 로직과 분리해 별도 `workflowViews` 맵으로 관리해야 함.
- **권장**: 사용자 인지 없이 안전하게 하려면 **방식 A(숨은 창)** 가 더 안전하다.

#### 3.2.2 세션(파티션) 전략

- **기본**: 동일 파티션 공유(사용자 편의).
- **폴백**: 서비스별로 동시 세션 탐지·rate limit 이슈가 있으면 별도 파티션(`persist:bg-service-{name}`) 전환 옵션을 두고, 파티션 이름은 설정으로 관리.
- **서비스별 정책 예시**:  
  - shared(동일 파티션), isolated(별도 파티션), shared but serialized(동일 파티션 + 해당 서비스 동시 실행 금지/큐 직렬화).

#### 3.2.3 `backgroundThrottling: false` 필수

- Chromium은 보이지 않는 페이지의 타이머/렌더링을 스로틀링한다. 숨겨진 웹뷰에서 응답 완료 감지 로직이 정상 동작하려면 **`webPreferences.backgroundThrottling: false`** 를 명시해야 한다.

#### 3.2.4 응답 완료 감지

- **1단계**: 스트리밍 인디케이터 소멸(서비스별 selector).
- **2단계**: Content stability — 일정 간격 DOM content 해시 비교, N회 연속 동일 시 완료 판정.
- **3단계**: Network idle 보조(선택).
- **타임아웃**: 120초 등 서비스별 조정 가능.
- **추가**: 사용자 취소(`workflow:cancel`), 에러/로그인 리다이렉트·CAPTCHA 감지 시 “완료 대기”가 아닌 “실패/재인증 필요” 처리.

#### 3.2.5 CAPTCHA/장애 시 Human Fallback

- CAPTCHA·로그인 만료 감지 시 워크플로 일시 중지 → 사용자 알림 → 포그라운드에서 해결 후 “계속”으로 재개. 반자동(semi-automated) 접근이 현실적이다.

#### 3.2.6 Playwright Sidecar

- 일부 검토에서 “Electron 외부 Playwright 워커”를 권장했으나, **현 시점**에는 기존 코드 재사용·세션 공유·배포 크기 관점에서 **Electron 내부 숨은 창**으로 Phase 1 구현을 권장. Phase 3 이후 안정성/확장성 한계 시 Playwright sidecar 전환을 검토하되, 인터페이스만 추상화해 두는 것이 좋다.

---

## 4. 권장 구현 방안

### 4.1 아키텍처 개요

- **Foreground**: 기존 mainWindow + 기존 BrowserView들 유지.
- **Background**: `workflowWindow`(또는 `bgWindow`) — `show: false`, 이 창에만 워크플로 전용 BrowserView 부착. `workflowViews` 맵으로 관리, `views`/`singleModeViews`와 분리.
- **Main Process**: WorkflowEngine — ViewPool(acquire/release, 동시 2개 제한 등), StepRunner(순차/병렬, 템플릿 치환, 완료 감지, CAPTCHA fallback), ResultStore(evidence bundle·로그).

### 4.2 핵심 모듈

- **BackgroundViewPool**: 서비스별 숨김 BrowserView 생성/재사용, `backgroundThrottling: false`, 동일 또는 별도 파티션 설정 반영.
- **WorkflowManager / StepRunner**: steps 순회, 이전 단계 output을 다음 단계 프롬프트 변수(예: `{{RESEARCH_RESULT}}`)로 치환, 취소 토큰·실패 분류(TIMEOUT, AUTH_REQUIRED, CAPTCHA, SELECTOR_BROKEN, RATE_LIMIT) 지원.
- **ResultStore**: 단계별 결과 스키마 표준화(stepId, service, inputPrompt, outputText, capturedAt, normalizedText 등), 병렬 스텝은 `normalizedText`로 다음 스텝에 전달.

### 4.3 기존 코드 영향 범위

- **변경 없음**: service-preload.js, selectors.json, renderer(포그라운드 UI), 기존 BrowserView 생성/관리, cross-check·copy-chat-thread 등.
- **최소 수정**: main.js — bgWindow 생성, WorkflowEngine import·초기화, IPC 핸들러 등록, app close 시 bgWindow 정리. 약 50줄 내외.
- **신규 모듈**: workflow-engine.js(ViewPool + StepRunner), workflow-store.js(정의 저장/로드), (Phase 2) workflow-builder.js, workflow-monitor.js.

### 4.4 스텝 결과 스키마 (단일/병렬 통일)

- `single`/`parallel` 모두 **normalizedText** 등 공통 필드로 다음 스텝 템플릿에 전달.  
  예: `parallel` 결과는 `results.map(...).join("\n\n")` 형태로 normalizedText 생성.

---

## 5. 리스크 및 완화

| 리스크 | 심각도 | 완화 전략 |
|--------|--------|-----------|
| 서비스 약관 위반/계정 차단 | 높음 | 일일 실행 횟수 제한, 사용자 동의 플로우, 장기적으로 공식 API 전환 검토 |
| CAPTCHA 발생 | 중간 | Human Fallback(일시중지 → 사용자 해결 → 재개) |
| 동시 세션 탐지 | 중간 | 서비스별 파티션 분리 옵션, 동시 요청 간격 확보, serialized 정책 |
| 메모리 과다 사용 | 중간 | 동시 2뷰 제한, 스텝 완료 즉시 해제, viewport 1280x800 등 최소 크기 |
| DOM 셀렉터 변경 | 중간 | selectors.json 업데이트 체계, 추출 실패 시 사용자 알림, selector 버전/폴백 |
| 응답 완료 미감지 | 중간 | 3단계 감지 전략 + 타임아웃 |
| 앱 성능 저하 | 낮음 | bgWindow 분리로 mainWindow 영향 최소화 |

---

## 6. 구현 로드맵

- **Phase 1 — 엔진 MVP**: 숨은 workflowWindow 생성, BackgroundViewPool, 순차(single) 실행, 응답 완료 감지(3단계), 취소 토큰, 하드코딩 워크플로우로 E2E 검증.
- **Phase 2 — UI + 반자동화**: 워크플로우 빌더 모달(CPB 패턴 활용), 실행 모니터 패널(진행률/취소), CAPTCHA/장애 Human Fallback, 결과 표시 및 메인 입력창 연동.
- **Phase 3 — 고도화**: 병렬 실행(`type: 'parallel'`), 조건부 분기, Evidence Bundle·감사 로그, 서비스별 파티션 분리 옵션, (필요 시) Playwright sidecar 전환 검토.

---

## 7. 결론 및 다음 단계

- **구현 가능성**: 높음. Hidden BrowserWindow + 기존 inject-prompt/extractContent 재사용 + `backgroundThrottling: false` + CAPTCHA Human Fallback 조합이 현실적이다.
- **Phase 1 MVP**: 기존 코드 약 50줄 수정 + 신규 모듈 2~3개로 목표 달성 가능.
- **다음 단계**: main.js에서 백그라운드 전용 뷰를 생성하고, 기존 inject-prompt IPC가 해당 뷰의 webContents에서도 동작하는지 확인하는 **PoC** 후, 워크플로우 정의(JSON)·IPC 시그니처·상태 머신을 설계하여 단계별 구현에 착수한다.

본 문서는 아이데이션 및 기술 검토 통합 단계이며, 구현 착수 전에는 기능/상태/IPC 경계를 포함한 상세 spec 정리가 필요하다.
