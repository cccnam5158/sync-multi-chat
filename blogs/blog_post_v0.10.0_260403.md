# Sync Multi Chat v0.10.0: macOS 지원, 앱 내 로그인, ChatGPT 구독·Skills(Task)

**작성일**: 2026-04-03  
**버전**: v0.10.0

**Sync Multi Chat v0.10.0**은 데스크톱에서 여러 AI 웹 UI를 한 화면에 모아 쓰는 MAPB의 **메이저 업데이트**입니다. 이번 릴리스의 축은 **macOS 정식 지원**, **웹뷰 중심의 앱 내 로그인**, 그리고 **ChatGPT 구독 기반 Task UI와 Skills** 세 가지입니다.

---

## 1. macOS — Intel과 Apple Silicon 각각 빌드

### 무엇이 달라졌나요?

- Electron `electron-builder`로 **x64(Intel)** 와 **arm64(Apple Silicon)** 용 **DMG / ZIP** 을 만들 수 있습니다 (`npm run build:mac`).
- GitHub Releases에서 **자신의 Mac에 맞는 파일**만 받으면 됩니다.  
  - Apple Silicon: `Sync-Multi-Chat-Setup-0.10.0-arm64.dmg`  
  - Intel: `Sync-Multi-Chat-Setup-0.10.0-x64.dmg`

### 왜 중요한가요?

Windows만 지원하던 때와 달리, **맥에서도 동일한 멀티 패널·브로드캐스트 워크플로**를 네이티브 앱으로 쓸 수 있습니다. 기업·개인 환경에서 OS 선택의 부담이 줄어듭니다.

---

## 2. 앱 안에서 끝나는 로그인 (더 이상 Chrome만 띄우지 않아도 되는 흐름)

### 변경 사항

- Google 계정(`accounts.google.com` / `id.google.com`) 등은 **서비스 웹뷰와 같은 세션 파티션**을 쓰는 **모달 BrowserWindow**에서 열 수 있어, 임베디드 웹뷰에서 흔히 나오는 **「브라우저가 안전하지 않음」** 류의 마찰을 줄였습니다.
- `will-redirect` / `setWindowOpenHandler` 등으로 **인증 흐름을 앱이 끊기지 않게** 이어 줍니다.

### 기대 효과

예전에는 외부 Chrome(또는 Edge)에 의존하던 단계가 많았는데, **지원되는 플로우는 앱 안에서 로그인을 마칠 수 있어** 맥락 전환이 줄어듭니다. (여전히 외부 브라우저 동기화가 필요한 경우도 있으며, v0.8.1 이후 Edge 폴백 등 기존 경로는 유지됩니다.)

---

## 3. ChatGPT 구독 + Skills — Task UI에서 API 키 없이

### 무엇이 달라졌나요?

- **ChatGPT Plus / Pro / Team** 등 **구독 계정**으로 OpenAI 쪽 OAuth(Codex 계열 파라미터 포함)에 연결해, **별도 API 키(BYOK) 없이** 호스트된 모델을 Task 경험에 사용할 수 있는 방향으로 확장되었습니다.
- 앱 번들에 **Skills** 리소스(`src/data/skills`, **asarUnpack**)를 포함해, 에이전트·도구형 워크플로에서 스킬 패키지를 활용할 수 있습니다.

### 참고

- 로컬에 **Codex CLI**(`@openai/codex` 등)가 있으면 모델 목록·캐시와의 연동이 강화되고, 없을 때는 내장 폴백 모델 구성을 사용합니다(앱 내 설정·로그 메시지 참고).

---

## 버전별 변경 요약

| 구분 | 내용 |
|------|------|
| **신규** | macOS x64 / arm64 설치 패키지 |
| **신규** | 앱 내 모달·동일 파티션 기반 Google/OAuth 로그인 흐름 |
| **신규** | ChatGPT 구독 OAuth + Task UI + 번들 Skills |
| **개선** | macOS 메뉴/업데이터 메시지 등 플랫폼별 다듬기 |

---

## 업데이트 방법

### Windows (기존 사용자)

앱 시작 시 자동 업데이트가 뜨면 **「지금 업데이트」** 를 선택하세요. 설치 파일명은 `Sync-Multi-Chat-Setup-0.10.0-x64.exe` 형태를 따릅니다.

### macOS (신규)

[Releases](https://github.com/cccnam5158/sync-multi-chat/releases/tag/v0.10.0)에서 본인 CPU에 맞는 **DMG**를 내려받아 Applications 폴더로 옮깁니다. Gatekeeper 안내가 나오면 시스템 설정에서 허용하거나, 한 번 **제어 클릭 → 열기**로 실행합니다.

### 문서 사이트

[다운로드 섹션](https://cccnam5158.github.io/sync-multi-chat/#downloads)에 Windows·macOS 링크가 반영되어 있습니다.

---

v0.10.0은 **「맥에서도 쓰고, 로그인은 앱 안에서, 구독은 Task·Skills까지」** 를 한 번에 끌어올린 릴리스입니다.  
사용해 보시고 이슈가 있으면 GitHub Issues로 알려 주세요.

---

**TAGS**: Sync Multi Chat, v0.10.0, macOS, Apple Silicon, Intel, Electron, in-app login, OAuth, ChatGPT, Skills, Task, Multi AI
