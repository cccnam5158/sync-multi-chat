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
