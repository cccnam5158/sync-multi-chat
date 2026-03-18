# Gemini 웹뷰 유휴 시 세션 유지용 새로고침 — 구현 방안

> 작성일: 2026-03-11  
> 목적: 웹뷰에서 채팅 요청/응답이 진행 중이 아니고 앱을 사용하지 않을 때, Gemini 웹뷰를 주기적으로 새로고침하여 세션 끊김을 완화하는 방안 정리 및 SRS 반영

---

## 1. 배경 및 문제

- **현상**: Gemini가 계속 로그인이 풀리는 현상이 있음.
- **원인 요약** (Gemini 정책 조사 참고):
  - 계정 유형별 세션 유지 시간 차이 (개인 14일, 워크스페이스 1~24시간 등).
  - OAuth 액세스/리프레시 토큰 갱신 실패 시 세션 종료.
  - **비활성 세션 제어(Inactivity Timeout)**: 일정 시간 조작이 없으면 로그아웃.
  - 브라우저/앱의 메모리 절약·탭 비활성화로 인한 연결 끊김 가능성.
- **사용자 기대**: “웹뷰에서 챗 요청/응답이 진행되고 있지 않고 앱을 사용하지 않을 때, 웹뷰를 새로고침해서 세션을 유지하고 싶다.”

---

## 2. 목표

- **유휴(idle) 조건**에서만 Gemini 웹뷰를 **주기적으로 새로고침**하여, 서버/클라이언트 측 비활성 타임아웃으로 인한 세션 끊김을 완화한다.
- 채팅 중(요청/응답 진행 중)에는 새로고침하지 않아 사용 중인 대화를 방해하지 않는다.

---

## 3. 정의

| 용어 | 설명 |
|------|------|
| **유휴(idle)** | (1) 최근 N분 이내에 프롬프트 전송이 없고, (2) 사용자가 해당 서비스 웹뷰를 수동 새로고침한 직후가 아닌 상태. |
| **Gemini 웹뷰** | Multi AI 모드의 Gemini BrowserView, 또는 Single AI 모드에서 서비스가 Gemini인 인스턴스들의 BrowserView. |
| **세션 유지용 새로고침** | 유휴일 때 해당 웹뷰의 `webContents.reload()`를 호출하여 페이지를 다시 로드하는 동작. (기존 “Reload” 버튼과 동일한 동작, 트리거만 자동·조건부.) |

---

## 4. 구현 방안 요약

- **위치**: Main 프로세스(`src/main/main.js`). 기존 `getGeminiKeepAliveTargets()`·`reload-service`/`reload-instance` 로직과 연동.
- **추적 정보**:
  - **마지막 프롬프트 전송 시각**  
    - `send-prompt` / `send-prompt-to-instances` 수신 시, 대상에 Gemini가 포함되어 있으면 해당 시각을 갱신.
  - (선택) **마지막 수동 새로고침 시각**  
    - `reload-service`/`reload-instance`에서 Gemini인 경우 갱신 시, 유휴 판단 시 “방금 새로고침함”으로 스킵 가능.
- **트리거**:
  - **주기 타이머** (예: 10~15분 간격)에서:
    - 현재 시각 − 마지막 프롬프트 전송 시각 ≥ **유휴 임계값** (예: 10분)이면 “유휴”로 간주.
    - Gemini 대상 목록이 1개 이상이면, 각 `webContents.reload()` 호출.
  - 채팅 중(방금 프롬프트 보냄)이면 이번 주기는 스킵.
- **기존 keep-alive와 관계**:
  - 기존 2분 주기 fetch keep-alive는 유지 (가벼운 네트워크 활동으로 세션 연장에 도움).
  - **유휴 새로고침**은 더 긴 주기(10~15분)로, “오랫동안 사용하지 않았을 때” 한 번씩 전체 페이지 리로드로 쿠키/토큰 컨텍스트를 갱신하는 보완 수단으로 둠.

---

## 5. 상세 설계

### 5.1 상태 변수 (main.js)

- `lastPromptSentAt`: `number | null` — 마지막으로 프롬프트를 보낸 시각 (Date.now()).  
  - 앱 시작 시 `null`.  
  - `send-prompt` / `send-prompt-to-instances`에서 **대상에 Gemini가 포함될 때만** `lastPromptSentAt = Date.now()`로 갱신.
- (선택) `lastGeminiManualReloadAt`: `number | null` — Gemini에 대한 마지막 수동 Reload 시각.  
  - 있으면 “유휴 새로고침” 직후 또는 사용자 Reload 직후 N분 간은 자동 새로고침 스킵에 활용 가능.

### 5.2 유휴 임계값 및 새로고침 주기

- **유휴 임계값 (IDLE_THRESHOLD_MS)**:  
  - “이 시간 동안 프롬프트를 보내지 않았으면 유휴로 본다.”  
  - 제안: **10분** (600_000 ms). 설정 가능 상수로 두어 나중에 설정 UI/설정 파일로 노출 가능.
- **새로고침 체크 주기 (GEMINI_IDLE_REFRESH_CHECK_MS)**:  
  - “이 주기마다 ‘유휴이면 새로고침’을 판단한다.”  
  - 제안: **10분** (600_000 ms).  
  - 즉, 10분마다 “지난 10분간 프롬프트 없음 → Gemini 웹뷰 있음 → reload” 실행.

### 5.3 알고리즘 (주기 타이머 콜백)

1. `getGeminiKeepAliveTargets()`로 현재 Gemini 웹뷰 목록 획득.
2. 목록이 비어 있으면 return.
3. `lastPromptSentAt == null` 이면 “아직 한 번도 보내지 않음” → 유휴로 간주 가능.  
   `lastPromptSentAt != null` 이면 `(Date.now() - lastPromptSentAt) >= IDLE_THRESHOLD_MS`일 때만 유휴.
4. 유휴가 아니면 return.
5. (선택) `lastGeminiManualReloadAt`이 있고 `(Date.now() - lastGeminiManualReloadAt) < IDLE_THRESHOLD_MS` 이면 return (방금 새로고침한 경우 스킵).
6. 각 target에 대해 `webContents.reload()` 호출.
7. (선택) 이번에 새로고침했음을 기록해 직후 주기에서 중복 스킵할지 결정.

### 5.4 프롬프트 전송 시 갱신 위치

- **ipcMain.on('send-prompt', ...)**  
  - `activeServices`에 `gemini`이 포함되어 있으면 `lastPromptSentAt = Date.now()`.
- **ipcMain.on('send-prompt-to-instances', ...)**  
  - `singleAiService === 'gemini'`이면 (또는 instanceKeys 중 Gemini 인스턴스가 있으면) `lastPromptSentAt = Date.now()`.

### 5.5 수동 Reload 시 갱신 (선택)

- **ipcMain.on('reload-service', (event, service))**  
  - `service === 'gemini'`이면 `lastGeminiManualReloadAt = Date.now()`.
- **ipcMain.on('reload-instance', (event, instanceKey))**  
  - 해당 인스턴스가 Gemini이면 `lastGeminiManualReloadAt = Date.now()`.

### 5.6 타이머 생명주기

- **시작**: 기존 `startGeminiKeepAlive()`가 호출되는 시점(뷰 표시 시)에, **Gemini 유휴 새로고침용 setInterval**도 함께 시작.
- **정지**: 윈도우 종료·앱 종료 시 기존 keep-alive 타이머 정리하는 곳에서 이 타이머도 clearInterval.

---

## 6. 비기능 고려

- **UX**: 채팅 중에는 새로고침하지 않으므로 응답 도중 페이지가 바뀌는 일을 피함.
- **성능**: 10분 주기·유휴일 때만 동작하므로 부하는 제한적.
- **설정**: 초기에는 상수로 두고, 필요 시 electron-store 등으로 “유휴 새로고침 사용 여부”·“유휴 임계 시간(분)”을 옵션으로 노출 가능.

---

## 7. 테스트 제안

- 유휴 임계 시간(10분) 동안 프롬프트를 보내지 않은 뒤, Gemini만 켜 두고 10분 경과 후 해당 웹뷰가 한 번 자동 새로고침되는지 확인.
- 10분 이내에 프롬프트를 보낸 경우, 같은 10분 주기에서 새로고침이 실행되지 않는지 확인.
- Multi AI에서 Gemini 비활성 시, 유휴 새로고침 타이머는 돌아가지만 대상이 0개이므로 reload가 호출되지 않는지 확인.
- Single AI 모드에서 서비스가 Gemini일 때, 인스턴스들이 유휴 조건에서 새로고침되는지 확인.

---

## 8. SRS 반영 요약

- **신규 요구사항**:  
  - “When Gemini webview(s) are present and the application has been idle (no prompt sent for a configurable period), the system shall periodically refresh the Gemini webview(s) to help maintain session, provided no chat request/response is in progress.”
- **용어**: “Idle” = no prompt sent within the configured idle threshold.  
- **구현**: Main 프로세스에서 `lastPromptSentAt` 추적, 주기 타이머, `getGeminiKeepAliveTargets()` + `webContents.reload()`.

이 방안을 기준으로 `spec/Multi-AI-Chat-SRS-Unified.md`에 요구사항을 추가한 뒤 구현을 진행한다.

---

## 9. 응답 진행 중 감지 (DOM 기반) — 보강 구현

- **Send 버튼**: `mat-icon` with `data-mat-icon-name="send"` / `fonticon="send"` (프롬프트 입력 시 노출).
- **Stop 버튼**: `mat-icon` with `data-mat-icon-name="stop"` / `fonticon="stop"` (응답 진행 중 중단 아이콘). Stop 아이콘이 보이면 “응답 진행 중”으로 간주하고 idle refresh를 해당 웹뷰에 대해 스킵한다.
- **구현 위치**: `service-preload.js`에서 2.5초 주기로 위 선택자로 Stop 노출 여부를 확인하고, main에 `gemini-response-in-progress` IPC로 전달. main은 `geminiIdleRefreshTick()`에서 해당 webContents는 reload 하지 않음.

### 9.1 Gemini 팀이 DOM을 변경했을 때의 대안

1. **Fallback 1**: `aria-label`에 "Stop"/"중단" 포함된 버튼 검사 (현재 구현에 포함).
2. **Fallback 2**: `stopSelectors` 배열에 새 선택자 추가 (예: `[data-testid*="stop"]`, `.stop-button`).
3. **Fallback 3**: Send 버튼 disabled + 채팅 영역 `aria-busy` 또는 로딩 스피너로 “응답 중” 추론.
4. **Fallback 4**: main의 `selectorsConfig.gemini`에 `responseInProgressSelector`를 두고, 설정/JSON으로 선택자를 주입.
5. **Fallback 5**: DOM 없이 “마지막 프롬프트 후 N분 이내는 refresh 스킵”만 사용 (정확도는 낮음).
