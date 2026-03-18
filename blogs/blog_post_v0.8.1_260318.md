# Sync Multi Chat v0.8.1: Perplexity 로그인 탐지 개선 & Edge 전용 환경 지원

**작성일**: 2026-03-18  
**버전**: v0.8.1

**Sync Multi Chat** v0.8.1은 **Perplexity 패널의 로그인 상태 표시 안정화**와 **Chrome 없이 Edge만 쓰는 PC에서도 외부 브라우저 로그인·쿠키 동기화가 되도록** 하는 데 초점을 맞춘 유지보수 릴리스입니다.

---

## Perplexity 로그인 탐지 개선

### 배경

Perplexity 웹 UI는 로그아웃 상태에서도 입력 영역 DOM이 잠깐 보이는 등, **“입력창이 있으면 로그인됨”** 같은 단순 판정으로는 **Login Required** 배지와 실제 세션이 어긋나는 경우가 있었습니다.

### 변경 사항

- **명시적 로그아웃 탐지**: 한·영 로그인 CTA 문구, `/auth`·`/login` 등 경로, 로그인 링크·버튼을 조합해 “분명히 로그아웃 화면”인지 먼저 판별합니다.
- **가시성 기반 selector**: 로그인 관련 요소는 화면에 실제로 보일 때만 반영해 오탐을 줄입니다.
- **짧은 grace(히스테리시스)**: DOM이 순간적으로 바뀔 때 배지가 깜빡이지 않도록 Gemini와 유사하게 Perplexity에도 짧은 유예 구간을 두었습니다.
- **설정 보강** (`selectors.json`): `perplexity.loginButtonSelector`에 login/signin 링크·버튼 기반 **negative check**를 추가했습니다.

로그인 후에는 **프로필·계정 UI** 등으로 “로그인된 것으로 추정”하는 경로도 함께 사용합니다.

---

## Microsoft Edge만 설치된 환경 지원 (외부 로그인)

### 배경

Gemini·Google 계정 연동 등 **외부 브라우저에서 로그인 후 쿠키를 앱으로 가져오는** 흐름은 기존에 **Google Chrome** 경로가 전제인 경우가 많았습니다. 회사 PC 등에서 **Chrome 없이 Edge만** 쓰는 환경에서는 설치 부담이 있었습니다.

### 변경 사항

- 외부 로그인용 브라우저 탐색 순서: **Chrome 우선 → 없으면 Microsoft Edge (Chromium)**.
- Windows: 일반적인 Program Files 경로의 `msedge.exe`를 탐색합니다.
- macOS: `/Applications/Microsoft Edge.app/...` 경로를 지원합니다.

Chrome을 쓰지 않는 사용자도 **Edge만으로** 동일한 외부 로그인·쿠키 동기화를 완료할 수 있습니다.

---

## 버전별 변경 요약

| 구분   | 내용 |
|--------|------|
| **개선** | Perplexity 로그인/로그아웃 상태 탐지 강화 (CTA·경로·가시성·grace, selectors 보강) |
| **개선** | 외부 로그인: Chrome 미설치 시 **Microsoft Edge** 자동 사용 (Win/macOS) |

---

## 업데이트 방법

### 기존 사용자

앱 기동 시 자동 업데이트 알림이 뜨면 **「지금 업데이트」**를 선택하세요.

### 신규 사용자

[GitHub Releases](https://github.com/cccnam5158/sync-multi-chat/releases)에서 최신 인스톨러(**v0.8.1**)를 받으세요.

---

**v0.8.1로 Perplexity 패널 상태 표시를 더 믿을 수 있게 하고, Edge만 있는 환경에서도 로그인 동기화를 이어가 보세요.**

---

**TAGS**: Sync Multi Chat, v0.8.1, Perplexity, Login Detection, Microsoft Edge, External Login, Electron, Multi AI
