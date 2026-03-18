# Gemini 세션 만료 분석 — 로그 출력 모드

Gemini 로그인이 30~40분 후 끊기는 원인을 분석할 때, 아래 환경 변수로 앱을 실행하면 keep-alive·idle refresh·로그인 상태 변화·쿠키 만료를 콘솔에 출력할 수 있습니다.

---

## 1. 로그 출력 모드로 기동하는 방법

### Windows (PowerShell)

```powershell
$env:SMC_GEMINI_SESSION_DEBUG="1"; npm start
```

세션 로그 + 쿠키 만료까지 모두 보려면:

```powershell
$env:SMC_GEMINI_SESSION_DEBUG="1"; $env:SMC_GEMINI_TOKEN_DEBUG="1"; npm start
```

### Windows (CMD)

```cmd
set SMC_GEMINI_SESSION_DEBUG=1 && npm start
```

### macOS / Linux

```bash
SMC_GEMINI_SESSION_DEBUG=1 npm start
```

쿠키 만료 로그까지:

```bash
SMC_GEMINI_SESSION_DEBUG=1 SMC_GEMINI_TOKEN_DEBUG=1 npm start
```

---

## 2. 환경 변수 설명

| 환경 변수 | 값 | 설명 |
|-----------|-----|------|
| **SMC_GEMINI_SESSION_DEBUG** | `1` 또는 `true` | 세션 관련 로그 출력. keep-alive 실행, idle refresh(reload) 실행, preload의 "로그인 안 됨" 보고 시점을 콘솔에 남김. |
| **SMC_GEMINI_TOKEN_DEBUG** | `1` 또는 `true` | Google 인증 쿠키의 만료 시각 로그. keep-alive 직후에 쿠키 만료가 연장됐는지 여부를 출력 (OAuth/세션 갱신 추정용). |

---

## 3. 출력되는 로그 예시

- `[gemini] Keep-alive tick targets= N`  
  → 2분(또는 설정된 주기)마다 keep-alive가 N개 웹뷰에 대해 실행됨.

- `[gemini] Idle refresh reload URL: https://gemini.google.com/app/...`  
  → 유휴 시간 경과 후 full reload가 실행된 URL.

- `[gemini] Idle refresh: reloaded N Gemini webview(s) (idle > M min)`  
  → 실제로 reload된 웹뷰 개수와 유휴 임계(분).

- `[gemini] Preload reported not logged in (session may have expired) slotKey= gemini`  
  → 웹뷰 쪽에서 “로그인 안 됨”으로 판단한 시점 (세션 만료 추정).

- `[gemini] Auth cookies expiry: ...` / `Auth cookie expiry extended ...`  
  → SMC_GEMINI_TOKEN_DEBUG=1 일 때만. 인증 쿠키 만료 시각 또는 만료 연장 추정.

---

## 4. 분석 시 참고

- **Preload reported not logged in** 이 **Idle refresh reload** 직후에 나오면: reload 시점에 이미 세션이 만료된 상태였거나, reload 후 서버가 세션을 끊은 경우일 수 있음.
- **Keep-alive tick** 은 주기적으로 나오는데 **Preload reported not logged in** 이 그 사이에 나오면: keep-alive만으로는 세션 연장이 안 되고, 서버가 비활성으로 세션을 만료시킨 경우일 수 있음.
- **Auth cookie expiry extended** 가 전혀 안 나오면: 우리 앱 환경에서는 토큰/쿠키 갱신이 서버에 의해 이뤄지지 않는 상황일 수 있음.

이 문서는 세션 만료 원인 분석을 위한 로그 출력 모드 사용법 안내입니다.
