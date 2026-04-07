# Sync Multi Chat v0.10.1: 히스토리 미리보기, 제목 빠른 수정, 프롬프트 열기 버그 수정

**작성일**: 2026-04-07  
**버전**: v0.10.1

**Sync Multi Chat v0.10.1**은 대화·작업 세션을 더 빠르게 찾고 정리할 수 있도록 **히스토리 UX**를 다듬고, **커스텀 프롬프트 목록**에서 잘못된 항목이 열리던 문제를 고친 **유지보수 릴리스**입니다. 동시에 **GitHub Actions**에서 **Windows 설치 파일**과 **macOS(Intel·Apple Silicon) DMG**를 나란히 빌드해 **같은 GitHub Release**에 올리도록 정리했습니다.

---

## 1. Chat / Task 히스토리 미리보기

### 무엇이 달라졌나요?

- 사이드바 **Chat History** 목록에서 세션 옆 **미리보기**를 누르면, 세션 전체를 복원하지 않고도 저장된 내용을 **모달**로 확인할 수 있습니다.
- 일반 채팅 세션은 서비스별로 나뉜 **채팅 스레드** 형태로, **Task** 세션은 저장된 **대화(메시지) 스트림**과 상태 정보를 중심으로 표시합니다.

### 왜 쓰기 좋은가요?

긴 목록에서 **어느 세션을 열어야 할지** 고를 때, 매번 복원했다가 되돌아오는 부담이 줄어듭니다. “이거 맞나?”를 **가볍게 확인**하는 흐름에 맞춰져 있습니다.

---

## 2. 히스토리 제목 더블클릭으로 바로 수정

### 변경 사항

- **Chat**·**Task** 히스토리 행의 **제목**을 **더블클릭**하면 인라인 입력으로 전환됩니다.
- **Enter**로 저장, **Esc**로 취소합니다. 저장 시 **기존 세션 id**를 유지해 데이터가 꼬이지 않도록 했습니다.

### 기대 효과

날짜·자동 제목만으로는 구분이 어려울 때, **직관적으로 라벨을 붙여** 나중에 찾기 쉽게 만듭니다.

---

## 3. 커스텀 프롬프트 — 클릭했는데 다른 프롬프트가 열리던 문제

### 원인·수정 요지

- 저장 프롬프트 목록에서 항목을 열 때 내부적으로 **`trySwitchPrompt`** 경로가 쓰이면서, **정렬·필터·Grid.js 갱신** 이후 **인덱스/포커스와 실제 행 id**가 어긋나 **엉뚱한 프롬프트**가 에디터에 올라오는 경우가 있었습니다.
- 이제 **`loadToEditor(id)`**로 **id 기준**으로 직접 로드해, 클릭한 행과 편집 내용이 **일치**하도록 했습니다.

---

## 4. 빌드·배포 (Windows + macOS 칩별 DMG)

| 구분 | 내용 |
|------|------|
| **Windows** | 기존과 같이 `windows-latest`에서 **설치형 `.exe`** 빌드·게시 |
| **macOS** | `macos-latest`에서 **x64·arm64 각각 DMG** 빌드 후 **동일 Release**에 업로드 |

사이트·README의 다운로드 링크는 **v0.10.1** 아티팩트 이름에 맞춰 갱신했습니다.

- Windows: `Sync-Multi-Chat-Setup-0.10.1-x64.exe`
- Apple Silicon: `Sync-Multi-Chat-Setup-0.10.1-arm64.dmg`
- Intel Mac: `Sync-Multi-Chat-Setup-0.10.1-x64.dmg`

---

## 업데이트 방법

### Windows

앱 내 자동 업데이트가 있으면 안내에 따라 진행하거나, [Releases](https://github.com/cccnam5158/sync-multi-chat/releases/tag/v0.10.1)에서 최신 **x64.exe**를 받습니다.

### macOS

[Releases](https://github.com/cccnam5158/sync-multi-chat/releases/tag/v0.10.1)에서 본인 Mac에 맞는 **DMG**만 선택해 설치합니다.

### 문서·랜딩

[공식 문서 사이트 다운로드](https://cccnam5158.github.io/sync-multi-chat/#downloads)에도 동일 버전 링크가 반영됩니다.

---

v0.10.1은 **「히스토리는 빨리 훑고, 제목은 바로 고치고, 프롬프트 목록은 믿고 클릭」**할 수 있게 만든 업데이트입니다. 문제가 보이면 GitHub Issues로 알려 주세요.

---

**TAGS**: Sync Multi Chat, v0.10.1, history preview, inline rename, Custom Prompt Builder, Electron, macOS, Windows, GitHub Actions
