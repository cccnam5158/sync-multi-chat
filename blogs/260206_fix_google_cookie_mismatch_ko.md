# Electron 39 (Chromium 134)에서 Google CookieMismatch 에러 해결하기

**날짜**: 2026년 2월 6일  
**버전**: v0.6.1  
**카테고리**: 버그 수정, Electron, Google 인증

---

## 문제 상황

Electron 39 (Chromium 134)로 업그레이드한 이후, Sync Multi Chat 사용자들이 Gemini 또는 Genspark에서 Google 인증으로 로그인할 때 `accounts.google.com/CookieMismatch` 에러가 발생했습니다. `accounts.google.com`과 `gemini.google.com` 간의 리다이렉트를 포함하는 Google 로그인 플로우가 완전히 작동하지 않았습니다.

## 원인 분석

### 1. Chromium 134의 서드파티 쿠키 단계적 폐지

Chromium 134는 **서드파티 쿠키 폐지(Third-Party Cookie Deprecation)** 정책을 도입했습니다. Google의 인증 플로우는 도메인 간(`accounts.google.com` ↔ `gemini.google.com`) 쿠키 공유가 필수입니다. Chromium 134의 새로운 제한 사항에 따라 이러한 크로스 도메인 쿠키가 **조용히 차단**되어 인증 실패가 발생했습니다.

또한 **쿠키 파티셔닝(CHIPS, Cookies Having Independent Partitioned State)** 이 최상위 사이트별로 쿠키를 격리하여 Google SSO 플로우를 더욱 방해했습니다.

### 2. 응답 헤더 조작으로 인한 Set-Cookie 손상

앱의 `onHeadersReceived` 핸들러가 `accounts.google.com`을 포함한 **모든** 응답에서 `X-Frame-Options` 및 `Content-Security-Policy` 헤더를 제거하고 있었습니다. 이 광범위한 헤더 조작이 Google의 `Set-Cookie` 헤더에 의도치 않게 영향을 미쳤으며, 특히 엄격한 보안 요구사항을 가진 `__Host-` 접두사 쿠키에 문제를 일으켰습니다:
- 반드시 `Secure` 플래그가 설정되어야 함
- `Domain` 속성이 **없어야** 함
- `Path`가 반드시 `/`이어야 함

### 3. User-Agent 버전 불일치

앱이 User-Agent 문자열에서 `Chrome/130`을 선언했지만, 실제로는 Chromium 134를 실행하고 있었습니다. Google은 선언된 버전과 브라우저의 실제 기능 간의 불일치를 감지하여 세션을 잠재적으로 자동화된 것으로 플래그 처리했습니다.

## 해결 방법

### 서드파티 쿠키 제한 비활성화

```javascript
app.commandLine.appendSwitch(
    'disable-features',
    'ThirdPartyCookieDeprecationTrial,TrackingProtection3pcd,PartitionedCookies,BoundSessionCredentials'
);
```

### Google 인증 도메인 헤더 보존

```javascript
view.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url || '';
    if (url.includes('accounts.google.com') ||
        url.includes('myaccount.google.com') ||
        url.includes('accounts.youtube.com')) {
        callback({ cancel: false, responseHeaders: details.responseHeaders });
        return;
    }
    // ... 다른 도메인에 대한 기존 헤더 조작 로직
});
```

### 동적 User-Agent 버전 관리

```javascript
const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
```

## 핵심 교훈

1. **Chromium 업그레이드 후 반드시 인증 플로우를 테스트하세요** — 쿠키 정책은 자주 변경되며 크로스 도메인 인증을 조용히 깨뜨릴 수 있습니다.
2. **헤더 조작은 선별적으로 적용하세요** — 인증 도메인에 대해 광범위한 응답 헤더 수정을 적용하지 마세요.
3. **User-Agent를 실제 엔진과 일관되게 유지하세요** — 버전 불일치는 주요 플랫폼에서 봇 탐지를 트리거합니다.
4. **`__Host-` 및 `__Secure-` 쿠키 처리를 모니터링하세요** — 이러한 쿠키 접두사는 미들웨어에 의해 쉽게 깨질 수 있는 엄격한 요구사항을 가지고 있습니다.

## 영향받는 서비스

| 서비스 | 영향 | 상태 |
|--------|------|------|
| Gemini | Google 로그인 차단 | **수정됨** |
| Genspark | Google 로그인 차단 | **수정됨** |
| Grok | Google SSO 영향 | **수정됨** |
| ChatGPT | 영향 없음 | — |
| Claude | 영향 없음 | — |
| Perplexity | 영향 없음 | — |

---

*이 수정 사항은 Sync Multi Chat v0.6.1에 포함되어 있습니다. 자동 업데이터를 통해 업데이트하거나 [릴리즈 페이지](https://github.com/cccnam5158/sync-multi-chat/releases)에서 다운로드하세요.*
