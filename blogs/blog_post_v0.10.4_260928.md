# Sync Multi Chat v0.10.4: macOS 업데이트 진행 창이 닫히지 않던 문제 수정

**작성일**: 2026-09-28  
**버전**: v0.10.4

**Sync Multi Chat v0.10.4**는 macOS에서 업데이트를 받을 때 **"Downloading update..." 진행 창이 사라지지 않던 문제**를 고친 **작은 버그 수정 릴리스**입니다. 함께, 이전 버전(v0.10.2 이하)에서 업데이트 버튼을 눌렀을 때 계속 보이는 **"Could not get code signature for running application"** 오류에 대해 정확한 해결 방법을 안내합니다.

---

## 1. 무엇이 문제였나요?

업데이트를 받는 동안 보이는 진행 창은 사용자가 실수로 닫지 못하도록 **닫기 버튼을 막은 창**(`closable: false`)으로 만들어져 있습니다. 그런데 macOS에서는 이런 창에 대해 프로그램이 `close()`를 호출해도 **아무 일도 일어나지 않습니다**. 그래서 다운로드가 끝나거나 실패한 뒤에도 진행 창이 화면에 그대로 남아 있었습니다.

v0.10.4에서는 진행 창을 **강제로 정리(`destroy()`)** 하도록 바꿨습니다. Windows에서도 같은 방식으로 문제없이 닫힙니다.

---

## 2. 어떻게 확인했나요?

서명되지 않은 **Intel Mac용 테스트 빌드**를 v0.10.2로 표시되게 만들어 실행하고, 실제 GitHub에 올라간 v0.10.3을 업데이트로 받아 끝까지 확인했습니다.

| 단계 | 결과 |
|------|------|
| 업데이트 확인 | v0.10.3을 새 버전으로 인식 |
| Update Now | Intel용 DMG(약 187MB)를 다운로드 폴더에 저장 |
| 무결성 검증 | `latest-mac.yml`의 sha512와 일치 |
| 설치 안내 | DMG가 자동으로 열리고 "Update Ready" 안내 표시 |
| 진행 창 | **다운로드 완료 후 정상적으로 닫힘** |
| 코드 서명 오류 | **발생하지 않음** |

---

## 3. v0.10.2 이하 macOS 사용자는 한 번만 직접 설치해 주세요

v0.10.3부터 macOS 업데이트는 서명이 필요한 Squirrel.Mac 대신 **칩에 맞는 DMG를 받아 여는 방식**으로 바뀌었습니다. 하지만 이 코드는 **새 버전 앱 안에** 들어 있기 때문에, 이미 설치된 v0.10.2 이하 앱의 업데이트 버튼은 여전히 예전 방식으로 동작해 코드 서명 오류가 납니다.

그래서 **이번 한 번만** 아래 링크에서 DMG를 받아 설치해 주세요.

- M1/M2/M3/M4 등 **Apple Silicon** → `Sync-Multi-Chat-Setup-0.10.4-arm64.dmg`
- **Intel** Mac → `Sync-Multi-Chat-Setup-0.10.4-x64.dmg`

설치 방법: DMG를 열고 **Sync Multi Chat**을 **응용 프로그램** 폴더로 드래그한 뒤 **대치**를 선택합니다. 그 다음 업데이트부터는 앱 안에서 **Update Now**만 누르면 됩니다.

---

## 4. 빌드·배포 (Windows + macOS 칩별)

| 구분 | 내용 |
|------|------|
| **Windows** | GitHub Actions `windows-2022`에서 **설치형 `.exe`** 빌드·게시(자동 업데이트 지원) |
| **macOS** | `macos-latest`에서 **Apple Silicon(arm64)·Intel(x64) DMG/ZIP**을 각각 빌드해 **동일 Release**에 업로드 |

- Windows: `Sync-Multi-Chat-Setup-0.10.4-x64.exe`
- Apple Silicon: `Sync-Multi-Chat-Setup-0.10.4-arm64.dmg`
- Intel Mac: `Sync-Multi-Chat-Setup-0.10.4-x64.dmg`

앱 창 상단 타이틀도 **Sync Multi Chat (v0.10.4)**로 표시됩니다.

---

## 업데이트 방법

### Windows

앱 실행 시 자동 업데이트 안내에 따라 진행하거나, [Releases](https://github.com/cccnam5158/sync-multi-chat/releases/tag/v0.10.4)에서 **x64.exe**를 받아 설치합니다.

### macOS

- **v0.10.3 사용자**: 앱의 **Update Now**를 누르면 DMG가 열립니다. 앱을 종료하고 응용 프로그램 폴더로 드래그하세요.
- **v0.10.2 이하 사용자**: [Releases](https://github.com/cccnam5158/sync-multi-chat/releases/tag/v0.10.4)에서 본인 Mac에 맞는 **DMG**를 직접 받아 설치하세요.

### 문서·랜딩

[공식 문서 사이트 다운로드](https://cccnam5158.github.io/sync-multi-chat/#downloads)에도 v0.10.4 링크가 반영되어 있습니다.

---

v0.10.4는 Mac에서 **업데이트가 중간에 멈춘 것처럼 보이던 경험**을 정리한 업데이트입니다. 업데이트 과정에서 다른 문제가 보이면 GitHub Issues로 알려 주세요.

---

**TAGS**: Sync Multi Chat, v0.10.4, macOS, auto-update, Intel, Apple Silicon, code signature, Squirrel.Mac, DMG, Electron, Windows, GitHub Actions
