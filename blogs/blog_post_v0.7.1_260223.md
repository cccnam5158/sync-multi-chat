# Sync Multi Chat v0.7.1: 버그 수정 및 Gemini 세션 keep-alive

**작성일**: 2026-02-23  
**버전**: v0.7.1

**Sync Multi Chat** v0.7.1은 v0.7.0 이후 사용자 피드백을 반영한 **버그 수정**과 **Gemini 세션 유지 개선**이 중심입니다.  
메인 프롬프트 미리보기에서 `{{last_response}}` / `{{chat_thread}}` 가 잘려 보이던 문제, Anonymous 토글과 변수 치환·프리뷰 동기화, 전송 후 확대 영역 자동 접기, 그리고 앱을 한동안 켜 두었을 때 Gemini 로그인이 풀리던 현상 완화를 다룹니다.

---

## 🔧 수정된 버그

### 1. 미리보기에서 변수가 잘려 보이던 문제 (`{{last` 만 표시)

**증상**: 메인 프롬프트 입력 영역이나 인라인 미리보기에서 `{{last_response}}`, `{{chat_thread}}` 를 넣으면, 치환된 값 대신 `{{last` 처럼 **변수 이름이 잘린 채** 표시되던 현상.

**원인**: 미리보기 HTML을 만들 때 변수 자리를 임시 플레이스홀더(예: `%%MI_VAR_1%%`)로 바꾼 뒤 **마크다운 파서(marked)** 로 처리하는데, 마크다운에서 `_` 가 이탤릭 구문으로 해석되면서 `_VAR_` 부분이 `<em>` 태그로 바뀌어 플레이스홀더가 깨졌습니다. 그 결과 플레이스홀더 치환이 제대로 되지 않아 `{{last_response}}` 가 온전히 치환되지 않고 잘린 것처럼 보였습니다.

**수정**:
- 플레이스홀더 형식을 **언더스코어 없이** `%%MIVAR0%%`, `%%MIVAR1%%` 형태로 변경.
- 마크다운 파서에 **플레이스홀더가 들어간 문자열 전체**를 넘기지 않고, **플레이스홀더로 split → 플레이스홀더가 아닌 구간만** marked 로 파싱한 뒤 다시 합치도록 변경.  
  → 마크다운이 변수 자리를 건드리지 않아 `{{last_response}}`, `{{chat_thread}}` 가 항상 올바른 값으로 렌더링됩니다.

---

### 2. Anonymous 토글 ON인데 웹뷰에는 서비스명(chatgpt 등)이 그대로 보이던 문제

**증상**: Anonymous 토글을 **ON** 으로 둔 상태에서 메인 입력창에 `{{last_response}}` 또는 `{{chat_thread}}` 를 넣고 전송하면, 각 AI 웹뷰의 프롬프트 입력창에 붙여 넣어지는 JSON 안에 **chatgpt, claude, gemini** 같은 서비스 이름이 그대로 들어가던 문제.  
(반면 메인 화면의 "Copy Chat Thread", "Copy Last Response" 버튼으로 복사할 때는 Anonymous 가 정상 적용되고 있었음.)

**원인**: 변수 치환과 프리뷰에 사용하는 **익명 모드** 값을 Custom Prompt Builder(CPB)가 **Custom Prompt 버튼을 눌렀을 때만** 갱신하고 있어서, 메인 입력창에서만 `{{last_response}}` / `{{chat_thread}}` 를 쓰고 전송할 때는 **예전 익명 상태**(또는 false)가 사용되고 있었습니다.

**수정**:
- **getAnonymousModeForCPB()** 가 실제 UI 상태를 보도록 변경: `#anonymous-btn.active` 여부를 우선 사용하고, 없을 때만 기존 `window._cpb_isAnonymousMode` 사용.
- **Anonymous 토글을 바꿀 때마다** `window._cpb_isAnonymousMode` 를 동기화하고 `smc:anonymous-mode-changed` 이벤트를 발생시켜, **메인 인라인 프리뷰·마스터 프리뷰·Session Custom Prompt Builder·CPB 프리뷰**가 모두 Anonymous 에 맞게 실시간 갱신되도록 함.
- 세션 복원 후에도 `_cpb_isAnonymousMode` 가 현재 Anonymous 상태와 맞도록 한 번 더 동기화.

이제 Anonymous ON 일 때 메인 입력에서 보내는 `{{last_response}}` / `{{chat_thread}}` 치환 결과와 모든 프리뷰가 **Service A/B/C** 형태로 일관되게 표시됩니다.

---

### 3. 확대된 프롬프트 영역이 전송 후에도 그대로 남아 있던 문제

**증상**: "Expand prompt area" 로 메인 프롬프트 입력 영역을 **확대(풀스크린)** 한 상태에서 **Send** 또는 **Ctrl+Enter** 로 전송해도, 영역이 접히지 않아 AI 응답을 보려면 수동으로 다시 접어야 했습니다.

**수정**:
- **sendPrompt()** 실행이 끝날 때(실제 전송이 일어난 경로) `smc:collapse-prompt-expanded` 커스텀 이벤트를 한 번 발생시키도록 함.
- **Expand/Collapse 버튼** 쪽에서 이 이벤트를 받으면 `applyExpandedState(false)` 를 호출해 확대 상태를 해제.

그래서 확대된 상태에서 전송하면 **자동으로 접혀서** 바로 AI 응답을 볼 수 있습니다.

---

## ⬆️ 개선: Gemini 세션 keep-alive

**증상**: 앱을 **10분 이상** 사용하지 않고 두었다가 다시 쓰려고 하면, **Gemini** 쪽만 로그인이 풀려 있는 것처럼 보이는 경우가 있었습니다.

**원인 (이전 검토 요약)**:
- 앱이 쿠키를 지우는 코드는 없고, `clearGeminiRuntimeCaches()` 도 serviceworkers/cachestorage 만 비웁니다.
- 가능한 원인은 **Google 세션 쿠키**(`__Secure-1PSID` 등)의 **만료** 또는 **유휴( idle ) 기반** 세션 종료로 보는 것이 타당합니다.

**개선 내용**:
- **5분 간격** 으로, Gemini 웹뷰가 `gemini.google.com` 에 있고 로그인 페이지가 아닐 때만, 웹뷰 안에서 **같은 오리진으로 HEAD 요청** 한 번을 보내는 **keep-alive** 를 추가했습니다.
- `credentials: 'same-origin'` 으로 쿠키가 포함되며, 서버 입장에서는 “활동 있는 세션”으로 볼 수 있어 **유휴 기반 로그아웃**을 완화하는 데 도움이 됩니다.
- 창을 닫을 때 keep-alive 타이머를 해제하도록 정리했습니다.

**참고**:  
- **토큰의 절대 만료 시간**(예: 발급 후 1시간)으로 끊기는 경우에는 keep-alive 만으로는 연장이 되지 않으며, 그때는 "Chrome으로 로그인" 등을 통해 재로그인하면 됩니다.  
- 디버깅이 필요하면 환경 변수 `SMC_GEMINI_LOGIN_DEBUG=1` 로 실행하면 로그인 감지/쿠키 동기화 시점을 콘솔에서 확인할 수 있습니다.

---

## 📋 버전별 변경 요약

| 구분 | 내용 |
|------|------|
| **버그 수정** | 미리보기 변수 렌더링 – `{{last_response}}` / `{{chat_thread}}` 잘림 현상 제거 (플레이스홀더 + 마크다운 처리 방식 변경) |
| **버그 수정** | Anonymous 토글과 변수 치환·프리뷰 동기화 – 메인/세션/CPB 모든 경로에서 익명 모드 실시간 반영 |
| **버그 수정** | 전송 후 확대된 프롬프트 영역 자동 접기 |
| **개선** | Gemini 세션 keep-alive (5분 간격 HEAD 요청으로 유휴 시 로그아웃 완화) |

---

## 🔄 업데이트 방법

### 기존 사용자 (v0.7.0 포함)
앱 시작 시 자동으로 업데이트 알림이 표시됩니다. **"지금 업데이트"** 버튼을 클릭하세요.

### 신규 사용자
[GitHub Releases](https://github.com/cccnam5158/sync-multi-chat/releases)에서 최신 인스톨러(v0.7.1)를 다운로드하세요.

---

**v0.7.1로 업데이트해서 미리보기·Anonymous·전송 후 접기 동작과 Gemini 세션 유지를 더 안정적으로 사용해 보세요.**

---

**TAGS**: Sync Multi Chat, v0.7.1, Bug Fix, Preview Variable, Anonymous Mode, Gemini Keep-Alive, Electron, AI Comparison
