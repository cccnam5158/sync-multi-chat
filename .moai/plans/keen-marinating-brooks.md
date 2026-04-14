# Plan: 로컬 .md 파일 Drag & Drop 으로 신규 프롬프트 등록

## Context

현재 Prompt Hub 와 Custom Prompt Builder(CPB) 의 좌측 카테고리 트리 / 우측 프롬프트 목록 영역은 내부 항목(프롬프트 행, 카테고리 노드) 간의 drag & drop 만 처리한다(`application/smc-prompt-ids`, `application/smc-category` MIME). 사용자가 OS 파일 탐색기에서 `.md` 파일을 끌어와 떨어뜨려도 아무 반응이 없다.

요구사항:
- Prompt Hub / CPB 양쪽에서, 좌측 카테고리 트리(1·2 depth) 또는 우측 프롬프트 목록 영역에 로컬 `.md` 파일을 drag & drop 하면 신규 프롬프트로 등록.
- `title` = 파일명에서 `.md` 확장자를 뺀 값
- `content` = 파일 본문(Markdown 텍스트 그대로)
- 카테고리 트리 노드 위에 떨어뜨리면 해당 카테고리에 할당. 프롬프트 목록 영역(또는 “All”/“Uncategorized”) 위에 떨어뜨리면 적절한 기본값(아래 규칙 참조).
- 다중 파일 drop 지원 (각 파일 = 1 프롬프트).
- 비-md 파일은 무시하고 토스트 안내.

## 변경 대상 파일

- [src/renderer/prompt-hub.js](src/renderer/prompt-hub.js)
  - Prompt Hub 루트 컨테이너의 `dragover` / `drop` 핸들러 (현재 [prompt-hub.js:1555-1646](src/renderer/prompt-hub.js#L1555-L1646))
  - CPB 사이드 패널의 `dragover` / `drop` 핸들러 (현재 [prompt-hub.js:2033-2120](src/renderer/prompt-hub.js#L2033-L2120))
  - 신규 헬퍼 함수: `importMdFilesAsPrompts(files, targetCatId)` 추가 + `SMCPromptLibrary` 에 노출
- 다른 파일은 수정하지 않음. CPB 본체([src/renderer/custom-prompt-builder.js](src/renderer/custom-prompt-builder.js))의 사이드바 drop 은 prompt-hub.js 에 정의된 `ensureCpbPhPanelBound()` 가 처리하므로 자동 반영됨.

## 재사용할 기존 함수 / 유틸

- `loadPromptsRaw()` / `saveAllPrompts(prompts)` — 영속화([prompt-hub.js:406-410](src/renderer/prompt-hub.js#L406-L410))
- `normalizePrompt(p)` — 신규 객체 정규화([prompt-hub.js:377-393](src/renderer/prompt-hub.js#L377-L393))
- `assignPromptsToCategory(ids, catVal)` — 카테고리 할당 규칙([prompt-hub.js:338-347](src/renderer/prompt-hub.js#L338-L347))
- `phToast(msg)` — 사용자 알림([prompt-hub.js:158-171](src/renderer/prompt-hub.js#L158-L171))
- `renderPromptHub()` / `window.SMCPromptLibrary._cpbPhRefresh` / `_cpbReloadPromptsAfterExternalChange` — 양쪽 패널 리렌더 (drop 핸들러 기존 사용 패턴 그대로)
- ID 생성: 기존 prompt-hub.js 의 `normalizePrompt` 호출 전 단계에서 사용하는 패턴이 없으므로, CPB 의 `uid()` 와 동일한 방식 인라인 사용:
  `Math.random().toString(16).slice(2) + Date.now().toString(16)`

## 구현 단계

### 1. 신규 헬퍼 추가 — `prompt-hub.js`

`assignPromptsToCategory` 직후(약 line 348)에 추가:

```js
function importMdFilesAsPrompts(files, targetCatId) {
    // 1) .md / .markdown 만 필터
    // 2) FileReader.readAsText 로 각 파일 읽기 (Promise.all)
    // 3) 각 파일에 대해 normalizePrompt({...}) 로 객체 생성:
    //    - id: uid 생성
    //    - title: file.name 에서 확장자 제거
    //    - content: 읽은 텍스트
    //    - categoryId: targetCatId (null 이면 미할당)
    //    - createdAt/updatedAt/lastUsedAt: Date.now()
    // 4) loadPromptsRaw() 로 기존 목록 가져와 unshift 후 saveAllPrompts()
    // 5) {imported, skipped} 카운트 반환
}
```

`SMCPromptLibrary` 객체에 `importMdFilesAsPrompts` 노출 (line ~2317 영역, 다른 export 들과 함께).

### 2. Prompt Hub `dragover` 핸들러 확장 — `prompt-hub.js:1555-1565`

기존 분기에 “Files” 드래그 케이스 추가:

```js
const isFileDrag = e.dataTransfer.types.includes('Files');
if (isFileDrag) {
    // 카테고리 트리 노드 위 → 해당 카테고리에 highlight
    // 그 외(목록/빈 공간) → root 컨테이너 자체에 highlight (또는 dt 여부에 따라)
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (dt) { dt.classList.add('ph-cat-item--drag-over'); _hubDropHighlight = dt; }
    return;
}
```

목록 영역(`#ph-list-host`) 도 drop 가능하도록 dragover 에서 `e.target.closest('#ph-list-host')` 도 prevent 처리.

### 3. Prompt Hub `drop` 핸들러 확장 — `prompt-hub.js:1567-1646`

핸들러 맨 앞에 파일 처리 분기 추가 (`pr` / `cr` 처리보다 우선):

```js
const fileList = e.dataTransfer.files;
if (fileList && fileList.length > 0) {
    e.preventDefault();
    // 드롭 타겟 결정:
    //   - data-ph-drop-cat 가 있으면 그 카테고리 (단 '__uncat__' 또는 '' → null)
    //   - 아니면 #ph-list-host 위 → 현재 _phState.catId (단 '__uncat__' → null)
    //   - 그 외 → null
    const targetCat = resolveDropTargetCat(e);
    importMdFilesAsPrompts(fileList, targetCat).then(({imported, skipped}) => {
        if (imported > 0) phToast(`Imported ${imported} prompt(s)` + (skipped ? `, skipped ${skipped}` : ''));
        else if (skipped > 0) phToast(`No .md files to import (skipped ${skipped})`);
        renderPromptHub();
        window.SMCPromptLibrary._cpbReloadPromptsAfterExternalChange?.();
        window.SMCPromptLibrary._cpbPhRefresh?.();
    });
    return;
}
```

`resolveDropTargetCat(e)` 는 동일 핸들러 내 인라인 작성.

### 4. CPB 사이드 패널 `dragover` / `drop` 확장 — `prompt-hub.js:2033-2120`

동일 패턴을 `ensureCpbPhPanelBound()` 의 panel `dragover` / `drop` 리스너에 추가.
- drop 타겟 우선순위: `[data-ph-drop-cat]` → CPB 사이드 프롬프트 리스트(`#cpb-list`) → null.
- 리스트 영역에 dropped 시 현재 CPB 상태(`_getCpbPhState().catId`)를 기본 카테고리로 사용.
- 완료 후 `window.SMCPromptLibrary._cpbReloadPromptsAfterExternalChange?.()` + `_cpbPhRefresh?.()` + `renderPromptHub()` 호출(기존 drop 핸들러와 동일 패턴).

### 5. ESLint / 컨벤션 준수

- `const` / `let` 만 사용 (`var` 금지)
- `===` 사용
- 모든 `FileReader` 작업은 Promise 로 감싸서 `Promise.all` 후 처리, 미처리 rejection 이 없도록 try/catch
- 새 코드 라인은 영문 주석만 사용 (`code_comments: en`)
- 외부 코드 스타일에 맞춰 IIFE 내부에 함수 추가, ESM/CommonJS 변경 없음

## 카테고리 할당 규칙 (drop 타겟 → 결과)

| Drop 위치 | 결과 categoryId |
|-----------|-----------------|
| 카테고리 트리 노드(1·2 depth) | 해당 노드 id |
| “All” 노드 (`data-ph-drop-cat=""`) | `null` |
| “Uncategorized” 노드 (`__uncat__`) | `null` |
| Hub 우측 프롬프트 목록(`#ph-list-host`) | 현재 필터 카테고리(`_phState.catId`), 없으면 `null` |
| CPB 사이드 프롬프트 목록(`#cpb-list`) | 현재 CPB 카테고리 필터, 없으면 `null` |

## 잠재적 이슈 / 엣지 케이스

1. 큰 .md 파일 — `FileReader` 비동기 처리로 메인 스레드 블로킹 없음. 별도 사이즈 제한 두지 않음(필요시 후속 추가).
2. 동일 파일명 중복 drop — 매번 새 prompt 로 등록(중복 검사 X). 향후 import 로직처럼 dedup 옵션을 둘 수 있으나 이번 스코프 외.
3. 파일과 내부 prompt drag 가 동시에 발생할 일은 브라우저 DnD 모델상 없으나, 안전을 위해 `dataTransfer.types.includes('Files')` 를 가장 먼저 체크.
4. 비-md 확장자(`.txt`, `.json` 등) — 무시하고 skipped 카운트로 토스트.
5. CPB 가 `_isDraft` 상태에서 외부 변경 발생 → 기존에 사용하는 `_cpbReloadPromptsAfterExternalChange` 호출 패턴 유지로 처리.
6. 드래그가 카테고리 노드 자식 요소(아이콘 등) 위에서 발생 — 기존과 동일하게 `closest('[data-ph-drop-cat]')` 가 처리.

## 검증(Verification)

### 수동 테스트
1. `npm start` 또는 Electron 개발 모드 실행.
2. Prompt Hub 패널 열기.
3. 단일 `.md` 파일을 카테고리 트리의 2-depth 노드에 drop → 새 prompt 생성, 해당 카테고리에 속하는지 확인.
4. 여러 `.md` 파일을 동시에 “All” 노드에 drop → 모두 카테고리 미할당 상태로 등록되는지 확인.
5. `.md` 와 `.txt` 를 섞어 drop → md 만 import, 토스트에 skipped 카운트 표기 확인.
6. Prompt Hub 우측 목록 영역(특정 카테고리 필터 활성)에 drop → 해당 카테고리로 등록 확인.
7. CPB 모달 열고 사이드 카테고리 트리/프롬프트 목록에 drop → 동일 동작 확인 + Prompt Hub 도 재렌더되는지 확인.
8. 빈 prompt content / 매우 긴 content / 한글 파일명 / 공백 포함 파일명 케이스 확인.
9. 드래그 진행 중 dragover highlight 가 정상적으로 표시·해제되는지 확인.

### 자동화
- 본 프로젝트는 단위 테스트 인프라가 없는 vanilla JS Electron 앱이므로 단위 테스트 추가는 스코프 외. 회귀 리스크는 기존 prompt/category drag 동작이 깨지지 않는지 수동 확인으로 커버.

### Lint
- `npx eslint src/renderer/prompt-hub.js` 가 통과하는지 확인 (프로젝트에 ESLint 설정이 있는 경우).
