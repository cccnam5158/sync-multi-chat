# Sync Multi Chat v0.10.2: ChatGPT 프롬프트 전송 로직 개선 (새 입력창·전송 버튼 대응)

**작성일**: 2026-09-28  
**버전**: v0.10.2

**Sync Multi Chat v0.10.2**는 최근 바뀐 **ChatGPT 웹 UI**에 맞춰 **프롬프트 입력·전송 로직**을 다시 맞춘 **유지보수 릴리스**입니다. ChatGPT 패널에 프롬프트가 입력되지 않거나, 입력은 됐는데 **전송 버튼이 눌리지 않고 멈추는** 현상을 해결했습니다. 같은 흐름으로 **로그인 상태 탐지**, **대화 복사**, **Cross Check**에 쓰이는 셀렉터도 함께 갱신했습니다. 다운로드는 이전과 같이 **Windows 설치 파일**과 **macOS Intel·Apple Silicon DMG**가 **같은 GitHub Release**에 올라갑니다.

---

## 1. 무엇이 문제였나요?

ChatGPT가 프롬프트 입력창을 **ProseMirror 기반 composer**로 교체하면서, 기존에 앱이 찾던 `#prompt-textarea`와 `data-testid="send-button"` 버튼이 항상 존재하지 않게 되었습니다. 그 결과:

- 일괄 전송(Broadcast) 시 ChatGPT 패널에만 **프롬프트가 입력되지 않거나**
- 입력은 되었는데 **전송 버튼을 찾지 못해** 전송이 멈추고
- **Copy Chat Thread / Copy Last Response / Cross Check**에서 ChatGPT 응답을 제대로 읽지 못하는 경우가 생겼습니다.

---

## 2. 프롬프트 입력창 인식 개선

앱은 `src/config/selectors.json`에 정의된 셀렉터를 **위에서부터 순서대로** 시도합니다. v0.10.2에서는 새 UI 셀렉터를 **맨 앞에** 추가했습니다.

| 우선순위 | 셀렉터 | 설명 |
|------|------|------|
| 1 | `div.ProseMirror[contenteditable='true'][data-composer-markdown]` | 새 ChatGPT composer |
| 2 | `div[contenteditable='true'][role='textbox']` | 접근성 속성 기반 폴백 |
| 3 | `textarea[name='prompt']` | 텍스트영역 형태 폴백 |
| 4~ | `div#prompt-textarea`, `textarea#prompt-textarea` … | 기존 셀렉터(호환 유지) |

입력 자체는 기존 **ProseMirror/contentEditable 전용 입력 경로**(사람처럼 입력하는 타이핑 시뮬레이션 포함)를 그대로 쓰기 때문에, 입력창만 정확히 찾으면 Gemini 등과 같은 방식으로 안정적으로 입력됩니다.

---

## 3. 전송 버튼 탐지 개선

| 우선순위 | 셀렉터 |
|------|------|
| 1 | `form button[type='submit']` |
| 2 | `button[data-composer-submit]` |
| 3 | `button[data-testid='send-button']` (기존) |
| 4 | `button[aria-label='Send prompt']` (기존) |

새 UI에서는 composer의 **submit 버튼**을 먼저 찾아 누르고, 구 UI가 남아 있는 환경에서는 기존 셀렉터로 자연스럽게 폴백합니다.

---

## 4. 로그인·응답·복사 셀렉터 갱신

- **로그인 상태**: 새 composer가 보이면 로그인된 것으로 판단 → **Login Required** 배지가 실제 상태와 맞게 표시됩니다.
- **메시지**: `div[data-turn-key]`로 대화 턴을 인식합니다.
- **마지막 응답**: `div[data-markdown-text-style='assistant-message']`로 어시스턴트 답변을 정확히 가져옵니다 → **Copy Last Response**, **Cross Check**, `{{last_response}}` 변수에 반영됩니다.
- **복사 버튼**: `Copy message` / `메시지 복사` 라벨을 모두 지원합니다(영문·한국어 UI).
- **대화 컨테이너**: `main [data-app-action-timeline-scroll]`을 우선 사용해 스크롤 동기화와 대화 추출이 안정적으로 동작합니다.

모든 항목에서 **기존 셀렉터는 폴백으로 유지**했기 때문에, ChatGPT가 A/B 테스트로 구·신 UI를 섞어 보여 주더라도 동작합니다.

---

## 5. 빌드·배포 (Windows + macOS 칩별)

| 구분 | 내용 |
|------|------|
| **Windows** | GitHub Actions `windows-latest`에서 **설치형 `.exe`** 빌드·게시(자동 업데이트 지원) |
| **macOS** | `macos-latest`에서 **Apple Silicon(arm64)·Intel(x64) DMG/ZIP**을 각각 빌드해 **동일 Release**에 업로드 |

- Windows: `Sync-Multi-Chat-Setup-0.10.2-x64.exe`
- Apple Silicon: `Sync-Multi-Chat-Setup-0.10.2-arm64.dmg`
- Intel Mac: `Sync-Multi-Chat-Setup-0.10.2-x64.dmg`

앱 창 상단 타이틀도 **Sync Multi Chat (v0.10.2)**로 표시됩니다.

---

## 업데이트 방법

### Windows

앱 실행 시 자동 업데이트 안내에 따라 진행하거나, [Releases](https://github.com/cccnam5158/sync-multi-chat/releases/tag/v0.10.2)에서 **x64.exe**를 받아 설치합니다.

### macOS

[Releases](https://github.com/cccnam5158/sync-multi-chat/releases/tag/v0.10.2)에서 본인 Mac에 맞는 **DMG**를 선택합니다.

- M1/M2/M3/M4 등 **Apple Silicon** → `arm64.dmg`
- **Intel** Mac → `x64.dmg`

### 문서·랜딩

[공식 문서 사이트 다운로드](https://cccnam5158.github.io/sync-multi-chat/#downloads)에도 v0.10.2 링크가 반영되어 있습니다.

---

v0.10.2는 **「ChatGPT가 UI를 바꿔도 한 번에 보내고, 한 번에 비교한다」**는 기본 흐름을 되살린 업데이트입니다. 다른 서비스에서도 입력·전송이 멈추는 현상이 보이면 GitHub Issues로 알려 주세요.

---

**TAGS**: Sync Multi Chat, v0.10.2, ChatGPT, ProseMirror, prompt broadcast, selectors, Electron, macOS, Apple Silicon, Intel, Windows, GitHub Actions
