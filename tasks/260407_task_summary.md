# Task summary — 2026-04-07

## 우선 작업 (v0.10.1 릴리스)

- [x] `package.json` / `package-lock.json` 버전 0.10.1 정렬
- [x] 미커밋 변경 반영: 히스토리 미리보기, 제목 더블클릭 수정, CPB `loadToEditor` 프롬프트 열기 수정
- [x] README(en/ko/ja), RELEASE_NOTES.md, 문서 사이트(docs), `docs/config.js` 버전·다운로드 URL
- [x] GitHub Actions: Windows 빌드 유지 + macOS(Intel/arm64) DMG 빌드·Release 업로드
- [x] 앱 `index.html` 창 타이틀 v0.10.1
- [x] 블로그 초안(`blogs/blog_post_v0.10.1_260407*.md`)

## 완료 기록

- 커밋: `128caa7` — `release: v0.10.1 — history preview, inline title rename, CPB prompt-open fix`
- 태그 푸시: `v0.10.1` → `origin` (GitHub Actions 릴리스 워크플로 트리거됨)
- 릴리스 노트: Chat/Task 히스토리 **미리보기**, 행 **제목 더블클릭** 인라인 이름 변경, 저장 프롬프트 목록 클릭 시 **loadToEditor**로 잘못된 프롬프트 열림 수정.
- CI: `build-windows` 후 `build-mac`이 동일 태그 Release에 DMG 업로드.
- 추가 보완(맥 완전 배포): `build:mac`을 단일 멀티 아키텍처 빌드(`electron-builder --mac --x64 --arm64`)로 변경해 EEXIST(icon.icns link) 실패를 제거.
- 추가 보완(자동업데이트): mac 릴리스 업로드 대상을 DMG만이 아니라 `latest-mac*.yml`, `*-mac*.zip`, `*-mac*.zip.blockmap`까지 포함하도록 워크플로/스크립트 확장.
- 2026-04-08: 커밋 `03f03ec` 푸시 후 **`v0.10.1` 태그 force-push 재발행**(리포지토리 태그가 fix 커밋을 가리키도록). Windows job도 동일 워크플로에서 한 번 더 실행됨(동일 버전 재게시 가능성).

- 2026-04-08: docs 상단 배지 문구에서 내부 배포 방식(GitHub Actions) 언급 제거, 사용자 가치 중심 요약으로 EN/KO/JA 동시 수정.
