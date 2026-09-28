# Sync Multi Chat v0.10.3: Gemini 크로스 체크 전달 오류 수정 + macOS 자동 업데이트 개선

**작성일**: 2026-09-28  
**버전**: v0.10.3

**Sync Multi Chat v0.10.3**은 두 가지 문제를 고친 **버그 수정 릴리스**입니다. 하나는 **Gemini의 새 입력창에서 Cross Check를 하면 다른 AI의 답변이 전달되지 않던 문제**이고, 다른 하나는 **Intel Mac에서 자동 업데이트가 "Could not get code signature for running application" 오류로 끝나지 않던 문제**입니다. 다운로드는 이전과 같이 **Windows 설치 파일**과 **macOS Intel·Apple Silicon DMG**가 **같은 GitHub Release**에 올라갑니다.

---

## 1. Gemini 크로스 체크: 무엇이 문제였나요?

Cross Check는 각 AI의 마지막 답변을 모아 **여러 줄짜리 프롬프트**로 만든 뒤 다른 AI에게 보냅니다. ChatGPT와 Claude에는 이 프롬프트가 잘 전달됐지만, **Gemini에는 첫 줄(기본 프롬프트)만 전송되고 ChatGPT·Claude의 답변은 모두 빠진 채** 보내졌습니다.

원인은 Gemini의 새 입력창이 쓰는 **Quill 에디터**와 기존 입력 방식이 맞지 않았기 때문입니다.

1. 앱은 입력 전에 입력창을 `innerHTML = ''`로 비웠는데, 이때 Quill이 관리하는 `<p>` 문단 구조까지 함께 지워졌습니다.
2. 그 상태에서 여러 줄을 넣으면 브라우저가 둘째 줄부터 `<div>` 블록을 만듭니다.
3. 약 1초 뒤 Quill이 입력창 구조를 다시 정리하면서 `<div>` 안의 내용을 버리고 빈 줄로 바꿉니다.

평소 프롬프트는 대부분 한 줄이라 문제가 드러나지 않았고, 여러 줄로 구성되는 Cross Check에서만 증상이 나타났습니다.

---

## 2. 어떻게 고쳤나요?

| 구분 | 이전 | v0.10.3 |
|------|------|------|
| 입력창 초기화 | `innerHTML = ''`로 내용 삭제 | Quill 에디터(`.ql-editor`)는 **기존 내용을 전체 선택한 뒤 새 텍스트로 교체** |
| Quill 문단 구조 | 지워짐 → 둘째 줄부터 사라짐 | `<p>` 구조 유지 → **모든 줄이 그대로 전송** |
| 다른 서비스 | — | 기존 방식 그대로 유지 |

한글·마크다운·코드 블록이 섞인 약 4,000자 텍스트로 검증했을 때, 입력 후 Quill 정리가 끝난 뒤에도 내용이 **한 글자도 빠지지 않고** 남았습니다.

또한 Gemini 새 UI의 전송 버튼(`aria-label="메시지 보내기"`)이 기존 셀렉터와 맞지 않아 **Enter 키 대체 동작에만 의존**하고 있었습니다. 이번에 한국어 라벨 셀렉터를 추가해 전송 버튼을 직접 찾아 누릅니다.

---

## 3. macOS 자동 업데이트: "Could not get code signature" 오류

v0.10.2 이후 Intel Mac에서 앱을 다시 실행하고 업데이트 버튼을 누르면 다음 메시지가 뜨고 업데이트가 끝나지 않았습니다.

> Reason: Could not get code signature for running application

자동 업데이트 라이브러리(electron-updater)는 macOS에서 **Squirrel.Mac**으로 설치하는데, Squirrel.Mac은 **실행 중인 앱에 코드 서명이 있어야** 동작합니다. Sync Multi Chat의 macOS 빌드는 Apple Developer ID로 서명되지 않았습니다. Apple Silicon 빌드는 빌드 도구가 자동으로 붙이는 임시(ad-hoc) 서명이라도 있지만, **Intel 빌드는 서명이 전혀 없어** Intel Mac에서 특히 이 오류가 났습니다.

v0.10.3부터 macOS에서는 Squirrel.Mac을 거치지 않습니다.

1. **Update Now**를 누르면 내 Mac의 칩(Apple Silicon / Intel)에 맞는 **DMG**를 **다운로드** 폴더에 받습니다(진행률 창 표시).
2. 받은 파일을 릴리스 정보(`latest-mac.yml`)에 기록된 **sha512 해시로 검증**합니다.
3. DMG를 자동으로 열어 줍니다. 앱을 종료한 뒤 **응용 프로그램**으로 드래그하고 **대치**를 선택하면 업데이트가 끝납니다.
4. 다운로드에 실패하면 GitHub 릴리스 페이지를 열어 직접 받을 수 있게 안내합니다.

Windows 자동 업데이트는 기존과 같습니다.

> **v0.10.2 이하 macOS 사용자 안내**: 이번 수정은 v0.10.3 앱 안에 들어 있으므로, 이전 버전의 업데이트 버튼에서는 같은 오류가 다시 보일 수 있습니다. **v0.10.3은 한 번만 직접 받아 설치**해 주세요. 그 다음 업데이트부터는 새 방식으로 진행됩니다.

---

## 4. 빌드·배포 (Windows + macOS 칩별)

| 구분 | 내용 |
|------|------|
| **Windows** | GitHub Actions `windows-2022`에서 **설치형 `.exe`** 빌드·게시(자동 업데이트 지원) |
| **macOS** | `macos-latest`에서 **Apple Silicon(arm64)·Intel(x64) DMG/ZIP**을 각각 빌드해 **동일 Release**에 업로드 |

- Windows: `Sync-Multi-Chat-Setup-0.10.3-x64.exe`
- Apple Silicon: `Sync-Multi-Chat-Setup-0.10.3-arm64.dmg`
- Intel Mac: `Sync-Multi-Chat-Setup-0.10.3-x64.dmg`

앱 창 상단 타이틀도 **Sync Multi Chat (v0.10.3)**으로 표시됩니다.

---

## 업데이트 방법

### Windows

앱 실행 시 자동 업데이트 안내에 따라 진행하거나, [Releases](https://github.com/cccnam5158/sync-multi-chat/releases/tag/v0.10.3)에서 **x64.exe**를 받아 설치합니다.

### macOS

[Releases](https://github.com/cccnam5158/sync-multi-chat/releases/tag/v0.10.3)에서 본인 Mac에 맞는 **DMG**를 선택합니다.

- M1/M2/M3/M4 등 **Apple Silicon** → `arm64.dmg`
- **Intel** Mac → `x64.dmg`

### 문서·랜딩

[공식 문서 사이트 다운로드](https://cccnam5158.github.io/sync-multi-chat/#downloads)에도 v0.10.3 링크가 반영되어 있습니다.

---

v0.10.3은 **「세 AI의 답을 서로 검증한다」**는 Cross Check의 기본 흐름을 Gemini에서도 되살리고, Mac 사용자가 업데이트 때문에 막히지 않도록 한 업데이트입니다. 다른 서비스에서도 크로스 체크 내용이 잘려서 전달되면 GitHub Issues로 알려 주세요.

---

**TAGS**: Sync Multi Chat, v0.10.3, Gemini, Cross Check, Quill, prompt injection, auto-update, macOS, Intel, Apple Silicon, code signature, Squirrel.Mac, Electron, Windows, GitHub Actions
